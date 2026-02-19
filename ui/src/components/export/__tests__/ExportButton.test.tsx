import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportButton } from '../ExportButton';

describe('ExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export button', () => {
    render(<ExportButton reportId="123" reportName="Test Report" />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('shows dropdown menu when clicked', () => {
    render(<ExportButton reportId="123" reportName="Test Report" />);
    
    fireEvent.click(screen.getByText('Export'));
    
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    expect(screen.getByText('Export as Excel')).toBeInTheDocument();
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
  });

  it('respects custom formats prop', () => {
    render(
      <ExportButton
        reportId="123"
        reportName="Test Report"
        formats={['csv', 'json']}
      />
    );
    
    fireEvent.click(screen.getByText('Export'));
    
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    expect(screen.getByText('Export as JSON')).toBeInTheDocument();
    expect(screen.queryByText('Export as Excel')).not.toBeInTheDocument();
    expect(screen.queryByText('Export as PDF')).not.toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(<ExportButton reportId="123" reportName="Test Report" disabled />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('closes dropdown when clicking outside', () => {
    render(<ExportButton reportId="123" reportName="Test Report" />);
    
    // Open dropdown
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    
    // Click overlay to close
    const overlay = document.querySelector('.fixed.inset-0');
    if (overlay) {
      fireEvent.click(overlay);
    }
    
    expect(screen.queryByText('Export as CSV')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <ExportButton
        reportId="123"
        reportName="Test Report"
        className="my-custom-class"
      />
    );
    
    const container = screen.getByText('Export').closest('div');
    expect(container).toHaveClass('my-custom-class');
  });
});
