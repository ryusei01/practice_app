"""
Stripe Connect決済APIエンドポイント
"""
import stripe
import logging
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
import csv
import io
from datetime import datetime, timedelta

from ..core.database import get_db
from ..core.auth import get_current_active_user
from ..core.config import settings
from ..core.limiter import limiter
from ..core.rate_limit_keys import payment_user_or_ip_key
from ..models import User, QuestionSet, Purchase
from ..services.stripe_service import stripe_service
from ..services.stripe_coupon import (
    assert_marketplace_coupon_whitelisted,
    discounted_amount_jpy,
    lookup_active_promotion_code,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class CreatePaymentIntentRequest(BaseModel):
    question_set_id: str
    return_url: Optional[str] = None
    promotion_code: Optional[str] = None


class CreatePaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    seller_amount: int
    platform_fee: int
    original_amount_jpy: int


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


class QuestionSetBreakdown(BaseModel):
    id: str
    title: str
    price: int
    sales_count: int
    total_revenue: int
    seller_revenue: int


class RecentTransaction(BaseModel):
    purchased_at: datetime
    question_set_title: str
    amount: int
    platform_fee: int
    seller_amount: int


class MonthlySummary(BaseModel):
    month: str
    total_sales: int
    total_earnings: int
    order_count: int


class SellerDashboardResponse(BaseModel):
    is_connected: bool
    stripe_account_id: Optional[str] = None
    stripe_configured: bool
    total_sales: int
    total_earnings: int
    total_orders: int
    question_sets_count: int
    question_set_breakdown: list[QuestionSetBreakdown]
    recent_transactions: list[RecentTransaction]
    monthly_summary: list[MonthlySummary]


@router.post("/create-payment-intent", response_model=CreatePaymentIntentResponse)
@limiter.limit("30/hour", key_func=payment_user_or_ip_key)
@limiter.limit("10/minute", key_func=payment_user_or_ip_key)
async def create_payment_intent(
    request: Request,
    payload: CreatePaymentIntentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    問題集購入用のPayment Intentを作成

    Stripe APIを使用して決済を開始する
    """
    # 問題集を取得
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == payload.question_set_id
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
        Purchase.question_set_id == payload.question_set_id
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
            question_set_id=payload.question_set_id,
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
            platform_fee=0,
            original_amount_jpy=0,
        )

    creator = db.query(User).filter(User.id == question_set.creator_id).first()
    if not creator or not creator.stripe_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="販売者のStripeアカウントが未設定です"
        )

    original_jpy = question_set.price
    final_jpy = original_jpy
    pi_metadata: dict = {
        "question_set_id": payload.question_set_id,
        "buyer_id": current_user.id,
        "original_amount_jpy": str(original_jpy),
    }

    code_trim = (payload.promotion_code or "").strip()
    if code_trim:
        pc = lookup_active_promotion_code(code_trim)
        if not pc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="クーポンコードが見つからないか、利用できません。",
            )
        coupon = pc.coupon
        if isinstance(coupon, str):
            coupon = stripe.Coupon.retrieve(coupon)
        try:
            assert_marketplace_coupon_whitelisted(coupon.id)
        except ValueError as e:
            reason = str(e)
            if reason == "marketplace_coupons_disabled":
                detail = (
                    "マーケット向けクーポンは現在利用できません。"
                    "管理者が STRIPE_MARKETPLACE_COUPON_IDS を設定するまでお待ちください。"
                )
            elif reason == "coupon_not_in_whitelist":
                detail = "このクーポンは問題集購入では利用できません。"
            else:
                detail = "このクーポンは利用できません。"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail,
            ) from e
        try:
            final_jpy = discounted_amount_jpy(original_jpy, coupon)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="このクーポンは現在の通貨（JPY）に対応していません。",
            )
        if final_jpy < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="このクーポンでは決済額が0円以下になるため、問題集購入には使えません。",
            )
        pi_metadata["promotion_code_id"] = pc.id
        pi_metadata["coupon_id"] = coupon.id

    try:
        result = stripe_service.create_payment_intent(
            amount=final_jpy,
            seller_account_id=creator.stripe_account_id,
            metadata=pi_metadata,
        )
    except Exception as e:
        logger.error(f"PaymentIntent作成エラー: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="決済の開始に失敗しました。しばらくしてから再試行してください。"
        )

    return CreatePaymentIntentResponse(
        client_secret=result["client_secret"],
        payment_intent_id=result["payment_intent_id"],
        amount=result["amount"],
        seller_amount=result["seller_amount"],
        platform_fee=result["platform_fee"],
        original_amount_jpy=original_jpy,
    )


@router.post("/confirm-purchase")
@limiter.limit("60/hour", key_func=payment_user_or_ip_key)
@limiter.limit("30/minute", key_func=payment_user_or_ip_key)
async def confirm_purchase(
    request: Request,
    payment_intent_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    決済完了後に購入記録を作成

    フロントエンドの支払い完了後に呼ばれる。Webhook でも同じ処理が行われるため冪等に実装する。
    """
    existing = db.query(Purchase).filter(
        Purchase.stripe_payment_intent_id == payment_intent_id
    ).first()

    if existing:
        return {"message": "Purchase already recorded", "purchase_id": existing.id}

    try:
        pi = stripe.PaymentIntent.retrieve(payment_intent_id)
    except stripe.error.StripeError as e:
        logger.error(f"PaymentIntent取得エラー: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="決済状態の確認に失敗しました。"
        )

    if pi.status != "succeeded":
        logger.info(
            "confirm_purchase incomplete status=%s pi=%s user=%s",
            pi.status,
            payment_intent_id,
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="決済が完了していません。カード情報をご確認のうえ、しばらくしてから再度お試しください。",
        )

    metadata = pi.get("metadata") or {}
    question_set_id = metadata.get("question_set_id")
    buyer_id_meta = metadata.get("buyer_id")

    if not question_set_id or buyer_id_meta != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="決済情報が不正です"
        )

    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
    if not question_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="問題集が見つかりません")

    amount = pi.amount
    platform_fee = pi.application_fee_amount or int(amount * settings.PLATFORM_FEE_PERCENT / 100)
    seller_amount = amount - platform_fee

    new_purchase = Purchase(
        id=str(uuid.uuid4()),
        buyer_id=current_user.id,
        question_set_id=question_set_id,
        amount=amount,
        platform_fee=platform_fee,
        seller_amount=seller_amount,
        stripe_payment_intent_id=payment_intent_id,
    )
    db.add(new_purchase)
    db.commit()

    return {"message": "Purchase confirmed", "purchase_id": new_purchase.id}


