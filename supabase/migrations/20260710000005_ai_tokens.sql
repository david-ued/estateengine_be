-- =====================================================================
-- AI 快速建檔：平台 Token 點數 + 交易紀錄
-- =====================================================================

alter table public.profiles
  add column if not exists token_balance integer not null default 0;

create table public.token_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,   -- 負值 = 扣點，正值 = 儲值/退點
  reason text not null,      -- ai_parse / refund / topup ...
  created_at timestamptz not null default now()
);

create index token_transactions_user_idx
  on public.token_transactions (user_id, created_at desc);

alter table public.token_transactions enable row level security;

create policy "users read own token transactions"
  on public.token_transactions for select
  using (user_id = auth.uid());

-- 原子扣點：餘額不足回傳 -1（amount 為負值時等同加點/退款）
create or replace function public.spend_tokens(uid uuid, amount int, reason text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
begin
  update public.profiles
  set token_balance = token_balance - amount
  where id = uid and token_balance >= amount
  returning token_balance into new_balance;

  if new_balance is null then
    return -1;
  end if;

  insert into public.token_transactions (user_id, amount, reason)
  values (uid, -amount, reason);

  return new_balance;
end;
$$;

-- 開發期：現有房仲贈送 100 點
update public.profiles set token_balance = 100 where role = 'agent';
