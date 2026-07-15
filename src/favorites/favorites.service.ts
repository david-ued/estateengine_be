import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 帳號中心「我的收藏」：完整物件卡資料（含已下架者，前端標記狀態） */
  async list(userId: string) {
    const { data, error } = await this.supabase.admin
      .from('favorites')
      .select(
        'created_at, property:properties(*, media(*), agent:profiles(id, display_name, avatar_url, agency_name, phone))',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** 輕量 id 清單：列表頁 hydrate 愛心狀態用 */
  async listIds(userId: string) {
    const { data, error } = await this.supabase.admin
      .from('favorites')
      .select('property_id')
      .eq('user_id', userId);

    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((row) => row.property_id as string);
  }

  async add(userId: string, propertyId: string) {
    const { data: property, error: lookupError } = await this.supabase.admin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .maybeSingle();

    if (lookupError) {
      throw new InternalServerErrorException(lookupError.message);
    }
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    const { error } = await this.supabase.admin
      .from('favorites')
      .upsert(
        { user_id: userId, property_id: propertyId },
        { onConflict: 'user_id,property_id', ignoreDuplicates: true },
      );

    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  async remove(userId: string, propertyId: string) {
    const { error } = await this.supabase.admin
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('property_id', propertyId);

    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }
}
