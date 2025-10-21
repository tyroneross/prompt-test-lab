/**
 * Tests Page - Test Management
 * 
 * A/B/C test configuration and execution page.
 * Implements the Workflow layout variation with improved guidance and empty states.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon } from '@/components/atoms';
import { Card, EmptyState } from '@/components/molecules';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';

const Tests: React.FC = () => {
  const navigate = useNavigate();
  const { isFirstTimeUser, hasBasicExperience, hasCreatedPrompt, markTestRun } = useUserOnboarding();

  const handleCreateTest = () => {
    if (!hasCreatedPrompt) {
      // Guide user to create prompts first
      navigate('/prompts');
      return;
    }
    markTestRun();
    // TODO: Implement test creation form UI
    // Backend API exists at POST /projects/:projectId/test-runs
    alert('Test creation form is under development. Backend API is ready and waiting!');
  };

  const handleCreatePromptFirst = () => {
    navigate('/prompts');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Tests</h1>
          <p className="text-neutral-600 mt-1">
            {!hasCreatedPrompt 
              ? "Create prompts first, then run A/B/C tests to compare performance"
              : "Create and manage A/B/C tests for your prompts"
            }
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Icon name="play" size="sm" />}
          onClick={handleCreateTest}
          disabled={!hasCreatedPrompt}
        >
          New Test
        </Button>
      </div>

      {!hasCreatedPrompt ? (
        <EmptyState
          icon={<Icon name="alert-circle" size="xl" />}
          title="Create Prompts First"
          description="You need to create some prompts before you can run tests. Prompts are the different versions of text you want to compare against each other."
          variant="default"
          primaryAction={{
            label: "Create Your First Prompt",
            onClick: handleCreatePromptFirst,
            icon: <Icon name="plus" size="sm" />
          }}
          helpText="Once you have multiple prompts, you can test them against each other to see which performs best."
        />
      ) : (
        <EmptyState
          icon={<Icon name="zap" size="xl" />}
          title={isFirstTimeUser ? "Ready to Test Your Prompts?" : "No Tests Yet"}
          description={
            isFirstTimeUser
              ? "Compare different versions of your prompts to see which one works best. A/B testing helps you optimize performance and find the most effective wording."
              : "Create your first test to start comparing prompt performance. You can test different versions, models, or parameters."
          }
          variant="onboarding"
          primaryAction={{
            label: "Create Test",
            onClick: handleCreateTest,
            icon: <Icon name="plus" size="sm" />
          }}
          secondaryAction={{
            label: "Learn About Testing",
            onClick: () => {
              // Documentation link - to be implemented
              window.open('https://docs.example.com/testing', '_blank');
            },
            icon: <Icon name="book-open" size="sm" />
          }}
          helpText="Pro tip: Start with simple A/B tests comparing two prompt versions, then gradually explore more complex testing scenarios."
        />
      )}
    </div>
  );
};

export default Tests;