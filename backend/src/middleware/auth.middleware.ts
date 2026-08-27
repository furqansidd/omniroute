import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';

export interface AuthenticatedUser extends TokenPayload {
  name: string;
  email: string | null;
  phone: string | null;
  permissions: Array<{ module: string; action: string }>;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication token required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    // Fetch user with role permissions & tenant to ensure account is active and build permission list
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        tenant: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    if (!dbUser || dbUser.status !== 'active' || dbUser.tenant.status !== 'active') {
      res.status(403).json({ success: false, error: 'User or tenant account is inactive' });
      return;
    }

    let permissions = dbUser.role.permissions.map(rp => ({
      module: rp.permission.module,
      action: rp.permission.action
    }));

    // Grant wildcard permission to Tenant Owner/Admin and Super Admin system roles
    const roleNameLower = (dbUser.role.name || '').toLowerCase();
    if (roleNameLower.includes('owner') || roleNameLower.includes('super admin') || roleNameLower.includes('admin')) {
      permissions.push({ module: '*', action: '*' });
    }

    req.user = {
      userId: dbUser.id,
      tenantId: dbUser.tenantId,
      roleId: dbUser.roleId,
      roleName: dbUser.role.name,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      permissions
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired access token' });
  }
}
