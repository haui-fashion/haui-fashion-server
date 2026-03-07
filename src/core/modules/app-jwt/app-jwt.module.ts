import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AppJwtService } from './services/app-jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';

import { UserModule } from '@components/users/users.module';

@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: parseInt(
            configService.get<string>('jwt.expiresIn') || '900',
            10
          )
        }
      })
    })
  ],
  providers: [AppJwtService, JwtStrategy, JwtAuthGuard],
  exports: [AppJwtService, JwtAuthGuard, JwtStrategy]
})
export class AppJwtModule {}
