import { CartService } from '@components/carts/services/cart.service';
import { UserService } from '@components/users/services/user.service';
import { AppCacheService } from '@core/modules/app-cache';
import {
  AppCacheKeys,
  AppCacheTtl
} from '@core/modules/app-cache/constants/app-cache.constant';
import {
  AppJwtService,
  TokenPair
} from '@core/modules/app-jwt/services/app-jwt.service';
import { MailService } from '@core/modules/mail/services/mail.service';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto
} from '../dtos';

const ACCOUNT_PROFILE_URL = 'https://www.hauifashion.com/profile';
const RESET_PASSWORD_URL_BASE = 'https://www.hauifashion.com/reset-password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly cartService: CartService,
    private readonly appJwtService: AppJwtService,
    private readonly appCacheService: AppCacheService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existingUser =
      await this.userService.findByEmailOrNullIncludingDeleted(dto.email);
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại');
    }

    let user: Awaited<ReturnType<UserService['create']>> | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const username = await this.generateAvailableUsername(dto.email);

      try {
        user = await this.userService.create({
          username,
          fullname: dto.fullname,
          email: dto.email,
          password: dto.password
        });
        break;
      } catch (error) {
        if (this.isUniqueConstraintErrorOn(error, 'email')) {
          throw new ConflictException('Email đã tồn tại');
        }

        if (!this.isUniqueConstraintErrorOn(error, 'username')) {
          throw error;
        }
      }
    }

    if (!user) {
      throw new ConflictException(
        'Không thể tạo tài khoản do trùng tên đăng nhập. Vui lòng thử lại.'
      );
    }

    await this.cartService.ensureCartByUserId(user.id);

    return this.appJwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role
    });
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.userService.findByEmailOrNull(dto.email);
    if (!user) {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc vô hiệu hóa');
    }

    const isPasswordValid = await UserService.isPasswordMatch(
      dto.password,
      user.password
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    return this.appJwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role
    });
  }

  async refreshToken(dto: RefreshTokenDto): Promise<TokenPair> {
    try {
      const payload = this.appJwtService.verifyRefreshToken(dto.refreshToken);

      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Không tìm thấy người dùng');
      }

      if (!user.isActive) {
        throw new UnauthorizedException(
          'Tài khoản đã bị khóa hoặc vô hiệu hóa'
        );
      }

      return this.appJwtService.generateTokenPair({
        sub: user.id
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
  }

  async getMe(userId: string) {
    type MeUser = Awaited<ReturnType<UserService['findById']>>;
    const cachedUser = await this.appCacheService.get<MeUser>(
      AppCacheKeys.userInfo(userId)
    );

    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.userService.findById(userId);
    await this.appCacheService.set(
      AppCacheKeys.userInfo(userId),
      user,
      AppCacheTtl.userInfo
    );

    return user;
  }
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.userService.update(userId, dto);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userService.findById(userId);

    if (dto.oldPassword === dto.newPassword) {
      throw new ConflictException(
        'Mật khẩu mới không được trùng với mật khẩu hiện tại'
      );
    }

    const isPasswordValid = await UserService.isPasswordMatch(
      dto.oldPassword,
      user.password
    );
    if (!isPasswordValid) {
      throw new ConflictException('Mật khẩu hiện tại không chính xác');
    }

    const updatedUser = await this.userService.update(userId, {
      password: dto.newPassword
    });

    await this.sendPasswordChangedEmail(
      updatedUser.email,
      updatedUser.fullname
    );

    return updatedUser;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const genericResponse = {
      message:
        'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.'
    };
    const cooldownResponse = {
      message: 'Bạn vừa gửi yêu cầu trước đó. Vui lòng thử lại sau 5 phút.'
    };

    const email = dto.email.trim().toLowerCase();
    const cooldownKey = AppCacheKeys.passwordResetCooldown(email);
    const isInCooldown = await this.appCacheService.get<boolean>(cooldownKey);

    if (isInCooldown) {
      return cooldownResponse;
    }

    await this.appCacheService.set(
      cooldownKey,
      true,
      AppCacheTtl.passwordResetCooldown
    );

    const user = await this.userService.findByEmailOrNull(email);

    if (!user || !user.isActive) {
      return genericResponse;
    }

    const token = randomBytes(16).toString('hex');
    const secret = randomBytes(32).toString('hex');
    const secretHash = this.hashSecret(secret);

    await this.appCacheService.set(
      AppCacheKeys.passwordReset(token),
      {
        userId: user.id,
        secretHash
      },
      AppCacheTtl.passwordReset
    );

    const resetUrl = this.buildResetPasswordUrl(token, secret);

    try {
      await this.mailService.sendTemplateEmail({
        to: user.email,
        subject: 'Yêu cầu đặt lại mật khẩu',
        template: 'password-reset-request',
        context: {
          name: user.fullname,
          resetUrl,
          expiredInMinutes: Math.floor(AppCacheTtl.passwordReset / 60000)
        }
      });
    } catch (error) {
      this.logger.error(
        `Không thể gửi email quên mật khẩu tới ${user.email}`,
        error instanceof Error ? error.stack : String(error)
      );
    }

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const cacheKey = AppCacheKeys.passwordReset(dto.token);
    const cachedReset = await this.appCacheService.get<{
      userId: string;
      secretHash: string;
    }>(cacheKey);

    if (!cachedReset) {
      throw new ConflictException(
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'
      );
    }

    const providedSecretHash = this.hashSecret(dto.secret);
    if (!this.isHashEqual(providedSecretHash, cachedReset.secretHash)) {
      throw new ConflictException(
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'
      );
    }

    const user = await this.userService.findById(cachedReset.userId);
    const isSamePassword = await UserService.isPasswordMatch(
      dto.newPassword,
      user.password
    );

    if (isSamePassword) {
      throw new ConflictException('Mật khẩu mới không được trùng mật khẩu cũ');
    }

    const updatedUser = await this.userService.update(user.id, {
      password: dto.newPassword
    });

    await this.appCacheService.del(cacheKey);
    await this.sendPasswordChangedEmail(
      updatedUser.email,
      updatedUser.fullname
    );

    return {
      message: 'Đặt lại mật khẩu thành công'
    };
  }

  private async sendPasswordChangedEmail(
    email: string,
    fullname: string
  ): Promise<void> {
    try {
      const changedAt = new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Asia/Ho_Chi_Minh'
      }).format(new Date());

      await this.mailService.sendTemplateEmail({
        to: email,
        subject: 'Mật khẩu tài khoản của bạn đã được thay đổi',
        template: 'password-change-success',
        context: {
          name: fullname,
          email,
          changedAt,
          accountUrl: ACCOUNT_PROFILE_URL
        }
      });
    } catch (error) {
      this.logger.error(
        `Không thể gửi email thông báo đổi mật khẩu tới ${email}`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  private buildResetPasswordUrl(token: string, secret: string): string {
    const configuredBaseUrl = this.configService.get<string>(
      'app.resetPasswordUrl'
    );
    const baseUrl = configuredBaseUrl || RESET_PASSWORD_URL_BASE;
    const url = new URL(baseUrl);

    url.searchParams.set('token', token);
    url.searchParams.set('secret', secret);

    return url.toString();
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private isHashEqual(providedHash: string, storedHash: string): boolean {
    const provided = Buffer.from(providedHash, 'hex');
    const stored = Buffer.from(storedHash, 'hex');

    if (provided.length !== stored.length) {
      return false;
    }

    return timingSafeEqual(provided, stored);
  }

  private async generateAvailableUsername(email: string): Promise<string> {
    const rawLocalPart = email.split('@')[0] || 'user';
    const baseUsername = this.normalizeUsername(rawLocalPart);

    for (let suffix = 0; suffix <= 100; suffix++) {
      const candidate =
        suffix === 0 ? baseUsername : `${baseUsername}${suffix}`;
      const existing =
        await this.userService.findByUsernameOrNullIncludingDeleted(candidate);

      if (!existing) {
        return candidate;
      }
    }

    return `${baseUsername}${Date.now().toString().slice(-6)}`;
  }

  private normalizeUsername(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .trim();

    return normalized || 'user';
  }

  private isUniqueConstraintErrorOn(error: unknown, field: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.some((item) => String(item).includes(field));
    }

    return typeof target === 'string' ? target.includes(field) : false;
  }
}
