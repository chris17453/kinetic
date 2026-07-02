import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EnterpriseCenterPage } from '../EnterpriseCenterPage';

const apiGet = vi.fn();
const permissions = {
  canManageEnterprise: true,
  canManageUsers: true,
  canManageGroups: true,
  canViewAudit: true,
  canViewEnterpriseCenter: true,
};

vi.mock('../../../lib/api/client', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EnterpriseCenterPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('EnterpriseCenterPage', () => {
  beforeEach(() => {
    permissions.canManageEnterprise = true;
    permissions.canManageUsers = true;
    permissions.canManageGroups = true;
    permissions.canViewAudit = true;
    permissions.canViewEnterpriseCenter = true;
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/datasets') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'dataset-1',
                name: 'Sales Model',
                lastRefreshedAt: '2026-06-01T00:00:00Z',
                fields: [
                  { id: 'field-1', name: 'region', displayName: 'Region' },
                  { id: 'field-2', name: 'revenue', displayName: 'Revenue' },
                ],
                semanticModel: {
                  measures: [{ id: 'measure-1', name: 'Total Revenue', expression: 'SUM(revenue)' }],
                  relationships: [{ id: 'rel-1' }],
                  hierarchies: [{ id: 'hier-1', name: 'Geo' }],
                },
              },
            ],
          },
        });
      }
      if (url === '/reports') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'report-1', name: 'Board Pack', description: 'Executive summary', isFeatured: true, averageRating: 4.8, executionCount: 12, visualizations: [{ id: 'viz-1' }], tags: ['board'] },
            ],
          },
        });
      }
      if (url === '/refresh-jobs') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'job-1', status: 'Failed' },
              { id: 'job-2', status: 'Succeeded' },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders enterprise signals and ontology summaries', async () => {
    renderPage();

    expect(screen.getByText('Enterprise command center')).toBeInTheDocument();
      expect(screen.getByText('Signals and Ontology')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Ontology governance/ })).toHaveAttribute('href', '/enterprise/ontology');

    expect(screen.getByRole('link', { name: /Module Signals .*Open module/ })).toHaveAttribute('href', '/enterprise/signals');
    expect(screen.getByRole('link', { name: /Module Ontology .*Open module/ })).toHaveAttribute('href', '/enterprise/ontology');
    expect(screen.getByRole('link', { name: /Module Admin .*Open module/ })).toHaveAttribute('href', '/admin/users');
      expect(screen.getByText('Enterprise modules and permissions')).toBeInTheDocument();
      expect(screen.getByText('Click through to live reports')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText((_, node) => node?.textContent?.includes('failed refresh jobs are waiting for review') ?? false).length).toBeGreaterThan(0);
      expect(screen.getAllByText((_, node) => node?.textContent?.includes('governed measures define reusable business logic') ?? false).length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: 'Board Pack' })).toHaveAttribute('href', '/reports/report-1');
      expect(screen.getByRole('link', { name: 'Open report' })).toHaveAttribute('href', '/reports/report-1');
      expect(screen.getByText('Sales Model')).toBeInTheDocument();
      expect(screen.getByText('Region')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sales Model' })).toHaveAttribute('href', '/datasets/dataset-1');
      expect(screen.getByRole('link', { name: /Open refresh operations/ })).toHaveAttribute('href', '/refresh');
      expect(screen.getAllByText('Field · Sales Model').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Measure · Sales Model').length).toBeGreaterThan(0);
    });
  });

  it('shows an access denied state for non-admin users', async () => {
    permissions.canViewEnterpriseCenter = false;
    renderPage();

    expect(screen.getByText('Enterprise Center')).toBeInTheDocument();
    expect(screen.getByText('This area is available to administrative users.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/');
  });
});
