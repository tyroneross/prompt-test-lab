/**
 * Dashboard Page - Main Overview
 * 
 * Primary dashboard showing recent activity, quick actions,
 * and key metrics. Implements the Dashboard layout variation
 * from the UI specifications with first-time user onboarding.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, Icon } from '@/components/atoms';
import { Card, Metric, EmptyState } from '@/components/molecules';
import { WelcomeOnboarding } from '@/components/organisms/WelcomeOnboarding';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';

// Mock data
const mockMetrics = [
  {
    label: 'Success Rate',
    value: '89%',
    change: { value: 5, direction: 'up' as const, positive: true, timeframe: 'last week' },
    variant: 'success' as const,
    icon: <Icon name="check-circle" size="lg" />,
  },
  {
    label: 'Total Tests',
    value: 1247,
    change: { value: 12, direction: 'up' as const, positive: true, timeframe: 'last week' },
    icon: <Icon name="zap" size="lg" />,
  },
  {
    label: 'Monthly Cost',
    value: '$156.80',
    unit: '',
    change: { value: 8, direction: 'up' as const, positive: false, timeframe: 'last month' },
    variant: 'warning' as const,
    icon: <Icon name="database" size="lg" />,
  },
  {
    label: 'Active Prompts',
    value: 24,
    change: { value: 3, direction: 'up' as const, positive: true, timeframe: 'last week' },
    icon: <Icon name="file-text" size="lg" />,
  },
];

const mockRecentActivity = [
  {
    id: '1',
    type: 'test-completed',
    title: 'Content Analysis Test',
    description: '3 variants × 2 models × 5 samples',
    result: 'Winner: Variant B (93% success)',
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    status: 'completed',
  },
  {
    id: '2',
    type: 'test-running',
    title: 'Prompt Tuning',
    description: '8/10 tests complete',
    result: null,
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    status: 'running',
  },
  {
    id: '3',
    type: 'prompt-created',
    title: 'Email Classifier v2.1',
    description: 'Created by Sarah Chen',
    result: null,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'created',
  },
];

const mockPrompts = [
  { id: '1', name: 'Summarizer v1.2', status: 'active' },
  { id: '2', name: 'Categorizer v2.1', status: 'active' },
  { id: '3', name: 'Formatter v1.0', status: 'active' },
  { id: '4', name: 'Custom Analysis', status: 'draft' },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    shouldShowWelcome, 
    isFirstTimeUser, 
    hasBasicExperience, 
    completeOnboarding, 
    skipOnboarding,
    markPromptCreated 
  } = useUserOnboarding();

  // Show welcome onboarding for first-time users
  if (shouldShowWelcome) {
    return (
      <WelcomeOnboarding 
        onComplete={() => {
          completeOnboarding();
          navigate('/prompts');
        }}
        onSkip={() => {
          skipOnboarding();
        }}
      />
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'test-completed':
        return <Icon name="check-circle" size="sm" className="text-success-600" />;
      case 'test-running':
        return <Icon name="clock" size="sm" className="text-warning-600" />;
      case 'prompt-created':
        return <Icon name="file-text" size="sm" className="text-primary-600" />;
      default:
        return <Icon name="info" size="sm" className="text-neutral-600" />;
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 24 * 60) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / (24 * 60))}d ago`;
  };

  const handleCreatePrompt = () => {
    markPromptCreated();
    navigate('/prompts');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Demo Mode Banner - Calm Precision Principle #9: Functional Integrity */}
      <div className="border-2 border-amber-500 bg-amber-50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-amber-900 mb-1">Demo Mode</h4>
            <p className="text-sm text-amber-700">
              You're viewing sample data. Connect to a backend to see real metrics and activity.
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic header based on user experience */}
      <div className="flex items-center justify-between">
        <div>
          {isFirstTimeUser ? (
            <>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                Get Started with Prompt Testing 🚀
              </h1>
              <p className="text-neutral-600">
                Create your first prompt and start optimizing your AI interactions.
              </p>
            </>
          ) : hasBasicExperience ? (
            <>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                Welcome back! 👋
              </h1>
              <p className="text-neutral-600">
                Here's what's happening with your prompt testing today.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                Ready to Test? 🎯
              </h1>
              <p className="text-neutral-600">
                You have prompts ready. Start testing to see which performs best.
              </p>
            </>
          )}
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            leftIcon={<Icon name="file-text" size="sm" />}
            onClick={handleCreatePrompt}
          >
            New Prompt
          </Button>
          <Button
            variant="primary"
            leftIcon={<Icon name="play" size="sm" />}
            onClick={() => navigate('/tests')}
          >
            {hasBasicExperience ? 'Quick Test' : 'Start Testing'}
          </Button>
        </div>
      </div>

      {/* Key Metrics - Only show for users with data */}
      {hasBasicExperience && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {mockMetrics.map((metric, index) => (
            <Metric
              key={index}
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              change={metric.change}
              variant={metric.variant}
              icon={metric.icon}
            />
          ))}
        </div>
      )}

      {/* First-time user guidance */}
      {isFirstTimeUser && (
        <EmptyState
          icon={<Icon name="zap" size="xl" />}
          title="Start Your Prompt Testing Journey"
          description="Create your first prompt to begin testing and optimizing your AI interactions. Compare different versions, track performance, and find what works best."
          variant="onboarding"
          primaryAction={{
            label: 'Create First Prompt',
            onClick: handleCreatePrompt,
            icon: <Icon name="plus" size="sm" />
          }}
          secondaryAction={{
            label: 'Learn More',
            onClick: () => navigate('/prompts'),
            icon: <Icon name="book-open" size="sm" />
          }}
          helpText="Pro tip: Start with a simple task like text summarization to get familiar with the process."
        />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card
          title="Recent Activity"
          className="lg:col-span-2"
          actions={
            <Button variant="ghost" size="sm" disabled={true}>
              View All
            </Button>
          }
        >
          <div className="space-y-4">
            {mockRecentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4 p-4 border border-neutral-200 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-neutral-900 truncate">
                      {activity.title}
                    </h4>
                    <span className="text-xs text-neutral-500 ml-2">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mb-1">
                    {activity.description}
                  </p>
                  {activity.result && (
                    <p className="text-sm font-medium text-success-700">
                      {activity.result}
                    </p>
                  )}
                  {activity.status === 'running' && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-full bg-neutral-200 rounded-full h-2">
                        <div className="bg-primary-600 h-2 rounded-full w-4/5 animate-pulse" />
                      </div>
                      <span className="text-xs text-neutral-500">80%</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div className="space-y-3">
              <Button
                variant="ghost"
                fullWidth
                leftIcon={<Icon name="play" size="sm" />}
                className="justify-start"
                disabled={true}
              >
                Run Last Test
                <span className="ml-auto text-xs text-amber-600">Coming Soon</span>
              </Button>
              <Button
                variant="ghost"
                fullWidth
                leftIcon={<Icon name="file-text" size="sm" />}
                className="justify-start"
                onClick={handleCreatePrompt}
              >
                Create New Prompt
              </Button>
              <Button
                variant="ghost"
                fullWidth
                leftIcon={<Icon name="zap" size="sm" />}
                className="justify-start"
                onClick={() => navigate('/analytics')}
              >
                View Analytics
              </Button>
              <Button
                variant="ghost"
                fullWidth
                leftIcon={<Icon name="settings" size="sm" />}
                className="justify-start"
                onClick={() => navigate('/settings')}
              >
                Project Settings
              </Button>
            </div>
          </Card>

          {/* Active Prompts */}
          <Card
            title="Your Prompts"
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/prompts')}>
                View All
              </Button>
            }
          >
            <div className="space-y-3">
              {mockPrompts.map((prompt) => (
                <div key={prompt.id} className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Icon name="file-text" size="sm" className="text-neutral-600" />
                    <span className="text-sm font-medium text-neutral-900">
                      {prompt.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      prompt.status === 'active' 
                        ? 'bg-success-100 text-success-800'
                        : 'bg-neutral-100 text-neutral-800'
                    }`}>
                      {prompt.status}
                    </span>
                    <Button variant="ghost" size="sm" disabled={true}>
                      <Icon name="more-horizontal" size="sm" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                variant="ghost"
                fullWidth
                leftIcon={<Icon name="plus" size="sm" />}
                className="justify-start border-2 border-dashed border-neutral-300 hover:border-primary-300 hover:bg-primary-50"
                onClick={handleCreatePrompt}
              >
                Create New Prompt
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;