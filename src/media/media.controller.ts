import {
  Body,
  Controller,
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
import {
  RegisterExternalMediaDto,
  RegisterUploadedMediaDto,
  SignUploadDto,
} from './dto/register-media.dto';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** 取得 signed upload URL（照片 / 短影音直傳 Storage 用） */
  @Post('sign-upload')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  signUpload(@CurrentUser() user: User, @Body() dto: SignUploadDto) {
    return this.media.createSignedUploadUrl(
      user.id,
      dto.propertyId,
      dto.fileName,
      dto.mimeType,
      dto.fileSizeBytes,
    );
  }

  /** 嵌入外部影片 / 3D 導覽（YouTube, Vimeo, Matterport） */
  @Post('external')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  registerExternal(
    @CurrentUser() user: User,
    @Body() dto: RegisterExternalMediaDto,
  ) {
    return this.media.registerExternal(user.id, dto);
  }

  /** Storage 直傳完成後登記 media row */
  @Post('uploaded')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.AGENT)
  registerUploaded(
    @CurrentUser() user: User,
    @Body() dto: RegisterUploadedMediaDto,
  ) {
    return this.media.registerUploaded(user.id, dto);
  }

  /** 公開端點：買家點擊外部影片/3D 導覽時計數 */
  @Post(':id/click')
  async trackClick(@Param('id', ParseUUIDPipe) id: string) {
    await this.media.trackClick(id);
    return { ok: true };
  }
}
