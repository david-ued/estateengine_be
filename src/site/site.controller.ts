import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../auth/user-role.enum';
import { UpdateAgentProfileDto, UpdateSiteSettingsDto } from './dto/site.dto';
import { SiteService } from './site.service';

@Controller('site')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  /** 公開：首頁 / About / 名片區塊共用的站台資料 */
  @Get()
  getSite() {
    return this.site.getSite();
  }

  @Put('settings')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  updateSettings(@Body() dto: UpdateSiteSettingsDto) {
    return this.site.updateSettings(dto);
  }

  @Patch('profile')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  updateAgentProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateAgentProfileDto,
  ) {
    return this.site.updateAgentProfile(user.id, dto);
  }
}
