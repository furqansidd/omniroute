import { prisma } from '../../utils/prisma.js';
import { verifyPassword, hashPassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';

export class AuthService {
  static async login(identifier: string, password: string, tenantId?: string) {
    // Find user by email or phone
    const whereCondition = identifier.includes('@')
      ? { email: identifier }
      : { phone: identifier };

    let user;
    if (tenantId) {
      user = await prisma.user.findFirst({
        where: { ...whereCondition, tenantId },
        include: { tenant: true, role: true }
      });
    } else {
      user = await prisma.user.findFirst({
        where: whereCondition,
        include: { tenant: true, role: true }
      });
    }

    if (!user) {
      throw new Error('Invalid email/phone or password');
    }

    if (user.status !== 'active') {
      throw new Error('User account is disabled');
    }

    if (user.tenant.status !== 'active') {
      throw new Error('Tenant subscription is inactive');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email/phone or password');
    }

    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      roleName: user.role.name
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Save refresh token in DB
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt
      }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role.name,
        tenantId: user.tenantId,
        companyName: user.tenant.companyName,
        industryType: user.tenant.industryType
      }
    };
  }

  static async registerRider(dto: { name: string; phone: string; email?: string; password: string; companyName?: string }) {
    if (!dto.name || !dto.phone || !dto.password) {
      throw new Error('Name, Phone, and Password are required');
    }

    let tenant;
    if (dto.companyName) {
      tenant = await prisma.tenant.findFirst({
        where: { companyName: { contains: dto.companyName, mode: 'insensitive' } }
      });
    }

    if (!tenant) {
      tenant = await prisma.tenant.findFirst();
    }

    if (!tenant) {
      throw new Error('No active tenant found to register under');
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: dto.phone },
          ...(dto.email ? [{ email: dto.email }] : [])
        ]
      }
    });

    if (existing) {
      throw new Error('User with this phone or email already exists');
    }

    let riderRole = await prisma.role.findFirst({
      where: {
        OR: [
          { name: 'Rider' },
          { name: { contains: 'Rider' } }
        ]
      }
    });

    if (!riderRole) {
      riderRole = await prisma.role.findFirst({ where: { isSystemRole: false } });
    }

    if (!riderRole) {
      riderRole = await prisma.role.findFirst();
    }

    const passwordHash = await hashPassword(dto.password);

    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        roleId: riderRole!.id,
        name: dto.name,
        phone: dto.phone,
        email: dto.email || null,
        passwordHash,
        status: 'active'
      }
    });

    return this.login(dto.phone, dto.password, tenant.id);
  }

  static async refreshToken(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) await prisma.refreshToken.delete({ where: { token: refreshToken } });
      throw new Error('Invalid or expired refresh token');
    }

    const tokenPayload = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      roleId: payload.roleId,
      roleName: payload.roleName
    };

    const newAccessToken = signAccessToken(tokenPayload);
    return { accessToken: newAccessToken };
  }

  static async logout(refreshToken?: string) {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
    }
    return { success: true };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          include: { settings: true }
        },
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    });

    if (!user) throw new Error('User not found');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      tenant: {
        id: user.tenant.id,
        companyName: user.tenant.companyName,
        industryType: user.tenant.industryType,
        subscriptionTier: user.tenant.subscriptionTier,
        settings: user.tenant.settings
      },
      role: {
        id: user.role.id,
        name: user.role.name,
        description: user.role.description
      },
      permissions: user.role.permissions.map(rp => ({
        module: rp.permission.module,
        action: rp.permission.action
      }))
    };
  }
}
