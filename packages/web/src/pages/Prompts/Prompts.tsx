/**
 * Prompts Page - Prompt Management
 * 
 * Main prompts library page for creating, editing, and managing prompts.
 * Implements the Studio layout variation with improved empty states and guidance.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon, Input } from '@/components/atoms';
import { Card, EmptyState } from '@/components/molecules';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';

const Prompts: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { isFirstTimeUser, hasBasicExperience, markPromptCreated } = useUserOnboarding();

  // Mock data - replace with actual prompts from API
  const prompts: any[] = []; // Empty for now to show empty state

  const handleCreatePrompt = () => {
    markPromptCreated();
    // TODO: Implement prompt creation form UI
    // Backend API exists at POST /projects/:projectId/prompts
    alert('Prompt creation form is under development. Backend API is ready and waiting!');
  };

  const handleBrowseTemplates = () => {
    // TODO: Implement template library UI
    alert('Template library UI is under development.');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Prompts</h1>
          <p className="text-neutral-600 mt-1">
            {isFirstTimeUser 
              ? "Create and manage your AI prompts for testing and optimization"
              : "Manage your prompt library and create new templates"
            }
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Icon name="plus" size="sm" />}
          onClick={handleCreatePrompt}
        >
          New Prompt
        </Button>
      </div>

      {/* Show empty state when no prompts exist */}
      {prompts.length === 0 ? (
        <EmptyState
          icon={<Icon name="file-text" size="xl" />}
          title={isFirstTimeUser ? "Create Your First Prompt" : "No Prompts Yet"}
          description={
            isFirstTimeUser
              ? "Start by creating your first prompt. You can write it from scratch or use one of our templates to get started quickly."
              : "Create your first prompt to begin testing and optimization. Choose from templates or start from scratch."
          }
          variant="onboarding"
          primaryAction={{
            label: "Create Prompt",
            onClick: handleCreatePrompt,
            icon: <Icon name="plus" size="sm" />
          }}
          secondaryAction={{
            label: "Browse Templates",
            onClick: handleBrowseTemplates,
            icon: <Icon name="book-open" size="sm" />
          }}
          helpText="Good prompts are specific, clear, and provide context for the AI to understand your intent."
        />
      ) : (
        <>
          {/* Search and filters - only show when there are prompts */}
          <div className="flex items-center gap-4 mb-6">
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Icon name="search" size="sm" />}
              className="flex-1 max-w-md"
            />
            <Button variant="ghost" leftIcon={<Icon name="filter" size="sm" />}>
              Filter
            </Button>
          </div>

          {/* Prompts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create new prompt card */}
            <Card 
              className="border-2 border-dashed border-primary-300 hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              onClick={handleCreatePrompt}
            >
              <div className="text-center py-8">
                <Icon name="plus" size="xl" className="text-primary-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 mb-2">
                  Create New Prompt
                </h3>
                <p className="text-neutral-600">
                  Start with a blank template or use a pre-built example
                </p>
              </div>
            </Card>

            {/* Existing prompts would be rendered here */}
            {prompts.map((prompt) => (
              <Card key={prompt.id} className="p-6">
                {/* Prompt card content */}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Prompts;