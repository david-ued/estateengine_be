import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { invalidateRoleCache } from '../auth/roles.guard';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Admin 後台：使用者列表（可依角色篩選） */
  async list(page: number, pageSize: number, role?: string) {
    const from = (page - 1) * pageSize;

    let builder = this.supabase.admin
      .from('profiles')
      .select('id, email, full_name, display_name, role, agency_name, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (role) builder = builder.eq('role', role);

    const { data, error, count } = await builder;
    if (error) throw new InternalServerErrorException(error.message);

    return { items: data, total: count ?? 0, page, pageSize };
  }

  /** Admin 設定任一使用者的角色（buyer / agent / super_admin）；不能改自己以免鎖死後台 */
  async updateRole(
    actorId: string,
    userId: string,
    role: 'buyer' | 'agent' | 'super_admin',
  ) {
    if (actorId === userId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const { data: target, error } = await this.supabase.admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!target) throw new NotFoundException(`User ${userId} not found`);

    const { data, error: updateError } = await this.supabase.admin
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('id, email, full_name, role')
      .single();

    if (updateError) throw new InternalServerErrorException(updateError.message);

    invalidateRoleCache(userId);
    return data;
  }
}
