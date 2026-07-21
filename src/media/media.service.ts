import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  RegisterExternalMediaDto,
  RegisterUploadedMediaDto,
} from './dto/register-media.dto';
import {
  ALLOWED_EMBED_HOSTS,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  IMAGE_MAX_BYTES,
  MEDIA_BUCKET,
  VIDEO_MAX_BYTES,
} from './media.constants';

@Injectable()
export class MediaService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 登記外部嵌入媒體（YouTube / Vimeo / Matterport） */
  async registerExternal(agentId: string, dto: RegisterExternalMediaDto) {
    this.validateEmbedUrl(dto.url);
    await this.assertPropertyOwnership(agentId, dto.propertyId);

    const { data, error } = await this.supabase.admin
      .from('media')
      .insert({
        property_id: dto.propertyId,
        type: dto.type,
        external_url: dto.url,
        sort_order: dto.sortOrder ?? 0,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Storage 上傳完成後登記 media row */
  async registerUploaded(agentId: string, dto: RegisterUploadedMediaDto) {
    await this.assertPropertyOwnership(agentId, dto.propertyId);

    const { data, error } = await this.supabase.admin
      .from('media')
      .insert({
        property_id: dto.propertyId,
        type: dto.type,
        storage_path: dto.storagePath,
        mime_type: dto.mimeType,
        file_size_bytes: dto.fileSizeBytes,
        sort_order: dto.sortOrder ?? 0,
        is_cover: dto.isCover ?? false,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** 簡易數據追蹤：外部影片/3D 導覽點擊 +1 */
  async trackClick(mediaId: string) {
    const { error } = await this.supabase.admin.rpc('increment_media_click', {
      media_id: mediaId,
    });
    if (error) throw new InternalServerErrorException(error.message);
  }

  private validateEmbedUrl(url: string) {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      throw new BadRequestException(`Invalid URL: ${url}`);
    }

    const allowed = ALLOWED_EMBED_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
    if (!allowed) {
      throw new BadRequestException(
        `Embed host not allowed: ${hostname} (allowed: ${ALLOWED_EMBED_HOSTS.join(', ')})`,
      );
    }
  }

  private async assertPropertyOwnership(agentId: string, propertyId: string) {
    const { data, error } = await this.supabase.admin
      .from('properties')
      .select('agent_id')
      .eq('id', propertyId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Property ${propertyId} not found`);
    if (data.agent_id !== agentId) {
      throw new ForbiddenException(
        'You can only manage media of your own listings',
      );
    }
  }

  /**
   * 產生 Supabase Storage 的 signed upload URL，
   * 前端拿到後直接上傳檔案，再呼叫後端登記 media row。
   */
  async createSignedUploadUrl(
    agentId: string,
    propertyId: string,
    fileName: string,
    mimeType: string,
    fileSizeBytes: number,
  ) {
    this.validateFile(mimeType, fileSizeBytes);
    await this.assertPropertyOwnership(agentId, propertyId);

    const safeName = fileName.replace(/[^\w.-]/g, '_');
    const path = `${agentId}/${propertyId}/${Date.now()}-${safeName}`;
    const { data, error } = await this.supabase.admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(path);

    if (error) throw new InternalServerErrorException(error.message);
    return { path, signedUrl: data.signedUrl, token: data.token };
  }

  private validateFile(mimeType: string, fileSizeBytes: number) {
    const isImage = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(
      mimeType,
    );
    const isVideo = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(
      mimeType,
    );

    if (!isImage && !isVideo) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}`);
    }

    const maxBytes = isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (fileSizeBytes > maxBytes) {
      throw new BadRequestException(
        `File too large: ${fileSizeBytes} bytes (max ${maxBytes})`,
      );
    }
  }
}
