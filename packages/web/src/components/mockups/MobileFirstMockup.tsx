/**
 * MobileFirstMockup Component
 * 
 * Single-column responsive design mockup demonstrating:
 * - Vertical stack layout optimized for mobile
 * - Collapsible sections for efficient space usage
 * - Touch-friendly controls with proper sizing
 * - Bottom navigation bar for key actions
 * - Responsive design that scales up for larger screens
 */

import React, { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/utils';

export interface MobileFirstMockupProps {
  className?: string;
}

export const MobileFirstMockup: React.FC<MobileFirstMockupProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState('test');
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('prompt');

  // Mock data
  const recentTests = [
    { id: 1, name: 'Basic greeting', status: 'passed', score: 95, time: '2m ago' },
    { id: 2, name: 'Complex query', status: 'failed', score: 62, time: '1h ago' },
    { id: 3, name: 'Edge cases', status: 'passed', score: 88, time: '3h ago' },
  ];

  const projects = [
    { id: 1, name: 'Customer Support', tests: 24, status: 'active' },
    { id: 2, name: 'Content Generator', tests: 12, status: 'draft' },
    { id: 3, name: 'Data Analysis', tests: 8, status: 'active' },
  ];

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 3000);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-success-100 text-success-700 border-success-200';
      case 'failed': return 'bg-error-100 text-error-700 border-error-200';
      case 'active': return 'bg-success-100 text-success-700 border-success-200';
      case 'draft': return 'bg-warning-100 text-warning-700 border-warning-200';
      default: return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  return (
    <div className={cn('flex flex-col h-screen bg-neutral-50', className)}>
      
      {/* Mobile Header */}
      <header className="bg-white border-b border-neutral-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">PromptLab</h1>
              <p className="text-xs text-neutral-600">Customer Support Bot</p>
            </div>
          </div>
          
          <button className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-neutral-300" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        
        {/* Test Tab Content */}
        {activeTab === 'test' && (
          <div className="p-4 space-y-4">
            
            {/* Prompt Section - Collapsible */}
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
              <button
                onClick={() => toggleSection('prompt')}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <h2 className="font-semibold text-neutral-900">Prompt</h2>
                  <p className="text-sm text-neutral-600">Configure your test prompt</p>
                </div>
                <div className={cn(
                  'w-5 h-5 text-neutral-400 transition-transform',
                  expandedSection === 'prompt' ? 'rotate-180' : ''
                )}>
                  ▼
                </div>
              </button>
              
              {expandedSection === 'prompt' && (
                <div className="px-4 pb-4 space-y-4">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter your prompt to test..."
                    className={cn(
                      'w-full h-32 p-3 text-sm',
                      'bg-neutral-50 border border-neutral-200 rounded-lg',
                      'focus:bg-white focus:border-primary-300 focus:ring-0 focus:outline-none',
                      'placeholder:text-neutral-400',
                      'resize-none'
                    )}
                  />
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Model
                      </label>
                      <select className="w-full p-3 border border-neutral-200 rounded-lg bg-white text-sm">
                        <option>GPT-4</option>
                        <option>GPT-3.5 Turbo</option>
                        <option>Claude 3</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test Configuration - Collapsible */}
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
              <button
                onClick={() => toggleSection('config')}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <h2 className="font-semibold text-neutral-900">Test Configuration</h2>
                  <p className="text-sm text-neutral-600">Choose test cases and settings</p>
                </div>
                <div className={cn(
                  'w-5 h-5 text-neutral-400 transition-transform',
                  expandedSection === 'config' ? 'rotate-180' : ''
                )}>
                  ▼
                </div>
              </button>
              
              {expandedSection === 'config' && (
                <div className="px-4 pb-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Test Cases
                    </label>
                    <select className="w-full p-3 border border-neutral-200 rounded-lg bg-white text-sm">
                      <option>All test cases (24)</option>
                      <option>Critical tests only (8)</option>
                      <option>Custom selection</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-neutral-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-neutral-900">24</div>
                      <div className="text-xs text-neutral-600">Test Cases</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-neutral-900">~2m</div>
                      <div className="text-xs text-neutral-600">Est. Time</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Results Section */}
            {isRunning && (
              <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">Running Tests</h3>
                    <p className="text-sm text-neutral-600">Testing 24 cases...</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>Progress</span>
                    <span>15/24 completed</span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div className="bg-primary-600 h-2 rounded-full transition-all duration-500" style={{ width: '62%' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Run Button */}
            <div className="px-2">
              <Button
                size="lg"
                fullWidth
                loading={isRunning}
                disabled={!prompt.trim()}
                onClick={handleRun}
                className="h-14 text-lg font-semibold"
              >
                {isRunning ? 'Running Tests...' : 'Run Tests'}
              </Button>
            </div>
          </div>
        )}

        {/* History Tab Content */}
        {activeTab === 'history' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Recent Tests</h2>
              <Badge className="bg-neutral-100 text-neutral-600 border-neutral-200">
                {recentTests.length} tests
              </Badge>
            </div>
            
            <div className="space-y-3">
              {recentTests.map((test) => (
                <div key={test.id} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-neutral-900">{test.name}</h3>
                      <p className="text-sm text-neutral-600">{test.time}</p>
                    </div>
                    <Badge className={cn('text-xs border ml-2', getStatusColor(test.status))}>
                      {test.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                    <span className="text-sm text-neutral-600">Score: {test.score}%</span>
                    <button className="text-primary-600 text-sm font-medium">View Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects Tab Content */}
        {activeTab === 'projects' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Projects</h2>
              <button className="text-primary-600 text-sm font-medium">+ New</button>
            </div>
            
            <div className="space-y-3">
              {projects.map((project) => (
                <div key={project.id} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-neutral-900">{project.name}</h3>
                      <p className="text-sm text-neutral-600">{project.tests} tests</p>
                    </div>
                    <Badge className={cn('text-xs border ml-2', getStatusColor(project.status))}>
                      {project.status}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 px-3 bg-neutral-50 text-neutral-700 rounded-lg text-sm font-medium">
                      View Tests
                    </button>
                    <button className="flex-1 py-2 px-3 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
                      Open Project
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-2 z-20">
        <div className="flex items-center justify-around">
          {[
            { key: 'test', label: 'Test', icon: '🧪' },
            { key: 'history', label: 'History', icon: '📊' },
            { key: 'projects', label: 'Projects', icon: '📁' },
            { key: 'settings', label: 'Settings', icon: '⚙️' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-3 rounded-lg min-w-0 flex-1 max-w-20',
                'transition-colors touch-manipulation',
                activeTab === tab.key
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-50'
              )}
            >
              <span className="text-lg" role="img" aria-label={tab.label}>
                {tab.icon}
              </span>
              <span className="text-xs font-medium truncate">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default MobileFirstMockup;