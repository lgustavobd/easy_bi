import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type NotificationPayload = {
  organizationId?: string | null;
  userIds: string[];
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
};

type NotificationTargetPayload = Omit<NotificationPayload, 'userIds'>;

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async list(user: any, organizationId?: string) {
    await this.ensureNotificationScope(user, organizationId);
    return this.prisma.notification.findMany({
      where: this.userNotificationWhere(user, organizationId),
      orderBy: { createdAt: 'desc' },
      take: 30
    });
  }

  async unreadCount(user: any, organizationId?: string) {
    await this.ensureNotificationScope(user, organizationId);
    const count = await this.prisma.notification.count({
      where: { ...this.userNotificationWhere(user, organizationId), readAt: null }
    });
    return { count };
  }

  async markAsRead(id: string, user: any, organizationId?: string) {
    await this.ensureNotificationScope(user, organizationId);
    const notification = await this.prisma.notification.findFirst({
      where: { id, ...this.userNotificationWhere(user, organizationId) }
    });
    if (!notification) throw new NotFoundException('Notificacao nao encontrada.');
    if (notification.readAt) return notification;
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllAsRead(user: any, organizationId?: string) {
    await this.ensureNotificationScope(user, organizationId);
    const result = await this.prisma.notification.updateMany({
      where: { ...this.userNotificationWhere(user, organizationId), readAt: null },
      data: { readAt: new Date() }
    });
    return { success: true, count: result.count };
  }

  async notifyUsers(payload: NotificationPayload) {
    const userIds = Array.from(new Set((payload.userIds || []).filter(Boolean)));
    if (!userIds.length) return { count: 0 };
    const result = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        organizationId: payload.organizationId || null,
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata || undefined
      }))
    });
    return { count: result.count };
  }

  async notifySuperAdmins(payload: NotificationTargetPayload) {
    const users = await this.prisma.user.findMany({
      where: { isSuperAdmin: true, status: 'ACTIVE', deletedAt: null },
      select: { id: true }
    });
    return this.notifyUsers({ ...payload, userIds: users.map((user) => user.id) });
  }

  async notifyOrganizationAdmins(organizationId: string, payload: Omit<NotificationTargetPayload, 'organizationId'>) {
    const memberships = await this.prisma.userOrganization.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        role: { code: 'ORG_ADMIN' },
        user: { status: 'ACTIVE', deletedAt: null }
      },
      select: { userId: true }
    });
    return this.notifyUsers({ ...payload, organizationId, userIds: memberships.map((membership) => membership.userId) });
  }

  async notifyUser(userId: string, payload: NotificationTargetPayload) {
    return this.notifyUsers({ ...payload, userIds: [userId] });
  }

  private userNotificationWhere(user: any, organizationId?: string) {
    if (user?.isSuperAdmin) return { userId: user.id };
    return {
      userId: user.id,
      OR: [{ organizationId: String(organizationId) }, { organizationId: null }]
    };
  }

  private async ensureNotificationScope(user: any, organizationId?: string) {
    if (!user?.id) throw new ForbiddenException('Usuario nao autenticado.');
    if (user.isSuperAdmin) return;
    if (!organizationId) throw new ForbiddenException('Organizacao ativa nao informada.');
    const membership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: String(organizationId) } },
      include: { organization: { select: { status: true, deletedAt: true } } }
    });
    if (!membership || membership.status !== 'ACTIVE' || membership.organization?.deletedAt || membership.organization?.status !== 'ACTIVE') {
      throw new ForbiddenException('Usuario sem acesso a esta organizacao.');
    }
  }
}
