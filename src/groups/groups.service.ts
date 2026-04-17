import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import {
  CreateGroupDto,
  UpdateGroupDto,
  AddMemberDto,
  RemoveMemberDto,
  UpdateMemberRoleDto,
  GroupResponseDto,
  GroupMemberDto,
} from './groups.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async createGroup(
    userId: string,
    createGroupDto: CreateGroupDto,
  ): Promise<GroupResponseDto> {
    // Verify members exist
    const members = await this.prisma.user.findMany({
      where: {
        id: {
          in: createGroupDto.memberIds,
        },
      },
    });

    if (members.length !== createGroupDto.memberIds.length) {
      throw new BadRequestException('One or more members not found');
    }

    // Create group with creator as admin
    const group = await this.prisma.group.create({
      data: {
        name: createGroupDto.name,
        description: createGroupDto.description,
        profilePicture: createGroupDto.profilePicture,
        createdBy: userId,
        members: {
          create: [
            {
              userId,
              role: 'ADMIN',
            },
            ...createGroupDto.memberIds.map((memberId) => ({
              userId: memberId,
              role: 'MEMBER' as const,
            })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
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

    return this.formatGroupResponse(group);
  }

  async getGroups(userId: string): Promise<GroupResponseDto[]> {
    const groups = await this.prisma.group.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return groups.map((group) => this.formatGroupResponse(group));
  }

  async getGroup(groupId: string, userId: string): Promise<GroupResponseDto> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
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

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is member
    const isMember = group.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return this.formatGroupResponse(group);
  }

  async updateGroup(
    groupId: string,
    userId: string,
    updateGroupDto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is admin
    const userMember = group.members.find((member) => member.userId === userId);
    if (!userMember || userMember.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update group info');
    }

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: updateGroupDto,
      include: {
        members: {
          include: {
            user: {
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

    return this.formatGroupResponse(updated);
  }

  async addMember(
    groupId: string,
    userId: string,
    addMemberDto: AddMemberDto,
  ): Promise<GroupResponseDto> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if requester is admin
    const requesterMember = group.members.find(
      (member) => member.userId === userId,
    );
    if (!requesterMember || requesterMember.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can add members');
    }

    // Check if member already exists
    const existingMember = group.members.find(
      (member) => member.userId === addMemberDto.userId,
    );
    if (existingMember) {
      throw new BadRequestException('User is already a member of this group');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: addMemberDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.groupMember.create({
      data: {
        groupId,
        userId: addMemberDto.userId,
        role: addMemberDto.role || 'MEMBER',
      },
    });

    return this.getGroup(groupId, userId);
  }

  async removeMember(
    groupId: string,
    userId: string,
    removeMemberDto: RemoveMemberDto,
  ): Promise<GroupResponseDto> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if requester is admin
    const requesterMember = group.members.find(
      (member) => member.userId === userId,
    );
    if (!requesterMember || requesterMember.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can remove members');
    }

    // Check if trying to remove self
    if (removeMemberDto.userId === userId) {
      throw new BadRequestException('Cannot remove yourself from the group');
    }

    const memberToRemove = group.members.find(
      (member) => member.userId === removeMemberDto.userId,
    );
    if (!memberToRemove) {
      throw new NotFoundException('Member not found in this group');
    }

    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: removeMemberDto.userId,
        },
      },
    });

    return this.getGroup(groupId, userId);
  }

  async updateMemberRole(
    groupId: string,
    userId: string,
    updateMemberRoleDto: UpdateMemberRoleDto,
  ): Promise<GroupResponseDto> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if requester is admin
    const requesterMember = group.members.find(
      (member) => member.userId === userId,
    );
    if (!requesterMember || requesterMember.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update member roles');
    }

    // Cannot change own role
    if (updateMemberRoleDto.userId === userId) {
      throw new BadRequestException('Cannot change your own role');
    }

    await this.prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: updateMemberRoleDto.userId,
        },
      },
      data: {
        role: updateMemberRoleDto.role,
      },
    });

    return this.getGroup(groupId, userId);
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const member = group.members.find((m) => m.userId === userId);
    if (!member) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // If last member, delete group
    if (group.members.length === 1) {
      await this.prisma.group.delete({
        where: { id: groupId },
      });
    } else {
      // If user is admin and other members exist, make another admin
      if (member.role === 'ADMIN' && group.members.length > 1) {
        const otherAdmin = group.members.find(
          (m) => m.userId !== userId && m.role === 'ADMIN',
        );
        if (!otherAdmin) {
          // Promote the oldest member to admin
          const oldestMember = group.members
            .filter((m) => m.userId !== userId)
            .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];

          await this.prisma.groupMember.update({
            where: {
              groupId_userId: {
                groupId,
                userId: oldestMember.userId,
              },
            },
            data: {
              role: 'ADMIN',
            },
          });
        }
      }

      await this.prisma.groupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });
    }
  }

  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Only creator/admin can delete
    if (group.createdBy !== userId) {
      throw new ForbiddenException('Only group creator can delete the group');
    }

    await this.prisma.group.delete({
      where: { id: groupId },
    });
  }

  private formatGroupResponse(group: {
    id: string;
    name: string;
    description: string | null;
    profilePicture: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    members: GroupMemberDto[];
  }): GroupResponseDto {
    return {
      id: group.id,
      name: group.name,
      description: group.description || undefined,
      profilePicture: group.profilePicture || undefined,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: group.members,
      memberCount: group.members.length,
    };
  }
}
