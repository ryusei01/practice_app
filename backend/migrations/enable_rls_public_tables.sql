-- Supabase: public テーブルの Row Level Security を有効化する
-- 目的: PostgREST（Auto API）+ anon キー経由の不正アクセスを防ぐ
-- 前提: アプリは FastAPI が postgres 接続で ORM 利用（所有者接続は RLS をバイパス）
-- ポリシー未作成 = anon / authenticated ロールは API 経由で行を参照・更新できない
--
-- 適用: Supabase Dashboard → SQL Editor で実行、または psql で本番 DB に適用
-- テーブルが未作成の環境でもエラーにしない（存在するものだけ RLS を有効化）

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'users',
    'question_sets',
    'questions',
    'answers',
    'user_question_stats',
    'user_category_stats',
    'purchases',
    'reviews',
    'processed_checkout_sessions',
    'content_reports',
    'copyright_check_records',
    'otp_codes',
    'alembic_version'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;
