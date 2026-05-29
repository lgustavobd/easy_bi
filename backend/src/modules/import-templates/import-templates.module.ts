import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { ImportTemplatesController } from './import-templates.controller';
import { ImportTemplatesService } from './import-templates.service';
@Module({ imports: [AuditLogsModule, DatasetsModule], controllers: [ImportTemplatesController], providers: [ImportTemplatesService] })
export class ImportTemplatesModule {}
