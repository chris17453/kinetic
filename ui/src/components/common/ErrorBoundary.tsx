import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="d-flex align-items-center justify-content-center p-5">
          <div className="text-center">
            <i className="fa-solid fa-triangle-exclamation text-warning fs-1 mb-3 d-block"></i>
            <h5>Something went wrong</h5>
            <p className="text-muted small">{this.state.error?.message}</p>
            <button className="btn btn-outline-primary btn-sm" onClick={() => this.setState({ hasError: false })}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
