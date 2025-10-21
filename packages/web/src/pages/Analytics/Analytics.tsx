/**
 * Analytics Page - Performance Analytics
 * 
 * Analytics dashboard showing test performance, cost tracking,
 * and usage patterns with improved empty states and guidance.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon } from '@/components/atoms';
import { Card, Metric, EmptyState } from '@/components/molecules';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isFirstTimeUser, 
    hasBasicExperience, 
    hasCreatedPrompt, 
    hasRunTest, 
    markAnalyticsViewed 
  } = useUserOnboarding();

  React.useEffect(() => {
    markAnalyticsViewed();
  }, []);

  const hasData = hasRunTest; // Only show analytics if user has run tests

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
          <p className="text-neutral-600 mt-1">
            {!hasData 
              ? "Run some tests first to see your performance analytics"
              : "Track performance and optimize your prompt testing"
            }
          </p>
        </div>
        {hasData && (
          <Button
            variant="ghost"
            leftIcon={<Icon name="download" size="sm" />}
          >
            Export Report
          </Button>
        )}
      </div>

      {!hasData ? (
        <EmptyState
          icon={<Icon name="trending-up" size="xl" />}
          title={
            !hasCreatedPrompt 
              ? "No Data to Analyze Yet"
              : !hasRunTest 
              ? "Run Tests to See Analytics"
              : "No Test Data Available"
          }
          description={
            !hasCreatedPrompt
              ? "Analytics will show up here once you create prompts and run tests. Start by creating your first prompt to begin the testing journey."
              : !hasRunTest 
              ? "Run your first test to generate analytics data. You'll see performance metrics, success rates, and optimization insights here."
              : "Your analytics dashboard will display test performance, cost tracking, and usage patterns as you run more tests."
          }
          variant="default"
          primaryAction={
            !hasCreatedPrompt
              ? {
                  label: "Create First Prompt",
                  onClick: () => navigate('/prompts'),
                  icon: <Icon name="file-text" size="sm" />
                }
              : !hasRunTest
              ? {
                  label: "Run Your First Test",
                  onClick: () => navigate('/tests'),
                  icon: <Icon name="play" size="sm" />
                }
              : {
                  label: "View Tests",
                  onClick: () => navigate('/tests'),
                  icon: <Icon name="zap" size="sm" />
                }
          }
          helpText="Analytics help you understand which prompts perform best and optimize your AI interactions over time."
        />
      ) : (
        <>
          {/* Time Range Selector */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm font-medium text-neutral-700">Time Range:</span>
            <div className="flex gap-2">
              {['7d', '30d', '90d', '1y'].map((range) => (
                <Button
                  key={range}
                  variant={range === '30d' ? 'primary' : 'ghost'}
                  size="sm"
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>

          {/* Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Metric
              label="Total Tests Run"
              value={1247}
              change={{ value: 12, direction: 'up', positive: true, timeframe: 'vs last month' }}
              icon={<Icon name="zap" size="lg" />}
            />
            <Metric
              label="Success Rate"
              value="89.2%"
              change={{ value: 2.3, direction: 'up', positive: true, timeframe: 'vs last month' }}
              variant="success"
              icon={<Icon name="check-circle" size="lg" />}
            />
            <Metric
              label="Avg Response Time"
              value="1.4s"
              change={{ value: 0.2, direction: 'down', positive: true, timeframe: 'vs last month' }}
              icon={<Icon name="clock" size="lg" />}
            />
            <Metric
              label="Monthly Spend"
              value="$284.50"
              change={{ value: 15, direction: 'up', positive: false, timeframe: 'vs last month' }}
              variant="warning"
              icon={<Icon name="database" size="lg" />}
            />
          </div>

          {/* Charts Placeholder */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Test Volume Over Time" className="h-80">
              <div className="flex items-center justify-center h-full text-neutral-500">
                <div className="text-center">
                  <Icon name="zap" size="xl" className="mx-auto mb-2" />
                  <p>Chart visualization coming soon</p>
                </div>
              </div>
            </Card>

            <Card title="Model Performance" className="h-80">
              <div className="flex items-center justify-center h-full text-neutral-500">
                <div className="text-center">
                  <Icon name="cpu" size="xl" className="mx-auto mb-2" />
                  <p>Chart visualization coming soon</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;