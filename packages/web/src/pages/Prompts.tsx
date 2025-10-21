/**
 * Prompts Page - Manage and create prompts
 */

import React from 'react';
import { Button, Icon } from '@/components/atoms';
import { Card } from '@/components/molecules/Card';

const Prompts: React.FC = () => {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Your Prompts</h2>
          <p className="text-sm text-neutral-600">Create and manage your prompt templates</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Icon name="plus" size="sm" />}
        >
          New Prompt
        </Button>
      </div>

      {/* Empty State */}
      <Card className="p-12 text-center">
        <div className="p-3 bg-primary-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Icon name="edit" size="lg" className="text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          No prompts yet
        </h3>
        <p className="text-neutral-600 mb-6 max-w-md mx-auto">
          Create your first prompt template to start testing with different LLM providers.
        </p>
        <Button
          variant="primary"
          leftIcon={<Icon name="plus" size="sm" />}
        >
          Create Your First Prompt
        </Button>
      </Card>
    </div>
  );
};

export default Prompts;