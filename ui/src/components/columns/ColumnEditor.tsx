import type { ColumnDefinition } from '../../lib/api/types';

interface ColumnEditorProps {
  columns: ColumnDefinition[];
  onChange: (columns: ColumnDefinition[]) => void;
}

const formatTypes = [
  { value: 'None', label: 'None' },
  { value: 'Number', label: 'Number' },
  { value: 'Currency', label: 'Currency' },
  { value: 'Percent', label: 'Percent' },
  { value: 'Date', label: 'Date' },
  { value: 'DateTime', label: 'Date & Time' },
  { value: 'Time', label: 'Time' },
  { value: 'Custom', label: 'Custom' },
];

const alignments = [
  { value: 'Left', label: '⬅️' },
  { value: 'Center', label: '↔️' },
  { value: 'Right', label: '➡️' },
];

export function ColumnEditor({ columns, onChange }: ColumnEditorProps) {
  const updateColumn = (index: number, updates: Partial<ColumnDefinition>) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;
    const updated = [...columns];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((c, i) => (c.displayOrder = i));
    onChange(updated);
  };

  const toggleAll = (visible: boolean) => {
    onChange(columns.map((c) => ({ ...c, visible })));
  };

  if (columns.length === 0) {
    return (
      <div className="card p-8 text-center text-gray-500">
        No columns detected. Test your query first to auto-detect columns.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Configure how columns appear in the report. Drag to reorder, rename for display, and set formatting.
        </p>
        <div className="flex gap-2">
          <button onClick={() => toggleAll(true)} className="btn-secondary text-sm">
            Show All
          </button>
          <button onClick={() => toggleAll(false)} className="btn-secondary text-sm">
            Hide All
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-10"></th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-10">Visible</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Source Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Display Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Data Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Format</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">Align</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Width</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {columns.map((col, index) => (
              <tr key={col.id} className={col.visible ? '' : 'bg-gray-50 opacity-60'}>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveColumn(index, 'up')}
                      disabled={index === 0}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveColumn(index, 'down')}
                      disabled={index === columns.length - 1}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => updateColumn(index, { visible: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-3 py-2 text-sm font-mono text-gray-600">{col.sourceName}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    value={col.displayName}
                    onChange={(e) => updateColumn(index, { displayName: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 text-sm text-gray-500">{col.dataType}</td>
                <td className="px-3 py-2">
                  <select
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                    value={col.format.type}
                    onChange={(e) =>
                      updateColumn(index, {
                        format: { ...col.format, type: e.target.value as typeof col.format.type },
                      })
                    }
                  >
                    {formatTypes.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {alignments.map((a) => (
                      <button
                        key={a.value}
                        onClick={() =>
                          updateColumn(index, {
                            format: { ...col.format, alignment: a.value as typeof col.format.alignment },
                          })
                        }
                        className={`p-1 rounded ${
                          col.format.alignment === a.value ? 'bg-primary-100' : 'hover:bg-gray-100'
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="auto"
                    value={col.format.width || ''}
                    onChange={(e) =>
                      updateColumn(index, {
                        format: { ...col.format, width: e.target.value || undefined },
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
