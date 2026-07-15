// 單一 Agent 轉向（PIVOT.md）資料歸戶：
// 1) 全部物件歸到唯一 agent  2) 其他 agent / super_admin 帳號降為 buyer
// 3) 補齊 agent 品牌名片   4) site_settings 品牌內容（表已存在才會成功）
// 執行：node scripts/pivot-single-agent.mjs [唯一agent的email]
//（讀取 .env 的 service key；不帶參數時取最早建立的 agent。
//  目前 DB 有兩個 agent：agent@estateengine.test（測試種子、名下有假物件）
//  與 davidlin1727@gmail.com（真實帳號）——請用參數指定要留哪一個。）
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);

const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// 品牌只呈現 Tim Lin 本人，不註明所屬仲介公司（agency_name 清空）
const BRAND_PROFILE = {
  display_name: 'Tim Lin',
  full_name: 'Tim Lin',
  agency_name: null,
  license_no: 'BC-V2026-8831',
  phone: '+1 (604) 555-8831',
  contact_line_id: 'timlin.home',
  bio: [
    '深耕大溫哥華 12 年，專精 Downtown、西溫與北溫的公寓與獨立屋買賣。',
    '我相信買房不只是交易，而是人生階段的重要決定——所以我把學區、交通、淹水區、建商評價、風水座向這些「MLS 上看不到的功課」都做在前面，讓你看的每一間房都心裡有數。',
    '中英雙語服務，從看房、出價、驗屋到交屋，全程陪同。',
  ].join('\n\n'),
  social_links: {
    instagram: 'https://instagram.com/timlin.home',
    youtube: 'https://youtube.com/@timlin-home',
  },
};

const SITE_SETTINGS_DATA = {
  stats: { sold: 320, volume: 'CAD $4.8 億+', years: 12 },
  locales: {
    'zh-TW': {
      heroTitle: '在溫哥華，找到理想的家',
      heroSubtitle: '精選物件、獨家在地數據、一對一中英雙語服務。',
      story:
        '12 年前我陪第一組客人看房時就發現：買家真正需要的，是有人把功課做在前面。於是我建立了自己的一套在地數據庫——學區排名、通勤動線、淹水區地圖、建商口碑、風水座向——每一間我上架的房子，都附上這些「MLS 沒有的答案」。320 筆成交背後，是同一個信念：把每一位買家，當成第一位買家。',
      values: [
        { title: '誠信', body: '看得到的與看不到的問題，一樣誠實告訴你。' },
        { title: '專業', body: '獨家在地數據建檔，每間房都做足功課。' },
        { title: '陪伴', body: '從看房到交屋全程參與，中英雙語溝通。' },
        { title: '守護', body: '成交不是結束，是長期關係的開始。' },
      ],
    },
    en: {
      heroTitle: 'Find Your Dream Home in Vancouver',
      heroSubtitle:
        'Curated listings, exclusive local insights, bilingual one-on-one service.',
      story:
        "Twelve years ago, showing my very first clients around Vancouver, I realized what buyers really need: someone who does the homework first. So I built my own local database — school rankings, commute routes, flood-zone maps, builder reputations, feng shui orientations. Every listing I represent comes with the answers MLS can't give you. Behind 320 closed deals is one belief: treat every buyer like my first.",
      values: [
        { title: 'Integrity', body: 'The flaws you can see and the ones you cannot — you hear about both.' },
        { title: 'Expertise', body: 'Exclusive local insights researched for every single listing.' },
        { title: 'Partnership', body: 'From first viewing to closing day, bilingual and by your side.' },
        { title: 'Care', body: 'Closing is not the end — it is the start of a long relationship.' },
      ],
    },
  },
};

async function main() {
  // 1) 唯一 agent：CLI 參數指定 email，未指定則取最早建立的 agent 帳號
  const targetEmail = process.argv[2]?.toLowerCase();

  const { data: agents, error: agentsError } = await supabase
    .from('profiles')
    .select('id, email, role, created_at')
    .in('role', ['agent', 'super_admin'])
    .order('created_at', { ascending: true });
  if (agentsError) throw agentsError;

  const theAgent = targetEmail
    ? agents.find((profile) => profile.email?.toLowerCase() === targetEmail)
    : (agents.find((profile) => profile.role === 'agent') ?? agents[0]);
  if (!theAgent) {
    throw new Error(
      targetEmail
        ? `找不到 email 為 ${targetEmail} 的 agent/super_admin 帳號`
        : '找不到 agent 帳號，請先建立',
    );
  }
  console.log(`the agent: ${theAgent.email} (${theAgent.id})`);

  // 2) 物件全部歸戶
  const { data: moved, error: moveError } = await supabase
    .from('properties')
    .update({ agent_id: theAgent.id })
    .neq('agent_id', theAgent.id)
    .select('id');
  if (moveError) throw moveError;
  console.log(`properties reassigned: ${moved.length}`);

  // 分享清單也歸戶（agent_id FK）
  const { data: movedLinks, error: linkError } = await supabase
    .from('share_links')
    .update({ agent_id: theAgent.id })
    .neq('agent_id', theAgent.id)
    .select('id');
  if (linkError) throw linkError;
  console.log(`share links reassigned: ${movedLinks.length}`);

  // 3) 其他 agent / super_admin 全部降為 buyer
  const others = agents.filter((profile) => profile.id !== theAgent.id);
  for (const other of others) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'buyer' })
      .eq('id', other.id);
    if (error) throw error;
    console.log(`demoted to buyer: ${other.email}`);
  }

  // 4) 品牌名片
  const { error: brandError } = await supabase
    .from('profiles')
    .update({ ...BRAND_PROFILE, role: 'agent' })
    .eq('id', theAgent.id);
  if (brandError) throw brandError;
  console.log('brand profile updated');

  // 5) site_settings（migration 20260716000001 套用後才有這張表）
  const { error: settingsError } = await supabase
    .from('site_settings')
    .upsert({ id: 1, data: SITE_SETTINGS_DATA });
  if (settingsError) {
    console.warn(
      `site_settings 未寫入（migration 尚未套用？）：${settingsError.message}`,
    );
  } else {
    console.log('site_settings seeded');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
