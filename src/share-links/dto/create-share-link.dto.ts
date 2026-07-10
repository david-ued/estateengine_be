import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateShareLinkDto {
  /** 清單內的物件（依陣列順序排序） */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  propertyIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  // 房仲自訂社群分享 OG 標籤
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ogTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  ogDescription?: string;

  @IsOptional()
  @IsString()
  ogImagePath?: string;
}
