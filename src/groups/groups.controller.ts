import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import type { AuthRequest } from '@/auth/auth.request';
import { GroupsService } from './groups.service';
import {
  CreateGroupDto,
  UpdateGroupDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  GroupResponseDto,
} from './groups.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  async createGroup(
    @Request() req: AuthRequest,
    @Body() createGroupDto: CreateGroupDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.createGroup(req.user.userId, createGroupDto);
  }

  @Get()
  async getGroups(@Request() req: AuthRequest): Promise<GroupResponseDto[]> {
    return this.groupsService.getGroups(req.user.userId);
  }

  @Get(':groupId')
  async getGroup(
    @Param('groupId') groupId: string,
    @Request() req: AuthRequest,
  ): Promise<GroupResponseDto> {
    return this.groupsService.getGroup(groupId, req.user.userId);
  }

  @Patch(':groupId')
  async updateGroup(
    @Param('groupId') groupId: string,
    @Request() req: AuthRequest,
    @Body() updateGroupDto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.updateGroup(
      groupId,
      req.user.userId,
      updateGroupDto,
    );
  }

  @Post(':groupId/members')
  async addMember(
    @Param('groupId') groupId: string,
    @Request() req: AuthRequest,
    @Body() addMemberDto: AddMemberDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.addMember(groupId, req.user.userId, addMemberDto);
  }

  @Delete(':groupId/members/:memberId')
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Request() req: AuthRequest,
  ): Promise<GroupResponseDto> {
    return this.groupsService.removeMember(groupId, req.user.userId, {
      userId: memberId,
    });
  }

  @Patch(':groupId/members/:memberId/role')
  async updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Request() req: AuthRequest,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.updateMemberRole(groupId, req.user.userId, {
      ...updateMemberRoleDto,
      userId: memberId,
    });
  }

  @Post(':groupId/leave')
  async leaveGroup(
    @Param('groupId') groupId: string,
    @Request() req: AuthRequest,
  ): Promise<{ message: string }> {
    await this.groupsService.leaveGroup(groupId, req.user.userId);
    return { message: 'Left group successfully' };
  }

  @Delete(':groupId')
  async deleteGroup(
    @Param('groupId') groupId: string,
    @Request() req: AuthRequest,
  ): Promise<{ message: string }> {
    await this.groupsService.deleteGroup(groupId, req.user.userId);
    return { message: 'Group deleted successfully' };
  }
}
