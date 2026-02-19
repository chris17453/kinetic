import React from 'react';
import type { ParameterDefinition } from '../../../lib/api/types';

interface ParameterInputsProps {
  parameters: ParameterDefinition[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  compact?: boolean;
}

export const ParameterInputs: React.FC<ParameterInputsProps> = ({
  parameters,
  values,
  onChange,
  compact = false,
}) => {
  const sortedParams = [...parameters].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className={`flex flex-wrap gap-4 ${compact ? 'gap-2' : 'gap-4'}`}>
      {sortedParams.map(param => (
        <ParameterInput
          key={param.id}
          parameter={param}
          value={values[param.variableName]}
          onChange={(value) => onChange(param.variableName, value)}
          compact={compact}
        />
      ))}
    </div>
  );
};

interface ParameterInputProps {
  parameter: ParameterDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  compact?: boolean;
}

const ParameterInput: React.FC<ParameterInputProps> = ({
  parameter,
  value,
  onChange,
  compact,
}) => {
  const { type, label, required, config, errorMessage } = parameter;

  const inputClass = `px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
    compact ? 'text-sm' : ''
  }`;

  const renderInput = () => {
    switch (type) {
      case 'String':
        return (
          <input
            type="text"
            className={inputClass}
            placeholder={config?.placeholder}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={config?.maxLength}
            minLength={config?.minLength}
            required={required}
          />
        );

      case 'Text':
        return (
          <textarea
            className={`${inputClass} min-w-[200px]`}
            placeholder={config?.placeholder}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={config?.maxLength}
            rows={3}
            required={required}
          />
        );

      case 'Int':
        return (
          <input
            type="number"
            className={`${inputClass} w-32`}
            value={(value as number) ?? ''}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
            min={config?.minValue}
            max={config?.maxValue}
            step={1}
            required={required}
          />
        );

      case 'Decimal':
        return (
          <input
            type="number"
            className={`${inputClass} w-40`}
            value={(value as number) ?? ''}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
            min={config?.minValue}
            max={config?.maxValue}
            step={Math.pow(10, -(config?.decimalPlaces ?? 2))}
            required={required}
          />
        );

      case 'Bool':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={(value as boolean) || false}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-sm text-gray-600">{label}</span>
          </label>
        );

      case 'Date':
        return (
          <input
            type="date"
            className={inputClass}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            min={config?.minDate}
            max={config?.maxDate}
            required={required}
          />
        );

      case 'DateTime':
        return (
          <input
            type="datetime-local"
            className={inputClass}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            min={config?.minDate}
            max={config?.maxDate}
            required={required}
          />
        );

      case 'Time':
        return (
          <input
            type="time"
            className={inputClass}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            required={required}
          />
        );

      case 'DateRange':
        return (
          <DateRangeInput
            value={value as { start: string; end: string } | undefined}
            onChange={onChange}
            config={config}
            inputClass={inputClass}
            required={required}
          />
        );

      case 'Select':
        return (
          <select
            className={inputClass}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value || null)}
            required={required}
          >
            {config?.allowEmpty !== false && (
              <option value="">{config?.emptyLabel || 'Select...'}</option>
            )}
            {config?.staticOptions?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'MultiSelect':
        return (
          <MultiSelectInput
            options={config?.staticOptions || []}
            value={(value as string[]) || []}
            onChange={onChange}
            inputClass={inputClass}
            placeholder={config?.emptyLabel || 'Select...'}
          />
        );

      case 'Hidden':
        return null;

      default:
        return (
          <input
            type="text"
            className={inputClass}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            required={required}
          />
        );
    }
  };

  if (type === 'Hidden') {
    return null;
  }

  if (type === 'Bool') {
    return <div>{renderInput()}</div>;
  }

  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {errorMessage && (
        <span className="text-xs text-gray-500 mt-1">{errorMessage}</span>
      )}
    </div>
  );
};

// DateRange component
interface DateRangeInputProps {
  value: { start: string; end: string } | undefined;
  onChange: (value: { start: string; end: string }) => void;
  config?: any;
  inputClass: string;
  required?: boolean;
}

const DateRangeInput: React.FC<DateRangeInputProps> = ({
  value,
  onChange,
  config,
  inputClass,
  required,
}) => {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        className={inputClass}
        value={value?.start || ''}
        onChange={(e) => onChange({ start: e.target.value, end: value?.end || '' })}
        min={config?.minDate}
        max={config?.maxDate}
        required={required}
      />
      <span className="text-gray-500">to</span>
      <input
        type="date"
        className={inputClass}
        value={value?.end || ''}
        onChange={(e) => onChange({ start: value?.start || '', end: e.target.value })}
        min={value?.start || config?.minDate}
        max={config?.maxDate}
        required={required}
      />
    </div>
  );
};

// MultiSelect component
interface MultiSelectInputProps {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  inputClass: string;
  placeholder?: string;
}

const MultiSelectInput: React.FC<MultiSelectInputProps> = ({
  options,
  value,
  onChange,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const toggleOption = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter(v => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 border border-gray-300 rounded-md bg-white text-left min-w-[150px] focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {value.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          <span>{value.length} selected</span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggleOption(opt.value)}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParameterInputs;
