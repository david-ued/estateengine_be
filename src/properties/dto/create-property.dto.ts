import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const ORIENTATIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const BASEMENT_STATUSES = ['none', 'storage', 'livable', 'parking'] as const;

export class CreatePropertyDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // --- 標準欄位（搜尋 Filter 對象） ---
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSqft!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  beds!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  baths!: number;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsBoolean()
  hasParking?: boolean;

  // --- 獨家數據建檔（巨觀：交通/學區/淹水區/地勢；微觀：風水/建商/建材/地下室） ---
  @IsOptional()
  @IsString()
  schoolDistrict?: string;

  @IsOptional()
  @IsString()
  transitNotes?: string;

  @IsOptional()
  @IsBoolean()
  floodZone?: boolean;

  @IsOptional()
  @IsString()
  terrainNotes?: string;

  @IsOptional()
  @IsString()
  builderName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  builderReputation?: number;

  @IsOptional()
  @IsIn(ORIENTATIONS)
  fengShuiOrientation?: (typeof ORIENTATIONS)[number];

  @IsOptional()
  @IsString()
  fengShuiNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  materialGrade?: number;

  @IsOptional()
  @IsIn(BASEMENT_STATUSES)
  basementStatus?: (typeof BASEMENT_STATUSES)[number];

  @IsOptional()
  @IsObject()
  customAttributes?: Record<string, unknown>;

  // --- 權重評分系統的維度分數（0-100，房仲自評） ---
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  scoreSchool?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  scoreTransit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  scoreMaterial?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  scoreFengShui?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  scoreEnvironment?: number;
}
