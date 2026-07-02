import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';

export function RequireAdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = usePermissions();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function RequireEnterpriseRoute({ children }: { children: ReactNode }) {
  const { canViewEnterpriseCenter } = usePermissions();

  if (!canViewEnterpriseCenter) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function RequirePermissionRoute({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function RequireCreatorRoute({ children }: { children: ReactNode }) {
  const {
    canCreateReports,
    canManageReports,
    canCreateConnections,
    canManageConnections,
    canUploadData,
  } = usePermissions();

  const canAccessCreator =
    canCreateReports ||
    canManageReports ||
    canCreateConnections ||
    canManageConnections ||
    canUploadData;

  if (!canAccessCreator) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
