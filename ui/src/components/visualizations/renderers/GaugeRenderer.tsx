import React, { useMemo } from 'react';
import type { QueryResult, GaugeConfig } from '../../../lib/types';

interface GaugeRendererProps {
  data: QueryResult;
  config: GaugeConfig;
}

export const GaugeRenderer: React.FC<GaugeRendererProps> = ({ data, config }) => {
  const value = useMemo(() => {
    if (data.rows.length === 0) return 0;
    const val = data.rows[0][config.valueColumn];
    return typeof val === 'number' ? val : parseFloat(val as string) || 0;
  }, [data, config.valueColumn]);

  const { min = 0, max = 100, thresholds } = config;
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const getColor = (): string => {
    if (!thresholds || thresholds.length === 0) {
      return config.color || '#3b82f6';
    }

    // Sort thresholds by value
    const sorted = [...thresholds].sort((a, b) => a.value - b.value);
    
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (value >= sorted[i].value) {
        return sorted[i].color;
      }
    }
    
    return sorted[0]?.color || config.color || '#3b82f6';
  };

  const color = getColor();

  // SVG arc calculations
  const radius = 80;
  const strokeWidth = 12;
  const cx = 100;
  const cy = 100;
  const startAngle = 135;
  const endAngle = 405;
  const angleRange = endAngle - startAngle;

  const polarToCartesian = (angle: number) => {
    const radians = (angle - 90) * Math.PI / 180;
    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians),
    };
  };

  const createArc = (start: number, end: number) => {
    const startPoint = polarToCartesian(start);
    const endPoint = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;
  };

  const backgroundArc = createArc(startAngle, endAngle);
  const valueAngle = startAngle + (angleRange * percentage / 100);
  const valueArc = percentage > 0 ? createArc(startAngle, valueAngle) : '';

  const formatValue = (val: number): string => {
    if (config.format === 'percent') {
      return `${val.toFixed(config.decimals ?? 0)}%`;
    }
    if (config.format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: config.currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val);
    }
    return val.toLocaleString(undefined, {
      minimumFractionDigits: config.decimals ?? 0,
      maximumFractionDigits: config.decimals ?? 0,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <svg viewBox="0 0 200 140" className="w-full max-w-[300px]">
        {/* Background arc */}
        <path
          d={backgroundArc}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Value arc */}
        {valueArc && (
          <path
            d={valueArc}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        
        {/* Center value */}
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          className="text-3xl font-bold"
          fill={color}
          style={{ fontSize: '24px', fontWeight: 'bold' }}
        >
          {formatValue(value)}
        </text>
        
        {/* Min/Max labels */}
        <text
          x={30}
          y={130}
          textAnchor="middle"
          className="text-xs"
          fill="#9ca3af"
          style={{ fontSize: '10px' }}
        >
          {formatValue(min)}
        </text>
        <text
          x={170}
          y={130}
          textAnchor="middle"
          className="text-xs"
          fill="#9ca3af"
          style={{ fontSize: '10px' }}
        >
          {formatValue(max)}
        </text>
      </svg>
      
      {config.label && (
        <div className="text-sm font-medium text-gray-600 mt-2">
          {config.label}
        </div>
      )}
      
      {config.subtitle && (
        <div className="text-xs text-gray-400">
          {config.subtitle}
        </div>
      )}
    </div>
  );
};

export default GaugeRenderer;
