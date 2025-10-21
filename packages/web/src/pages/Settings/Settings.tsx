/**
 * Settings Page - Application Configuration
 * 
 * Settings and configuration page for project settings,
 * user preferences, and system configuration.
 */

import React from 'react';
import { Button, Icon } from '@/components/atoms';
import { Card } from '@/components/molecules';

const Settings: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-neutral-600 mt-1">
          Manage your account, project settings, and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">
            Settings
          </h2>
          <div className="space-y-1">
            {[
              { id: 'general', label: 'General', icon: 'settings', active: true },
              { id: 'models', label: 'AI Models', icon: 'cpu', active: false },
              { id: 'billing', label: 'Billing', icon: 'database', active: false },
              { id: 'team', label: 'Team', icon: 'users', active: false },
              { id: 'integrations', label: 'Integrations', icon: 'zap', active: false },
              { id: 'security', label: 'Security', icon: 'lock', active: false },
            ].map((item) => (
              <button
                key={item.id}
                disabled={!item.active}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left rounded-md transition-colors ${
                  item.active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-neutral-400 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon name={item.icon as any} size="sm" className={item.active ? "text-blue-700" : "text-neutral-400"} />
                  <span className="text-sm font-medium">
                    {item.label}
                  </span>
                </div>
                {!item.active && (
                  <span className="text-xs text-amber-600">Soon</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-2">
          <Card title="General Settings">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-neutral-900 mb-4">
                  Project Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      defaultValue="AI Research Project"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      defaultValue="Research project for testing and optimizing AI prompts"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-6">
                <h3 className="text-lg font-medium text-neutral-900 mb-4">
                  Preferences
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">
                        Email Notifications
                      </label>
                      <p className="text-sm text-neutral-600">
                        Receive email updates about test completions
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 text-primary-600 focus:ring-primary-600 border-neutral-300 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">
                        Auto-save Prompts
                      </label>
                      <p className="text-sm text-neutral-600">
                        Automatically save prompt changes
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 text-primary-600 focus:ring-primary-600 border-neutral-300 rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-neutral-200">
                <Button
                  variant="ghost"
                  disabled={true}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={true}
                >
                  Save Changes
                </Button>
              </div>

              {/* Coming Soon Notice - Calm Precision Principle #9: Functional Integrity */}
              <div className="mt-4 border border-amber-500 bg-amber-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                    Coming Soon
                  </span>
                  <p className="text-sm text-amber-700">
                    Settings persistence requires backend integration. Interface is ready for when the API is connected.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;