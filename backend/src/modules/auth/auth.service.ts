import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { PlansService } from '../plans/plans.service';
import { ChangePasswordDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService, private plans: PlansService) {}

  private jwtSecret(key: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET', fallback: string) {
    const value = this.config.get<string>(key);
    if (value) return value;
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error(`${key} precisa estar configurado em producao.`);
    }
    return fallback;
  }

  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        organizations: { include: { organization: { include: { plan: true } }, role: true } },
        sectors: { include: { sector: true } }
      }
    });

    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('E-mail ou senha inválidos.');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('E-mail ou senha inválidos.');

    await this.assertLoginAllowedByPlan(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      user: this.safeUser(user),
      organizations: await this.availableOrganizations(user),
      ...(await this.issueTokens(user, meta))
    };
  }

  async refresh(refreshToken: string, meta?: { ip?: string; userAgent?: string }) {
    if (!refreshToken) throw new BadRequestException('Refresh token não informado.');

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: this.jwtSecret('JWT_REFRESH_SECRET', 'refresh-secret') });
    } catch {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const rows = await this.prisma.refreshToken.findMany({ where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } } });
    let active: any = null;
    for (const row of rows) if (await bcrypt.compare(refreshToken, row.tokenHash)) active = row;
    if (!active) throw new UnauthorizedException('Refresh token revogado.');

    await this.prisma.refreshToken.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organizations: { include: { organization: { include: { plan: true } }, role: true } } }
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');

    await this.assertLoginAllowedByPlan(user);

    return this.issueTokens(user, meta);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) throw new BadRequestException('A confirmação da nova senha não confere.');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Usuário não encontrado ou inativo.');

    const currentPasswordOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentPasswordOk) throw new BadRequestException('Senha atual inválida.');

    const samePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (samePassword) throw new BadRequestException('A nova senha precisa ser diferente da senha atual.');

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) } });
    await this.prisma.auditLog.create({ data: { userId, action: 'auth.change_password', entity: 'users', entityId: userId, metadata: { source: 'profile' } } });

    return { success: true, message: 'Senha alterada com sucesso.' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizations: { include: { organization: { include: { plan: true } }, role: true } },
        sectors: { include: { sector: true } }
      }
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');

    await this.assertLoginAllowedByPlan(user);

    return {
      user: this.safeUser(user),
      organizations: await this.availableOrganizations(user)
    };
  }

  private async availableOrganizations(user: any) {
    if (user.isSuperAdmin) {
      return [];
    }

    const sectorsByOrg = new Map<string, any[]>();
    for (const relation of user.sectors || []) {
      if (!relation.sector || relation.sector.deletedAt || relation.sector.status !== 'ACTIVE') continue;
      const list = sectorsByOrg.get(relation.organizationId) || [];
      list.push({ id: relation.sector.id, name: relation.sector.name, code: relation.sector.code, isDefault: relation.sector.isDefault });
      sectorsByOrg.set(relation.organizationId, list);
    }

    return (user.organizations || [])
      .filter((membership: any) => membership.status === 'ACTIVE' && membership.organization?.deletedAt === null)
      .map((membership: any) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role.code,
        themeConfig: membership.organization.themeConfig,
        plan: this.serializePlan(membership.organization.plan),
        sectors: sectorsByOrg.get(membership.organization.id) || []
      }));
  }

  private async issueTokens(user: any, meta?: { ip?: string; userAgent?: string }) {
    const payload = { sub: user.id, email: user.email, name: user.name, isSuperAdmin: user.isSuperAdmin };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.jwtSecret('JWT_ACCESS_SECRET', 'dev-secret'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') || '15m'
    });
    const refreshToken = await this.jwt.signAsync({ ...payload, jti: randomUUID() }, {
      secret: this.jwtSecret('JWT_REFRESH_SECRET', 'refresh-secret'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d'
    });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: meta?.ip,
        userAgent: meta?.userAgent
      }
    });
    return { accessToken, refreshToken };
  }

  private async assertLoginAllowedByPlan(user: any) {
    if (user?.isSuperAdmin) return;
    const activeMemberships = (user.organizations || []).filter((membership: any) =>
      membership.status === 'ACTIVE' &&
      membership.organization &&
      membership.organization.deletedAt === null &&
      membership.organization.status === 'ACTIVE'
    );
    for (const membership of activeMemberships) {
      await this.plans.assertOrganizationWithinCurrentPlan(membership.organization.id);
    }
  }

  private safeUser(user: any) {
    return { id: user.id, name: user.name, email: user.email, isSuperAdmin: user.isSuperAdmin, status: user.status };
  }

  private serializePlan(plan: any) {
    if (!plan) return null;
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      limits: {
        maxUsers: plan.maxUsers,
        maxDatasets: plan.maxDatasets,
        maxDashboards: plan.maxDashboards,
        maxRowsPerDataset: plan.maxRowsPerDataset
      },
      features: {
        canExportCharts: plan.canExportCharts,
        canUseCalculatedMetrics: plan.canUseCalculatedMetrics,
        canUsePatchRows: plan.canUsePatchRows,
        canUseAppendRows: plan.canUseAppendRows,
        canUseCustomLogo: plan.canUseCustomLogo,
        canCreateSectors: plan.canCreateSectors
      }
    };
  }
}
