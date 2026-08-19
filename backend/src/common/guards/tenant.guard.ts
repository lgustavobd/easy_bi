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
      include: {
        role: true,
        organization: { select: { id: true, name: true, status: true, deletedAt: true, accessExpiresAt: true } }
      }
    });
    if (!membership || membership.status !== 'ACTIVE') throw new ForbiddenException('Usuario sem acesso a esta organizacao.');
    if (!membership.organization || membership.organization.deletedAt || membership.organization.status !== 'ACTIVE') {
      throw new ForbiddenException('Organizacao inativa ou bloqueada.');
    }
    if (membership.organization.accessExpiresAt) {
      const expiresAt = new Date(membership.organization.accessExpiresAt);
      if (expiresAt.getTime() <= Date.now()) {
        throw new ForbiddenException(`Acesso de teste da organizacao ${membership.organization.name} expirou em ${expiresAt.toLocaleDateString('pt-BR')}. Entre em contato com o Admin do sistema para renovar ou melhorar o plano.`);
      }
    }
    req.organizationId = String(organizationId);
    req.membership = membership;
    return true;
  }
}
