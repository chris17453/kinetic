import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/common/Toast';
import api from '../../lib/api/client';
import type { Report, Category } from '../../lib/api/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list';
type FilterScope = 'all' | 'my' | 'group' | 'favorites';
type SortOption = 'newest' | 'name' | 'popular' | 'rating' | 'lastRun';

const PAGE_SIZE = 18;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Skeleton components ──────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="row g-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="col-md-6 col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="placeholder-glow mb-2">
                <span className="placeholder col-8 rounded" style={{ height: '1rem' }} />
              </div>
              <div className="placeholder-glow mb-3">
                <span className="placeholder col-12 rounded d-block mb-1" style={{ height: '0.75rem' }} />
                <span className="placeholder col-9 rounded d-block" style={{ height: '0.75rem' }} />
              </div>
              <div className="placeholder-glow mb-3 d-flex gap-1">
                <span className="placeholder rounded-pill" style={{ width: 50, height: '1.25rem' }} />
                <span className="placeholder rounded-pill" style={{ width: 60, height: '1.25rem' }} />
              </div>
              <div className="placeholder-glow border-top pt-2">
                <span className="placeholder col-6 rounded" style={{ height: '0.75rem' }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="card border-0 shadow-sm">
      <ul className="list-group list-group-flush">
        {[...Array(8)].map((_, i) => (
          <li key={i} className="list-group-item py-3">
            <div className="d-flex align-items-center gap-3">
              <span
                className="rounded bg-secondary bg-opacity-10 flex-shrink-0"
                style={{ width: 36, height: 36 }}
                aria-hidden="true"
              />
              <div className="flex-grow-1 placeholder-glow">
                <span className="placeholder col-5 rounded d-block mb-1" style={{ height: '0.9rem' }} />
                <span className="placeholder col-8 rounded d-block" style={{ height: '0.7rem' }} />
              </div>
              <div className="placeholder-glow d-flex gap-2">
                <span className="placeholder rounded" style={{ width: 48, height: '1.75rem' }} />
                <span className="placeholder rounded" style={{ width: 48, height: '1.75rem' }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Star Rating display ──────────────────────────────────────────────────────

function StarDisplay({ rating, count }: { rating?: number; count?: number }) {
  const filled = Math.round(rating ?? 0);
  return (
    <span className="d-inline-flex align-items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <i
          key={s}
          className={`fa-${s <= filled ? 'solid' : 'regular'} fa-star`}
          style={{ fontSize: '0.7rem', color: s <= filled ? '#f59e0b' : '#d1d5db' }}
        />
      ))}
      {count !== undefined && (
        <span className="text-muted" style={{ fontSize: '0.72rem' }}>({count})</span>
      )}
    </span>
  );
}

// ─── Interactive Star Rating ───────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="d-inline-flex align-items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <i
          key={s}
          role="button"
          className={`fa-${s <= (hover || value) ? 'solid' : 'regular'} fa-star`}
          style={{ fontSize: '0.8rem', color: s <= (hover || value) ? '#f59e0b' : '#d1d5db', cursor: 'pointer' }}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
        />
      ))}
    </span>
  );
}

// ─── Report Grid Card ─────────────────────────────────────────────────────────

interface ReportCardProps {
  report: Report;
  onFavorite: () => void;
  onRate: (r: number) => void;
}

