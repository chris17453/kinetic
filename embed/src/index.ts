/**
 * Kinetic Embed Widget
 * 
 * Embeds Kinetic reports in any webpage
 * 
 * Usage:
 * <script src="https://your-kinetic.com/embed/kinetic-embed.js"></script>
 * <script>
 *   Kinetic.embed({
 *     container: '#my-report',
 *     token: 'your-embed-token',
 *     theme: 'light'
 *   });
 * </script>
 */

export interface EmbedOptions {
  container: string | HTMLElement;
  token: string;
  baseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  height?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onExecute?: (result: ExecutionResult) => void;
}

export interface EmbeddedReport {
  id: string;
  name?: string;
  description?: string;
  parameters?: Parameter[];
  visualizations: Visualization[];
  showExport: boolean;
  executionMode: string;
}

export interface Parameter {
  variableName: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue?: unknown;
  options?: string[];
}

export interface Visualization {
  id: string;
  type: string;
  title?: string;
}

export interface ExecutionResult {
  columns: Array<{ name: string; dataType: string }>;
  rows: Record<string, unknown>[];
  totalRows: number;
  executionTimeMs: number;
  cached: boolean;
}

class KineticEmbed {
  private container: HTMLElement;
  private token: string;
  private baseUrl: string;
  private theme: string;
  private report: EmbeddedReport | null = null;
  private paramValues: Record<string, unknown> = {};
  private currentResult: ExecutionResult | null = null;
  private options: EmbedOptions;

  constructor(options: EmbedOptions) {
    this.options = options;
    this.token = options.token;
    this.baseUrl = options.baseUrl || this.detectBaseUrl();
    this.theme = options.theme || 'light';

    // Get container
    if (typeof options.container === 'string') {
      const el = document.querySelector(options.container);
      if (!el) throw new Error(`Container not found: ${options.container}`);
      this.container = el as HTMLElement;
    } else {
      this.container = options.container;
    }

    this.init();
  }

  private detectBaseUrl(): string {
    // Try to detect from the script tag
    const scripts = document.getElementsByTagName('script');
    for (const script of scripts) {
      if (script.src.includes('kinetic-embed')) {
        const url = new URL(script.src);
        return `${url.protocol}//${url.host}`;
      }
    }
    return window.location.origin;
  }

