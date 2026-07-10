-- =====================================================================
-- EstateEngine MVP — 初始 Schema
-- Tables: profiles / properties / media / persona_templates /
--         buyer_weight_profiles / share_links
-- =====================================================================

-- ---------- Enums ----------
create type public.user_role as enum ('buyer', 'agent', 'super_admin');

create type public.property_status as enum (
  'draft',      -- 建檔中，未公開
  'published',  -- 上架中
  'hidden',     -- 房仲暫時隱藏
  'delisted',   -- 已下架（90 天到期 / 房仲下架 / 管理員強制）
  'sold'        -- 已成交
);

create type public.media_type as enum (
  'image',
  'reel_video',            -- Reels 格式短影音（自行上傳）
  'external_video',        -- 外部嵌入影片（YouTube / Vimeo），節省伺服器成本
  'tour_3d',               -- 3D 導覽嵌入（Matterport）
  'virtual_staging_image', -- 已合成好的虛擬家具示意圖
  'floor_plan'
);

create type public.orientation as enum ('N','NE','E','SE','S','SW','W','NW');

create type public.basement_status as enum ('none','storage','livable','parking');

-- ---------- Users（profiles，掛在 Supabase Auth 之上） ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'buyer',
  email text,          -- 由 handle_new_user trigger 從 auth.users 同步，供後台列表顯示
  full_name text,
  display_name text,
  avatar_url text,
  phone text,
  -- 房仲（agent）個人化展示欄位（Marketing）
  agency_name text,
  license_no text,
  bio text,
  contact_line_id text,
  social_links jsonb not null default '{}'::jsonb,
  preferred_locale text not null default 'zh-TW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Properties（物件，含風水/建材等非標準欄位） ----------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete restrict,
  status public.property_status not null default 'draft',
  slug text unique,
  title text not null,
  description text,

  -- 標準欄位（搜尋 Filter：地區 / 價格 / 面積 / 房衛）
  -- 目標市場：加拿大（Edmonton / Vancouver / Toronto），面積以 sqft 為準
  price numeric(14, 0) not null check (price >= 0),
  currency char(3) not null default 'CAD',
  city text not null,          -- Edmonton / Vancouver / Toronto（MVP 三城市）
  district text,               -- neighbourhood
  address text,
  lat double precision,
  lng double precision,
  area_sqft numeric(10, 2) not null check (area_sqft >= 0),
  beds smallint not null default 0,
  baths smallint not null default 0,
  floor smallint,
  total_floors smallint,
  building_age_years numeric(5, 1),
  property_type text,          -- apartment / house / condo / townhouse ...
  has_parking boolean not null default false,

  -- 獨家數據建檔（手動標籤，節省 API 成本並建立專業度）
  -- 巨觀：交通、學區、淹水區、地勢；微觀：風水座向、建商評價、建材等級、地下室
  school_district text,
  transit_notes text,
  flood_zone boolean not null default false,
  terrain_notes text,
  feng_shui_orientation public.orientation,
  feng_shui_notes text,
  builder_name text,
  builder_reputation smallint check (builder_reputation between 1 and 5),
  material_grade smallint check (material_grade between 1 and 5),
  material_notes text,
  basement_status public.basement_status not null default 'none',
  custom_attributes jsonb not null default '{}'::jsonb,  -- 其他客製化標籤，保留 Phase 2 擴充彈性

  -- 客製化權重評分系統：房仲為各維度打 0-100 分，前端做加權計算
  score_school smallint check (score_school between 0 and 100),
  score_transit smallint check (score_transit between 0 and 100),
  score_material smallint check (score_material between 0 and 100),
  score_feng_shui smallint check (score_feng_shui between 0 and 100),
  score_environment smallint check (score_environment between 0 and 100),

  -- Listing Lifecycle（Days on Market 以 listed_at 起算；90 天由 NestJS Cron 下架）
  listed_at timestamptz,
  delisted_at timestamptz,
  delist_reason text,  -- expired_90d / agent_action / admin_force

  -- 簡易 Analytics：MVP 僅記錄總瀏覽量（漏斗分析為 Phase 2）
  view_count bigint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_status_listed_at_idx on public.properties (status, listed_at desc);
create index properties_city_district_idx on public.properties (city, district);
create index properties_price_idx on public.properties (price);
create index properties_area_sqft_idx on public.properties (area_sqft);
create index properties_agent_idx on public.properties (agent_id);

-- ---------- Media（照片放 Storage；影片/3D 導覽以外部連結嵌入省成本） ----------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  type public.media_type not null default 'image',
  storage_path text,            -- `property-media` bucket 內的物件路徑（上傳型媒體）
  external_url text,            -- YouTube / Vimeo / Matterport 嵌入連結（外部媒體）
  thumbnail_path text,
  mime_type text,
  file_size_bytes bigint,
  duration_seconds numeric(6, 1),  -- 短影音長度
  sort_order int not null default 0,
  is_cover boolean not null default false,
  click_count bigint not null default 0,  -- 簡易數據追蹤：外部影片點擊次數
  created_at timestamptz not null default now(),
  constraint media_has_source check (storage_path is not null or external_url is not null)
);

create index media_property_idx on public.media (property_id, sort_order);

