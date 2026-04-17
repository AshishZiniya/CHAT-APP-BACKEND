import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { PrismaService } from '../database/prisma.service';
import { CreateMessageDto } from './messages.dto';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessageStatus } from '@prisma/client';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
    credentials: true,
  },
})
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('MessagesGateway');
  private onlineUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private messagesService: MessagesService,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      // Extract and verify JWT token
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn('Client connected without token');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const decoded = this.jwtService.verify(token, {
        secret:
          process.env.JWT_SECRET ||
          'your_jwt_secret_key_change_this_in_production',
      }) as unknown as { sub: string; email: string };

      client.userId = decoded.sub;
      client.email = decoded.email;

      // Store online user
      if (client.userId) {
        this.onlineUsers.set(client.userId, client.id);

        // Update user's last seen time
        await this.prisma.user.update({
          where: { id: client.userId },
          data: { isActive: true },
        });

        this.logger.log(`Client connected: ${client.userId} (${client.id})`);
      }
      this.server.emit('user:online', {
        userId: client.userId,
        timestamp: new Date(),
      });

      // Join user to their own room for private notifications
      await client.join(`user:${client.userId}`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Connection authentication failed:', errorMsg);
      client.disconnect();
    }
  }

  async handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.userId) {
      this.onlineUsers.delete(client.userId);

      // Update user's last seen time
      await this.prisma.user.update({
        where: { id: client.userId },
        data: {
          isActive: false,
          lastSeen: new Date(),
        },
      });

      this.logger.log(`Client disconnected: ${client.userId}`);

      // Notify all users about presence update
      this.server.emit('user:offline', {
        userId: client.userId,
        lastSeen: new Date(),
      });
    }
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CreateMessageDto,
  ) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      // Create message in database
      const message = await this.messagesService.sendMessage(
        client.userId,
        payload,
      );

      // If it's a direct message, send to recipient's room
      if (message.receiverId) {
        this.server.to(`user:${message.receiverId}`).emit('message:receive', {
          ...message,
          sender: {
            id: client.userId,
            email: client.email,
          },
        });

        // Notify sender that message was delivered
        client.emit('message:delivered', {
          messageId: message.id,
          status: MessageStatus.DELIVERED,
        });
      }

      // If it's a group message, send to group room
      if (message.groupId) {
        this.server.to(`group:${message.groupId}`).emit('message:receive', {
          ...message,
          sender: {
            id: client.userId,
            email: client.email,
          },
        });
      }

      return message;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error sending message: ${errorMsg}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('message:read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageIds: string[] },
  ) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      // Update message status in database
      await this.messagesService.markMessagesAsRead(payload.messageIds);

      // Notify sender about read status
      this.server.emit('message:read', {
        messageIds: payload.messageIds,
        readBy: client.userId,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error marking messages as read:', error);
      client.emit('error', { message: 'Failed to mark messages as read' });
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string },
  ) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      // Delete message from database
      await this.messagesService.deleteMessage(payload.messageId);

      // Notify all users in the chat
      this.server.emit('message:deleted', {
        messageId: payload.messageId,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error deleting message: ${errorMsg}`);
      client.emit('error', { message: 'Failed to delete message' });
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatId: string },
  ) {
    if (client.userId) {
      this.server.to(payload.chatId).emit('typing:start', {
        userId: client.userId,
        chatId: payload.chatId,
      });
    }
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatId: string },
  ) {
    if (client.userId) {
      this.server.to(payload.chatId).emit('typing:stop', {
        userId: client.userId,
        chatId: payload.chatId,
      });
    }
  }

  @SubscribeMessage('chat:join')
  async handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatId: string },
  ) {
    if (client.userId) {
      await client.join(payload.chatId);
      this.logger.log(
        `User ${client.userId} joined chat room: ${payload.chatId}`,
      );
    }
  }

  @SubscribeMessage('chat:leave')
  async handleLeaveChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatId: string },
  ) {
    if (client.userId) {
      await client.leave(payload.chatId);
      this.logger.log(
        `User ${client.userId} left chat room: ${payload.chatId}`,
      );
    }
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string; content: string },
  ) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      // Edit message in database
      await this.messagesService.editMessage(
        payload.messageId,
        payload.content,
      );

      // Notify all users about the edit
      this.server.emit('message:edited', {
        messageId: payload.messageId,
        content: payload.content,
        editedAt: new Date(),
        editedBy: client.userId,
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error editing message: ${errorMsg}`);
      client.emit('error', { message: 'Failed to edit message' });
    }
  }

  @SubscribeMessage('message:reply')
  async handleReplyMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      replyToId: string;
      content: string;
      receiverId?: string;
      groupId?: string;
    },
  ) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      // Create reply
      const reply = await this.messagesService.replyToMessage(
        client.userId,
        payload.replyToId,
        {
          content: payload.content,
          receiverId: payload.receiverId,
          groupId: payload.groupId,
        },
      );

      // Notify recipients
      if (payload.receiverId) {
        this.server.to(`user:${payload.receiverId}`).emit('message:receive', {
          ...reply,
          sender: { id: client.userId, email: client.email },
        });
      }

      if (payload.groupId) {
        this.server.to(`group:${payload.groupId}`).emit('message:receive', {
          ...reply,
          sender: { id: client.userId, email: client.email },
        });
      }

      return reply;
    } catch (error) {
      this.logger.error('Error replying to message:', error);
      client.emit('error', { message: 'Failed to reply to message' });
    }
  }

  @SubscribeMessage('message:forward')
  async handleForwardMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      messageId: string;
      targetUserId?: string;
      targetGroupId?: string;
    },
  ) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      // Forward message
      const forwardedMessage = await this.messagesService.forwardMessage(
        payload.messageId,
        client.userId,
        payload.targetUserId,
        payload.targetGroupId,
      );

      // Notify recipient
      if (payload.targetUserId) {
        this.server.to(`user:${payload.targetUserId}`).emit('message:receive', {
          ...forwardedMessage,
          sender: { id: client.userId, email: client.email },
          isForwarded: true,
        });
      }

      if (payload.targetGroupId) {
        this.server
          .to(`group:${payload.targetGroupId}`)
          .emit('message:receive', {
            ...forwardedMessage,
            sender: { id: client.userId, email: client.email },
            isForwarded: true,
          });
      }

      return { success: true };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error forwarding message: ${errorMsg}`);
      client.emit('error', { message: 'Failed to forward message' });
    }
  }

  @SubscribeMessage('presence:update')
  handlePresenceUpdate(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.userId) {
      // Broadcast presence update to all users
      this.server.emit('presence:updated', {
        userId: client.userId,
        status: 'online',
        lastSeen: new Date(),
      });
    }
  }

  @SubscribeMessage('group:join')
  async handleJoinGroup(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { groupId: string },
  ) {
    if (client.userId) {
      await client.join(`group:${payload.groupId}`);
      this.logger.log(`User ${client.userId} joined group: ${payload.groupId}`);

      // Notify group members that user is online
      this.server.to(`group:${payload.groupId}`).emit('group:member-online', {
        userId: client.userId,
        groupId: payload.groupId,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('group:leave')
  async handleLeaveGroup(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { groupId: string },
  ) {
    if (client.userId) {
      await client.leave(`group:${payload.groupId}`);
      this.logger.log(`User ${client.userId} left group: ${payload.groupId}`);

      // Notify group members that user is offline
      this.server.to(`group:${payload.groupId}`).emit('group:member-offline', {
        userId: client.userId,
        groupId: payload.groupId,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('group:member-added')
  handleGroupMemberAdded(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { groupId: string; userId: string },
  ) {
    if (client.userId) {
      // Notify all members in the group
      this.server.to(`group:${payload.groupId}`).emit('group:member-added', {
        groupId: payload.groupId,
        userId: payload.userId,
        addedBy: client.userId,
        timestamp: new Date(),
      });

      // Make the new member join the group room
      this.server.to(`user:${payload.userId}`).emit('group:member-added', {
        groupId: payload.groupId,
        userId: payload.userId,
        addedBy: client.userId,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('group:member-removed')
  handleGroupMemberRemoved(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { groupId: string; userId: string },
  ) {
    if (client.userId) {
      // Notify all members in the group
      this.server.to(`group:${payload.groupId}`).emit('group:member-removed', {
        groupId: payload.groupId,
        userId: payload.userId,
        removedBy: client.userId,
        timestamp: new Date(),
      });

      // Notify the removed member
      this.server.to(`user:${payload.userId}`).emit('group:member-removed', {
        groupId: payload.groupId,
        userId: payload.userId,
        removedBy: client.userId,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('group:updated')
  handleGroupUpdated(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      groupId: string;
      name?: string;
      description?: string;
      profilePicture?: string;
    },
  ) {
    if (client.userId) {
      // Notify all members in the group about the update
      this.server.to(`group:${payload.groupId}`).emit('group:updated', {
        groupId: payload.groupId,
        name: payload.name,
        description: payload.description,
        profilePicture: payload.profilePicture,
        updatedBy: client.userId,
        timestamp: new Date(),
      });
    }
  }

  // Helper method to get online users
  getOnlineUsers(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  // Helper method to get online status
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}
