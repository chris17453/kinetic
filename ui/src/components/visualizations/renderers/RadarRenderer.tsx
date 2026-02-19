import { useMemo } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { QueryResult } from '../../../lib/types';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface RadarRendererProps {
  data: QueryResult;
  config: {
    labelColumn: string;
    valueColumns: string[];
    title?: string;
    showLegend?: boolean;
    fill?: boolean;
    fillOpacity?: number;
  };
}

const COLORS = [
  { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 1)' },
  { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 1)' },
  { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 1)' },
  { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 1)' },
  { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgba(139, 92, 246, 1)' },
];

export function RadarRenderer({ data, config }: RadarRendererProps) {
  const chartData = useMemo(() => {
    const labels = data.rows.map(row => String(row[config.labelColumn] ?? ''));
    
    const datasets = config.valueColumns.map((col, index) => {
      const colorIndex = index % COLORS.length;
      const values = data.rows.map(row => {
        const val = row[col];
        return typeof val === 'number' ? val : parseFloat(val as string) || 0;
      });

      return {
        label: col,
        data: values,
        backgroundColor: COLORS[colorIndex].bg.replace('0.2', String(config.fillOpacity ?? 0.2)),
        borderColor: COLORS[colorIndex].border,
        borderWidth: 2,
        pointBackgroundColor: COLORS[colorIndex].border,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: COLORS[colorIndex].border,
        fill: config.fill !== false,
      };
    });

    return { labels, datasets };
  }, [data, config]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        display: config.showLegend !== false,
      },
      title: {
        display: !!config.title,
        text: config.title || '',
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        ticks: {
          stepSize: 20,
        },
      },
    },
  }), [config]);

  return (
    <div className="w-full h-full min-h-[400px] p-4">
      <Radar data={chartData} options={options} />
    </div>
  );
}

export default RadarRenderer;
