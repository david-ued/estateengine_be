import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../auth/user-role.enum';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { ShareLinksService } from './share-links.service';

@Controller('share-links')
export class ShareLinksController {
  constructor(private readonly shareLinks: ShareLinksService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  create(@CurrentUser() user: User, @Body() dto: CreateShareLinkDto) {
    return this.shareLinks.create(user.id, dto);
  }

  @Get('mine')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  mine(@CurrentUser() user: User) {
    return this.shareLinks.findMine(user.id);
  }

  /** 公開端點：推薦清單頁與 OG 解析（slug 非 UUID，需宣告在最後） */
  @Get(':slug')
  resolve(@Param('slug') slug: string) {
    return this.shareLinks.resolveBySlug(slug);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.shareLinks.remove(user.id, id);
  }
}
