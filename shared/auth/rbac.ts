// shared/auth/rbac.ts
import { AppError } from '../errors/AppError.js';

export function checkRoleAuthorization(
  userRole: string | string[],
  allowedRoles: string[]
): void {
  const userRoles = Array.isArray(userRole) ? userRole : [userRole];
  
  const hasPermission = userRoles.some(role => allowedRoles.includes(role));
  
  if (!hasPermission) {
    throw new AppError('FORBIDDEN', 403, 'Insufficient permissions');
  }
}