  private async init(): Promise<void> {
    this.renderLoading();

    try {
      // Fetch report definition
      const response = await fetch(`${this.baseUrl}/api/embed/${this.token}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load report');
      }

      this.report = await response.json();
      
      // Initialize parameter values from defaults
      if (this.report.parameters) {
        for (const param of this.report.parameters) {
          if (param.defaultValue !== undefined) {
            this.paramValues[param.variableName] = param.defaultValue;
          }
        }
      }

      this.render();
      this.options.onLoad?.();

      // Auto-execute if configured
      if (this.report.executionMode === 'Auto') {
        await this.execute();
      }
    } catch (error) {
      this.renderError(error as Error);
      this.options.onError?.(error as Error);
    }
  }

  private renderLoading(): void {
    this.container.innerHTML = `
      <div class="kinetic-embed kinetic-${this.theme}" style="padding: 20px; text-align: center;">
        <div class="kinetic-loading">Loading report...</div>
      </div>
    `;
  }

  private renderError(error: Error): void {
    this.container.innerHTML = `
      <div class="kinetic-embed kinetic-${this.theme}" style="padding: 20px; text-align: center; color: #dc2626;">
        <div class="kinetic-error">
          <strong>Error:</strong> ${this.escapeHtml(error.message)}
        </div>
      </div>
    `;
  }

  private render(): void {
    if (!this.report) return;

    const styles = this.getStyles();
    const html = `
      <style>${styles}</style>
      <div class="kinetic-embed kinetic-${this.theme}">
        ${this.report.name ? `<div class="kinetic-header">
          <h3 class="kinetic-title">${this.escapeHtml(this.report.name)}</h3>
          ${this.report.description ? `<p class="kinetic-description">${this.escapeHtml(this.report.description)}</p>` : ''}
        </div>` : ''}
        
        ${this.report.parameters && this.report.parameters.length > 0 ? `
          <div class="kinetic-params">
            ${this.renderParameters()}
            <button class="kinetic-btn kinetic-btn-primary" onclick="window.__kineticInstances['${this.token}'].execute()">
              ▶ Run
            </button>
          </div>
        ` : ''}
        
        <div class="kinetic-content" id="kinetic-content-${this.token}">
          ${this.currentResult ? this.renderResult() : `
            <div class="kinetic-placeholder">
              ${this.report.executionMode === 'Auto' ? 'Loading...' : 'Click "Run" to execute the report'}
            </div>
          `}
        </div>
        
        ${this.report.showExport && this.currentResult ? `
          <div class="kinetic-footer">
            <button class="kinetic-btn kinetic-btn-secondary" onclick="window.__kineticInstances['${this.token}'].exportCsv()">
              Export CSV
            </button>
          </div>
        ` : ''}
      </div>
    `;

    this.container.innerHTML = html;

    // Store instance reference for event handlers
    (window as any).__kineticInstances = (window as any).__kineticInstances || {};
    (window as any).__kineticInstances[this.token] = this;
  }

  private renderParameters(): string {
    if (!this.report?.parameters) return '';

    return this.report.parameters.map(param => {
      const value = this.paramValues[param.variableName] ?? '';
      const id = `kinetic-param-${this.token}-${param.variableName}`;
      
      let input = '';
      switch (param.type) {
        case 'Date':
          input = `<input type="date" id="${id}" class="kinetic-input" value="${value}" 
            onchange="window.__kineticInstances['${this.token}'].setParam('${param.variableName}', this.value)">`;
          break;
        case 'DateTime':
          input = `<input type="datetime-local" id="${id}" class="kinetic-input" value="${value}"
            onchange="window.__kineticInstances['${this.token}'].setParam('${param.variableName}', this.value)">`;
          break;
        case 'Int':
        case 'Decimal':
          input = `<input type="number" id="${id}" class="kinetic-input" value="${value}"
            onchange="window.__kineticInstances['${this.token}'].setParam('${param.variableName}', this.value)">`;
          break;
        case 'Bool':
          input = `<input type="checkbox" id="${id}" class="kinetic-checkbox" ${value ? 'checked' : ''}
            onchange="window.__kineticInstances['${this.token}'].setParam('${param.variableName}', this.checked)">`;
          break;
        case 'Select':
          input = `<select id="${id}" class="kinetic-input"
            onchange="window.__kineticInstances['${this.token}'].setParam('${param.variableName}', this.value)">
            <option value="">Select...</option>
            ${(param.options || []).map(opt => 
              `<option value="${this.escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>${this.escapeHtml(opt)}</option>`
            ).join('')}
          </select>`;
          break;
        default:
          input = `<input type="text" id="${id}" class="kinetic-input" value="${this.escapeHtml(String(value))}"
            onchange="window.__kineticInstances['${this.token}'].setParam('${param.variableName}', this.value)">`;
      }

      return `
        <div class="kinetic-param">
          <label class="kinetic-label" for="${id}">
            ${this.escapeHtml(param.label)}${param.required ? ' *' : ''}
          </label>
          ${input}
        </div>
      `;
    }).join('');
  }

  private renderResult(): string {
    if (!this.currentResult) return '';

    // For now, render as a simple table
    const { columns, rows, totalRows, executionTimeMs } = this.currentResult;

    return `
      <div class="kinetic-result">
        <table class="kinetic-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${this.escapeHtml(col.name)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${columns.map(col => `<td>${this.formatValue(row[col.name])}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="kinetic-stats">
          ${totalRows} rows • ${executionTimeMs}ms
        </div>
      </div>
    `;
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toLocaleString();
    if (value instanceof Date) return value.toLocaleDateString();
    return this.escapeHtml(String(value));
  }

  public setParam(name: string, value: unknown): void {
    this.paramValues[name] = value;
  }

  public async execute(): Promise<void> {
    const contentEl = document.getElementById(`kinetic-content-${this.token}`);
    if (contentEl) {
      contentEl.innerHTML = '<div class="kinetic-loading">Executing...</div>';
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/embed/${this.token}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: this.paramValues })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Execution failed');
      }

      this.currentResult = await response.json();
      this.render();
      this.options.onExecute?.(this.currentResult!);
    } catch (error) {
      if (contentEl) {
        contentEl.innerHTML = `<div class="kinetic-error">Error: ${this.escapeHtml((error as Error).message)}</div>`;
      }
      this.options.onError?.(error as Error);
    }
  }

  public exportCsv(): void {
    if (!this.currentResult) return;

    const { columns, rows } = this.currentResult;
    const headers = columns.map(c => c.name).join(',');
    const data = rows.map(row => 
      columns.map(col => {
        const val = row[col.name];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ).join('\n');

    const csv = `${headers}\n${data}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.report?.name || 'report'}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private getStyles(): string {
    return `
      .kinetic-embed {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }
      .kinetic-light {
        background: #ffffff;
        color: #1f2937;
      }
      .kinetic-dark {
        background: #1f2937;
        color: #f3f4f6;
      }
      .kinetic-header {
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
      }
      .kinetic-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .kinetic-description {
        margin: 4px 0 0;
        color: #6b7280;
        font-size: 13px;
      }
      .kinetic-params {
        padding: 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: flex-end;
        border-bottom: 1px solid #e5e7eb;
      }
      .kinetic-param {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .kinetic-label {
        font-size: 12px;
        font-weight: 500;
        color: #6b7280;
      }
      .kinetic-input {
        padding: 6px 10px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 14px;
        min-width: 120px;
      }
      .kinetic-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      .kinetic-checkbox {
        width: 18px;
        height: 18px;
      }
      .kinetic-btn {
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
      }
      .kinetic-btn-primary {
        background: #3b82f6;
        color: white;
      }
      .kinetic-btn-primary:hover {
        background: #2563eb;
      }
      .kinetic-btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      .kinetic-btn-secondary:hover {
        background: #e5e7eb;
      }
      .kinetic-content {
        padding: 16px;
        min-height: 200px;
        overflow-x: auto;
      }
      .kinetic-placeholder, .kinetic-loading {
        text-align: center;
        color: #9ca3af;
        padding: 40px;
      }
      .kinetic-error {
        text-align: center;
        color: #dc2626;
        padding: 20px;
      }
      .kinetic-table {
        width: 100%;
        border-collapse: collapse;
      }
      .kinetic-table th {
        text-align: left;
        padding: 10px 12px;
        background: #f9fafb;
        border-bottom: 2px solid #e5e7eb;
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        color: #6b7280;
      }
      .kinetic-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #e5e7eb;
      }
      .kinetic-table tr:hover {
        background: #f9fafb;
      }
      .kinetic-stats {
        margin-top: 12px;
        font-size: 12px;
        color: #9ca3af;
      }
      .kinetic-footer {
        padding: 12px 16px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .kinetic-dark .kinetic-header,
      .kinetic-dark .kinetic-params,
      .kinetic-dark .kinetic-footer {
        border-color: #374151;
      }
      .kinetic-dark .kinetic-input {
        background: #374151;
        border-color: #4b5563;
        color: #f3f4f6;
      }
      .kinetic-dark .kinetic-table th {
        background: #374151;
        border-color: #4b5563;
      }
      .kinetic-dark .kinetic-table td {
        border-color: #374151;
      }
      .kinetic-dark .kinetic-table tr:hover {
        background: #374151;
      }
    `;
  }
}

// Export the embed function
export function embed(options: EmbedOptions): KineticEmbed {
  return new KineticEmbed(options);
}

// Auto-initialize embeds with data attributes
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-kinetic-token]').forEach(el => {
    const token = el.getAttribute('data-kinetic-token');
    const theme = el.getAttribute('data-kinetic-theme') as 'light' | 'dark' | undefined;
    const baseUrl = el.getAttribute('data-kinetic-base-url') || undefined;

    if (token) {
      embed({
        container: el as HTMLElement,
        token,
        theme,
        baseUrl
      });
    }
  });
});
