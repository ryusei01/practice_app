-- question_sets: コンテンツ言語（ja / en）
BEGIN;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS content_language VARCHAR DEFAULT 'ja' NOT NULL;
COMMIT;
