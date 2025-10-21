/**
 * MockupShowcase Component
 * 
 * A showcase component that allows switching between different UI mockup variations.
 * Demonstrates three distinct design approaches for the prompt testing lab interface.
 */

import React, { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/utils';
import ZenFocusMockup from './ZenFocusMockup';
import CleanDashboardMockup from './CleanDashboardMockup';
import MobileFirstMockup from './MobileFirstMockup';

export interface MockupShowcaseProps {
  className?: string;
  /** Default mockup to show */
  defaultMockup?: 'zen' | 'dashboard' | 'mobile';
}

type MockupType = 'zen' | 'dashboard' | 'mobile';

interface MockupInfo {
  id: MockupType;
  name: string;
  description: string;
  features: string[];
  component: React.ComponentType<any>;
  preview: string;
}

const mockups: MockupInfo[] = [
  {
    id: 'zen',
    name: 'Zen Focus',
    description: 'Ultra-minimal single-task interface for distraction-free prompt testing',
    features: [
      'Single centered prompt input',
      'Maximum whitespace',
      'Large readable typography',
      'Minimal navigation',
      'Single action focus'
    ],
    component: ZenFocusMockup,
    preview: 'Centered, minimal, distraction-free'
  },
  {
    id: 'dashboard',
    name: 'Clean Dashboard',
    description: 'Balanced two-panel layout with comprehensive project management',
    features: [
      'Dual-panel layout',
      'Project navigation sidebar',
      'Clean card-based design',
      'Subtle borders and shadows',
      'Clear information hierarchy'
    ],
    component: CleanDashboardMockup,
    preview: 'Professional, organized, comprehensive'
  },
  {
    id: 'mobile',
    name: 'Mobile First',
    description: 'Single-column responsive design optimized for mobile devices',
    features: [
      'Vertical stack layout',
      'Collapsible sections',
      'Touch-friendly controls',
      'Bottom navigation',
      'Mobile-optimized spacing'
    ],
    component: MobileFirstMockup,
    preview: 'Mobile-optimized, touch-friendly'
  }
];

export const MockupShowcase: React.FC<MockupShowcaseProps> = ({ 
  className,
  defaultMockup = 'zen'
}) => {
  const [activeMockup, setActiveMockup] = useState<MockupType>(defaultMockup);
  const [showControls, setShowControls] = useState(true);

  const currentMockup = mockups.find(m => m.id === activeMockup);
  const MockupComponent = currentMockup?.component;

  return (
    <div className={cn('relative w-full h-screen overflow-hidden bg-neutral-100', className)}>
      
      {/* Controls Overlay */}
      {showControls && (
        <div className="absolute top-4 left-4 right-4 z-50 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-neutral-200 shadow-lg p-4">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-lg font-semibold text-neutral-900">
                    UI Mockup Showcase
                  </h1>
                  <p className="text-sm text-neutral-600">
                    Explore three different interface approaches
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowControls(false)}
                    className="text-neutral-500 hover:text-neutral-700"
                  >
                    Hide Controls
                  </Button>
                </div>
              </div>

              {/* Mockup Selector */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {mockups.map((mockup) => (
                  <button
                    key={mockup.id}
                    onClick={() => setActiveMockup(mockup.id)}
                    className={cn(
                      'text-left p-4 rounded-lg border-2 transition-all',
                      'hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                      activeMockup === mockup.id
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-neutral-900">
                        {mockup.name}
                      </h3>
                      {activeMockup === mockup.id && (
                        <Badge className="bg-primary-100 text-primary-700 border-primary-200 text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-neutral-600 mb-3">
                      {mockup.description}
                    </p>
                    
                    <div className="text-xs text-neutral-500 italic">
                      {mockup.preview}
                    </div>
                  </button>
                ))}
              </div>

              {/* Current Mockup Info */}
              {currentMockup && (
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium text-neutral-700">
                      Key Features:
                    </span>
                    {currentMockup.features.map((feature, index) => (
                      <Badge
                        key={index}
                        className="bg-neutral-100 text-neutral-700 border-neutral-200 text-xs"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Show Controls Button (when hidden) */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className={cn(
            'absolute top-4 left-4 z-50',
            'bg-white/95 backdrop-blur-sm rounded-lg border border-neutral-200 shadow-lg',
            'px-3 py-2 text-sm font-medium text-neutral-700',
            'hover:bg-white hover:shadow-xl transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary-500'
          )}
        >
          Show Controls
        </button>
      )}

      {/* Mockup Display */}
      <div className="w-full h-full">
        {MockupComponent && (
          <MockupComponent />
        )}
      </div>

      {/* Device Frame Indicators (optional) */}
      {activeMockup === 'mobile' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Mobile frame indicator */}
          <div className="hidden sm:block absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[375px] h-[812px] border-8 border-neutral-800 rounded-[2.5rem] shadow-2xl pointer-events-none" />
        </div>
      )}
    </div>
  );
};

export default MockupShowcase;