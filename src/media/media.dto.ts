import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
} from 'class-validator';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  VOICE_NOTE = 'voice_note',
}

export class MediaMetadataDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsEnum(MediaType)
  @IsNotEmpty()
  type: MediaType;

  @IsNumber()
  @IsNotEmpty()
  size: number;

  @IsOptional()
  @IsNumber()
  duration?: number; // in seconds, for audio/video

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  width?: number; // for images/videos

  @IsOptional()
  @IsNumber()
  height?: number; // for images/videos
}

export class UploadMediaDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsEnum(MediaType)
  @IsNotEmpty()
  type: MediaType;

  @IsString()
  @IsNotEmpty()
  base64: string; // base64 encoded file data

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class MediaResponseDto {
  id: string;
  url: string;
  filename: string;
  type: MediaType;
  size: number;
  duration?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  uploadedAt: Date;
  expiresAt?: Date;
}

export class SendMediaMessageDto {
  @IsString()
  @IsNotEmpty()
  mediaId: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  receiverId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}
