/**
 * Test Creation View Component
 * 
 * Interface for creating and configuring A/B tests with multiple prompt variants
 */

import React, { useState } from 'react';
import { Plus, Trash2, Play, Save, Copy } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/molecules/Card';
import { toast } from 'sonner';

interface PromptVariant {
  id: string;
  name: string;
  content: string;
  description?: string;
}

interface TestConfig {
  name: string;
  description: string;
  testInput: string;
  variants: PromptVariant[];
  selectedModels: string[];
}

const AVAILABLE_MODELS = [
  { provider: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { provider: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  { provider: 'Groq', models: ['llama2-70b', 'mixtral-8x7b', 'gemma-7b'] },
];

export const TestCreationView: React.FC = () => {
  const [testConfig, setTestConfig] = useState<TestConfig>({
    name: '',
    description: '',
    testInput: '',
    variants: [
      { id: '1', name: 'Base Prompt', content: '', description: 'Original prompt' }
    ],
    selectedModels: ['gpt-4'],
  });

  const [isRunning, setIsRunning] = useState(false);

  const addVariant = () => {
    const newVariant: PromptVariant = {
      id: Date.now().toString(),
      name: `Variant ${testConfig.variants.length}`,
      content: '',
      description: '',
    };
    
    setTestConfig(prev => ({
      ...prev,
      variants: [...prev.variants, newVariant],
    }));
  };

  const removeVariant = (id: string) => {
    if (testConfig.variants.length <= 1) {
      toast.error('You must have at least one prompt variant');
      return;
    }
    
    setTestConfig(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id),
    }));
  };

  const duplicateVariant = (variant: PromptVariant) => {
    const newVariant: PromptVariant = {
      id: Date.now().toString(),
      name: `${variant.name} (Copy)`,
      content: variant.content,
      description: variant.description,
    };
    
    setTestConfig(prev => ({
      ...prev,
      variants: [...prev.variants, newVariant],
    }));
    
    toast.success('Variant duplicated');
  };

  const updateVariant = (id: string, updates: Partial<PromptVariant>) => {
    setTestConfig(prev => ({
      ...prev,
      variants: prev.variants.map(v => 
        v.id === id ? { ...v, ...updates } : v
      ),
    }));
  };

  const toggleModel = (model: string) => {
    setTestConfig(prev => ({
      ...prev,
      selectedModels: prev.selectedModels.includes(model)
        ? prev.selectedModels.filter(m => m !== model)
        : [...prev.selectedModels, model],
    }));
  };

  const validateConfig = (): boolean => {
    if (!testConfig.name.trim()) {
      toast.error('Please enter a test name');
      return false;
    }
    
    if (!testConfig.testInput.trim()) {
      toast.error('Please enter test input text');
      return false;
    }
    
    if (testConfig.variants.some(v => !v.content.trim())) {
      toast.error('All prompt variants must have content');
      return false;
    }
    
    if (testConfig.selectedModels.length === 0) {
      toast.error('Please select at least one model');
      return false;
    }
    
    return true;
  };

  const runTest = async () => {
    if (!validateConfig()) return;

    setIsRunning(true);
    try {
      // Backend integration required - API endpoint not yet implemented
      toast.error('Backend API required to run tests. Coming soon!');
    } catch (error) {
      toast.error('Failed to start test');
    } finally {
      setIsRunning(false);
    }
  };

  const saveTest = async () => {
    if (!validateConfig()) return;

    try {
      // Backend integration required - API endpoint not yet implemented
      toast.error('Backend API required to save tests. Coming soon!');
    } catch (error) {
      toast.error('Failed to save test configuration');
    }
  };

  // Backend API availability check
  const hasBackendAPI = false; // Set to true when backend is implemented

  return (
    <div className="space-y-6">
      {/* Test Configuration */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Name
            </label>
            <input
              type="text"
              value={testConfig.name}
              onChange={(e) => setTestConfig(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Newsletter Summary Optimization"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={testConfig.description}
              onChange={(e) => setTestConfig(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Describe the purpose of this test..."
            />
          </div>
        </div>
      </Card>

      {/* Test Input */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Test Input (Plain Text)</h2>
        <p className="text-sm text-gray-600 mb-4">
          This is the input that will be sent to each prompt variant
        </p>
        
        <textarea
          value={testConfig.testInput}
          onChange={(e) => setTestConfig(prev => ({ ...prev, testInput: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          rows={6}
          placeholder="Enter your test input here..."
        />
      </Card>

      {/* Prompt Variants */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Prompt Variants ({testConfig.variants.length})</h2>
          <Button
            variant="outline"
            size="small"
            onClick={addVariant}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Variant
          </Button>
        </div>
        
        <div className="space-y-4">
          {testConfig.variants.map((variant, index) => (
            <div key={variant.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    value={variant.name}
                    onChange={(e) => updateVariant(variant.id, { name: e.target.value })}
                    className="font-medium text-lg bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="Variant name..."
                  />
                  <input
                    type="text"
                    value={variant.description}
                    onChange={(e) => updateVariant(variant.id, { description: e.target.value })}
                    className="text-sm text-gray-600 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors mt-1 w-full"
                    placeholder="Brief description..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => duplicateVariant(variant)}
                    className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                    title="Duplicate variant"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {testConfig.variants.length > 1 && (
                    <button
                      onClick={() => removeVariant(variant.id)}
                      className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                      title="Remove variant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <textarea
                value={variant.content}
                onChange={(e) => updateVariant(variant.id, { content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={8}
                placeholder="Enter your prompt here..."
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Model Selection */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Select Models</h2>
        
        <div className="space-y-4">
          {AVAILABLE_MODELS.map(provider => (
            <div key={provider.provider}>
              <h3 className="font-medium text-gray-700 mb-2">{provider.provider}</h3>
              <div className="flex flex-wrap gap-2">
                {provider.models.map(model => (
                  <button
                    key={model}
                    onClick={() => toggleModel(model)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      testConfig.selectedModels.includes(model)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={saveTest}
          disabled={!hasBackendAPI}
          icon={<Save className="w-4 h-4" />}
        >
          Save Configuration
        </Button>
        <Button
          variant="primary"
          onClick={runTest}
          disabled={isRunning || !hasBackendAPI}
          icon={<Play className="w-4 h-4" />}
        >
          {isRunning ? 'Running Test...' : 'Run Test'}
        </Button>
      </div>

      {/* Coming Soon Notice - Calm Precision Principle #9: Functional Integrity */}
      {!hasBackendAPI && (
        <div className="border border-amber-500 bg-amber-50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
              Coming Soon
            </span>
            <p className="text-sm text-amber-700">
              Test execution requires backend integration. Interface is ready for when the API is connected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};