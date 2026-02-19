import React, { useState, useMemo } from 'react';
import type { QueryResult, ColumnDefinition } from '../../../lib/types';

interface TableRendererProps {
  data: QueryResult;
  columns: ColumnDefinition[];
  pageSize?: number;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onPageChange?: (page: number) => void;
  totalRows?: number;
  currentPage?: number;
  serverSidePagination?: boolean;
}

export const TableRenderer: React.FC<TableRendererProps> = ({
  data,
  columns,
  pageSize = 25,
  onSort,
  onPageChange,
  totalRows,
  currentPage = 1,
  serverSidePagination = false,
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [localPage, setLocalPage] = useState(1);

  const page = serverSidePagination ? currentPage : localPage;
  const total = totalRows ?? data.rows.length;
  const totalPages = Math.ceil(total / pageSize);

  const displayedRows = useMemo(() => {
    let rows = [...data.rows];

    // Client-side sorting if no server handler
    if (sortColumn && !onSort) {
      rows.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const comparison = aVal < bVal ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    // Client-side pagination if no server handler
    if (!serverSidePagination) {
      const start = (localPage - 1) * pageSize;
      rows = rows.slice(start, start + pageSize);
    }

    return rows;
  }, [data.rows, sortColumn, sortDirection, localPage, pageSize, serverSidePagination, onSort]);

  const handleSort = (column: string) => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
    if (onSort) {
      onSort(column, newDirection);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (serverSidePagination && onPageChange) {
      onPageChange(newPage);
    } else {
      setLocalPage(newPage);
    }
  };

  const formatValue = (value: unknown, column: ColumnDefinition): string => {
    if (value === null || value === undefined) return '—';
    
    switch (column.dataType) {
      case 'date':
        return new Date(value as string).toLocaleDateString();
      case 'datetime':
        return new Date(value as string).toLocaleString();
      case 'decimal':
      case 'money':
        return typeof value === 'number' 
          ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : String(value);
      case 'boolean':
        return value ? '✓' : '✗';
      default:
        return String(value);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.name}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(col.name)}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.displayName || col.name}</span>
                    {sortColumn === col.name && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td
                    key={col.name}
                    className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap"
                  >
                    {formatValue(row[col.name], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t">
        <div className="text-sm text-gray-500">
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} rows
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(1)}
            disabled={page === 1}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ««
          </button>
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            «
          </button>
          <span className="px-3 py-1 text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            »
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={page === totalPages}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            »»
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableRenderer;
