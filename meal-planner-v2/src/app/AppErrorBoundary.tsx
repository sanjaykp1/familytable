import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Family Table render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error">
          <span className="eyebrow">Something went wrong</span>
          <h1>Your meals are still on this device.</h1>
          <p>
            Reload the app to try again. If the problem continues, export a backup from Settings.
          </p>
          <Button onClick={() => window.location.reload()}>Reload app</Button>
        </main>
      );
    }
    return this.props.children;
  }
}
