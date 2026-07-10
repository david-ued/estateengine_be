// 開發用假資料補齊：物件座標（地圖 view 用）、房屋照片、房仲頭像
// 執行：node scripts/seed-visuals.mjs（讀取 .env 的 service key）
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

const CITY_CENTERS = {
  Edmonton: [53.5461, -113.4938],
  Vancouver: [49.2827, -123.1207],
  Toronto: [43.6532, -79.3832],
};

const HOUSE_PHOTOS = [
  '1564013799919-ab600027ffc6',
  '1570129477492-45c003edd2be',
  '1600585154340-be6161a56a0c',
  '1600596542815-ffad4c1539a9',
  '1600607687939-ce8a6c25118c',
  '1600566753086-00f18fb6b3ea',
  '1512917774080-9991f1c4c750',
  '1568605114967-8130f3a36994',
  '1583608205776-bfd35f0d9f83',
  '1600047509807-ba8f99d2cdde',
  '1600607687644-c7171b42498f',
  '1600210492486-724fe5c67fb0',
  '1600585154526-990dced4db0d',
  '1600573472592-401b489a3cdc',
];

const AGENT_PORTRAIT = '1560250097-0b93528c311a';

const unsplashUrl = (id, w) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const { data: agent, error: agentError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('role', 'agent')
    .limit(1)
    .single();
  if (agentError) throw agentError;

  const { data: properties, error: propsError } = await supabase
    .from('properties')
    .select('id, city, lat, media(id, type)')
    .order('created_at', { ascending: true });
  if (propsError) throw propsError;

  // 1) 座標：缺 lat/lng 的物件以城市中心 + 抖動補齊
  let coordsSet = 0;
  for (const [index, property] of properties.entries()) {
    if (property.lat != null) continue;
    const [baseLat, baseLng] = CITY_CENTERS[property.city] ?? CITY_CENTERS.Toronto;
    const lat = baseLat + (((index * 37) % 100) - 50) * 0.001;
    const lng = baseLng + (((index * 53) % 100) - 50) * 0.0016;
    const { error } = await supabase.from('properties').update({ lat, lng }).eq('id', property.id);
    if (error) throw error;
    coordsSet += 1;
  }
  console.log(`coords set: ${coordsSet}`);

  // 2) 每個物件補到至少 5 張照片
  let uploaded = 0;
  for (const [index, property] of properties.entries()) {
    const existing = property.media.filter((m) => m.type === 'image').length;
    const need = Math.max(0, 5 - existing);
    for (let n = 0; n < need; n += 1) {
      const photoId = HOUSE_PHOTOS[(index * 3 + n) % HOUSE_PHOTOS.length];
      const buffer = await download(unsplashUrl(photoId, 1280));
      const path = `${agent.id}/${property.id}/house-${photoId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('property-media')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('media').insert({
        property_id: property.id,
        type: 'image',
        storage_path: path,
        mime_type: 'image/jpeg',
        file_size_bytes: buffer.length,
        sort_order: existing + n,
        is_cover: existing + n === 0,
      });
      if (insertError) throw insertError;
      uploaded += 1;
    }
  }
  console.log(`photos uploaded: ${uploaded}`);

  // 3) 房仲頭像
  const portrait = await download(unsplashUrl(AGENT_PORTRAIT, 400));
  const avatarPath = `${agent.id}/avatar.jpg`;
  const { error: avatarUploadError } = await supabase.storage
    .from('avatars')
    .upload(avatarPath, portrait, { contentType: 'image/jpeg', upsert: true });
  if (avatarUploadError) throw avatarUploadError;

  const avatarUrl = `${env.SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`;
  const { error: avatarError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', agent.id);
  if (avatarError) throw avatarError;
  console.log(`agent avatar set for ${agent.full_name}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
