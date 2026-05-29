import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

type PrismaLike = any;

export async function isOrganizationAdmin(prisma: PrismaLike, user: any, organizationId: string) {
  if (user?.isSuperAdmin) return true;
  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    include: { role: true }
  });
  return membership?.status === 'ACTIVE' && membership?.role?.code === 'ORG_ADMIN';
}

export async function getAccessibleSectorIds(prisma: PrismaLike, user: any, organizationId: string) {
  if (!organizationId) throw new ForbiddenException('Organização não informada.');

  if (await isOrganizationAdmin(prisma, user, organizationId)) {
    const sectors = await prisma.sector.findMany({
      where: { organizationId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true }
    });
    return sectors.map((sector: any) => sector.id);
  }

  const memberships = await prisma.userSector.findMany({
    where: {
      userId: user.id,
      organizationId,
      sector: { deletedAt: null, status: 'ACTIVE' }
    },
    include: { sector: true }
  });
  return memberships.map((item: any) => item.sectorId);
}

export async function ensureSectorAccess(prisma: PrismaLike, user: any, organizationId: string, sectorId?: string | null) {
  const ids = await getAccessibleSectorIds(prisma, user, organizationId);
  if (!ids.length) throw new ForbiddenException('Usuário não possui setor ativo nesta organização.');

  const resolvedSectorId = sectorId || ids[0];
  if (!ids.includes(resolvedSectorId)) throw new ForbiddenException('Usuário não possui acesso a este setor.');

  const sector = await prisma.sector.findFirst({ where: { id: resolvedSectorId, organizationId, deletedAt: null, status: 'ACTIVE' } });
  if (!sector) throw new NotFoundException('Setor não encontrado.');
  return sector;
}

export async function ensureAtLeastOneSector(prisma: PrismaLike, organizationId: string) {
  let sector = await prisma.sector.findFirst({ where: { organizationId, deletedAt: null, status: 'ACTIVE' }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  if (!sector) {
    sector = await prisma.sector.create({
      data: {
        organizationId,
        name: 'Geral',
        code: 'GERAL',
        description: 'Setor padrão criado automaticamente',
        isDefault: true
      }
    });
  }
  return sector;
}

export async function validateSectorIds(prisma: PrismaLike, user: any, organizationId: string, sectorIds?: string[]) {
  const cleanSectorIds = Array.from(new Set((sectorIds || []).filter(Boolean)));
  if (!cleanSectorIds.length) {
    const defaultSector = await ensureAtLeastOneSector(prisma, organizationId);
    return [defaultSector.id];
  }

  const isAdmin = await isOrganizationAdmin(prisma, user, organizationId);
  const allowedIds = isAdmin ? cleanSectorIds : await getAccessibleSectorIds(prisma, user, organizationId);

  const sectors = await prisma.sector.findMany({
    where: { id: { in: cleanSectorIds }, organizationId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true }
  });
  const existingIds = sectors.map((sector: any) => sector.id);

  if (existingIds.length !== cleanSectorIds.length) throw new BadRequestException('Um ou mais setores selecionados não existem nesta organização.');
  if (!isAdmin && cleanSectorIds.some((id) => !allowedIds.includes(id))) throw new ForbiddenException('Você só pode vincular usuários aos setores aos quais possui acesso.');

  return cleanSectorIds;
}
