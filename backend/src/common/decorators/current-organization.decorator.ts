import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentOrganization = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().organizationId);
