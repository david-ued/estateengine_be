-- =====================================================================
-- MLS 認證房仲正式使用：合規前置（2026-07-21 缺口分析，見 TODO.md）
-- 1) properties.mls_number：MLS® 刊登編號，之後 DDF 串接的同步對照鍵
-- 2) contact_messages.casl_consent_at：CASL 商業電子訊息同意時間戳
-- =====================================================================

alter table public.properties
  add column if not exists mls_number text;

comment on column public.properties.mls_number is
  'MLS® 刊登編號（手動建檔可空；DDF 匯入後作為同步對照鍵）';

alter table public.contact_messages
  add column if not exists casl_consent_at timestamptz;

comment on column public.contact_messages.casl_consent_at is
  'CASL 同意接收商業電子訊息的時間戳（表單勾選當下記錄）；null＝未同意，不得寄行銷 email';