function ReportCard({ report, onFavorite, onRate }: ReportCardProps) {
  return (
    <div className="card border-0 shadow-sm h-100" style={{ transition: 'box-shadow 0.15s' }}>
      <div className="card-body d-flex flex-column">
        {/* Title + favorite */}
        <div className="d-flex align-items-start justify-content-between mb-2 gap-2">
          <Link
            to={`/reports/${report.id}`}
            className="fw-semibold small text-decoration-none text-dark lh-sm flex-grow-1"
            style={{ minWidth: 0 }}
          >
            {report.name}
          </Link>
          <button
            className="btn btn-link p-0 flex-shrink-0"
            onClick={e => { e.preventDefault(); onFavorite(); }}
            title={report.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            style={{ color: report.isFavorite ? '#ef4444' : undefined }}
          >
            <i className={`fa-${report.isFavorite ? 'solid' : 'regular'} fa-heart`} />
          </button>
        </div>

        {/* Description */}
        <p
          className="text-muted mb-2 flex-grow-1"
          style={{
            fontSize: '0.8rem',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}
        >
          {report.description || 'No description provided.'}
        </p>

        {/* Category + Tags */}
        <div className="d-flex flex-wrap gap-1 mb-2">
          {report.category && (
            <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: '0.68rem' }}>
              {report.category.icon} {report.category.name}
            </span>
          )}
          {report.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="badge bg-light text-secondary border" style={{ fontSize: '0.68rem' }}>
              #{tag}
            </span>
          ))}
          {(report.tags?.length ?? 0) > 3 && (
            <span className="badge bg-light text-muted border" style={{ fontSize: '0.68rem' }}>
              +{report.tags!.length - 3}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="d-flex align-items-center justify-content-between border-top pt-2 gap-2">
          <StarRating value={Math.round(report.averageRating ?? 0)} onChange={onRate} />
          <div className="text-muted d-flex align-items-center gap-2" style={{ fontSize: '0.72rem' }}>
            <span>
              <i className="fa-solid fa-play me-1" style={{ fontSize: '0.6rem' }} />
              {report.executionCount ?? 0}
            </span>
            {report.lastExecutedAt && (
              <span>
                <i className="fa-solid fa-clock me-1" style={{ fontSize: '0.6rem' }} />
                {formatDate(report.lastExecutedAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Report List Item ─────────────────────────────────────────────────────────

interface ReportListItemProps {
  report: Report;
  onFavorite: () => void;
}

function ReportListItem({ report, onFavorite }: ReportListItemProps) {
  return (
    <li className="list-group-item list-group-item-action py-3">
      <div className="d-flex align-items-center gap-3">
        {/* Icon */}
        <div
          className="d-flex align-items-center justify-content-center rounded-2 bg-primary bg-opacity-10 text-primary flex-shrink-0"
          style={{ width: 36, height: 36 }}
        >
          <i className="fa-solid fa-chart-bar" style={{ fontSize: '0.85rem' }} />
        </div>

        {/* Name + meta */}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Link
              to={`/reports/${report.id}`}
              className="fw-medium small text-decoration-none text-dark text-truncate"
            >
              {report.name}
            </Link>
            {report.category && (
              <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: '0.65rem' }}>
                {report.category.name}
              </span>
            )}
          </div>
          <div className="text-muted small text-truncate d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.75rem' }}>
            {report.connection?.name && <span>{report.connection.name}</span>}
            {report.tags?.slice(0, 2).map(t => (
              <span key={t} className="badge bg-light text-secondary border" style={{ fontSize: '0.65rem' }}>
                #{t}
              </span>
            ))}
            <StarDisplay rating={report.averageRating} count={report.ratingCount} />
          </div>
        </div>

        {/* Right side actions */}
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <span className="text-muted d-none d-sm-block" style={{ fontSize: '0.75rem' }}>
            <i className="fa-solid fa-play me-1" style={{ fontSize: '0.65rem' }} />
            {report.executionCount ?? 0} runs
          </span>
          {report.lastExecutedAt && (
            <span className="text-muted d-none d-md-block" style={{ fontSize: '0.75rem' }}>
              {formatDate(report.lastExecutedAt)}
            </span>
          )}
          <button
            className="btn btn-link p-0"
            onClick={e => { e.preventDefault(); onFavorite(); }}
            title={report.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            style={{ color: report.isFavorite ? '#ef4444' : '#9ca3af' }}
          >
            <i className={`fa-${report.isFavorite ? 'solid' : 'regular'} fa-heart`} />
          </button>
          <Link to={`/reports/${report.id}/edit`} className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-pen" />
          </Link>
        </div>
      </div>
    </li>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <nav aria-label="Report pages" className="d-flex justify-content-center mt-4">
      <ul className="pagination pagination-sm mb-0">
        <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onPage(page - 1)}>
            <i className="fa-solid fa-chevron-left" style={{ fontSize: '0.7rem' }} />
          </button>
        </li>
        {pages.map((p, i) =>
          p === '…' ? (
            <li key={`ellipsis-${i}`} className="page-item disabled">
              <span className="page-link">…</span>
            </li>
          ) : (
            <li key={p} className={`page-item ${page === p ? 'active' : ''}`}>
              <button className="page-link" onClick={() => onPage(p as number)}>{p}</button>
            </li>
          )
        )}
        <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onPage(page + 1)}>
            <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.7rem' }} />
          </button>
        </li>
      </ul>
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CatalogPage() {
  useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── State derived from URL params + local ──────────────────────────────────

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [tagFilter, setTagFilter] = useState(searchParams.get('tag') ?? '');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterScope, setFilterScope] = useState<FilterScope>((searchParams.get('scope') as FilterScope) ?? 'all');
  const [sortBy, setSortBy] = useState<SortOption>((searchParams.get('sort') as SortOption) ?? 'newest');
  const [page, setPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Sync filters → URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (categoryFilter) params.category = categoryFilter;
    if (tagFilter) params.tag = tagFilter;
    if (filterScope !== 'all') params.scope = filterScope;
    if (sortBy !== 'newest') params.sort = sortBy;
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, categoryFilter, tagFilter, filterScope, sortBy, setSearchParams]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['reports', 'catalog', { search: debouncedSearch, categoryFilter, tagFilter, filterScope, sortBy, page }],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        pageSize: PAGE_SIZE,
        page,
        orderBy: sortBy,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryFilter) params.categoryId = categoryFilter;
      if (filterScope !== 'all') params.scope = filterScope;
      if (tagFilter) params.tag = tagFilter;
      const res = await api.get<{ items: Report[]; total: number; totalPages: number }>('/reports', { params });
      return res.data;
    },
    placeholderData: prev => prev,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<Category[]>('/reports/categories');
      return res.data;
    },
  });

  const { data: allTags } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await api.get<string[]>('/reports/tags');
      return res.data;
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const favoriteMutation = useMutation({
    mutationFn: ({ reportId, isFavorite }: { reportId: string; isFavorite: boolean }) =>
      isFavorite
        ? api.delete(`/reports/${reportId}/favorite`)
        : api.post(`/reports/${reportId}/favorite`),
    onSuccess: (_data, { isFavorite, reportId }) => {
      const report = reportsData?.items.find(r => r.id === reportId);
      if (isFavorite) {
        toast.info('Removed from favorites', report?.name);
      } else {
        toast.success('Added to favorites', report?.name);
      }
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: () => toast.error('Failed to update favorites'),
  });

  const rateMutation = useMutation({
    mutationFn: ({ reportId, rating }: { reportId: string; rating: number }) =>
      api.post(`/reports/${reportId}/rate`, { rating }),
    onSuccess: () => {
      toast.success('Rating saved');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: () => toast.error('Failed to save rating'),
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const reports = reportsData?.items ?? [];
  const total = reportsData?.total ?? 0;
  const totalPages = reportsData?.totalPages ?? 1;
  const hasActiveFilters = !!(debouncedSearch || categoryFilter || tagFilter || filterScope !== 'all');

  const activeCategoryName = categories?.find(c => c.id === categoryFilter)?.name;

  function clearAllFilters() {
    setSearch('');
    setDebouncedSearch('');
    setCategoryFilter('');
    setTagFilter('');
    setFilterScope('all');
    setPage(1);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page header ── */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1">Report Catalog</h4>
          <p className="text-muted small mb-0">
            {isLoading ? (
              <span className="placeholder-glow"><span className="placeholder col-3 rounded" /></span>
            ) : (
              <>{total.toLocaleString()} report{total !== 1 ? 's' : ''} available</>
            )}
          </p>
        </div>
        <Link to="/reports/new" className="btn btn-primary">
          <i className="fa-solid fa-plus me-2" />
          New Report
        </Link>
      </div>

      <div className="row g-4">
        {/* ── Left Sidebar ── */}
        <div className="col-lg-3 d-none d-lg-block">
          {/* Category tree */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white py-3 border-bottom">
              <h6 className="fw-bold mb-0">
                <i className="fa-solid fa-layer-group me-2 text-muted" />
                Categories
              </h6>
            </div>
            <div className="list-group list-group-flush">
              <button
                className={`list-group-item list-group-item-action d-flex align-items-center justify-content-between small py-2 ${!categoryFilter ? 'active' : ''}`}
                onClick={() => { setCategoryFilter(''); setPage(1); }}
              >
                <span>
                  <i className="fa-solid fa-border-all me-2" />
                  All Reports
                </span>
                <span className={`badge rounded-pill ${!categoryFilter ? 'bg-white text-primary' : 'bg-secondary'}`}>
                  {total}
                </span>
              </button>

              {categories?.map(cat => {
                const count = reportsData?.items.filter(r => r.categoryId === cat.id).length ?? 0;
                const active = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={`list-group-item list-group-item-action d-flex align-items-center justify-content-between small py-2 ${active ? 'active' : ''}`}
                    onClick={() => { setCategoryFilter(active ? '' : cat.id); setPage(1); }}
                  >
                    <span className="text-truncate">
                      {cat.icon && <span className="me-2">{cat.icon}</span>}
                      {cat.name}
                    </span>
                    <span className={`badge rounded-pill ${active ? 'bg-white text-primary' : 'bg-secondary'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tag cloud */}
          {allTags && allTags.length > 0 && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-3 border-bottom">
                <h6 className="fw-bold mb-0">
                  <i className="fa-solid fa-tags me-2 text-muted" />
                  Tags
                </h6>
              </div>
              <div className="card-body d-flex flex-wrap gap-1 pb-3 pt-3">
                {allTags.map(tag => {
                  const active = tagFilter === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => { setTagFilter(active ? '' : tag); setPage(1); }}
                      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
                      style={{ fontSize: '0.72rem' }}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        <div className="col-lg-9">
          {/* Search + controls bar */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-2 px-3">
              <div className="row g-2 align-items-center">
                {/* Search */}
                <div className="col-12 col-sm-5 col-md-4">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0">
                      <i className="fa-solid fa-magnifying-glass text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="Search reports…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                      <button className="btn btn-outline-secondary" onClick={() => setSearch('')} title="Clear search">
                        <i className="fa-solid fa-xmark" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Scope filter */}
                <div className="col-auto">
                  <div className="btn-group btn-group-sm" role="group" aria-label="Report scope">
                    {(['all', 'my', 'group', 'favorites'] as FilterScope[]).map(scope => {
                      const labels: Record<FilterScope, React.ReactNode> = {
                        all: 'All',
                        my: 'Mine',
                        group: 'Group',
                        favorites: <><i className="fa-solid fa-heart" /><span className="d-none d-md-inline ms-1">Starred</span></>,
                      };
                      return (
                        <button
                          key={scope}
                          onClick={() => { setFilterScope(scope); setPage(1); }}
                          className={`btn ${filterScope === scope ? 'btn-primary' : 'btn-outline-secondary'}`}
                        >
                          {labels[scope]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sort */}
                <div className="col-auto">
                  <select
                    className="form-select form-select-sm"
                    value={sortBy}
                    onChange={e => { setSortBy(e.target.value as SortOption); setPage(1); }}
                  >
                    <option value="newest">Newest</option>
                    <option value="name">Name A–Z</option>
                    <option value="popular">Most Popular</option>
                    <option value="rating">Highest Rated</option>
                    <option value="lastRun">Last Run</option>
                  </select>
                </div>

                {/* Mobile filter toggle */}
                <div className="col-auto d-lg-none">
                  <button
                    className={`btn btn-sm ${showMobileFilters ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setShowMobileFilters(f => !f)}
                    title="Filters"
                  >
                    <i className="fa-solid fa-sliders me-1" />
                    Filter
                  </button>
                </div>

                {/* View mode toggle */}
                <div className="col-auto ms-auto">
                  <div className="btn-group btn-group-sm" role="group" aria-label="View mode">
                    <button
                      className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setViewMode('grid')}
                      title="Grid view"
                    >
                      <i className="fa-solid fa-grip" />
                    </button>
                    <button
                      className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setViewMode('list')}
                      title="List view"
                    >
                      <i className="fa-solid fa-list" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile filters panel */}
              {showMobileFilters && (
                <div className="d-lg-none mt-3 pt-3 border-top">
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-muted mb-1">Category</label>
                      <select
                        className="form-select form-select-sm"
                        value={categoryFilter}
                        onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
                      >
                        <option value="">All Categories</option>
                        {categories?.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-muted mb-1">Tag</label>
                      <select
                        className="form-select form-select-sm"
                        value={tagFilter}
                        onChange={e => { setTagFilter(e.target.value); setPage(1); }}
                      >
                        <option value="">All Tags</option>
                        {allTags?.map(tag => (
                          <option key={tag} value={tag}>#{tag}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Active filter chips */}
              {hasActiveFilters && (
                <div className="d-flex align-items-center gap-1 mt-2 flex-wrap">
                  <span className="text-muted small">
                    <i className="fa-solid fa-filter me-1" style={{ fontSize: '0.65rem' }} />
                    Filters:
                  </span>
                  {debouncedSearch && (
                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 d-inline-flex align-items-center gap-1">
                      <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '0.6rem' }} />
                      {debouncedSearch}
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '0.45rem' }}
                        onClick={() => setSearch('')}
                        aria-label="Remove search filter"
                      />
                    </span>
                  )}
                  {categoryFilter && activeCategoryName && (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 d-inline-flex align-items-center gap-1">
                      <i className="fa-solid fa-layer-group" style={{ fontSize: '0.6rem' }} />
                      {activeCategoryName}
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '0.45rem' }}
                        onClick={() => setCategoryFilter('')}
                        aria-label="Remove category filter"
                      />
                    </span>
                  )}
                  {tagFilter && (
                    <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 d-inline-flex align-items-center gap-1">
                      <i className="fa-solid fa-tag" style={{ fontSize: '0.6rem' }} />
                      #{tagFilter}
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '0.45rem' }}
                        onClick={() => setTagFilter('')}
                        aria-label="Remove tag filter"
                      />
                    </span>
                  )}
                  {filterScope !== 'all' && (
                    <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 d-inline-flex align-items-center gap-1">
                      <i className="fa-solid fa-user" style={{ fontSize: '0.6rem' }} />
                      {filterScope === 'my' ? 'Mine' : filterScope === 'group' ? 'Group' : 'Starred'}
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '0.45rem' }}
                        onClick={() => setFilterScope('all')}
                        aria-label="Remove scope filter"
                      />
                    </span>
                  )}
                  <button
                    className="btn btn-link btn-sm text-muted p-0 ms-1"
                    style={{ fontSize: '0.75rem' }}
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Report results ── */}
          {isLoading ? (
            viewMode === 'grid' ? <GridSkeleton /> : <ListSkeleton />
          ) : reports.length === 0 ? (
            /* Empty state */
            <div className="card border-0 shadow-sm">
              <div className="card-body d-flex flex-column align-items-center justify-content-center py-5 text-center">
                <i
                  className="fa-solid fa-magnifying-glass fa-3x text-muted mb-3"
                  style={{ opacity: 0.25 }}
                />
                <h5 className="fw-bold mb-2">No reports found</h5>
                <p className="text-muted mb-4" style={{ maxWidth: 360 }}>
                  {hasActiveFilters
                    ? 'No reports match your current filters. Try adjusting your search or removing a filter.'
                    : 'There are no reports yet. Create the first one to get started.'}
                </p>
                <div className="d-flex gap-2 flex-wrap justify-content-center">
                  {hasActiveFilters && (
                    <button className="btn btn-outline-secondary" onClick={clearAllFilters}>
                      <i className="fa-solid fa-filter-slash me-2" />
                      Clear filters
                    </button>
                  )}
                  <Link to="/reports/new" className="btn btn-primary">
                    <i className="fa-solid fa-plus me-2" />
                    Create report
                  </Link>
                </div>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid view */
            <div className="row g-3">
              {reports.map(report => (
                <div key={report.id} className="col-md-6 col-xl-4">
                  <ReportCard
                    report={report}
                    onFavorite={() =>
                      favoriteMutation.mutate({ reportId: report.id, isFavorite: !!report.isFavorite })
                    }
                    onRate={rating => rateMutation.mutate({ reportId: report.id, rating })}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="card border-0 shadow-sm">
              <ul className="list-group list-group-flush">
                {reports.map(report => (
                  <ReportListItem
                    key={report.id}
                    report={report}
                    onFavorite={() =>
                      favoriteMutation.mutate({ reportId: report.id, isFavorite: !!report.isFavorite })
                    }
                  />
                ))}
              </ul>
            </div>
          )}

          {/* ── Pagination ── */}
          {!isLoading && reports.length > 0 && (
            <Pagination page={page} totalPages={totalPages} onPage={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          )}
        </div>
      </div>
    </div>
  );
}
