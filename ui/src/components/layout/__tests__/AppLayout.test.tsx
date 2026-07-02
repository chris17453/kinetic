import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '../AppLayout';

const authState = {
  user: {
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    groups: [],
  },
  isAuthenticated: true,
  logout: vi.fn(),
};

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => authState,
}));

vi.mock('../../../stores/brandingStore', () => ({
  useBrandingStore: () => ({
    branding: { orgName: 'Kinetic Enterprise', dashboardBackgroundUrl: 'https://example.com/bg.png' },
    toggleDarkMode: vi.fn(),
  }),
}));

const permissions = {
  canManageUsers: false,
  canManageGroups: false,
  canViewAudit: false,
  canViewEnterpriseCenter: false,
  canCreateReports: false,
  canRunReports: false,
  canManageReports: false,
  canCreateConnections: false,
  canManageConnections: false,
  canUploadData: false,
};

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

vi.mock('../../common/SearchModal', () => ({
  SearchModal: () => null,
}));

describe('AppLayout', () => {
  beforeEach(() => {
    permissions.canManageUsers = false;
    permissions.canManageGroups = false;
    permissions.canViewAudit = false;
    permissions.canViewEnterpriseCenter = false;
    permissions.canCreateReports = false;
    permissions.canRunReports = false;
    permissions.canManageReports = false;
    permissions.canCreateConnections = false;
    permissions.canManageConnections = false;
    permissions.canUploadData = false;
    document.title = '';
  });

  it('sets the page title from the current route', async () => {
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/catalog" element={<div>Catalog</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.title).toBe('Report Catalog — Kinetic Enterprise');
    });
  });

  it('hides admin navigation for users without admin permissions', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Groups')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
    expect(screen.queryByText('Enterprise Center')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Connections')).not.toBeInTheDocument();
    expect(screen.queryByText('Data Upload')).not.toBeInTheDocument();
    expect(screen.getAllByText('Consumer').length).toBeGreaterThan(0);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows creator navigation only when the user can create or manage content', () => {
    permissions.canCreateReports = true;
    permissions.canCreateConnections = true;
    permissions.canUploadData = true;

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText('Creator tools').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Playground' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Connections' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Data Upload' }).length).toBeGreaterThan(0);
  });

  it('shows enterprise navigation when the user can view enterprise center', () => {
    permissions.canViewEnterpriseCenter = true;

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByRole('link', { name: 'Enterprise Center' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Signals' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Ontology' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('shows admin navigation when the user can manage users', () => {
    permissions.canManageUsers = true;
    permissions.canViewEnterpriseCenter = true;

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByRole('link', { name: 'Users' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Groups' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Audit Log' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Enterprise Center' }).length).toBeGreaterThan(0);
  });

  it('shows report and connection navigation only when permitted', () => {
    permissions.canRunReports = true;
    permissions.canCreateConnections = true;
    permissions.canUploadData = true;

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByRole('link', { name: 'Reports' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Connections' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Data Upload' }).length).toBeGreaterThan(0);
  });

  it('renders a collapsible desktop sidebar rail', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByRole('button', { name: /collapse navigation/i }).length).toBeGreaterThan(0);
  });

  it('applies the organization dashboard background to the main shell', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const main = document.querySelector('main');
    expect(main).toHaveStyle({
      backgroundImage: 'linear-gradient(rgba(8, 15, 29, 0.96), rgba(8, 15, 29, 0.94)), url(https://example.com/bg.png)',
    });
  });
});
