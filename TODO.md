# EstateEngine 後端 / DB TODO / Roadmap

> **單一 Agent 品牌看房網站**（2026-07-16 轉向，決策見 `PIVOT.md` 與 `estateengine_fe/PIVOT.md`）。
> 目標市場：加拿大（CAD、sqft），華人買家優先（zh-TW 預設）。
> 前端 roadmap 見 `estateengine_fe/TODO.md`。

## ✅ 已完成

### Phase 0 — Infra（多 agent SaaS 時期）
- [x] NestJS 11 scaffold、CORS（`CORS_ORIGINS` 環境變數）、全域 ValidationPipe
- [x] Supabase 全域模組（service_role client）
- [x] JWT 驗證守衛 `SupabaseAuthGuard` + `RolesGuard`
- [x] DB migrations：profiles / properties / media / persona_templates / buyer_weight_profiles / share_links + RLS + triggers
- [x] Storage bucket `property-media` + `avatars`
- [x] Persona 範本種子資料

### Phase 1 — 核心功能（多 agent SaaS 時期）
- [x] Properties CRUD、公開列表 filter/sort、90 天 Cron 自動下架與強制隱藏
- [x] 獨家數據欄位（學區/風水/建商/建材/淹水區…）
- [x] `share-links`（推薦清單 + 自訂 OG + click_count）
- [x] `media`（外部嵌入白名單、signed upload、點擊計數、檔案驗證）
- [x] 數據追蹤三指標（瀏覽量 / 停留時間 / 影片點擊）+ `/properties/mine/stats`
- [x] `ai` module（Gemini 解析建檔 + token 扣點/退點）
- [x] Rate limiting、helmet、RolesGuard 角色快取

### 2026-07-16 — 單一 Agent 轉向（PIVOT.md）
- [x] 移除 super_admin：enum / RolesGuard 放行邏輯 / users module / admin 端點（`admin/all`、`force-delist`）全刪
- [x] migration `20260716000001_single_agent_pivot.sql`：enum 重建、RLS 重寫、新表 favorites / saved_searches / contact_messages / site_settings
- [x] 新 module：`favorites`（收藏 + ids hydrate）、`saved-searches`（Save Search，上限 20）、`contact`（公開表單限流 5/min + agent 收件匣）、`site`（公開品牌資料 + agent 名片/首頁內容編輯）
- [x] 資料歸戶腳本 `scripts/pivot-single-agent.mjs`

## 🔜 立即待辦

- [ ] ⚠️ **套用 migrations**（SQL Editor 或授權 Supabase MCP）：`20260710000005_ai_tokens.sql`、`20260716000001_single_agent_pivot.sql`
- [ ] ⚠️ **跑資料歸戶**：`node scripts/pivot-single-agent.mjs`（會改遠端資料，先確認）
- [ ] 套用後跑 Supabase advisors（security + performance）
- [ ] `media`：刪除端點（同步刪 Storage 物件）、排序調整
- [ ] Token 儲值流程（目前僅扣點；金流 Phase 2）
- [ ] 聯絡表單通知（新訊息 email 通知 agent）

## 品質 / 安全
- [ ] 全域 exception filter（統一錯誤格式、request id、production 隱藏內部訊息）
- [ ] unit / e2e 測試（guards、properties service、favorites、contact、cron）
- [ ] OpenAPI（`@nestjs/swagger`）
- [ ] `supabase gen types typescript` 產出型別，前後端共用
- [ ] properties 全文搜尋索引（title / description，pg_trgm 或 FTS）
- [ ] click_count / view_count 改 RPC 原子累加

## 📦 Phase 2（Nice to Have，非本期範圍）
- Blog / Sold Properties / Testimonials 對應的資料表
- 臨近成交行情資料源
- 進階 Analytics 事件表
- Stripe 金流 / 發票（token 儲值）
- Saved search 新物件上架 email 通知
