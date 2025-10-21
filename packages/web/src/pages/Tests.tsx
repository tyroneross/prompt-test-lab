/**
 * Tests Page Component
 * 
 * Displays test history, running tests, and test creation interface.
 */

import React, { useState } from 'react';
import { Plus, History, Play } from 'lucide-react';
import { TestCreationView } from '@/components/views/TestCreationView';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/molecules/Card';

type TabView = 'create' | 'running' | 'history';

const TestsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>('create');

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Prompt Testing Lab</h1>
        <p className="text-gray-600 mt-2">Create and run A/B tests to optimize your prompts</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'create'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Test
          </div>
        </button>
        <button
          onClick={() => setActiveTab('running')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'running'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4" />
            Running Tests
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'history'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Test History
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'create' && <TestCreationView />}
        
        {activeTab === 'running' && (
          <Card className="p-6">
            <div className="text-center py-12">
              <Play className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Running Tests</h3>
              <p className="text-gray-600 mb-4">Create a new test to get started</p>
              <Button variant="primary" onClick={() => setActiveTab('create')}>
                Create Test
              </Button>
            </div>
          </Card>
        )}
        
        {activeTab === 'history' && (
          <Card className="p-6">
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Test History</h3>
              <p className="text-gray-600">Your completed tests will appear here</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestsPage;