# Stripe 決済まわりセキュリティ（チェックリスト対応メモ）

カード番号（PAN）は **Stripe Elements / Checkout** 側で扱い、当アプリは **PaymentIntent / Checkout Session の client_secret や URL** のみ扱う（PCI DSS の範囲縮小）。

## 1. チェックリスト項目と対応の持ち場

| 項目 | 対応 |
|------|------|
| 不審 IP からのアクセス制限 | **Cloudflare WAF / IP ルール**（[EDGE_WAF_AND_UPLOAD_LIMITS.md](./EDGE_WAF_AND_UPLOAD_LIMITS.md)）＋ API の `slowapi`（決済エンドポイントはユーザー ID 優先キー） |
| 同一アカウントからの入力制限 | `POST /api/v1/payments/create-payment-intent`、`confirm-purchase`、`create-connect-account-link`、`POST /api/v1/subscriptions/create-checkout` にレート制限 |
| エラー内容の非表示 | Stripe 例外は **サーバログに詳細**、クライアントには汎用メッセージ（例: 決済開始失敗・セッション作成失敗）。`confirm-purchase` では決済未完了時に **Stripe の status 文字列を返さない** |
| EMV 3-D セキュア | **Stripe Dashboard** でカード認証・Radar 設定を確認。必要に応じて PaymentIntent の `payment_method_options` や業務フローで SCA/3DS を有効化（カード・国により異なる） |
| SMS 等の本人確認 | **イシュア（カード発行会社）側の 3DS** が中心。当アプリ単体で SMS を送る要件ではない |
| 有効性確認の回数制限 | 上記 API のレート制限 ＋ **Stripe Radar** のルール・ブロックリスト |

## 2. 運用で確認すること（ダッシュボード）

- **Radar** のオン・ルールの見直し
- **3D Secure** / 認証フローの有効化状況
- **Webhook** 署名シークレット（`STRIPE_WEBHOOK_SECRET`）の設定とローテーション方針

## 3. 関連コード

- `backend/app/api/payments.py`
- `backend/app/api/subscriptions.py`
- `backend/app/services/stripe_service.py`
