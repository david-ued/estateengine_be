import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { invalidateRoleCache } from '../auth/roles.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';

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

  /** Admin 新增用戶：建立 Auth 帳號（email 已驗證）→ trigger 建 profile → 指派角色 */
  async create(dto: CreateUserDto) {
    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: dto.fullName ? { full_name: dto.fullName } : undefined,
    });
    if (error) throw new BadRequestException(error.message);

    const userId = data.user.id;
    if (dto.role && dto.role !== 'buyer') {
      const { error: roleError } = await this.supabase.admin
        .from('profiles')
        .update({ role: dto.role })
        .eq('id', userId);
      if (roleError) throw new InternalServerErrorException(roleError.message);
    }

    return { id: userId, email: dto.email, role: dto.role ?? 'buyer' };
  }

  /** Admin 刪除用戶：不能刪自己；名下還有物件的房仲要先處理物件 */
  async remove(actorId: string, userId: string) {
    if (actorId === userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const { count, error: countError } = await this.supabase.admin
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', userId);
    if (countError) throw new InternalServerErrorException(countError.message);
    if ((count ?? 0) > 0) {
      throw new ConflictException(
        'User still owns listings — delete or reassign them first',
      );
    }

    // Auth 刪除後 profiles / 相關資料由 FK cascade 清理
    const { error } = await this.supabase.admin.auth.admin.deleteUser(userId);
    if (error) throw new InternalServerErrorException(error.message);

    invalidateRoleCache(userId);
    return { ok: true };
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
