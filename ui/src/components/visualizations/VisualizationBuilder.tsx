import type { ColumnDefinition, VisualizationType } from '../../lib/api/types';

interface VisualizationConfig {
  id: string;
  name: string;
  type: VisualizationType;
  isDefault: boolean;
  config: Record<string, unknown>;
}

interface VisualizationBuilderProps {
  visualizations: VisualizationConfig[];
  columns: ColumnDefinition[];
  onChange: (visualizations: VisualizationConfig[]) => void;
}

const vizTypes: { value: VisualizationType; label: string; icon: string }[] = [
  { value: 'Table', label: 'Table', icon: '📋' },
  { value: 'Bar', label: 'Bar Chart', icon: '📊' },
  { value: 'BarHorizontal', label: 'Horizontal Bar', icon: '📊' },
  { value: 'BarStacked', label: 'Stacked Bar', icon: '📊' },
  { value: 'Line', label: 'Line Chart', icon: '📈' },
  { value: 'Area', label: 'Area Chart', icon: '📈' },
  { value: 'Pie', label: 'Pie Chart', icon: '🥧' },
  { value: 'Doughnut', label: 'Doughnut', icon: '🍩' },
  { value: 'Scatter', label: 'Scatter Plot', icon: '⚫' },
  { value: 'Radar', label: 'Radar', icon: '🎯' },
  { value: 'Funnel', label: 'Funnel', icon: '🔻' },
  { value: 'Gauge', label: 'Gauge', icon: '🎛️' },
  { value: 'KpiCard', label: 'KPI Card', icon: '🔢' },
  { value: 'Heatmap', label: 'Heatmap', icon: '🗺️' },
  { value: 'Treemap', label: 'Treemap', icon: '🌳' },
];

export function VisualizationBuilder({ visualizations, columns, onChange }: VisualizationBuilderProps) {
  const addVisualization = (type: VisualizationType) => {
    const viz: VisualizationConfig = {
      id: crypto.randomUUID(),
      name: `${vizTypes.find((v) => v.value === type)?.label || type}`,
      type,
      isDefault: visualizations.length === 0,
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
        <h3 className="text-sm font-medium text-gray-700 mb-3">Add Visualization</h3>
        <div className="flex flex-wrap gap-2">
          {vizTypes.map((vt) => (
            <button
              key={vt.value}
              onClick={() => addVisualization(vt.value)}
              className="inline-flex items-center gap-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-md text-sm transition-colors"
            >
              <span>{vt.icon}</span>
              <span>{vt.label}</span>
            </button>
          ))}
        </div>
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
                  <span className="text-xl">{vizTypes.find((v) => v.value === viz.type)?.icon}</span>
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
                    <button
                      onClick={() => setDefault(index)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => removeVisualization(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="p-4">
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
    default:
      return {};
  }
}
