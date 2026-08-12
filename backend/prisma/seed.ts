import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || 'EasyBI@123';
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_SUPER_ADMIN_PASSWORD) {
    throw new Error('SEED_SUPER_ADMIN_PASSWORD precisa estar configurado para rodar seed em producao.');
  }
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const plans = [
    {
      id: '00000000-0000-0000-0000-000000000101',
      code: 'STARTER',
      name: 'Starter',
      description: 'Plano inicial para validar uso com poucos dados.',
      priceLabel: 'R$ 148,50/mes',
      monthlyPrice: 148.50,
      maxUsers: 1,
      maxDatasets: 5,
      maxDashboards: 3,
      maxRowsPerDataset: 2000,
      canExportCharts: false,
      canUseCalculatedMetrics: false,
      canUsePatchRows: false,
      canUseAppendRows: false,
      canUseCustomLogo: false,
      canCreateSectors: false,
      isDefault: true,
      isActive: true,
      sortOrder: 10
    },
    {
      id: '00000000-0000-0000-0000-000000000102',
      code: 'PRO',
      name: 'Pro',
      description: 'Plano para operacao com mais dashboards e metricas.',
      priceLabel: 'R$ 373,50/mes',
      monthlyPrice: 373.50,
      maxUsers: 5,
      maxDatasets: 25,
      maxDashboards: 15,
      maxRowsPerDataset: 5000,
      canExportCharts: true,
      canUseCalculatedMetrics: true,
      canUsePatchRows: false,
      canUseAppendRows: true,
      canUseCustomLogo: false,
      canCreateSectors: true,
      isDefault: false,
      isActive: true,
      sortOrder: 20
    },
    {
      id: '00000000-0000-0000-0000-000000000103',
      code: 'BUSINESS',
      name: 'Business',
      description: 'Plano completo para organizacoes em producao.',
      priceLabel: 'R$ 748,50/mes',
      monthlyPrice: 748.50,
      maxUsers: 10,
      maxDatasets: 100,
      maxDashboards: 60,
      maxRowsPerDataset: 11000,
      canExportCharts: true,
      canUseCalculatedMetrics: true,
      canUsePatchRows: true,
      canUseAppendRows: true,
      canUseCustomLogo: true,
      canCreateSectors: true,
      isDefault: false,
      isActive: true,
      sortOrder: 30
    }
  ];
  const permissions = [
    ['Visualizar dashboard', 'dashboard.view'],
    ['Criar dashboard', 'dashboard.create'],
    ['Editar dashboard', 'dashboard.edit'],
    ['Excluir dashboard', 'dashboard.delete'],
    ['Carregar dataset', 'dataset.upload'],
    ['Reprocessar dataset', 'dataset.reprocess'],
    ['Gerenciar usuários', 'users.manage'],
    ['Gerenciar organização', 'organization.manage'],
    ['Visualizar auditoria', 'audit.view']
  ];

  for (const [name, code] of permissions) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { name, code, description: name } });
  }

  for (const plan of plans) {
    const { id, code, ...data } = plan;
    await prisma.plan.upsert({ where: { code }, update: data, create: { id, code, ...data } });
  }
  await prisma.plan.updateMany({ where: { code: 'ENTERPRISE' }, data: { isActive: false } });

  const superRole = await prisma.role.upsert({ where: { code: 'SUPER_ADMIN' }, update: {}, create: { name: 'Super Admin', code: 'SUPER_ADMIN', description: 'Administrador global do SaaS' } });
  const orgAdminRole = await prisma.role.upsert({ where: { code: 'ORG_ADMIN' }, update: {}, create: { name: 'Admin da Organização', code: 'ORG_ADMIN', description: 'Administrador da organização' } });
  const editorRole = await prisma.role.upsert({ where: { code: 'EDITOR' }, update: {}, create: { name: 'Editor', code: 'EDITOR', description: 'Cria e edita dashboards/datasets permitidos' } });
  const readerRole = await prisma.role.upsert({ where: { code: 'READER' }, update: {}, create: { name: 'Leitor', code: 'READER', description: 'Visualiza dashboards liberados' } });

  const all = await prisma.permission.findMany();
  async function grant(roleId: string, codes: string[]) {
    const perms = codes.includes('*') ? all : all.filter(p => codes.includes(p.code));
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: p.id } },
        update: {},
        create: { roleId, permissionId: p.id }
      });
    }
  }

  await grant(superRole.id, ['*']);
  await grant(orgAdminRole.id, ['*']);
  await grant(editorRole.id, ['dashboard.view', 'dashboard.create', 'dashboard.edit', 'dataset.upload', 'dataset.reprocess']);
  await grant(readerRole.id, ['dashboard.view']);

  await prisma.user.upsert({
    where: { email: 'superadmin@easybi.com' },
    update: { passwordHash, isSuperAdmin: true, status: 'ACTIVE' },
    create: { name: 'Admin SaaS Easy BI', email: 'superadmin@easybi.com', passwordHash, isSuperAdmin: true }
  });

  console.log('Seed limpo concluído.');
}
main().finally(async () => prisma.$disconnect());
