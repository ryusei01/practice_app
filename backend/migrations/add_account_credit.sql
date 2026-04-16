-- アプリ内クレジット残高（円、整数）
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_credit_jpy INTEGER NOT NULL DEFAULT 0;

-- Stripe Checkout 完了の冪等処理用（同一セッションの二重適用防止）
CREATE TABLE IF NOT EXISTS processed_checkout_sessions (
  checkout_session_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_checkout_sessions_user_id ON processed_checkout_sessions(user_id);

ALTER TABLE public.processed_checkout_sessions ENABLE ROW LEVEL SECURITY;
