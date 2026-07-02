import { APIRequestContext, expect, Page } from '@playwright/test';
import { buildDemoWorkspacePack } from './demoWorkspacePack';

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
  demoReports: ApiEntity[];
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
  const pack = buildDemoWorkspacePack(suffix);

  const workspace = await apiPost<ApiEntity>(request, user.token, '/workspaces', pack.workspace);

  const connection = await apiPost<ApiEntity>(request, user.token, '/connections', {
    ...pack.connection,
    workspaceId: workspace.id,
  });

  const dataset = await apiPost<ApiEntity>(request, user.token, '/datasets', {
    ...pack.dataset,
    workspaceId: workspace.id,
    connectionId: connection.id,
    fields: [],
    tables: [],
  });

  const [report, operationsReport, analyticsReport, financeReport, governanceReport] = await Promise.all(pack.reports.map((reportPack) =>
    apiPost<ApiEntity>(request, user.token, '/reports', {
      name: reportPack.name,
      description: reportPack.description,
      workspaceId: workspace.id,
      datasetId: dataset.id,
      connectionId: connection.id,
      queryText: reportPack.queryText,
      executionMode: 'Auto',
      cacheMode: 'Live',
      visibility: 'Private',
      allowEmbed: true,
      tags: reportPack.tags,
      columns: reportPack.columns,
      visualizations: reportPack.visualizations,
    })
  ));

  const dashboard = await apiPost<ApiEntity>(request, user.token, '/dashboards', {
    name: pack.dashboard.name,
    description: pack.dashboard.description,
    workspaceId: workspace.id,
    visibility: 'Private',
    widgets: [
      {
        id: 'e2e-exec-report',
        type: 'ReportVisual',
        title: 'Executive Demo Report',
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        reportId: report.id,
        config: { reportName: report.name },
      },
      {
        id: 'e2e-ops-report',
        type: 'ReportVisual',
        title: 'Operations Demo Report',
        x: 4,
        y: 0,
        width: 4,
        height: 3,
        reportId: operationsReport.id,
        config: { reportName: operationsReport.name },
      },
      {
        id: 'e2e-analytics-report',
        type: 'ReportVisual',
        title: 'Analytics Demo Report',
        x: 8,
        y: 0,
        width: 4,
        height: 3,
        reportId: analyticsReport.id,
        config: { reportName: analyticsReport.name },
      },
      {
        id: 'e2e-finance-report',
        type: 'ReportVisual',
        title: 'Finance Demo Report',
        x: 0,
        y: 5,
        width: 4,
        height: 3,
        reportId: financeReport.id,
        config: { reportName: financeReport.name },
      },
      {
        id: 'e2e-governance-report',
        type: 'ReportVisual',
        title: 'Governance Demo Report',
        x: 4,
        y: 5,
        width: 4,
        height: 3,
        reportId: governanceReport.id,
        config: { reportName: governanceReport.name },
      },
      {
        id: 'e2e-kpi',
        type: 'Kpi',
        title: 'Demo KPI',
        x: 8,
        y: 5,
        width: 4,
        height: 2,
        config: { value: '$1.25M' },
      },
      {
        id: 'e2e-note',
        type: 'Text',
        title: 'Demo Note',
        x: 0,
        y: 8,
        width: 12,
        height: 2,
        config: { markdown: 'Demo workspace overview for executive, operational, analytical, finance, and governance reporting.' },
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
    name: pack.refreshSchedule.name,
    cronExpression: pack.refreshSchedule.cronExpression,
    timezone: pack.refreshSchedule.timezone,
    isEnabled: true,
  });

  return { user, workspace, connection, dataset, dashboard, report, demoReports: [report, operationsReport, analyticsReport, financeReport, governanceReport], refreshJob, refreshSchedule };
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
