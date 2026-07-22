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
- [x] ~~需手動：套用 migration~~ ✅ 2026-07-20 以 REST 唯讀確認 pivot 各表（contact_messages / site_settings / favorites / saved_searches）皆已存在
- [x] ~~需手動：`node scripts/pivot-single-agent.mjs`~~ ✅ 2026-07-20 確認品牌名片 / site_settings 已種（前台 footer 顯示電話 / email / LINE）
- [ ] SUPABASE_SETUP.md 更新

### 2026-07-20 預售屋支援（David 指示）

- [x] migration `20260720000001_presale.sql`：`properties.is_presale boolean not null default false`
- [x] `CreatePropertyDto.isPresale` + `toRow` 對應 `is_presale`（tsc 通過；lint 無新增問題）
- [x] ~~需手動：SQL Editor 執行 `20260720000001_presale.sql`~~ ✅ 2026-07-20 已透過 Supabase MCP `apply_migration` 套用到遠端（migration 名稱 `presale`）；驗證：`is_presale boolean NOT NULL DEFAULT false`，既有 10 筆物件皆可讀、值為 false
- [x] 2026-07-20 E2E 驗證預售屋全流程（Playwright headless，暫時測試 agent 跑完即刪）：後台勾選預售屋建檔＋上架 → 搜尋卡片黑底金字「預售屋」徽章 → 內頁徽章＋「有新進度提醒我」CTA → 提醒登記寫入 inbox（【預售屋提醒登記】前綴）→ 非預售物件 CTA 仍為「詢問此物件」，全部通過

### 2026-07-21 MLS 合規前置（David 指示：先做簡單的，其餘進 TODO）

- [x] 「MLS 認證房仲正式使用」缺口分析 → 完整清單見 `TODO.md`「🎯 MLS 認證房仲正式使用缺口」
- [x] migration `20260721000001_mls_compliance.sql` 已套用遠端：`properties.mls_number`、`contact_messages.casl_consent_at`
- [x] BE：`CreatePropertyDto.mlsNumber`、`CreateContactMessageDto.caslConsent`（勾選當下記 `casl_consent_at`，已驗證寫入）
- [x] FE：建檔表單 MLS® 編號欄 + 內頁其他資訊列；聯絡表單/預售屋提醒 CASL 必勾（HTML required，未勾擋送出）；footer + 內頁名片 brokerage 條件揭露（`agency_name` 目前 null 畫面不變；`license_no` 已設，footer 新增「Lic. …」小字）
- [ ] ⚠️ brokerage 名稱揭露為 BCFSA 要求，與「前台不顯示仲介公司」決策衝突——待與 Tim / brokerage 確認後填回 `profiles.agency_name`

### 2026-07-21 專欄部落格（Blog，見 FE PIVOT.md 第五輪）

- [x] 新增 `articles` module：公開 `GET /articles`（分頁 + `featured=`）/ `GET /articles/:slug`（含作者名片 embed）；agent 限定 `GET /articles/mine`、`POST`、`PATCH /:id`、`DELETE /:id`（`SupabaseAuthGuard` + `RolesGuard`，author_id 過濾）
- [x] 內文 `content_html` 寫入前以 `sanitize-html` 白名單消毒（新依賴）；slug 由標題產生（非拉丁退回亂數）、撞號補尾碼；首次發佈才記 `published_at`
- [x] migration `20260721000002_articles.sql`：`articles` 表 + RLS（公開讀已發佈 / 作者管自己的）+ `article-media` 公開 bucket（10MB、agent 僅能寫自己 uid 資料夾）✅ 已透過 Supabase MCP `apply_migration` 套用遠端（名稱 `articles`）；`get_advisors` 無新增問題
- [x] 驗證：`nest build` 通過；smoke test 種文/讀取/401 保護皆正常；Playwright E2E（暫時 agent）走完 寫文→傳圖→發佈→前台→轉回草稿 全流程通過（測試資料已清除）

### 2026-07-22 可養寵物篩選（David 指示）

- [x] migration `20260722000001_pets_allowed.sql`：`properties.pets_allowed boolean not null default false` ✅ 已透過 Supabase MCP `apply_migration` 套用遠端（名稱 `pets_allowed`）
- [x] `CreatePropertyDto.petsAllowed` + `toRow` 對應 `pets_allowed`；`QueryPropertiesDto.petsAllowed`（`@IsIn(['true','false'])` 三態：不帶 = 不限）→ `findPublished` 以 `eq('pets_allowed', …)` 過濾
- [x] FE：建檔表單勾選、搜尋「更多條件」三態 chips（不限/可養寵物/不可養寵物）、內頁室內資訊「寵物」列、zh-TW / en 字典同步（詳見 FE PIVOT.md 第六輪）
- [x] 驗證：BE / FE tsc 0 錯誤；本機 API 實測 `petsAllowed=false` 回傳既有 7 筆、`petsAllowed=true` 回空（既有物件預設 false）、非法值 400

### 2026-07-22 Prospect CRM（David 指示：Tim 訊息的 1 / 4 / 5，見 FE PIVOT.md 第七輪）

- [x] migration `20260722000002_prospects.sql` ✅ 已透過 Supabase MCP `apply_migration` 套用遠端（名稱 `prospects`）：
  - `prospect_profiles`（user_id PK→profiles cascade；`pre_approval_status` none/in_progress/approved、`pre_approval_amount`、`proof_of_funds`、`buyer_note`、`agent_note`）
  - `property_interests`（buyer×property unique；`decision` considering/locked_in/walked_away、`act_fast`、`agent_note`、`decided_at`；buyer/property 索引）
  - 兩表 RLS 啟用但**無 client policy**（僅 BE service_role）：`agent_note` 要對買家保密，RLS 藏不住單一欄位，欄位級權限由 BE 端點的欄位集控制
- [x] 新增 `prospects` module：
  - 買家自助（`SupabaseAuthGuard`）：`GET/PUT /prospects/me`（財務申報，整份覆寫；回應排除 agent_note）、`GET /prospects/me/interests`、`PUT /prospects/me/interests/:propertyId`（表態 upsert，act_fast 可見、agent_note 不可見）
  - Agent CRM（`RolesGuard @Roles(AGENT)`）：`GET /prospects`（全部買家＋財務＋鎖定/跳過/Act Fast/收藏彙總＋最後活動排序）、`GET /prospects/:userId`（明細：profile＋財務含 agent_note＋表態含物件 embed＋收藏前 50）、`PATCH /prospects/:userId`（部分更新，不覆寫 buyer_note）、`PUT /prospects/:userId/interests/:propertyId`（Act Fast/備註/代為表態 upsert，收藏未表態可直接建立）
  - `/me` 路由宣告在 `/:userId` 之前避免被萬用參數吃掉；`decided_at` 僅買家實際表態（非 considering）時記錄
- [x] 驗證：tsc / eslint 0 新增錯誤；E2E（暫時 buyer+agent，跑完即刪）：買家申報→收藏+lock-in→買家打 CRM 端點 403→agent 列表彙總/明細→agent 改財務（buyer_note 保留）+Act Fast（decision 保留）→買家看得到 act_fast、兩處 agent_note 都拿不到→FE 三頁渲染，全部通過
