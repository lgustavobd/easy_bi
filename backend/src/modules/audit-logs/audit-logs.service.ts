import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}
  register(input: any) { return this.prisma.auditLog.create({ data: input }); }
  list(organizationId?: string) {
    return this.prisma.auditLog.findMany({
      where: organizationId ? { organizationId } : {},
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 150
    });
  }
}
