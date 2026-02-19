import React from 'react';
import type { TableConfig, ColumnDefinition } from '../../../lib/types';

interface TableConfigPanelProps {
  config: TableConfig;
  columns: ColumnDefinition[];
  onChange: (config: TableConfig) => void;
}

export const TableConfigPanel: React.FC<TableConfigPanelProps> = ({
  config,
  columns,
  onChange,
}) => {
  const pageSizes = [10, 25, 50, 100];

  const handleColumnVisibilityChange = (columnName: string, visible: boolean) => {
    const hiddenColumns = config.hiddenColumns || [];
    const updated = visible
      ? hiddenColumns.filter(c => c !== columnName)
      : [...hiddenColumns, columnName];
    onChange({ ...config, hiddenColumns: updated });
  };

  const handleColumnOrderChange = (fromIndex: number, toIndex: number) => {
    const order = [...(config.columnOrder || columns.map(c => c.name))];
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    onChange({ ...config, columnOrder: order });
  };

  const handleColumnDisplayNameChange = (columnName: string, displayName: string) => {
    const displayNames = { ...(config.columnDisplayNames || {}), [columnName]: displayName };
    onChange({ ...config, columnDisplayNames: displayNames });
  };

  const orderedColumns = config.columnOrder
    ? config.columnOrder.map(name => columns.find(c => c.name === name)).filter(Boolean) as ColumnDefinition[]
    : columns;

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-gray-700">Table Configuration</h3>

      {/* Page Size */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Rows Per Page
        </label>
        <select
          value={config.pageSize || 25}
          onChange={(e) => onChange({ ...config, pageSize: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        >
          {pageSizes.map(size => (
            <option key={size} value={size}>{size} rows</option>
          ))}
        </select>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enableSorting !== false}
            onChange={(e) => onChange({ ...config, enableSorting: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-600">Enable Sorting</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enableFiltering === true}
            onChange={(e) => onChange({ ...config, enableFiltering: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-600">Enable Column Filtering</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.stripedRows === true}
            onChange={(e) => onChange({ ...config, stripedRows: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-600">Striped Rows</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.compactMode === true}
            onChange={(e) => onChange({ ...config, compactMode: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-600">Compact Mode</span>
        </label>
      </div>

      {/* Column Configuration */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
          Columns (drag to reorder)
        </label>
        <div className="space-y-1 max-h-60 overflow-y-auto border rounded-md p-2 bg-white">
          {orderedColumns.map((col, index) => (
            <div
              key={col.name}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded border"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                handleColumnOrderChange(fromIndex, index);
              }}
            >
              <span className="text-gray-400 cursor-move">⋮⋮</span>
              <input
                type="checkbox"
                checked={!config.hiddenColumns?.includes(col.name)}
                onChange={(e) => handleColumnVisibilityChange(col.name, e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={config.columnDisplayNames?.[col.name] || col.displayName || col.name}
                  onChange={(e) => handleColumnDisplayNameChange(col.name, e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-xs text-gray-400">{col.dataType}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TableConfigPanel;
