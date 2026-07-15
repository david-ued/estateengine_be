import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './user-role.enum';
import type { AuthenticatedRequest } from './supabase-auth.guard';

// 角色查詢快取：避免每個請求都打一次 DB。
// 單一 agent 轉向後角色不再於執行期變更（僅 DB 手動調整），TTL 過期即收斂。
const ROLE_CACHE_TTL_MS = 30_000;
const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Authenticate before role check');
    }

    const role = await this.resolveRole(request.user.id);

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }

  private async resolveRole(userId: string): Promise<UserRole> {
    const cached = roleCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.role;

    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new ForbiddenException('Profile not found');
    }

    const role = data.role as UserRole;
    roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
    return role;
  }
}
