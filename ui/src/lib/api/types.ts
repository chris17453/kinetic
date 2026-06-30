// Identity types
export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  phone?: string;
  title?: string;
  provider: 'Local' | 'Entra';
  departmentId?: string;
  department?: Department;
  groups: UserGroup[];
  timezone?: string;
  locale?: string;
  themeMode?: 'System' | 'Light' | 'Dark';
  preferences?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
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
  workspaceId?: string;
  workspaceName?: string;
  workspace?: WorkspaceSummary;
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

// Workspace types
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  slug: string;
  icon?: string;
  color?: string;
  ownerType: 'User' | 'Group';
  ownerId: string;
  visibility: Visibility;
  isDefault: boolean;
  isActive: boolean;
  reportCount: number;
  connectionCount: number;
  datasetCount: number;
  dashboardCount: number;
  memberCount: number;
  currentUserRole?: WorkspaceRole;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

export type WorkspaceRole = 'Viewer' | 'Contributor' | 'Member' | 'Admin';

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  isActive: boolean;
  addedAt: string;
  addedById: string;
  updatedAt?: string;
  updatedById?: string;
}

// Dataset / semantic model types
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  slug: string;
  workspaceId?: string;
  workspaceName?: string;
  workspace?: WorkspaceSummary;
  connectionId?: string;
  connectionName?: string;
  connection?: {
    id: string;
    name: string;
    type: ConnectionType;
  };
  sourceType: DatasetSourceType;
  sourceSchema?: string;
  sourceTable?: string;
  sourceQuery?: string;
  ownerType: 'User' | 'Group';
  ownerId: string;
  visibility: Visibility;
  tables: DatasetTable[];
  fields: DatasetField[];
  semanticModel: SemanticModelDefinition;
  isCertified: boolean;
  certifiedAt?: string;
  certifiedById?: string;
  certificationNotes?: string;
  isActive: boolean;
  createdAt: string;
  createdById: string;
  updatedAt?: string;
  updatedById?: string;
  lastRefreshedAt?: string;
}

export type DatasetSourceType = 'Query' | 'Table' | 'Upload' | 'Dataflow';

export interface DatasetTable {
  id: string;
  name: string;
  schema?: string;
  displayName?: string;
  isHidden: boolean;
}

export interface DatasetField {
  id: string;
  tableId: string;
  name: string;
  sourceName?: string;
  displayName?: string;
  dataType: string;
  kind: 'Dimension' | 'Measure' | 'CalculatedColumn';
  defaultAggregation?: string;
  formatString?: string;
  isHidden: boolean;
}

export interface SemanticModelDefinition {
  relationships: SemanticRelationship[];
  measures: SemanticMeasure[];
  hierarchies: SemanticHierarchy[];
}

export interface SemanticRelationship {
  id: string;
  fromTableId: string;
  fromFieldId: string;
  toTableId: string;
  toFieldId: string;
  cardinality: string;
  isActive: boolean;
}

export interface SemanticMeasure {
  id: string;
  name: string;
  expression: string;
  displayName?: string;
  formatString?: string;
}

export interface SemanticHierarchy {
  id: string;
  name: string;
  fieldIds: string[];
}

// Dashboard types
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  slug: string;
  workspaceId?: string;
  workspaceName?: string;
  workspace?: WorkspaceSummary;
  ownerType: 'User' | 'Group';
  ownerId: string;
  visibility: Visibility;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  widgetCount: number;
  isActive: boolean;
  createdAt: string;
  createdById: string;
  updatedAt?: string;
  updatedById?: string;
}

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  reportId?: string;
  visualizationId?: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: Record<string, unknown>;
}

export type DashboardWidgetType = 'ReportVisual' | 'Kpi' | 'Text' | 'Image' | 'Embed';

export interface DashboardFilter {
  id: string;
  field: string;
  operator: string;
  value?: string;
  datasetId?: string;
  reportId?: string;
}

// Enterprise integration types
export interface SystemIntegration {
  id: string;
  name: string;
  description?: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  authMode: IntegrationAuthMode;
  workspaceId?: string;
  workspaceName?: string;
  workspace?: WorkspaceSummary;
  ownerType: 'User' | 'Group';
  ownerId: string;
  visibility: Visibility;
  settings: Record<string, unknown>;
  secretReference?: string;
  tenantId?: string;
  clientId?: string;
  authorityUrl?: string;
  isEnabled: boolean;
  lastValidatedAt?: string;
  lastValidationStatus?: string;
  createdAt: string;
  createdById: string;
  updatedAt?: string;
  updatedById?: string;
}

export type IntegrationProvider =
  | 'MicrosoftEntraId'
  | 'AzureDevOps'
  | 'Azure'
  | 'OpenIdConnect'
  | 'Saml'
  | 'ServicePrincipal'
  | 'Custom';

export type IntegrationCategory =
  | 'Identity'
  | 'DevOps'
  | 'Cloud'
  | 'SystemLogin'
  | 'Notification'
  | 'Other';

export type IntegrationAuthMode =
  | 'None'
  | 'OAuth2'
  | 'OpenIdConnect'
  | 'Saml'
  | 'ClientSecret'
  | 'Certificate'
  | 'ManagedIdentity'
  | 'PersonalAccessToken'
  | 'ApiKey';

// Refresh types
export interface RefreshJob {
  id: string;
  targetType: RefreshTargetType;
  targetId: string;
  targetName: string;
  status: RefreshJobStatus;
  triggerType: RefreshTriggerType;
  integrationId?: string;
  integrationName?: string;
  message?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdById: string;
}

export interface RefreshSchedule {
  id: string;
  targetType: RefreshTargetType;
  targetId: string;
  targetName: string;
  name: string;
  cronExpression: string;
  timezone: string;
  isEnabled: boolean;
  integrationId?: string;
  integrationName?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  createdById: string;
  updatedAt?: string;
  updatedById?: string;
}

export type RefreshTargetType = 'Dataset' | 'Report' | 'Dashboard';
export type RefreshJobStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';
export type RefreshTriggerType = 'Manual' | 'Scheduled' | 'Dependency' | 'Api';

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
  workspaceId?: string;
  workspaceName?: string;
  workspace?: WorkspaceSummary;
  datasetId?: string;
  datasetName?: string;
  dataset?: {
    id: string;
    name: string;
    slug: string;
    workspaceId?: string;
    connectionId?: string;
    sourceType: DatasetSourceType;
    isCertified: boolean;
  };
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
  name?: string;
  title?: string;
  isDefault?: boolean;
  showLegend: boolean;
  colorScheme?: string;
  displayOrder: number;
  fieldWells?: VisualizationFieldWell[];
  layout?: VisualizationLayout;
  interactions?: VisualizationInteraction[];
}

export interface VisualizationFieldWell {
  role: string;
  field: string;
  displayName?: string;
  aggregation: FieldAggregation;
  displayOrder: number;
}

export interface VisualizationLayout {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isHidden: boolean;
}

export interface VisualizationInteraction {
  targetVisualizationId: string;
  mode: 'None' | 'Filter' | 'Highlight';
}

export type FieldAggregation = 'None' | 'Sum' | 'Average' | 'Min' | 'Max' | 'Count' | 'CountDistinct';

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
  | 'Sparkline'
  | 'Waterfall'
  | 'Sankey'
  | 'GeoMap'
  | 'Candlestick'
  | 'BoxPlot'
  | 'Histogram'
  | 'PolarArea'
  | 'Timeline'
  | 'Network';

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
