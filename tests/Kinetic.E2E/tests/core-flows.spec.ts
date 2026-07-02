import { expect, test } from '@playwright/test';
import { E2EUser, loginThroughUi, registerE2EUser, seedContent, SeededContent } from '../fixtures/auth';

test.describe.serial('Kinetic local smoke flows', () => {
  let user: E2EUser;
  let seed: SeededContent;

  test.beforeAll(async ({ request }) => {
    user = await registerE2EUser(request);
    seed = await seedContent(request, user);
  });

  test('login rejects bad credentials and accepts a seeded user', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await page.getByPlaceholder('you@example.com').fill(`bad-${Date.now()}@example.com`);
    await page.locator('input[type="password"]').fill(user.password);
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('.alert-danger')).toBeVisible();

    await page.locator('.alert-danger .btn-close').click();
    await loginThroughUi(page, user);
    await expect(page.getByText(user.displayName).first()).toBeVisible();
  });

  test('catalog, builder, and report viewer load with seeded reports', async ({ page }) => {
    await loginThroughUi(page, user);

    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: /report catalog/i })).toBeVisible();
    expect(seed.demoReports).toHaveLength(5);
    await expect(page.getByText(seed.report.name!).first()).toBeVisible();
    await expect(page.getByText(seed.demoReports[1].name!).first()).toBeVisible();
    await expect(page.getByText(seed.demoReports[2].name!).first()).toBeVisible();
    await expect(page.getByText(seed.demoReports[3].name!).first()).toBeVisible();
    await expect(page.getByText(seed.demoReports[4].name!).first()).toBeVisible();

    await page.goto(`/reports/${seed.report.id}`);
    await expect(page.getByRole('heading', { name: seed.report.name! })).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('workspace, dataset, dashboard, profile, integrations, and refresh pages load', async ({ page }) => {
    await loginThroughUi(page, user);

    await page.goto('/workspaces');
    await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
    await expect(page.getByText(seed.workspace.name!).first()).toBeVisible();

    await page.goto('/datasets');
    await expect(page.getByRole('heading', { name: 'Datasets' })).toBeVisible();
    await expect(page.getByText(seed.dataset.name!).first()).toBeVisible();

    await page.goto(`/datasets/${seed.dataset.id}`);
    await expect(page.getByRole('heading', { name: seed.dataset.name! })).toBeVisible();
    await expect(page.getByRole('button', { name: /queue refresh/i })).toBeVisible();

    await page.goto('/dashboards');
    await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible();
    await expect(page.getByText(seed.dashboard.name!).first()).toBeVisible();

    await page.goto(`/dashboards/${seed.dashboard.id}`);
    await expect(page.getByText(seed.dashboard.name!).first()).toBeVisible();
    await expect(page.getByText(seed.report.name!)).toBeVisible();
    await expect(page.getByText(seed.demoReports[1].name!)).toBeVisible();
    await expect(page.getByText(seed.demoReports[2].name!)).toBeVisible();
    await expect(page.getByText('Demo KPI')).toBeVisible();
    await expect(page.getByText('Demo Note')).toBeVisible();
    await expect(page.getByText('Canvas Controls')).toHaveCount(0);
    await page.getByRole('button', { name: /edit/i }).click();
    await expect(page.getByText('Canvas Controls')).toBeVisible();

    await page.goto('/profile');
    await expect(page.getByText(user.email).first()).toBeVisible();

    await page.goto('/refresh');
    await expect(page.getByRole('heading', { name: 'Refresh Operations' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Failed refresh jobs need attention' })).toBeVisible();
    await expect(page.getByText(seed.dataset.name!).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /run due schedules/i })).toBeVisible();

  });
});
