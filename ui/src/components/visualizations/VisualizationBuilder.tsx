import type { ColumnDefinition, FieldAggregation, VisualizationFieldWell, VisualizationLayout, VisualizationType } from '../../lib/api/types';

interface VisualizationConfig {
  id: string;
  name: string;
  type: VisualizationType;
  isDefault: boolean;
  fieldWells?: VisualizationFieldWell[];
  layout?: VisualizationLayout;
  config: Record<string, unknown>;
}

interface VisualizationBuilderProps {
  visualizations: VisualizationConfig[];
  columns: ColumnDefinition[];
  onChange: (visualizations: VisualizationConfig[]) => void;
}

const vizTypes: { value: VisualizationType; label: string; icon: string; group: string; description: string }[] = [
  { value: 'KpiCard', label: 'KPI Card', icon: 'fa-square-poll-vertical', group: 'Executive', description: 'Headline metric with trend context.' },
  { value: 'Gauge', label: 'Gauge', icon: 'fa-gauge-high', group: 'Executive', description: 'Threshold-based target tracking.' },
  { value: 'Table', label: 'Table', icon: 'fa-table', group: 'Core', description: 'Operational detail and line-item review.' },
  { value: 'Bar', label: 'Bar Chart', icon: 'fa-chart-column', group: 'Core', description: 'Compare categories across measures.' },
  { value: 'BarHorizontal', label: 'Horizontal Bar', icon: 'fa-chart-column', group: 'Core', description: 'Ranked categories and labels.' },
  { value: 'BarStacked', label: 'Stacked Bar', icon: 'fa-chart-column', group: 'Core', description: 'Compare composition across segments.' },
  { value: 'Line', label: 'Line Chart', icon: 'fa-chart-line', group: 'Core', description: 'Trend and time-series analysis.' },
  { value: 'Area', label: 'Area Chart', icon: 'fa-chart-area', group: 'Core', description: 'Trend with emphasis on volume.' },
  { value: 'Pie', label: 'Pie Chart', icon: 'fa-chart-pie', group: 'Core', description: 'Part-to-whole composition.' },
  { value: 'Doughnut', label: 'Doughnut', icon: 'fa-chart-pie', group: 'Core', description: 'Compact composition view.' },
  { value: 'Scatter', label: 'Scatter Plot', icon: 'fa-braille', group: 'Analysis', description: 'Correlations and clusters.' },
  { value: 'Radar', label: 'Radar', icon: 'fa-chart-radar', group: 'Analysis', description: 'Multivariate comparison.' },
  { value: 'Funnel', label: 'Funnel', icon: 'fa-filter', group: 'Analysis', description: 'Stage progression and drop-off.' },
  { value: 'Heatmap', label: 'Heatmap', icon: 'fa-fire', group: 'Analysis', description: 'Density and hotspot analysis.' },
  { value: 'Treemap', label: 'Treemap', icon: 'fa-sitemap', group: 'Analysis', description: 'Hierarchical composition.' },
];

