import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateSiteSettingsDto {
  /** 首頁品牌內容（hero 文案 / 統計數字 / 核心價值），結構由前端定義 */
  @IsObject()
  data!: Record<string, unknown>;
}

/** 單一 agent 的品牌名片（About / 首頁 / 名片區塊共用） */
export class UpdateAgentProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  agencyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenseNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contactLineId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  avatarUrl?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}
