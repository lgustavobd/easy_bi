import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('EasyBI@123', 10);
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

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@easybi.com' },
    update: { passwordHash, isSuperAdmin: true, status: 'ACTIVE' },
    create: { name: 'Admin SaaS Easy BI', email: 'superadmin@easybi.com', passwordHash, isSuperAdmin: true }
  });

  console.log('Seed limpo concluído.');
  console.log('Admin SaaS:', superAdmin.email, 'Senha: EasyBI@123');
}
main().finally(async () => prisma.$disconnect());