export function VisualizationBuilder({ visualizations, columns, onChange }: VisualizationBuilderProps) {
  const addVisualization = (type: VisualizationType) => {
    const viz: VisualizationConfig = {
      id: crypto.randomUUID(),
      name: `${vizTypes.find((v) => v.value === type)?.label || type}`,
      type,
      isDefault: visualizations.length === 0,
      fieldWells: getDefaultFieldWells(type, columns),
      layout: getDefaultLayout(visualizations.length),
      config: getDefaultConfig(type),
    };
    onChange([...visualizations, viz]);
  };

  const updateVisualization = (index: number, updates: Partial<VisualizationConfig>) => {
    const updated = [...visualizations];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeVisualization = (index: number) => {
    const updated = visualizations.filter((_, i) => i !== index);
    // Ensure one is default
    if (updated.length > 0 && !updated.some((v) => v.isDefault)) {
      updated[0].isDefault = true;
    }
    onChange(updated);
  };

  const setDefault = (index: number) => {
    onChange(visualizations.map((v, i) => ({ ...v, isDefault: i === index })));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Configure how report data is displayed. Add multiple visualizations for different views.
        </p>
      </div>

      {/* Add visualization buttons */}
      <div className="card p-4">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
          <div>
            <h3 className="h6 fw-bold mb-1">Add visualization</h3>
            <div className="text-muted small">Choose a layout for executive summaries, operational detail, or analytical review.</div>
          </div>
          <span className="badge text-bg-light border">Enterprise-ready</span>
        </div>
        {[...new Set(vizTypes.map(v => v.group))].map(group => (
          <div key={group} className="mb-3">
            <div className="small text-uppercase text-muted fw-semibold mb-2" style={{ letterSpacing: '0.08em' }}>{group}</div>
            <div className="d-flex flex-wrap gap-2">
              {vizTypes.filter(v => v.group === group).map((vt) => (
                <button
                  key={vt.value}
                  onClick={() => addVisualization(vt.value)}
                  className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
                  title={vt.description}
                >
                  <i className={`fa-solid ${vt.icon}`}></i>
                  <span>{vt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Configured visualizations */}
      {visualizations.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No visualizations configured. Add one above to display your report data.
        </div>
      ) : (
        <div className="space-y-4">
          {visualizations.map((viz, index) => (
            <div key={viz.id} className="card">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <i className={`fa-solid ${vizTypes.find((v) => v.value === viz.type)?.icon ?? 'fa-chart-column'} text-primary text-xl`}></i>
                  <input
                    type="text"
                    className="font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary-500 rounded px-1"
                    value={viz.name}
                    onChange={(e) => updateVisualization(index, { name: e.target.value })}
                  />
                  {viz.isDefault && (
                    <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!viz.isDefault && (
                    <button onClick={() => setDefault(index)} className="text-sm text-gray-500 hover:text-gray-700">
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => removeVisualization(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                  <div className="xl:col-span-2">
                    <FieldWellEditor
                      type={viz.type}
                      columns={columns}
                      fieldWells={viz.fieldWells ?? []}
                      onChange={(fieldWells, compatibilityConfig) => updateVisualization(index, {
                        fieldWells,
                        config: { ...viz.config, ...compatibilityConfig },
                      })}
                    />
                  </div>
                  <LayoutEditor
                    layout={viz.layout ?? getDefaultLayout(index)}
                    onChange={(layout) => updateVisualization(index, { layout })}
                  />
                </div>
                <VizConfigEditor
                  type={viz.type}
                  config={viz.config}
                  columns={columns}
                  onChange={(config) => updateVisualization(index, { config })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FieldWellEditorProps {
  type: VisualizationType;
  columns: ColumnDefinition[];
  fieldWells: VisualizationFieldWell[];
  onChange: (fieldWells: VisualizationFieldWell[], compatibilityConfig: Record<string, unknown>) => void;
}

const aggregations: FieldAggregation[] = ['None', 'Sum', 'Average', 'Min', 'Max', 'Count', 'CountDistinct'];

function FieldWellEditor({ type, columns, fieldWells, onChange }: FieldWellEditorProps) {
  const roles = fieldWellRoles(type);
  const visibleColumns = columns.filter((c) => c.visible);

  const updateRole = (role: string, updates: Partial<VisualizationFieldWell>) => {
    const existing = fieldWells.find(well => well.role === role);
    const nextWell: VisualizationFieldWell = {
      role,
      field: '',
      aggregation: role === 'Values' ? 'Sum' : 'None',
      displayOrder: roles.indexOf(role),
      ...existing,
      ...updates,
    };

    const next = [
      ...fieldWells.filter(well => well.role !== role),
      nextWell,
    ]
      .filter(well => well.field || well.role === role)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    onChange(next, fieldWellsToCompatibilityConfig(type, next));
  };

  return (
    <div className="border rounded p-3">
      <div className="text-sm font-medium text-gray-700 mb-3">Field Wells</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {roles.map((role) => {
          const well = fieldWells.find(item => item.role === role);
          return (
            <div key={role}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{role}</label>
              <div className="d-flex gap-2">
                <select
                  className="form-select form-select-sm"
                  value={well?.field ?? ''}
                  onChange={(e) => {
                    const column = visibleColumns.find(col => col.sourceName === e.target.value);
                    updateRole(role, {
                      field: e.target.value,
                      displayName: column?.displayName,
                    });
                  }}
                >
                  <option value="">None</option>
                  {visibleColumns.map((col) => (
                    <option key={col.sourceName} value={col.sourceName}>
                      {col.displayName || col.sourceName}
                    </option>
                  ))}
                </select>
                {role === 'Values' && (
                  <select
                    className="form-select form-select-sm"
                    style={{ maxWidth: 120 }}
                    value={well?.aggregation ?? 'Sum'}
                    onChange={(e) => updateRole(role, { aggregation: e.target.value as FieldAggregation })}
                  >
                    {aggregations.map(aggregation => (
                      <option key={aggregation} value={aggregation}>{aggregation}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface LayoutEditorProps {
  layout: VisualizationLayout;
  onChange: (layout: VisualizationLayout) => void;
}

function LayoutEditor({ layout, onChange }: LayoutEditorProps) {
  const update = (key: keyof VisualizationLayout, value: number | boolean) => {
    onChange({ ...layout, [key]: value });
  };

  return (
    <div className="border rounded p-3">
      <div className="text-sm font-medium text-gray-700 mb-3">Canvas Layout</div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Page" value={layout.page} min={1} onChange={value => update('page', value)} />
        <NumberField label="X" value={layout.x} min={0} onChange={value => update('x', value)} />
        <NumberField label="Y" value={layout.y} min={0} onChange={value => update('y', value)} />
        <NumberField label="W" value={layout.width} min={1} onChange={value => update('width', value)} />
        <NumberField label="H" value={layout.height} min={1} onChange={value => update('height', value)} />
        <label className="d-flex align-items-end gap-2 small pb-1">
          <input
            type="checkbox"
            checked={layout.isHidden}
            onChange={e => update('isHidden', e.target.checked)}
          />
          Hidden
        </label>
      </div>
    </div>
  );
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return (
    <label className="small text-gray-600">
      {label}
      <input
        type="number"
        className="form-control form-control-sm mt-1"
        min={min}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </label>
  );
}

interface VizConfigEditorProps {
  type: VisualizationType;
  config: Record<string, unknown>;
  columns: ColumnDefinition[];
  onChange: (config: Record<string, unknown>) => void;
}

function VizConfigEditor({ type, config, columns, onChange }: VizConfigEditorProps) {
  const visibleColumns = columns.filter((c) => c.visible);

  const update = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  if (type === 'Table') {
    return (
      <div className="grid grid-cols-3 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.paginated as boolean ?? true}
            onChange={(e) => update('paginated', e.target.checked)}
            className="rounded border-gray-300"
          />
          Paginated
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.sortable as boolean ?? true}
            onChange={(e) => update('sortable', e.target.checked)}
            className="rounded border-gray-300"
          />
          Sortable
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.filterable as boolean ?? true}
            onChange={(e) => update('filterable', e.target.checked)}
            className="rounded border-gray-300"
          />
          Filterable
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.stripedRows as boolean ?? true}
            onChange={(e) => update('stripedRows', e.target.checked)}
            className="rounded border-gray-300"
          />
          Striped Rows
        </label>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Page Size:</label>
          <input
            type="number"
            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
            value={config.pageSize as number ?? 25}
            onChange={(e) => update('pageSize', parseInt(e.target.value))}
          />
        </div>
      </div>
    );
  }

  if (['Bar', 'BarHorizontal', 'BarStacked', 'Line', 'Area', 'AreaStacked'].includes(type)) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">X-Axis Column</label>
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            value={config.xAxisColumn as string ?? ''}
            onChange={(e) => update('xAxisColumn', e.target.value)}
          >
            <option value="">Select column...</option>
            {visibleColumns.map((col) => (
              <option key={col.sourceName} value={col.sourceName}>
                {col.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Y-Axis Column</label>
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            value={config.yAxisColumn as string ?? ''}
            onChange={(e) => update('yAxisColumn', e.target.value)}
          >
            <option value="">Select column...</option>
            {visibleColumns.map((col) => (
              <option key={col.sourceName} value={col.sourceName}>
                {col.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Series Column (optional)</label>
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            value={config.seriesColumn as string ?? ''}
            onChange={(e) => update('seriesColumn', e.target.value)}
          >
            <option value="">None</option>
            {visibleColumns.map((col) => (
              <option key={col.sourceName} value={col.sourceName}>
                {col.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.showLabels as boolean ?? true}
              onChange={(e) => update('showLabels', e.target.checked)}
              className="rounded border-gray-300"
            />
            Show Labels
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.showLegend as boolean ?? true}
              onChange={(e) => update('showLegend', e.target.checked)}
              className="rounded border-gray-300"
            />
            Show Legend
          </label>
        </div>
      </div>
    );
  }

  if (['Pie', 'Doughnut'].includes(type)) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Label Column</label>
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            value={config.labelColumn as string ?? ''}
            onChange={(e) => update('labelColumn', e.target.value)}
          >
            <option value="">Select column...</option>
            {visibleColumns.map((col) => (
              <option key={col.sourceName} value={col.sourceName}>
                {col.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Value Column</label>
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            value={config.valueColumn as string ?? ''}
            onChange={(e) => update('valueColumn', e.target.value)}
          >
            <option value="">Select column...</option>
            {visibleColumns.map((col) => (
              <option key={col.sourceName} value={col.sourceName}>
                {col.displayName}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.showPercentages as boolean ?? true}
            onChange={(e) => update('showPercentages', e.target.checked)}
            className="rounded border-gray-300"
          />
          Show Percentages
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.showLegend as boolean ?? true}
            onChange={(e) => update('showLegend', e.target.checked)}
            className="rounded border-gray-300"
          />
          Show Legend
        </label>
      </div>
    );
  }

  if (type === 'KpiCard') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Value Column</label>
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            value={config.valueColumn as string ?? ''}
            onChange={(e) => update('valueColumn', e.target.value)}
          >
            <option value="">Select column...</option>
            {visibleColumns.map((col) => (
              <option key={col.sourceName} value={col.sourceName}>
                {col.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Compare Column (optional)</label>
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            value={config.compareColumn as string ?? ''}
            onChange={(e) => update('compareColumn', e.target.value)}
          >
            <option value="">None</option>
            {visibleColumns.map((col) => (
              <option key={col.sourceName} value={col.sourceName}>
                {col.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Format</label>
          <input
            type="text"
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            placeholder="e.g., $#,##0.00"
            value={config.format as string ?? ''}
            onChange={(e) => update('format', e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.showTrend as boolean ?? true}
            onChange={(e) => update('showTrend', e.target.checked)}
            className="rounded border-gray-300"
          />
          Show Trend Arrow
        </label>
      </div>
    );
  }

  if (type === 'Radar') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Category Column</label>
          <select className="w-full px-2 py-1 border border-gray-300 rounded text-sm" value={config.labelColumn as string ?? ''} onChange={(e) => update('labelColumn', e.target.value)}>
            <option value="">Select column...</option>
            {visibleColumns.map((col) => <option key={col.sourceName} value={col.sourceName}>{col.displayName}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.showLegend as boolean ?? true} onChange={(e) => update('showLegend', e.target.checked)} className="rounded border-gray-300" />
          Show Legend
        </label>
      </div>
    );
  }

  if (type === 'Funnel') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Stage Column</label>
          <select className="w-full px-2 py-1 border border-gray-300 rounded text-sm" value={config.stageColumn as string ?? ''} onChange={(e) => update('stageColumn', e.target.value)}>
            <option value="">Select column...</option>
            {visibleColumns.map((col) => <option key={col.sourceName} value={col.sourceName}>{col.displayName}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.showConversionRate as boolean ?? true} onChange={(e) => update('showConversionRate', e.target.checked)} className="rounded border-gray-300" />
          Show Conversion Rate
        </label>
      </div>
    );
  }

  if (type === 'Heatmap') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.showValues as boolean ?? true} onChange={(e) => update('showValues', e.target.checked)} className="rounded border-gray-300" />
          Show Values
        </label>
        <div>
          <label className="block text-sm text-gray-600 mb-1">High Color</label>
          <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="#1d4ed8" value={config.colorScaleHigh as string ?? ''} onChange={(e) => update('colorScaleHigh', e.target.value)} />
        </div>
      </div>
    );
  }

  if (type === 'Waterfall') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.showConnectorLines as boolean ?? true} onChange={(e) => update('showConnectorLines', e.target.checked)} className="rounded border-gray-300" />
          Show Connector Lines
        </label>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Total Color</label>
          <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="#0f766e" value={config.totalColor as string ?? ''} onChange={(e) => update('totalColor', e.target.value)} />
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-500">
      Configuration for {type} coming soon...
    </div>
  );
}

function getDefaultConfig(type: VisualizationType): Record<string, unknown> {
  switch (type) {
    case 'Table':
      return { paginated: true, pageSize: 25, sortable: true, filterable: true, stripedRows: true };
    case 'Bar':
    case 'BarHorizontal':
    case 'BarStacked':
    case 'Line':
    case 'Area':
      return { showLabels: true, showLegend: true };
    case 'Pie':
    case 'Doughnut':
      return { showPercentages: true, showLegend: true };
    case 'KpiCard':
      return { showTrend: true };
    case 'Gauge':
      return { min: 0, max: 100, colorScheme: 'enterprise' };
    case 'Radar':
      return { showLegend: true, fill: true };
    case 'Funnel':
      return { showConversionRate: true, inverted: false };
    case 'Heatmap':
      return { showValues: true, colorScaleLow: '#eff6ff', colorScaleHigh: '#1d4ed8' };
    case 'Waterfall':
      return { showConnectorLines: true, totalColor: '#0f766e' };
    default:
      return {};
  }
}

function fieldWellRoles(type: VisualizationType): string[] {
  if (type === 'Table') return ['Values', 'Filters'];
  if (['Pie', 'Doughnut', 'Pie3D'].includes(type)) return ['Category', 'Values', 'Tooltips', 'Filters'];
  if (type === 'KpiCard' || type === 'Gauge') return ['Values', 'Target', 'Trend', 'Filters'];
  return ['Category', 'Values', 'Series', 'Tooltips', 'Filters'];
}

function getDefaultFieldWells(type: VisualizationType, columns: ColumnDefinition[]): VisualizationFieldWell[] {
  const visible = columns.filter(column => column.visible);
  const roles = fieldWellRoles(type);
  return roles
    .map<VisualizationFieldWell | null>((role, index) => {
      const column = visible[index === 0 ? 0 : Math.min(index, visible.length - 1)];
      if (!column || (role !== 'Category' && role !== 'Values')) return null;
      return {
        role,
        field: column.sourceName,
        displayName: column.displayName,
        aggregation: role === 'Values' ? 'Sum' as FieldAggregation : 'None' as FieldAggregation,
        displayOrder: index,
      };
    })
    .filter((well): well is VisualizationFieldWell => well !== null);
}

function getDefaultLayout(index: number): VisualizationLayout {
  return {
    page: 1,
    x: (index % 2) * 6,
    y: Math.floor(index / 2) * 4,
    width: 6,
    height: 4,
    isHidden: false,
  };
}

function fieldWellsToCompatibilityConfig(type: VisualizationType, fieldWells: VisualizationFieldWell[]): Record<string, unknown> {
  const byRole = (role: string) => fieldWells.find(well => well.role === role)?.field;
  if (type === 'Table') return {};
  if (['Pie', 'Doughnut', 'Pie3D'].includes(type)) {
    return { labelColumn: byRole('Category'), valueColumn: byRole('Values') };
  }
  if (type === 'KpiCard') {
    return { valueColumn: byRole('Values'), compareColumn: byRole('Target'), sparklineColumn: byRole('Trend') };
  }
  if (type === 'Gauge') {
    return { valueColumn: byRole('Values'), targetValue: byRole('Target') };
  }
  return { xAxisColumn: byRole('Category'), yAxisColumn: byRole('Values'), seriesColumn: byRole('Series') };
}
