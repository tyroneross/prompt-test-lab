/**
 * Verify Magic Link Page
 * Auto-verifies magic link token and authenticates user
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/molecules/Card';
import { LoadingSpinner } from '@/components/atoms/LoadingSpinner';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

type VerifyStatus = 'loading' | 'success' | 'error';

export default function VerifyMagicLinkPage() {
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchParams] = useSearchParams();
  const { verifyMagicLink } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    // Validate required parameters
    if (!token || !email) {
      setStatus('error');
      setErrorMessage('Invalid magic link. Token or email is missing.');
      return;
    }

    // Verify the magic link
    const verify = async () => {
      try {
        await verifyMagicLink(token, email);
        setStatus('success');
        // Auth context will handle navigation to dashboard
        // Add small delay for user to see success message
        setTimeout(() => {
          // Navigation is handled by AuthContext, but we can ensure it here too
          navigate('/dashboard');
        }, 1500);
      } catch (error: any) {
        setStatus('error');

        // Handle specific error cases
        if (error.message?.includes('not yet implemented')) {
          setErrorMessage('Magic link authentication is not yet available. The backend endpoints are still being implemented.');
        } else if (error.message?.includes('expired')) {
          setErrorMessage('This magic link has expired. Please request a new one.');
        } else if (error.message?.includes('invalid')) {
          setErrorMessage('This magic link is invalid. Please request a new one.');
        } else {
          setErrorMessage(error.message || 'Failed to verify magic link. Please try again.');
        }
      }
    };

    verify();
  }, [searchParams, verifyMagicLink, navigate]);

  // Loading State
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4">
        <Card padding="lg" className="max-w-md w-full">
          <div className="text-center">
            <LoadingSpinner size="large" className="mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              Verifying your magic link...
            </h2>
            <p className="text-sm text-neutral-600">
              Please wait while we sign you in
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Success State
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4">
        <Card padding="lg" className="max-w-md w-full">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success-100 mb-6">
              <CheckCircle size={32} className="text-success-600" />
            </div>

            {/* Three-line hierarchy */}
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              Success!
            </h2>
            <p className="text-base text-neutral-600 mb-4">
              You're being redirected to your dashboard...
            </p>

            {/* Manual redirect button if auto-redirect fails */}
            <div className="mt-6">
              <Link to="/dashboard">
                <Button variant="primary" size="lg" fullWidth>
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Error State
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4">
      <Card padding="lg" className="max-w-md w-full">
        <div className="text-center">
          {/* Error Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-error-100 mb-6">
            <XCircle size={32} className="text-error-600" />
          </div>

          {/* Three-line hierarchy */}
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Verification Failed
          </h2>
          <p className="text-base text-neutral-700 mb-6">
            {errorMessage}
          </p>

          {/* Backend not ready warning */}
          {errorMessage.includes('not yet available') && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-medium mb-1">Feature Coming Soon</p>
                  <p className="text-xs text-amber-700">
                    The backend API endpoints for magic link authentication are still being developed.
                    Please use demo mode to explore the application.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Link to="/login">
              <Button variant="primary" size="lg" fullWidth>
                Request New Magic Link
              </Button>
            </Link>

            <Link to="/login">
              <Button variant="outline" size="lg" fullWidth>
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
