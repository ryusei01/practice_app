"""
Stripe Connect統合サービス
"""
import stripe
from typing import Dict, Optional
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    """Stripe決済サービス"""

    def __init__(self):
        self.platform_fee_percent = settings.PLATFORM_FEE_PERCENT

    def create_connect_account(self, email: str, country: str = "JP") -> Dict:
        """
        販売者用のStripe Connectアカウントを作成

        Args:
            email: 販売者のメールアドレス
            country: 国コード（デフォルト: JP）

        Returns:
            Stripeアカウント情報
        """
        try:
            account = stripe.Account.create(
                type="express",  # Expressアカウント（簡易版）
                country=country,
                email=email,
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
            )

            logger.info(f"Created Stripe Connect account: {account.id}")
            return {
                "account_id": account.id,
                "status": "created"
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            raise Exception(f"Failed to create Stripe account: {str(e)}")

    def create_account_link(self, account_id: str, return_url: str, refresh_url: str) -> str:
        """
        販売者のオンボーディングリンクを生成

        Args:
            account_id: StripeアカウントID
            return_url: オンボーディング完了後のリダイレクトURL
            refresh_url: リフレッシュURL

        Returns:
            オンボーディングURL
        """
        try:
            account_link = stripe.AccountLink.create(
                account=account_id,
                refresh_url=refresh_url,
                return_url=return_url,
                type="account_onboarding",
            )

            return account_link.url

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            raise Exception(f"Failed to create account link: {str(e)}")

    def create_payment_intent(
        self,
        amount: int,
        seller_account_id: str,
        currency: str = "jpy",
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        支払いインテントを作成

        Args:
            amount: 支払い金額（円）
            seller_account_id: 販売者のStripeアカウントID
            currency: 通貨コード
            metadata: メタデータ

        Returns:
            PaymentIntent情報
        """
        try:
            # プラットフォーム手数料を計算
            platform_fee = int(amount * self.platform_fee_percent / 100)

            payment_intent = stripe.PaymentIntent.create(
                amount=amount,
                currency=currency,
                application_fee_amount=platform_fee,  # プラットフォーム手数料
                transfer_data={
                    "destination": seller_account_id,  # 販売者に送金
                },
                metadata=metadata or {},
            )

            logger.info(f"Created payment intent: {payment_intent.id}")
            return {
                "payment_intent_id": payment_intent.id,
                "client_secret": payment_intent.client_secret,
                "amount": amount,
                "platform_fee": platform_fee,
                "seller_amount": amount - platform_fee,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            raise Exception(f"Failed to create payment intent: {str(e)}")

    def confirm_payment(self, payment_intent_id: str) -> Dict:
        """
        支払いを確認

        Args:
            payment_intent_id: PaymentIntent ID

        Returns:
            支払い状態
        """
        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

            return {
                "status": payment_intent.status,
                "amount": payment_intent.amount,
                "paid": payment_intent.status == "succeeded",
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            raise Exception(f"Failed to confirm payment: {str(e)}")

    def get_account_status(self, account_id: str) -> Dict:
        """
        Connectアカウントの状態を取得

        Args:
            account_id: StripeアカウントID

        Returns:
            アカウント状態
        """
        try:
            account = stripe.Account.retrieve(account_id)

            return {
                "account_id": account.id,
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "details_submitted": account.details_submitted,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            raise Exception(f"Failed to get account status: {str(e)}")

    def handle_webhook(self, payload: bytes, sig_header: str) -> Dict:
        """
        Stripeウェブフックを処理

        Args:
            payload: リクエストボディ
            sig_header: Stripe署名ヘッダー

        Returns:
            イベント情報
        """
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )

            logger.info(f"Webhook received: {event['type']}")

            # イベントタイプに応じた処理
            if event['type'] == 'payment_intent.succeeded':
                payment_intent = event['data']['object']
                # 支払い成功時の処理
                logger.info(f"Payment succeeded: {payment_intent['id']}")

            elif event['type'] == 'account.updated':
                account = event['data']['object']
                # アカウント更新時の処理
                logger.info(f"Account updated: {account['id']}")

            return {"status": "processed", "type": event['type']}

        except ValueError as e:
            logger.error(f"Invalid payload: {str(e)}")
            raise Exception("Invalid payload")

        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {str(e)}")
            raise Exception("Invalid signature")


# シングルトンインスタンス
stripe_service = StripeService()
