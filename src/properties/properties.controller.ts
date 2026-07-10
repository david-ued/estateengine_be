import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../auth/user-role.enum';
import { CreatePropertyDto } from './dto/create-property.dto';
import {
  ChangeStatusDto,
  QueryPropertiesDto,
  TrackViewDto,
} from './dto/query-properties.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  // --- 公開端點（買家瀏覽，無需登入） ---

  @Get()
  list(@Query() query: QueryPropertiesDto) {
    return this.properties.findPublished(query);
  }

  // 靜態路由需宣告在 :id 之前，否則會被 ParseUUIDPipe 擋下
  @Get('mine')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  mine(@CurrentUser() user: User) {
    return this.properties.findMine(user.id);
  }

  /** 簡易數據追蹤面板：總瀏覽量 / 平均停留時間 / 影片點擊 */
  @Get('mine/stats')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  mineStats(@CurrentUser() user: User) {
    return this.properties.getMineStats(user.id);
  }

  @Get('admin/all')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  adminAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.properties.findAllForAdmin(page, pageSize);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.findOne(id);
  }

  @Post(':id/view')
  async trackView(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TrackViewDto,
  ) {
    await this.properties.trackView(id, dto.durationSeconds);
    return { ok: true };
  }

  // --- 房仲端點（上架 / 編輯個人物件） ---

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  create(@CurrentUser() user: User, @Body() dto: CreatePropertyDto) {
    return this.properties.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.update(user.id, id, dto);
  }

  @Post(':id/publish')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  publish(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.properties.publish(user.id, id);
  }

  /** 上架 / 隱藏 / 下架 / 成交 / 回草稿 */
  @Post(':id/status')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  changeStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.properties.changeStatus(user.id, id, dto.status);
  }

  // --- 總管理員端點（後台巡邏、強制下架） ---

  @Post(':id/force-delist')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  forceDelist(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.forceDelist(id);
  }
}
