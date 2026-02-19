import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import type { QueryResult, ChartConfig } from '../../../lib/types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartRendererProps {
  data: QueryResult;
  config: ChartConfig;
}

const COLORS = [
  'rgba(59, 130, 246, 0.8)',   // Blue
  'rgba(16, 185, 129, 0.8)',   // Green
  'rgba(245, 158, 11, 0.8)',   // Amber
  'rgba(239, 68, 68, 0.8)',    // Red
  'rgba(139, 92, 246, 0.8)',   // Purple
  'rgba(236, 72, 153, 0.8)',   // Pink
  'rgba(6, 182, 212, 0.8)',    // Cyan
  'rgba(249, 115, 22, 0.8)',   // Orange
];

const BORDER_COLORS = COLORS.map(c => c.replace('0.8', '1'));

export const ChartRenderer: React.FC<ChartRendererProps> = ({ data, config }) => {
  const chartData = useMemo(() => {
    const { labelColumn, valueColumns } = config;
    
    // Extract labels from data
    const labels = data.rows.map(row => String(row[labelColumn] ?? ''));
    
    // Build datasets
    const datasets = valueColumns.map((col, index) => {
      const values = data.rows.map(row => {
        const val = row[col];
        return typeof val === 'number' ? val : parseFloat(val as string) || 0;
      });

      return {
        label: col,
        data: values,
        backgroundColor: config.chartType === 'pie' || config.chartType === 'doughnut'
          ? COLORS
          : COLORS[index % COLORS.length],
        borderColor: config.chartType === 'line' || config.chartType === 'scatter'
          ? BORDER_COLORS[index % BORDER_COLORS.length]
          : BORDER_COLORS[index % BORDER_COLORS.length],
        borderWidth: config.chartType === 'line' ? 2 : 1,
        fill: config.chartType === 'area',
        tension: 0.3,
      };
    });

    return { labels, datasets };
  }, [data, config]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: config.legendPosition || 'top' as const,
        display: config.showLegend !== false,
      },
      title: {
        display: !!config.title,
        text: config.title || '',
      },
      tooltip: {
        enabled: true,
      },
    },
    scales: config.chartType !== 'pie' && config.chartType !== 'doughnut' ? {
      x: {
        display: true,
        title: {
          display: !!config.xAxisLabel,
          text: config.xAxisLabel || '',
        },
        grid: {
          display: config.showGrid !== false,
        },
      },
      y: {
        display: true,
        title: {
          display: !!config.yAxisLabel,
          text: config.yAxisLabel || '',
        },
        grid: {
          display: config.showGrid !== false,
        },
        beginAtZero: config.beginAtZero !== false,
      },
    } : undefined,
  }), [config]);

  const renderChart = () => {
    switch (config.chartType) {
      case 'bar':
        return <Bar data={chartData} options={options} />;
      case 'horizontalBar':
        return (
          <Bar
            data={chartData}
            options={{
              ...options,
              indexAxis: 'y' as const,
            }}
          />
        );
      case 'line':
        return <Line data={chartData} options={options} />;
      case 'area':
        return (
          <Line
            data={{
              ...chartData,
              datasets: chartData.datasets.map(ds => ({ ...ds, fill: true })),
            }}
            options={options}
          />
        );
      case 'pie':
        return <Pie data={chartData} options={options} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={options} />;
      case 'scatter':
        return <Scatter data={chartData} options={options} />;
      default:
        return <Bar data={chartData} options={options} />;
    }
  };

  return (
    <div className="w-full h-full min-h-[300px] p-4">
      {renderChart()}
    </div>
  );
};

export default ChartRenderer;
