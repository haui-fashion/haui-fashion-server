import { CreateUserDto } from '@components/users/dtos/create-user.dto';
import { QueryUserDto } from '@components/users/dtos/query-user.dto';
import { UpdateUserDto } from '@components/users/dtos/update-user.dto';
import { UserService } from '@components/users/services/user.service';
import { Roles } from '@core/utilities/decorators/roles.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users with pagination, sorting, and filtering'
  })
  async findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  async findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Toggle user active/locked status' })
  async toggleLock(@Param('id') id: string) {
    return this.userService.toggleLock(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a user' })
  async remove(@Param('id') id: string) {
    return this.userService.softDelete(id);
  }
}
