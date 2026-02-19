import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api/client';
import type { Report, Category } from '../../lib/api/types';

type ViewMode = 'grid' | 'list';
type FilterScope = 'all' | 'my' | 'group' | 'favorites';

export function CatalogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');
  const [tagFilter, setTagFilter] = useState<string>('');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', { search, category: categoryFilter, scope: filterScope, tag: tagFilter }],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '50' };
      if (search) params.search = search;
      if (categoryFilter) params.categoryId = categoryFilter;
      if (filterScope !== 'all') params.scope = filterScope;
      if (tagFilter) params.tag = tagFilter;
      const res = await api.get<{ items: Report[] }>('/reports', { params });
      return res.data.items;
    },
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

  const favoriteMutation = useMutation({
    mutationFn: (reportId: string) => api.post(`/reports/${reportId}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: ({ reportId, rating }: { reportId: string; rating: number }) =>
      api.post(`/reports/${reportId}/rate`, { rating }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Report Catalog</h1>
        <Link to="/reports/new" className="btn-primary">
          + New Report
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search reports..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {/* Scope Filters */}
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            {(['all', 'my', 'group', 'favorites'] as FilterScope[]).map((scope) => (
              <button
                key={scope}
                onClick={() => setFilterScope(scope)}
                className={`px-3 py-2 text-sm ${
                  filterScope === scope
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {scope === 'all' ? 'All' : scope === 'my' ? 'My Reports' : scope === 'group' ? 'Group' : '⭐ Favorites'}
              </button>
            ))}
          </div>

          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>

          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="">All Tags</option>
            {allTags?.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-gray-200' : 'bg-white'}`}
              title="Grid view"
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 ${viewMode === 'list' ? 'bg-gray-200' : 'bg-white'}`}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : reports?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No reports found</p>
          <Link to="/reports/new" className="btn-primary">
            Create your first report
          </Link>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports?.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onFavorite={() => favoriteMutation.mutate(report.id)}
                  onRate={(rating) => rateMutation.mutate({ reportId: report.id, rating })}
                />
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="card divide-y divide-gray-200">
              {reports?.map((report) => (
                <ReportListItem
                  key={report.id}
                  report={report}
                  onFavorite={() => favoriteMutation.mutate(report.id)}
                  onRate={(rating) => rateMutation.mutate({ reportId: report.id, rating })}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Star Rating Component
function StarRating({
  rating,
  onRate,
  readonly = false,
}: {
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readonly && onRate?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className={`text-sm ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
          disabled={readonly}
        >
          {(hovered || rating) >= star ? '★' : '☆'}
        </button>
      ))}
      {rating > 0 && <span className="text-xs text-gray-500 ml-1">({rating.toFixed(1)})</span>}
    </div>
  );
}

// Report Card Component (Grid View)
function ReportCard({
  report,
  onFavorite,
  onRate,
}: {
  report: Report;
  onFavorite: () => void;
  onRate: (rating: number) => void;
}) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link
              to={`/reports/${report.id}`}
              className="text-lg font-medium text-primary-600 hover:text-primary-700"
            >
              {report.name}
            </Link>
            {report.category && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {report.category.icon} {report.category.name}
              </span>
            )}
          </div>
          <button
            onClick={onFavorite}
            className="text-xl hover:scale-110 transition-transform"
            title="Toggle favorite"
          >
            {report.isFavorite ? '⭐' : '☆'}
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500 line-clamp-2">
          {report.description || 'No description'}
        </p>
        
        {/* Rating */}
        <div className="mt-3">
          <StarRating rating={report.averageRating || 0} onRate={onRate} />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>{report.connection?.name}</span>
          <span>{report.executionCount} runs</span>
        </div>
        {report.tags && report.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {report.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded"
              >
                {tag}
              </span>
            ))}
            {report.tags.length > 3 && (
              <span className="text-xs text-gray-400">
                +{report.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <Link
          to={`/reports/${report.id}`}
          className="flex-1 text-center text-sm text-primary-600 hover:text-primary-700"
        >
          View
        </Link>
        <Link
          to={`/reports/${report.id}/edit`}
          className="flex-1 text-center text-sm text-gray-600 hover:text-gray-700"
        >
          Edit
        </Link>
        <Link
          to={`/reports/${report.id}/run`}
          className="flex-1 text-center text-sm font-medium text-green-600 hover:text-green-700"
        >
          ▶ Run
        </Link>
      </div>
    </div>
  );
}

// Report List Item Component (List View)
function ReportListItem({
  report,
  onFavorite,
  onRate,
}: {
  report: Report;
  onFavorite: () => void;
  onRate: (rating: number) => void;
}) {
  return (
    <div className="p-4 hover:bg-gray-50 flex items-center gap-4">
      <button
        onClick={onFavorite}
        className="text-xl hover:scale-110 transition-transform"
        title="Toggle favorite"
      >
        {report.isFavorite ? '⭐' : '☆'}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to={`/reports/${report.id}`}
            className="font-medium text-primary-600 hover:text-primary-700 truncate"
          >
            {report.name}
          </Link>
          {report.category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              {report.category.icon} {report.category.name}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">{report.description || 'No description'}</p>
      </div>

      <div className="flex-shrink-0">
        <StarRating rating={report.averageRating || 0} onRate={onRate} />
      </div>

      <div className="flex-shrink-0 text-xs text-gray-400 w-24 text-right">
        {report.executionCount} runs
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <Link to={`/reports/${report.id}`} className="btn-secondary text-sm py-1 px-3">
          View
        </Link>
        <Link to={`/reports/${report.id}/run`} className="btn-primary text-sm py-1 px-3">
          ▶ Run
        </Link>
      </div>
    </div>
  );
}
