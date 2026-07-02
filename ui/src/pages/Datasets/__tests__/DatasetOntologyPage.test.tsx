import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DatasetOntologyPage } from '../DatasetOntologyPage';

const apiGet = vi.fn();
const apiPut = vi.fn();

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
  },
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/datasets/dataset-1/ontology']}>
        <Routes>
          <Route path="/datasets/:id/ontology" element={<DatasetOntologyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DatasetOntologyPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/datasets/dataset-1') {
        return Promise.resolve({
          data: {
            id: 'dataset-1',
            name: 'Sales Model',
            description: 'Curated dataset',
            workspaceId: 'workspace-1',
            connectionId: 'conn-1',
            sourceType: 'Table',
            sourceSchema: 'dbo',
            sourceTable: 'sales',
            sourceQuery: '',
            visibility: 'Private',
            tables: [],
            fields: [
              { id: 'field-1', name: 'region', displayName: 'Region', tableId: 'table-1', dataType: 'string', kind: 'Dimension', isHidden: false },
            ],
            semanticModel: {
              measures: [{ id: 'measure-1', name: 'Revenue', displayName: 'Revenue', expression: 'SUM(revenue)' }],
              relationships: [],
              hierarchies: [],
            },
            isCertified: false,
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
    apiPut.mockResolvedValue({ data: {} });
  });

  it('renders and saves ontology edits', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ontology Editor')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Revenue')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Open ontology editor/i })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Measure' }));
    fireEvent.change(screen.getByDisplayValue('Sales Model'), { target: { value: 'Sales Model v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Ontology' }));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith('/datasets/dataset-1', expect.objectContaining({
        name: 'Sales Model v2',
        semanticModel: expect.objectContaining({
          measures: expect.arrayContaining([
            expect.objectContaining({ name: 'New Measure', displayName: 'New Measure' }),
          ]),
        }),
      }));
    });
  });
});
