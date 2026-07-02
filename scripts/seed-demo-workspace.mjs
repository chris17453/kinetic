import { randomUUID } from 'crypto';

const API_URL = (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
const EMAIL = process.env.DEV_USER_EMAIL || 'localdev@example.com';
const PASSWORD = process.env.DEV_USER_PASSWORD || 'LocalDev123!';

async function main() {
  await ensureAdminUser();
  const token = await login();
  const existing = await apiGet('/api/workspaces?includeArchived=true', token);
  const suffix = EMAIL.split('@')[0];
  let workspace = existing.items?.find((item) => item.slug?.startsWith(`demo-${suffix}`));
  if (!workspace) {
    workspace = await apiPost('/api/workspaces', token, {
      name: `Demo Workspace ${suffix}`,
      description: 'Shared demo workspace with seeded reports and dashboards',
      slug: `demo-${suffix}-${Date.now()}`,
      visibility: 'Private',
    });
  }

  const connections = await apiGet(`/api/connections?workspaceId=${workspace.id}`, token);
  const connection = connections.items?.find((item) => item.name === `Demo SQLite ${suffix}`) ?? await apiPost('/api/connections', token, {
    name: `Demo SQLite ${suffix}`,
    description: 'Seeded by local development bootstrap',
    type: 'SQLite',
    connectionString: 'Data Source=:memory:',
    workspaceId: workspace.id,
    visibility: 'Private',
  });

  const datasets = await apiGet(`/api/datasets?workspaceId=${workspace.id}`, token);
  const datasetPayload = {
    name: `Demo Dataset ${suffix}`,
    description: 'Seeded by local development bootstrap',
    workspaceId: workspace.id,
    connectionId: connection.id,
    sourceType: 'Query',
    sourceQuery: `select 'North' as region, 145000 as total_sales, 92 as health_score, 1 as stage_order, 0.91 as confidence, 'Q1' as period, 42 as open_deals, 3.2 as churn_rate, 18 as days_to_close
union all select 'South', 98000, 84, 2, 0.76, 'Q1', 31, 4.8, 24
union all select 'East', 121000, 88, 3, 0.83, 'Q1', 35, 3.7, 21
union all select 'West', 176000, 95, 4, 0.97, 'Q1', 47, 2.9, 16
union all select 'North', 152000, 93, 1, 0.94, 'Q2', 45, 3.0, 17
union all select 'South', 104000, 86, 2, 0.79, 'Q2', 33, 4.5, 23
union all select 'East', 130000, 90, 3, 0.86, 'Q2', 38, 3.4, 19
union all select 'West', 182000, 96, 4, 0.98, 'Q2', 49, 2.6, 15`,
    visibility: 'Private',
    tables: [
      { id: 'sales', name: 'sales', displayName: 'Sales', isHidden: false },
    ],
    fields: [
      { id: 'total_sales', tableId: 'sales', name: 'total_sales', sourceName: 'total_sales', displayName: 'Total Sales', dataType: 'integer', kind: 'Measure', defaultAggregation: 'Sum', isHidden: false },
      { id: 'health_score', tableId: 'sales', name: 'health_score', sourceName: 'health_score', displayName: 'Health Score', dataType: 'integer', kind: 'Measure', defaultAggregation: 'Average', isHidden: false },
      { id: 'confidence', tableId: 'sales', name: 'confidence', sourceName: 'confidence', displayName: 'Confidence', dataType: 'number', kind: 'Measure', defaultAggregation: 'Average', isHidden: false },
      { id: 'open_deals', tableId: 'sales', name: 'open_deals', sourceName: 'open_deals', displayName: 'Open Deals', dataType: 'integer', kind: 'Measure', defaultAggregation: 'Sum', isHidden: false },
      { id: 'days_to_close', tableId: 'sales', name: 'days_to_close', sourceName: 'days_to_close', displayName: 'Days to Close', dataType: 'integer', kind: 'Measure', defaultAggregation: 'Average', isHidden: false },
      { id: 'region', tableId: 'sales', name: 'region', sourceName: 'region', displayName: 'Region', dataType: 'string', kind: 'Dimension', isHidden: false },
      { id: 'period', tableId: 'sales', name: 'period', sourceName: 'period', displayName: 'Period', dataType: 'string', kind: 'Dimension', isHidden: false },
      { id: 'stage_order', tableId: 'sales', name: 'stage_order', sourceName: 'stage_order', displayName: 'Stage Order', dataType: 'integer', kind: 'CalculatedColumn', isHidden: false },
    ],
    semanticModel: {
      relationships: [
        {
          id: 'sales-to-region',
          fromTableId: 'sales',
          fromFieldId: 'region',
          toTableId: 'sales',
          toFieldId: 'region',
          cardinality: 'many-to-one',
          isActive: true,
        },
      ],
      measures: [
        { id: 'gross-sales', name: 'Gross Sales', displayName: 'Gross Sales', expression: 'SUM(total_sales)', formatString: '$#,##0' },
        { id: 'avg-confidence', name: 'Average Confidence', displayName: 'Average Confidence', expression: 'AVG(confidence)', formatString: '0.0%' },
      ],
      hierarchies: [
        { id: 'geo-hierarchy', name: 'Geo Hierarchy', displayName: 'Geo Hierarchy', fieldIds: ['region', 'period'] },
      ],
    },
  };
  const existingDataset = datasets.items?.find((item) => item.name === `Demo Dataset ${suffix}`);
  const dataset = existingDataset
    ? await apiPut(`/api/datasets/${existingDataset.id}`, token, datasetPayload)
    : await apiPost('/api/datasets', token, datasetPayload);

  const reportBuilders = [
    buildExecutiveReport,
    buildOperationsReport,
    buildAnalyticsReport,
    buildFinanceReport,
    buildGovernanceReport,
  ];
  const reports = [];
  for (const builder of reportBuilders) {
    const candidate = builder(workspace.id, dataset.id, connection.id, suffix);
    const existingReport = (await apiGet(`/api/reports?workspaceId=${workspace.id}&search=${encodeURIComponent(candidate.name)}`, token)).items?.find((item) => item.name === candidate.name);
    const report = existingReport
      ? await apiPut(`/api/reports/${existingReport.id}`, token, {
          ...candidate,
          isFeatured: true,
        })
      : await apiPost('/api/reports', token, candidate);
    reports.push(report);
  }

  const dashboards = await apiGet(`/api/dashboards?workspaceId=${workspace.id}`, token);
  const dashboardSummary = dashboards.items?.find((item) => item.name === `${suffix} Executive Demo Dashboard`);
  const dashboardPayload = {
    name: `${suffix} Executive Demo Dashboard`,
    description: 'Dashboard showcasing the demo reports and enterprise widgets',
    workspaceId: workspace.id,
    visibility: 'Private',
    widgets: [
      { id: 'demo-exec-report', type: 'ReportVisual', title: 'Executive Demo Report', x: 0, y: 0, width: 4, height: 3, reportId: reports[0].id, config: { reportName: reports[0].name } },
      { id: 'demo-ops-report', type: 'ReportVisual', title: 'Operations Demo Report', x: 4, y: 0, width: 4, height: 3, reportId: reports[1].id, config: { reportName: reports[1].name } },
      { id: 'demo-analytics-report', type: 'ReportVisual', title: 'Analytics Demo Report', x: 8, y: 0, width: 4, height: 3, reportId: reports[2].id, config: { reportName: reports[2].name } },
      { id: 'demo-finance-report', type: 'ReportVisual', title: 'Finance Demo Report', x: 0, y: 5, width: 4, height: 3, reportId: reports[3].id, config: { reportName: reports[3].name } },
      { id: 'demo-governance-report', type: 'ReportVisual', title: 'Governance Demo Report', x: 4, y: 5, width: 4, height: 3, reportId: reports[4].id, config: { reportName: reports[4].name } },
      { id: 'demo-kpi', type: 'Kpi', title: 'Executive KPI', x: 8, y: 5, width: 4, height: 2, config: { value: '$1.25M' } },
      { id: 'demo-note', type: 'Text', title: 'Enterprise Overview', x: 0, y: 8, width: 12, height: 2, config: { markdown: 'Leadership layout with signals, ontology, and KPI context ready for curated report visuals.' } },
    ],
    filters: [{ id: 'demo-region-filter', field: 'region', operator: 'Equals', value: 'North' }],
  };
  const dashboard = dashboardSummary ? await apiPut(`/api/dashboards/${dashboardSummary.id}`, token, dashboardPayload) : await apiPost('/api/dashboards', token, dashboardPayload);
  if ((dashboard.widgets?.length ?? 0) < 7 || (dashboard.filters?.length ?? 0) === 0) {
    await apiPut(`/api/dashboards/${dashboard.id}`, token, {
      name: dashboard.name,
      description: dashboard.description,
      workspaceId: dashboard.workspaceId,
      visibility: dashboard.visibility,
      widgets: dashboardPayload.widgets,
      filters: [{ id: 'demo-region-filter', field: 'region', operator: 'Equals', value: 'North' }],
    });
  }

  await apiPost('/api/refresh-jobs', token, {
    targetType: 'Dataset',
    targetId: dataset.id,
    triggerType: 'Manual',
  }).then((job) =>
    apiPost(`/api/refresh-jobs/${job.id}/complete`, token, { status: 'Failed', message: 'Seeded failed refresh for smoke coverage' })
  );

  await apiPost('/api/refresh-jobs/schedules', token, {
    targetType: 'Dataset',
    targetId: dataset.id,
    name: `E2E Daily Refresh ${suffix}`,
    cronExpression: '0 8 * * *',
    timezone: 'UTC',
    isEnabled: true,
  });

  console.log(`Seeded demo workspace ${workspace.name}, dashboard ${dashboard.name}`);
}

async function ensureAdminUser() {
  const response = await fetch(`${API_URL}/api/setup/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: EMAIL,
      displayName: 'Local Dev',
      password: PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`Admin bootstrap failed: ${response.status} ${await response.text()}`);
  }
}

async function login() {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return json.token;
}

async function apiGet(path, token) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function apiPost(path, token, data) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function apiPut(path, token, data) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function buildExecutiveReport(workspaceId, datasetId, connectionId, suffix) {
  return {
    name: `${suffix} Executive Demo Report`,
    description: 'Executive summary demo report',
    isFeatured: true,
    workspaceId,
    datasetId,
    connectionId,
    queryText: `select 'North' as region, 145000 as total_sales, 92 as health_score, 'Q1' as period, 0.91 as confidence, 42 as open_deals, 18 as days_to_close
union all select 'South', 98000, 84, 'Q1', 0.76, 31, 24
union all select 'East', 121000, 88, 'Q1', 0.83, 35, 21
union all select 'West', 176000, 95, 'Q1', 0.97, 47, 16
union all select 'North', 152000, 93, 'Q2', 0.94, 45, 17
union all select 'South', 104000, 86, 'Q2', 0.79, 33, 23
union all select 'East', 130000, 90, 'Q2', 0.86, 38, 19
union all select 'West', 182000, 96, 'Q2', 0.98, 49, 15`,
    executionMode: 'Auto',
    cacheMode: 'Live',
    visibility: 'Private',
    allowEmbed: true,
    tags: ['e2e', 'smoke'],
    columns: [
      { sourceName: 'total_sales', displayName: 'Total Sales', displayOrder: 0, visible: true, dataType: 'integer' },
      { sourceName: 'region', displayName: 'Region', displayOrder: 1, visible: true, dataType: 'text' },
      { sourceName: 'health_score', displayName: 'Health Score', displayOrder: 2, visible: true, dataType: 'integer' },
      { sourceName: 'period', displayName: 'Period', displayOrder: 3, visible: true, dataType: 'text' },
      { sourceName: 'confidence', displayName: 'Confidence', displayOrder: 4, visible: true, dataType: 'number' },
      { sourceName: 'open_deals', displayName: 'Open Deals', displayOrder: 5, visible: true, dataType: 'integer' },
      { sourceName: 'days_to_close', displayName: 'Days to Close', displayOrder: 6, visible: true, dataType: 'integer' },
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
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Executive Trend',
        title: 'Executive Trend',
        type: 'Line',
        isDefault: false,
        showLegend: false,
        displayOrder: 1,
        xAxisColumn: 'period',
        yAxisColumn: 'total_sales',
        fieldWells: [
          { role: 'Category', field: 'period', displayName: 'Period', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'total_sales', displayName: 'Total Sales', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 8, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Confidence Gauge',
        title: 'Confidence Gauge',
        type: 'Gauge',
        isDefault: false,
        showLegend: false,
        displayOrder: 2,
        valueColumn: 'confidence',
        fieldWells: [{ role: 'Values', field: 'confidence', displayName: 'Confidence', aggregation: 'Average', displayOrder: 0 }],
        layout: { page: 1, x: 0, y: 5, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Regional Mix',
        title: 'Regional Mix',
        type: 'Doughnut',
        isDefault: false,
        showLegend: true,
        displayOrder: 3,
        xAxisColumn: 'region',
        yAxisColumn: 'open_deals',
        fieldWells: [
          { role: 'Category', field: 'region', displayName: 'Region', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'open_deals', displayName: 'Open Deals', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 8, y: 5, width: 8, height: 5, isHidden: false },
      },
    ],
  };
}

function buildOperationsReport(workspaceId, datasetId, connectionId, suffix) {
  return {
    name: `${suffix} Operations Demo Report`,
    description: 'Operations workflow demo report',
    isFeatured: true,
    workspaceId,
    datasetId,
    connectionId,
    queryText: `select 1 as stage_order, 'Lead' as stage, 120 as count, 70 as health_score, 18 as days_to_close, 12 as delta
union all select 2, 'Qualified', 74, 78, 21, -8
union all select 3, 'Proposal', 42, 81, 27, -6
union all select 4, 'Negotiation', 19, 87, 34, -3
union all select 5, 'Closed Won', 11, 94, 41, 2`,
    executionMode: 'Auto',
    cacheMode: 'Live',
    visibility: 'Private',
    allowEmbed: true,
    tags: ['demo', 'operations'],
    columns: [
      { sourceName: 'stage_order', displayName: 'Stage Order', displayOrder: 0, visible: true, dataType: 'integer' },
      { sourceName: 'stage', displayName: 'Stage', displayOrder: 1, visible: true, dataType: 'text' },
      { sourceName: 'count', displayName: 'Count', displayOrder: 2, visible: true, dataType: 'integer' },
      { sourceName: 'health_score', displayName: 'Health Score', displayOrder: 3, visible: true, dataType: 'integer' },
      { sourceName: 'days_to_close', displayName: 'Days to Close', displayOrder: 4, visible: true, dataType: 'integer' },
      { sourceName: 'delta', displayName: 'Delta', displayOrder: 5, visible: true, dataType: 'integer' },
    ],
    visualizations: [
      {
        $type: 'table',
        id: randomUUID(),
        name: 'Operations Table',
        title: 'Operations Table',
        type: 'Table',
        isDefault: true,
        showLegend: false,
        displayOrder: 0,
        fieldWells: [{ role: 'Values', field: 'stage', displayName: 'Stage', aggregation: 'None', displayOrder: 0 }],
        layout: { page: 1, x: 0, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Pipeline Funnel',
        title: 'Pipeline Funnel',
        type: 'Funnel',
        isDefault: false,
        showLegend: false,
        showConversionRate: true,
        displayOrder: 1,
        stageColumn: 'stage',
        valueColumn: 'count',
        fieldWells: [
          { role: 'Category', field: 'stage', displayName: 'Stage', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'count', displayName: 'Count', aggregation: 'Count', displayOrder: 1 },
        ],
        layout: { page: 1, x: 0, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Operations Health',
        title: 'Operations Health',
        type: 'Bar',
        isDefault: false,
        showLegend: false,
        displayOrder: 2,
        xAxisColumn: 'stage',
        yAxisColumn: 'health_score',
        fieldWells: [
          { role: 'Category', field: 'stage', displayName: 'Stage', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'health_score', displayName: 'Health Score', aggregation: 'Average', displayOrder: 1 },
        ],
        layout: { page: 1, x: 8, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Cycle Time Waterfall',
        title: 'Cycle Time Waterfall',
        type: 'Waterfall',
        isDefault: false,
        showLegend: false,
        displayOrder: 3,
        xAxisColumn: 'stage',
        yAxisColumn: 'delta',
        fieldWells: [
          { role: 'Category', field: 'stage', displayName: 'Stage', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'delta', displayName: 'Delta', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 0, y: 5, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Stage Scatter',
        title: 'Stage Scatter',
        type: 'Scatter',
        isDefault: false,
        showLegend: true,
        displayOrder: 4,
        xAxisColumn: 'days_to_close',
        yAxisColumn: 'health_score',
        fieldWells: [
          { role: 'Category', field: 'days_to_close', displayName: 'Days to Close', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'health_score', displayName: 'Health Score', aggregation: 'Average', displayOrder: 1 },
        ],
        layout: { page: 1, x: 8, y: 5, width: 8, height: 5, isHidden: false },
      },
    ],
  };
}

function buildAnalyticsReport(workspaceId, datasetId, connectionId, suffix) {
  return {
    name: `${suffix} Analytics Demo Report`,
    description: 'Analytical demo report',
    isFeatured: true,
    workspaceId,
    datasetId,
    connectionId,
    queryText: `select 'North' as region, 12 as revenue, 7 as risk, 4 as y, 20 as delta, 'Q1' as period, 4 as scorecard, 11 as exposure
union all select 'South', 9, 5, 3, 12, 'Q1', 3, 9
union all select 'East', 15, 6, 5, 18, 'Q1', 5, 13
union all select 'West', 10, 4, 2, 9, 'Q1', 2, 8
union all select 'North', 14, 6, 5, 23, 'Q2', 5, 14
union all select 'South', 11, 5, 4, 15, 'Q2', 4, 10
union all select 'East', 18, 7, 6, 25, 'Q2', 6, 16
union all select 'West', 13, 4, 3, 11, 'Q2', 3, 9`,
    executionMode: 'Auto',
    cacheMode: 'Live',
    visibility: 'Private',
    allowEmbed: true,
    tags: ['demo', 'analytics'],
    columns: [
      { sourceName: 'region', displayName: 'Region', displayOrder: 0, visible: true, dataType: 'text' },
      { sourceName: 'revenue', displayName: 'Revenue', displayOrder: 1, visible: true, dataType: 'integer' },
      { sourceName: 'risk', displayName: 'Risk', displayOrder: 2, visible: true, dataType: 'integer' },
      { sourceName: 'y', displayName: 'Y', displayOrder: 3, visible: true, dataType: 'integer' },
      { sourceName: 'delta', displayName: 'Delta', displayOrder: 4, visible: true, dataType: 'integer' },
      { sourceName: 'period', displayName: 'Period', displayOrder: 5, visible: true, dataType: 'text' },
      { sourceName: 'scorecard', displayName: 'Scorecard', displayOrder: 6, visible: true, dataType: 'integer' },
      { sourceName: 'exposure', displayName: 'Exposure', displayOrder: 7, visible: true, dataType: 'integer' },
    ],
    visualizations: [
      {
        $type: 'radar',
        id: randomUUID(),
        name: 'Risk Radar',
        title: 'Risk Radar',
        type: 'Radar',
        isDefault: true,
        showLegend: true,
        displayOrder: 0,
        labelColumn: 'region',
        valueColumns: ['revenue', 'risk'],
        fieldWells: [
          { role: 'Category', field: 'region', displayName: 'Region', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'revenue', displayName: 'Revenue', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 0, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'heatmap',
        id: randomUUID(),
        name: 'Heat Map',
        title: 'Heat Map',
        type: 'Heatmap',
        isDefault: false,
        showValues: true,
        displayOrder: 1,
        xColumn: 'region',
        yColumn: 'y',
        valueColumn: 'revenue',
        fieldWells: [
          { role: 'Category', field: 'region', displayName: 'Region', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'revenue', displayName: 'Revenue', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 0, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Revenue Delta',
        title: 'Revenue Delta',
        type: 'Area',
        isDefault: false,
        showLegend: true,
        displayOrder: 2,
        xAxisColumn: 'period',
        yAxisColumn: 'delta',
        fieldWells: [
          { role: 'Category', field: 'period', displayName: 'Period', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'delta', displayName: 'Delta', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 8, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Revenue Scatter',
        title: 'Revenue Scatter',
        type: 'Scatter',
        isDefault: false,
        showLegend: true,
        displayOrder: 3,
        xAxisColumn: 'revenue',
        yAxisColumn: 'risk',
        fieldWells: [
          { role: 'Category', field: 'revenue', displayName: 'Revenue', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'risk', displayName: 'Risk', aggregation: 'Average', displayOrder: 1 },
        ],
        layout: { page: 1, x: 0, y: 5, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Exposure Treemap',
        title: 'Exposure Treemap',
        type: 'Treemap',
        isDefault: false,
        showLegend: true,
        displayOrder: 4,
        xAxisColumn: 'region',
        yAxisColumn: 'exposure',
        fieldWells: [
          { role: 'Category', field: 'region', displayName: 'Region', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'exposure', displayName: 'Exposure', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 8, y: 5, width: 8, height: 5, isHidden: false },
      },
    ],
  };
}

function buildFinanceReport(workspaceId, datasetId, connectionId, suffix) {
  return {
    name: `${suffix} Finance Demo Report`,
    description: 'Finance and forecast demo report',
    isFeatured: true,
    workspaceId,
    datasetId,
    connectionId,
    queryText: `select 'Revenue' as metric, 182 as actual, 176 as target, 6 as variance, 'Q1' as period
union all select 'Margin', 34, 31, 3, 'Q1'
union all select 'Cash', 128, 120, 8, 'Q1'
union all select 'Revenue', 194, 185, 9, 'Q2'
union all select 'Margin', 38, 34, 4, 'Q2'
union all select 'Cash', 140, 133, 7, 'Q2'`,
    executionMode: 'Auto',
    cacheMode: 'Live',
    visibility: 'Private',
    allowEmbed: true,
    tags: ['demo', 'finance'],
    columns: [
      { sourceName: 'metric', displayName: 'Metric', displayOrder: 0, visible: true, dataType: 'text' },
      { sourceName: 'actual', displayName: 'Actual', displayOrder: 1, visible: true, dataType: 'integer' },
      { sourceName: 'target', displayName: 'Target', displayOrder: 2, visible: true, dataType: 'integer' },
      { sourceName: 'variance', displayName: 'Variance', displayOrder: 3, visible: true, dataType: 'integer' },
      { sourceName: 'period', displayName: 'Period', displayOrder: 4, visible: true, dataType: 'text' },
    ],
    visualizations: [
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Finance Waterfall',
        title: 'Finance Waterfall',
        type: 'Waterfall',
        isDefault: true,
        showLegend: false,
        displayOrder: 0,
        xAxisColumn: 'metric',
        yAxisColumn: 'variance',
        fieldWells: [
          { role: 'Category', field: 'metric', displayName: 'Metric', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'variance', displayName: 'Variance', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 0, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Finance Trend',
        title: 'Finance Trend',
        type: 'Line',
        isDefault: false,
        showLegend: true,
        displayOrder: 1,
        xAxisColumn: 'period',
        yAxisColumn: 'actual',
        fieldWells: [
          { role: 'Category', field: 'period', displayName: 'Period', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'actual', displayName: 'Actual', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 8, y: 0, width: 8, height: 5, isHidden: false },
      },
    ],
  };
}

function buildGovernanceReport(workspaceId, datasetId, connectionId, suffix) {
  return {
    name: `${suffix} Governance Demo Report`,
    description: 'Governance and ontology quality demo report',
    isFeatured: true,
    workspaceId,
    datasetId,
    connectionId,
    queryText: `select 'Customer' as term, 'dimension' as term_type, 18 as usage_count, 4 as quality_score, 'Sales' as domain, 'Q1' as period
union all select 'Order', 'fact', 25, 5, 'Sales', 'Q1'
union all select 'Revenue', 'measure', 42, 5, 'Finance', 'Q1'
union all select 'Churn', 'metric', 14, 3, 'Service', 'Q1'
union all select 'Customer', 'dimension', 20, 4, 'Sales', 'Q2'
union all select 'Order', 'fact', 27, 5, 'Sales', 'Q2'
union all select 'Revenue', 'measure', 45, 5, 'Finance', 'Q2'
union all select 'Churn', 'metric', 16, 3, 'Service', 'Q2'`,
    executionMode: 'Auto',
    cacheMode: 'Live',
    visibility: 'Private',
    allowEmbed: true,
    tags: ['demo', 'governance'],
    columns: [
      { sourceName: 'term', displayName: 'Term', displayOrder: 0, visible: true, dataType: 'text' },
      { sourceName: 'term_type', displayName: 'Term Type', displayOrder: 1, visible: true, dataType: 'text' },
      { sourceName: 'usage_count', displayName: 'Usage Count', displayOrder: 2, visible: true, dataType: 'integer' },
      { sourceName: 'quality_score', displayName: 'Quality Score', displayOrder: 3, visible: true, dataType: 'integer' },
      { sourceName: 'domain', displayName: 'Domain', displayOrder: 4, visible: true, dataType: 'text' },
      { sourceName: 'period', displayName: 'Period', displayOrder: 5, visible: true, dataType: 'text' },
    ],
    visualizations: [
      {
        $type: 'heatmap',
        id: randomUUID(),
        name: 'Governance Heatmap',
        title: 'Governance Heatmap',
        type: 'Heatmap',
        isDefault: true,
        showValues: true,
        displayOrder: 0,
        xColumn: 'domain',
        yColumn: 'quality_score',
        valueColumn: 'usage_count',
        fieldWells: [
          { role: 'Category', field: 'domain', displayName: 'Domain', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'usage_count', displayName: 'Usage Count', aggregation: 'Sum', displayOrder: 1 },
        ],
        layout: { page: 1, x: 0, y: 0, width: 8, height: 5, isHidden: false },
      },
      {
        $type: 'chart',
        id: randomUUID(),
        name: 'Ontology Radar',
        title: 'Ontology Radar',
        type: 'Radar',
        isDefault: false,
        showLegend: true,
        displayOrder: 1,
        labelColumn: 'term',
        valueColumns: ['quality_score', 'usage_count'],
        fieldWells: [
          { role: 'Category', field: 'term', displayName: 'Term', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'quality_score', displayName: 'Quality Score', aggregation: 'Average', displayOrder: 1 },
        ],
        layout: { page: 1, x: 8, y: 0, width: 8, height: 5, isHidden: false },
      },
    ],
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
