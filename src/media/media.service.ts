import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { MediaType, UploadMediaDto, MediaResponseDto } from './media.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger('MediaService');
  private readonly uploadDir = path.join(process.cwd(), 'uploads/media');
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB

  // Allowed MIME types by media type
  private readonly allowedMimeTypes = {
    [MediaType.IMAGE]: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    [MediaType.VIDEO]: [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
    ],
    [MediaType.AUDIO]: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
    [MediaType.VOICE_NOTE]: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
    ],
    [MediaType.DOCUMENT]: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  };

  constructor() {
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  uploadMedia(
    userId: string,
    uploadMediaDto: UploadMediaDto,
  ): MediaResponseDto {
    // Validate file size
    const buffer = Buffer.from(uploadMediaDto.base64, 'base64');
    if (buffer.length > this.maxFileSize) {
      throw new BadRequestException('File size exceeds maximum limit of 50MB');
    }

    // Validate MIME type
    const allowedTypes = this.allowedMimeTypes[uploadMediaDto.type];
    if (
      uploadMediaDto.mimeType &&
      !allowedTypes.includes(uploadMediaDto.mimeType)
    ) {
      throw new BadRequestException(
        `Invalid MIME type for ${uploadMediaDto.type}. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Generate unique filename
    const mediaId = uuidv4();
    const ext = this.getFileExtension(uploadMediaDto.filename);
    const filename = `${mediaId}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    // Save file
    try {
      fs.writeFileSync(filepath, buffer);
      this.logger.log(`Media uploaded: ${filename} by user ${userId}`);

      return this.formatMediaResponse(
        mediaId,
        filename,
        uploadMediaDto,
        buffer.length,
      );
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save media: ${errorMsg}`);
      throw new BadRequestException('Failed to upload media');
    }
  }

  getMedia(mediaId: string): Buffer {
    // Find file with mediaId prefix
    const files = fs.readdirSync(this.uploadDir);
    const file = files.find((f) => f.startsWith(mediaId));

    if (!file) {
      throw new NotFoundException('Media not found');
    }

    const filepath = path.join(this.uploadDir, file);
    try {
      return fs.readFileSync(filepath);
    } catch {
      throw new NotFoundException('Failed to read media file');
    }
  }

  deleteMedia(mediaId: string, userId?: string): void {
    const files = fs.readdirSync(this.uploadDir);
    const file = files.find((f) => f.startsWith(mediaId));

    if (!file) {
      throw new NotFoundException('Media not found');
    }

    const filepath = path.join(this.uploadDir, file);
    try {
      fs.unlinkSync(filepath);
      this.logger.log(
        `Media deleted: ${file}${userId ? ` by user ${userId}` : ''}`,
      );
    } catch {
      throw new BadRequestException('Failed to delete media');
    }
  }

  getMediaMetadata(mediaId: string): {
    mediaId: string;
    filename: string;
    size: number;
    uploadedAt: Date;
  } {
    const files = fs.readdirSync(this.uploadDir);
    const file = files.find((f) => f.startsWith(mediaId));

    if (!file) {
      throw new NotFoundException('Media not found');
    }

    const filepath = path.join(this.uploadDir, file);
    const stats = fs.statSync(filepath);

    return {
      mediaId,
      filename: file,
      size: stats.size,
      uploadedAt: stats.birthtime,
    };
  }

  private getFileExtension(filename: string): string {
    const ext = path.extname(filename);
    return ext || '.bin';
  }

  private formatMediaResponse(
    mediaId: string,
    filename: string,
    uploadMediaDto: UploadMediaDto,
    size: number,
  ): MediaResponseDto {
    return {
      id: mediaId,
      url: `/media/${mediaId}`,
      filename,
      type: uploadMediaDto.type,
      size,
      duration: uploadMediaDto.duration,
      mimeType: uploadMediaDto.mimeType,
      uploadedAt: new Date(),
    };
  }

  // Helper method to get MIME type from filename
  getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mpeg': 'video/mpeg',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
