import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService]
})
export class AccessRequestsModule {}
