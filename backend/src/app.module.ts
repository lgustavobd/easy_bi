import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { DatasetsModule } from './modules/datasets/datasets.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { ImportTemplatesModule } from './modules/import-templates/import-templates.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { SectorsModule } from './modules/sectors/sectors.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    DatasetsModule,
    DashboardsModule,
    ImportTemplatesModule,
    AuditLogsModule,
    SectorsModule
  ]
})
export class AppModule {}
