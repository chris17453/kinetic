import { useState } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

interface ExportColumn {
  name: string;
  displayName: string;
  included: boolean;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportName: string;
  columns: { name: string; displayName: string }[];
  parameters?: Record<string, string>;
}

export function ExportModal({
  isOpen,
  onClose,
  reportId,
  reportName,
  columns: initialColumns,
  parameters,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [columns, setColumns] = useState<ExportColumn[]>(
    initialColumns.map((c) => ({ ...c, included: true }))
  );
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [includeFilters, setIncludeFilters] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleToggleColumn = (name: string) => {
    setColumns(
      columns.map((c) =>
        c.name === name ? { ...c, included: !c.included } : c
      )
    );
  };

  const handleSelectAll = () => {
    setColumns(columns.map((c) => ({ ...c, included: true })));
  };

  const handleSelectNone = () => {
    setColumns(columns.map((c) => ({ ...c, included: false })));
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const response = await fetch(`/api/export/${reportId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          format,
          columns: columns.filter((c) => c.included).map((c) => c.name),
          options: {
            includeHeaders,
            includeTimestamp,
            includeFilters,
            appliedFilters: parameters,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = format === 'excel' ? 'xlsx' : format;
      a.download = `${reportName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
        />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Export Report</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['excel', 'csv', 'pdf', 'json'] as ExportFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium uppercase transition-colors ${
                      format === f
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Column Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Columns to Include
                </label>
                <div className="space-x-2 text-sm">
                  <button
                    onClick={handleSelectAll}
                    className="text-blue-600 hover:underline"
                  >
                    All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleSelectNone}
                    className="text-blue-600 hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                {columns.map((column) => (
                  <label
                    key={column.name}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={column.included}
                      onChange={() => handleToggleColumn(column.name)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{column.displayName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHeaders}
                    onChange={(e) => setIncludeHeaders(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Include column headers</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTimestamp}
                    onChange={(e) => setIncludeTimestamp(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Include generation timestamp</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFilters}
                    onChange={(e) => setIncludeFilters(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Include applied filters</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || columns.filter((c) => c.included).length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
