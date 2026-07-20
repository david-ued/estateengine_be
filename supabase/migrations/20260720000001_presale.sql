-- =====================================================================
-- 預售屋（pre-construction）支援
-- 房仲建檔可勾選「預售屋」；前台內頁 CTA 由「詢問此物件」改為
-- 「提醒我」（未來串 email service 主動通知進度）。
-- =====================================================================

alter table public.properties
  add column if not exists is_presale boolean not null default false;

comment on column public.properties.is_presale is
  '預售屋（尚未完工交屋）。true 時前台顯示「提醒我」CTA 取代預約賞屋。';
