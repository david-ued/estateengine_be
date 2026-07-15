import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../auth/user-role.enum';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  /** 公開聯絡表單（比全域更嚴的限流：每 IP 每分鐘 5 次） */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(@Body() dto: CreateContactMessageDto) {
    return this.contact.submit(dto);
  }

  // --- Agent 收件匣 ---

  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  inbox(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.contact.inbox(page, pageSize);
  }

  @Patch(':id/read')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('value', new DefaultValuePipe(true), ParseBoolPipe) value: boolean,
  ) {
    return this.contact.markRead(id, value);
  }
}
