import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateMessageDto, MessageDto } from './messages.dto';
import { SendMediaMessageDto } from '../media/media.dto';
import { MessageStatus, Message } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  // Send a message
  async sendMessage(
    senderId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<MessageDto> {
    const message = await this.prisma.message.create({
      data: {
        content: createMessageDto.content,
        senderId,
        receiverId: createMessageDto.receiverId,
        groupId: createMessageDto.groupId,
        mediaUrl: createMessageDto.mediaUrl,
        mediaType: createMessageDto.mediaType,
        status: MessageStatus.SENT,
      },
    });

    return this.mapToDto(message);
  }

  // Get conversation history between two users
  async getConversation(
    userId: string,
    otherUserId: string,
    limit = 50,
  ): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: userId,
            receiverId: otherUserId,
          },
          {
            senderId: otherUserId,
            receiverId: userId,
          },
        ],
        deletedAt: null, // Exclude soft-deleted messages
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return messages.map((msg) => this.mapToDto(msg));
  }

  // Get group messages
  async getGroupMessages(groupId: string, limit = 50): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        groupId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return messages.map((msg) => this.mapToDto(msg));
  }

  // Update message status
  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
  ): Promise<MessageDto> {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    });

    return this.mapToDto(message);
  }

  // Delete message (soft delete)
  async deleteMessage(messageId: string): Promise<MessageDto> {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return this.mapToDto(message);
  }

  // Edit message
  async editMessage(messageId: string, content: string): Promise<MessageDto> {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        isEdited: true,
        editedAt: new Date(),
      },
    });

    return this.mapToDto(message);
  }

  // Get unread messages for a user
  async getUnreadMessages(userId: string): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        receiverId: userId,
        status: MessageStatus.DELIVERED,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return messages.map((msg) => this.mapToDto(msg));
  }

  // Mark messages as read
  async markMessagesAsRead(messageIds: string[]): Promise<void> {
    await this.prisma.message.updateMany({
      where: {
        id: { in: messageIds },
      },
      data: {
        status: MessageStatus.READ,
      },
    });
  }

  // Search messages
  async searchMessages(query: string, userId: string): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        content: {
          contains: query,
          mode: 'insensitive',
        },
        OR: [{ senderId: userId }, { receiverId: userId }],
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    return messages.map((msg) => this.mapToDto(msg));
  }

  // Forward message
  async forwardMessage(
    messageId: string,
    senderId: string,
    targetUserId?: string,
    targetGroupId?: string,
  ): Promise<MessageDto> {
    // Get original message
    const originalMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!originalMessage) {
      throw new Error('Message not found');
    }

    // Create forwarded message
    const forwardedMessage = await this.prisma.message.create({
      data: {
        content: originalMessage.content,
        senderId,
        receiverId: targetUserId,
        groupId: targetGroupId,
        mediaUrl: originalMessage.mediaUrl,
        mediaType: originalMessage.mediaType,
        mediaSize: originalMessage.mediaSize,
        mediaDuration: originalMessage.mediaDuration,
        isForwarded: true,
        status: MessageStatus.SENT,
      },
    });

    return this.mapToDto(forwardedMessage);
  }

  // Reply to message
  async replyToMessage(
    senderId: string,
    replyToId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<MessageDto> {
    // Verify reply-to message exists
    const replyTo = await this.prisma.message.findUnique({
      where: { id: replyToId },
    });

    if (!replyTo) {
      throw new Error('Message to reply to not found');
    }

    // Create reply
    const message = await this.prisma.message.create({
      data: {
        content: createMessageDto.content,
        senderId,
        receiverId: createMessageDto.receiverId,
        groupId: createMessageDto.groupId,
        mediaUrl: createMessageDto.mediaUrl,
        mediaType: createMessageDto.mediaType,
        mediaSize: createMessageDto.mediaSize,
        mediaDuration: createMessageDto.mediaDuration,
        replyToId,
        status: MessageStatus.SENT,
      },
    });

    return this.mapToDto(message);
  }

  // Get message with replies
  async getMessageWithReplies(messageId: string): Promise<Message | null> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            profilePicture: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
        replies: {
          where: { deletedAt: null },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    return message;
  }

  // Send media message
  async sendMediaMessage(
    senderId: string,
    sendMediaMessageDto: SendMediaMessageDto,
  ): Promise<MessageDto> {
    const message = await this.prisma.message.create({
      data: {
        content: sendMediaMessageDto.caption || '',
        senderId,
        receiverId: sendMediaMessageDto.receiverId,
        groupId: sendMediaMessageDto.groupId,
        mediaUrl: `/media/${sendMediaMessageDto.mediaId}`,
        mediaType: 'media',
        status: MessageStatus.SENT,
      },
    });

    return this.mapToDto(message);
  }

  private mapToDto(message: Message): MessageDto {
    return {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      receiverId: message.receiverId || undefined,
      groupId: message.groupId || undefined,
      status: message.status,
      mediaUrl: message.mediaUrl || undefined,
      mediaType: message.mediaType || undefined,
      isEdited: message.isEdited,
      editedAt: message.editedAt || undefined,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
}
