import { describe, it, expect } from 'vitest';
import { defaultDashboardWidgets } from '../dashboardTemplates';

describe('defaultDashboardWidgets', () => {
  it('creates an enterprise-first template for enterprise dashboard names', () => {
    const widgets = defaultDashboardWidgets('Enterprise Leadership');

    expect(widgets).toHaveLength(5);
    expect(widgets[0].type).toBe('EnterpriseInsights');
    expect(widgets[1].type).toBe('EnterpriseSignals');
    expect(widgets[2].type).toBe('OntologyGlossary');
    expect(widgets[3].type).toBe('Kpi');
    expect(widgets[4].type).toBe('Text');
  });

  it('creates a simple starter template for general dashboards', () => {
    const widgets = defaultDashboardWidgets('Marketing');

    expect(widgets).toHaveLength(1);
    expect(widgets[0].type).toBe('Text');
  });
});
