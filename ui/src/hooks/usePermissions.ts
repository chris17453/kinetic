import { useMemo } from 'react';
import { useAuth } from './useAuth';

// All available permissions in the system
export const PERMISSIONS = {
  // Reports
  REPORTS_CREATE: 'reports.create',
  REPORTS_RUN: 'reports.run',
  REPORTS_MANAGE: 'reports.manage',

  // Connections
  CONNECTIONS_CREATE: 'connections.create',
  CONNECTIONS_MANAGE: 'connections.manage',

  // Catalog
  CATALOG_ASSIGN: 'catalog.assign',

  // Data Upload
  UPLOAD_DATA: 'upload.data',

  // Admin
  ADMIN_USERS: 'admin.users',
  ADMIN_GROUPS: 'admin.groups',
  ADMIN_AUDIT: 'admin.audit',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export function usePermissions() {
  const { user } = useAuth();

  const userPermissions = useMemo(() => {
    if (!user) return new Set<string>();

    const permissions = new Set<string>();

    // Collect permissions from all user groups
    user.groups?.forEach((userGroup) => {
      userGroup.group?.permissions?.forEach((perm) => {
        permissions.add(perm.permissionCode);
      });
    });

    return permissions;
  }, [user]);

  const hasPermission = (permission: PermissionCode | string): boolean => {
    return userPermissions.has(permission);
  };

  const hasAnyPermission = (permissions: (PermissionCode | string)[]): boolean => {
    return permissions.some((p) => userPermissions.has(p));
  };

  const hasAllPermissions = (permissions: (PermissionCode | string)[]): boolean => {
    return permissions.every((p) => userPermissions.has(p));
  };

  // Convenience checks
  const canCreateReports = hasPermission(PERMISSIONS.REPORTS_CREATE);
  const canRunReports = hasPermission(PERMISSIONS.REPORTS_RUN);
  const canManageReports = hasPermission(PERMISSIONS.REPORTS_MANAGE);
  const canCreateConnections = hasPermission(PERMISSIONS.CONNECTIONS_CREATE);
  const canManageConnections = hasPermission(PERMISSIONS.CONNECTIONS_MANAGE);
  const canAssignCatalog = hasPermission(PERMISSIONS.CATALOG_ASSIGN);
  const canUploadData = hasPermission(PERMISSIONS.UPLOAD_DATA);
  const canManageUsers = hasPermission(PERMISSIONS.ADMIN_USERS);
  const canManageGroups = hasPermission(PERMISSIONS.ADMIN_GROUPS);
  const canViewAudit = hasPermission(PERMISSIONS.ADMIN_AUDIT);
  const isAdmin = canManageUsers || canManageGroups;

  return {
    permissions: userPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    // Convenience flags
    canCreateReports,
    canRunReports,
    canManageReports,
    canCreateConnections,
    canManageConnections,
    canAssignCatalog,
    canUploadData,
    canManageUsers,
    canManageGroups,
    canViewAudit,
    isAdmin,
  };
}
