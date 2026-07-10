import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';

/** 外部嵌入媒體：影片/3D 導覽用外部連結，節省伺服器成本 */
export class RegisterExternalMediaDto {
  @IsUUID()
  propertyId!: string;

  @IsIn(['external_video', 'tour_3d'])
  type!: 'external_video' | 'tour_3d';

  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** 取得 Storage signed upload URL（上傳前驗證格式與大小） */
export class SignUploadDto {
  @IsUUID()
  propertyId!: string;

  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSizeBytes!: number;
}

/** 上傳完成後登記 Storage 內的媒體檔 */
export class RegisterUploadedMediaDto {
  @IsUUID()
  propertyId!: string;

  @IsIn(['image', 'reel_video', 'virtual_staging_image', 'floor_plan'])
  type!: 'image' | 'reel_video' | 'virtual_staging_image' | 'floor_plan';

  @IsString()
  storagePath!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSizeBytes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}
