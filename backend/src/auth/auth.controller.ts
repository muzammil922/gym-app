import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
  RequestOtpDto,
  SetPasswordDto,
  ToggleOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login with phone + password (staff)' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/request')
  @ApiOperation({ summary: 'Send a WhatsApp login OTP (members)' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify the WhatsApp login OTP and start a session' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @ApiBearerAuth()
  @Post('password')
  @ApiOperation({ summary: 'Set your own password after the first OTP login' })
  setPassword(@CurrentUser() user: AuthUser, @Body() dto: SetPasswordDto) {
    return this.auth.setPassword(user.id, dto.newPassword);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.id, user.gymId);
  }

  @ApiBearerAuth()
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('otp')
  toggleOtp(@CurrentUser() user: AuthUser, @Body() dto: ToggleOtpDto) {
    return this.auth.toggleOtp(user.id, dto.enabled);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
