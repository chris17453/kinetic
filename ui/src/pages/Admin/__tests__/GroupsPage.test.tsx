import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupsPage } from '../GroupsPage';

const { getMock, postMock, deleteMock, putMock, toastMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: getMock,
    post: postMock,
    delete: deleteMock,
    put: putMock,
  },
}));

vi.mock('../../../components/common', () => ({
  Breadcrumb: () => <div />,
  useToast: () => toastMock,
}));

describe('GroupsPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    putMock.mockReset();
  });

  it('renders real member counts and member rows', async () => {
    getMock.mockImplementation(async (path: string) => {
      if (path === '/admin/groups') {
        return {
          data: {
            items: [
              {
                id: 'g1',
                name: 'Finance',
                description: 'Finance team',
                isSystem: false,
                isDefault: false,
                memberCount: 2,
                permissions: [{ permissionCode: 'reports:view' }],
                members: [
                  { userId: 'u1', displayName: 'A User', email: 'a@example.com', role: 'Member' },
                  { userId: 'u2', displayName: 'B User', email: 'b@example.com', role: 'Owner' },
                ],
                createdAt: '2026-06-01T00:00:00Z',
              },
            ],
          },
        };
      }

      return { data: { items: [] } };
    });

    render(<GroupsPage />);

    expect(await screen.findByText('Finance')).toBeInTheDocument();
    expect(screen.getByText(/2/i, { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByText('A User')).toBeInTheDocument();
    expect(screen.getByText('B User')).toBeInTheDocument();
  });
});
