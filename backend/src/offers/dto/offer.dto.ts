import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['PERCENT', 'FIXED', 'FREE_DAYS'] })
  @IsEnum(['PERCENT', 'FIXED', 'FREE_DAYS'])
  type: 'PERCENT' | 'FIXED' | 'FREE_DAYS';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @ApiProperty()
  @IsDateString()
  validFrom: string;

  @ApiProperty()
  @IsDateString()
  validTo: string;
}

export class UpdateOfferDto extends PartialType(CreateOfferDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class OfferQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;
}
