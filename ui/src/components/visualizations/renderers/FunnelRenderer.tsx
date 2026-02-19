import { useMemo } from 'react';

interface FunnelData {
  stage: string;
  value: number;
  percentage?: number;
  conversionRate?: number;
}

interface FunnelRendererProps {
  data: { rows: Record<string, unknown>[] };
  config: {
    stageColumn: string;
    valueColumn: string;
    title?: string;
    showConversionRate?: boolean;
    inverted?: boolean;
    colorScheme?: 'blue' | 'green' | 'purple' | 'gradient';
  };
}

const COLOR_SCHEMES = {
  blue: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  green: ['#065f46', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
  purple: ['#5b21b6', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
  gradient: ['#1e40af', '#4338ca', '#7c3aed', '#c026d3', '#e11d48', '#f97316'],
};

export function FunnelRenderer({ data, config }: FunnelRendererProps) {
  const funnelData: FunnelData[] = useMemo(() => {
    const rows = data.rows.map(row => ({
      stage: String(row[config.stageColumn] ?? ''),
      value: typeof row[config.valueColumn] === 'number'
        ? row[config.valueColumn] as number
        : parseFloat(row[config.valueColumn] as string) || 0,
    }));

    // Sort by value descending if not inverted
    const sorted = config.inverted ? rows : [...rows].sort((a, b) => b.value - a.value);
    const maxValue = Math.max(...sorted.map(r => r.value));

    return sorted.map((row, index) => ({
      ...row,
      percentage: (row.value / maxValue) * 100,
      conversionRate: index > 0
        ? (row.value / sorted[index - 1].value) * 100
        : 100,
    }));
  }, [data, config]);

  const colors = COLOR_SCHEMES[config.colorScheme || 'blue'];

  return (
    <div className="w-full h-full min-h-[400px] p-4">
      {config.title && (
        <h3 className="text-lg font-semibold text-center mb-6">{config.title}</h3>
      )}
      
      <div className="flex flex-col items-center gap-1">
        {funnelData.map((item, index) => {
          const widthPercent = item.percentage ?? 100;
          const color = colors[index % colors.length];
          
          return (
            <div
              key={item.stage}
              className="relative flex items-center justify-center transition-all duration-300"
              style={{
                width: `${widthPercent}%`,
                minWidth: '60%',
                maxWidth: '100%',
              }}
            >
              <div
                className="w-full py-4 px-6 text-white text-center relative overflow-hidden"
                style={{
                  backgroundColor: color,
                  clipPath: index < funnelData.length - 1
                    ? 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)'
                    : 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)',
                }}
              >
                <div className="font-semibold">{item.stage}</div>
                <div className="text-2xl font-bold">
                  {item.value.toLocaleString()}
                </div>
                {config.showConversionRate && index > 0 && (
                  <div className="text-sm opacity-80">
                    {item.conversionRate?.toFixed(1)}% conversion
                  </div>
                )}
              </div>
              
              {/* Conversion arrow */}
              {config.showConversionRate && index < funnelData.length - 1 && (
                <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 z-10">
                  <div className="bg-white rounded-full px-2 py-1 text-xs font-medium text-gray-600 shadow-sm border">
                    ↓ {funnelData[index + 1]?.conversionRate?.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FunnelRenderer;
