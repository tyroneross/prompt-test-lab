/**
 * Dashboard Page - Main landing page after login
 * 
 * Shows overview of prompts, tests, and analytics with
 * clear guidance for new users.
 */

import React from 'react';
import { Button, Icon } from '@/components/atoms';
import { Card } from '@/components/molecules/Card';

const Dashboard: React.FC = () => {
  return (
    <div className="p-4 space-y-4">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg p-6 border border-primary-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary-900 mb-2">
              Welcome to Prompt Testing Lab
            </h2>
            <p className="text-primary-700 text-sm">
              Test, compare, and optimize your prompts across multiple LLM providers.
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Icon name="plus" size="sm" />}
          >
            Create First Prompt
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Total Prompts</p>
              <p className="text-2xl font-bold text-neutral-900">0</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Icon name="file-text" size="md" className="text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Active Tests</p>
              <p className="text-2xl font-bold text-neutral-900">0</p>
            </div>
            <div className="p-3 bg-success-100 rounded-lg">
              <Icon name="zap" size="md" className="text-success-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">This Month</p>
              <p className="text-2xl font-bold text-neutral-900">$0.00</p>
            </div>
            <div className="p-3 bg-warning-100 rounded-lg">
              <Icon name="dollar-sign" size="md" className="text-warning-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Getting Started */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">
          Getting Started
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-neutral-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-100 rounded-lg flex-shrink-0">
                <Icon name="edit" size="sm" className="text-primary-600" />
              </div>
              <div>
                <h4 className="font-medium text-neutral-900 mb-1">
                  Create Your First Prompt
                </h4>
                <p className="text-sm text-neutral-600 mb-3">
                  Start by creating a prompt to test across different LLM providers.
                </p>
                <Button variant="outline" size="sm">
                  Create Prompt
                </Button>
              </div>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-success-100 rounded-lg flex-shrink-0">
                <Icon name="play" size="sm" className="text-success-600" />
              </div>
              <div>
                <h4 className="font-medium text-neutral-900 mb-1">
                  Run A/B Tests
                </h4>
                <p className="text-sm text-neutral-600 mb-3">
                  Compare different versions of your prompts to find the best performing one.
                </p>
                <Button variant="outline" size="sm" disabled>
                  Start Testing
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;