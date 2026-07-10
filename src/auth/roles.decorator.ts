import { SetMetadata } from '@nestjs/common';
import { UserRole } from './user-role.enum';

export const ROLES_KEY = 'roles';

/** 標注端點允許的角色，需搭配 SupabaseAuthGuard + RolesGuard 使用 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
