import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { MessageStatus } from '@prisma/client';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  @IsOptional()
  receiverId?: string;

  @IsUUID()
  @IsOptional()
  groupId?: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  mediaType?: 'image' | 'video' | 'audio' | 'document';

  @IsOptional()
  mediaSize?: number;

  @IsOptional()
  mediaDuration?: number;
}

export class UpdateMessageStatusDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  status: MessageStatus;
}

export class MessageDto {
  id: string;
  content: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  status: MessageStatus;
  mediaUrl?: string;
  mediaType?: string;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class WebSocketMessageDto {
  event: string;
  data: any;
  timestamp: Date;
}

export class MessageReactionDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  reaction: string; // emoji or reaction type

  @IsString()
  @IsOptional()
  action: 'add' | 'remove';
}

export class ForwardMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string;

  @IsUUID()
  @IsOptional()
  targetUserId?: string;

  @IsUUID()
  @IsOptional()
  targetGroupId?: string;
}

export class ReplyToMessageDto extends CreateMessageDto {
  @IsUUID()
  @IsNotEmpty()
  replyToId: string;
}
