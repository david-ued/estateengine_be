import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  /** 由物件內頁「詢問此物件」發起時帶入 */
  @IsOptional()
  @IsUUID('4')
  propertyId?: string;

  @IsOptional()
  @IsIn(['zh-TW', 'en'])
  locale?: string;
}
