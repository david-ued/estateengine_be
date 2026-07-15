import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateSavedSearchDto,
  UpdateSavedSearchDto,
} from './dto/saved-search.dto';

const MAX_SAVED_SEARCHES = 20;

@Injectable()
export class SavedSearchesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(userId: string) {
    const { data, error } = await this.supabase.admin
      .from('saved_searches')
      .select('id, name, params, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async create(userId: string, dto: CreateSavedSearchDto) {
    const { count, error: countError } = await this.supabase.admin
      .from('saved_searches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw new InternalServerErrorException(countError.message);
    if ((count ?? 0) >= MAX_SAVED_SEARCHES) {
      throw new BadRequestException(
        `Saved search limit reached (${MAX_SAVED_SEARCHES})`,
      );
    }

    const { data, error } = await this.supabase.admin
      .from('saved_searches')
      .insert({ user_id: userId, name: dto.name, params: dto.params })
      .select('id, name, params, created_at, updated_at')
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async update(userId: string, id: string, dto: UpdateSavedSearchDto) {
    await this.assertOwnership(userId, id);

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.params !== undefined) patch.params = dto.params;

    const { data, error } = await this.supabase.admin
      .from('saved_searches')
      .update(patch)
      .eq('id', id)
      .select('id, name, params, created_at, updated_at')
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    const { error } = await this.supabase.admin
      .from('saved_searches')
      .delete()
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  private async assertOwnership(userId: string, id: string) {
    const { data, error } = await this.supabase.admin
      .from('saved_searches')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data || data.user_id !== userId) {
      throw new NotFoundException(`Saved search ${id} not found`);
    }
  }
}
