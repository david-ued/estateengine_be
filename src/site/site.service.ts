import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateAgentProfileDto, UpdateSiteSettingsDto } from './dto/site.dto';

const AGENT_PUBLIC_FIELDS =
  'id, display_name, full_name, email, avatar_url, agency_name, license_no, bio, phone, contact_line_id, social_links';

@Injectable()
export class SiteService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 公開站台資料：品牌內容 + 單一 agent 名片（整站唯一 agent） */
  async getSite() {
    const [settingsResult, agentResult] = await Promise.all([
      this.supabase.admin
        .from('site_settings')
        .select('data, updated_at')
        .eq('id', 1)
        .maybeSingle(),
      this.supabase.admin
        .from('profiles')
        .select(AGENT_PUBLIC_FIELDS)
        .eq('role', 'agent')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    // site_settings 表尚未建立（migration 未套用）時退回空設定，agent 名片照常
    const missingTable =
      settingsResult.error?.code === '42P01' ||
      settingsResult.error?.code === 'PGRST205';
    if (settingsResult.error && !missingTable) {
      throw new InternalServerErrorException(settingsResult.error.message);
    }
    if (agentResult.error) {
      throw new InternalServerErrorException(agentResult.error.message);
    }

    return {
      settings: (settingsResult.data?.data ?? {}) as Record<string, unknown>,
      agent: agentResult.data ?? null,
    };
  }

  async updateSettings(dto: UpdateSiteSettingsDto) {
    const { data, error } = await this.supabase.admin
      .from('site_settings')
      .upsert({ id: 1, data: dto.data })
      .select('data, updated_at')
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Agent 編輯自己的品牌名片 */
  async updateAgentProfile(agentId: string, dto: UpdateAgentProfileDto) {
    const map: Record<string, string> = {
      displayName: 'display_name',
      fullName: 'full_name',
      agencyName: 'agency_name',
      licenseNo: 'license_no',
      bio: 'bio',
      phone: 'phone',
      contactLineId: 'contact_line_id',
      avatarUrl: 'avatar_url',
      socialLinks: 'social_links',
    };

    const patch: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(map)) {
      const value = (dto as Record<string, unknown>)[key];
      if (value !== undefined) patch[column] = value;
    }

    const { data, error } = await this.supabase.admin
      .from('profiles')
      .update(patch)
      .eq('id', agentId)
      .select(AGENT_PUBLIC_FIELDS)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Agent profile not found');
    return data;
  }
}
