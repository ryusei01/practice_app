-- 教科書インラインコンテンツカラムの追加
-- textbook_type = 'inline' の場合にコンテンツを直接DBに保存する
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS textbook_content TEXT;
