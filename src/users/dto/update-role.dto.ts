import { IsIn } from 'class-validator';

/** Admin 可指派 buyer / agent（唯一限制：不能改自己的角色，避免鎖死後台） */
export class UpdateRoleDto {
  @IsIn(['buyer', 'agent'])
  role!: 'buyer' | 'agent';
}
