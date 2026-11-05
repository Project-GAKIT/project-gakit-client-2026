'use client';

import { AlertCircle, Home, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string | number;
  onRetry?: () => void;
  showHomeButton?: boolean;
  showRetryButton?: boolean;
}

export function ErrorState({
  title = 'Something Went Wrong',
  message = 'An unexpected error occurred. Please try again.',
  code,
  onRetry,
  showHomeButton = true,
  showRetryButton = true,
}: ErrorStateProps) {
  const router = useRouter();

  const handleHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="bg-panel rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="bg-error-bg rounded-full p-4">
            <AlertCircle className="w-8 h-8 text-hazard-critical" />
          </div>
        </div>

        {/* Error Code */}
        {code && (
          <div className="text-sm font-semibold text-hazard-critical bg-error-bg rounded-lg py-2 px-3">
            Error {code}
          </div>
        )}

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-primary mb-2">
            {title}
          </h1>
          <p className="text-secondary">
            {message}
          </p>
        </div>

        {/* Details for debugging (in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-muted rounded-lg p-3 text-left">
            <p className="text-xs font-mono text-secondary">
              {title} {code ? `(${code})` : ''}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {showRetryButton && onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-3 px-6 rounded-lg font-semibold text-on-accent bg-accent hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          )}

          {showHomeButton && (
            <button
              onClick={handleHome}
              className="w-full py-3 px-6 rounded-lg font-semibold text-secondary border-2 border-strong hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="pt-4 border-t border-default">
          <p className="text-xs text-muted-foreground">
            If the problem persists, please contact support at support@gakit.ph
          </p>
        </div>
      </div>
    </div>
  );
}
