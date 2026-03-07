import { UserService } from '@components/users/services/user.service';
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
    private readonly appJwtService: AppJwtService
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existingUser = await this.userService.findByEmailOrNull(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.userService.create({
      username: dto.email.split('@')[0], // Extract default username from email
      fullname: dto.name, // RegisterDto uses `name`
      email: dto.email,
      password: dto.password
    });

    return this.appJwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role
    });
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.userService.findByEmailOrNull(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await UserService.isPasswordMatch(
      dto.password,
      user.password
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
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
        throw new UnauthorizedException('User not found');
      }

      return this.appJwtService.generateTokenPair({
        sub: user.id
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: string) {
    return this.userService.findById(userId);
  }
}
