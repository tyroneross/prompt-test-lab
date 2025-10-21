/**
 * Settings Page - Application configuration
 */

import React from 'react';
import { Card } from '@/components/molecules/Card';
import { Icon } from '@/components/atoms';

const Settings: React.FC = () => {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Settings</h2>
        <p className="text-sm text-neutral-600">Manage your preferences and configurations</p>
      </div>

      {/* Settings Placeholder */}
      <Card className="p-8 text-center">
        <div className="p-3 bg-neutral-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Icon name="settings" size="lg" className="text-neutral-600" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          Settings coming soon
        </h3>
        <p className="text-neutral-600 max-w-md mx-auto">
          User preferences, API configurations, and billing settings will be available here.
        </p>
      </Card>
    </div>
  );
};

export default Settings;