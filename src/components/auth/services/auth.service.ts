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
import { LoginDto, RefreshTokenDto, RegisterDto } from '../dtos';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly cartService: CartService,
    private readonly appJwtService: AppJwtService,
    private readonly appCacheService: AppCacheService
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existingUser = await this.userService.findByEmailOrNull(dto.email);
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại');
    }

    const user = await this.userService.create({
      username: dto.email.split('@')[0],
      fullname: dto.fullname,
      email: dto.email,
      password: dto.password
    });

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
      const payload = this.appJwtService.verifyToken(dto.refreshToken);

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
}
