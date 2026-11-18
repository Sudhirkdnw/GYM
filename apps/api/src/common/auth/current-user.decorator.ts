import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUserContext } from '@gymos/shared-types';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
