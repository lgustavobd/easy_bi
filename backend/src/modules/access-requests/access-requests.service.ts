import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { slugify } from '../../common/utils/slugify';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class AccessRequestsService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService, private plans: PlansService) {}

  async create(dto: any) {
    const requestedPlanId = dto.requestedPlanId || (await this.plans.getDefaultPlan())?.id || null;
    if (requestedPlanId) await this.plans.resolveAssignablePlanId(requestedPlanId);

    const request = await this.prisma.accessRequest.create({
      data: {
        requesterName: dto.requesterName,
        requesterEmail: dto.requesterEmail.toLowerCase(),
        phone: dto.phone,
        companyName: dto.companyName,
        document: dto.document,
        requestedPlanId,
        message: dto.message
      },
      include: { requestedPlan: true }
    });
    return this.serialize(request);
  }

  async list(user: any) {
    this.ensureSuperAdmin(user);
    const requests = await this.prisma.accessRequest.findMany({
      include: { requestedPlan: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    });
    return Promise.all(requests.map((request: any) => this.serializeWithCreatedRecords(request)));
  }

  async review(id: string, dto: any, user: any) {
    this.ensureSuperAdmin(user);
    const request = await this.prisma.accessRequest.findUnique({ where: { id }, include: { requestedPlan: true } });
    if (!request) throw new NotFoundException('Solicitacao de acesso nao encontrada.');
    if (request.status !== 'PENDING') throw new BadRequestException('Esta solicitacao ja foi analisada.');

    if (dto.status === 'REJECTED') {
      const rejected = await this.prisma.accessRequest.update({
        where: { id },
        data: { status: 'REJECTED', adminNotes: dto.adminNotes, reviewedByUserId: user.id, reviewedAt: new Date() },
        include: { requestedPlan: true }
      });
      await this.audit.register({ userId: user.id, action: 'access_request.rejected', entity: 'access_request', entityId: id });
      return this.serialize(rejected);
    }

    const selectedPlan = await this.plans.resolveAssignablePlan(dto.planId || request.requestedPlanId);
    const planId = selectedPlan?.id || null;
    const requestedTrialDays = Number(dto.trialDays || 0);
    const accessExpiresAt = requestedTrialDays > 0
      ? new Date(Date.now() + requestedTrialDays * 24 * 60 * 60 * 1000)
      : this.plans.accessExpirationForPlan(selectedPlan);
    const organizationName = dto.organizationName || request.companyName;
    const userName = dto.userName || request.requesterName;
    const userEmail = String(dto.userEmail || request.requesterEmail).toLowerCase();
    const password = String(dto.password || '').trim();
    if (!password || password.length < 8) {
      throw new BadRequestException('Informe uma senha inicial com pelo menos 8 caracteres para aprovar o acesso.');
    }
    const orgAdminRole = await this.prisma.role.findUnique({ where: { code: 'ORG_ADMIN' } });
    if (!orgAdminRole) throw new BadRequestException('Perfil Admin da Organizacao nao encontrado. Rode o seed de permissoes.');

    const slug = await this.uniqueSlug(organizationName);
    const passwordHash = await bcrypt.hash(password, 10);

    const approved = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          document: dto.document || request.document,
          planId,
          accessExpiresAt,
          themeConfig: { accent: 'PURPLE', primary: '#7C3AED' }
        }
      });

      const sector = await tx.sector.create({
        data: {
          organizationId: organization.id,
          name: 'Geral',
          code: 'GERAL',
          description: 'Setor padrao da organizacao',
          isDefault: true
        }
      });

      const createdUser = await tx.user.upsert({
        where: { email: userEmail },
        update: { name: userName, passwordHash, status: 'ACTIVE', deletedAt: null },
        create: { name: userName, email: userEmail, passwordHash }
      });

      await tx.userOrganization.upsert({
        where: { userId_organizationId: { userId: createdUser.id, organizationId: organization.id } },
        update: { roleId: orgAdminRole.id, status: 'ACTIVE' },
        create: { userId: createdUser.id, organizationId: organization.id, roleId: orgAdminRole.id }
      });

      await tx.userSector.createMany({
        data: [{ userId: createdUser.id, organizationId: organization.id, sectorId: sector.id }],
        skipDuplicates: true
      });

      return tx.accessRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminNotes: dto.adminNotes,
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          createdOrganizationId: organization.id,
          createdUserId: createdUser.id
        },
        include: { requestedPlan: true }
      });
    });

    await this.audit.register({
      organizationId: approved.createdOrganizationId,
      userId: user.id,
      action: 'access_request.approved',
      entity: 'access_request',
      entityId: id,
      metadata: { createdUserId: approved.createdUserId, planId, accessExpiresAt }
    });
    return this.serializeWithCreatedRecords(approved);
  }

  private ensureSuperAdmin(user: any) {
    if (!user?.isSuperAdmin) throw new ForbiddenException('Apenas Super Admin pode analisar solicitacoes de acesso.');
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name) || 'organizacao';
    let slug = base;
    let index = 2;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${base}-${index}`;
      index += 1;
    }
    return slug;
  }

  private async serializeWithCreatedRecords(request: any) {
    const [organization, createdUser] = await Promise.all([
      request.createdOrganizationId ? this.prisma.organization.findUnique({ where: { id: request.createdOrganizationId }, include: { plan: true } }) : null,
      request.createdUserId ? this.prisma.user.findUnique({ where: { id: request.createdUserId }, select: { id: true, name: true, email: true, status: true } }) : null
    ]);
    return this.serialize({ ...request, createdOrganization: organization, createdUser });
  }

  private serialize(request: any) {
    return {
      ...request,
      requestedPlan: this.plans.serialize(request?.requestedPlan),
      createdOrganization: request?.createdOrganization ? { ...request.createdOrganization, plan: this.plans.serialize(request.createdOrganization.plan) } : undefined
    };
  }
}
