import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { MediaService } from './media.service';
import type { AuthRequest } from '@/auth/auth.request';
import {
  UploadMediaDto,
  SendMediaMessageDto,
  MediaResponseDto,
} from './media.dto';
import { MessagesService } from '@/messages/messages.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private mediaService: MediaService,
    private messagesService: MessagesService,
  ) {}

  @Post('upload')
  uploadMedia(
    @Request() req: AuthRequest,
    @Body() uploadMediaDto: UploadMediaDto,
  ): MediaResponseDto {
    return this.mediaService.uploadMedia(req.user.userId, uploadMediaDto);
  }

  @Get(':mediaId')
  getMedia(@Param('mediaId') mediaId: string, @Res() res: Response): void {
    try {
      const buffer = this.mediaService.getMedia(mediaId);
      const metadata = this.mediaService.getMediaMetadata(mediaId);

      res.setHeader(
        'Content-Type',
        this.mediaService.getMimeType(metadata.filename),
      );
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

      res.send(buffer);
    } catch {
      res.status(404).json({ error: 'Media not found' });
    }
  }

  @Get(':mediaId/metadata')
  getMediaMetadata(@Param('mediaId') mediaId: string): any {
    return this.mediaService.getMediaMetadata(mediaId);
  }

  @Delete(':mediaId')
  deleteMedia(
    @Param('mediaId') mediaId: string,
    @Request() req: AuthRequest,
  ): { message: string } {
    this.mediaService.deleteMedia(mediaId, req.user.userId);
    return { message: 'Media deleted successfully' };
  }

  @Post('send')
  async sendMediaMessage(
    @Request() req: AuthRequest,
    @Body() sendMediaMessageDto: SendMediaMessageDto,
  ): Promise<any> {
    // Create message with media reference
    const message = await this.messagesService.sendMediaMessage(
      req.user.userId,
      sendMediaMessageDto,
    );

    return message;
  }
}
