import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Delete,
  Patch,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './messages.dto';
import type { AuthRequest } from '../auth/auth.request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('send')
  async sendMessage(
    @Request() req: AuthRequest,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messagesService.sendMessage(req.user.userId, createMessageDto);
  }

  @Get('conversation/:userId')
  async getConversation(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
    @Query('limit') limit: string = '50',
  ) {
    return this.messagesService.getConversation(
      req.user.userId,
      userId,
      parseInt(limit),
    );
  }

  @Get('group/:groupId')
  async getGroupMessages(
    @Param('groupId') groupId: string,
    @Query('limit') limit: string = '50',
  ) {
    return this.messagesService.getGroupMessages(groupId, parseInt(limit));
  }

  @Get('unread')
  async getUnreadMessages(@Request() req: AuthRequest) {
    return this.messagesService.getUnreadMessages(req.user.userId);
  }

  @Patch(':messageId')
  async editMessage(
    @Param('messageId') messageId: string,
    @Body() payload: { content: string },
  ) {
    return this.messagesService.editMessage(messageId, payload.content);
  }

  @Delete(':messageId')
  async deleteMessage(@Param('messageId') messageId: string) {
    return this.messagesService.deleteMessage(messageId);
  }

  @Post('mark-as-read')
  async markAsRead(@Body() payload: { messageIds: string[] }) {
    await this.messagesService.markMessagesAsRead(payload.messageIds);
    return { success: true };
  }

  @Get('search')
  async searchMessages(@Request() req: AuthRequest, @Query('q') query: string) {
    return this.messagesService.searchMessages(query, req.user.userId);
  }

  @Post(':messageId/forward')
  async forwardMessage(
    @Request() req: AuthRequest,
    @Param('messageId') messageId: string,
    @Body() payload: { targetUserId?: string; targetGroupId?: string },
  ) {
    return this.messagesService.forwardMessage(
      messageId,
      req.user.userId,
      payload.targetUserId,
      payload.targetGroupId,
    );
  }

  @Post(':messageId/reply')
  async replyToMessage(
    @Request() req: AuthRequest,
    @Param('messageId') messageId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messagesService.replyToMessage(
      req.user.userId,
      messageId,
      createMessageDto,
    );
  }

  @Get(':messageId/with-replies')
  async getMessageWithReplies(
    @Param('messageId') messageId: string,
  ): Promise<any> {
    return this.messagesService.getMessageWithReplies(messageId);
  }
}
