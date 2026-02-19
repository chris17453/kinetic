import { useMemo } from 'react';

interface TreemapItem {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface TreemapRendererProps {
  data: { rows: Record<string, unknown>[] };
  config: {
    labelColumn: string;
    valueColumn: string;
    title?: string;
    colorScheme?: 'blue' | 'green' | 'rainbow';
    showValues?: boolean;
  };
}

const COLOR_SCHEMES = {
  blue: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
  green: ['#065f46', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
  rainbow: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'],
};

function squarify(
  items: TreemapItem[],
  container: { x: number; y: number; width: number; height: number }
): Array<TreemapItem & { x: number; y: number; width: number; height: number }> {
  const results: Array<TreemapItem & { x: number; y: number; width: number; height: number }> = [];
  
  if (items.length === 0) return results;
  
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const sortedItems = [...items].sort((a, b) => b.value - a.value);
  
  let { x, y, width, height } = container;
  let remainingItems = [...sortedItems];
  
  while (remainingItems.length > 0) {
    const isVertical = width >= height;
    const shortSide = isVertical ? height : width;
    
    let row: TreemapItem[] = [];
    let rowValue = 0;
    
    for (const item of remainingItems) {
      const testRow = [...row, item];
      const testRowValue = rowValue + item.value;
      row = testRow;
      rowValue = testRowValue;
      
      if (testRow.length >= 3) break;
    }
    
    // Calculate positions for row
    const rowRatio = rowValue / totalValue;
    const rowLength = (isVertical ? width : height) * rowRatio;
    
    let offset = 0;
    for (const item of row) {
      const itemRatio = item.value / rowValue;
      const itemLength = shortSide * itemRatio;
      
      results.push({
        ...item,
        x: isVertical ? x : x + offset,
        y: isVertical ? y + offset : y,
        width: isVertical ? rowLength : itemLength,
        height: isVertical ? itemLength : rowLength,
      });
      
      offset += itemLength;
    }
    
    // Update container for next row
    if (isVertical) {
      x += rowLength;
      width -= rowLength;
    } else {
      y += rowLength;
      height -= rowLength;
    }
    
    remainingItems = remainingItems.filter(item => !row.includes(item));
  }
  
  return results;
}

export function TreemapRenderer({ data, config }: TreemapRendererProps) {
  const items = useMemo(() => {
    const colors = COLOR_SCHEMES[config.colorScheme || 'blue'];
    const rows = data.rows.map((row) => ({
      name: String(row[config.labelColumn] ?? ''),
      value: typeof row[config.valueColumn] === 'number'
        ? row[config.valueColumn] as number
        : parseFloat(row[config.valueColumn] as string) || 0,
    }));
    
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    
    return rows.map((row, index) => ({
      ...row,
      percentage: (row.value / total) * 100,
      color: colors[index % colors.length],
    }));
  }, [data, config]);

  const positioned = useMemo(() => {
    return squarify(items, { x: 0, y: 0, width: 100, height: 100 });
  }, [items]);

  return (
    <div className="w-full h-full min-h-[400px] p-4">
      {config.title && (
        <h3 className="text-lg font-semibold text-center mb-4">{config.title}</h3>
      )}
      
      <div className="relative w-full" style={{ paddingBottom: '60%' }}>
        <div className="absolute inset-0">
          {positioned.map((item, index) => {
            const textColor = item.percentage > 5 ? 'white' : 'transparent';
            
            return (
              <div
                key={`${item.name}-${index}`}
                className="absolute p-2 overflow-hidden border border-white/20 transition-opacity hover:opacity-90"
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  height: `${item.height}%`,
                  backgroundColor: item.color,
                }}
                title={`${item.name}: ${item.value.toLocaleString()} (${item.percentage.toFixed(1)}%)`}
              >
                <div className="text-sm font-medium truncate" style={{ color: textColor }}>
                  {item.name}
                </div>
                {config.showValues !== false && item.percentage > 10 && (
                  <div className="text-xs" style={{ color: textColor }}>
                    {item.value.toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TreemapRenderer;
