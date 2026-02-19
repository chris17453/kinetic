import { useMemo } from 'react';

interface HeatmapCell {
  x: string;
  y: string;
  value: number;
  normalizedValue: number;
}

interface HeatmapRendererProps {
  data: { rows: Record<string, unknown>[] };
  config: {
    xColumn: string;
    yColumn: string;
    valueColumn: string;
    title?: string;
    colorScaleLow?: string;
    colorScaleHigh?: string;
    showValues?: boolean;
    minValue?: number;
    maxValue?: number;
  };
}

function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  return `rgb(${r}, ${g}, ${b})`;
}

export function HeatmapRenderer({ data, config }: HeatmapRendererProps) {
  const { cells, xLabels, yLabels, minVal, maxVal } = useMemo(() => {
    const xSet = new Set<string>();
    const ySet = new Set<string>();
    const cellMap = new Map<string, number>();
    
    data.rows.forEach(row => {
      const x = String(row[config.xColumn] ?? '');
      const y = String(row[config.yColumn] ?? '');
      const value = typeof row[config.valueColumn] === 'number'
        ? row[config.valueColumn] as number
        : parseFloat(row[config.valueColumn] as string) || 0;
      
      xSet.add(x);
      ySet.add(y);
      cellMap.set(`${x}:${y}`, value);
    });
    
    const xLabels = Array.from(xSet);
    const yLabels = Array.from(ySet);
    
    const values = Array.from(cellMap.values());
    const minVal = config.minValue ?? Math.min(...values);
    const maxVal = config.maxValue ?? Math.max(...values);
    const range = maxVal - minVal || 1;
    
    const cells: HeatmapCell[] = [];
    yLabels.forEach(y => {
      xLabels.forEach(x => {
        const value = cellMap.get(`${x}:${y}`) ?? 0;
        cells.push({
          x,
          y,
          value,
          normalizedValue: (value - minVal) / range,
        });
      });
    });
    
    return { cells, xLabels, yLabels, minVal, maxVal };
  }, [data, config]);

  const lowColor = config.colorScaleLow || '#f7fbff';
  const highColor = config.colorScaleHigh || '#08306b';

  return (
    <div className="w-full h-full min-h-[400px] p-4 overflow-auto">
      {config.title && (
        <h3 className="text-lg font-semibold text-center mb-4">{config.title}</h3>
      )}
      
      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col mr-2 text-right">
          <div className="h-8" /> {/* Empty corner */}
          {yLabels.map(label => (
            <div
              key={label}
              className="h-10 flex items-center justify-end text-sm text-gray-600 pr-2"
            >
              {label}
            </div>
          ))}
        </div>
        
        {/* Grid */}
        <div className="flex-1">
          {/* X-axis labels */}
          <div className="flex h-8">
            {xLabels.map(label => (
              <div
                key={label}
                className="flex-1 text-sm text-gray-600 text-center truncate px-1"
                title={label}
              >
                {label}
              </div>
            ))}
          </div>
          
          {/* Cells */}
          {yLabels.map(y => (
            <div key={y} className="flex">
              {xLabels.map(x => {
                const cell = cells.find(c => c.x === x && c.y === y);
                const bgColor = cell
                  ? interpolateColor(lowColor, highColor, cell.normalizedValue)
                  : lowColor;
                const textColor = cell && cell.normalizedValue > 0.5 ? 'white' : 'black';
                
                return (
                  <div
                    key={`${x}:${y}`}
                    className="flex-1 h-10 flex items-center justify-center border border-white/30 text-xs font-medium transition-all hover:opacity-80"
                    style={{ backgroundColor: bgColor, color: textColor }}
                    title={`${x}, ${y}: ${cell?.value ?? 0}`}
                  >
                    {config.showValues !== false && cell?.value.toLocaleString()}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-sm text-gray-500">{minVal}</span>
        <div
          className="w-32 h-4 rounded"
          style={{
            background: `linear-gradient(to right, ${lowColor}, ${highColor})`,
          }}
        />
        <span className="text-sm text-gray-500">{maxVal}</span>
      </div>
    </div>
  );
}

export default HeatmapRenderer;
