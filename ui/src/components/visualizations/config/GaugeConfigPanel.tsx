import React from 'react';
import type { GaugeConfig, ColumnDefinition } from '../../../lib/types';

interface GaugeConfigPanelProps {
  config: GaugeConfig;
  columns: ColumnDefinition[];
  onChange: (config: GaugeConfig) => void;
}

export const GaugeConfigPanel: React.FC<GaugeConfigPanelProps> = ({
  config,
  columns,
  onChange,
}) => {
  const formats = [
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency' },
    { value: 'percent', label: 'Percentage' },
  ];

  const numericColumns = columns.filter(c => 
    ['int', 'decimal', 'float', 'money', 'bigint'].includes(c.dataType)
  );

  const handleThresholdChange = (index: number, field: 'value' | 'color', val: string | number) => {
    const thresholds = [...(config.thresholds || [])];
    thresholds[index] = { ...thresholds[index], [field]: val };
    onChange({ ...config, thresholds });
  };

  const addThreshold = () => {
    const thresholds = [...(config.thresholds || []), { value: 0, color: '#3b82f6' }];
    onChange({ ...config, thresholds });
  };

  const removeThreshold = (index: number) => {
    const thresholds = (config.thresholds || []).filter((_, i) => i !== index);
    onChange({ ...config, thresholds });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-gray-700">Gauge Configuration</h3>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Gauge Label
        </label>
        <input
          type="text"
          value={config.label || ''}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g., CPU Usage"
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Value Column */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Value Column
        </label>
        <select
          value={config.valueColumn || ''}
          onChange={(e) => onChange({ ...config, valueColumn: e.target.value })}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select column...</option>
          {numericColumns.map(col => (
            <option key={col.name} value={col.name}>
              {col.displayName || col.name}
            </option>
          ))}
        </select>
      </div>

      {/* Min/Max */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Minimum Value
          </label>
          <input
            type="number"
            value={config.min ?? 0}
            onChange={(e) => onChange({ ...config, min: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Maximum Value
          </label>
          <input
            type="number"
            value={config.max ?? 100}
            onChange={(e) => onChange({ ...config, max: parseFloat(e.target.value) || 100 })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Format */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Format
          </label>
          <select
            value={config.format || 'number'}
            onChange={(e) => onChange({ ...config, format: e.target.value as GaugeConfig['format'] })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          >
            {formats.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Decimal Places
          </label>
          <input
            type="number"
            min={0}
            max={6}
            value={config.decimals ?? 0}
            onChange={(e) => onChange({ ...config, decimals: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Default Color */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Default Color
        </label>
        <input
          type="color"
          value={config.color || '#3b82f6'}
          onChange={(e) => onChange({ ...config, color: e.target.value })}
          className="w-full h-10 rounded-md cursor-pointer"
        />
      </div>

      {/* Thresholds */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-600">
            Color Thresholds
          </label>
          <button
            type="button"
            onClick={addThreshold}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Add Threshold
          </button>
        </div>
        <div className="space-y-2">
          {(config.thresholds || []).map((threshold, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-gray-500">≥</span>
              <input
                type="number"
                value={threshold.value}
                onChange={(e) => handleThresholdChange(index, 'value', parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="color"
                value={threshold.color}
                onChange={(e) => handleThresholdChange(index, 'color', e.target.value)}
                className="w-10 h-10 rounded-md cursor-pointer"
              />
              <button
                type="button"
                onClick={() => removeThreshold(index)}
                className="text-red-500 hover:text-red-700 px-2"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {(!config.thresholds || config.thresholds.length === 0) && (
          <p className="text-xs text-gray-400">No thresholds defined. Default color will be used.</p>
        )}
      </div>

      {/* Subtitle */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Subtitle (optional)
        </label>
        <input
          type="text"
          value={config.subtitle || ''}
          onChange={(e) => onChange({ ...config, subtitle: e.target.value })}
          placeholder="e.g., Current load"
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default GaugeConfigPanel;
