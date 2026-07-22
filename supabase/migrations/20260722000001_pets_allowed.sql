-- =====================================================================
-- 可養寵物（pets allowed）
-- 房仲建檔可勾選「可養寵物」；前台搜尋新增三態篩選：
-- 不限 / 可養寵物 / 不可養寵物。
-- =====================================================================

alter table public.properties
  add column if not exists pets_allowed boolean not null default false;

comment on column public.properties.pets_allowed is
  '可養寵物。前台篩選 petsAllowed=true/false 對應「可養寵物 / 不可養寵物」。';
