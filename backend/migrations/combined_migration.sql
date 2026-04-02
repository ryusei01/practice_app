-- =============================================================
-- 統合マイグレーション
-- Google OAuth 移行 + テーブル構造改善
-- =============================================================

BEGIN;

-- =============================================================
-- Phase 1: Google OAuth 移行
-- =============================================================

-- hashed_password を nullable に変更
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;

-- google_id カラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR UNIQUE;
CREATE INDEX IF NOT EXISTS ix_users_google_id ON users(google_id);

-- =============================================================
-- Phase 2: users テーブル整理
-- =============================================================

-- OTP管理をotp_codesテーブルに統一するため、usersテーブルのOTPカラムを削除
ALTER TABLE users DROP COLUMN IF EXISTS otp_code;
ALTER TABLE users DROP COLUMN IF EXISTS otp_expires_at;

-- 未使用の two_factor_secret カラムを削除
ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;

-- role='seller' を廃止 → role='user' + is_seller=true に移行
UPDATE users SET role = 'user', is_seller = true WHERE role = 'seller';

-- =============================================================
-- Phase 3: ユニーク制約の追加
-- =============================================================

DO $$ BEGIN
  ALTER TABLE user_question_stats
    ADD CONSTRAINT uq_user_question UNIQUE (user_id, question_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_category_stats
    ADD CONSTRAINT uq_user_category UNIQUE (user_id, category);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE purchases
    ADD CONSTRAINT uq_buyer_question_set UNIQUE (buyer_id, question_set_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE reviews
    ADD CONSTRAINT uq_user_review UNIQUE (user_id, question_set_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================
-- Phase 4: 外部キーの ON DELETE 設定
-- =============================================================

ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS question_sets_creator_id_fkey;
ALTER TABLE question_sets
  ADD CONSTRAINT question_sets_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_set_id_fkey;
ALTER TABLE questions
  ADD CONSTRAINT questions_question_set_id_fkey
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE CASCADE;

ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_user_id_fkey;
ALTER TABLE answers
  ADD CONSTRAINT answers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
ALTER TABLE answers
  ADD CONSTRAINT answers_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_buyer_id_fkey;
ALTER TABLE purchases
  ADD CONSTRAINT purchases_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_question_set_id_fkey;
ALTER TABLE purchases
  ADD CONSTRAINT purchases_question_set_id_fkey
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE RESTRICT;

ALTER TABLE user_question_stats DROP CONSTRAINT IF EXISTS user_question_stats_user_id_fkey;
ALTER TABLE user_question_stats
  ADD CONSTRAINT user_question_stats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_question_stats DROP CONSTRAINT IF EXISTS user_question_stats_question_id_fkey;
ALTER TABLE user_question_stats
  ADD CONSTRAINT user_question_stats_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

ALTER TABLE user_category_stats DROP CONSTRAINT IF EXISTS user_category_stats_user_id_fkey;
ALTER TABLE user_category_stats
  ADD CONSTRAINT user_category_stats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_question_set_id_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_question_set_id_fkey
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE CASCADE;

-- =============================================================
-- Phase 5: 複合インデックスの追加
-- =============================================================

CREATE INDEX IF NOT EXISTS ix_answers_user_question ON answers(user_id, question_id);
CREATE INDEX IF NOT EXISTS ix_answers_user_answered_at ON answers(user_id, answered_at);
CREATE INDEX IF NOT EXISTS ix_questions_set_order ON questions(question_set_id, "order");
CREATE INDEX IF NOT EXISTS ix_reviews_user_id ON reviews(user_id);

COMMIT;
