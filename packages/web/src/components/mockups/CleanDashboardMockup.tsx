/**
 * CleanDashboardMockup Component
 * 
 * Desktop-focused A/B Testing dashboard with professional interface:
 * - Full-width layout optimized for desktop screens
 * - Standard density UI with comprehensive information display
 * - Side-by-side prompt comparison for efficient testing
 * - Rich data visualization and detailed results
 * - Professional workflow: Enter Prompts → Run Test → Analyze Results
 */

import React, { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/utils';

export interface CleanDashboardMockupProps {
  className?: string;
}

export const CleanDashboardMockup: React.FC<CleanDashboardMockupProps> = ({ className }) => {
  const [selectedProject, setSelectedProject] = useState('customer-support');
  const [promptA, setPromptA] = useState('');
  const [promptB, setPromptB] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployingPrompt, setDeployingPrompt] = useState<'A' | 'B' | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [deployedPrompts, setDeployedPrompts] = useState<Record<string, 'A' | 'B'>>({});
  const [showScoringSettings, setShowScoringSettings] = useState(false);
  const [scoringFactors, setScoringFactors] = useState({
    responseQuality: { enabled: true, weight: 40 },
    speed: { enabled: true, weight: 25 },
    tokenEfficiency: { enabled: true, weight: 15 },
    accuracy: { enabled: true, weight: 15 },
    userPreference: { enabled: false, weight: 5 }
  });

  // Mock data
  const projects = [
    { id: 'customer-support', name: 'Customer Support Bot', prompts: 12 },
    { id: 'content-gen', name: 'Content Generator', prompts: 8 },
    { id: 'data-analysis', name: 'Data Analysis Helper', prompts: 6 },
    { id: 'translation', name: 'Translation Service', prompts: 4 },
  ];

  const mockResults = {
    promptA: { score: 87, response: 'Hello! I\'d be happy to help you with your customer service inquiry. What specific issue can I assist you with today?' },
    promptB: { score: 92, response: 'Hi there! I\'m here to provide excellent customer support. Please tell me about the challenge you\'re facing and I\'ll do my best to resolve it quickly.' }
  };

  const handleRunABTest = () => {
    setIsRunning(true);
    setHasResults(false);
    setTimeout(() => {
      setIsRunning(false);
      setHasResults(true);
    }, 3000);
  };

  const handleDeployClick = (prompt: 'A' | 'B') => {
    setDeployingPrompt(prompt);
    setShowDeployModal(true);
    setDeploymentStatus('idle');
  };

  const handleDeployConfirm = (targetProjectId: string) => {
    if (!deployingPrompt) return;
    
    setDeploymentStatus('deploying');
    setShowDeployModal(false);
    
    // Simulate deployment
    setTimeout(() => {
      setDeployedPrompts(prev => ({
        ...prev,
        [targetProjectId]: deployingPrompt
      }));
      setDeploymentStatus('success');
      
      // Reset success state after 3 seconds
      setTimeout(() => {
        setDeploymentStatus('idle');
        setDeployingPrompt(null);
      }, 3000);
    }, 2000);
  };

  const handleModalClose = () => {
    setShowDeployModal(false);
    setDeployingPrompt(null);
    setDeploymentStatus('idle');
  };


  return (
    <div className={cn('flex h-screen bg-neutral-50', className)}>
      
      {/* Desktop Left Sidebar */}
      <aside className="w-80 bg-white border-r border-neutral-200 flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-lg font-semibold text-neutral-900">PromptLab</span>
          </div>
        </div>

        {/* Projects List */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="text-sm font-medium text-neutral-700 mb-4">
            Projects
          </h3>
          
          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-colors',
                  selectedProject === project.id
                    ? 'bg-primary-50 text-primary-900'
                    : 'text-neutral-700 hover:bg-neutral-50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-sm">
                    {project.name}
                  </div>
                  {deployedPrompts[project.id] && (
                    <div className={cn(
                      'w-5 h-5 rounded text-white font-bold text-xs flex items-center justify-center',
                      deployedPrompts[project.id] === 'A' ? 'bg-blue-500' : 'bg-green-500'
                    )}>
                      {deployedPrompts[project.id]}
                    </div>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  {project.prompts} prompts
                  {deployedPrompts[project.id] && (
                    <span className="ml-2 text-success-600">• Deployed</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Bar */}
        <header className="bg-white border-b border-neutral-200 px-8 py-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                A/B Prompt Testing
              </h1>
              <p className="text-neutral-600 mt-1">
                Compare two prompts side-by-side to find the best performer
              </p>
            </div>
            
            <div className="text-sm text-neutral-500">
              Project: <span className="font-medium text-neutral-700">
                {projects.find(p => p.id === selectedProject)?.name}
              </span>
            </div>
          </div>
          
          {/* Score Settings Banner */}
          <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-primary-900">Scoring Configuration</h3>
                <p className="text-sm text-primary-700">
                  Quality: {scoringFactors.responseQuality.weight}% • Speed: {scoringFactors.speed.weight}% • 
                  Efficiency: {scoringFactors.tokenEfficiency.weight}% • Accuracy: {scoringFactors.accuracy.weight}%
                  {scoringFactors.userPreference.enabled && ` • User Preference: ${scoringFactors.userPreference.weight}%`}
                </p>
              </div>
            </div>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowScoringSettings(true)}
              className="flex items-center gap-2 text-primary-700 hover:text-primary-800 border-primary-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure
            </Button>
          </div>
        </header>

        {/* Content Area - Desktop Optimized */}
        <div className="flex-1 overflow-y-auto bg-neutral-50">
          <div className="p-12">
            <div className="space-y-10">
            
            {/* Step 1: A/B Prompt Input */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
              <div className="p-6 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">
                      Enter Prompts for Comparison
                    </h2>
                    <p className="text-sm text-neutral-600">
                      Create two versions of your prompt to test which performs better
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Prompt A */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        A
                      </div>
                      <label className="text-sm font-medium text-neutral-700">
                        Prompt A (Control)
                      </label>
                    </div>
                    <textarea
                      value={promptA}
                      onChange={(e) => setPromptA(e.target.value)}
                      placeholder="Enter your baseline prompt here..."
                      className={cn(
                        'w-full h-64 p-6 text-base overflow-y-auto',
                        'border-2 border-blue-200 rounded-lg bg-blue-50/30',
                        'focus:border-blue-400 focus:bg-white focus:ring-0 focus:outline-none',
                        'placeholder:text-neutral-400',
                        'resize-none transition-all custom-scrollbar scrollbar-blue'
                      )}
                    />
                  </div>

                  {/* Prompt B */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded bg-green-100 text-green-700 font-bold text-xs flex items-center justify-center">
                        B
                      </div>
                      <label className="text-sm font-medium text-neutral-700">
                        Prompt B (Variant)
                      </label>
                    </div>
                    <textarea
                      value={promptB}
                      onChange={(e) => setPromptB(e.target.value)}
                      placeholder="Enter your alternative prompt here..."
                      className={cn(
                        'w-full h-64 p-6 text-base overflow-y-auto',
                        'border-2 border-green-200 rounded-lg bg-green-50/30',
                        'focus:border-green-400 focus:bg-white focus:ring-0 focus:outline-none',
                        'placeholder:text-neutral-400',
                        'resize-none transition-all custom-scrollbar scrollbar-green'
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Run Test */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                      2
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        Run A/B Test
                      </h2>
                      <p className="text-sm text-neutral-600">
                        Test both prompts against your dataset
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    size="lg"
                    loading={isRunning}
                    disabled={!promptA.trim() || !promptB.trim()}
                    onClick={handleRunABTest}
                    className="px-8 bg-primary-600 hover:bg-primary-700"
                  >
                    {isRunning ? 'Running A/B Test...' : 'Run A/B Test'}
                  </Button>
                </div>

                {isRunning && (
                  <div className="mt-6 bg-primary-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-5 h-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                      <span className="font-medium text-primary-900">Testing both prompts...</span>
                    </div>
                    <div className="flex justify-between text-sm text-primary-700 mb-2">
                      <span>Progress</span>
                      <span>Running comparison tests</span>
                    </div>
                    <div className="w-full bg-primary-200 rounded-full h-2">
                      <div className="bg-primary-600 h-2 rounded-full w-3/4 transition-all duration-1000" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Results */}
            {hasResults && (
              <div className="bg-white rounded-xl border border-neutral-200 shadow-lg">
                <div className="p-6 border-b border-neutral-200 bg-gradient-to-r from-primary-50 to-secondary-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-success-600 text-white font-bold text-sm flex items-center justify-center">
                      ✓
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-neutral-900">
                        A/B Test Results
                      </h2>
                      <p className="text-neutral-600">
                        Comparison complete - here's how your prompts performed
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Prompt A Results */}
                    <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-blue-500 text-white font-bold text-xs flex items-center justify-center">
                            A
                          </div>
                          <h3 className="font-semibold text-neutral-900">Prompt A Results</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">{mockResults.promptA.score}%</div>
                          <div className="text-xs text-neutral-600">Overall Score</div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="text-xs font-medium text-neutral-600 mb-2">Sample Response:</div>
                        <p className="text-sm text-neutral-800">{mockResults.promptA.response}</p>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Accuracy</span>
                          <span className="font-medium">85%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Response Time</span>
                          <span className="font-medium">1.2s</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">User Satisfaction</span>
                          <span className="font-medium">4.2/5</span>
                        </div>
                      </div>
                      
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeployClick('A')}
                        className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                        disabled={deploymentStatus === 'deploying'}
                      >
                        {deploymentStatus === 'deploying' && deployingPrompt === 'A' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                            Deploying...
                          </div>
                        ) : (
                          'Deploy Prompt A'
                        )}
                      </Button>
                    </div>

                    {/* Prompt B Results */}
                    <div className="border-2 border-green-200 rounded-lg p-6 bg-green-50/30 relative">
                      <div className="absolute -top-2 -right-2 bg-success-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        WINNER
                      </div>
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-green-500 text-white font-bold text-xs flex items-center justify-center">
                            B
                          </div>
                          <h3 className="font-semibold text-neutral-900">Prompt B Results</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">{mockResults.promptB.score}%</div>
                          <div className="text-xs text-neutral-600">Overall Score</div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="text-xs font-medium text-neutral-600 mb-2">Sample Response:</div>
                        <p className="text-sm text-neutral-800">{mockResults.promptB.response}</p>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Accuracy</span>
                          <span className="font-medium text-green-700">91% (+6%)</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Response Time</span>
                          <span className="font-medium text-green-700">1.1s (-0.1s)</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">User Satisfaction</span>
                          <span className="font-medium text-green-700">4.6/5 (+0.4)</span>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => handleDeployClick('B')}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        disabled={deploymentStatus === 'deploying'}
                      >
                        {deploymentStatus === 'deploying' && deployingPrompt === 'B' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Deploying...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>Deploy Winner</span>
                            <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center">
                              <span className="text-xs">★</span>
                            </div>
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-6 bg-neutral-50 rounded-lg p-4">
                    <h4 className="font-semibold text-neutral-900 mb-2">Recommendation</h4>
                    <p className="text-sm text-neutral-700">
                      <strong>Prompt B outperformed Prompt A by 5 percentage points.</strong> The alternative version 
                      shows better accuracy, faster response times, and higher user satisfaction. Consider using 
                      Prompt B as your new baseline.
                    </p>
                  </div>
                  
                  {/* Deployment Success Feedback */}
                  {deploymentStatus === 'success' && (
                    <div className="mt-6 bg-success-50 border border-success-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-success-500 text-white flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-success-900">
                            Prompt {deployingPrompt} Deployed Successfully!
                          </h4>
                          <p className="text-sm text-success-700">
                            Your prompt is now live in the selected project and ready to handle requests.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 flex gap-3">
                    <Button variant="secondary" size="md">
                      Run Another Test
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="md"
                      onClick={() => {
                        setHasResults(false);
                        setPromptA('');
                        setPromptB('');
                        setDeploymentStatus('idle');
                      }}
                    >
                      Start New Comparison
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </main>

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-8 h-8 rounded-full text-white font-bold text-sm flex items-center justify-center',
                  deployingPrompt === 'A' ? 'bg-blue-500' : 'bg-green-500'
                )}>
                  {deployingPrompt}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Deploy Prompt {deployingPrompt}
                  </h3>
                  <p className="text-sm text-neutral-600">
                    Select which project to deploy this prompt to
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="border border-neutral-200 rounded-lg p-4 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer group"
                    onClick={() => handleDeployConfirm(project.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-neutral-900 group-hover:text-primary-900">
                          {project.name}
                        </div>
                        <div className="text-sm text-neutral-600">
                          {project.prompts} existing prompts
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {deployedPrompts[project.id] && (
                          <div className="flex items-center gap-1 text-xs text-neutral-500">
                            <span>Current:</span>
                            <div className={cn(
                              'w-4 h-4 rounded text-white font-bold text-xs flex items-center justify-center',
                              deployedPrompts[project.id] === 'A' ? 'bg-blue-500' : 'bg-green-500'
                            )}>
                              {deployedPrompts[project.id]}
                            </div>
                          </div>
                        )}
                        
                        <svg className="w-5 h-5 text-neutral-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-neutral-50 rounded-b-xl">
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleModalClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scoring Settings Modal */}
      {showScoringSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900">
                      Scoring Configuration
                    </h3>
                    <p className="text-sm text-neutral-600">
                      Adjust how prompts are scored and compared
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowScoringSettings(false)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="text-md font-semibold text-neutral-900 mb-2">Scoring Factors</h4>
                <p className="text-sm text-neutral-600 mb-4">
                  Configure which factors contribute to the overall prompt score and their relative importance.
                </p>
                
                <div className="space-y-4">
                  {Object.entries(scoringFactors).map(([key, factor]) => {
                    const factorLabels = {
                      responseQuality: 'Response Quality',
                      speed: 'Speed/Latency',
                      tokenEfficiency: 'Token Efficiency',
                      accuracy: 'Accuracy',
                      userPreference: 'User Preference'
                    };
                    
                    const factorDescriptions = {
                      responseQuality: 'How well the response addresses the prompt',
                      speed: 'Response generation time and latency',
                      tokenEfficiency: 'Number of tokens used vs. response quality',
                      accuracy: 'Factual correctness and relevance',
                      userPreference: 'Manual user ratings and feedback'
                    };
                    
                    return (
                      <div key={key} className="border border-neutral-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={factor.enabled}
                                onChange={(e) => setScoringFactors(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key], enabled: e.target.checked }
                                }))}
                                className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500 focus:ring-2"
                              />
                              <span className="ml-2 font-medium text-neutral-900">
                                {factorLabels[key]}
                              </span>
                            </label>
                          </div>
                          
                          <div className="text-sm font-medium text-neutral-700">
                            {factor.weight}%
                          </div>
                        </div>
                        
                        <p className="text-xs text-neutral-600 mb-3">
                          {factorDescriptions[key]}
                        </p>
                        
                        {factor.enabled && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-neutral-500 w-12">0%</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={factor.weight}
                              onChange={(e) => setScoringFactors(prev => ({
                                ...prev,
                                [key]: { ...prev[key], weight: parseInt(e.target.value) }
                              }))}
                              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer slider"
                            />
                            <span className="text-xs text-neutral-500 w-12 text-right">100%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="bg-primary-50 rounded-lg p-4 mb-6">
                <h5 className="font-medium text-primary-900 mb-2">How Scoring Works</h5>
                <div className="text-sm text-primary-800 space-y-1">
                  <p>• Each factor is measured and given a score from 0-100</p>
                  <p>• Factor scores are weighted by their importance percentage</p>
                  <p>• The final score is the weighted average of all enabled factors</p>
                  <p>• The prompt with the higher total score is declared the winner</p>
                </div>
                
                <div className="mt-3 pt-3 border-t border-primary-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-primary-800">Total Weight:</span>
                    <span className="font-medium text-primary-900">
                      {Object.values(scoringFactors)
                        .filter(f => f.enabled)
                        .reduce((sum, f) => sum + f.weight, 0)}%
                    </span>
                  </div>
                  {Object.values(scoringFactors)
                    .filter(f => f.enabled)
                    .reduce((sum, f) => sum + f.weight, 0) !== 100 && (
                    <p className="text-xs text-amber-700 mt-1">
                      ⚠️ Weights don't sum to 100%. Scores will be normalized.
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-neutral-50 rounded-b-xl">
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    // Reset to defaults
                    setScoringFactors({
                      responseQuality: { enabled: true, weight: 40 },
                      speed: { enabled: true, weight: 25 },
                      tokenEfficiency: { enabled: true, weight: 15 },
                      accuracy: { enabled: true, weight: 15 },
                      userPreference: { enabled: false, weight: 5 }
                    });
                  }}
                  className="flex-1"
                >
                  Reset to Defaults
                </Button>
                <Button
                  size="md"
                  onClick={() => setShowScoringSettings(false)}
                  className="flex-1 bg-primary-600 hover:bg-primary-700"
                >
                  Apply Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanDashboardMockup;