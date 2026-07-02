import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SetupPage } from '../SetupPage';

const setupApi = {
  getSetupStatus: vi.fn(),
  testDatabase: vi.fn(),
  testRabbitMq: vi.fn(),
  testRedis: vi.fn(),
  testSmtp: vi.fn(),
  completeSetup: vi.fn(),
  createAdmin: vi.fn(),
};

vi.mock('../../../../lib/api/setup', () => setupApi);

describe('SetupPage', () => {
  beforeEach(() => {
    Object.values(setupApi).forEach(fn => fn.mockReset());
    setupApi.getSetupStatus.mockRejectedValue(new Error('offline'));
    setupApi.testDatabase.mockResolvedValue({ success: true });
    setupApi.testRabbitMq.mockResolvedValue({ success: true });
    setupApi.testRedis.mockResolvedValue({ success: true });
    setupApi.testSmtp.mockResolvedValue({ success: true });
    setupApi.completeSetup.mockResolvedValue({});
    setupApi.createAdmin.mockResolvedValue({});
  });

  it('renders the enterprise setup hero', async () => {
    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome to the enterprise control plane')).toBeInTheDocument();
      expect(screen.getByText(/analytics platform configured/i)).toBeInTheDocument();
      expect(screen.getByText('Enterprise control plane')).toBeInTheDocument();
    });
  });
});
