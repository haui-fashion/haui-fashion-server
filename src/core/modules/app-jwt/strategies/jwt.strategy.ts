import { UserService } from '@components/users/services/user.service';
import { JwtPayload } from '@core/modules/app-jwt/services/app-jwt.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface ValidatedUser {
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService
  ) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('Chưa cấu hình JWT secret');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret
    });
  }

  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    try {
      const user = await this.userService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException(
          'Tài khoản người dùng bị vô hiệu hoặc không tồn tại'
        );
      }

      return {
        userId: user.id,
        email: user.email,
        role: user.role
      };
    } catch {
      throw new UnauthorizedException('Không được phép truy cập');
    }
  }
}
