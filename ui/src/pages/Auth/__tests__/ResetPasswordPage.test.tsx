import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordPage } from '../ResetPasswordPage';

const brandingState = { branding: { orgName: 'Kinetic Enterprise', primaryColor: '#0f766e', useTextLogo: false } };

vi.mock('../../../stores/brandingStore', () => ({
  useBrandingStore: () => brandingState,
}));

vi.mock('../../../lib/api/auth', () => ({
  resetPassword: vi.fn(),
}));

describe('ResetPasswordPage', () => {
  it('uses org branding in the reset funnel', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?email=ada@example.com&token=token-1']}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    expect(screen.getAllByAltText('Kinetic Enterprise').length).toBeGreaterThan(0);
    expect(screen.getByText('Choose a new password')).toBeInTheDocument();
    expect(screen.getByText('Enter a new password for')).toBeInTheDocument();
  });
});
