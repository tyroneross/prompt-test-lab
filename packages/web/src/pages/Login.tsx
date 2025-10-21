/**
 * Login Page Component
 * Magic Link-First Authentication with Demo Mode Fallback
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Card } from '@/components/molecules/Card';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

export default function LoginPage() {
  const { requestMagicLink, isLoading, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSending(true);
    try {
      await requestMagicLink(email);
      // Navigate to confirmation page
      navigate(`/magic-link-sent?email=${encodeURIComponent(email)}`);
    } catch (error: any) {
      // Backend not implemented yet - show helpful error
      if (error.message?.includes('not yet implemented')) {
        toast.error('Magic link authentication coming soon! Please use demo mode for now.');
      } else {
        toast.error(error.message || 'Failed to send magic link');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    try {
      await loginAsDemo();
      toast.success('Welcome to the demo! Explore all features.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to start demo mode');
    } finally {
      setIsDemoLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header - Three-line hierarchy: Title → Description → Link */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-neutral-900">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Enter your email to receive a magic link
          </p>
        </div>


        <Card padding="lg">
          {/* Magic Link Form */}
          <form onSubmit={handleMagicLinkSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                size="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                leftIcon={<Mail size={18} />}
                disabled={isSending}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSending}
              disabled={isSending}
            >
              {isSending ? 'Sending magic link...' : 'Send Magic Link'}
            </Button>
          </form>

          {/* Demo Mode Section - Calm Precision: Principle #3 separator */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <p className="text-sm text-neutral-600 text-center mb-4">
              Just exploring?
            </p>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleDemoLogin}
              disabled={isDemoLoading || isSending}
              loading={isDemoLoading}
            >
              {isDemoLoading ? 'Starting demo...' : 'Continue as Demo User'}
            </Button>
            <p className="text-xs text-neutral-500 text-center mt-3">
              No account required • Explore all features • Demo data only
            </p>
          </div>

          {/* Optional: Link to register (if needed) */}
          <div className="mt-6 text-center text-sm text-neutral-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
              Create one
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}