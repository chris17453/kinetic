import type { DashboardWidget } from '../api/types';

export function defaultDashboardWidgets(name: string): DashboardWidget[] {
  const enterpriseTemplate = /enterprise|leadership|executive|board/i.test(name);

  if (enterpriseTemplate) {
    return [
      {
        id: crypto.randomUUID(),
        type: 'EnterpriseInsights',
        title: 'Enterprise Insights',
        x: 0,
        y: 0,
        width: 12,
        height: 3,
        config: {},
      },
      {
        id: crypto.randomUUID(),
        type: 'EnterpriseSignals',
        title: 'Signals + Ontology',
        x: 0,
        y: 3,
        width: 6,
        height: 3,
        config: {},
      },
      {
        id: crypto.randomUUID(),
        type: 'OntologyGlossary',
        title: 'Ontology Glossary',
        x: 6,
        y: 3,
        width: 6,
        height: 3,
        config: {},
      },
      {
        id: crypto.randomUUID(),
        type: 'Kpi',
        title: 'Executive KPI',
        x: 0,
        y: 6,
        width: 4,
        height: 2,
        config: { value: '94.2%' },
      },
      {
        id: crypto.randomUUID(),
        type: 'Text',
        title: name || 'Enterprise overview',
        x: 4,
        y: 6,
        width: 8,
        height: 2,
        config: { markdown: 'Leadership layout with signals, ontology, and KPI context ready for curated report visuals.' },
      },
    ];
  }

  return [
    {
      id: crypto.randomUUID(),
      type: 'Text',
      title: name || 'Dashboard notes',
      x: 0,
      y: 0,
      width: 8,
      height: 2,
      config: { markdown: 'Add pinned report visuals and KPI cards here.' },
    },
  ];
}
