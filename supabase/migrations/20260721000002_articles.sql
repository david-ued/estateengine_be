-- =====================================================================
-- 專欄文章（Blog，PIVOT.md 原列「本期不做」，2026-07-21 補上）
-- 1. articles 表：agent 撰寫、公開閱讀；首頁精選（is_featured）
-- 2. article-media bucket：封面 / 內文圖（agent 直傳，路徑同 property-media 慣例）
-- =====================================================================

-- ---------- 1. articles ----------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  title text not null,
  excerpt text,
  content_html text not null default '',  -- NestJS 寫入前以 sanitize-html 消毒
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_featured boolean not null default false,  -- 首頁「專欄精選」區塊
  published_at timestamptz,                    -- 首次發佈時間（重新發佈不覆寫）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_public_idx on public.articles (status, published_at desc);
create index articles_author_idx on public.articles (author_id, created_at desc);

alter table public.articles enable row level security;

create policy "published articles are public"
  on public.articles for select
  using (status = 'published' or author_id = auth.uid());

create policy "agents insert own articles"
  on public.articles for insert
  with check (author_id = auth.uid() and public.has_role('agent'));

create policy "agents update own articles"
  on public.articles for update
  using (author_id = auth.uid());

create policy "agents delete own articles"
  on public.articles for delete
  using (author_id = auth.uid());

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- ---------- 2. article-media bucket（封面 / 內文圖，公開讀取） ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-media',
  'article-media',
  true,
  10485760,           -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 上傳路徑慣例：{agent_id}/{filename}（同 property-media：僅能寫自己 uid 資料夾）
create policy "agents upload own article media"
  on storage.objects for insert
  with check (
    bucket_id = 'article-media'
    and public.has_role('agent')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "agents manage own article media objects"
  on storage.objects for update
  using (
    bucket_id = 'article-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "agents delete own article media objects"
  on storage.objects for delete
  using (
    bucket_id = 'article-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
