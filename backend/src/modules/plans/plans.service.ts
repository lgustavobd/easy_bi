import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type PlanFeature =
  | 'canExportCharts'
  | 'canUseCalculatedMetrics'
  | 'canUsePatchRows'
  | 'canUseAppendRows'
  | 'canUseCustomLogo'
  | 'canCreateSectors';

type PlanLimit = 'maxUsers' | 'maxDatasets' | 'maxDashboards' | 'maxRowsPerDataset';
type PlanViolation = { limit: PlanLimit; current: number; max: number; label: string };

const featureLabels: Record<PlanFeature, string> = {
  canExportCharts: 'exportar graficos',
  canUseCalculatedMetrics: 'usar metricas calculadas',
  canUsePatchRows: 'atualizar linhas especificas',
  canUseAppendRows: 'incluir novas linhas',
  canUseCustomLogo: 'usar logo personalizado',
  canCreateSectors: 'criar setores'
};

const limitLabels: Record<PlanLimit, string> = {
  maxUsers: 'usuarios ativos',
  maxDatasets: 'datasets ativos',
  maxDashboards: 'dashboards ativos',
  maxRowsPerDataset: 'linhas por dataset'
};

const limitContextLabels: Record<PlanLimit, string> = {
  maxUsers: 'criar mais usuarios',
  maxDatasets: 'criar mais datasets',
  maxDashboards: 'criar mais dashboards',
  maxRowsPerDataset: 'importar ou atualizar um dataset maior'
};

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async list(user: any) {
    if (!user?.isSuperAdmin) throw new ForbiddenException('Apenas Super Admin pode listar planos.');
    const plans = await this.prisma.plan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return plans.map((plan) => this.serialize(plan));
  }

  async publicList() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
    return plans.map((plan) => this.serialize(plan));
  }

  async getDefaultPlan() {
    const defaultPlan = await this.prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
    return defaultPlan || this.prisma.plan.findFirst({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async resolveAssignablePlanId(planId?: string | null) {
    if (!planId) return (await this.getDefaultPlan())?.id || null;
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) throw new NotFoundException('Plano nao encontrado ou inativo.');
    return plan.id;
  }

  async resolveAssignablePlan(planId?: string | null) {
    const id = await this.resolveAssignablePlanId(planId);
    if (!id) return null;
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async getOrganizationPlan(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, include: { plan: true } });
    if (!organization) throw new NotFoundException('Organizacao nao encontrada.');
    return organization.plan?.isActive ? organization.plan : await this.getDefaultPlan();
  }

  async getOrganizationUsage(organizationId: string) {
    const [users, datasets, dashboards, largestDataset] = await Promise.all([
      this.prisma.userOrganization.count({
        where: { organizationId, status: 'ACTIVE', user: { deletedAt: null, status: 'ACTIVE' } }
      }),
      this.prisma.dataset.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.dashboard.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.dataset.findFirst({
        where: { organizationId, deletedAt: null },
        select: { id: true, name: true, rowCount: true },
        orderBy: { rowCount: 'desc' }
      })
    ]);

    return {
      users,
      datasets,
      dashboards,
      maxRowsPerDataset: largestDataset?.rowCount || 0,
      largestDataset: largestDataset || null
    };
  }

  async getPlanImpact(organizationId: string, targetPlanId: string) {
    const [organization, targetPlan] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId }, include: { plan: true } }),
      this.prisma.plan.findFirst({ where: { id: targetPlanId, isActive: true } })
    ]);
    if (!organization) throw new NotFoundException('Organizacao nao encontrada.');
    if (!targetPlan) throw new NotFoundException('Plano nao encontrado ou inativo.');
    const usage = await this.getOrganizationUsage(organizationId);
    const violations = this.usageViolations(targetPlan, usage);
    return {
      organization: { id: organization.id, name: organization.name },
      currentPlan: this.serialize(organization.plan?.isActive ? organization.plan : await this.getDefaultPlan()),
      requestedPlan: this.serialize(targetPlan),
      usage,
      violations,
      canApply: violations.length === 0,
      message: violations.length
        ? this.planFitMessage(organization.name, targetPlan, violations, 'Antes de reduzir o plano, ajuste o uso atual ou escolha um plano maior.')
        : `A organizacao ${organization.name} cabe no plano ${targetPlan.name}.`
    };
  }

  async assertOrganizationFitsPlan(organizationId: string, targetPlanId: string, action = 'alterar o plano') {
    const impact = await this.getPlanImpact(organizationId, targetPlanId);
    if (!impact.canApply) {
      throw new ForbiddenException(`${this.planFitMessage(impact.organization.name, impact.requestedPlan, impact.violations, `Nao e possivel ${action} agora.`)} Para continuar, melhore o plano ou reduza o uso da organizacao.`);
    }
    return impact;
  }

  async assertOrganizationWithinCurrentPlan(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, include: { plan: true } });
    if (!organization) throw new NotFoundException('Organizacao nao encontrada.');
    const plan = organization.plan?.isActive ? organization.plan : await this.getDefaultPlan();
    const usage = await this.getOrganizationUsage(organizationId);
    const violations = this.usageViolations(plan, usage);
    if (violations.length) {
      throw new ForbiddenException(this.loginBlockedMessage(organization.name, plan, violations));
    }
    return { organization, plan, usage };
  }

  async assertFeature(organizationId: string, feature: PlanFeature) {
    const plan = await this.getOrganizationPlan(organizationId);
    if (!plan?.[feature]) {
      throw new ForbiddenException(`O plano ${plan?.name || 'atual'} nao permite ${featureLabels[feature]}. Para usar este recurso, melhore o plano da organizacao.`);
    }
    return plan;
  }

  async assertLimit(organizationId: string, limit: PlanLimit, nextTotal: number) {
    const plan = await this.getOrganizationPlan(organizationId);
    const max = plan?.[limit];
    if (max !== null && max !== undefined && nextTotal > Number(max)) {
      throw new ForbiddenException(this.limitMessage(plan, limit, Number(max), Number(nextTotal || 0)));
    }
    return plan;
  }

  async assertCanAddUser(organizationId: string, increment = 1) {
    const current = await this.prisma.userOrganization.count({ where: { organizationId, status: 'ACTIVE', user: { deletedAt: null, status: 'ACTIVE' } } });
    return this.assertLimit(organizationId, 'maxUsers', current + increment);
  }

  async assertCanCreateDataset(organizationId: string) {
    const current = await this.prisma.dataset.count({ where: { organizationId, deletedAt: null } });
    return this.assertLimit(organizationId, 'maxDatasets', current + 1);
  }

  async assertDatasetRows(organizationId: string, rows: number) {
    return this.assertLimit(organizationId, 'maxRowsPerDataset', Number(rows || 0));
  }

  async assertCanCreateDashboard(organizationId: string) {
    const current = await this.prisma.dashboard.count({ where: { organizationId, deletedAt: null } });
    return this.assertLimit(organizationId, 'maxDashboards', current + 1);
  }

  private usageViolations(plan: any, usage: any): PlanViolation[] {
    if (!plan) return [];
    const checks: Array<[PlanLimit, number]> = [
      ['maxUsers', usage.users],
      ['maxDatasets', usage.datasets],
      ['maxDashboards', usage.dashboards],
      ['maxRowsPerDataset', usage.maxRowsPerDataset]
    ];
    return checks
      .map(([limit, current]) => {
        const max = plan[limit];
        if (max === null || max === undefined || Number(current || 0) <= Number(max)) return null;
        return { limit, current: Number(current || 0), max: Number(max), label: limitLabels[limit] };
      })
      .filter(Boolean) as PlanViolation[];
  }

  private describeViolations(violations: PlanViolation[]) {
    return violations
      .map((violation) => `${violation.label}: uso atual ${violation.current.toLocaleString('pt-BR')} / limite ${violation.max.toLocaleString('pt-BR')}`)
      .join('; ');
  }

  private loginBlockedMessage(organizationName: string, plan: any, violations: PlanViolation[]) {
    return `Login bloqueado pelo plano da organizacao ${organizationName}. O plano ${plan?.name || 'atual'} esta com limite excedido: ${this.describeViolations(violations)}. Entre em contato com o Admin do sistema para melhorar o plano.`;
  }

  private planFitMessage(organizationName: string, plan: any, violations: PlanViolation[], prefix: string) {
    return `${prefix} A organizacao ${organizationName} nao cabe no plano ${plan?.name || 'selecionado'}: ${this.describeViolations(violations)}.`;
  }

  private limitMessage(plan: any, limit: PlanLimit, max: number, attempted: number) {
    const allowed = max.toLocaleString('pt-BR');
    const next = attempted.toLocaleString('pt-BR');
    if (limit === 'maxRowsPerDataset') {
      return `Importacao bloqueada pelo plano ${plan.name}. O arquivo/atualizacao possui ${next} linhas, mas este plano permite ate ${allowed} linhas por dataset. Para importar uma carga maior, melhore o plano da organizacao.`;
    }
    return `Acao bloqueada pelo plano ${plan.name}. Limite permitido: ${allowed} ${limitLabels[limit]}. Tentativa: ${next} ${limitLabels[limit]}. Para ${limitContextLabels[limit]}, melhore o plano da organizacao.`;
  }

  serialize(plan: any) {
    if (!plan) return null;
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceLabel: plan.priceLabel,
      monthlyPrice: plan.monthlyPrice === null || plan.monthlyPrice === undefined ? null : Number(plan.monthlyPrice),
      currency: plan.currency || 'BRL',
      isDefault: plan.isDefault,
      isActive: plan.isActive,
      limits: {
        maxUsers: plan.maxUsers,
        maxDatasets: plan.maxDatasets,
        maxDashboards: plan.maxDashboards,
        maxRowsPerDataset: plan.maxRowsPerDataset
      },
      features: {
        canExportCharts: plan.canExportCharts,
        canUseCalculatedMetrics: plan.canUseCalculatedMetrics,
        canUsePatchRows: plan.canUsePatchRows,
        canUseAppendRows: plan.canUseAppendRows,
        canUseCustomLogo: plan.canUseCustomLogo,
        canCreateSectors: plan.canCreateSectors
      }
    };
  }
}
