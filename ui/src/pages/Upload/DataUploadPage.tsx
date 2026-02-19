import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Connection } from '../../lib/api/types';

interface UploadedFile {
  file: File;
  sheets: SheetInfo[];
  selectedSheets: Map<string, SheetConfig>;
}

interface SheetInfo {
  name: string;
  columns: string[];
  rowCount: number;
  preview: Record<string, unknown>[];
}

interface SheetConfig {
  tableName: string;
  import: boolean;
  columnMappings: Map<string, string>;
}

export function DataUploadPage() {
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [newDbName, setNewDbName] = useState('');
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [options, setOptions] = useState({
    firstRowHeaders: true,
    autoDetectTypes: true,
    truncateExisting: false,
  });

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
      const res = await api.post('/upload/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data as { files: Array<{ name: string; sheets: SheetInfo[] }> };
    },
    onSuccess: (data) => {
      const newFiles = data.files.map((f) => ({
        file: new File([], f.name),
        sheets: f.sheets,
        selectedSheets: new Map(
          f.sheets.map((s) => [
            s.name,
            {
              tableName: s.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              import: true,
              columnMappings: new Map(s.columns.map((c) => [c, c])),
            },
          ])
        ),
      }));
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        targetMode,
        newDatabaseName: targetMode === 'new' ? newDbName : undefined,
        targetConnectionId: targetMode === 'existing' ? targetConnectionId : undefined,
        options,
        files: uploadedFiles.map((f) => ({
          fileName: f.file.name,
          sheets: Array.from(f.selectedSheets.entries())
            .filter(([, config]) => config.import)
            .map(([sheetName, config]) => ({
              sheetName,
              tableName: config.tableName,
              columnMappings: Object.fromEntries(config.columnMappings),
            })),
        })),
      };
      return api.post('/upload/import', payload);
    },
  });

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        uploadMutation.mutate(e.dataTransfer.files);
      }
    },
    [uploadMutation]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMutation.mutate(e.target.files);
    }
  };

  const updateSheetConfig = (
    fileIndex: number,
    sheetName: string,
    updates: Partial<SheetConfig>
  ) => {
    const newFiles = [...uploadedFiles];
    const current = newFiles[fileIndex].selectedSheets.get(sheetName)!;
    newFiles[fileIndex].selectedSheets.set(sheetName, { ...current, ...updates });
    setUploadedFiles(newFiles);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Data Upload</h1>

      {/* Target Selection */}
      <div className="card p-4">
        <h2 className="text-lg font-medium mb-4">Target Database</h2>
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="targetMode"
              checked={targetMode === 'new'}
              onChange={() => setTargetMode('new')}
              className="text-primary-600"
            />
            Create New Database
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="targetMode"
              checked={targetMode === 'existing'}
              onChange={() => setTargetMode('existing')}
              className="text-primary-600"
            />
            Use Existing Connection
          </label>
        </div>

        {targetMode === 'new' ? (
          <input
            type="text"
            placeholder="Database name..."
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md"
            value={newDbName}
            onChange={(e) => setNewDbName(e.target.value)}
          />
        ) : (
          <select
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md"
            value={targetConnectionId}
            onChange={(e) => setTargetConnectionId(e.target.value)}
          >
            <option value="">Select connection...</option>
            {connections?.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} ({conn.type})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Drop Zone */}
      <div
        className="card p-8 border-2 border-dashed border-gray-300 text-center hover:border-primary-400 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="text-4xl mb-4">📁</div>
        <p className="text-gray-600 mb-2">Drop Excel/CSV files here or click to browse</p>
        <p className="text-sm text-gray-400 mb-4">Supports: .xlsx, .xls, .csv, .json</p>
        <input
          type="file"
          multiple
          accept=".xlsx,.xls,.csv,.json"
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <label htmlFor="file-input" className="btn-primary cursor-pointer">
          Browse Files
        </label>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Uploaded Files</h2>

          {uploadedFiles.map((uploaded, fileIndex) => (
            <div key={fileIndex} className="card">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <span className="font-medium">{uploaded.file.name || `File ${fileIndex + 1}`}</span>
                </div>
                <button
                  onClick={() => removeFile(fileIndex)}
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3">
                {uploaded.sheets.map((sheet) => {
                  const config = uploaded.selectedSheets.get(sheet.name)!;
                  return (
                    <div
                      key={sheet.name}
                      className={`p-3 border rounded-md ${config.import ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'}`}
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={config.import}
                          onChange={(e) =>
                            updateSheetConfig(fileIndex, sheet.name, { import: e.target.checked })
                          }
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Sheet:</span>
                            <span className="font-medium">{sheet.name}</span>
                            <span className="text-xs text-gray-400">
                              ({sheet.columns.length} cols, {sheet.rowCount} rows)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">→ Table:</span>
                            <input
                              type="text"
                              className="px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                              value={config.tableName}
                              onChange={(e) =>
                                updateSheetConfig(fileIndex, sheet.name, {
                                  tableName: e.target.value,
                                })
                              }
                              disabled={!config.import}
                            />
                          </div>
                        </div>
                        <button className="text-sm text-primary-600 hover:text-primary-700">
                          Preview
                        </button>
                        <button className="text-sm text-primary-600 hover:text-primary-700">
                          Map Columns
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Options */}
      {uploadedFiles.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3">Import Options</h3>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.firstRowHeaders}
                onChange={(e) => setOptions({ ...options, firstRowHeaders: e.target.checked })}
                className="rounded border-gray-300"
              />
              First row contains headers
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.autoDetectTypes}
                onChange={(e) => setOptions({ ...options, autoDetectTypes: e.target.checked })}
                className="rounded border-gray-300"
              />
              Auto-detect column types
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.truncateExisting}
                onChange={(e) => setOptions({ ...options, truncateExisting: e.target.checked })}
                className="rounded border-gray-300"
              />
              Truncate existing tables
            </label>
          </div>
        </div>
      )}

      {/* Import Button */}
      {uploadedFiles.length > 0 && (
        <div className="flex justify-end gap-4">
          <button
            onClick={() => setUploadedFiles([])}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => importMutation.mutate()}
            disabled={
              importMutation.isPending ||
              (targetMode === 'new' && !newDbName) ||
              (targetMode === 'existing' && !targetConnectionId)
            }
            className="btn-primary"
          >
            {importMutation.isPending ? 'Importing...' : '▶ Import Data'}
          </button>
        </div>
      )}
    </div>
  );
}
