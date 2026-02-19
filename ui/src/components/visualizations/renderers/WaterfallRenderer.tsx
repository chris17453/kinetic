import { useMemo } from 'react';

interface WaterfallItem {
  category: string;
  value: number;
  type: 'increase' | 'decrease' | 'total';
  start: number;
  end: number;
}

interface WaterfallRendererProps {
  data: { rows: Record<string, unknown>[] };
  config: {
    categoryColumn: string;
    valueColumn: string;
    typeColumn?: string;
    title?: string;
    increaseColor?: string;
    decreaseColor?: string;
    totalColor?: string;
    showConnectorLines?: boolean;
  };
}

export function WaterfallRenderer({ data, config }: WaterfallRendererProps) {
  const { items, maxValue, minValue } = useMemo(() => {
    let runningTotal = 0;
    const items: WaterfallItem[] = data.rows.map(row => {
      const value = typeof row[config.valueColumn] === 'number'
        ? row[config.valueColumn] as number
        : parseFloat(row[config.valueColumn] as string) || 0;
      
      let type: 'increase' | 'decrease' | 'total' = 'increase';
      if (config.typeColumn && row[config.typeColumn]) {
        const typeValue = String(row[config.typeColumn]).toLowerCase();
        if (typeValue === 'total' || typeValue === 'sum') {
          type = 'total';
        } else if (typeValue === 'decrease' || typeValue === 'negative' || value < 0) {
          type = 'decrease';
        }
      } else if (value < 0) {
        type = 'decrease';
      }
      
      const start = type === 'total' ? 0 : runningTotal;
      const end = type === 'total' ? value : runningTotal + value;
      
      if (type !== 'total') {
        runningTotal += value;
      }
      
      return {
        category: String(row[config.categoryColumn] ?? ''),
        value: Math.abs(value),
        type,
        start,
        end,
      };
    });
    
    const allValues = items.flatMap(i => [i.start, i.end]);
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    
    return { items, maxValue, minValue };
  }, [data, config]);

  const range = maxValue - minValue || 1;
  const increaseColor = config.increaseColor || '#22c55e';
  const decreaseColor = config.decreaseColor || '#ef4444';
  const totalColor = config.totalColor || '#3b82f6';

  const getColor = (type: 'increase' | 'decrease' | 'total') => {
    switch (type) {
      case 'increase': return increaseColor;
      case 'decrease': return decreaseColor;
      case 'total': return totalColor;
    }
  };

  const valueToPercent = (value: number) => ((value - minValue) / range) * 100;

  return (
    <div className="w-full h-full min-h-[400px] p-4">
      {config.title && (
        <h3 className="text-lg font-semibold text-center mb-6">{config.title}</h3>
      )}
      
      <div className="flex items-end gap-2 h-64 relative">
        {/* Zero line */}
        {minValue < 0 && (
          <div
            className="absolute left-0 right-0 border-t-2 border-gray-400 border-dashed"
            style={{ bottom: `${valueToPercent(0)}%` }}
          />
        )}
        
        {items.map((item, index) => {
          const barBottom = valueToPercent(Math.min(item.start, item.end));
          const barHeight = Math.abs(valueToPercent(item.end) - valueToPercent(item.start));
          
          return (
            <div key={index} className="flex-1 relative">
              {/* Connector line */}
              {config.showConnectorLines !== false && index > 0 && (
                <div
                  className="absolute w-2 border-t-2 border-gray-300 border-dashed -left-2"
                  style={{ bottom: `${valueToPercent(item.start)}%` }}
                />
              )}
              
              {/* Bar */}
              <div
                className="absolute left-1 right-1 rounded-t transition-all hover:opacity-80"
                style={{
                  bottom: `${barBottom}%`,
                  height: `${Math.max(barHeight, 2)}%`,
                  backgroundColor: getColor(item.type),
                }}
                title={`${item.category}: ${item.type === 'decrease' ? '-' : ''}${item.value.toLocaleString()}`}
              >
                {barHeight > 15 && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-medium">
                    {item.type === 'decrease' ? '-' : ''}{item.value.toLocaleString()}
                  </div>
                )}
              </div>
              
              {/* Label */}
              <div className="absolute -bottom-8 left-0 right-0 text-center">
                <span className="text-xs text-gray-600 truncate block" title={item.category}>
                  {item.category}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-12">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: increaseColor }} />
          <span className="text-sm text-gray-600">Increase</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: decreaseColor }} />
          <span className="text-sm text-gray-600">Decrease</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: totalColor }} />
          <span className="text-sm text-gray-600">Total</span>
        </div>
      </div>
    </div>
  );
}

export default WaterfallRenderer;
