import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EnterpriseOntologyPage } from '../EnterpriseOntologyPage';

const apiGet = vi.fn();
const permissions = { canViewEnterpriseCenter: true };

vi.mock('../../../lib/api/client', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/enterprise/ontology']}>
        <Routes>
          <Route path="/enterprise/ontology" element={<EnterpriseOntologyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('EnterpriseOntologyPage', () => {
  beforeEach(() => {
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
                isCertified: true,
                fields: [
                  { id: 'field-1', name: 'country', displayName: 'Country' },
                ],
                semanticModel: {
                  measures: [{ id: 'measure-1', name: 'revenue', displayName: 'Revenue', expression: 'SUM(revenue)' }],
                  relationships: [{ id: 'rel-1', fromTableId: 'orders', toTableId: 'customers', cardinality: 'many-to-one' }],
                  hierarchies: [{ id: 'hier-1', name: 'Geography', fieldIds: ['country', 'region'] }],
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
              { id: 'report-1', name: 'Executive View', isFeatured: true, visualizations: [] },
            ],
          },
        });
      }
      if (url === '/refresh-jobs') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'job-1', status: 'Failed' },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders ontology governance inventory', async () => {
    renderPage();

    expect(screen.getByText('Ontology governance')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Semantic layer inventory')).toBeInTheDocument();
      expect(screen.getByText('Sales Model')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Revenue' })).toHaveAttribute('href', '/catalog?search=Revenue');
      expect(screen.getByText('orders → customers')).toBeInTheDocument();
      expect(screen.getByText('Geography')).toBeInTheDocument();
      expect(screen.getByText('Stale Datasets')).toBeInTheDocument();
      expect(screen.getByText('Failed Signals')).toBeInTheDocument();
      expect(screen.getByText('Featured Reports')).toBeInTheDocument();
      expect(screen.getByText('Business terms')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Country' })).toHaveAttribute('href', '/catalog?search=Country');
      expect(screen.getByRole('link', { name: 'Sales Model' })).toHaveAttribute('href', '/datasets/dataset-1');
      expect(screen.getByRole('link', { name: /Back to enterprise center/ })).toHaveAttribute('href', '/enterprise');
    });
  });
});
