-- =============================================================
-- 全未適用カラムの一括マイグレーション
-- 作成日: 2026-04-02
-- 目的: ローカル/Supabase DBに不足しているカラムをすべて追加する
--       IF NOT EXISTS により既に存在するカラムは無視されるため安全
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- users テーブル: Google OAuth
-- -------------------------------------------------------------
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR UNIQUE;
CREATE INDEX IF NOT EXISTS ix_users_google_id ON users(google_id);

-- -------------------------------------------------------------
-- users テーブル: 販売者申請フロー
-- -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_application_status VARCHAR DEFAULT 'none' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_application_submitted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_application_admin_note TEXT;

-- 既存の is_seller=true ユーザーは申請済みとしてマーク
UPDATE users SET seller_application_status = 'approved' WHERE is_seller = TRUE AND seller_application_status = 'none';

-- -------------------------------------------------------------
-- users テーブル: プレミアム・Stripe
-- -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR;
CREATE INDEX IF NOT EXISTS idx_users_is_premium ON users(is_premium);

-- -------------------------------------------------------------
-- users テーブル: アカウントクレジット
-- -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_credit_jpy INTEGER NOT NULL DEFAULT 0;

-- -------------------------------------------------------------
-- users テーブル: 販売者利用規約同意日時
-- -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_terms_accepted_at TIMESTAMP NULL;

-- -------------------------------------------------------------
-- users テーブル: セキュリティ（ログイン試行・ロック）
-- -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
UPDATE users SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL;

-- -------------------------------------------------------------
-- users テーブル: リフレッシュトークン
-- -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token VARCHAR;

-- -------------------------------------------------------------
-- users テーブル: 2段階認証
-- -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT;

-- -------------------------------------------------------------
-- question_sets テーブル: 審査フロー
-- -------------------------------------------------------------
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'not_required';

-- -------------------------------------------------------------
-- question_sets テーブル: 教科書インラインコンテンツ
-- -------------------------------------------------------------
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS textbook_content TEXT;

-- -------------------------------------------------------------
-- question_sets: コンテンツ言語 content_language（代表） / content_languages（JSON 配列）
-- content_language のみ DROP 済みの DB でもエラーにしない（片方から相互に埋める）
-- -------------------------------------------------------------
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS content_languages JSONB;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS content_language VARCHAR;

DO $qs_lang$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'question_sets' AND column_name = 'content_language'
  ) THEN
    UPDATE question_sets
    SET content_languages = jsonb_build_array(content_language)
    WHERE content_language IS NOT NULL
      AND (content_languages IS NULL OR content_languages = 'null'::jsonb);
  END IF;
END $qs_lang$;

UPDATE question_sets SET content_languages = COALESCE(content_languages, '["ja"]'::jsonb) WHERE content_languages IS NULL;

UPDATE question_sets
SET content_language = COALESCE(NULLIF(trim(content_language), ''), content_languages->>0, 'ja')
WHERE content_language IS NULL OR trim(content_language) = '';

ALTER TABLE question_sets ALTER COLUMN content_language SET DEFAULT 'ja';
ALTER TABLE question_sets ALTER COLUMN content_language SET NOT NULL;
ALTER TABLE question_sets ALTER COLUMN content_languages SET DEFAULT '["ja"]'::jsonb;
ALTER TABLE question_sets ALTER COLUMN content_languages SET NOT NULL;

-- -------------------------------------------------------------
-- processed_checkout_sessions テーブル（冪等処理用）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_checkout_sessions (
  checkout_session_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  processed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_processed_checkout_sessions_user_id ON processed_checkout_sessions(user_id);

ALTER TABLE public.processed_checkout_sessions ENABLE ROW LEVEL SECURITY;

COMMIT;
