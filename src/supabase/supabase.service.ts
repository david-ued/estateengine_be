import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    // admin client：繞過 RLS，僅限後端使用，切勿外流
    // 支援新版 API key（SUPABASE_SECRET_KEY，sb_secret_...）與舊版 service_role JWT
    const secretKey =
      config.get<string>('SUPABASE_SECRET_KEY') ??
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      secretKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }

  get admin(): SupabaseClient {
    return this.client;
  }
}
