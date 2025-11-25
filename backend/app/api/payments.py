"""
Stripe Connect決済APIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

from ..core.database import get_db
from ..core.auth import get_current_active_user
from ..models import User, QuestionSet, Purchase

router = APIRouter()


class CreatePaymentIntentRequest(BaseModel):
    question_set_id: str
    return_url: Optional[str] = None


class CreatePaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    seller_amount: int
    platform_fee: int


class StripeAccountLinkRequest(BaseModel):
    return_url: str
    refresh_url: str


class PurchaseResponse(BaseModel):
    id: str
    question_set_id: str
    amount: int
    purchased_at: datetime

    class Config:
        from_attributes = True


@router.post("/create-payment-intent", response_model=CreatePaymentIntentResponse)
async def create_payment_intent(
    request: CreatePaymentIntentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    問題集購入用のPayment Intentを作成

    Stripe APIを使用して決済を開始する
    """
    # 問題集を取得
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == request.question_set_id
    ).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    if not question_set.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="この問題集は公開されていません"
        )

    # 既に購入済みかチェック
    existing_purchase = db.query(Purchase).filter(
        Purchase.buyer_id == current_user.id,
        Purchase.question_set_id == request.question_set_id
    ).first()

    if existing_purchase:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="この問題集は既に購入済みです"
        )

    # 無料の場合は購入記録を作成して終了
    if question_set.price == 0:
        new_purchase = Purchase(
            id=str(uuid.uuid4()),
            buyer_id=current_user.id,
            question_set_id=request.question_set_id,
            amount=0,
            platform_fee=0,
            seller_amount=0
        )
        db.add(new_purchase)
        db.commit()

        return CreatePaymentIntentResponse(
            client_secret="free",
            payment_intent_id="free",
            amount=0,
            seller_amount=0,
            platform_fee=0
        )

    # プラットフォーム手数料を計算（10%）
    platform_fee = int(question_set.price * 0.1)
    seller_amount = question_set.price - platform_fee

    # 実際のStripe統合はここで行う
    # 今回はモック実装
    payment_intent_id = f"pi_mock_{uuid.uuid4().hex[:24]}"
    client_secret = f"pi_mock_{uuid.uuid4().hex[:24]}_secret_{uuid.uuid4().hex[:16]}"

    # NOTE: 実際のStripe統合では以下のようなコードになります
    # import stripe
    # stripe.api_key = settings.STRIPE_SECRET_KEY
    #
    # creator = db.query(User).filter(User.id == question_set.creator_id).first()
    # if not creator.stripe_account_id:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="販売者のStripeアカウントが未設定です"
    #     )
    #
    # payment_intent = stripe.PaymentIntent.create(
    #     amount=question_set.price,
    #     currency="jpy",
    #     application_fee_amount=platform_fee,
    #     transfer_data={
    #         "destination": creator.stripe_account_id,
    #     },
    #     metadata={
    #         "question_set_id": request.question_set_id,
    #         "buyer_id": current_user.id,
    #     }
    # )

    return CreatePaymentIntentResponse(
        client_secret=client_secret,
        payment_intent_id=payment_intent_id,
        amount=question_set.price,
        seller_amount=seller_amount,
        platform_fee=platform_fee
    )


@router.post("/confirm-purchase")
async def confirm_purchase(
    payment_intent_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    決済完了後に購入記録を作成

    WebhookまたはフロントエンドからのCallbackで呼ばれる
    """
    # 実際のStripe統合では、Payment Intentのステータスを確認
    # payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
    # if payment_intent.status != "succeeded":
    #     raise HTTPException(status_code=400, detail="Payment not completed")

    # メタデータから情報を取得（モックでは直接クエリ）
    # 既存の購入記録があるかチェック
    existing = db.query(Purchase).filter(
        Purchase.stripe_payment_intent_id == payment_intent_id
    ).first()

    if existing:
        return {"message": "Purchase already recorded", "purchase_id": existing.id}

    # モック実装: payment_intent_idからデータを取得できないため、
    # 実際の実装ではStripe APIから取得する
    return {
        "message": "Purchase confirmed (mock)",
        "payment_intent_id": payment_intent_id
    }


@router.post("/create-connect-account-link")
async def create_connect_account_link(
    request: StripeAccountLinkRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Stripe Connect アカウント登録リンクを作成

    販売者がStripe Connectアカウントを作成・管理するためのリンク
    """
    # 実際のStripe統合
    # import stripe
    #
    # if not current_user.stripe_account_id:
    #     # 新規アカウント作成
    #     account = stripe.Account.create(
    #         type="express",
    #         country="JP",
    #         email=current_user.email,
    #         capabilities={
    #             "card_payments": {"requested": True},
    #             "transfers": {"requested": True},
    #         },
    #     )
    #     current_user.stripe_account_id = account.id
    #     current_user.is_seller = True
    #     db.commit()
    #
    # account_link = stripe.AccountLink.create(
    #     account=current_user.stripe_account_id,
    #     refresh_url=request.refresh_url,
    #     return_url=request.return_url,
    #     type="account_onboarding",
    # )
    #
    # return {"url": account_link.url}

    # モック実装
    mock_account_id = f"acct_mock_{uuid.uuid4().hex[:16]}"
    if not current_user.stripe_account_id:
        current_user.stripe_account_id = mock_account_id
        current_user.is_seller = True
        db.commit()

    return {
        "url": f"https://connect.stripe.com/setup/mock/{mock_account_id}",
        "account_id": current_user.stripe_account_id
    }


@router.get("/my-purchases", response_model=list[PurchaseResponse])
async def get_my_purchases(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    自分の購入履歴を取得
    """
    purchases = db.query(Purchase).filter(
        Purchase.buyer_id == current_user.id
    ).order_by(Purchase.purchased_at.desc()).all()

    return purchases


@router.get("/seller-dashboard")
async def get_seller_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    販売者ダッシュボード情報を取得
    """
    if not current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="販売者権限が必要です"
        )

    # 自分の問題集の購入履歴を取得
    question_sets = db.query(QuestionSet).filter(
        QuestionSet.creator_id == current_user.id
    ).all()

    question_set_ids = [qs.id for qs in question_sets]

    purchases = db.query(Purchase).filter(
        Purchase.question_set_id.in_(question_set_ids)
    ).all()

    total_sales = sum(p.amount for p in purchases)
    total_earnings = sum(p.seller_amount for p in purchases)
    total_orders = len(purchases)

    return {
        "is_connected": bool(current_user.stripe_account_id),
        "stripe_account_id": current_user.stripe_account_id,
        "total_sales": total_sales,
        "total_earnings": total_earnings,
        "total_orders": total_orders,
        "question_sets_count": len(question_sets),
    }
