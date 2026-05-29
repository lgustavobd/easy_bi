import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { slugify } from '../../common/utils/slugify';
import { getAccessibleSectorIds, isOrganizationAdmin } from '../../common/utils/sector-access';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class SectorsService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService) {}

  async list(user: any, organizationId?: string) {
    if (!organizationId) throw new ForbiddenException('Organização não informada.');
    const ids = await getAccessibleSectorIds(this.prisma, user, organizationId);
    return this.prisma.sector.findMany({
      where: { organizationId, deletedAt: null, status: 'ACTIVE', ...(user?.isSuperAdmin || await isOrganizationAdmin(this.prisma, user, organizationId) ? {} : { id: { in: ids } }) },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    });
  }

  async create(dto: any, user: any, organizationId?: string) {
    const targetOrgId = user?.isSuperAdmin ? dto.organizationId || organizationId : organizationId;
    if (!targetOrgId) throw new ForbiddenException('Organização não informada.');
    if (!(await isOrganizationAdmin(this.prisma, user, targetOrgId))) throw new ForbiddenException('Apenas Admin SaaS ou Admin da Organização pode criar setores.');

    const code = String(dto.code || slugify(dto.name)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
    if (!code) throw new BadRequestException('Código do setor inválido.');

    const exists = await this.prisma.sector.findFirst({ where: { organizationId: targetOrgId, code, deletedAt: null } });
    if (exists) throw new BadRequestException('Já existe um setor com esse código nesta organização.');

    const sector = await this.prisma.sector.create({ data: { organizationId: targetOrgId, name: dto.name, code, description: dto.description || null } });
    await this.audit.register({ organizationId: targetOrgId, userId: user.id, action: 'sector.created', entity: 'sector', entityId: sector.id });
    return sector;
  }

  async update(id: string, dto: any, user: any, organizationId?: string) {
    const sector = await this.prisma.sector.findFirst({ where: { id, ...(organizationId ? { organizationId } : {}), deletedAt: null } });
    if (!sector) throw new NotFoundException('Setor não encontrado.');
    if (!(await isOrganizationAdmin(this.prisma, user, sector.organizationId))) throw new ForbiddenException('Apenas Admin SaaS ou Admin da Organização pode editar setores.');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) {
      if (dto.status !== 'ACTIVE') {
        const activeSectors = await this.prisma.sector.count({ where: { organizationId: sector.organizationId, deletedAt: null, status: 'ACTIVE' } });
        if (activeSectors <= 1 && sector.status === 'ACTIVE') throw new BadRequestException('A organizacao precisa ter pelo menos um setor ativo.');
      }
      data.status = dto.status;
    }
    if (dto.code !== undefined) {
      const code = String(dto.code).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
      const exists = await this.prisma.sector.findFirst({ where: { organizationId: sector.organizationId, code, id: { not: id }, deletedAt: null } });
      if (exists) throw new BadRequestException('Ja existe um setor com esse codigo nesta organizacao.');
      data.code = code;
    }

    const updated = await this.prisma.sector.update({ where: { id }, data });
    await this.audit.register({ organizationId: sector.organizationId, userId: user.id, action: 'sector.updated', entity: 'sector', entityId: id });
    return updated;
  }

  async remove(id: string, user: any, organizationId?: string) {
    const sector = await this.prisma.sector.findFirst({ where: { id, ...(organizationId ? { organizationId } : {}), deletedAt: null } });
    if (!sector) throw new NotFoundException('Setor não encontrado.');
    if (sector.isDefault) throw new BadRequestException('O setor padrão não pode ser removido.');
    if (!(await isOrganizationAdmin(this.prisma, user, sector.organizationId))) throw new ForbiddenException('Apenas Admin SaaS ou Admin da Organização pode remover setores.');

    const activeSectors = await this.prisma.sector.count({ where: { organizationId: sector.organizationId, deletedAt: null, status: 'ACTIVE' } });
    if (activeSectors <= 1) throw new BadRequestException('A organização precisa ter pelo menos um setor ativo.');

    await this.prisma.sector.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
    await this.audit.register({ organizationId: sector.organizationId, userId: user.id, action: 'sector.deleted', entity: 'sector', entityId: id });
    return { success: true };
  }
}
