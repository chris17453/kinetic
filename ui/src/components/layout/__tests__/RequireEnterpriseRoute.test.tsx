import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireEnterpriseRoute } from '../RequireAdminRoute';

const permissions = { canViewEnterpriseCenter: false };

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

describe('RequireEnterpriseRoute', () => {
  beforeEach(() => {
    permissions.canViewEnterpriseCenter = false;
  });

  it('renders protected content for enterprise users', () => {
    permissions.canViewEnterpriseCenter = true;

    render(
      <MemoryRouter initialEntries={['/enterprise']}>
        <Routes>
          <Route path="/enterprise" element={<RequireEnterpriseRoute><div>Protected</div></RequireEnterpriseRoute>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('redirects users without enterprise access home', () => {
    render(
      <MemoryRouter initialEntries={['/enterprise']}>
        <Routes>
          <Route path="/enterprise" element={<RequireEnterpriseRoute><div>Protected</div></RequireEnterpriseRoute>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });
});
