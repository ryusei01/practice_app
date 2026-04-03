# 有料プラン（プレミアム）TODO

表示・設定の整合は [`.cursor/plans/有料プラン整合修正_e7f6a463.plan.md`](../.cursor/plans/有料プラン整合修正_e7f6a463.plan.md) の todos 完了分を前提とする。ここでは **運用・インフラ・残作業** を追う。

## 本番・検証前（必須）

- [ ] **Stripe**
  - [ ] `STRIPE_PREMIUM_PRICE_ID` を本番用 `price_...` に設定（`price_placeholder` のままでは Checkout が 503）
  - [ ] `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` を本番値に設定（Webhook 署名検証は本番では必須）
- [ ] **Webhook**
  - [ ] エンドポイント URL: `https://<API>/api/v1/subscriptions/webhook`
  - [ ] イベント: `checkout.session.completed`（プレミアム）、`payment_intent.succeeded`（問題集購入）
- [ ] **フロント**
  - [ ] `EXPO_PUBLIC_WEB_URL` をデプロイ先オリジンに合わせる（Stripe の success/cancel URL 用）
  - [ ] `EXPO_PUBLIC_API_URL` が本番 API を指すこと

## 動作確認

- [ ] テストカードで Checkout → `/premium-success` でプレミアム反映（数秒遅延あり得る）
- [ ] マイページ・クイズ保存先（クラウド）がプレミアムで期待どおりか

## 任意・改善

- [ ] README またはデプロイ手順に Stripe / Webhook / フロント env の一覧を追記（整合修正プランではスコープ外）
- [ ] 年額プラン（1,800円/年・365日有効）のワンタイム Checkout で運用中。Stripe サブスクリプション（自動更新）への移行は別タスク
- [ ] モバイルアプリ内ブラウザで決済後に同一セッションで戻る挙動の追加検証

## 参照

- バックエンド例: `backend/.env.example`
- フロント例: `frontend/.env.example`
- 実装: `backend/app/api/subscriptions.py`、`frontend/app/premium-success.tsx`、`frontend/app/premium-cancel.tsx`
