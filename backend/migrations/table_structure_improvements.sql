-- テーブル構造改善マイグレーション
-- 実行日: 2026-04-02

-- =============================================================
-- 1. users テーブル: 不要カラム削除
-- =============================================================

-- OTP管理をotp_codesテーブルに統一するため、usersテーブルのOTPカラムを削除
ALTER TABLE users DROP COLUMN IF EXISTS otp_code;
ALTER TABLE users DROP COLUMN IF EXISTS otp_expires_at;

-- 未使用の two_factor_secret カラムを削除
ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;

-- role Enumから SELLER を除外 (native_enum=Falseのため文字列カラム)
-- 既存の role='seller' のユーザーを role='user' に変更
UPDATE users SET role = 'user' WHERE role = 'seller';

-- =============================================================
-- 2. ユニーク制約の追加
-- =============================================================

-- user_question_stats: 同一ユーザー×問題の重複防止
ALTER TABLE user_question_stats
  ADD CONSTRAINT uq_user_question UNIQUE (user_id, question_id);

-- user_category_stats: 同一ユーザー×カテゴリの重複防止
ALTER TABLE user_category_stats
  ADD CONSTRAINT uq_user_category UNIQUE (user_id, category);

-- purchases: 同一ユーザー×問題集の二重購入防止
ALTER TABLE purchases
  ADD CONSTRAINT uq_buyer_question_set UNIQUE (buyer_id, question_set_id);

-- reviews: 同一ユーザー×問題集の複数レビュー防止
ALTER TABLE reviews
  ADD CONSTRAINT uq_user_review UNIQUE (user_id, question_set_id);

-- =============================================================
-- 3. 外部キーの ON DELETE 設定
-- =============================================================

-- question_sets.creator_id -> users (RESTRICT: 問題集がある限りユーザー削除不可)
ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS question_sets_creator_id_fkey;
ALTER TABLE question_sets
  ADD CONSTRAINT question_sets_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;

-- questions.question_set_id -> question_sets (CASCADE: 問題集削除で問題も削除)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_set_id_fkey;
ALTER TABLE questions
  ADD CONSTRAINT questions_question_set_id_fkey
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE CASCADE;

-- answers.user_id -> users (CASCADE)
ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_user_id_fkey;
ALTER TABLE answers
  ADD CONSTRAINT answers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- answers.question_id -> questions (CASCADE)
ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
ALTER TABLE answers
  ADD CONSTRAINT answers_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

-- purchases.buyer_id -> users (RESTRICT: 購入履歴がある限りユーザー削除不可)
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_buyer_id_fkey;
ALTER TABLE purchases
  ADD CONSTRAINT purchases_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT;

-- purchases.question_set_id -> question_sets (RESTRICT: 購入履歴がある限り問題集削除不可)
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_question_set_id_fkey;
ALTER TABLE purchases
  ADD CONSTRAINT purchases_question_set_id_fkey
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE RESTRICT;

-- user_question_stats.user_id -> users (CASCADE)
ALTER TABLE user_question_stats DROP CONSTRAINT IF EXISTS user_question_stats_user_id_fkey;
ALTER TABLE user_question_stats
  ADD CONSTRAINT user_question_stats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- user_question_stats.question_id -> questions (CASCADE)
ALTER TABLE user_question_stats DROP CONSTRAINT IF EXISTS user_question_stats_question_id_fkey;
ALTER TABLE user_question_stats
  ADD CONSTRAINT user_question_stats_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

-- user_category_stats.user_id -> users (CASCADE)
ALTER TABLE user_category_stats DROP CONSTRAINT IF EXISTS user_category_stats_user_id_fkey;
ALTER TABLE user_category_stats
  ADD CONSTRAINT user_category_stats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- reviews.user_id -> users (CASCADE)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- reviews.question_set_id -> question_sets (CASCADE)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_question_set_id_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_question_set_id_fkey
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE CASCADE;

-- =============================================================
-- 4. 複合インデックスの追加
-- =============================================================

-- answers: 推薦クエリ用
CREATE INDEX IF NOT EXISTS ix_answers_user_question ON answers(user_id, question_id);

-- answers: 履歴クエリ用
CREATE INDEX IF NOT EXISTS ix_answers_user_answered_at ON answers(user_id, answered_at);

-- questions: 順序取得用
CREATE INDEX IF NOT EXISTS ix_questions_set_order ON questions(question_set_id, "order");

-- reviews: ユーザー検索用
CREATE INDEX IF NOT EXISTS ix_reviews_user_id ON reviews(user_id);
