-- 販売者申請フロー: usersテーブルにカラム追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_application_status VARCHAR DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_application_submitted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_application_admin_note TEXT;

-- 問題集審査フロー: question_setsテーブルにカラム追加
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'not_required';

-- 既存の is_seller=true ユーザーは申請済みとしてマーク
UPDATE users SET seller_application_status = 'approved' WHERE is_seller = TRUE;
