import { UserModule } from '@components/users/users.module';
import { AppJwtModule } from '@core/modules/app-jwt';
import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';

@Module({
  imports: [AppJwtModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
