import React from 'react';
import type { KPIConfig, ColumnDefinition } from '../../../lib/types';

interface KPIConfigPanelProps {
  config: KPIConfig;
  columns: ColumnDefinition[];
  onChange: (config: KPIConfig) => void;
}

export const KPIConfigPanel: React.FC<KPIConfigPanelProps> = ({
  config,
  columns,
  onChange,
}) => {
  const formats = [
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency' },
    { value: 'percent', label: 'Percentage' },
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

  const numericColumns = columns.filter(c => 
    ['int', 'decimal', 'float', 'money', 'bigint'].includes(c.dataType)
  );

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-gray-700">KPI Configuration</h3>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          KPI Label
        </label>
        <input
          type="text"
          value={config.label || ''}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g., Total Revenue"
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

      {/* Format */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Format
          </label>
          <select
            value={config.format || 'number'}
            onChange={(e) => onChange({ ...config, format: e.target.value as KPIConfig['format'] })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          >
            {formats.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        {config.format === 'currency' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Currency
            </label>
            <select
              value={config.currency || 'USD'}
              onChange={(e) => onChange({ ...config, currency: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {currencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Decimals */}
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

      {/* Comparison Column */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Comparison Column (optional)
        </label>
        <select
          value={config.comparisonColumn || ''}
          onChange={(e) => onChange({ ...config, comparisonColumn: e.target.value || undefined })}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">None</option>
          {numericColumns.map(col => (
            <option key={col.name} value={col.name}>
              {col.displayName || col.name}
            </option>
          ))}
        </select>
      </div>

      {config.comparisonColumn && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Comparison Label
            </label>
            <input
              type="text"
              value={config.comparisonLabel || ''}
              onChange={(e) => onChange({ ...config, comparisonLabel: e.target.value })}
              placeholder="e.g., vs last month"
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.positiveIsGood !== false}
                onChange={(e) => onChange({ ...config, positiveIsGood: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-600">Positive change is good (green)</span>
            </label>
          </div>
        </>
      )}

      {/* Styling */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Value Color
          </label>
          <input
            type="color"
            value={config.valueColor || '#1f2937'}
            onChange={(e) => onChange({ ...config, valueColor: e.target.value })}
            className="w-full h-10 rounded-md cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Background Color
          </label>
          <input
            type="color"
            value={config.backgroundColor || '#ffffff'}
            onChange={(e) => onChange({ ...config, backgroundColor: e.target.value })}
            className="w-full h-10 rounded-md cursor-pointer"
          />
        </div>
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
          placeholder="e.g., Last 30 days"
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default KPIConfigPanel;
