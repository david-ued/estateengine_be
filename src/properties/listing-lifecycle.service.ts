import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

// PRD：物件上架超過 90 天自動下架/隱藏
const MAX_DAYS_ON_MARKET = 90;

@Injectable()
export class ListingLifecycleService {
  private readonly logger = new Logger(ListingLifecycleService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** 每日 03:00 (Asia/Taipei) 掃描並下架過期物件 */
  @Cron('0 0 3 * * *', { timeZone: 'Asia/Taipei' })
  async delistExpiredListings() {
    const cutoff = new Date(
      Date.now() - MAX_DAYS_ON_MARKET * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await this.supabase.admin
      .from('properties')
      .update({
        status: 'delisted',
        delisted_at: new Date().toISOString(),
        delist_reason: 'expired_90d',
      })
      .eq('status', 'published')
      .lte('listed_at', cutoff)
      .select('id');

    if (error) {
      this.logger.error(`Auto-delist failed: ${error.message}`);
      return;
    }

    this.logger.log(`Auto-delisted ${data?.length ?? 0} expired listings`);
  }
}
