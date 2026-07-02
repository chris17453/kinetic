import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireCreatorRoute } from '../RequireAdminRoute';

const permissions = {
  canCreateReports: false,
  canManageReports: false,
  canCreateConnections: false,
  canManageConnections: false,
  canUploadData: false,
};

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

describe('RequireCreatorRoute', () => {
  beforeEach(() => {
    permissions.canCreateReports = false;
    permissions.canManageReports = false;
    permissions.canCreateConnections = false;
    permissions.canManageConnections = false;
    permissions.canUploadData = false;
  });

  it('renders protected content for creator users', () => {
    permissions.canCreateReports = true;

    render(
      <MemoryRouter initialEntries={['/creator']}>
        <Routes>
          <Route path="/creator" element={<RequireCreatorRoute><div>Protected</div></RequireCreatorRoute>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('redirects users without creator access home', () => {
    render(
      <MemoryRouter initialEntries={['/creator']}>
        <Routes>
          <Route path="/creator" element={<RequireCreatorRoute><div>Protected</div></RequireCreatorRoute>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });
});
