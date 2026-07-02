import { randomUUID } from 'crypto';

export interface DemoWorkspacePack {
  workspace: {
    name: string;
    description: string;
    slug: string;
    visibility: 'Private';
  };
  connection: {
    name: string;
    description: string;
    type: 'SQLite';
    connectionString: string;
    visibility: 'Private';
  };
  dataset: {
    name: string;
    description: string;
    sourceType: 'Query';
    sourceQuery: string;
    visibility: 'Private';
  };
  reports: DemoReportDefinition[];
  dashboard: {
    name: string;
    description: string;
    visibility: 'Private';
  };
  refreshSchedule: {
    name: string;
    cronExpression: string;
    timezone: string;
  };
}

export interface DemoReportDefinition {
  name: string;
  description: string;
  tags: string[];
  queryText: string;
  columns: Array<{
    sourceName: string;
    displayName: string;
    displayOrder: number;
    visible: true;
    dataType: string;
  }>;
  visualizations: Array<Record<string, unknown>>;
}

export function buildDemoWorkspacePack(suffix: string): DemoWorkspacePack {
  return {
    workspace: {
      name: `Demo Workspace ${suffix}`,
      description: 'Shared demo workspace with seeded reports and dashboards',
      slug: `demo-${suffix}-${Date.now()}`,
      visibility: 'Private',
    },
    connection: {
      name: `Demo SQLite ${suffix}`,
      description: 'Seeded by Playwright',
      type: 'SQLite',
      connectionString: 'Data Source=:memory:',
      visibility: 'Private',
    },
  dataset: {
    name: `Demo Dataset ${suffix}`,
    description: 'Seeded by Playwright',
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
        {
          id: 'sales',
          name: 'sales',
          displayName: 'Sales',
          isHidden: false,
        },
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
    },
    reports: [
      {
        name: `${suffix} Executive Demo Report`,
        description: 'Executive summary demo report',
        isFeatured: true,
        tags: ['e2e', 'smoke'],
        queryText: `select 'North' as region, 145000 as total_sales, 92 as health_score, 'Q1' as period, 0.91 as confidence, 42 as open_deals, 18 as days_to_close
union all select 'South', 98000, 84, 'Q1', 0.76, 31, 24
union all select 'East', 121000, 88, 'Q1', 0.83, 35, 21
union all select 'West', 176000, 95, 'Q1', 0.97, 47, 16
union all select 'North', 152000, 93, 'Q2', 0.94, 45, 17
union all select 'South', 104000, 86, 'Q2', 0.79, 33, 23
union all select 'East', 130000, 90, 'Q2', 0.86, 38, 19
union all select 'West', 182000, 96, 'Q2', 0.98, 49, 15`,
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
            fieldWells: [
              { role: 'Values', field: 'confidence', displayName: 'Confidence', aggregation: 'Average', displayOrder: 0 },
            ],
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
      },
      {
        name: `${suffix} Operations Demo Report`,
        description: 'Operations workflow demo report',
        isFeatured: true,
        tags: ['demo', 'operations'],
        queryText: `select 1 as stage_order, 'Lead' as stage, 120 as count, 70 as health_score, 18 as days_to_close, 12 as delta
union all select 2, 'Qualified', 74, 78, 21, -8
union all select 3, 'Proposal', 42, 81, 27, -6
union all select 4, 'Negotiation', 19, 87, 34, -3
union all select 5, 'Closed Won', 11, 94, 41, 2`,
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
      },
      {
        name: `${suffix} Analytics Demo Report`,
        description: 'Analytical demo report',
        isFeatured: true,
        tags: ['demo', 'analytics'],
        queryText: `select 'North' as region, 12 as revenue, 7 as risk, 4 as y, 20 as delta, 'Q1' as period, 4 as scorecard, 11 as exposure
union all select 'South', 9, 5, 3, 12, 'Q1', 3, 9
union all select 'East', 15, 6, 5, 18, 'Q1', 5, 13
union all select 'West', 10, 4, 2, 9, 'Q1', 2, 8
union all select 'North', 14, 6, 5, 23, 'Q2', 5, 14
union all select 'South', 11, 5, 4, 15, 'Q2', 4, 10
union all select 'East', 18, 7, 6, 25, 'Q2', 6, 16
union all select 'West', 13, 4, 3, 11, 'Q2', 3, 9`,
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
      },
      {
        name: `${suffix} Finance Demo Report`,
        description: 'Finance and forecast demo report',
        isFeatured: true,
        tags: ['demo', 'finance'],
        queryText: `select 'Revenue' as metric, 182 as actual, 176 as target, 6 as variance, 'Q1' as period, 1 as segment_order
union all select 'Margin', 34, 31, 3, 'Q1', 2
union all select 'Cash', 128, 120, 8, 'Q1', 3
union all select 'Revenue', 194, 185, 9, 'Q2', 1
union all select 'Margin', 38, 34, 4, 'Q2', 2
union all select 'Cash', 140, 133, 7, 'Q2', 3`,
        columns: [
          { sourceName: 'metric', displayName: 'Metric', displayOrder: 0, visible: true, dataType: 'text' },
          { sourceName: 'actual', displayName: 'Actual', displayOrder: 1, visible: true, dataType: 'integer' },
          { sourceName: 'target', displayName: 'Target', displayOrder: 2, visible: true, dataType: 'integer' },
          { sourceName: 'variance', displayName: 'Variance', displayOrder: 3, visible: true, dataType: 'integer' },
          { sourceName: 'period', displayName: 'Period', displayOrder: 4, visible: true, dataType: 'text' },
          { sourceName: 'segment_order', displayName: 'Segment Order', displayOrder: 5, visible: true, dataType: 'integer' },
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
      },
      {
        name: `${suffix} Governance Demo Report`,
        description: 'Governance and ontology quality demo report',
        isFeatured: true,
        tags: ['demo', 'governance'],
        queryText: `select 'Customer' as term, 'dimension' as term_type, 18 as usage_count, 4 as quality_score, 'Sales' as domain, 'Q1' as period
union all select 'Order', 'fact', 25, 5, 'Sales', 'Q1'
union all select 'Revenue', 'measure', 42, 5, 'Finance', 'Q1'
union all select 'Churn', 'metric', 14, 3, 'Service', 'Q1'
union all select 'Customer', 'dimension', 20, 4, 'Sales', 'Q2'
union all select 'Order', 'fact', 27, 5, 'Sales', 'Q2'
union all select 'Revenue', 'measure', 45, 5, 'Finance', 'Q2'
union all select 'Churn', 'metric', 16, 3, 'Service', 'Q2'`,
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
      },
    ],
    dashboard: {
      name: `${suffix} Executive Demo Dashboard`,
      description: 'Dashboard showcasing the demo reports and enterprise widgets',
      visibility: 'Private',
    },
    refreshSchedule: {
      name: `E2E Daily Refresh ${suffix}`,
      cronExpression: '0 8 * * *',
      timezone: 'UTC',
    },
  };
}
