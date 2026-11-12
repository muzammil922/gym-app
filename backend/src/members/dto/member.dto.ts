import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateMemberDto {
  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trainerStaffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memberCode?: string;
}

export class UpdateMemberDto extends PartialType(CreateMemberDto) {}

export class AddMemberDto extends CreateMemberDto {
  @ApiProperty({ description: 'Plan ID for initial subscription' })
  @IsString()
  planId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  offerId?: string;

  @ApiPropertyOptional({ description: 'Initial payment amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class FreezeMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  freezeStart?: string;

  @ApiProperty()
  @IsDateString()
  freezeEnd: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RenewMemberDto {
  @ApiProperty()
  @IsString()
  planId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  offerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ChangePlanDto {
  @ApiProperty()
  @IsString()
  planId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MemberQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED', 'PENDING'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trainerStaffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;
}
