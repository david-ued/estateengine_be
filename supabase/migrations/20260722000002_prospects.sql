-- Prospect CRM：買家財務準備度（pre-approval）+ 物件表態（lock-in / walk away / act fast）
-- 兩張表僅供 NestJS（service_role）存取：agent_note 需對買家保密，RLS 為 row-level
-- 藏不住單一欄位，故啟用 RLS 但不建任何 client policy（anon/authenticated 一律拒絕）。

-- 買家財務準備度：買家於帳號中心自行申報，agent 也可在 CRM 代為更新
create table public.prospect_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pre_approval_status text not null default 'none'
    check (pre_approval_status in ('none', 'in_progress', 'approved')),
  pre_approval_amount numeric check (pre_approval_amount >= 0),
  proof_of_funds boolean not null default false,
  buyer_note text,
  agent_note text, -- 僅 agent 可讀寫（BE 端點過濾）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prospect_profiles is
  'Prospect CRM：買家購屋財務準備度（房貸預批 / 資產證明）。BE service_role 專用，無 client RLS policy。';

alter table public.prospect_profiles enable row level security;

create trigger prospect_profiles_set_updated_at
  before update on public.prospect_profiles
  for each row execute function public.set_updated_at();

-- 物件表態：買家對單一物件 lock-in / walk away；agent 可標記 Act Fast（先與賣家洽談）
create table public.property_interests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  decision text not null default 'considering'
    check (decision in ('considering', 'locked_in', 'walked_away')),
  act_fast boolean not null default false, -- agent：已優先與賣家洽談
  agent_note text, -- 僅 agent 可讀寫（BE 端點過濾）
  decided_at timestamptz, -- 買家最後一次表態（非 considering）的時間
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, property_id)
);

comment on table public.property_interests is
  'Prospect CRM：買家對物件的表態（lock-in / walk away）與 agent 的 Act Fast 註記。BE service_role 專用，無 client RLS policy。';

create index property_interests_buyer_idx
  on public.property_interests (buyer_id, updated_at desc);
create index property_interests_property_idx
  on public.property_interests (property_id);

alter table public.property_interests enable row level security;

create trigger property_interests_set_updated_at
  before update on public.property_interests
  for each row execute function public.set_updated_at();
