-- 問題集: 複数コンテンツ言語（JSON 配列）。既存 content_language からバックフィル。
-- content_language 列が無い DB（列整理済み等）ではスキップ（アプリ起動時マイグレーションでも同様）。
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS content_languages JSONB DEFAULT '["ja"]'::jsonb;

DO $fill_cl$
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
END $fill_cl$;

UPDATE question_sets
SET content_languages = '["ja"]'::jsonb
WHERE content_languages IS NULL;

ALTER TABLE question_sets ALTER COLUMN content_languages SET DEFAULT '["ja"]'::jsonb;
ALTER TABLE question_sets ALTER COLUMN content_languages SET NOT NULL;
