-- マイグレーション: usersテーブルに seller_terms_accepted_at カラムを追加
-- 実行日: 2026-04-02
-- 説明: 販売者が販売者利用規約に同意した日時を記録するカラム

ALTER TABLE users
ADD COLUMN IF NOT EXISTS seller_terms_accepted_at TIMESTAMP NULL;

-- 確認用クエリ
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'seller_terms_accepted_at';
