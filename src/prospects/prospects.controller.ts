import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../auth/user-role.enum';
import {
  AgentUpdateProspectDto,
  AgentUpsertInterestDto,
  SetMyInterestDto,
  UpsertMyProspectDto,
} from './dto/prospect.dto';
import { ProspectsService } from './prospects.service';

/**
 * Prospect CRM。/me/* 為買家自助（登入即可）；其餘為 agent 專用。
 * 注意：/me 路由必須宣告在 /:userId 之前，避免被萬用參數吃掉。
 */
@Controller('prospects')
@UseGuards(SupabaseAuthGuard)
export class ProspectsController {
  constructor(private readonly prospects: ProspectsService) {}

  // ---------- 買家自助（帳號中心「購屋準備」） ----------

  @Get('me')
  myProspect(@CurrentUser() user: User) {
    return this.prospects.getMyProspect(user.id);
  }

  @Put('me')
  upsertMyProspect(
    @CurrentUser() user: User,
    @Body() dto: UpsertMyProspectDto,
  ) {
    return this.prospects.upsertMyProspect(user.id, dto);
  }

  @Get('me/interests')
  myInterests(@CurrentUser() user: User) {
    return this.prospects.listMyInterests(user.id);
  }

  @Put('me/interests/:propertyId')
  setMyInterest(
    @CurrentUser() user: User,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: SetMyInterestDto,
  ) {
    return this.prospects.setMyInterest(user.id, propertyId, dto.decision);
  }

  // ---------- Agent CRM ----------

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  list() {
    return this.prospects.listProspects();
  }

  @Get(':userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  detail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.prospects.getProspect(userId);
  }

  @Patch(':userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AgentUpdateProspectDto,
  ) {
    return this.prospects.agentUpdateProspect(userId, dto);
  }

  @Put(':userId/interests/:propertyId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  upsertInterest(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AgentUpsertInterestDto,
  ) {
    return this.prospects.agentUpsertInterest(userId, propertyId, dto);
  }
}
