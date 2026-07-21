import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateShareLinkDto } from './dto/create-share-link.dto';

@Injectable()
export class ShareLinksService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 一鍵生成專屬推薦清單連結 */
  async create(agentId: string, dto: CreateShareLinkDto) {
    // 清單內容僅限該房仲自己的物件
    const { data: owned, error: ownedError } = await this.supabase.admin
      .from('properties')
      .select('id')
      .eq('agent_id', agentId)
      .in('id', dto.propertyIds);

    if (ownedError) throw new InternalServerErrorException(ownedError.message);
    if ((owned ?? []).length !== dto.propertyIds.length) {
      throw new BadRequestException('All properties must belong to you');
    }

    const slug = randomBytes(6).toString('base64url');

    const { data: link, error } = await this.supabase.admin
      .from('share_links')
      .insert({
        agent_id: agentId,
        slug,
        title: dto.title,
        og_title: dto.ogTitle,
        og_description: dto.ogDescription,
        og_image_path: dto.ogImagePath,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    const { error: itemsError } = await this.supabase.admin
      .from('share_link_properties')
      .insert(
        dto.propertyIds.map((propertyId, index) => ({
          share_link_id: link.id,
          property_id: propertyId,
          sort_order: index,
        })),
      );

    if (itemsError) throw new InternalServerErrorException(itemsError.message);
    return link;
  }

  async findMine(agentId: string) {
    const { data, error } = await this.supabase.admin
      .from('share_links')
      .select('*, items:share_link_properties(property_id, sort_order)')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** 公開解析：推薦清單頁 + OG 標籤用；同時累計點擊 */
  async resolveBySlug(slug: string) {
    const { data: link, error } = await this.supabase.admin
      .from('share_links')
      .select(
        `*,
         agent:profiles(id, display_name, full_name, avatar_url, agency_name, bio, phone, social_links),
         items:share_link_properties(sort_order, property:properties(*, media(*)))`,
      )
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!link) throw new NotFoundException(`Share link ${slug} not found`);
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      throw new NotFoundException(`Share link ${slug} has expired`);
    }

    await this.supabase.admin.rpc('increment_share_link_click', {
      link_slug: slug,
    });

    type Item = { sort_order: number; property: { status: string } | null };
    const items = ((link.items ?? []) as Item[])
      .filter((item) => item.property?.status === 'published')
      .sort((a, b) => a.sort_order - b.sort_order);

    return { ...link, items };
  }

  async remove(agentId: string, id: string) {
    const { data, error } = await this.supabase.admin
      .from('share_links')
      .select('agent_id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Share link ${id} not found`);
    if (data.agent_id !== agentId) {
      throw new ForbiddenException('You can only delete your own share links');
    }

    const { error: deleteError } = await this.supabase.admin
      .from('share_links')
      .delete()
      .eq('id', id);

    if (deleteError)
      throw new InternalServerErrorException(deleteError.message);
    return { ok: true };
  }
}
