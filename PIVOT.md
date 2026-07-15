# PIVOT — 轉向「單一 Agent」品牌網站（2026-07-16）

> 決策全文與 sitemap 對照見 `estateengine_fe/PIVOT.md`。本文件只記後端/DB 的對應變更。

## 摘要

- 網站收斂為**單一 agent** 的品牌網站；Super Admin 全面移除，agent 即最高權限。
- 買家帳號保留：新增收藏（favorites）與儲存搜尋（saved_searches）。
- 新增公開聯絡表單（contact_messages，agent 後台收件）與首頁品牌內容（site_settings）。
- 語系縮為 zh-TW（預設）+ en。

## DB（migration `20260716000001_single_agent_pivot.sql`）

- `user_role` enum 重建為 `('buyer','agent')`；既有 `super_admin` 列先降為 `buyer`。
- 移除 `is_super_admin()`；所有引用它的 RLS policy 重寫。
- 新表：`favorites`、`saved_searches`、`contact_messages`、`site_settings`（單列 jsonb）+ RLS。
- 聯絡表單寫入不做 RPC：走 NestJS（service_role）+ 全域 throttler。
- **SECURITY DEFINER 函式權限硬化**（2026-07-16 advisor 指出 `current_user_role()` 可被 anon 經 REST RPC 呼叫）：`has_role`/`current_user_role` 收斂為 authenticated + service_role（RLS 評估用）；analytics RPC（view/duration/media click/share click）與 `spend_tokens` 一律只留 service_role（前端全走 NestJS，已確認無瀏覽器端 `.rpc()` 呼叫）。

## NestJS

- 移除：`users` module（admin 使用者管理）、properties 的 admin 強制下架端點、RolesGuard 的 super_admin 放行邏輯、`UserRole.SUPER_ADMin` enum 值。
- 新增：`favorites`、`saved-searches`、`contact`（公開 POST + agent 收件匣）、`site-settings`（公開 GET + agent PUT）modules。

## 執行日誌

- [x] 2026-07-16 migration 撰寫：`supabase/migrations/20260716000001_single_agent_pivot.sql`
- [x] 2026-07-16 modules 增刪完成（tsc 通過；`no-unsafe-*` lint 為既有債務模式）
- [x] 2026-07-16 資料歸戶腳本：`scripts/pivot-single-agent.mjs`（物件/分享清單歸戶、降級其他 agent、品牌名片、site_settings 種子）
- [ ] ⚠️ **需手動**：套用 migration（本 session 無 Supabase MCP token、無 CLI）——SQL Editor 貼上執行，或授權 MCP 後再跑；順帶確認 `20260710000005_ai_tokens.sql` 是否已套用（先前 MCP 唯讀被擋）
- [ ] ⚠️ **需手動**：`node scripts/pivot-single-agent.mjs`（本 session 權限限制未執行；會改動遠端資料，請確認後執行）
- [ ] SUPABASE_SETUP.md 更新
