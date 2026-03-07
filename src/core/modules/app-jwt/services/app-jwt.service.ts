import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AppJwtService {
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    this.accessTokenExpiresIn = parseInt(
      this.configService.get<string>('jwt.expiresIn') || '900',
      10
    );
    this.refreshTokenExpiresIn = parseInt(
      this.configService.get<string>('jwt.refreshExpiresIn') || '604800',
      10
    );
  }

  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload },
      { expiresIn: this.accessTokenExpiresIn }
    );
  }

  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload },
      { expiresIn: this.refreshTokenExpiresIn }
    );
  }

  generateTokenPair(payload: JwtPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload)
    };
  }

  verifyToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }

  decodeToken(token: string): JwtPayload | null {
    return this.jwtService.decode<JwtPayload>(token);
  }
}
