import { IsIn } from 'class-validator';

/** Admin 可指派的角色（super_admin 僅能由 DB 直接設定） */
export class UpdateRoleDto {
  @IsIn(['buyer', 'agent'])
  role!: 'buyer' | 'agent';
}
