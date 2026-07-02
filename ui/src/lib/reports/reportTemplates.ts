import type { VisualizationFieldWell, VisualizationLayout, VisualizationType } from '../api/types';

export type ReportTemplate = 'Standard' | 'Executive' | 'Operations';

export interface StarterVisualization {
  name: string;
  type: VisualizationType;
  isDefault: boolean;
  fieldWells: VisualizationFieldWell[];
  layout?: VisualizationLayout;
  config: Record<string, unknown>;
}

export function defaultReportVisualizations(template: ReportTemplate): StarterVisualization[] {
  if (template === 'Executive') {
    return [
      {
        name: 'Executive KPI',
        type: 'KpiCard',
        isDefault: true,
        fieldWells: [{ role: 'Values', field: 'executive_metric', aggregation: 'Sum', displayOrder: 0 }],
        config: { format: 'compact', showTrend: true },
      },
      {
        name: 'Executive Gauge',
        type: 'Gauge',
        isDefault: false,
        fieldWells: [{ role: 'Values', field: 'executive_metric', aggregation: 'Average', displayOrder: 0 }],
        config: { min: 0, max: 100, colorScheme: 'enterprise' },
      },
      {
        name: 'Executive Trend',
        type: 'Line',
        isDefault: false,
        fieldWells: [
          { role: 'Category', field: 'date', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'executive_metric', aggregation: 'Sum', displayOrder: 1 },
        ],
        config: { showLegend: false, colorScheme: 'enterprise' },
      },
      {
        name: 'Executive Mix',
        type: 'Radar',
        isDefault: false,
        fieldWells: [
          { role: 'Category', field: 'region', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'executive_metric', aggregation: 'Sum', displayOrder: 1 },
        ],
        config: { showLegend: true, fill: true },
      },
      {
        name: 'Executive Share',
        type: 'Doughnut',
        isDefault: false,
        fieldWells: [
          { role: 'Category', field: 'region', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'executive_metric', aggregation: 'Sum', displayOrder: 1 },
        ],
        config: { showLegend: true },
      },
    ];
  }

  if (template === 'Operations') {
    return [
      {
        name: 'Operations Table',
        type: 'Table',
        isDefault: true,
        fieldWells: [
          { role: 'Columns', field: 'name', aggregation: 'None', displayOrder: 0 },
          { role: 'Columns', field: 'status', aggregation: 'None', displayOrder: 1 },
          { role: 'Columns', field: 'owner', aggregation: 'None', displayOrder: 2 },
        ],
        config: { dense: true },
      },
      {
        name: 'Operations Status',
        type: 'BarHorizontal',
        isDefault: false,
        fieldWells: [
          { role: 'Category', field: 'status', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'count', aggregation: 'Count', displayOrder: 1 },
        ],
        config: { showLegend: false },
      },
      {
        name: 'Operations Flow',
        type: 'Funnel',
        isDefault: false,
        fieldWells: [
          { role: 'Category', field: 'stage', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'count', aggregation: 'Count', displayOrder: 1 },
        ],
        config: { showConversionRate: true },
      },
      {
        name: 'Operations Cycle Time',
        type: 'Waterfall',
        isDefault: false,
        fieldWells: [
          { role: 'Category', field: 'stage', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'cycle_time', aggregation: 'Sum', displayOrder: 1 },
        ],
        config: { showConnectorLines: true },
      },
      {
        name: 'Operations Scatter',
        type: 'Scatter',
        isDefault: false,
        fieldWells: [
          { role: 'Category', field: 'owner', aggregation: 'None', displayOrder: 0 },
          { role: 'Values', field: 'cycle_time', aggregation: 'Average', displayOrder: 1 },
        ],
        config: { showLegend: true },
      },
    ];
  }

  return [];
}
