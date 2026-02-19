import React from 'react';
import type { ChartConfig, ColumnDefinition } from '../../../lib/types';

interface ChartConfigPanelProps {
  config: ChartConfig;
  columns: ColumnDefinition[];
  onChange: (config: ChartConfig) => void;
}

export const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({
  config,
  columns,
  onChange,
}) => {
  const chartTypes = [
    { value: 'bar', label: 'Bar Chart' },
    { value: 'horizontalBar', label: 'Horizontal Bar' },
    { value: 'line', label: 'Line Chart' },
    { value: 'area', label: 'Area Chart' },
    { value: 'pie', label: 'Pie Chart' },
    { value: 'doughnut', label: 'Doughnut Chart' },
    { value: 'scatter', label: 'Scatter Plot' },
  ];

  const legendPositions = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ];

  const numericColumns = columns.filter(c => 
    ['int', 'decimal', 'float', 'money', 'bigint'].includes(c.dataType)
  );

  const handleValueColumnToggle = (columnName: string) => {
    const current = config.valueColumns || [];
    const updated = current.includes(columnName)
      ? current.filter(c => c !== columnName)
      : [...current, columnName];
    onChange({ ...config, valueColumns: updated });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-gray-700">Chart Configuration</h3>

      {/* Chart Type */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Chart Type
        </label>
        <select
          value={config.chartType}
          onChange={(e) => onChange({ ...config, chartType: e.target.value as ChartConfig['chartType'] })}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        >
          {chartTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Label Column (X-Axis / Categories) */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Label Column (Categories)
        </label>
        <select
          value={config.labelColumn || ''}
          onChange={(e) => onChange({ ...config, labelColumn: e.target.value })}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select column...</option>
          {columns.map(col => (
            <option key={col.name} value={col.name}>
              {col.displayName || col.name}
            </option>
          ))}
        </select>
      </div>

      {/* Value Columns (Y-Axis / Data Series) */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Value Columns (Data Series)
        </label>
        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2 bg-white">
          {numericColumns.map(col => (
            <label key={col.name} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.valueColumns?.includes(col.name) || false}
                onChange={() => handleValueColumnToggle(col.name)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">{col.displayName || col.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Chart Title
        </label>
        <input
          type="text"
          value={config.title || ''}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="Enter chart title..."
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Axis Labels (for non-pie/doughnut) */}
      {config.chartType !== 'pie' && config.chartType !== 'doughnut' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                X-Axis Label
              </label>
              <input
                type="text"
                value={config.xAxisLabel || ''}
                onChange={(e) => onChange({ ...config, xAxisLabel: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Y-Axis Label
              </label>
              <input
                type="text"
                value={config.yAxisLabel || ''}
                onChange={(e) => onChange({ ...config, yAxisLabel: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </>
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showLegend !== false}
              onChange={(e) => onChange({ ...config, showLegend: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-600">Show Legend</span>
          </label>
        </div>
        <div>
          <select
            value={config.legendPosition || 'top'}
            onChange={(e) => onChange({ ...config, legendPosition: e.target.value as ChartConfig['legendPosition'] })}
            disabled={config.showLegend === false}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {legendPositions.map(pos => (
              <option key={pos.value} value={pos.value}>{pos.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Additional Options */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showGrid !== false}
            onChange={(e) => onChange({ ...config, showGrid: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-600">Show Grid Lines</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.beginAtZero !== false}
            onChange={(e) => onChange({ ...config, beginAtZero: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-600">Begin Y-Axis at Zero</span>
        </label>
      </div>
    </div>
  );
};

export default ChartConfigPanel;
