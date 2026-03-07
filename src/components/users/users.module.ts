import { UserController } from '@components/users/controllers/user.controller';
import { UserDatasource } from '@components/users/datasources/user.datasource';
import { UserRepository } from '@components/users/repositories/user.repository';
import { UserService } from '@components/users/services/user.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [UserController],
  providers: [UserDatasource, UserRepository, UserService],
  exports: [UserService]
})
export class UserModule {}
