-- =====================================================================
-- Supabase Storage：物件照片 / Reels 短影音 bucket
-- bucket 層限制為單一上限（100MB，涵蓋影片）；
-- 「影像 10MB / 影片 100MB」的分型別限制由 NestJS MediaService 驗證。
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'property-media',
    'property-media',
    true,               -- 公開讀取（列表與內頁直接顯示）
    104857600,          -- 100 MB
    array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm'
    ]
  ),
  (
    'avatars',
    'avatars',
    true,
    5242880,            -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

-- 上傳路徑慣例：{agent_id}/{property_id}/{filename}
-- 房仲僅能寫入自己 uid 開頭的資料夾
create policy "agents upload own property media"
  on storage.objects for insert
  with check (
    bucket_id = 'property-media'
    and public.has_role('agent')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "agents manage own property media objects"
  on storage.objects for update
  using (
    bucket_id = 'property-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_super_admin())
  );

create policy "agents delete own property media objects"
  on storage.objects for delete
  using (
    bucket_id = 'property-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_super_admin())
  );

create policy "users upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
