import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorPageProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

const ErrorPage = ({ error, resetErrorBoundary }: ErrorPageProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <AlertCircle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-4xl font-bold text-foreground mb-2">Oops! Something went wrong</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        We encountered an unexpected error. Please try reloading the page.
      </p>
      {error && (
        <div className="bg-muted p-4 rounded-md text-sm font-mono text-left mb-6 max-w-lg w-full overflow-auto max-h-40">
           {error.message}
        </div>
      )}
      <div className="flex gap-4">
        {resetErrorBoundary ? (
             <Button onClick={resetErrorBoundary}>Try Again</Button>
        ) : (
             <Button onClick={() => window.location.reload()}>Reload Page</Button>
        )}
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Go Home
        </Button>
      </div>
    </div>
  );
};

export default ErrorPage;
