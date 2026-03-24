import * as bcrypt from 'bcrypt';

import { CreateUserDto } from '@components/users/dtos/create-user.dto';
import { QueryUserDto } from '@components/users/dtos/query-user.dto';
import { UpdateUserDto } from '@components/users/dtos/update-user.dto';
import { UserRepository } from '@components/users/repositories/user.repository';
import { AppCacheService } from '@core/modules/app-cache';
import { AppCacheKeys } from '@core/modules/app-cache/constants/app-cache.constant';
import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly appCacheService: AppCacheService
  ) {}

  async findAll(query: QueryUserDto) {
    return this.userRepository.findAll(query);
  }

  async findByEmailOrNull(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException(
        `Không tìm thấy người dùng với email ${email}`
      );
    }
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với id ${id}`);
    }
    return user;
  }

  async create(data: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.userRepository.createUser({
      ...data,
      password: hashedPassword,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined
    });
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    await this.findById(id);
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const updateData: any = { ...data };
    if (data.dateOfBirth) {
      updateData.dateOfBirth = new Date(data.dateOfBirth);
    }
    const updatedUser = await this.userRepository.updateUser(id, updateData);
    await this.appCacheService.del(AppCacheKeys.userInfo(id));
    return updatedUser;
  }

  async toggleLock(id: string): Promise<User> {
    const user = await this.findById(id);
    const updatedUser = await this.userRepository.updateUser(id, {
      isActive: !user.isActive
    });
    await this.appCacheService.del(AppCacheKeys.userInfo(id));
    return updatedUser;
  }

  async softDelete(id: string): Promise<User> {
    await this.findById(id);
    const updatedUser = await this.userRepository.updateUser(id, {
      deletedAt: new Date()
    });
    await this.appCacheService.del(AppCacheKeys.userInfo(id));
    return updatedUser;
  }

  static async isPasswordMatch(
    raw: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(raw, hashedPassword);
  }
}
