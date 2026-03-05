// Identity types
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  provider: 'Local' | 'Entra';
  departmentId?: string;
  department?: Department;
  groups: UserGroup[];
  createdAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  externalId?: string;
  departmentId?: string;
  department?: Department;
  permissions: GroupPermission[];
  createdAt: string;
  isSystem: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  children?: Department[];
  createdAt: string;
}

export interface UserGroup {
  userId: string;
  groupId: string;
  group?: Group;
  role: 'Member' | 'Manager' | 'Owner';
  joinedAt: string;
}

export interface GroupPermission {
  groupId: string;
  permissionCode: string;
}

// Connection types
export interface Connection {
  id: string;
  name: string;
  description?: string;
  type: ConnectionType;
  ownerType: 'User' | 'Group';
  ownerId: string;
  visibility: Visibility;
  createdAt: string;
  isActive: boolean;
}

export type ConnectionType =
  | 'PostgreSQL'
  | 'MySQL'
  | 'SqlServer'
  | 'SQLite'
  | 'Oracle'
  | 'MongoDB'
  | 'ClickHouse'
  | 'Snowflake'
  | 'BigQuery'
  | 'Custom';

export type Visibility = 'Private' | 'Group' | 'Department' | 'Public';
export type AccessLevel = 'View' | 'Execute' | 'Edit' | 'Manage';

// Report types
export interface Report {
  id: string;
  name: string;
  description?: string;
  slug: string;
  ownerType: 'User' | 'Group';
  ownerId: string;
  visibility: Visibility;
  categoryId?: string;
  category?: Category;
  tags: string[];
  connectionId: string;
  connection?: Connection;
  queryText: string;
  parameters: ParameterDefinition[];
  columns: ColumnDefinition[];
  visualizations: VisualizationConfig[];
  executionMode: 'Auto' | 'Manual';
  cacheMode: 'Live' | 'TempDb';
  cacheTtlSeconds?: number;
  allowEmbed: boolean;
  createdAt: string;
  createdById: string;
  updatedAt?: string;
  updatedById?: string;
  executionCount: number;
  lastExecutedAt?: string;
  isFeatured: boolean;
  isFavorite?: boolean;
  averageRating?: number;
  ratingCount?: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  displayOrder: number;
}

// Parameter types
export interface ParameterDefinition {
  id: string;
  variableName: string;
  label: string;
  type: ParameterType;
  displayOrder: number;
  required: boolean;
  errorMessage?: string;
  validationRegex?: string;
  defaultValue?: string;
  useSystemVariable: boolean;
  config?: ParameterConfig;
}

export type ParameterType =
  | 'String'
  | 'Text'
  | 'Int'
  | 'Decimal'
  | 'Bool'
  | 'Date'
  | 'DateTime'
  | 'Time'
  | 'DateRange'
  | 'Select'
  | 'MultiSelect'
  | 'UserPicker'
  | 'DepartmentPicker'
  | 'ConnectionPicker'
  | 'FilePicker'
  | 'Hidden';

export interface ParameterConfig {
  staticOptions?: SelectOption[];
  optionsQueryId?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  minDate?: string;
  maxDate?: string;
  maxSpan?: string;
  minValue?: number;
  maxValue?: number;
  decimalPlaces?: number;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

// Column types
export interface ColumnDefinition {
  id: string;
  sourceName: string;
  displayName: string;
  displayOrder: number;
  visible: boolean;
  dataType: string;
  format: ColumnFormat;
}

export interface ColumnFormat {
  type: 'None' | 'Number' | 'Currency' | 'Percent' | 'Date' | 'DateTime' | 'Time' | 'Custom';
  pattern?: string;
  decimalPlaces?: number;
  currencySymbol?: string;
  alignment: 'Left' | 'Center' | 'Right';
  width?: string;
  nullDisplay?: string;
}

// Visualization types
export interface VisualizationConfig {
  id: string;
  type: VisualizationType;
  title?: string;
  showLegend: boolean;
  colorScheme?: string;
  displayOrder: number;
}

export type VisualizationType =
  | 'Table'
  | 'PivotTable'
  | 'Bar'
  | 'BarHorizontal'
  | 'BarStacked'
  | 'Bar3D'
  | 'Line'
  | 'Area'
  | 'AreaStacked'
  | 'Pie'
  | 'Pie3D'
  | 'Doughnut'
  | 'Scatter'
  | 'Bubble'
  | 'Radar'
  | 'Funnel'
  | 'Heatmap'
  | 'Treemap'
  | 'Gauge'
  | 'KpiCard'
  | 'Sparkline';

export interface TableVisualizationConfig extends VisualizationConfig {
  type: 'Table';
  paginated: boolean;
  pageSize: number;
  sortable: boolean;
  filterable: boolean;
  stripedRows: boolean;
  bordered: boolean;
  exportFormats: ('Csv' | 'Excel' | 'Pdf' | 'Json')[];
  rowClickAction?: string;
}

export interface ChartVisualizationConfig extends VisualizationConfig {
  xAxisColumn?: string;
  yAxisColumn?: string;
  seriesColumn?: string;
  stacked: boolean;
  is3D: boolean;
  showLabels: boolean;
  showValues: boolean;
  orientation: 'Vertical' | 'Horizontal';
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  expiresAt: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Audit types
export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}
