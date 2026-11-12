import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '03001234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Owner@12345' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: 'Gym ID if multi-tenant login' })
  @IsOptional()
  @IsString()
  gymId?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ToggleOtpDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

export class RequestOtpDto {
  @ApiProperty({ example: '03001234567' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'Gym ID if multi-tenant login' })
  @IsOptional()
  @IsString()
  gymId?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '03001234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  otp: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gymId?: string;
}

export class SetPasswordDto {
  @ApiProperty({ example: 'NewPass@123' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
