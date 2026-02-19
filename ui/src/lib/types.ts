// Re-export all API types
export * from './api/types';

// Query execution types
export interface QueryResult {
  rows: Record<string, unknown>[];
  columns: QueryColumn[];
  rowCount: number;
  executionTimeMs: number;
  cached: boolean;
  cachedAt?: string;
}

export interface QueryColumn {
  name: string;
  dataType: string;
  nullable: boolean;
}

// Extended column definition for UI
export interface ColumnDefinition {
  name: string;
  displayName?: string;
  dataType: string;
  visible?: boolean;
  order?: number;
}

// Chart configuration
export interface ChartConfig {
  chartType: 'bar' | 'horizontalBar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar';
  labelColumn: string;
  valueColumns: string[];
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showGrid?: boolean;
  beginAtZero?: boolean;
  stacked?: boolean;
  colorScheme?: string;
}

// KPI configuration
export interface KPIConfig {
  label: string;
  valueColumn: string;
  format?: 'number' | 'currency' | 'percent';
  currency?: string;
  decimals?: number;
  comparisonColumn?: string;
  comparisonLabel?: string;
  positiveIsGood?: boolean;
  valueColor?: string;
  backgroundColor?: string;
  icon?: string;
  iconColor?: string;
  subtitle?: string;
}

// Gauge configuration
export interface GaugeConfig {
  label: string;
  valueColumn: string;
  min?: number;
  max?: number;
  format?: 'number' | 'currency' | 'percent';
  currency?: string;
  decimals?: number;
  color?: string;
  thresholds?: GaugeThreshold[];
  subtitle?: string;
}

export interface GaugeThreshold {
  value: number;
  color: string;
}

// Table configuration
export interface TableConfig {
  pageSize?: number;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  stripedRows?: boolean;
  compactMode?: boolean;
  hiddenColumns?: string[];
  columnOrder?: string[];
  columnDisplayNames?: Record<string, string>;
}

// Unified visualization config
export interface VisualizationDefinition {
  id: string;
  type: 'table' | 'chart' | 'kpi' | 'gauge';
  title?: string;
  order: number;
  config: TableConfig | ChartConfig | KPIConfig | GaugeConfig;
}

// Data upload types
export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  sheets: SheetInfo[];
  uploadedAt: string;
}

export interface SheetInfo {
  name: string;
  rowCount: number;
  columns: DetectedColumn[];
  previewRows: Record<string, unknown>[];
}

export interface DetectedColumn {
  name: string;
  detectedType: string;
  sampleValues: unknown[];
  nullCount: number;
}

export interface ImportMapping {
  sheetName: string;
  targetTable: string;
  import: boolean;
  columnMappings: ColumnMapping[];
}

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
  targetType: string;
  createNew: boolean;
}

// Embed configuration
export interface EmbedConfig {
  reportId: string;
  embedToken: string;
  expiresAt: string;
  allowedOrigins: string[];
  showHeader: boolean;
  showFilters: boolean;
  defaultParameters?: Record<string, unknown>;
}

// Report execution
export interface ReportExecutionRequest {
  reportId: string;
  parameters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  useCache?: boolean;
}

export interface ReportExecutionResponse {
  result: QueryResult;
  report: {
    id: string;
    name: string;
    columns: ColumnDefinition[];
    visualizations: VisualizationDefinition[];
  };
  executedAt: string;
  executedBy: string;
}
