import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/** Persona 範本（公開）：買家權重面板一鍵套用；FE 目前有常數 fallback */
@Controller('personas')
export class PersonasController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async list() {
    const { data, error } = await this.supabase.admin
      .from('persona_templates')
      .select('code, name, description, weights, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }
}
