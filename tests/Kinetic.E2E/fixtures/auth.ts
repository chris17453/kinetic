import { test as base, expect, Page } from '@playwright/test';

// Test user credentials
export interface TestUser {
  email: string;
  password: string;
  name: string;
}

export const testUsers = {
  admin: {
    email: 'admin@kinetic.local',
    password: 'Admin123!',
    name: 'Admin User',
  },
  editor: {
    email: 'editor@kinetic.local',
    password: 'Editor123!',
    name: 'Editor User',
  },
  viewer: {
    email: 'viewer@kinetic.local',
    password: 'Viewer123!',
    name: 'Viewer User',
  },
};

// Extended test fixtures
export interface KineticFixtures {
  authenticatedPage: Page;
  adminPage: Page;
}

// Auth helper
async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/catalog');
}

// Extended test with fixtures
export const test = base.extend<KineticFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await login(page, testUsers.viewer);
    await use(page);
  },
  adminPage: async ({ page }, use) => {
    await login(page, testUsers.admin);
    await use(page);
  },
});

export { expect };
