/**
 * Magic Link Sent Page
 * Confirmation page after requesting a magic link
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/molecules/Card';
import { toast } from 'sonner';
import { Mail, CheckCircle } from 'lucide-react';

export default function MagicLinkSentPage() {
  const [searchParams] = useSearchParams();
  const { requestMagicLink } = useAuth();
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const email = searchParams.get('email') || '';

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;

    setIsResending(true);
    try {
      await requestMagicLink(email);
      toast.success('Magic link sent again!');
      setCooldown(30); // 30 second cooldown
    } catch (error: any) {
      if (error.message?.includes('not yet implemented')) {
        toast.error('Magic link authentication coming soon!');
      } else {
        toast.error(error.message || 'Failed to resend magic link');
      }
    } finally {
      setIsResending(false);
    }
  };

  // Redirect if no email
  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4">
        <Card padding="lg" className="max-w-md w-full text-center">
          <p className="text-neutral-600 mb-4">No email address provided</p>
          <Link to="/login">
            <Button variant="primary" size="lg" fullWidth>
              Back to Login
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card padding="lg" className="max-w-md w-full">
        <div className="text-center">
          {/* Success Icon - Calm Precision: Large icon for visual hierarchy */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success-100 mb-6">
            <Mail size={32} className="text-success-600" />
          </div>

          {/* Three-line hierarchy: Title → Description → Details */}
          <h1 className="text-3xl font-bold text-neutral-900 mb-3">
            Check your email!
          </h1>

          <p className="text-base text-neutral-700 mb-2">
            We sent a magic link to
          </p>

          <p className="text-base font-semibold text-primary-700 mb-6">
            {email}
          </p>

          {/* Instructions */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <CheckCircle size={18} className="text-success-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-neutral-700">
                <p className="font-medium mb-1">Click the link in your email to sign in</p>
                <p className="text-xs text-neutral-600">
                  The link expires in 15 minutes
                </p>
              </div>
            </div>
          </div>

          {/* Resend Button */}
          <Button
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            loading={isResending}
            variant="outline"
            size="lg"
            fullWidth
            className="mb-4"
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : isResending
                ? 'Sending...'
                : 'Resend magic link'
            }
          </Button>

          {/* Help Text - Progressive Disclosure */}
          <details className="text-left mt-6">
            <summary className="text-sm text-neutral-600 cursor-pointer hover:text-neutral-900 font-medium">
              Didn't receive it?
            </summary>
            <div className="mt-3 text-sm text-neutral-600 space-y-2 pl-4">
              <p>• Check your spam or junk folder</p>
              <p>• Make sure you entered the correct email</p>
              <p>• Wait a few minutes for the email to arrive</p>
              <p>• Click "Resend magic link" to try again</p>
            </div>
          </details>

          {/* Back to Login */}
          <div className="mt-8 pt-6 border-t border-neutral-200">
            <Link
              to="/login"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              ← Back to login
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
