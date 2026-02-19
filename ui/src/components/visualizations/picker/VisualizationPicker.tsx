import React from 'react';

interface VisualizationPickerProps {
  selected: string;
  onSelect: (type: string) => void;
}

interface VizOption {
  type: string;
  label: string;
  icon: string;
  category: string;
}

const visualizationOptions: VizOption[] = [
  // Tables
  { type: 'table', label: 'Table', icon: '📊', category: 'Tables' },
  { type: 'pivotTable', label: 'Pivot Table', icon: '🔄', category: 'Tables' },
  
  // Bar Charts
  { type: 'bar', label: 'Bar Chart', icon: '📊', category: 'Bar Charts' },
  { type: 'horizontalBar', label: 'Horizontal Bar', icon: '📊', category: 'Bar Charts' },
  { type: 'barStacked', label: 'Stacked Bar', icon: '📊', category: 'Bar Charts' },
  { type: 'bar3d', label: '3D Bar', icon: '📊', category: 'Bar Charts' },
  
  // Line & Area
  { type: 'line', label: 'Line Chart', icon: '📈', category: 'Line & Area' },
  { type: 'area', label: 'Area Chart', icon: '📈', category: 'Line & Area' },
  { type: 'areaStacked', label: 'Stacked Area', icon: '📈', category: 'Line & Area' },
  
  // Circular
  { type: 'pie', label: 'Pie Chart', icon: '🥧', category: 'Circular' },
  { type: 'doughnut', label: 'Doughnut', icon: '🍩', category: 'Circular' },
  { type: 'pie3d', label: '3D Pie', icon: '🥧', category: 'Circular' },
  
  // Advanced
  { type: 'scatter', label: 'Scatter Plot', icon: '⚫', category: 'Advanced' },
  { type: 'bubble', label: 'Bubble Chart', icon: '🔵', category: 'Advanced' },
  { type: 'radar', label: 'Radar Chart', icon: '🕸️', category: 'Advanced' },
  { type: 'funnel', label: 'Funnel', icon: '🔻', category: 'Advanced' },
  { type: 'heatmap', label: 'Heatmap', icon: '🟥', category: 'Advanced' },
  { type: 'treemap', label: 'Treemap', icon: '🗺️', category: 'Advanced' },
  
  // KPI & Gauges
  { type: 'kpi', label: 'KPI Card', icon: '🎯', category: 'KPI & Gauges' },
  { type: 'gauge', label: 'Gauge', icon: '⏱️', category: 'KPI & Gauges' },
  { type: 'sparkline', label: 'Sparkline', icon: '〰️', category: 'KPI & Gauges' },
];

export const VisualizationPicker: React.FC<VisualizationPickerProps> = ({
  selected,
  onSelect,
}) => {
  const categories = [...new Set(visualizationOptions.map(v => v.category))];

  return (
    <div className="space-y-4">
      {categories.map(category => (
        <div key={category}>
          <h4 className="text-sm font-medium text-gray-500 mb-2">{category}</h4>
          <div className="grid grid-cols-3 gap-2">
            {visualizationOptions
              .filter(v => v.category === category)
              .map(viz => (
                <button
                  key={viz.type}
                  onClick={() => onSelect(viz.type)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    selected === viz.type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl mb-1">{viz.icon}</span>
                  <span className="text-xs font-medium">{viz.label}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VisualizationPicker;
