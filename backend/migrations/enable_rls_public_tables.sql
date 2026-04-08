-- Supabase: public テーブルの Row Level Security を有効化する
-- 目的: PostgREST（Auto API）+ anon キー経由の不正アクセスを防ぐ
-- 前提: アプリは FastAPI が postgres 接続で ORM 利用（所有者接続は RLS をバイパス）
-- ポリシー未作成 = anon / authenticated ロールは API 経由で行を参照・更新できない
--
-- 適用: Supabase Dashboard → SQL Editor で実行、または psql で本番 DB に適用

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_question_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_category_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copyright_check_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Alembic 利用時のみ（テーブルが無い環境では何もしない）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'alembic_version'
  ) THEN
    EXECUTE 'ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
