/**
 * Welcome Onboarding Component - First-time User Experience
 * 
 * Provides step-by-step guidance for new users to understand
 * the application's purpose and get started with their first prompt test.
 */

import React, { useState } from 'react';
import { Button, Icon } from '@/components/atoms';
import { Card } from '@/components/molecules';
import { cn } from '@/utils';

interface WelcomeOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

const onboardingSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Prompt Testing Lab',
    description: 'Test and optimize your AI prompts with confidence. Compare different versions, track performance, and find the best prompts for your needs.',
    icon: <Icon name="zap" size="xl" />,
    primaryAction: 'Get Started',
    content: (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
          <Icon name="zap" size="xl" className="text-primary-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-3">
            Welcome to Prompt Testing Lab
          </h2>
          <p className="text-lg text-neutral-600 max-w-md mx-auto">
            Test and optimize your AI prompts with confidence. Compare different versions, track performance, and find the best prompts for your needs.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'how-it-works',
    title: 'How It Works',
    description: 'Three simple steps to better prompts',
    icon: <Icon name="play" size="xl" />,
    primaryAction: 'Continue',
    content: (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-neutral-900 text-center mb-6">
          Three Simple Steps to Better Prompts
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="file-text" size="lg" className="text-primary-600" />
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">1. Create Prompts</h3>
            <p className="text-sm text-neutral-600">
              Write and organize your AI prompts in our editor
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="zap" size="lg" className="text-success-600" />
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">2. Run Tests</h3>
            <p className="text-sm text-neutral-600">
              Compare different versions with A/B/C testing
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="trending-up" size="lg" className="text-warning-600" />
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">3. Analyze Results</h3>
            <p className="text-sm text-neutral-600">
              Track performance and optimize your prompts
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'getting-started',
    title: 'Ready to Start?',
    description: 'Choose how you want to begin your prompt testing journey',
    icon: <Icon name="arrow-right" size="xl" />,
    primaryAction: 'Create First Prompt',
    content: (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-neutral-900 mb-3">
            Ready to Start Testing?
          </h2>
          <p className="text-neutral-600">
            Choose how you want to begin your prompt testing journey
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6 border-2 border-dashed border-primary-300 hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer">
            <div className="text-center">
              <Icon name="plus" size="lg" className="text-primary-600 mx-auto mb-4" />
              <h3 className="font-semibold text-neutral-900 mb-2">Start from Scratch</h3>
              <p className="text-sm text-neutral-600">
                Create your first prompt and begin testing
              </p>
            </div>
          </Card>
          <Card className="p-6 border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="text-center">
              <Icon name="book-open" size="lg" className="text-neutral-600 mx-auto mb-4" />
              <h3 className="font-semibold text-neutral-900 mb-2">Browse Examples</h3>
              <p className="text-sm text-neutral-600">
                Explore template prompts to get inspired
              </p>
            </div>
          </Card>
        </div>
      </div>
    )
  }
];

export const WelcomeOnboarding: React.FC<WelcomeOnboardingProps> = ({
  onComplete,
  onSkip
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = onboardingSteps[currentStep];

  const handleNext = () => {
    if (currentStep === onboardingSteps.length - 1) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-4">
            {onboardingSteps.map((_, index) => (
              <React.Fragment key={index}>
                <div
                  className={cn(
                    'w-3 h-3 rounded-full transition-colors',
                    index <= currentStep
                      ? 'bg-primary-600'
                      : 'bg-neutral-300'
                  )}
                />
                {index < onboardingSteps.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5 mx-2 transition-colors',
                      index < currentStep
                        ? 'bg-primary-600'
                        : 'bg-neutral-300'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-center text-sm text-neutral-500">
            Step {currentStep + 1} of {onboardingSteps.length}
          </p>
        </div>

        {/* Step content */}
        <Card className="p-8 mb-6">
          {step.content}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button
                variant="ghost"
                onClick={handlePrevious}
                leftIcon={<Icon name="arrow-left" size="sm" />}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-neutral-600"
            >
              Skip Tour
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              rightIcon={
                currentStep === onboardingSteps.length - 1 ? (
                  <Icon name="check" size="sm" />
                ) : (
                  <Icon name="arrow-right" size="sm" />
                )
              }
            >
              {step.primaryAction}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

WelcomeOnboarding.displayName = 'WelcomeOnboarding';