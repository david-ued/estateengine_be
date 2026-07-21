import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 公開表單送出（rate limit 由 throttler 控管） */
  async submit(dto: CreateContactMessageDto) {
    const { error } = await this.supabase.admin
      .from('contact_messages')
      .insert({
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        message: dto.message,
        property_id: dto.propertyId ?? null,
        locale: dto.locale ?? null,
        casl_consent_at: dto.caslConsent ? new Date().toISOString() : null,
      });

    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  /** Agent 收件匣：訊息列表 + 未讀數（帶物件標題方便對照） */
  async inbox(page: number, pageSize: number) {
    const from = (page - 1) * pageSize;

    const [listResult, unreadResult] = await Promise.all([
      this.supabase.admin
        .from('contact_messages')
        .select('*, property:properties(id, title)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1),
      this.supabase.admin
        .from('contact_messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false),
    ]);

    if (listResult.error) {
      throw new InternalServerErrorException(listResult.error.message);
    }
    if (unreadResult.error) {
      throw new InternalServerErrorException(unreadResult.error.message);
    }

    return {
      items: listResult.data,
      total: listResult.count ?? 0,
      unread: unreadResult.count ?? 0,
      page,
      pageSize,
    };
  }

  async markRead(id: string, isRead: boolean) {
    const { data, error } = await this.supabase.admin
      .from('contact_messages')
      .update({ is_read: isRead })
      .eq('id', id)
      .select('id, is_read')
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Message ${id} not found`);
    return data;
  }
}
