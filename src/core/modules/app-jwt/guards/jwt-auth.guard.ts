import { IS_PUBLIC_KEY } from '@core/utilities/decorators/public.decorator';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!isPublic) {
      return (await super.canActivate(context)) as boolean;
    }

    const request = context.switchToHttp().getRequest<{
      headers?: { authorization?: string | string[] };
    }>();

    const authHeader = Array.isArray(request.headers?.authorization)
      ? request.headers?.authorization[0]
      : request.headers?.authorization;

    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return true;
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return true;
    }
  }
}
