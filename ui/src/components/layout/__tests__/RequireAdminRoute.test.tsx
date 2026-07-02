import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAdminRoute, RequirePermissionRoute } from '../RequireAdminRoute';
import { PERMISSIONS } from '../../../hooks/usePermissions';

const permissions = { isAdmin: true };
const permissionState = { hasPermission: vi.fn() };

vi.mock('../../../hooks/usePermissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/usePermissions')>();
  return {
    ...actual,
    usePermissions: () => ({
      ...permissions,
      hasPermission: permissionState.hasPermission,
    }),
  };
});

describe('RequireAdminRoute', () => {
  beforeEach(() => {
    permissions.isAdmin = true;
    permissionState.hasPermission.mockReset();
    permissionState.hasPermission.mockImplementation(() => true);
  });

  it('renders protected content for admins', () => {
    render(
      <MemoryRouter initialEntries={['/enterprise']}>
        <Routes>
          <Route path="/enterprise" element={<RequireAdminRoute><div>Protected</div></RequireAdminRoute>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('redirects non-admin users home', () => {
    permissions.isAdmin = false;

    render(
      <MemoryRouter initialEntries={['/enterprise']}>
        <Routes>
          <Route path="/enterprise" element={<RequireAdminRoute><div>Protected</div></RequireAdminRoute>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('renders protected content when the user has the required permission', () => {
    permissionState.hasPermission.mockImplementation((permission: string) => permission === PERMISSIONS.REPORTS_CREATE);

    render(
      <MemoryRouter initialEntries={['/reports/new']}>
        <Routes>
          <Route path="/reports/new" element={<RequirePermissionRoute permission={PERMISSIONS.REPORTS_CREATE}><div>Protected</div></RequirePermissionRoute>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('redirects users without the required permission home', () => {
    permissionState.hasPermission.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={['/reports/new']}>
        <Routes>
          <Route path="/reports/new" element={<RequirePermissionRoute permission={PERMISSIONS.REPORTS_CREATE}><div>Protected</div></RequirePermissionRoute>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });
});
