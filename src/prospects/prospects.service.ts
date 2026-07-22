import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AgentUpdateProspectDto,
  AgentUpsertInterestDto,
  InterestDecision,
  UpsertMyProspectDto,
} from './dto/prospect.dto';

// agent_note 僅 agent 可見：買家端點一律用 *_BUYER 欄位集
const FINANCE_FIELDS_BUYER =
  'user_id, pre_approval_status, pre_approval_amount, proof_of_funds, buyer_note, updated_at';
const FINANCE_FIELDS_AGENT = `${FINANCE_FIELDS_BUYER}, agent_note`;

const INTEREST_FIELDS_BUYER =
  'id, property_id, decision, act_fast, decided_at, updated_at';
const INTEREST_FIELDS_AGENT = `${INTEREST_FIELDS_BUYER}, agent_note`;

const INTEREST_PROPERTY_EMBED =
  'property:properties(id, title, status, city, district, price, currency, is_presale)';

/** 買家未申報前的預設狀態（前端表單初始值） */
const DEFAULT_FINANCE = {
  pre_approval_status: 'none',
  pre_approval_amount: null,
  proof_of_funds: false,
  buyer_note: null,
  updated_at: null,
};

@Injectable()
export class ProspectsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ---------- 買家端（帳號中心「購屋準備」） ----------

  async getMyProspect(userId: string) {
    const { data, error } = await this.supabase.admin
      .from('prospect_profiles')
      .select(FINANCE_FIELDS_BUYER)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? { user_id: userId, ...DEFAULT_FINANCE };
  }

  async upsertMyProspect(userId: string, dto: UpsertMyProspectDto) {
    const { data, error } = await this.supabase.admin
      .from('prospect_profiles')
      .upsert(
        {
          user_id: userId,
          pre_approval_status: dto.preApprovalStatus ?? 'none',
          pre_approval_amount: dto.preApprovalAmount ?? null,
          proof_of_funds: dto.proofOfFunds ?? false,
          buyer_note: dto.buyerNote?.trim() || null,
        },
        { onConflict: 'user_id' },
      )
      .select(FINANCE_FIELDS_BUYER)
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async listMyInterests(userId: string) {
    const { data, error } = await this.supabase.admin
      .from('property_interests')
      .select(`${INTEREST_FIELDS_BUYER}, ${INTEREST_PROPERTY_EMBED}`)
      .eq('buyer_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async setMyInterest(
    userId: string,
    propertyId: string,
    decision: InterestDecision,
  ) {
    await this.ensurePropertyExists(propertyId);

    const { data, error } = await this.supabase.admin
      .from('property_interests')
      .upsert(
        {
          buyer_id: userId,
          property_id: propertyId,
          decision,
          decided_at:
            decision === 'considering' ? null : new Date().toISOString(),
        },
        { onConflict: 'buyer_id,property_id' },
      )
      .select(`${INTEREST_FIELDS_BUYER}, ${INTEREST_PROPERTY_EMBED}`)
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  // ---------- Agent 端（Prospect CRM） ----------

  /** CRM 列表：全部買家 + 財務準備度 + 表態彙總（單一 agent 站，量小、記憶體彙總即可） */
  async listProspects() {
    const { data: buyers, error } = await this.supabase.admin
      .from('profiles')
      .select('id, email, full_name, display_name, phone, created_at')
      .eq('role', 'buyer')
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    if (!buyers?.length) return { items: [] };

    const ids = buyers.map((b) => b.id as string);
    const [finances, interests, favorites] = await Promise.all([
      this.supabase.admin
        .from('prospect_profiles')
        .select(FINANCE_FIELDS_AGENT)
        .in('user_id', ids),
      this.supabase.admin
        .from('property_interests')
        .select('buyer_id, decision, act_fast, updated_at')
        .in('buyer_id', ids),
      this.supabase.admin
        .from('favorites')
        .select('user_id, created_at')
        .in('user_id', ids),
    ]);
    for (const res of [finances, interests, favorites]) {
      if (res.error) throw new InternalServerErrorException(res.error.message);
    }

    const financeByUser = new Map(
      (finances.data ?? []).map((f) => [f.user_id as string, f]),
    );
    const items = buyers.map((buyer) => {
      const mine = (interests.data ?? []).filter(
        (i) => i.buyer_id === buyer.id,
      );
      const favs = (favorites.data ?? []).filter((f) => f.user_id === buyer.id);
      const finance = financeByUser.get(buyer.id as string) ?? null;
      const timestamps = [
        ...mine.map((i) => i.updated_at as string),
        ...favs.map((f) => f.created_at as string),
        (finance?.updated_at as string) ?? null,
      ].filter((t): t is string => Boolean(t));

      return {
        ...buyer,
        finance,
        lockedIn: mine.filter((i) => i.decision === 'locked_in').length,
        walkedAway: mine.filter((i) => i.decision === 'walked_away').length,
        actFast: mine.filter((i) => i.act_fast).length,
        favorites: favs.length,
        lastActivity: timestamps.length ? timestamps.sort().at(-1) : null,
      };
    });

    // 有互動的排前面（最後活動新→舊），沒互動的按註冊時間
    items.sort((a, b) =>
      String(b.lastActivity ?? b.created_at ?? '').localeCompare(
        String(a.lastActivity ?? a.created_at ?? ''),
      ),
    );
    return { items };
  }

  /** CRM 明細：買家資料 + 財務準備度（含 agent 備註）+ 表態清單 + 收藏 */
  async getProspect(userId: string) {
    const buyer = await this.ensureBuyerExists(userId);

    const [finance, interests, favorites] = await Promise.all([
      this.supabase.admin
        .from('prospect_profiles')
        .select(FINANCE_FIELDS_AGENT)
        .eq('user_id', userId)
        .maybeSingle(),
      this.supabase.admin
        .from('property_interests')
        .select(`${INTEREST_FIELDS_AGENT}, ${INTEREST_PROPERTY_EMBED}`)
        .eq('buyer_id', userId)
        .order('updated_at', { ascending: false }),
      this.supabase.admin
        .from('favorites')
        .select(
          'created_at, property:properties(id, title, status, city, district, price, currency, is_presale)',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    for (const res of [finance, interests, favorites]) {
      if (res.error) throw new InternalServerErrorException(res.error.message);
    }

    return {
      buyer,
      finance: finance.data ?? {
        user_id: userId,
        ...DEFAULT_FINANCE,
        agent_note: null,
      },
      interests: interests.data ?? [],
      favorites: favorites.data ?? [],
    };
  }

  async agentUpdateProspect(userId: string, dto: AgentUpdateProspectDto) {
    await this.ensureBuyerExists(userId);

    // PATCH：只帶入有提供的欄位（upsert 的 on conflict 只更新 payload 內的欄位）
    const payload: Record<string, unknown> = { user_id: userId };
    if (dto.preApprovalStatus !== undefined) {
      payload.pre_approval_status = dto.preApprovalStatus;
    }
    if (dto.preApprovalAmount !== undefined) {
      payload.pre_approval_amount = dto.preApprovalAmount || null;
    }
    if (dto.proofOfFunds !== undefined) {
      payload.proof_of_funds = dto.proofOfFunds;
    }
    if (dto.agentNote !== undefined) {
      payload.agent_note = dto.agentNote.trim() || null;
    }

    const { data, error } = await this.supabase.admin
      .from('prospect_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select(FINANCE_FIELDS_AGENT)
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Act Fast / 備註 / 代為表態：以「買家 × 物件」upsert，收藏未表態的物件也能直接標記 */
  async agentUpsertInterest(
    userId: string,
    propertyId: string,
    dto: AgentUpsertInterestDto,
  ) {
    await this.ensureBuyerExists(userId);
    await this.ensurePropertyExists(propertyId);

    const payload: Record<string, unknown> = {
      buyer_id: userId,
      property_id: propertyId,
    };
    if (dto.actFast !== undefined) payload.act_fast = dto.actFast;
    if (dto.agentNote !== undefined) {
      payload.agent_note = dto.agentNote.trim() || null;
    }
    if (dto.decision !== undefined) {
      payload.decision = dto.decision;
      payload.decided_at =
        dto.decision === 'considering' ? null : new Date().toISOString();
    }

    const { data, error } = await this.supabase.admin
      .from('property_interests')
      .upsert(payload, { onConflict: 'buyer_id,property_id' })
      .select(`${INTEREST_FIELDS_AGENT}, ${INTEREST_PROPERTY_EMBED}`)
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  // ---------- 共用檢查 ----------

  private async ensurePropertyExists(propertyId: string) {
    const { data, error } = await this.supabase.admin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Property ${propertyId} not found`);
  }

  private async ensureBuyerExists(userId: string) {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('id, email, full_name, display_name, phone, created_at, role')
      .eq('id', userId)
      .eq('role', 'buyer')
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Buyer ${userId} not found`);
    return data;
  }
}
