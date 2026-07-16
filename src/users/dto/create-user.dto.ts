import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Admin（唯一 agent）直接建立用戶（email 立即標記為已驗證，不寄驗證信） */
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  fullName?: string;

  @IsOptional()
  @IsIn(['buyer', 'agent'])
  role?: 'buyer' | 'agent';
}
