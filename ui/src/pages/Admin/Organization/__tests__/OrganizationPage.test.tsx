import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OrganizationPage } from '../OrganizationPage';

const apiGet = vi.fn();
const apiPut = vi.fn();

vi.mock('../../../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
  },
}));

vi.mock('../../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../../stores/brandingStore', () => ({
  useBrandingStore: () => ({ fetchGlobalBranding: vi.fn() }),
}));

describe('OrganizationPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/organizations/branding') {
        return Promise.resolve({
          data: {
            orgName: 'Kinetic Enterprise',
            orgSlug: 'kinetic',
            logoText: '',
            primaryColor: '#1d4ed8',
            secondaryColor: '#0f766e',
            accentColor: '#0ea5e9',
            backgroundColor: '#ffffff',
            surfaceColor: '#f8fafc',
            textColor: '#0f172a',
            textMutedColor: '#475569',
            borderColor: '#e2e8f0',
            errorColor: '#ef4444',
            warningColor: '#f59e0b',
            successColor: '#10b981',
            infoColor: '#3b82f6',
            darkPrimaryColor: '#60a5fa',
            darkSecondaryColor: '#818cf8',
            darkAccentColor: '#34d399',
            darkBackgroundColor: '#0f172a',
            darkSurfaceColor: '#1e293b',
            darkTextColor: '#f8fafc',
            darkTextMutedColor: '#94a3b8',
            darkBorderColor: '#334155',
            fontFamily: 'Inter, system-ui, sans-serif',
            headingFontFamily: 'Inter, system-ui, sans-serif',
            monoFontFamily: 'JetBrains Mono, monospace',
            customCss: '',
          },
        });
      }
      if (url === '/organizations/settings') {
        return Promise.resolve({ data: {} });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders enterprise branding guidance in the organization editor', async () => {
    render(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText('Enterprise control plane')).toBeInTheDocument();
      expect(screen.getByText(/Configure branding, themes, permissions defaults/)).toBeInTheDocument();
      expect(screen.getByText('Executive-ready UI')).toBeInTheDocument();
      expect(screen.getByText('Branding')).toBeInTheDocument();
      expect(screen.getByText('Permissions')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Kinetic Enterprise')).toBeInTheDocument();
    });
  });
});
