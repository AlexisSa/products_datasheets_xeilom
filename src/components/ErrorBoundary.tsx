import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <p className="text-destructive font-medium">
            Une erreur est survenue lors de l'affichage.
          </p>
          <p className="text-sm text-muted-foreground">
            {this.state.error?.message}
          </p>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Réessayer
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
