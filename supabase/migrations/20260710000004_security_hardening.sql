-- =====================================================================
-- Supabase security advisors 修正（2026-07-10）
-- 1. set_updated_at：鎖定 search_path（function_search_path_mutable）
-- 2. handle_new_user：僅供 auth trigger 使用，撤銷 API 角色的 EXECUTE
--    （anon_security_definer_function_executable）
--
-- 保留不修（有意為之）：
-- - has_role / is_super_admin / current_user_role 被 RLS policy 引用，
--   呼叫端角色需要 EXECUTE；僅回傳呼叫者自身角色布林值，無資料外洩。
-- - increment_view_count / record_view_duration / increment_media_click /
--   increment_share_link_click 為公開 analytics RPC，匿名買家需可呼叫。
-- =====================================================================

alter function public.set_updated_at() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
