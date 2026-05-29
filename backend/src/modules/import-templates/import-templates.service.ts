import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getAccessibleSectorIds, ensureSectorAccess } from '../../common/utils/sector-access';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatasetsService } from '../datasets/datasets.service';

@Injectable()
export class ImportTemplatesService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService, private datasets: DatasetsService) {}

  async create(dto: any, organizationId: string, user: any) {
    const sector = await ensureSectorAccess(this.prisma, user, organizationId, dto.sectorId);
    return this.prisma.importTemplate.create({ data: { organizationId, sectorId: sector.id, createdByUserId: user.id, ...dto } as any, include: { sector: true } });
  }

  async list(organizationId: string, user: any, sectorId?: string) {
    const sectorIds = await getAccessibleSectorIds(this.prisma, user, organizationId);
    if (!sectorIds.length) return [];
    const filterIds = sectorId ? (sectorIds.includes(sectorId) ? [sectorId] : []) : sectorIds;
    if (sectorId && !filterIds.length) return [];
    return this.prisma.importTemplate.findMany({
      where: { organizationId, deletedAt: null, ...(filterIds.length ? { sectorId: { in: filterIds } } : {}) },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        sector: true,
        datasets: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, rowCount: true, metadata: true, createdAt: true, sectorId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async get(id: string, organizationId: string, user: any) {
    const sectorIds = await getAccessibleSectorIds(this.prisma, user, organizationId);
    if (!sectorIds.length) throw new NotFoundException('Modelo de importação não encontrado.');
    const item = await this.prisma.importTemplate.findFirst({
      where: { id, organizationId, deletedAt: null, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        sector: true,
        datasets: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, rowCount: true, metadata: true, createdAt: true, sectorId: true } }
      }
    });
    if (!item) throw new NotFoundException('Modelo de importação não encontrado.');
    return item;
  }

  async update(id: string, dto: any, organizationId: string, user: any) {
    const previous = await this.get(id, organizationId, user);
    const previousCalculatedNames = this.calculatedMetricNames(previous);
    const data = { ...dto };
    if (dto.sectorId) {
      const sector = await ensureSectorAccess(this.prisma, user, organizationId, dto.sectorId);
      data.sectorId = sector.id;
    }
    const item = await this.prisma.importTemplate.update({ where: { id }, data, include: { sector: true } });
    const nextCalculatedNames = this.calculatedMetricNames(item);
    if (previousCalculatedNames.length || nextCalculatedNames.length) {
      await this.datasets.applyTemplateCalculations(id, organizationId, user, previousCalculatedNames);
    }
    await this.audit.register({ organizationId, userId: user.id, action: 'import_template.updated', entity: 'import_template', entityId: id });
    return item;
  }

  async remove(id: string, organizationId: string, user: any) {
    await this.get(id, organizationId, user);
    await this.prisma.importTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.register({ organizationId, userId: user.id, action: 'import_template.deleted', entity: 'import_template', entityId: id });
    return { success: true };
  }

  private calculatedMetricNames(template: any) {
    const rules = template?.transformationRules && typeof template.transformationRules === 'object' ? template.transformationRules : {};
    const calculatedMetrics = Array.isArray((rules as any).calculatedMetrics) ? (rules as any).calculatedMetrics : [];
    return calculatedMetrics
      .map((item: any) => String(item?.name || item?.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase())
      .filter(Boolean);
  }
}
