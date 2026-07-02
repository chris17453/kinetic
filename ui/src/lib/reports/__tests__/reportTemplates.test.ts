import { describe, it, expect } from 'vitest';
import { defaultReportVisualizations } from '../reportTemplates';

describe('reportTemplates', () => {
  it('creates an executive starter layout', () => {
    const visualizations = defaultReportVisualizations('Executive');
    expect(visualizations).toHaveLength(5);
    expect(visualizations[0].type).toBe('KpiCard');
    expect(visualizations[1].type).toBe('Gauge');
    expect(visualizations[2].type).toBe('Line');
    expect(visualizations[3].type).toBe('Radar');
    expect(visualizations[4].type).toBe('Doughnut');
  });

  it('creates an operations starter layout', () => {
    const visualizations = defaultReportVisualizations('Operations');
    expect(visualizations).toHaveLength(5);
    expect(visualizations[0].type).toBe('Table');
    expect(visualizations[1].type).toBe('BarHorizontal');
    expect(visualizations[2].type).toBe('Funnel');
    expect(visualizations[3].type).toBe('Waterfall');
    expect(visualizations[4].type).toBe('Scatter');
  });
});
