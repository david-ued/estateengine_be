import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CreateSavedSearchDto,
  UpdateSavedSearchDto,
} from './dto/saved-search.dto';
import { SavedSearchesService } from './saved-searches.service';

/** 買家儲存搜尋條件（Save Search） */
@Controller('saved-searches')
@UseGuards(SupabaseAuthGuard)
export class SavedSearchesController {
  constructor(private readonly savedSearches: SavedSearchesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.savedSearches.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateSavedSearchDto) {
    return this.savedSearches.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedSearchDto,
  ) {
    return this.savedSearches.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.savedSearches.remove(user.id, id);
  }
}
