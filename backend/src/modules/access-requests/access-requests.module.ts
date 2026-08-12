import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService]
})
export class AccessRequestsModule {}
