import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const req = context.switchToHttp().getRequest();
    if (req.user?.isSuperAdmin) return true;
    const membership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: req.user.id, organizationId: req.organizationId } },
      include: { role: { include: { permissions: { include: { permission: true } } } } }
    });
    const granted = membership?.role.permissions.map(rp => rp.permission.code) || [];
    if (!required.every(p => granted.includes(p))) throw new ForbiddenException(`Permissão insuficiente: ${required.join(', ')}`);
    return true;
  }
}
