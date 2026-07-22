import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const PRE_APPROVAL_STATUSES = [
  'none',
  'in_progress',
  'approved',
] as const;
export type PreApprovalStatus = (typeof PRE_APPROVAL_STATUSES)[number];

export const INTEREST_DECISIONS = [
  'considering',
  'locked_in',
  'walked_away',
] as const;
export type InterestDecision = (typeof INTEREST_DECISIONS)[number];

/**
 * 買家自行申報財務準備度（帳號中心「購屋準備」）。
 * PUT 語意：整份覆寫，未帶的欄位回到預設 / 清空；agent_note 不開放買家寫入。
 */
export class UpsertMyProspectDto {
  @IsOptional()
  @IsIn(PRE_APPROVAL_STATUSES)
  preApprovalStatus?: PreApprovalStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preApprovalAmount?: number;

  @IsOptional()
  @IsBoolean()
  proofOfFunds?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  buyerNote?: string;
}

/** 買家對單一物件表態：lock-in（請 agent 洽談）/ walk away（先跳過） */
export class SetMyInterestDto {
  @IsIn(INTEREST_DECISIONS)
  decision!: InterestDecision;
}

/**
 * Agent 於 CRM 更新買家財務註記。
 * PATCH 語意：只更新有帶的欄位；agentNote 傳空字串 = 清空、
 * preApprovalAmount 傳 0 = 清空（0 不是有意義的預批額度）。
 */
export class AgentUpdateProspectDto {
  @IsOptional()
  @IsIn(PRE_APPROVAL_STATUSES)
  preApprovalStatus?: PreApprovalStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preApprovalAmount?: number;

  @IsOptional()
  @IsBoolean()
  proofOfFunds?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  agentNote?: string;
}

/** Agent 對「買家 × 物件」註記：Act Fast（先與賣家洽談）/ 私人備註 / 代為表態 */
export class AgentUpsertInterestDto {
  @IsOptional()
  @IsBoolean()
  actFast?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agentNote?: string;

  @IsOptional()
  @IsIn(INTEREST_DECISIONS)
  decision?: InterestDecision;
}
