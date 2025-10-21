/**
 * User Onboarding Hook
 * 
 * Manages user onboarding state, first-time experience,
 * and progressive feature discovery.
 */

import { useState, useEffect } from 'react';

interface UserOnboardingState {
  hasCompletedOnboarding: boolean;
  hasCreatedPrompt: boolean;
  hasRunTest: boolean;
  hasViewedAnalytics: boolean;
  showWelcome: boolean;
  currentFeatureSpotlight?: string;
}

const ONBOARDING_STORAGE_KEY = 'prompt-lab-onboarding';

const defaultState: UserOnboardingState = {
  hasCompletedOnboarding: false,
  hasCreatedPrompt: false,
  hasRunTest: false,
  hasViewedAnalytics: false,
  showWelcome: true,
  currentFeatureSpotlight: undefined,
};

export const useUserOnboarding = () => {
  const [state, setState] = useState<UserOnboardingState>(defaultState);
  const [loading, setLoading] = useState(true);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (saved) {
        const parsedState = JSON.parse(saved);
        setState({ ...defaultState, ...parsedState });
      }
    } catch (error) {
      console.warn('Failed to load onboarding state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to save onboarding state:', error);
      }
    }
  }, [state, loading]);

  const updateState = (updates: Partial<UserOnboardingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const completeOnboarding = () => {
    updateState({ 
      hasCompletedOnboarding: true,
      showWelcome: false 
    });
  };

  const skipOnboarding = () => {
    updateState({ 
      hasCompletedOnboarding: true,
      showWelcome: false 
    });
  };

  const markPromptCreated = () => {
    updateState({ hasCreatedPrompt: true });
  };

  const markTestRun = () => {
    updateState({ hasRunTest: true });
  };

  const markAnalyticsViewed = () => {
    updateState({ hasViewedAnalytics: true });
  };

  const setFeatureSpotlight = (feature: string | undefined) => {
    updateState({ currentFeatureSpotlight: feature });
  };

  const resetOnboarding = () => {
    setState(defaultState);
  };

  // Computed values
  const isFirstTimeUser = !state.hasCompletedOnboarding;
  const shouldShowWelcome = state.showWelcome && isFirstTimeUser;
  const hasBasicExperience = state.hasCreatedPrompt || state.hasRunTest;
  const progressPercentage = [
    state.hasCompletedOnboarding,
    state.hasCreatedPrompt,
    state.hasRunTest,
    state.hasViewedAnalytics,
  ].filter(Boolean).length * 25;

  return {
    // State
    state,
    loading,
    
    // Computed values
    isFirstTimeUser,
    shouldShowWelcome,
    hasBasicExperience,
    progressPercentage,
    
    // Actions
    completeOnboarding,
    skipOnboarding,
    markPromptCreated,
    markTestRun,
    markAnalyticsViewed,
    setFeatureSpotlight,
    resetOnboarding,
    updateState,
  };
};