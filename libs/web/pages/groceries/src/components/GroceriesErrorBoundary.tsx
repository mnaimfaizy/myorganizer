'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for gracefully handling errors in grocery list pages.
 * Catches errors and displays a fallback UI instead of crashing the app.
 */
export class GroceriesErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Groceries error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center bg-surface p-4">
            <div className="max-w-md rounded-lg bg-surface-container p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-on-surface">
                Something went wrong
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                We encountered an error loading your grocery lists. Please try
                refreshing the page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 font-medium text-on-primary hover:bg-primary/90"
              >
                Refresh Page
              </button>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-medium text-error">
                    Error details (dev only)
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-error-container p-2 text-xs text-on-error-container">
                    {this.state.error?.toString()}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
