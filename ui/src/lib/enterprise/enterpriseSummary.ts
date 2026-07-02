import type { Dataset, RefreshJob, Report } from '../api/types';

export interface EnterpriseSignalSummary {
  failedJobs: RefreshJob[];
  staleDatasets: Dataset[];
  featuredReports: Report[];
  topStaleDatasets: Dataset[];
}

export interface EnterpriseOntologyTerm {
  label: string;
  datasets: string[];
  type: 'Field' | 'Measure';
}

export interface EnterpriseOntologySummary {
  semanticMeasures: number;
  relationships: number;
  hierarchies: number;
  glossaryTerms: EnterpriseOntologyTerm[];
  termCount: number;
}

export interface EnterpriseSummary {
  signals: EnterpriseSignalSummary;
  ontology: EnterpriseOntologySummary;
}

const STALE_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 7;

export function buildEnterpriseSignalSummary(
  datasets: Dataset[] = [],
  reports: Report[] = [],
  jobs: RefreshJob[] = []
): EnterpriseSignalSummary {
  const failedJobs = jobs.filter(job => job.status === 'Failed');
  const staleDatasets = datasets.filter(dataset => isStaleDataset(dataset));
  const featuredReports = reports.filter(report => report.isFeatured);
  const topStaleDatasets = [...staleDatasets]
    .sort((a, b) => datasetRefreshTime(a) - datasetRefreshTime(b))
    .slice(0, 3);

  return { failedJobs, staleDatasets, featuredReports, topStaleDatasets };
}

export function buildEnterpriseOntologySummary(datasets: Dataset[] = []): EnterpriseOntologySummary {
  const semanticMeasures = datasets.reduce((sum, dataset) => sum + (dataset.semanticModel?.measures?.length ?? 0), 0);
  const relationships = datasets.reduce((sum, dataset) => sum + (dataset.semanticModel?.relationships?.length ?? 0), 0);
  const hierarchies = datasets.reduce((sum, dataset) => sum + (dataset.semanticModel?.hierarchies?.length ?? 0), 0);
  const glossaryTerms = new Map<string, EnterpriseOntologyTerm>();

  datasets.forEach(dataset => {
    (dataset.fields ?? []).forEach(field => {
      const label = field.displayName || field.name;
      const existing = glossaryTerms.get(label);
      glossaryTerms.set(label, {
        label,
        type: 'Field',
        datasets: mergeDatasetNames(existing?.datasets, dataset.name),
      });
    });

    dataset.semanticModel?.measures?.forEach(measure => {
      const label = measure.displayName || measure.name;
      const existing = glossaryTerms.get(label);
      glossaryTerms.set(label, {
        label,
        type: 'Measure',
        datasets: mergeDatasetNames(existing?.datasets, dataset.name),
      });
    });
  });

  const glossary = [...glossaryTerms.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 8);

  return {
    semanticMeasures,
    relationships,
    hierarchies,
    glossaryTerms: glossary,
    termCount: glossaryTerms.size,
  };
}

export function buildEnterpriseSummary(
  datasets: Dataset[] = [],
  reports: Report[] = [],
  jobs: RefreshJob[] = []
): EnterpriseSummary {
  return {
    signals: buildEnterpriseSignalSummary(datasets, reports, jobs),
    ontology: buildEnterpriseOntologySummary(datasets),
  };
}

function isStaleDataset(dataset: Dataset): boolean {
  if (!dataset.lastRefreshedAt) return true;
  return Date.now() - new Date(dataset.lastRefreshedAt).getTime() > STALE_THRESHOLD_MS;
}

function datasetRefreshTime(dataset: Dataset): number {
  return dataset.lastRefreshedAt ? new Date(dataset.lastRefreshedAt).getTime() : 0;
}

function mergeDatasetNames(existing: string[] | undefined, next: string): string[] {
  return [...new Set([...(existing ?? []), next])];
}
