import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getAccessibleSectorIds, ensureSectorAccess } from '../../common/utils/sector-access';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatasetsService } from '../datasets/datasets.service';
import { PlansService } from '../plans/plans.service';

const DATA_TYPES = new Set(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'CURRENCY', 'PERCENTAGE']);
const SEMANTIC_TYPES = new Set(['METRIC', 'DIMENSION', 'TIME_DIMENSION', 'FINANCIAL_METRIC', 'CATEGORY', 'IDENTIFIER', 'DESCRIPTION']);

@Injectable()
export class ImportTemplatesService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService, private datasets: DatasetsService, private plans: PlansService) {}

  async create(dto: any, organizationId: string, user: any) {
    if (this.calculatedMetricNames(dto).length) await this.plans.assertFeature(organizationId, 'canUseCalculatedMetrics');
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
    if (dto.transformationRules !== undefined && this.calculatedMetricNames({ transformationRules: dto.transformationRules }).length) {
      await this.plans.assertFeature(organizationId, 'canUseCalculatedMetrics');
    }
    if (dto.sectorId) {
      const sector = await ensureSectorAccess(this.prisma, user, organizationId, dto.sectorId);
      data.sectorId = sector.id;
    }
    const item = await this.prisma.importTemplate.update({ where: { id }, data, include: { sector: true } });
    const nextCalculatedNames = this.calculatedMetricNames(item);
    if (previousCalculatedNames.length || nextCalculatedNames.length) {
      await this.datasets.applyTemplateCalculations(id, organizationId, user, previousCalculatedNames);
    }
    await this.syncLinkedDatasetColumns(id, organizationId, item);
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

  private async syncLinkedDatasetColumns(templateId: string, organizationId: string, template: any) {
    const detectedTypes = Array.isArray(template?.detectedTypes) ? template.detectedTypes : [];
    if (!detectedTypes.length) return;

    const datasets = await this.prisma.dataset.findMany({
      where: { organizationId, importTemplateId: templateId, deletedAt: null },
      select: { id: true }
    });
    const datasetIds = datasets.map((dataset) => dataset.id);
    if (!datasetIds.length) return;

    const metricKeys = new Set(this.asStringList(template.metrics).map((name) => this.normalizeColumnKey(name)));
    const dimensionKeys = new Set(this.asStringList(template.dimensions).map((name) => this.normalizeColumnKey(name)));

    for (const column of detectedTypes) {
      const name = String(column?.name || '').trim();
      if (!name) continue;
      const key = this.normalizeColumnKey(name);
      const isMetric = metricKeys.has(key);
      const isDimension = dimensionKeys.has(key);
      const dataType = String(column?.dataType || '').toUpperCase();
      const semanticType = String(column?.semanticType || (isMetric ? 'METRIC' : isDimension ? 'CATEGORY' : '')).toUpperCase();
      const data: Record<string, any> = {
        isMetric,
        isDimension
      };

      if (DATA_TYPES.has(dataType)) data.dataType = dataType;
      if (SEMANTIC_TYPES.has(semanticType)) data.semanticType = semanticType;
      if (column?.formatConfig && typeof column.formatConfig === 'object') data.formatConfig = column.formatConfig;

      await this.prisma.datasetColumn.updateMany({
        where: { datasetId: { in: datasetIds }, name },
        data
      });
    }
  }

  private asStringList(value: any) {
    return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
  }

  private normalizeColumnKey(value: string) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  }
}
