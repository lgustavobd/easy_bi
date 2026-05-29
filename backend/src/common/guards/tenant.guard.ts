import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const organizationId = req.headers['x-organization-id'] || req.params.organizationId;

    if (!user) throw new ForbiddenException('Usuario nao autenticado.');

    if (user.isSuperAdmin) {
      const controllerName = context.getClass().name;
      const allowedGlobalControllers = new Set(['UsersController', 'SectorsController']);
      if (!allowedGlobalControllers.has(controllerName)) {
        throw new ForbiddenException('Admin SaaS global nao acessa dados das organizacoes.');
      }
      req.organizationId = organizationId ? String(organizationId) : undefined;
      return true;
    }

    if (!organizationId) throw new ForbiddenException('Organizacao ativa nao informada.');

    const membership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: String(organizationId) } },
      include: { role: true }
    });
    if (!membership || membership.status !== 'ACTIVE') throw new ForbiddenException('Usuario sem acesso a esta organizacao.');
    req.organizationId = String(organizationId);
    req.membership = membership;
    return true;
  }
}
