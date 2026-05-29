import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SectorsController } from './sectors.controller';
import { SectorsService } from './sectors.service';

@Module({ imports: [PrismaModule, AuditLogsModule], controllers: [SectorsController], providers: [SectorsService] })
export class SectorsModule {}
