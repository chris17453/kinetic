import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthCallbackPage } from '../AuthCallbackPage';

const completeExternalLogin = vi.fn();
const brandingState = { branding: { orgName: 'Kinetic Enterprise', primaryColor: '#0f766e' }, fetchGlobalBranding: vi.fn() };

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ completeExternalLogin: completeExternalLogin.mockResolvedValue(undefined) }),
}));

vi.mock('../../../stores/brandingStore', () => ({
  useBrandingStore: () => brandingState,
}));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    completeExternalLogin.mockReset();
    brandingState.fetchGlobalBranding.mockReset();
  });

  it('shows enterprise session text while completing sign in', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?token=enterprise-token']}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Completing sign in')).toBeInTheDocument();
      expect(screen.getByText('Finalizing your Kinetic Enterprise session.')).toBeInTheDocument();
    });
  });
});
