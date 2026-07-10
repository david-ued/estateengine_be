import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** AI 快速建檔：貼文字（如 MLS 原文）或上傳截圖，至少擇一 */
export class ParseListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  text?: string;

  /** base64（不含 data: 前綴），大小由 body limit 控制 */
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @IsOptional()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  imageMimeType?: string;
}
