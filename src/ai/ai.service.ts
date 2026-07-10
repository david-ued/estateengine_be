import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ParseListingDto } from './dto/parse-listing.dto';

/** 每次 AI 解析扣除的平台 Token 點數 */
export const AI_PARSE_COST = 5;

const PARSE_PROMPT = `You are a real-estate listing parser for the Canadian market (Edmonton / Vancouver / Toronto).
Extract listing fields from the provided text and/or image (may be Chinese or English, e.g. MLS descriptions or screenshots).
Return ONLY a JSON object with these keys (use null when unknown, never invent data):
title (string), description (string), price (number, CAD), city (one of "Edmonton","Vancouver","Toronto"),
district (string), address (string), areaSqft (number), beds (integer), baths (integer),
propertyType (one of "house","condo","townhouse","apartment"),
schoolDistrict (string), transitNotes (string), floodZone (boolean), terrainNotes (string),
fengShuiOrientation (one of "N","NE","E","SE","S","SW","W","NW"), fengShuiNotes (string),
builderName (string), builderReputation (integer 1-5), materialGrade (integer 1-5),
basementStatus (one of "none","storage","livable","parking"), residentAgeNotes (string).`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async getBalance(userId: string): Promise<{ balance: number; cost: number }> {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('token_balance')
      .eq('id', userId)
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return { balance: data.token_balance ?? 0, cost: AI_PARSE_COST };
  }

  /** 扣點 → 呼叫 Gemini 解析 → 回傳欄位；解析失敗自動退點 */
  async parseListing(userId: string, dto: ParseListingDto) {
    if (!dto.text && !dto.imageBase64) {
      throw new BadRequestException('Provide text or an image');
    }

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('AI parsing is not configured');
    }

    // 先扣點（原子操作，餘額不足回傳 -1）
    const balance = await this.spendTokens(userId, AI_PARSE_COST, 'ai_parse');
    if (balance < 0) {
      throw new HttpException('Insufficient tokens', 402);
    }

    try {
      const fields = await this.callGemini(apiKey, dto);
      return { fields, balance, cost: AI_PARSE_COST };
    } catch (error) {
      // API 失敗退點，讓房仲能改用手動填寫
      this.logger.error(`Gemini parse failed: ${(error as Error).message}`);
      const refunded = await this.spendTokens(userId, -AI_PARSE_COST, 'refund');
      throw new ServiceUnavailableException(
        `AI parsing failed, tokens refunded (balance: ${refunded})`,
      );
    }
  }

  private async spendTokens(userId: string, amount: number, reason: string) {
    const { data, error } = await this.supabase.admin.rpc('spend_tokens', {
      uid: userId,
      amount,
      reason,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return data as number;
  }

  private async callGemini(apiKey: string, dto: ParseListingDto) {
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';

    const parts: Record<string, unknown>[] = [{ text: PARSE_PROMPT }];
    if (dto.text) parts.push({ text: dto.text });
    if (dto.imageBase64) {
      parts.push({
        inlineData: {
          mimeType: dto.imageMimeType ?? 'image/jpeg',
          data: dto.imageBase64,
        },
      });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    }

    const payload = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    return JSON.parse(text) as Record<string, unknown>;
  }
}
