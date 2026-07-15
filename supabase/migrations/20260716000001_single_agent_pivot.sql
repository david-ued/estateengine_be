-- =====================================================================
-- 單一 Agent 轉向（2026-07-16，見 PIVOT.md）
-- 1. 移除 super_admin：enum 重建、is_super_admin() 移除、RLS 全面重寫
-- 2. 新表：favorites / saved_searches / contact_messages / site_settings
-- 前置：既有 super_admin 帳號先降為 buyer
-- =====================================================================

-- ---------- 0. 既有 super_admin 降為 buyer ----------
update public.profiles set role = 'buyer' where role = 'super_admin';

-- ---------- 1. 卸除引用角色函式的 RLS policies ----------
drop policy if exists "agent profiles are public" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "published properties are public" on public.properties;
drop policy if exists "agents insert own properties" on public.properties;
drop policy if exists "agents update own properties" on public.properties;
drop policy if exists "agents delete own properties" on public.properties;
drop policy if exists "media follows property visibility" on public.media;
drop policy if exists "agents manage own property media" on public.media;
drop policy if exists "active persona templates are public" on public.persona_templates;
drop policy if exists "agents manage own share links" on public.share_links;
drop policy if exists "agents manage own share link items" on public.share_link_properties;
drop policy if exists "agents read own property view events" on public.property_view_events;
drop policy if exists "agents upload own property media" on storage.objects;
drop policy if exists "agents manage own property media objects" on storage.objects;
drop policy if exists "agents delete own property media objects" on storage.objects;

-- ---------- 2. 移除角色函式、重建 user_role enum（buyer / agent） ----------
drop function if exists public.is_super_admin();
drop function if exists public.has_role(public.user_role);
drop function if exists public.current_user_role();

alter type public.user_role rename to user_role_old;
create type public.user_role as enum ('buyer', 'agent');

alter table public.profiles alter column role drop default;
alter table public.profiles
  alter column role type public.user_role using role::text::public.user_role;
alter table public.profiles alter column role set default 'buyer';

drop type public.user_role_old;

-- ---------- 3. 重建角色函式（無 super_admin） ----------
create or replace function public.has_role(required public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = required
  );
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- 4. 重建 RLS policies（agent 即最高權限） ----------
create policy "agent profiles are public"
  on public.profiles for select
  using (role = 'agent' or id = auth.uid());

create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());
  -- role 欄位不可自行變更，僅能由 service_role（NestJS）調整

create policy "published properties are public"
  on public.properties for select
  using (status = 'published' or agent_id = auth.uid());

create policy "agents insert own properties"
  on public.properties for insert
  with check (agent_id = auth.uid() and public.has_role('agent'));

create policy "agents update own properties"
  on public.properties for update
  using (agent_id = auth.uid());

create policy "agents delete own properties"
  on public.properties for delete
  using (agent_id = auth.uid());

create policy "media follows property visibility"
  on public.media for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = media.property_id
        and (p.status = 'published' or p.agent_id = auth.uid())
    )
  );

create policy "agents manage own property media"
  on public.media for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = media.property_id and p.agent_id = auth.uid()
    )
  );

create policy "active persona templates are public"
  on public.persona_templates for select
  using (is_active);

create policy "agents manage own share links"
  on public.share_links for all
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

create policy "agents manage own share link items"
  on public.share_link_properties for all
  using (
    exists (
      select 1 from public.share_links sl
      where sl.id = share_link_properties.share_link_id
        and sl.agent_id = auth.uid()
    )
  );

create policy "agents read own property view events"
  on public.property_view_events for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_view_events.property_id
        and p.agent_id = auth.uid()
    )
  );

create policy "agents upload own property media"
  on storage.objects for insert
  with check (
    bucket_id = 'property-media'
    and public.has_role('agent')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "agents manage own property media objects"
  on storage.objects for update
  using (
    bucket_id = 'property-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "agents delete own property media objects"
  on storage.objects for delete
  using (
    bucket_id = 'property-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- 5. 買家收藏 ----------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index favorites_property_idx on public.favorites (property_id);

alter table public.favorites enable row level security;

create policy "buyers manage own favorites"
  on public.favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- 6. 儲存搜尋條件（Save Search） ----------
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  params jsonb not null default '{}'::jsonb,  -- 對應列表 query string（city / 價格區間 / beds ...）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_searches_user_idx on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;

create policy "buyers manage own saved searches"
  on public.saved_searches for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger saved_searches_set_updated_at
  before update on public.saved_searches
  for each row execute function public.set_updated_at();

-- ---------- 7. 聯絡表單收件（寫入走 NestJS service_role + throttler） ----------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  property_id uuid references public.properties (id) on delete set null,  -- 由物件內頁發起時帶入
  locale text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index contact_messages_inbox_idx on public.contact_messages (is_read, created_at desc);

alter table public.contact_messages enable row level security;

create policy "agent reads contact messages"
  on public.contact_messages for select
  using (public.has_role('agent'));

create policy "agent updates contact messages"
  on public.contact_messages for update
  using (public.has_role('agent'));

-- ---------- 8. 網站品牌內容（單列；首頁 hero / 統計 / 核心價值） ----------
create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "site settings are public"
  on public.site_settings for select
  using (true);

create policy "agent updates site settings"
  on public.site_settings for update
  using (public.has_role('agent'));

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- ---------- 9. SECURITY DEFINER 函式權限硬化（Supabase advisor：
--             anon 不得經 /rest/v1/rpc/* 呼叫 SECURITY DEFINER 函式） ----------

-- 角色 helpers：僅供 RLS 於 authenticated 情境評估；
-- 函式重建後預設 grant 給 PUBLIC，這裡收斂（anon 對這些 policy 本來就必然 false）
revoke execute on function public.has_role(public.user_role) from public, anon;
grant execute on function public.has_role(public.user_role) to authenticated, service_role;

revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;

-- Analytics RPC：前端一律經 NestJS（service_role client）呼叫，
-- 瀏覽器端（anon / authenticated）無須直接執行
revoke execute on function public.increment_view_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_view_count(uuid) to service_role;

revoke execute on function public.record_view_duration(uuid, numeric) from public, anon, authenticated;
grant execute on function public.record_view_duration(uuid, numeric) to service_role;

revoke execute on function public.increment_media_click(uuid) from public, anon, authenticated;
grant execute on function public.increment_media_click(uuid) to service_role;

revoke execute on function public.increment_share_link_click(text) from public, anon, authenticated;
grant execute on function public.increment_share_link_click(text) to service_role;

-- AI 扣點（20260710000005 建立；該檔可能晚於本檔才套用，故加存在性防護）
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'spend_tokens'
  ) then
    revoke execute on function public.spend_tokens(uuid, int, text) from public, anon, authenticated;
    grant execute on function public.spend_tokens(uuid, int, text) to service_role;
  end if;
end;
$$;
