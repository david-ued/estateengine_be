import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../auth/user-role.enum';
import { AiService } from './ai.service';
import { ParseListingDto } from './dto/parse-listing.dto';

@Controller('ai')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.AGENT)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** 剩餘點數與單次成本 */
  @Get('tokens')
  tokens(@CurrentUser() user: User) {
    return this.ai.getBalance(user.id);
  }

  /** AI 解析建檔（扣點） */
  @Post('parse-listing')
  parse(@CurrentUser() user: User, @Body() dto: ParseListingDto) {
    return this.ai.parseListing(user.id, dto);
  }
}
