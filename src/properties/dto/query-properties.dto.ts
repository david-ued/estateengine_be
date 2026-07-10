import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** 房仲可自行切換的物件狀態（強制下架 admin_force 走 Admin 端點） */
export const AGENT_STATUSES = ['draft', 'published', 'hidden', 'delisted', 'sold'] as const;

export class ChangeStatusDto {
  @IsIn(AGENT_STATUSES)
  status!: (typeof AGENT_STATUSES)[number];
}

// PRD：列表頁一次最多顯示 6-7 個物件
export const DEFAULT_PAGE_SIZE = 6;

export class TrackViewDto {
  /** 買家離開內頁時回報停留秒數；不帶則視為單純 pageview */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationSeconds?: number;
}

export class QueryPropertiesDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSqft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSqft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  beds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baths?: number;

  /** 新鮮度：只回傳上市 N 天內的物件（PRD 專注 20-30 天內新鮮物件） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  freshWithinDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
