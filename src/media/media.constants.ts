// PRD：Storage 需設定檔案大小限制與格式驗證（影像與短影音）
export const MEDIA_BUCKET = 'property-media';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB（Reels 短影音）

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

// PRD：影片/3D 導覽支援嵌入外部連結（YouTube, Vimeo, Matterport）以節省伺服器成本
export const ALLOWED_EMBED_HOSTS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'matterport.com',
] as const;
