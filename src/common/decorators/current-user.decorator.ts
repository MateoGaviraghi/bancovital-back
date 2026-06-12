import type { Session } from '@/auth/session';
import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (field: keyof Session | undefined, ctx: ExecutionContext): Session | Session[keyof Session] => {
    const req = ctx.switchToHttp().getRequest<{ session?: Session }>();
    const session = req.session;
    if (!session) {
      throw new Error(
        '@CurrentUser() called without a session in the request. Is AuthGuard active?',
      );
    }
    return field ? session[field] : session;
  },
);
