# EstateEngine 後端 / DB TODO / Roadmap

> SaaS 房仲客製化看房平台。目標市場：加拿大 Edmonton / Vancouver / Toronto（CAD、sqft）。
> 前端 roadmap 見 `estateengine_fe/TODO.md`。

## ✅ 已完成

### Phase 0 — Infra
- [x] NestJS 11 scaffold、CORS（`CORS_ORIGINS` 環境變數）、全域 ValidationPipe
- [x] Supabase 全域模組（service_role client）
- [x] JWT 驗證守衛 `SupabaseAuthGuard` + 三角色 `RolesGuard`（buyer / agent / super_admin，super_admin 一律放行）
- [x] DB migrations：profiles / properties / media / persona_templates / buyer_weight_profiles / share_links + RLS + triggers
- [x] Storage bucket `property-media`（100MB、MIME 白名單、路徑限 `{agent_id}/`）+ `avatars`
- [x] 5 組 Persona 範本種子資料（四語系）

### Phase 1 — 核心功能（部分）
- [x] Properties CRUD 骨架：公開列表（filter + 每頁最多 7 筆）、內頁、房仲建檔/編輯/上架、Admin 強制下架
- [x] 房仲「我的物件」與 Admin「全物件」端點
- [x] 90 天自動下架 Cron（每日 03:00）
- [x] 獨家數據欄位（淹水區 / 地勢 / 建商評價）+ sqft / CAD 對齊原始 PRD
- [x] `share-links` module：一鍵生成推薦清單 slug（多物件 + 排序）、自訂 OG、公開解析 + click_count
- [x] `media` controller：外部嵌入登記（YouTube/Vimeo/Matterport 白名單）、上傳登記、影片點擊計數
- [x] 簡易數據追蹤：總瀏覽量 RPC + 停留時間事件 RPC（`record_view_duration`）+ 媒體點擊 RPC
- [x] Media 檔案驗證（影像 10MB / 影片 100MB）+ signed upload URL

## 🔜 Phase 1 剩餘（Must Have）

### 模組
- [x] `users` module：Admin 使用者列表 + 升級/降級角色（buyer ↔ agent，super_admin 保護）
- [x] 物件狀態切換端點 POST `/properties/:id/status`（上架寫 listed_at、下架寫 delist_reason）
- [x] `media` sign-upload 路由（含所有權檢查與檔名消毒）
- [x] 數據面板彙總端點：GET `/properties/mine/stats`（總瀏覽量 / avg(duration) / 影片點擊，PRD 三指標）
- [ ] `users`：停權（profiles 加 is_suspended + guard 攔截）
- [ ] `media`：刪除端點（同步刪 Storage 物件）、排序調整
- [x] `persona-templates` 公開讀取端點 GET `/personas`
- [x] 物件「新鮮度」查詢參數 `freshWithinDays`（1-90 天，過濾 listed_at）
- [x] 進階篩選參數（propertyType / minSchool / minBuilder / minMaterial / orientation / superstore）+ sort（newest / price）+ 90 天強制隱藏
- [x] `ai` module：Gemini 解析建檔 POST `/ai/parse-listing` + 餘額 GET `/ai/tokens`（扣 5 點/次、失敗自動退點、body limit 8MB 支援截圖）
- [ ] ⚠️ migration `20260710000005_ai_tokens.sql` 尚未套用（MCP 唯讀模式擋 DDL）——SQL Editor 執行或開啟 MCP 寫入後套用
- [ ] `GEMINI_API_KEY` 待填入 `.env`（AI 建檔功能才會啟用）
- [ ] Token 儲值流程（目前僅扣點；購買/儲值 Phase 2 金流）
- [ ] 列表支援符合度全域排序（帶權重參數計算加權分數排序，取代前端當頁排序）

### 品質 / 安全
- [x] Rate limiting（`@nestjs/throttler` 全域 120 req/min/IP）
- [x] helmet + Supabase error → `InternalServerErrorException` 對映
- [x] RolesGuard 角色查詢快取（30 秒 TTL，角色變更即時失效）
- [ ] 全域 exception filter（統一錯誤格式、request id、隱藏內部訊息於 production）
- [ ] unit / e2e 測試（guards、properties service、cron）
- [ ] OpenAPI（`@nestjs/swagger`）

### DB / Infra
- [x] 將 migrations 套用到 Supabase 專案（可透過 Supabase MCP 執行）並跑 advisors 檢查（2026-07-10；新增 `20260710000004_security_hardening.sql` 修 advisors 警告，測試帳號與假資料見 `SUPABASE_SETUP.md` §4.5）
- [ ] `supabase gen types typescript` 產出型別，前後端共用
- [ ] properties 全文搜尋索引（title / description，pg_trgm 或 FTS）
- [ ] share_links click_count / properties view_count 改 RPC 原子累加

## 🧭 SaaS 化（架構預留，勿在 Phase 1 實作）
- [ ] `agencies` 表（多租戶）：房仲隸屬公司、quota、品牌設定；properties 增加 agency_id
- [ ] `plans` / `subscriptions` 表（Phase 2 接金流）：上架物件數 quota per plan
- [ ] `audit_logs` 表：Admin 強制下架、角色變更留痕
- [ ] Webhook / 通知（90 天到期前通知房仲續期）
- [ ] 環境分離（dev / staging / prod Supabase branch）

## 📦 Phase 2（Nice to Have，非本期範圍）
- 臨近成交行情資料源
- 進階 Analytics 事件表（property_view_events）
- Stripe 金流 / 發票
