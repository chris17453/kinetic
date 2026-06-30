import { APIRequestContext, expect, Page } from '@playwright/test';
import { randomUUID } from 'crypto';

export interface E2EUser {
  email: string;
  password: string;
  displayName: string;
  token: string;
}

export interface SeededContent {
  user: E2EUser;
  workspace: ApiEntity;
  connection: ApiEntity;
  dataset: ApiEntity;
  dashboard: ApiEntity;
  report: ApiEntity;
  refreshJob: ApiEntity;
  refreshSchedule: ApiEntity;
}

interface ApiEntity {
  id: string;
  name?: string;
  targetName?: string;
}

const password = 'LocalDev123!';

export function apiBaseUrl() {
  const configured = process.env.API_URL || 'http://localhost:5000';
  return configured.replace(/\/api\/?$/, '').replace(/\/$/, '') + '/api';
}

export async function registerE2EUser(request: APIRequestContext, suffix = Date.now()): Promise<E2EUser> {
  await waitForApi(request);
  const email = `e2e-${suffix}@example.com`;
  const displayName = `E2E User ${suffix}`;
  const response = await request.post(`${apiBaseUrl()}/auth/register`, {
    data: { email, password, displayName },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json();
  return { email, password, displayName, token: body.token };
}

export async function loginThroughUi(page: Page, user: E2EUser) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('kinetic_token')));
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function seedContent(request: APIRequestContext, user: E2EUser): Promise<SeededContent> {
  const suffix = user.email.split('@')[0];
  const workspace = await apiPost<ApiEntity>(request, user.token, '/workspaces', {
    name: `E2E Workspace ${suffix}`,
    description: 'Seeded by Playwright',
    visibility: 'Private',
  });

  const connection = await apiPost<ApiEntity>(request, user.token, '/connections', {
    name: `E2E SQLite ${suffix}`,
    description: 'Seeded by Playwright',
    type: 'SQLite',
    connectionString: 'Data Source=:memory:',
    workspaceId: workspace.id,
    visibility: 'Private',
  });

  const dataset = await apiPost<ApiEntity>(request, user.token, '/datasets', {
    name: `E2E Dataset ${suffix}`,
    description: 'Seeded by Playwright',
    workspaceId: workspace.id,
    connectionId: connection.id,
    sourceType: 'Query',
    sourceQuery: "select 1 as total_sales, 'North' as region",
    visibility: 'Private',
    fields: [],
    tables: [],
  });

  const dashboard = await apiPost<ApiEntity>(request, user.token, '/dashboards', {
    name: `E2E Dashboard ${suffix}`,
    description: 'Seeded by Playwright',
    workspaceId: workspace.id,
    visibility: 'Private',
    widgets: [
      {
        id: 'e2e-revenue-card',
        type: 'Kpi',
        title: 'Revenue YTD',
        x: 0,
        y: 0,
        width: 4,
        height: 2,
        config: { value: '$1.25M' },
      },
    ],
    filters: [
      {
        id: 'e2e-region-filter',
        field: 'region',
        operator: 'Equals',
        value: 'North',
      },
    ],
  });

  const report = await apiPost<ApiEntity>(request, user.token, '/reports', {
    name: `E2E Report ${suffix}`,
    description: 'Seeded by Playwright',
    workspaceId: workspace.id,
    datasetId: dataset.id,
    connectionId: connection.id,
    queryText: "select 1 as total_sales, 'North' as region",
    executionMode: 'Auto',
    cacheMode: 'Live',
    visibility: 'Private',
    allowEmbed: true,
    tags: ['e2e', 'smoke'],
    columns: [
      { sourceName: 'total_sales', displayName: 'Total Sales', displayOrder: 0, visible: true, dataType: 'integer' },
      { sourceName: 'region', displayName: 'Region', displayOrder: 1, visible: true, dataType: 'text' },
    ],
    visualizations: [
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Sales by Region',
        title: 'Sales by Region',
        type: 'Bar',
        isDefault: true,
        showLegend: true,
        displayOrder: 0,
        xAxisColumn: 'region',
        yAxisColumn: 'total_sales',
        fieldWells: [
          { role: 'Category', field: 'region', displayName: 'Region', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'total_sales', displayName: 'Total Sales', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 0, y: 0, width: 8, height: 5, isHidden: false },
      },
    ],
  });

  const refreshJob = await apiPost<ApiEntity>(request, user.token, '/refresh-jobs', {
    targetType: 'Dataset',
    targetId: dataset.id,
    triggerType: 'Manual',
  });
  await apiPost<ApiEntity>(request, user.token, `/refresh-jobs/${refreshJob.id}/complete`, {
    status: 'Failed',
    message: 'Seeded failed refresh for smoke coverage',
  });

  const refreshSchedule = await apiPost<ApiEntity>(request, user.token, '/refresh-jobs/schedules', {
    targetType: 'Dataset',
    targetId: dataset.id,
    name: `E2E Daily Refresh ${suffix}`,
    cronExpression: '0 8 * * *',
    timezone: 'UTC',
    isEnabled: true,
  });

  return { user, workspace, connection, dataset, dashboard, report, refreshJob, refreshSchedule };
}

async function apiPost<T>(request: APIRequestContext, token: string, path: string, data: unknown): Promise<T> {
  const response = await request.post(`${apiBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function waitForApi(request: APIRequestContext) {
  const healthUrl = apiBaseUrl().replace(/\/api$/, '/health');
  const deadline = Date.now() + 120_000;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const response = await request.get(healthUrl, { timeout: 3000 });
      if (response.ok()) return;
      lastError = `${response.status()} ${await response.text()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`API did not become healthy at ${healthUrl}: ${lastError}`);
}
