import * as bcrypt from 'bcrypt';

import { CreateUserDto } from '@components/users/dtos/create-user.dto';
import { QueryUserDto } from '@components/users/dtos/query-user.dto';
import { UpdateUserDto } from '@components/users/dtos/update-user.dto';
import { UserRepository } from '@components/users/repositories/user.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(query: QueryUserDto) {
    return this.userRepository.findAll(query);
  }

  async findByEmailOrNull(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async create(data: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.userRepository.createUser({
      ...data,
      password: hashedPassword
    });
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    await this.findById(id); // Ensure exists
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.userRepository.updateUser(id, data);
  }

  async toggleLock(id: string): Promise<User> {
    const user = await this.findById(id);
    return this.userRepository.updateUser(id, { isActive: !user.isActive });
  }

  async softDelete(id: string): Promise<User> {
    await this.findById(id);
    return this.userRepository.updateUser(id, { deletedAt: new Date() });
  }

  static async isPasswordMatch(
    raw: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(raw, hashedPassword);
  }
}
