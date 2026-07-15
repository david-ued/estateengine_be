import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { FavoritesService } from './favorites.service';

/** 買家收藏（登入即可，不限角色） */
@Controller('favorites')
@UseGuards(SupabaseAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.favorites.list(user.id);
  }

  @Get('ids')
  listIds(@CurrentUser() user: User) {
    return this.favorites.listIds(user.id);
  }

  @Put(':propertyId')
  add(
    @CurrentUser() user: User,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.favorites.add(user.id, propertyId);
  }

  @Delete(':propertyId')
  remove(
    @CurrentUser() user: User,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.favorites.remove(user.id, propertyId);
  }
}
