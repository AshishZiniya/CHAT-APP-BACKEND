import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  memberIds: string[];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;
}

export class AddMemberDto {
  @IsUUID('4')
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsString()
  role?: 'ADMIN' | 'MEMBER';
}

export class RemoveMemberDto {
  @IsUUID('4')
  @IsNotEmpty()
  userId: string;
}

export class UpdateMemberRoleDto {
  @IsUUID('4')
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  role: 'ADMIN' | 'MEMBER';
}

export class GroupResponseDto {
  id: string;
  name: string;
  description?: string;
  profilePicture?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  members: GroupMemberDto[];
  memberCount: number;
}

export class GroupMemberDto {
  id: string;
  userId: string;
  groupId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: Date;
  user?: {
    id: string;
    displayName: string;
    profilePicture: string | null;
  };
}