@router.post("/create-connect-account-link")
@limiter.limit("20/hour", key_func=payment_user_or_ip_key)
@limiter.limit("5/minute", key_func=payment_user_or_ip_key)
async def create_connect_account_link(
    request: Request,
    payload: StripeAccountLinkRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Stripe Connect アカウント登録リンクを作成

    販売者がStripe Connectアカウントを作成・管理するためのリンク
    """
    if not stripe_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripeが設定されていません。管理者にお問い合わせください。",
        )

    try:
        if not current_user.stripe_account_id:
            result = stripe_service.create_connect_account(current_user.email)
            current_user.stripe_account_id = result["account_id"]
            current_user.is_seller = True
            db.commit()

        url = stripe_service.create_account_link(
            account_id=current_user.stripe_account_id,
            return_url=payload.return_url,
            refresh_url=payload.refresh_url,
        )
    except Exception as e:
        logger.error(f"Connect アカウントリンク作成エラー: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe Connect アカウントの設定に失敗しました。"
        )

    return {"url": url, "account_id": current_user.stripe_account_id}


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


@router.post("/accept-seller-terms")
async def accept_seller_terms(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    販売者利用規約への同意を記録

    販売者がStripe Connect登録前に利用規約・特定商取引法に同意したことを記録する
    """
    current_user.seller_terms_accepted_at = datetime.utcnow()
    db.commit()
    return {
        "message": "販売者利用規約への同意を記録しました",
        "accepted_at": current_user.seller_terms_accepted_at.isoformat()
    }


@router.get("/seller-revenue-export")
async def export_seller_revenue(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    販売者の売上データをCSV形式でエクスポート

    税務申告用の売上記録をCSVファイルとして提供する
    """
    if not current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="販売者権限が必要です"
        )

    question_sets = db.query(QuestionSet).filter(
        QuestionSet.creator_id == current_user.id
    ).all()
    question_set_ids = [qs.id for qs in question_sets]
    question_set_map = {qs.id: qs.title for qs in question_sets}

    purchases = db.query(Purchase).filter(
        Purchase.question_set_id.in_(question_set_ids)
    ).order_by(Purchase.purchased_at.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "購入日時", "問題集名", "販売金額（円）",
        "プラットフォーム手数料（円）", "販売者受取額（円）",
        "Stripe決済ID"
    ])
    for p in purchases:
        writer.writerow([
            p.purchased_at.strftime("%Y-%m-%d %H:%M:%S"),
            question_set_map.get(p.question_set_id, ""),
            p.amount,
            p.platform_fee,
            p.seller_amount,
            p.stripe_payment_intent_id or ""
        ])

    output.seek(0)
    filename = f"revenue_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/seller-dashboard", response_model=SellerDashboardResponse)
async def get_seller_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    販売者ダッシュボード情報を取得

    集計値に加え、問題集別内訳・直近取引・月次推移を返す。
    """
    if not current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="販売者権限が必要です"
        )

    question_sets = db.query(QuestionSet).filter(
        QuestionSet.creator_id == current_user.id
    ).all()
    qs_map = {qs.id: qs for qs in question_sets}
    question_set_ids = list(qs_map.keys())

    purchases = db.query(Purchase).filter(
        Purchase.question_set_id.in_(question_set_ids)
    ).order_by(Purchase.purchased_at.desc()).all()

    total_sales = sum(p.amount for p in purchases)
    total_earnings = sum(p.seller_amount for p in purchases)
    total_orders = len(purchases)

    # --- 問題集別内訳 ---
    breakdown_map: dict[str, dict] = {}
    for qs in question_sets:
        breakdown_map[qs.id] = {
            "id": qs.id,
            "title": qs.title,
            "price": qs.price or 0,
            "sales_count": 0,
            "total_revenue": 0,
            "seller_revenue": 0,
        }
    for p in purchases:
        entry = breakdown_map.get(p.question_set_id)
        if entry:
            entry["sales_count"] += 1
            entry["total_revenue"] += p.amount
            entry["seller_revenue"] += p.seller_amount

    question_set_breakdown = sorted(
        breakdown_map.values(),
        key=lambda x: x["total_revenue"],
        reverse=True,
    )

    # --- 直近取引 (20件) ---
    recent_transactions = []
    for p in purchases[:20]:
        qs = qs_map.get(p.question_set_id)
        recent_transactions.append(RecentTransaction(
            purchased_at=p.purchased_at,
            question_set_title=qs.title if qs else "(削除済み)",
            amount=p.amount,
            platform_fee=p.platform_fee,
            seller_amount=p.seller_amount,
        ))

    # --- 月次集計 (直近6ヶ月、当月含む) ---
    now = datetime.utcnow()
    m = now.month - 5
    if m <= 0:
        six_months_ago = datetime(now.year - 1, m + 12, 1)
    else:
        six_months_ago = datetime(now.year, m, 1)

    monthly_buckets: dict[str, dict] = defaultdict(
        lambda: {"total_sales": 0, "total_earnings": 0, "order_count": 0}
    )
    for p in purchases:
        if p.purchased_at and p.purchased_at >= six_months_ago:
            key = p.purchased_at.strftime("%Y-%m")
            monthly_buckets[key]["total_sales"] += p.amount
            monthly_buckets[key]["total_earnings"] += p.seller_amount
            monthly_buckets[key]["order_count"] += 1

    monthly_summary = [
        MonthlySummary(month=k, **v)
        for k, v in sorted(monthly_buckets.items(), reverse=True)
    ]

    return SellerDashboardResponse(
        is_connected=bool(current_user.stripe_account_id),
        stripe_account_id=current_user.stripe_account_id,
        stripe_configured=stripe_service.is_configured,
        total_sales=total_sales,
        total_earnings=total_earnings,
        total_orders=total_orders,
        question_sets_count=len(question_sets),
        question_set_breakdown=question_set_breakdown,
        recent_transactions=recent_transactions,
        monthly_summary=monthly_summary,
    )
