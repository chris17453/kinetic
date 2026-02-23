import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Connection } from '../../lib/api/types';
import { useToast, Breadcrumb } from '../../components/common';

const MAX_FILE_SIZE_MB = 100;

const BREADCRUMBS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Data Upload' },
];

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

interface UploadedFile {
  file: File;
  sheets: SheetInfo[];
  selectedSheets: Map<string, SheetConfig>;
}

export function DataUploadPage() {
  const toast = useToast();
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [newDbName, setNewDbName] = useState('');
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mappingSheet, setMappingSheet] = useState<{
    fileIndex: number;
    sheetName: string;
  } | null>(null);
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

  const analyzeMutation = useMutation({
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
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      toast.success('Files analyzed', `${data.files.length} file(s) ready to configure.`);
    },
    onError: () => {
      toast.error('Analysis failed', 'Could not read the uploaded files.');
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
            .filter(([, cfg]) => cfg.import)
            .map(([sheetName, cfg]) => ({
              sheetName,
              tableName: cfg.tableName,
              columnMappings: Object.fromEntries(cfg.columnMappings),
            })),
        })),
      };
      return api.post('/upload/import', payload);
    },
    onSuccess: () => {
      toast.success('Import complete', 'Data has been imported successfully.');
      setUploadedFiles([]);
    },
    onError: () => {
      toast.error('Import failed', 'An error occurred during import.');
    },
  });

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        analyzeMutation.mutate(e.dataTransfer.files);
      }
    },
    [analyzeMutation]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      analyzeMutation.mutate(e.target.files);
      e.target.value = '';
    }
  };

  const updateSheetConfig = (
    fileIndex: number,
    sheetName: string,
    updates: Partial<SheetConfig>
  ) => {
    setUploadedFiles((prev) => {
      const next = [...prev];
      const current = next[fileIndex].selectedSheets.get(sheetName)!;
      next[fileIndex].selectedSheets.set(sheetName, { ...current, ...updates });
      return next;
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canImport =
    uploadedFiles.length > 0 &&
    !importMutation.isPending &&
    (targetMode === 'new' ? newDbName.trim().length > 0 : targetConnectionId.length > 0);

  // Find current mapping sheet data
  const mappingData = mappingSheet
    ? {
        sheet: uploadedFiles[mappingSheet.fileIndex]?.sheets.find(
          (s) => s.name === mappingSheet.sheetName
        ),
        config: uploadedFiles[mappingSheet.fileIndex]?.selectedSheets.get(
          mappingSheet.sheetName
        ),
      }
    : null;

  return (
    <div className="container-fluid py-4">
      <Breadcrumb crumbs={BREADCRUMBS} />

      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold">
          <i className="fa-solid fa-cloud-arrow-up me-2 text-primary"></i>
          Data Upload
        </h1>
        <span className="badge bg-light text-dark border">
          <i className="fa-solid fa-weight-hanging me-1 text-muted"></i>
          Max file size: {MAX_FILE_SIZE_MB} MB
        </span>
      </div>

      {/* Target Selection */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-white fw-semibold">
          <i className="fa-solid fa-database me-2 text-primary"></i>
          Target Database
        </div>
        <div className="card-body">
          <div className="d-flex gap-4 mb-3">
            <div className="form-check">
              <input
                type="radio"
                className="form-check-input"
                id="mode-new"
                name="targetMode"
                checked={targetMode === 'new'}
                onChange={() => setTargetMode('new')}
              />
              <label className="form-check-label" htmlFor="mode-new">
                Create New Database
              </label>
            </div>
            <div className="form-check">
              <input
                type="radio"
                className="form-check-input"
                id="mode-existing"
                name="targetMode"
                checked={targetMode === 'existing'}
                onChange={() => setTargetMode('existing')}
              />
              <label className="form-check-label" htmlFor="mode-existing">
                Use Existing Connection
              </label>
            </div>
          </div>

          {targetMode === 'new' ? (
            <div style={{ maxWidth: 400 }}>
              <label className="form-label" htmlFor="db-name">
                Database Name
              </label>
              <input
                id="db-name"
                type="text"
                className="form-control"
                placeholder="my_database"
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
              />
            </div>
          ) : (
            <div style={{ maxWidth: 400 }}>
              <label className="form-label" htmlFor="conn-select">
                Connection
              </label>
              <select
                id="conn-select"
                className="form-select"
                value={targetConnectionId}
                onChange={(e) => setTargetConnectionId(e.target.value)}
              >
                <option value="">Select a connection...</option>
                {connections?.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`card shadow-sm mb-4 text-center py-5 ${
          isDragging ? 'border-primary bg-primary bg-opacity-10' : 'border-dashed'
        }`}
        style={{
          border: `2px dashed ${isDragging ? '#0d6efd' : '#dee2e6'}`,
          transition: 'all 0.15s ease',
          cursor: 'pointer',
        }}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <div className="card-body">
          {analyzeMutation.isPending ? (
            <>
              <div className="spinner-border text-primary mb-3" role="status" />
              <p className="fw-semibold mb-1">Analyzing files...</p>
              <p className="text-muted small mb-0">Please wait while we read your data.</p>
            </>
          ) : (
            <>
              <i
                className={`fa-solid fa-cloud-arrow-up fa-3x mb-3 ${
                  isDragging ? 'text-primary' : 'text-muted opacity-50'
                }`}
              ></i>
              <p className="fw-semibold mb-1">
                {isDragging ? 'Release to upload' : 'Drop files here or click to browse'}
              </p>
              <p className="text-muted small mb-3">
                Supports .xlsx, .xls, .csv, .json
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('file-input')?.click();
                }}
              >
                <i className="fa-solid fa-folder-open me-2"></i>
                Browse Files
              </button>
            </>
          )}
          <input
            id="file-input"
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.json"
            className="d-none"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Upload Progress */}
      {importMutation.isPending && (
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <p className="fw-semibold mb-2">
              <i className="fa-solid fa-spinner fa-spin me-2 text-primary"></i>
              Importing data...
            </p>
            <div className="progress" style={{ height: 8 }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                role="progressbar"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <>
          <h5 className="fw-semibold mb-3">
            <i className="fa-solid fa-file-excel me-2 text-success"></i>
            Configured Files
          </h5>

          {uploadedFiles.map((uploaded, fileIndex) => (
            <div key={fileIndex} className="card shadow-sm mb-3">
              <div className="card-header bg-white d-flex align-items-center justify-content-between">
                <span className="fw-medium">
                  <i className="fa-solid fa-table me-2 text-muted"></i>
                  {uploaded.file.name || `File ${fileIndex + 1}`}
                  <span className="badge bg-secondary ms-2">
                    {uploaded.sheets.length} sheet{uploaded.sheets.length !== 1 ? 's' : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => removeFile(fileIndex)}
                >
                  <i className="fa-solid fa-xmark me-1"></i>Remove
                </button>
              </div>

              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3" style={{ width: 40 }}>Import</th>
                      <th>Sheet Name</th>
                      <th>Rows / Cols</th>
                      <th>Target Table</th>
                      <th>Column Mapping</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploaded.sheets.map((sheet) => {
                      const config = uploaded.selectedSheets.get(sheet.name)!;
                      return (
                        <tr
                          key={sheet.name}
                          className={!config.import ? 'table-secondary opacity-50' : ''}
                        >
                          <td className="ps-3">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={config.import}
                              onChange={(e) =>
                                updateSheetConfig(fileIndex, sheet.name, {
                                  import: e.target.checked,
                                })
                              }
                            />
                          </td>
                          <td className="fw-medium">{sheet.name}</td>
                          <td className="text-muted small">
                            {sheet.rowCount.toLocaleString()} rows &times; {sheet.columns.length} cols
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm font-monospace"
                              style={{ maxWidth: 200 }}
                              value={config.tableName}
                              disabled={!config.import}
                              onChange={(e) =>
                                updateSheetConfig(fileIndex, sheet.name, {
                                  tableName: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              disabled={!config.import}
                              onClick={() =>
                                setMappingSheet({ fileIndex, sheetName: sheet.name })
                              }
                            >
                              <i className="fa-solid fa-sliders me-1"></i>
                              Map Columns
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Options */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-white fw-semibold">
              <i className="fa-solid fa-gear me-2 text-muted"></i>
              Import Options
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-4">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="opt-headers"
                    checked={options.firstRowHeaders}
                    onChange={(e) =>
                      setOptions({ ...options, firstRowHeaders: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="opt-headers">
                    First row contains headers
                  </label>
                </div>
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="opt-types"
                    checked={options.autoDetectTypes}
                    onChange={(e) =>
                      setOptions({ ...options, autoDetectTypes: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="opt-types">
                    Auto-detect column types
                  </label>
                </div>
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="opt-truncate"
                    checked={options.truncateExisting}
                    onChange={(e) =>
                      setOptions({ ...options, truncateExisting: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="opt-truncate">
                    Truncate existing tables
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="d-flex justify-content-end gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setUploadedFiles([])}
            >
              <i className="fa-solid fa-xmark me-1"></i>Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canImport}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? (
                <><span className="spinner-border spinner-border-sm me-2" />Importing...</>
              ) : (
                <><i className="fa-solid fa-upload me-2"></i>Import Data</>
              )}
            </button>
          </div>
        </>
      )}

      {/* Column Mapping Modal */}
      {mappingSheet && mappingData?.sheet && mappingData?.config && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fa-solid fa-sliders me-2 text-primary"></i>
                  Column Mapping &mdash; {mappingSheet.sheetName}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setMappingSheet(null)}
                />
              </div>
              <div className="modal-body p-0">
                <table className="table table-sm mb-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th className="ps-3">Source Column</th>
                      <th>Target Column Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingData.sheet.columns.map((col) => (
                      <tr key={col}>
                        <td className="ps-3 font-monospace small align-middle">{col}</td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm font-monospace"
                            value={mappingData.config!.columnMappings.get(col) ?? col}
                            onChange={(e) => {
                              const newMap = new Map(mappingData.config!.columnMappings);
                              newMap.set(col, e.target.value);
                              updateSheetConfig(
                                mappingSheet.fileIndex,
                                mappingSheet.sheetName,
                                { columnMappings: newMap }
                              );
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setMappingSheet(null)}
                >
                  <i className="fa-solid fa-check me-1"></i>Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
