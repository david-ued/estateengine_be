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

## 🎯 MLS 認證房仲正式使用缺口（2026-07-21 分析）

> 盤點「給 MLS 認證房仲當正式工作平台」還缺什麼。**已做（同日）**：migration
> `20260721000001_mls_compliance.sql`（`properties.mls_number` + `contact_messages.casl_consent_at`，已套用遠端）、
> DTO 與前台對應欄位、聯絡表單/預售屋提醒 CASL 必勾同意、brokerage/牌照 footer 條件揭露。
> 其餘依優先序：

- [ ] ⚠️ **合規確認（免寫程式，最優先）**：BCFSA 廣告規範要求揭露 brokerage 名稱，與「前台不顯示仲介公司」的 PIVOT 決策衝突。前台已改為「`profiles.agency_name` 一經設定即於 footer + 內頁名片小字顯示」（目前為 null、畫面不變）——需與 Tim / 其 brokerage 確認後把名稱填回
- [ ] **Email service（所有通知的地基）**：Resend / Postmark 擇一打通——聯絡表單通知 agent、預售屋提醒、saved-search 新物件通知。寄行銷信前必查 `casl_consent_at`，每封附退訂連結（CASL）
- [ ] **CREA DDF® 串接（工程量最大）**：RESO Web API 匯入 listing + 定時同步價格/狀態/下架，以 `mls_number` 為對照鍵；手動建檔保留給 pocket listing / 預售屋。互惠展示物件必須帶「Listed by ○○ Brokerage」歸屬字樣（DDF 顯示規則）
- [ ] **IDX/VOW 規則**：成交價／Sold 資料屬 VOW 範疇，必須登入才可見——重用現有會員 gating 機制
- [ ] **CRM lite**：`contact_messages` 加 lead 狀態（新進/跟進中/已約看/成交）與備註欄，inbox 對應 UI
- [ ] **文件管理**：floor plan / strata 文件 / disclosure PDF 上傳與（可選 gating 的）下載（media 擴充）
- [ ] **Seller 週報**：把現有 view / dwell / video 數據輸出成可寄給屋主的報告（低成本高感知）

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
