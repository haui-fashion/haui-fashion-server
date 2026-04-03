import {
  CurrentUser,
  CurrentUserDto
} from '@core/utilities/decorators/current-user.decorator';
import { Public } from '@core/utilities/decorators/public.decorator';
import { Body, Controller, Get, Post, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  RefreshTokenDto,
  RegisterDto,
  VerifyEmailDto,
  UpdateProfileDto,
  ChangePasswordDto
} from '../dtos';
import { AuthService } from '../services/auth.service';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('resend-verify-email')
  async resendVerifyEmail(@Body() dto: ForgotPasswordDto) {
    return this.authService.resendVerifyEmail(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Get('verify-email')
  async verifyEmailByQuery(@Query() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  async getMe(@CurrentUser() user: CurrentUserDto) {
    return this.authService.getMe(user.userId);
  }
  @Patch('profile')
  @ApiBearerAuth()
  async updateProfile(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: UpdateProfileDto
  ) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @Patch('change-password')
  @ApiBearerAuth()
  async changePassword(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: ChangePasswordDto
  ) {
    return this.authService.changePassword(user.userId, dto);
  }
}
