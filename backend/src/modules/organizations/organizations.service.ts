import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { slugify } from '../../common/utils/slugify';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService) {}

  async create(dto: any, user: any) {
    if (!user.isSuperAdmin) throw new ForbiddenException('Apenas Super Admin pode criar organizacoes.');
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: slugify(dto.name),
        document: dto.document,
        themeConfig: dto.themeConfig || { accent: 'PURPLE', primary: '#7C3AED' }
      }
    });
    await this.prisma.sector.create({
      data: {
        organizationId: org.id,
        name: 'Geral',
        code: 'GERAL',
        description: 'Setor padrao da organizacao',
        isDefault: true
      }
    });
    await this.audit.register({ userId: user.id, action: 'organization.created', entity: 'organization', entityId: org.id });
    return org;
  }

  list(user: any) {
    if (user.isSuperAdmin) return this.prisma.organization.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] });
    return this.prisma.organization.findMany({
      where: { users: { some: { userId: user.id, status: 'ACTIVE' } }, deletedAt: null },
      orderBy: { name: 'asc' }
    });
  }

  async get(id: string, user: any) {
    if (!user.isSuperAdmin) await this.ensureMembership(user.id, id);
    const org = await this.prisma.organization.findFirst({ where: { id, ...(user.isSuperAdmin ? {} : { deletedAt: null }) } });
    if (!org) throw new NotFoundException('Organizacao nao encontrada.');
    return org;
  }

  async summary(user: any) {
    if (!user.isSuperAdmin) throw new ForbiddenException('Apenas Super Admin pode ver o resumo SaaS.');

    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      organizations,
      totalUsers,
      activeUsers,
      superAdmins,
      activeMemberships,
      datasetsTotal,
      datasetsReady,
      datasetsFailed,
      datasetRows,
      dashboardsTotal,
      dashboardsPublished,
      widgetsTotal,
      templatesTotal,
      auditLast30Days,
      usersLast30Days,
      datasetsByOrg,
      dashboardsByOrg,
      usersByOrg,
      rowsByOrg,
      auditByOrg
    ] = await Promise.all([
      this.prisma.organization.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, status: true, createdAt: true, updatedAt: true, deletedAt: true } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { deletedAt: null, isSuperAdmin: true } }),
      this.prisma.userOrganization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.dataset.count({ where: { deletedAt: null } }),
      this.prisma.dataset.count({ where: { deletedAt: null, status: 'READY' } }),
      this.prisma.dataset.count({ where: { deletedAt: null, status: 'FAILED' } }),
      this.prisma.dataset.aggregate({ where: { deletedAt: null }, _sum: { rowCount: true } }),
      this.prisma.dashboard.count({ where: { deletedAt: null } }),
      this.prisma.dashboard.count({ where: { deletedAt: null, isPublished: true } }),
      this.prisma.dashboardWidget.count({ where: { deletedAt: null } }),
      this.prisma.importTemplate.count({ where: { deletedAt: null } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since30Days } } }),
      this.prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: since30Days } } }),
      this.prisma.dataset.groupBy({ by: ['organizationId'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.dashboard.groupBy({ by: ['organizationId'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.userOrganization.groupBy({ by: ['organizationId'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      this.prisma.dataset.groupBy({ by: ['organizationId'], where: { deletedAt: null }, _sum: { rowCount: true } }),
      this.prisma.auditLog.groupBy({ by: ['organizationId'], where: { organizationId: { not: null } }, _count: { _all: true }, _max: { createdAt: true } })
    ]);

    const toCountMap = (rows: any[]) => new Map(rows.map(row => [row.organizationId, row._count?._all || 0]));
    const datasetCountByOrg = toCountMap(datasetsByOrg);
    const dashboardCountByOrg = toCountMap(dashboardsByOrg);
    const userCountByOrg = toCountMap(usersByOrg);
    const auditCountByOrg = toCountMap(auditByOrg);
    const rowCountByOrg = new Map(rowsByOrg.map((row: any) => [row.organizationId, row._sum?.rowCount || 0]));
    const lastAuditByOrg = new Map(auditByOrg.map((row: any) => [row.organizationId, row._max?.createdAt || null]));

    const organizationUsage = organizations.map(org => ({
      ...org,
      users: userCountByOrg.get(org.id) || 0,
      datasets: datasetCountByOrg.get(org.id) || 0,
      dashboards: dashboardCountByOrg.get(org.id) || 0,
      rows: rowCountByOrg.get(org.id) || 0,
      auditEvents: auditCountByOrg.get(org.id) || 0,
      lastActivityAt: lastAuditByOrg.get(org.id)
    })).sort((a, b) => {
      const scoreA = a.users + a.datasets + a.dashboards + a.auditEvents;
      const scoreB = b.users + b.datasets + b.dashboards + b.auditEvents;
      return scoreB - scoreA || a.name.localeCompare(b.name);
    });

    return {
      generatedAt: new Date(),
      organizations: {
        total: organizations.length,
        active: organizations.filter(org => org.status === 'ACTIVE' && !org.deletedAt).length,
        inactive: organizations.filter(org => org.status === 'INACTIVE' || org.deletedAt).length,
        blocked: organizations.filter(org => org.status === 'BLOCKED').length
      },
      users: { total: totalUsers, active: activeUsers, superAdmins, activeMemberships, activeLast30Days: usersLast30Days },
      datasets: { total: datasetsTotal, ready: datasetsReady, failed: datasetsFailed, rows: datasetRows._sum.rowCount || 0 },
      dashboards: { total: dashboardsTotal, published: dashboardsPublished, widgets: widgetsTotal },
      templates: { total: templatesTotal },
      activity: { auditLast30Days },
      organizationUsage
    };
  }

  async update(id: string, dto: any, user: any, currentOrg?: string) {
    const org = await this.get(id, user);
    const data: any = {};

    if (user.isSuperAdmin) {
      if (dto.name) {
        data.name = dto.name;
        data.slug = slugify(dto.name);
      }
      if (dto.document !== undefined) data.document = dto.document;
      if (dto.status) {
        data.status = dto.status;
        data.deletedAt = dto.status === 'ACTIVE' ? null : org.deletedAt || new Date();
      }
      if (dto.themeConfig !== undefined) data.themeConfig = dto.themeConfig;
    } else {
      if (!currentOrg || currentOrg !== id) throw new ForbiddenException('Admin da organizacao so pode alterar a propria organizacao.');
      const membership = await this.prisma.userOrganization.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: id } }, include: { role: true } });
      if (membership?.role.code !== 'ORG_ADMIN') throw new ForbiddenException('Apenas Admin da Organizacao pode personalizar aparencia.');
      if (dto.themeConfig === undefined) throw new ForbiddenException('Admin da Organizacao so pode alterar aparencia da propria empresa.');
      data.themeConfig = dto.themeConfig;
    }

    const updated = await this.prisma.organization.update({ where: { id: org.id }, data });
    await this.audit.register({ organizationId: id, userId: user.id, action: 'organization.updated', entity: 'organization', entityId: id, metadata: { status: dto.status, themeConfig: dto.themeConfig } });
    return updated;
  }

  async uploadBrandImage(id: string, file: Express.Multer.File, user: any, currentOrg?: string) {
    if (!file) throw new BadRequestException('Imagem nao enviada.');
    const org = await this.get(id, user);
    await this.ensureAppearancePermission(id, user, currentOrg);

    const themeConfig = {
      ...((org.themeConfig as any) || {}),
      brandImageUrl: `/uploads/organizations/${file.filename}`,
      brandImageName: file.originalname,
      brandImageUpdatedAt: new Date().toISOString()
    };

    const updated = await this.prisma.organization.update({ where: { id: org.id }, data: { themeConfig } });
    await this.audit.register({
      organizationId: id,
      userId: user.id,
      action: 'organization.brand_image_uploaded',
      entity: 'organization',
      entityId: id,
      metadata: { brandImageUrl: themeConfig.brandImageUrl }
    });
    return updated;
  }

  async remove(id: string, user: any) {
    if (!user.isSuperAdmin) throw new ForbiddenException('Apenas Super Admin pode remover organizacoes.');
    await this.prisma.organization.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
    return { success: true };
  }

  private async ensureMembership(userId: string, organizationId: string) {
    const membership = await this.prisma.userOrganization.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (!membership || membership.status !== 'ACTIVE') throw new ForbiddenException('Acesso negado.');
    return membership;
  }

  private async ensureAppearancePermission(organizationId: string, user: any, currentOrg?: string) {
    if (user.isSuperAdmin) return;
    if (!currentOrg || currentOrg !== organizationId) throw new ForbiddenException('Admin da organizacao so pode alterar a propria organizacao.');
    const membership = await this.prisma.userOrganization.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId } }, include: { role: true } });
    if (membership?.role.code !== 'ORG_ADMIN') throw new ForbiddenException('Apenas Admin da Organizacao pode personalizar aparencia.');
  }
}
