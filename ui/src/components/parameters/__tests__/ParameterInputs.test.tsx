import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParameterInputs } from '../inputs/ParameterInputs';
import type { ParameterDefinition } from '../../../lib/api/types';

const createParameter = (overrides: Partial<ParameterDefinition> = {}): ParameterDefinition => ({
  id: '1',
  variableName: 'testVar',
  label: 'Test Label',
  type: 'String',
  required: false,
  displayOrder: 0,
  useSystemVariable: false,
  config: {},
  ...overrides,
});

describe('ParameterInputs', () => {
  it('renders string input', () => {
    const params = [createParameter({ type: 'String', label: 'Name' })];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{}}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders integer input', () => {
    const params = [createParameter({ type: 'Int', label: 'Count', variableName: 'count' })];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{ count: 42 }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Count')).toBeInTheDocument();
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(42);
  });

  it('renders date input', () => {
    const params = [createParameter({ type: 'Date', label: 'Start Date', variableName: 'startDate' })];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{ startDate: '2024-01-15' }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Start Date')).toBeInTheDocument();
  });

  it('renders checkbox for bool type', () => {
    const params = [createParameter({ type: 'Bool', label: 'Active', variableName: 'active' })];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{ active: true }}
        onChange={onChange}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('renders select dropdown', () => {
    const params = [
      createParameter({
        type: 'Select',
        label: 'Status',
        variableName: 'status',
        config: {
          staticOptions: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      }),
    ];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{ status: 'active' }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Status')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('active');
  });

  it('calls onChange when input value changes', () => {
    const params = [createParameter({ type: 'String', variableName: 'name' })];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{}}
        onChange={onChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Value' } });

    expect(onChange).toHaveBeenCalledWith('name', 'New Value');
  });

  it('shows required indicator', () => {
    const params = [createParameter({ required: true, label: 'Required Field' })];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{}}
        onChange={onChange}
      />
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('sorts parameters by displayOrder', () => {
    const params = [
      createParameter({ id: '1', label: 'Third', displayOrder: 3 }),
      createParameter({ id: '2', label: 'First', displayOrder: 1 }),
      createParameter({ id: '3', label: 'Second', displayOrder: 2 }),
    ];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{}}
        onChange={onChange}
      />
    );

    const labels = screen.getAllByText(/First|Second|Third/);
    expect(labels[0]).toHaveTextContent('First');
    expect(labels[1]).toHaveTextContent('Second');
    expect(labels[2]).toHaveTextContent('Third');
  });

  it('hides hidden parameters', () => {
    const params = [createParameter({ type: 'Hidden', label: 'Secret', variableName: 'secret' })];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{ secret: 'hidden-value' }}
        onChange={onChange}
      />
    );

    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('renders date range input', () => {
    const params = [
      createParameter({
        type: 'DateRange',
        label: 'Date Range',
        variableName: 'dateRange',
      }),
    ];
    const onChange = vi.fn();

    render(
      <ParameterInputs
        parameters={params}
        values={{ dateRange: { start: '2024-01-01', end: '2024-12-31' } }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByText('to')).toBeInTheDocument();
  });

  it('applies compact mode styles', () => {
    const params = [createParameter({ type: 'String' })];
    const onChange = vi.fn();

    const { container } = render(
      <ParameterInputs
        parameters={params}
        values={{}}
        onChange={onChange}
        compact
      />
    );

    expect(container.firstChild).toHaveClass('gap-2');
  });
});
