"""
Stripe Promotion Code / Coupon の解決と JPY 金額への割引適用。
マーケット購入では settings.STRIPE_MARKETPLACE_COUPON_IDS（Coupon ID ホワイトリスト）で制限する。
"""
import logging
from typing import Set

import stripe

from ..core.config import settings

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


def get_marketplace_allowed_coupon_ids() -> Set[str]:
    raw = (settings.STRIPE_MARKETPLACE_COUPON_IDS or "").strip()
    if not raw:
        return set()
    return {x.strip() for x in raw.split(",") if x.strip()}


def lookup_active_promotion_code(customer_code: str):
    """顧客向けコード文字列で有効な Promotion Code を1件返す。見つからなければ None。"""
    code = (customer_code or "").strip()
    if not code:
        return None
    try:
        lst = stripe.PromotionCode.list(
            code=code,
            limit=1,
            expand=["data.coupon"],
        )
    except stripe.error.StripeError as e:
        logger.warning("PromotionCode.list failed: %s", e)
        return None
    if not lst.data:
        return None
    pc = lst.data[0]
    if not pc.active:
        return None
    return pc


def discounted_amount_jpy(original_jpy: int, coupon: stripe.Coupon) -> int:
    """Coupon の percent_off または amount_off（JPY）で割引後金額を算出。"""
    if original_jpy < 0:
        original_jpy = 0
    if coupon is None:
        return original_jpy
    if coupon.percent_off is not None:
        off = int(round(original_jpy * float(coupon.percent_off) / 100.0))
        return max(0, original_jpy - off)
    if coupon.amount_off is not None:
        cur = (coupon.currency or "jpy").lower()
        if cur != "jpy":
            raise ValueError("coupon_currency_not_jpy")
        return max(0, original_jpy - int(coupon.amount_off))
    return original_jpy


def assert_marketplace_coupon_whitelisted(coupon_id: str) -> None:
    """マーケット購入で使う Coupon ID がホワイトリストに含まれるか。含まれなければ ValueError。"""
    allowed = get_marketplace_allowed_coupon_ids()
    if not allowed:
        raise ValueError("marketplace_coupons_disabled")
    if coupon_id not in allowed:
        raise ValueError("coupon_not_in_whitelist")
