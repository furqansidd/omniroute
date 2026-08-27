import { Request, Response, NextFunction } from 'express';

export function requirePermission(module: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Super Admin or Tenant Owner with wildcard permissions check
    const hasPerm = req.user.permissions.some(p => 
      (p.module === module || p.module === '*') && 
      (p.action === action || p.action === '*')
    );

    if (!hasPerm) {
      res.status(403).json({ 
        success: false, 
        error: `Forbidden: Missing required permission [${module}:${action}]` 
      });
      return;
    }

    next();
  };
}
