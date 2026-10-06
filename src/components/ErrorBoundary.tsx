import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    const msg = String(error?.message || '');
    if (
      (msg.includes("reading 'useState'") ||
        msg.includes("reading 'useEffect'") ||
        msg.includes('Invalid hook call')) &&
      typeof window !== 'undefined' &&
      !sessionStorage.getItem('forkcount_sw_cache_reset_done')
    ) {
      sessionStorage.setItem('forkcount_sw_cache_reset_done', '1');
      const cleanup: Promise<any>[] = [];
      if ('caches' in window) {
        cleanup.push(
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        );
      }
      if ('serviceWorker' in navigator) {
        cleanup.push(
          navigator.serviceWorker
            .getRegistrations()
            .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        );
      }
      Promise.all(cleanup)
        .catch(() => {})
        .finally(() => {
          window.location.reload();
        });
    }
  }

  private handleReload = () => {
    const win = window as Window;
    if (win.caches) {
      win.caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => win.caches.delete(k))))
        .finally(() => win.location.reload());
      return;
    }
    win.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <p className="text-sm font-semibold text-zinc-100">
              Something went wrong. Tap to reload.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs rounded-xl transition-colors"
            >
              Something went wrong. Tap to reload.
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
