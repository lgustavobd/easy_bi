import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class PlanChangeRequestsService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService, private plans: PlansService) {}

  async create(dto: any, user: any, organizationId?: string) {
    if (!organizationId) throw new ForbiddenException('Organizacao ativa nao informada.');
    await this.ensureOrganizationAdmin(user, organizationId);
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, include: { plan: true } });
    if (!organization) throw new NotFoundException('Organizacao nao encontrada.');
    const requestedPlanId = await this.plans.resolveAssignablePlanId(dto.requestedPlanId);
    if (organization.planId === requestedPlanId) throw new BadRequestException('A organizacao ja esta neste plano.');
    const impact = await this.plans.getPlanImpact(organizationId, requestedPlanId);
    if (!impact.canApply) throw new ForbiddenException(impact.message);

    const pending = await this.prisma.planChangeRequest.findFirst({ where: { organizationId, status: 'PENDING' } });
    if (pending) throw new BadRequestException('Esta organizacao ja possui uma solicitacao de plano pendente.');

    const request = await this.prisma.planChangeRequest.create({
      data: {
        organizationId,
        currentPlanId: organization.planId,
        requestedPlanId,
        requestedByUserId: user.id,
        reason: dto.reason
      },
      include: { organization: { include: { plan: true } }, requestedPlan: true, requestedBy: { select: { id: true, name: true, email: true } } }
    });
    await this.audit.register({ organizationId, userId: user.id, action: 'plan_change.requested', entity: 'plan_change_request', entityId: request.id, metadata: { requestedPlanId } });
    return { ...(await this.hydrateCurrentPlans([request]))[0], impact };
  }

  async list(user: any, organizationId?: string) {
    if (user?.isSuperAdmin) {
      const requests = await this.prisma.planChangeRequest.findMany({
        include: { organization: { include: { plan: true } }, requestedPlan: true, requestedBy: { select: { id: true, name: true, email: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
      });
      return this.hydrateCurrentPlans(requests);
    }

    if (!organizationId) throw new ForbiddenException('Organizacao ativa nao informada.');
    await this.ensureOrganizationAdmin(user, organizationId);
    const requests = await this.prisma.planChangeRequest.findMany({
      where: { organizationId },
      include: { organization: { include: { plan: true } }, requestedPlan: true, requestedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return this.hydrateCurrentPlans(requests);
  }

  async impact(planId: string, user: any, organizationId?: string) {
    if (!organizationId) throw new ForbiddenException('Organizacao ativa nao informada.');
    await this.ensureOrganizationAdmin(user, organizationId);
    return this.plans.getPlanImpact(organizationId, planId);
  }

  async review(id: string, dto: any, user: any) {
    if (!user?.isSuperAdmin) throw new ForbiddenException('Apenas Super Admin pode aprovar troca de plano.');
    const request = await this.prisma.planChangeRequest.findUnique({
      where: { id },
      include: { organization: { include: { plan: true } }, requestedPlan: true, requestedBy: { select: { id: true, name: true, email: true } } }
    });
    if (!request) throw new NotFoundException('Solicitacao de plano nao encontrada.');
    if (request.status !== 'PENDING') throw new BadRequestException('Esta solicitacao ja foi analisada.');

    if (dto.status === 'APPROVED') {
      await this.plans.assertOrganizationFitsPlan(request.organizationId, request.requestedPlanId, 'aprovar esta troca de plano');
      await this.prisma.organization.update({ where: { id: request.organizationId }, data: { planId: request.requestedPlanId } });
    }

    const reviewed = await this.prisma.planChangeRequest.update({
      where: { id },
      data: { status: dto.status, adminNotes: dto.adminNotes, reviewedByUserId: user.id, reviewedAt: new Date() },
      include: { organization: { include: { plan: true } }, requestedPlan: true, requestedBy: { select: { id: true, name: true, email: true } } }
    });

    await this.audit.register({
      organizationId: request.organizationId,
      userId: user.id,
      action: dto.status === 'APPROVED' ? 'plan_change.approved' : 'plan_change.rejected',
      entity: 'plan_change_request',
      entityId: id,
      metadata: { requestedPlanId: request.requestedPlanId }
    });
    return (await this.hydrateCurrentPlans([reviewed]))[0];
  }

  private async ensureOrganizationAdmin(user: any, organizationId: string) {
    if (user?.isSuperAdmin) return;
    const membership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
      include: { role: true }
    });
    if (!membership || membership.status !== 'ACTIVE' || membership.role.code !== 'ORG_ADMIN') {
      throw new ForbiddenException('Apenas Admin da Organizacao pode solicitar troca de plano.');
    }
  }

  private async hydrateCurrentPlans(requests: any[]) {
    const currentPlanIds = Array.from(new Set(requests.map((request: any) => request.currentPlanId).filter(Boolean)));
    const currentPlans = currentPlanIds.length
      ? await this.prisma.plan.findMany({ where: { id: { in: currentPlanIds } } })
      : [];
    const currentPlanById = new Map(currentPlans.map((plan: any) => [plan.id, plan]));
    return requests.map((request: any) => ({
      ...request,
      currentPlan: this.plans.serialize(currentPlanById.get(request.currentPlanId)),
      requestedPlan: this.plans.serialize(request.requestedPlan),
      organization: request.organization ? { ...request.organization, plan: this.plans.serialize(request.organization.plan) } : undefined
    }));
  }
}
