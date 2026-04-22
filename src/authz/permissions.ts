import { ROLE_DEFAULT_PERMISSIONS } from './defaults';
import { AppPermission, UserAccessProfile } from './types';

/**
 * Resolves effective permissions for a user profile.
 * Formula: (Default Permissions + Granted) - Revoked
 * Conflict rule: Deny wins (if a permission is in both granted and revoked, it remains denied).
 */
export function resolvePermissions(profile: UserAccessProfile): Set<AppPermission> {
  if (!profile) return new Set();
  const basePermissions = ROLE_DEFAULT_PERMISSIONS[profile.role] || [];
  const effective = new Set<AppPermission>(basePermissions);

  // Add explicit grants (safety check for undefined arrays)
  (profile.grantedPermissions || []).forEach((p) => effective.add(p));

  // Remove explicit revocations (Deny wins)
  (profile.revokedPermissions || []).forEach((p) => effective.delete(p));

  return effective;
}

/**
 * Checks if a user has a specific permission.
 */
export function hasPermission(profile: UserAccessProfile | null | undefined, permission: AppPermission): boolean {
  if (!profile) return false;
  const effective = resolvePermissions(profile);
  return effective.has(permission);
}

/**
 * Helper to get a human-readable list of permissions for debugging.
 */
export function getPermissionList(profile: UserAccessProfile): AppPermission[] {
  return Array.from(resolvePermissions(profile)).sort();
}
