import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSavedSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  /** 列表頁 query string 的鍵值（city / minPrice / beds / sort ...） */
  @IsObject()
  params!: Record<string, unknown>;
}

export class UpdateSavedSearchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
