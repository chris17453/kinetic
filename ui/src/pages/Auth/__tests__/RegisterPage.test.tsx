import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../RegisterPage';

const brandingState = { branding: { orgName: 'Kinetic Enterprise', primaryColor: '#0f766e' } };
const registerUser = vi.fn();

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ register: registerUser, isLoading: false }),
}));

vi.mock('../../../stores/brandingStore', () => ({
  useBrandingStore: () => brandingState,
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    registerUser.mockReset();
  });

  it('uses org branding in the registration funnel', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Kinetic Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Build enterprise dashboards, govern shared metrics, and make faster decisions with trusted analytics.')).toBeInTheDocument();
  });
});
