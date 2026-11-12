import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateDeviceDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  serialNumber: string;

  @ApiPropertyOptional({ enum: ['ZKTECO', 'HIKVISION', 'OTHER'] })
  @IsOptional()
  @IsEnum(['ZKTECO', 'HIKVISION', 'OTHER'])
  vendor?: 'ZKTECO' | 'HIKVISION' | 'OTHER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateDeviceDto extends PartialType(CreateDeviceDto) {
  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class ManualCheckInDto {
  @ApiProperty()
  @IsString()
  memberId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  punchedAt?: string;

  @ApiPropertyOptional({ enum: ['IN', 'OUT'] })
  @IsOptional()
  @IsEnum(['IN', 'OUT'])
  direction?: 'IN' | 'OUT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Stored as alertReason on the log' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAttendanceLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  punchedAt?: string;

  @ApiPropertyOptional({ enum: ['IN', 'OUT'] })
  @IsOptional()
  @IsEnum(['IN', 'OUT'])
  direction?: 'IN' | 'OUT';

  @ApiPropertyOptional({ description: 'Mapped to alertReason' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Single calendar day (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'true|false' })
  @IsOptional()
  @IsString()
  mapped?: string;
}
