import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../ForgotPasswordPage';

const brandingState = { branding: { orgName: 'Kinetic Enterprise', primaryColor: '#0f766e', useTextLogo: false } };

vi.mock('../../../stores/brandingStore', () => ({
  useBrandingStore: () => brandingState,
}));

vi.mock('../../../lib/api/auth', () => ({
  forgotPassword: vi.fn(),
}));

describe('ForgotPasswordPage', () => {
  it('uses org branding in the recovery funnel', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    expect(screen.getAllByAltText('Kinetic Enterprise').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Recover youraccess/i })).toBeInTheDocument();
  });
});
