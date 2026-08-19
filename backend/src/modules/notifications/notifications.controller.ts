import { Controller, Get, Headers, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: any, @Headers('x-organization-id') organizationId?: string) {
    return this.service.list(user, organizationId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any, @Headers('x-organization-id') organizationId?: string) {
    return this.service.unreadCount(user, organizationId);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: any, @Headers('x-organization-id') organizationId?: string) {
    return this.service.markAllAsRead(user, organizationId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: any, @Headers('x-organization-id') organizationId?: string) {
    return this.service.markAsRead(id, user, organizationId);
  }
}
