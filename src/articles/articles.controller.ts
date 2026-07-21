import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { ArticlesService } from './articles.service';
import {
  CreateArticleDto,
  QueryArticlesDto,
  UpdateArticleDto,
} from './dto/article.dto';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  // --- 公開端點（部落格列表 / 內頁，無需登入） ---

  @Get()
  list(@Query() query: QueryArticlesDto) {
    return this.articles.findPublished(query);
  }

  // 靜態路由需宣告在 :slug 之前
  @Get('mine')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  mine(@CurrentUser() user: User) {
    return this.articles.findMine(user.id);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.articles.findBySlug(slug);
  }

  // --- 房仲端點（撰寫 / 編輯專欄） ---

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  create(@CurrentUser() user: User, @Body() dto: CreateArticleDto) {
    return this.articles.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articles.update(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.articles.remove(user.id, id);
  }
}
