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
import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  UpdateProfileDto
} from '../dtos';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly cartService: CartService,
    private readonly appJwtService: AppJwtService,
    private readonly appCacheService: AppCacheService
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
    const isPasswordValid = await UserService.isPasswordMatch(
      dto.oldPassword,
      user.password
    );
    if (!isPasswordValid) {
      throw new ConflictException('Mật khẩu hiện tại không chính xác');
    }

    return this.userService.update(userId, { password: dto.newPassword });
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
