import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ensureAtLeastOneSector, validateSectorIds } from '../../common/utils/sector-access';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService) {}

  async create(dto: any, actor: any, organizationId?: string) {
    const targetOrgId = actor.isSuperAdmin ? dto.organizationId || organizationId : organizationId;
    if (!targetOrgId) throw new ForbiddenException('Organizacao nao informada.');

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BadRequestException('Perfil invalido.');
    if (role.code === 'SUPER_ADMIN') throw new ForbiddenException('Super Admin do SaaS nao pode ser criado por esta tela.');
    if (!actor.isSuperAdmin && role.code === 'ORG_ADMIN') throw new ForbiddenException('Admin da organizacao so pode criar Editor ou Leitor.');

    await this.assertCanManageOrganizationUsers(actor, targetOrgId);
    const sectorIds = role.code === 'ORG_ADMIN'
      ? await this.getAllActiveSectorIds(targetOrgId)
      : await validateSectorIds(this.prisma, actor, targetOrgId, dto.sectorIds);

    const user = await this.prisma.user.upsert({
      where: { email: dto.email.toLowerCase() },
      update: { name: dto.name, status: 'ACTIVE', deletedAt: null },
      create: { name: dto.name, email: dto.email.toLowerCase(), passwordHash: await bcrypt.hash(dto.password, 10) }
    });

    await this.prisma.userOrganization.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: targetOrgId } },
      update: { roleId: dto.roleId, status: 'ACTIVE' },
      create: { userId: user.id, organizationId: targetOrgId, roleId: dto.roleId }
    });
    await this.replaceUserSectors(user.id, targetOrgId, sectorIds);

    await this.audit.register({ organizationId: targetOrgId, userId: actor.id, action: 'user.created', entity: 'user', entityId: user.id, metadata: { role: role.code, sectors: sectorIds } });
    return this.get(user.id, actor, targetOrgId);
  }

  list(actor: any, organizationId?: string) {
    if (actor.isSuperAdmin && !organizationId) {
      return this.prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          ...this.selectGlobal(),
          organizations: { where: { status: 'ACTIVE' }, include: { role: true, organization: true } },
          sectors: { include: { sector: true } }
        },
        orderBy: { createdAt: 'desc' }
      }).then(users => users.map((user: any) => {
        const mainMembership = user.organizations?.[0];
        const scopedSectors = mainMembership
          ? (user.sectors || []).filter((item: any) => item.organizationId === mainMembership.organizationId)
          : [];
        return {
          ...user,
          role: mainMembership?.role,
          organization: mainMembership?.organization,
          sectorIds: scopedSectors.map((item: any) => item.sectorId),
          sectors: scopedSectors.map((item: any) => item.sector).filter(Boolean)
        };
      }));
    }
    if (!organizationId) throw new ForbiddenException('Organizacao nao informada.');
    return this.prisma.user.findMany({
      where: { organizations: { some: { organizationId, status: 'ACTIVE' } }, deletedAt: null },
      select: {
        ...this.selectGlobal(),
        organizations: { where: { organizationId }, include: { role: true, organization: true } },
        sectors: { where: { organizationId }, include: { sector: true } }
      },
      orderBy: { createdAt: 'desc' }
    }).then(users => users.map((user: any) => ({
      ...user,
      role: user.organizations?.[0]?.role,
      organization: user.organizations?.[0]?.organization,
      sectorIds: (user.sectors || []).map((item: any) => item.sectorId),
      sectors: (user.sectors || []).map((item: any) => item.sector).filter(Boolean)
    })));
  }

  async get(id: string, actor: any, organizationId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, ...(actor.isSuperAdmin ? {} : { organizations: { some: { organizationId } } }) },
      select: { ...this.selectGlobal(), organizations: { include: { organization: true, role: true } }, sectors: { include: { sector: true } } }
    });
    if (!user) throw new NotFoundException('Usuario nao encontrado.');
    const scopedSectors = (user.sectors || []).filter((item: any) => !organizationId || item.organizationId === organizationId);
    return {
      ...user,
      sectorIds: scopedSectors.map((item: any) => item.sectorId),
      sectors: scopedSectors.map((item: any) => item.sector).filter(Boolean)
    };
  }

  async update(id: string, dto: any, actor: any, organizationId?: string) {
    const targetOrgId = actor.isSuperAdmin && dto.organizationId
      ? dto.organizationId
      : await this.resolveTargetOrganizationForUser(id, actor, organizationId);
    const fromOrgId = actor.isSuperAdmin ? dto.fromOrganizationId || organizationId : organizationId;
    await this.assertCanManageOrganizationUsers(actor, targetOrgId);

    const currentMembership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: id, organizationId: targetOrgId } },
      include: { role: true }
    });
    if (!currentMembership && !actor.isSuperAdmin) throw new NotFoundException('Usuario nao encontrado nesta organizacao.');
    if (!currentMembership && !dto.roleId) throw new BadRequestException('Informe um perfil para criar o acesso nesta organizacao.');

    let effectiveRole = currentMembership?.role;
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role || role.code === 'SUPER_ADMIN') throw new BadRequestException('Perfil invalido.');
      if (!actor.isSuperAdmin && role.code === 'ORG_ADMIN') throw new ForbiddenException('Admin da organizacao nao pode promover usuarios para Admin da Organizacao.');
      effectiveRole = role;
      await this.prisma.userOrganization.upsert({
        where: { userId_organizationId: { userId: id, organizationId: targetOrgId } },
        update: { roleId: dto.roleId, status: dto.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
        create: { userId: id, organizationId: targetOrgId, roleId: dto.roleId, status: 'ACTIVE' }
      });
    }

    if (actor.isSuperAdmin && fromOrgId && fromOrgId !== targetOrgId) {
      await this.prisma.userOrganization.updateMany({
        where: { userId: id, organizationId: fromOrgId },
        data: { status: 'INACTIVE' }
      });
      await this.prisma.userSector.deleteMany({ where: { userId: id, organizationId: fromOrgId } });
    }

    if (effectiveRole?.code === 'ORG_ADMIN') {
      const sectorIds = await this.getAllActiveSectorIds(targetOrgId);
      await this.replaceUserSectors(id, targetOrgId, sectorIds);
      dto.sectorIds = sectorIds;
    } else if (Array.isArray(dto.sectorIds)) {
      const sectorIds = await validateSectorIds(this.prisma, actor, targetOrgId, dto.sectorIds);
      await this.replaceUserSectors(id, targetOrgId, sectorIds);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, email: dto.email?.toLowerCase(), status: dto.status }
    });

    await this.audit.register({ organizationId: targetOrgId, userId: actor.id, action: 'user.updated', entity: 'user', entityId: id, metadata: { roleId: dto.roleId, status: dto.status, sectors: dto.sectorIds, fromOrganizationId: fromOrgId, organizationId: targetOrgId } });
    return { id: user.id, name: user.name, email: user.email, status: user.status };
  }

  async resetPassword(id: string, password: string, actor: any, organizationId?: string) {
    if (!password || password.length < 8) throw new BadRequestException('A nova senha precisa ter no minimo 8 caracteres.');
    const targetOrgId = await this.resolveTargetOrganizationForUser(id, actor, organizationId);
    await this.assertCanManageOrganizationUsers(actor, targetOrgId);

    await this.prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.register({ organizationId: targetOrgId, userId: actor.id, action: 'user.password_reset', entity: 'user', entityId: id });
    return { success: true };
  }

  async remove(id: string, actor: any, organizationId?: string) {
    const targetOrgId = await this.resolveTargetOrganizationForUser(id, actor, organizationId);
    await this.assertCanManageOrganizationUsers(actor, targetOrgId);
    await this.prisma.userOrganization.update({ where: { userId_organizationId: { userId: id, organizationId: targetOrgId } }, data: { status: 'INACTIVE' } });
    await this.audit.register({ organizationId: targetOrgId, userId: actor.id, action: 'user.removed', entity: 'user', entityId: id });
    return { success: true };
  }

  roles() {
    return this.prisma.role.findMany({ where: { code: { not: 'SUPER_ADMIN' } }, orderBy: { name: 'asc' } });
  }

  private async replaceUserSectors(userId: string, organizationId: string, sectorIds: string[]) {
    if (!sectorIds.length) throw new BadRequestException('O usuario precisa ter pelo menos um setor.');
    await this.prisma.$transaction(async (tx) => {
      await tx.userSector.deleteMany({ where: { userId, organizationId } });
      await tx.userSector.createMany({ data: sectorIds.map((sectorId) => ({ userId, organizationId, sectorId })), skipDuplicates: true });
    });
  }

  private async getAllActiveSectorIds(organizationId: string) {
    await ensureAtLeastOneSector(this.prisma, organizationId);
    const sectors = await this.prisma.sector.findMany({
      where: { organizationId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { name: 'asc' }
    });
    return sectors.map((sector: any) => sector.id);
  }

  private async assertCanManageOrganizationUsers(actor: any, organizationId: string) {
    if (actor.isSuperAdmin) return;
    const membership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: actor.id, organizationId } },
      include: { role: true }
    });
    if (membership?.role.code !== 'ORG_ADMIN') throw new ForbiddenException('Apenas Admin da Organizacao pode gerenciar usuarios desta organizacao.');
  }

  private async resolveTargetOrganizationForUser(userId: string, actor: any, organizationId?: string) {
    if (organizationId) return organizationId;
    if (!actor.isSuperAdmin) throw new ForbiddenException('Organizacao nao informada.');
    const membership = await this.prisma.userOrganization.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    if (!membership) throw new NotFoundException('Usuario nao esta vinculado a nenhuma organizacao ativa.');
    return membership.organizationId;
  }

  private selectGlobal() {
    return { id: true, name: true, email: true, status: true, isSuperAdmin: true, createdAt: true, updatedAt: true };
  }
}
