/**
 * DeployReview Component - Organism Level
 * 
 * A sophisticated deployment review interface inspired by the v0 deploy page.
 * Features side-by-side comparisons, impact analysis, and deployment controls.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../../molecules/Card';
import { 
  Button, 
  Badge, 
  Alert, 
  AlertTitle, 
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Label
} from '../../atoms';
import { 
  Zap, 
  Code, 
  FileText, 
  Target, 
  DollarSign, 
  Crown, 
  Check, 
  AlertTriangle, 
  RotateCcw 
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface DeployVariant {
  id: number;
  label: string;
  prompt: string;
  score: number;
}

export interface DeployApp {
  id: string;
  name: string;
  version: string;
}

export interface UserData {
  name: string;
  canDeploy: boolean;
  email: string;
}

export interface CostData {
  thisMonth: number;
  limit: number;
  lastTest: number;
}

export interface OutputComparison {
  current: string;
  new: string;
}

export interface DeployReviewProps {
  selectedVariant: DeployVariant;
  currentPrompt: string;
  outputs: OutputComparison;
  userData: UserData;
  apps: DeployApp[];
  costData: CostData;
  impactPercentage?: number;
  onDeploy: (appId: string) => void;
  onUndo?: () => void;
  className?: string;
}

export const DeployReview: React.FC<DeployReviewProps> = ({
  selectedVariant,
  currentPrompt,
  outputs,
  userData,
  apps,
  costData,
  impactPercentage = 47,
  onDeploy,
  onUndo,
  className
}) => {
  const [selectedApp, setSelectedApp] = useState(apps[0]?.name || '');
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [undoTimer, setUndoTimer] = useState<number | null>(null);

  const handleDeploy = () => {
    const selectedAppData = apps.find(app => app.name === selectedApp);
    if (selectedAppData) {
      onDeploy(selectedAppData.id);
      setDeploySuccess(true);
      setUndoTimer(300); // 5 minutes
      setTimeout(() => setDeploySuccess(false), 8000);
    }
  };

  // Countdown timer for undo
  useEffect(() => {
    if (undoTimer && undoTimer > 0) {
      const timer = setTimeout(() => setUndoTimer(undoTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [undoTimer]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Success Toast */}
      {deploySuccess && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <Alert variant="success">
            <Check className="h-4 w-4" />
            <AlertTitle>Deployment Successful!</AlertTitle>
            <AlertDescription>
              v{apps.find(a => a.name === selectedApp)?.version} deployed successfully. 
              {undoTimer && onUndo && (
                <>
                  <div className="mt-2">
                    Undo available for {formatTime(undoTimer)}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={onUndo}>
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Undo
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setDeploySuccess(false)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold">Deploy Review</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge
            variant={costData.thisMonth > costData.limit * 0.8 ? 'error' : 'neutral'}
            className="flex items-center gap-1"
          >
            <DollarSign className="h-3 w-3" />
            ${costData.thisMonth}/${costData.limit}
          </Badge>

          {userData.canDeploy && (
            <Badge className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Builder
            </Badge>
          )}
        </div>
      </div>

      {/* Impact Warning */}
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>High Impact Deployment</AlertTitle>
        <AlertDescription>
          This deployment will change ~{impactPercentage}% of outputs. Review the changes carefully before proceeding.
        </AlertDescription>
      </Alert>

      {/* App Selection */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Deploy to:</Label>
          <Select value={selectedApp} onValueChange={setSelectedApp}>
            <SelectTrigger className="w-48">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {apps.map((app) => (
                <SelectItem key={app.id} value={app.name}>
                  {app.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="primary">
            {apps.find((a) => a.name === selectedApp)?.version || "v1.0.0"}
          </Badge>
        </div>
      </Card>

      {/* Deploy Preview */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">
                {selectedApp} → v{apps.find(a => a.name === selectedApp)?.version}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Deploying {selectedVariant.label} (Score: {selectedVariant.score}%) as new base prompt
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Impact Preview
              </p>
              <p className="text-sm text-gray-600">
                ~{impactPercentage}% output change detected
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Prompt Changes */}
            <Card>
              <div className="p-4 border-b">
                <h3 className="text-base font-medium flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Prompt Changes
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Current ({apps.find(a => a.name === selectedApp)?.version})
                    </Label>
                    <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <pre className="text-sm font-mono whitespace-pre-wrap text-red-900">
                        {currentPrompt}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      New (v{apps.find(a => a.name === selectedApp)?.version})
                    </Label>
                    <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <pre className="text-sm font-mono whitespace-pre-wrap text-green-900">
                        {selectedVariant.prompt}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Output Preview */}
            <Card>
              <div className="p-4 border-b">
                <h3 className="text-base font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Output Preview
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Current Output
                    </Label>
                    <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-sm whitespace-pre-wrap text-red-900">
                        {outputs.current}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      New Output
                    </Label>
                    <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm whitespace-pre-wrap text-green-900">
                        {outputs.new}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Card>

      {/* Deploy Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleDeploy}
          className="bg-green-600 hover:bg-green-700"
          size="lg"
          disabled={!userData.canDeploy}
        >
          <Zap className="mr-2 h-5 w-5" />
          Deploy v{apps.find(a => a.name === selectedApp)?.version}
        </Button>
      </div>
    </div>
  );
};