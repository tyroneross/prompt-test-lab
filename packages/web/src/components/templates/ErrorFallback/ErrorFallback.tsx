/**
 * ErrorFallback Component - Error Boundary Fallback
 * 
 * A user-friendly error page that displays when JavaScript errors occur.
 * Includes recovery options and error reporting capabilities.
 */

import React from 'react';
import { Button, Icon } from '@/components/atoms';
import { Card } from '@/components/molecules';

export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center" padding="lg">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mb-4">
            <Icon name="alert-circle" size="xl" className="text-error-600" />
          </div>
          
          <h1 className="text-xl font-bold text-neutral-900 mb-2">
            Something went wrong
          </h1>
          
          <p className="text-neutral-600">
            We apologize for the inconvenience. An unexpected error has occurred.
          </p>
        </div>

        {/* Error details (for development) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm font-medium text-neutral-700 mb-2">
              Error Details
            </summary>
            <pre className="text-xs text-error-600 bg-error-50 p-3 rounded border overflow-auto">
              {error.message}
              {error.stack && '\n\n' + error.stack}
            </pre>
          </details>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            onClick={resetErrorBoundary}
            variant="primary"
            fullWidth
            leftIcon={<Icon name="play" size="sm" />}
          >
            Try Again
          </Button>
          
          <div className="flex gap-3">
            <Button
              onClick={handleReload}
              variant="secondary"
              fullWidth
              leftIcon={<Icon name="download" size="sm" />}
            >
              Reload Page
            </Button>
            
            <Button
              onClick={handleGoHome}
              variant="ghost"
              fullWidth
              leftIcon={<Icon name="home" size="sm" />}
            >
              Go Home
            </Button>
          </div>
        </div>

        {/* Support information */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-xs text-neutral-500">
            If this problem persists, please contact our support team.
          </p>
        </div>
      </Card>
    </div>
  );
};

ErrorFallback.displayName = 'ErrorFallback';