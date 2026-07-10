import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 公開列表：僅回傳已上架物件，支援 PRD 基本 + 進階 Filter，每頁最多 6-7 筆 */
  async findPublished(query: QueryPropertiesDto) {
    const from = (query.page - 1) * query.pageSize;

    let builder = this.supabase.admin
      .from('properties')
      .select('*, media(*), agent:profiles(id, display_name, avatar_url, agency_name, phone)', {
        count: 'exact',
      })
      .eq('status', 'published')
      .range(from, from + query.pageSize - 1);

    // 排序：最新上架 / 價格；「系統推薦」由前端以買家權重計分排序
    switch (query.sort) {
      case 'price_desc':
        builder = builder.order('price', { ascending: false });
        break;
      case 'price_asc':
        builder = builder.order('price', { ascending: true });
        break;
      default:
        builder = builder.order('listed_at', { ascending: false });
    }

    // 防禦性過濾：超過 90 天一律不出現在前端（Cron 下架前的保險）
    const maxAge = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    builder = builder.gte('listed_at', maxAge);

    if (query.city) builder = builder.eq('city', query.city);
    if (query.district) builder = builder.eq('district', query.district);
    if (query.minPrice !== undefined) builder = builder.gte('price', query.minPrice);
    if (query.maxPrice !== undefined) builder = builder.lte('price', query.maxPrice);
    if (query.minSqft !== undefined) builder = builder.gte('area_sqft', query.minSqft);
    if (query.maxSqft !== undefined) builder = builder.lte('area_sqft', query.maxSqft);
    if (query.beds !== undefined) builder = builder.gte('beds', query.beds);
    if (query.baths !== undefined) builder = builder.gte('baths', query.baths);
    if (query.propertyType) builder = builder.eq('property_type', query.propertyType);
    if (query.minSchool !== undefined) builder = builder.gte('score_school', query.minSchool);
    if (query.minBuilder !== undefined) {
      builder = builder.gte('builder_reputation', query.minBuilder);
    }
    if (query.minMaterial !== undefined) {
      builder = builder.gte('material_grade', query.minMaterial);
    }
    if (query.orientation) {
      builder = builder.eq('feng_shui_orientation', query.orientation);
    }
    if (query.amenities) {
      // AND 條件：每個勾選的生活機能都必須為 true
      for (const amenity of query.amenities.split(',')) {
        builder = builder.eq(`custom_attributes->>${amenity}`, 'true');
      }
    }
    if (query.freshWithinDays !== undefined) {
      const cutoff = new Date(
        Date.now() - query.freshWithinDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      builder = builder.gte('listed_at', cutoff);
    }

    const { data, error, count } = await builder;
    if (error) throw new InternalServerErrorException(error.message);

    return {
      items: data,
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** 房仲後台：自己的物件（所有狀態） */
  async findMine(agentId: string) {
    const { data, error } = await this.supabase.admin
      .from('properties')
      .select('*, media(*)')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /**
   * 簡易數據追蹤面板（PRD 三指標）：
   * 每個物件的總瀏覽量 / 平均停留秒數 / 外部影片點擊次數
   */
  async getMineStats(agentId: string) {
    const { data: properties, error } = await this.supabase.admin
      .from('properties')
      .select('id, title, view_count')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    if (!properties || properties.length === 0) return [];

    const ids = properties.map((property) => property.id);

    const [eventsResult, clicksResult] = await Promise.all([
      this.supabase.admin
        .from('property_view_events')
        .select('property_id, duration_seconds')
        .in('property_id', ids)
        .not('duration_seconds', 'is', null),
      this.supabase.admin
        .from('media')
        .select('property_id, click_count')
        .in('property_id', ids)
        .in('type', ['external_video', 'tour_3d']),
    ]);

    if (eventsResult.error) {
      throw new InternalServerErrorException(eventsResult.error.message);
    }
    if (clicksResult.error) {
      throw new InternalServerErrorException(clicksResult.error.message);
    }

    const dwell = new Map<string, { sum: number; count: number }>();
    for (const event of eventsResult.data ?? []) {
      const entry = dwell.get(event.property_id) ?? { sum: 0, count: 0 };
      entry.sum += Number(event.duration_seconds);
      entry.count += 1;
      dwell.set(event.property_id, entry);
    }

    const clicks = new Map<string, number>();
    for (const media of clicksResult.data ?? []) {
      clicks.set(
        media.property_id,
        (clicks.get(media.property_id) ?? 0) + media.click_count,
      );
    }

    return properties.map((property) => {
      const entry = dwell.get(property.id);
      return {
        propertyId: property.id,
        title: property.title,
        totalViews: property.view_count,
        avgDurationSeconds:
          entry && entry.count > 0 ? Math.round(entry.sum / entry.count) : null,
        videoClicks: clicks.get(property.id) ?? 0,
      };
    });
  }

  /** Admin 後台巡邏：全部物件（所有狀態、含房仲資訊） */
  async findAllForAdmin(page: number, pageSize: number) {
    const from = (page - 1) * pageSize;

    const { data, error, count } = await this.supabase.admin
      .from('properties')
      .select('*, agent:profiles(id, display_name, full_name, agency_name)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new InternalServerErrorException(error.message);
    return { items: data, total: count ?? 0, page, pageSize };
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.admin
      .from('properties')
      .select('*, media(*), agent:profiles(id, display_name, avatar_url, agency_name, bio, phone, social_links)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Property ${id} not found`);
    return data;
  }

  /**
   * 簡易數據追蹤（PRD 三指標之二）：
   * 無 duration → 總瀏覽量 +1；有 duration → 記錄停留時間事件
   */
  async trackView(id: string, durationSeconds?: number) {
    if (durationSeconds === undefined) {
      const { error } = await this.supabase.admin.rpc('increment_view_count', {
        property: id,
      });
      if (error) throw new InternalServerErrorException(error.message);
      return;
    }

    const { error } = await this.supabase.admin.rpc('record_view_duration', {
      property: id,
      seconds: durationSeconds,
    });
    if (error) throw new InternalServerErrorException(error.message);
  }

  async create(agentId: string, dto: CreatePropertyDto) {
    const { data, error } = await this.supabase.admin
      .from('properties')
      .insert({ agent_id: agentId, ...toRow(dto) })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async update(agentId: string, id: string, dto: UpdatePropertyDto) {
    await this.assertOwnership(agentId, id);

    const { data, error } = await this.supabase.admin
      .from('properties')
      .update(toRow(dto))
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** 房仲上架：寫入 listed_at 作為 Days on Market 起算點 */
  async publish(agentId: string, id: string) {
    return this.changeStatus(agentId, id, 'published');
  }

  /** 房仲切換物件狀態（上架 / 隱藏 / 下架 / 成交 / 回草稿） */
  async changeStatus(agentId: string, id: string, status: string) {
    await this.assertOwnership(agentId, id);

    const patch: Record<string, unknown> = { status };
    if (status === 'published') {
      patch.listed_at = new Date().toISOString();
      patch.delisted_at = null;
      patch.delist_reason = null;
    }
    if (status === 'delisted') {
      patch.delisted_at = new Date().toISOString();
      patch.delist_reason = 'agent_action';
    }

    const { data, error } = await this.supabase.admin
      .from('properties')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** 總管理員強制下架異常/違規物件 */
  async forceDelist(id: string, reason = 'admin_force') {
    const { data, error } = await this.supabase.admin
      .from('properties')
      .update({
        status: 'delisted',
        delisted_at: new Date().toISOString(),
        delist_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  private async assertOwnership(agentId: string, propertyId: string) {
    const { data, error } = await this.supabase.admin
      .from('properties')
      .select('agent_id')
      .eq('id', propertyId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Property ${propertyId} not found`);
    if (data.agent_id !== agentId) {
      throw new ForbiddenException('You can only manage your own listings');
    }
  }
}

/** camelCase DTO → snake_case DB row */
function toRow(dto: CreatePropertyDto | UpdatePropertyDto) {
  const map: Record<string, string> = {
    title: 'title',
    description: 'description',
    price: 'price',
    city: 'city',
    district: 'district',
    address: 'address',
    areaSqft: 'area_sqft',
    beds: 'beds',
    baths: 'baths',
    propertyType: 'property_type',
    hasParking: 'has_parking',
    schoolDistrict: 'school_district',
    transitNotes: 'transit_notes',
    floodZone: 'flood_zone',
    terrainNotes: 'terrain_notes',
    builderName: 'builder_name',
    builderReputation: 'builder_reputation',
    fengShuiOrientation: 'feng_shui_orientation',
    fengShuiNotes: 'feng_shui_notes',
    materialGrade: 'material_grade',
    basementStatus: 'basement_status',
    customAttributes: 'custom_attributes',
    scoreSchool: 'score_school',
    scoreTransit: 'score_transit',
    scoreMaterial: 'score_material',
    scoreFengShui: 'score_feng_shui',
    scoreEnvironment: 'score_environment',
  };

  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(map)) {
    const value = (dto as Record<string, unknown>)[key];
    if (value !== undefined) row[column] = value;
  }
  return row;
}
