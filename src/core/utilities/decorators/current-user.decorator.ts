import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface CurrentUserDto {
  userId: string;
  email: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserDto }>();
    const user = request.user;

    return data ? user?.[data] : user;
  }
);
