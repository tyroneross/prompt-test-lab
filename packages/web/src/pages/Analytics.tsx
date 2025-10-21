/**
 * Analytics Page - Performance insights and metrics
 */

import React from 'react';
import { Card } from '@/components/molecules/Card';
import { Icon } from '@/components/atoms';

const Analytics: React.FC = () => {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Analytics</h2>
        <p className="text-sm text-neutral-600">Performance insights and test metrics</p>
      </div>

      {/* Empty State */}
      <Card className="p-12 text-center">
        <div className="p-3 bg-primary-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Icon name="bar-chart" size="lg" className="text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          No analytics data yet
        </h3>
        <p className="text-neutral-600 mb-4 max-w-md mx-auto">
          Run some prompt tests to see performance insights and analytics here.
        </p>
        <p className="text-sm text-neutral-500">
          Create prompts and run tests to unlock analytics features.
        </p>
      </Card>
    </div>
  );
};

export default Analytics;