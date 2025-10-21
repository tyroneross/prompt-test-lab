/**
 * ZenFocusMockup Component
 * 
 * Ultra-minimal single-task interface mockup demonstrating:
 * - Single centered prompt input area
 * - Minimal navigation (just logo and user avatar)
 * - Large, readable typography
 * - Maximum whitespace
 * - Single action button
 */

import React, { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/utils';

export interface ZenFocusMockupProps {
  className?: string;
}

export const ZenFocusMockup: React.FC<ZenFocusMockupProps> = ({ className }) => {
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    // Simulate test run
    setTimeout(() => setIsRunning(false), 2000);
  };

  return (
    <div className={cn('min-h-screen bg-neutral-50', className)}>
      {/* Minimal Header */}
      <header className="flex items-center justify-between px-8 py-6 bg-white border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-lg font-semibold text-neutral-900">PromptLab</span>
        </div>
        
        <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center">
          <span className="text-neutral-600 font-medium text-sm">JD</span>
        </div>
      </header>

      {/* Main Content - Centered */}
      <main className="flex items-center justify-center min-h-[calc(100vh-88px)] px-8">
        <div className="w-full max-w-4xl mx-auto text-center space-y-12">
          
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">
              Test Your Prompt
            </h1>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
              Focus on what matters. Write your prompt, run your test, get results.
            </p>
          </div>

          {/* Prompt Input Area */}
          <div className="space-y-6">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Write your prompt here..."
                className={cn(
                  'w-full h-48 p-8 text-lg leading-relaxed',
                  'bg-white border-2 border-neutral-200 rounded-2xl',
                  'focus:border-primary-500 focus:ring-0 focus:outline-none',
                  'placeholder:text-neutral-400',
                  'resize-none transition-colors duration-200',
                  'shadow-sm hover:shadow-md'
                )}
                aria-label="Prompt input"
              />
            </div>

            {/* Single Action Button */}
            <div className="flex justify-center">
              <Button
                size="lg"
                loading={isRunning}
                disabled={!prompt.trim()}
                onClick={handleRun}
                className="px-12 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
              >
                {isRunning ? 'Running Test...' : 'Run Test'}
              </Button>
            </div>
          </div>

          {/* Status/Results Area (minimal) */}
          {isRunning && (
            <div className="bg-white rounded-xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                <span className="text-neutral-600">Testing your prompt...</span>
              </div>
            </div>
          )}

          {/* Minimal Stats (if test completed) */}
          {!isRunning && prompt && (
            <div className="text-center text-neutral-500 text-sm">
              Ready to test • Character count: {prompt.length}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ZenFocusMockup;