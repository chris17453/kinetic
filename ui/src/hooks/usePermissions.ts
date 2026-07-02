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
  ADMIN_SYSTEM: 'admin.system',

  // Enterprise
  ORG_MANAGE: 'org:manage',
  ORG_BRANDING: 'org:branding',
  ORG_SETTINGS: 'org:settings',
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
  const canManageSystem = hasPermission(PERMISSIONS.ADMIN_SYSTEM);
  const canManageEnterprise = hasAnyPermission([
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.ORG_BRANDING,
    PERMISSIONS.ORG_SETTINGS,
    PERMISSIONS.ADMIN_SYSTEM,
  ]);
  const canViewEnterpriseCenter = hasAnyPermission([
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.ORG_BRANDING,
    PERMISSIONS.ORG_SETTINGS,
    PERMISSIONS.ADMIN_USERS,
    PERMISSIONS.ADMIN_GROUPS,
    PERMISSIONS.ADMIN_AUDIT,
    PERMISSIONS.ADMIN_SYSTEM,
    PERMISSIONS.REPORTS_MANAGE,
    PERMISSIONS.CONNECTIONS_MANAGE,
    PERMISSIONS.CATALOG_ASSIGN,
    PERMISSIONS.UPLOAD_DATA,
  ]);
  const isAdmin = canManageUsers || canManageGroups || canViewAudit || canManageEnterprise;

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
    canManageSystem,
    canManageEnterprise,
    canViewEnterpriseCenter,
    isAdmin,
  };
}
