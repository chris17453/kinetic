import { describe, it, expect } from 'vitest';
import { buildEnterpriseOntologySummary, buildEnterpriseSignalSummary } from '../enterpriseSummary';

describe('enterpriseSummary', () => {
  it('derives signals and ontology summaries from source data', () => {
    const summary = buildEnterpriseSignalSummary(
      [
        { id: 'dataset-1', name: 'Sales', slug: 'sales', sourceType: 'Table', ownerType: 'User', ownerId: 'u1', visibility: 'Private', tables: [], fields: [], semanticModel: { measures: [], relationships: [], hierarchies: [] }, isCertified: false, isActive: true, createdAt: '2026-01-01T00:00:00Z', createdById: 'u1', lastRefreshedAt: '2026-06-01T00:00:00Z' },
        { id: 'dataset-2', name: 'Ops', slug: 'ops', sourceType: 'Table', ownerType: 'User', ownerId: 'u1', visibility: 'Private', tables: [], fields: [], semanticModel: { measures: [], relationships: [], hierarchies: [] }, isCertified: false, isActive: true, createdAt: '2026-01-01T00:00:00Z', createdById: 'u1' },
      ],
      [{ id: 'report-1', name: 'Board Pack', isFeatured: true } as never],
      [{ id: 'job-1', status: 'Failed' } as never]
    );

    expect(summary.failedJobs).toHaveLength(1);
    expect(summary.staleDatasets).toHaveLength(2);
    expect(summary.featuredReports).toHaveLength(1);
    expect(summary.topStaleDatasets[0].name).toBe('Ops');
  });

  it('builds a glossary from fields and measures', () => {
    const summary = buildEnterpriseOntologySummary([
      {
        id: 'dataset-1',
        name: 'Sales',
        slug: 'sales',
        sourceType: 'Table',
        ownerType: 'User',
        ownerId: 'u1',
        visibility: 'Private',
        tables: [],
        fields: [
          { id: 'field-1', tableId: 't1', name: 'region', displayName: 'Region', dataType: 'string', kind: 'Dimension', isHidden: false },
        ],
        semanticModel: {
          measures: [{ id: 'measure-1', name: 'revenue', displayName: 'Revenue', expression: 'SUM(x)' }],
          relationships: [{ id: 'rel-1', fromTableId: 't1', fromFieldId: 'f1', toTableId: 't2', toFieldId: 'f2', cardinality: 'many-to-one', isActive: true }],
          hierarchies: [{ id: 'hier-1', name: 'Geo', fieldIds: [] }],
        },
        isCertified: false,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        createdById: 'u1',
      },
    ]);

    expect(summary.semanticMeasures).toBe(1);
    expect(summary.relationships).toBe(1);
    expect(summary.hierarchies).toBe(1);
    expect(summary.termCount).toBe(2);
    expect(summary.glossaryTerms[0].label).toBe('Region');
  });
});
