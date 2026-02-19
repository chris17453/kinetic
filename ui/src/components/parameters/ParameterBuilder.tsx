import type { ParameterDefinition, ParameterType } from '../../lib/api/types';

interface ParameterBuilderProps {
  parameters: ParameterDefinition[];
  onChange: (parameters: ParameterDefinition[]) => void;
}

const parameterTypes: { value: ParameterType; label: string }[] = [
  { value: 'String', label: 'Text (single line)' },
  { value: 'Text', label: 'Text (multi-line)' },
  { value: 'Int', label: 'Integer' },
  { value: 'Decimal', label: 'Decimal' },
  { value: 'Bool', label: 'Boolean' },
  { value: 'Date', label: 'Date' },
  { value: 'DateTime', label: 'Date & Time' },
  { value: 'Time', label: 'Time' },
  { value: 'DateRange', label: 'Date Range' },
  { value: 'Select', label: 'Dropdown' },
  { value: 'MultiSelect', label: 'Multi-Select' },
  { value: 'UserPicker', label: 'User Picker' },
  { value: 'DepartmentPicker', label: 'Department Picker' },
  { value: 'Hidden', label: 'Hidden' },
];

export function ParameterBuilder({ parameters, onChange }: ParameterBuilderProps) {
  const addParameter = () => {
    const newParam: ParameterDefinition = {
      id: crypto.randomUUID(),
      variableName: `param${parameters.length + 1}`,
      label: `Parameter ${parameters.length + 1}`,
      type: 'String',
      displayOrder: parameters.length,
      required: false,
      useSystemVariable: false,
    };
    onChange([...parameters, newParam]);
  };

  const updateParameter = (index: number, updates: Partial<ParameterDefinition>) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeParameter = (index: number) => {
    onChange(parameters.filter((_, i) => i !== index));
  };

  const moveParameter = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= parameters.length) return;
    const updated = [...parameters];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((p, i) => (p.displayOrder = i));
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Define input parameters for your report. Use <code className="bg-gray-100 px-1 rounded">@variableName</code> in your query.
        </p>
        <button onClick={addParameter} className="btn-primary text-sm">
          + Add Parameter
        </button>
      </div>

      {parameters.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No parameters defined. Click "Add Parameter" to create input fields for your report.
        </div>
      ) : (
        <div className="space-y-3">
          {parameters.map((param, index) => (
            <div key={param.id} className="card p-4">
              <div className="flex items-start gap-4">
                {/* Move buttons */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveParameter(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveParameter(index, 'down')}
                    disabled={index === parameters.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>

                {/* Parameter fields */}
                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Variable Name</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                      value={param.variableName}
                      onChange={(e) => updateParameter(index, { variableName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Label</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      value={param.label}
                      onChange={(e) => updateParameter(index, { label: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                    <select
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      value={param.type}
                      onChange={(e) => updateParameter(index, { type: e.target.value as ParameterType })}
                    >
                      {parameterTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Default Value</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      value={param.defaultValue || ''}
                      onChange={(e) => updateParameter(index, { defaultValue: e.target.value })}
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={param.required}
                      onChange={(e) => updateParameter(index, { required: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    Required
                  </label>
                  <button
                    onClick={() => removeParameter(index)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Error message field */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className="block text-xs text-gray-500 mb-1">Error Message (optional)</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  placeholder="Custom error message when validation fails"
                  value={param.errorMessage || ''}
                  onChange={(e) => updateParameter(index, { errorMessage: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
