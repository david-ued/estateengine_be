import { IsIn } from 'class-validator';

/** Admin 可指派任一角色（唯一限制：不能改自己的角色，避免鎖死後台） */
export class UpdateRoleDto {
  @IsIn(['buyer', 'agent', 'super_admin'])
  role!: 'buyer' | 'agent' | 'super_admin';
}