-- ---------- Persona 範本（3-5 組預設權重，買家一鍵套用） ----------
create table public.persona_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name jsonb not null,         -- i18n：{"en": "...", "fr": "...", "zh-TW": "...", "zh-CN": "..."}
  description jsonb,
  weights jsonb not null,      -- 例如 {"school": 50, "transit": 30, "material": 20}
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 買家自訂權重 ----------
create table public.buyer_weight_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'My weights',
  weights jsonb not null,
  source_template_id uuid references public.persona_templates (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buyer_weight_profiles_user_idx on public.buyer_weight_profiles (user_id);

-- ---------- 專屬推薦清單分享（一鍵生成 + 房仲自訂 OG 標籤） ----------
-- PRD：房仲一鍵產出「專屬推薦清單」網頁連結（可含多個物件），
-- 並自訂社群分享的 OG Title / Description / Preview Image
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  title text,           -- 清單名稱（例如「王小姐 8/1 帶看清單」）
  og_title text,
  og_description text,
  og_image_path text,   -- Storage 內的自訂預覽圖
  click_count bigint not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index share_links_agent_idx on public.share_links (agent_id);

-- 清單內容（多物件、可排序）
create table public.share_link_properties (
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  sort_order int not null default 0,
  primary key (share_link_id, property_id)
);

-- ---------- 簡易數據追蹤（PRD 三指標：總瀏覽量 / 平均停留時間 / 影片點擊） ----------
-- 總瀏覽量存 properties.view_count；停留時間以輕量事件記錄，面板端做平均
create table public.property_view_events (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  duration_seconds numeric(8, 1),  -- 離開頁面時回報；null 表示只有 pageview
  created_at timestamptz not null default now()
);

create index property_view_events_property_idx
  on public.property_view_events (property_id, created_at);

-- =====================================================================
-- Triggers & Functions
-- =====================================================================

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create trigger buyer_weight_profiles_set_updated_at
  before update on public.buyer_weight_profiles
  for each row execute function public.set_updated_at();

-- 註冊時自動建立 profile（預設 buyer；升級 agent / super_admin 由後台以 service key 執行）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 角色判斷 helpers（給 RLS 用）
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

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('super_admin');
$$;

-- 取得目前使用者角色（security definer 避免 profiles policy 遞迴）
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 簡易 Analytics：總瀏覽量 +1（匿名買家也可呼叫）
create or replace function public.increment_view_count(property uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.properties
  set view_count = view_count + 1
  where id = property and status = 'published';
$$;

-- 停留時間回報（買家離開內頁時）
create or replace function public.record_view_duration(property uuid, seconds numeric)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.property_view_events (property_id, duration_seconds)
  select property, seconds
  where exists (
    select 1 from public.properties where id = property and status = 'published'
  );
$$;

-- 外部影片/3D 導覽點擊 +1
create or replace function public.increment_media_click(media_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.media set click_count = click_count + 1 where id = media_id;
$$;

-- 推薦清單被開啟 +1
create or replace function public.increment_share_link_click(link_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.share_links set click_count = click_count + 1 where slug = link_slug;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.media enable row level security;
alter table public.persona_templates enable row level security;
alter table public.buyer_weight_profiles enable row level security;
alter table public.share_links enable row level security;
alter table public.share_link_properties enable row level security;
alter table public.property_view_events enable row level security;

-- profiles：房仲名片公開；本人可讀寫自己；管理員全讀
create policy "agent profiles are public"
  on public.profiles for select
  using (role = 'agent' or id = auth.uid() or public.is_super_admin());

create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());
  -- role 欄位不可自行變更，僅能由 service_role（NestJS 後台）調整

-- properties：已上架物件人人可讀；房仲管理自己的物件；管理員全權
create policy "published properties are public"
  on public.properties for select
  using (status = 'published' or agent_id = auth.uid() or public.is_super_admin());

create policy "agents insert own properties"
  on public.properties for insert
  with check (agent_id = auth.uid() and public.has_role('agent'));

create policy "agents update own properties"
  on public.properties for update
  using (agent_id = auth.uid() or public.is_super_admin());

create policy "agents delete own properties"
  on public.properties for delete
  using (agent_id = auth.uid() or public.is_super_admin());

-- media：跟隨所屬物件的可見性
create policy "media follows property visibility"
  on public.media for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = media.property_id
        and (p.status = 'published' or p.agent_id = auth.uid() or public.is_super_admin())
    )
  );

create policy "agents manage own property media"
  on public.media for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = media.property_id
        and (p.agent_id = auth.uid() or public.is_super_admin())
    )
  );

-- persona_templates：啟用中的範本公開讀取；寫入僅限管理員（service_role）
create policy "active persona templates are public"
  on public.persona_templates for select
  using (is_active or public.is_super_admin());

-- buyer_weight_profiles：僅本人
create policy "buyers manage own weight profiles"
  on public.buyer_weight_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- share_links：公開讀取（供 OG 解析與推薦清單頁）；房仲管理自己的連結
create policy "share links are public"
  on public.share_links for select
  using (true);

create policy "agents manage own share links"
  on public.share_links for all
  using (agent_id = auth.uid() or public.is_super_admin())
  with check (agent_id = auth.uid() or public.is_super_admin());

create policy "share link items are public"
  on public.share_link_properties for select
  using (true);

create policy "agents manage own share link items"
  on public.share_link_properties for all
  using (
    exists (
      select 1 from public.share_links sl
      where sl.id = share_link_properties.share_link_id
        and (sl.agent_id = auth.uid() or public.is_super_admin())
    )
  );

-- property_view_events：寫入僅透過 security definer RPC；
-- 房仲可讀自己物件的事件（數據面板算平均停留時間）
create policy "agents read own property view events"
  on public.property_view_events for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_view_events.property_id
        and (p.agent_id = auth.uid() or public.is_super_admin())
    )
  );
