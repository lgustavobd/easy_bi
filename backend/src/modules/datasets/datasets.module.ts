import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DatasetsController } from './datasets.controller';
import { DatasetsService } from './datasets.service';
import { ColumnAnalyzerService } from './services/column-analyzer.service';
import { FileParserService } from './services/file-parser.service';
@Module({ imports: [AuditLogsModule], controllers: [DatasetsController], providers: [DatasetsService, ColumnAnalyzerService, FileParserService], exports: [DatasetsService] })
export class DatasetsModule {}
