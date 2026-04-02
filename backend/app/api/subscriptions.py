"""
有料プラン（550円）の購入・Webhook 処理
"""
import stripe
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

import uuid

from ..core.database import get_db
from ..core.auth import get_current_active_user
from ..core.config import settings
from ..models import User, Purchase, QuestionSet
from ..models.processed_checkout import ProcessedCheckoutSession

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter()

PREMIUM_PLAN_DAYS = 365  # 1年間有効


class CreateCheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PremiumStatusResponse(BaseModel):
    is_premium: bool
    premium_expires_at: Optional[datetime]
    account_credit_jpy: int


@router.post("/create-checkout", response_model=CreateCheckoutResponse)
async def create_premium_checkout(
    success_url: str,
    cancel_url: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    550円有料プランの Stripe Checkout セッションを作成する。
    フロントエンドはレスポンスの checkout_url へリダイレクトする。
    """
    if not settings.STRIPE_PREMIUM_PRICE_ID or settings.STRIPE_PREMIUM_PRICE_ID == "price_placeholder":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="決済システムが設定されていません。管理者にお問い合わせください。",
        )

    try:
        # Stripe 顧客を作成/再利用
        customer_id = current_user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={"user_id": current_user.id},
            )
            customer_id = customer.id
            current_user.stripe_customer_id = customer_id
            db.commit()

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price": settings.STRIPE_PREMIUM_PRICE_ID,
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user.id,
                "type": "premium_plan",
            },
        )

        return CreateCheckoutResponse(
            checkout_url=session.url,
            session_id=session.id,
        )

    except stripe.error.StripeError as e:
        logger.error(f"Stripe Checkout 作成エラー: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="決済セッションの作成に失敗しました。",
        )


@router.get("/status", response_model=PremiumStatusResponse)
async def get_premium_status(current_user: User = Depends(get_current_active_user)):
    """現在のプレミアム状態とクレジット残高を返す"""
    return PremiumStatusResponse(
        is_premium=current_user.is_premium,
        premium_expires_at=current_user.premium_expires_at,
        account_credit_jpy=current_user.account_credit_jpy or 0,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe Webhook: checkout.session.completed を受け取り
    is_premium を有効化して 200円クレジットを付与する。
    冪等処理のため processed_checkout_sessions で重複チェックする。
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET が未設定です。Webhook 署名を検証できません。")
        try:
            event = stripe.Event.construct_from(
                {"type": "unknown", "data": {}}, stripe.api_key
            )
            event = stripe.util.convert_to_stripe_object(
                stripe.util.json.loads(payload), stripe.api_key, None
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")
    else:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        _handle_checkout_completed(session, db)
    elif event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        _handle_payment_intent_succeeded(pi, db)

    return JSONResponse(content={"status": "ok"})


def _handle_checkout_completed(session: dict, db: Session) -> None:
    """checkout.session.completed の冪等ハンドラ"""
    session_id = session.get("id", "")
    metadata = session.get("metadata") or {}
    user_id = metadata.get("user_id")
    plan_type = metadata.get("type")

    if plan_type != "premium_plan" or not user_id:
        return

    # 冪等チェック
    already = db.query(ProcessedCheckoutSession).filter_by(
        checkout_session_id=session_id
    ).first()
    if already:
        logger.info(f"既に処理済みのセッション: {session_id}")
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.error(f"Webhook: ユーザーが見つかりません user_id={user_id}")
        return

    # プレミアム有効化（1年間）
    user.is_premium = True
    user.premium_expires_at = datetime.utcnow() + timedelta(days=PREMIUM_PLAN_DAYS)

    # 200円クレジット付与
    user.account_credit_jpy = (user.account_credit_jpy or 0) + settings.PREMIUM_PLAN_CREDIT_JPY

    # 処理済みとして記録
    db.add(ProcessedCheckoutSession(
        checkout_session_id=session_id,
        user_id=user_id,
    ))

    db.commit()
    logger.info(
        f"プレミアム有効化 & {settings.PREMIUM_PLAN_CREDIT_JPY}円クレジット付与: user_id={user_id}"
    )


def _handle_payment_intent_succeeded(pi: dict, db: Session) -> None:
    """payment_intent.succeeded の冪等ハンドラ（問題集マーケットプレイス購入）"""
    pi_id = pi.get("id", "")
    metadata = pi.get("metadata") or {}
    question_set_id = metadata.get("question_set_id")
    buyer_id = metadata.get("buyer_id")

    if not question_set_id or not buyer_id:
        return

    # 冪等チェック
    already = db.query(Purchase).filter(
        Purchase.stripe_payment_intent_id == pi_id
    ).first()
    if already:
        logger.info(f"既に処理済みの PaymentIntent: {pi_id}")
        return

    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
    if not question_set:
        logger.error(f"Webhook: 問題集が見つかりません question_set_id={question_set_id}")
        return

    buyer = db.query(User).filter(User.id == buyer_id).first()
    if not buyer:
        logger.error(f"Webhook: 購入者が見つかりません buyer_id={buyer_id}")
        return

    amount = pi.get("amount", 0)
    platform_fee = pi.get("application_fee_amount") or int(amount * settings.PLATFORM_FEE_PERCENT / 100)
    seller_amount = amount - platform_fee

    new_purchase = Purchase(
        id=str(uuid.uuid4()),
        buyer_id=buyer_id,
        question_set_id=question_set_id,
        amount=amount,
        platform_fee=platform_fee,
        seller_amount=seller_amount,
        stripe_payment_intent_id=pi_id,
    )
    db.add(new_purchase)
    db.commit()
    logger.info(f"問題集購入完了: question_set_id={question_set_id}, buyer_id={buyer_id}, amount={amount}")
