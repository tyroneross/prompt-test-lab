/**
 * Main App Component
 * 
 * Root application component that sets up routing, error boundaries,
 * and global providers for the Prompt Testing Lab.
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'sonner';

// Contexts
import { AuthProvider } from '@/contexts/AuthContext';

// Layout Components
import { MainLayout } from '@/components/templates';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Page Components (lazy loaded)
const LoginPage = React.lazy(() => import('@/pages/Login'));
const RegisterPage = React.lazy(() => import('@/pages/Register'));
const MagicLinkSentPage = React.lazy(() => import('@/pages/MagicLinkSent'));
const VerifyMagicLinkPage = React.lazy(() => import('@/pages/VerifyMagicLink'));
const DashboardPage = React.lazy(() => import('@/pages/Dashboard'));
const PromptsPage = React.lazy(() => import('@/pages/Prompts'));
const TestsPage = React.lazy(() => import('@/pages/Tests'));
const AnalyticsPage = React.lazy(() => import('@/pages/Analytics'));
const SettingsPage = React.lazy(() => import('@/pages/Settings'));

// Fallback Components
import { LoadingSpinner } from '@/components/atoms/LoadingSpinner';
import { ErrorFallback } from '@/components/templates/ErrorFallback';

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        }>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/magic-link-sent" element={<MagicLinkSentPage />} />
            <Route path="/verify" element={<VerifyMagicLinkPage />} />

            {/* Protected Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="prompts" element={<PromptsPage />} />
              <Route path="tests" element={<TestsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;