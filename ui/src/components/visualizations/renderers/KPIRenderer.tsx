import React from 'react';
import type { QueryResult, KPIConfig } from '../../../lib/types';

interface KPIRendererProps {
  data: QueryResult;
  config: KPIConfig;
}

export const KPIRenderer: React.FC<KPIRendererProps> = ({ data, config }) => {
  const getValue = (): string | number => {
    if (data.rows.length === 0) return '—';
    const value = data.rows[0][config.valueColumn];
    if (value === null || value === undefined) return '—';
    
    if (typeof value === 'number') {
      if (config.format === 'currency') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: config.currency || 'USD',
        }).format(value);
      }
      if (config.format === 'percent') {
        return `${(value * 100).toFixed(config.decimals ?? 1)}%`;
      }
      if (config.format === 'number') {
        return value.toLocaleString(undefined, {
          minimumFractionDigits: config.decimals ?? 0,
          maximumFractionDigits: config.decimals ?? 0,
        });
      }
    }
    return String(value);
  };

  const getComparison = (): { value: string; trend: 'up' | 'down' | 'neutral' } | null => {
    if (!config.comparisonColumn || data.rows.length === 0) return null;
    
    const current = data.rows[0][config.valueColumn] as number;
    const previous = data.rows[0][config.comparisonColumn] as number;
    
    if (typeof current !== 'number' || typeof previous !== 'number') return null;
    
    const diff = current - previous;
    const percentChange = previous !== 0 ? ((diff / previous) * 100) : 0;
    
    return {
      value: `${diff >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`,
      trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
    };
  };

  const comparison = getComparison();
  const trendColors = {
    up: config.positiveIsGood !== false ? 'text-green-600' : 'text-red-600',
    down: config.positiveIsGood !== false ? 'text-red-600' : 'text-green-600',
    neutral: 'text-gray-500',
  };

  return (
    <div
      className="flex flex-col items-center justify-center p-6 rounded-lg h-full"
      style={{ backgroundColor: config.backgroundColor || '#ffffff' }}
    >
      {config.icon && (
        <div className="text-4xl mb-2" style={{ color: config.iconColor || '#3b82f6' }}>
          {config.icon}
        </div>
      )}
      
      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
        {config.label}
      </div>
      
      <div
        className="text-4xl font-bold"
        style={{ color: config.valueColor || '#1f2937' }}
      >
        {getValue()}
      </div>
      
      {comparison && (
        <div className={`flex items-center mt-2 text-sm ${trendColors[comparison.trend]}`}>
          <span className="mr-1">
            {comparison.trend === 'up' ? '↑' : comparison.trend === 'down' ? '↓' : '→'}
          </span>
          <span>{comparison.value}</span>
          {config.comparisonLabel && (
            <span className="text-gray-400 ml-1">{config.comparisonLabel}</span>
          )}
        </div>
      )}
      
      {config.subtitle && (
        <div className="text-xs text-gray-400 mt-2">
          {config.subtitle}
        </div>
      )}
    </div>
  );
};

export default KPIRenderer;
