# Supabase 串接指南

前後端接上 Supabase 的完整步驟。migrations 都在本 repo 的 `supabase/migrations/`，照順序做即可。

## 1. 建立專案

1. 到 [supabase.com](https://supabase.com/dashboard) → **New Project**
2. Region 建議選 `ca-central-1`（目標市場為加拿大）
3. 記下 Database Password（之後 CLI link 會用到）

## 2. 取得金鑰

Dashboard → **Project Settings → API**：

| 金鑰 | 用途 | 放哪裡 |
|---|---|---|
| Project URL | 前後端共用 | 兩邊 env |
| `anon` / publishable key | 前端（受 RLS 管制） | 只放前端 |
| `service_role` key | 後端（繞過 RLS） | **只放後端，嚴禁進前端或 commit** |

## 3. 填環境變數

**前端 `estateengine_fe/.env.local`**（複製 `.env.example`）：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**後端 `estateengine_be/.env`**（複製 `.env.example`）：

```env
PORT=3001
CORS_ORIGINS=http://localhost:3000
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> 填完要重啟 dev server 才會生效。前端在 env 缺失時會優雅降級（公開頁照常顯示、登入功能停用），所以看到「登入沒反應」先檢查 env。

## 4. 套用 Migrations（三選一）

依序三個檔案：`20260710000001_init_schema.sql` → `20260710000002_storage_buckets.sql` → `20260710000003_seed_persona_templates.sql`

**方式 A — Supabase CLI（推薦）**

```bash
cd estateengine_be
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push        # 自動依檔名順序執行 supabase/migrations/
```

**方式 B — Dashboard SQL Editor**

SQL Editor → New query → 依序貼上三個檔案內容執行。

**方式 C — 叫 Claude 用 Supabase MCP 直接套用並跑 advisors 檢查。**

> ✅ **2026-07-10 已套用**：四個 migrations（含 `20260710000004_security_hardening.sql`）已透過 Supabase MCP 套用到專案 `fcbhvukffjbghydqgmmg`，advisors 已檢查。
>
> ⚠️ **2026-07-16 待套用**：`20260710000005_ai_tokens.sql`（AI 建檔點數）與 `20260716000001_single_agent_pivot.sql`（單一 agent 轉向：移除 super_admin、新增 favorites / saved_searches / contact_messages / site_settings，見 `PIVOT.md`）。套用後執行 `node scripts/pivot-single-agent.mjs` 做資料歸戶與品牌種子。

## 4.5 測試帳號與假資料（已建立）

開發用測試帳號（密碼格式 `<角色>@2026!`）：

| 角色 | Email | 密碼 |
|---|---|---|
| ~~Super Admin~~（2026-07-16 起降為買家，Super Admin 已移除） | `admin@estateengine.test` | `Admin@2026!` |
| 房仲＝唯一 Agent（跑過 pivot 腳本後名片為 Grace Chen / EstateEngine Realty） | `agent@estateengine.test` | `Agent@2026!` |
| 買家（Amy Chen） | `buyer@estateengine.test` | `Buyer@2026!` |

> 這些帳號是用 SQL 直接建立的（email 已標記驗證）。GoTrue 的 signup API 會拒絕 `.test` 網域，所以之後從前端註冊新帳號請用真實網域的信箱。

假資料內容：房仲 Kevin 名下 10 筆物件（Edmonton / Vancouver / Toronto；7 published + 1 draft + 1 sold + 1 delisted）、每筆 2 張 Storage 照片、7 個外部影片/3D 嵌入、364 筆停留事件、2 個分享清單（slug：`chen-family-jul-picks`、`toronto-condo-shortlist`）、Amy 的自訂權重 profile。

## 5. Auth 設定

Dashboard → **Authentication**：

1. **Sign In / Providers → Email**：確認啟用
2. 開發期建議關閉 **Confirm email**（否則註冊後要先點驗證信才能登入）
3. **URL Configuration**：Site URL 填 `http://localhost:3000`

## 6. 指定唯一 Agent（單一 agent 架構）

2026-07-16 起網站為單一 agent 品牌站，角色只剩 `buyer` / `agent`，且不再有任何升級介面。
要更換唯一 agent 時，SQL Editor 手動執行：

```sql
update public.profiles set role = 'buyer' where role = 'agent';
update public.profiles set role = 'agent' where email = 'you@example.com';
```

> 系統以「唯一一個 role='agent' 的 profile」作為品牌主體（GET /site 取最早建立者），請確保同時只有一個 agent。

## 7. 啟動與驗收

```bash
# Terminal 1
cd estateengine_be && npm run start:dev   # :3001

# Terminal 2
cd estateengine_fe && npm run dev         # :3000
```

驗收路徑：

1. Admin 登入 → `/admin/users` 把測試帳號升為房仲
2. 房仲登入（手機開更好）→ 新增物件（獨家數據 + 外部影片連結）→ 上傳照片 → 上架
3. 買家開 `/properties` → 調權重 / 套 Persona → 看符合度排序與「新上市」標
4. 進內頁 → 播影片（點擊計數）→ 房貸試算
5. 房仲後台看三指標（瀏覽 / 平均停留 / 影片點擊）→ 推薦清單頁生成分享連結
6. Admin `/admin` 強制下架測試

## 8. 產生 TypeScript 型別（選配）

```bash
npx supabase gen types typescript --project-id <your-ref> > estateengine_fe/src/lib/database.types.ts
```

之後可把 `src/lib/types.ts` 的手寫型別換成產生的版本。

## 常見雷點

- **RLS 已全面啟用**：anon key 只看得到 `published` 物件與啟用中的 persona 範本，看不到資料 ≠ 壞掉，先確認物件狀態。
- **role 欄位不可自行變更**：profiles 的 update policy 鎖死 role，只有後端 service_role（Admin API）能改。
- **Storage bucket 不用手動建**：migration 0002 已建 `property-media`（100MB、MIME 白名單）與 `avatars`。
- **90 天自動下架**：NestJS Cron 每日 03:00（Asia/Taipei）執行，後端要常駐才會跑。
- **CORS**：前端網域上線後記得加進後端 `CORS_ORIGINS`（逗號分隔）。
