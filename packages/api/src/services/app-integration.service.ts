import { PrismaClient } from '../generated/client';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { ProjectService } from './project.service';
import { PromptService } from './prompt.service';
import { ImpactAnalysisService } from './impact-analysis.service';
import type { 
  AppIntegrationConfig,
  PromptSyncRequest,
  PromptSyncResponse,
  DependencyUpdate,
  IntegrationStatus
} from '@prompt-lab/shared';

const prisma = new PrismaClient();

export interface MainAppConnection {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  type: 'langsmith' | 'direct_api' | 'webhook';
  isActive: boolean;
  lastSync?: Date;
  syncConfig: {
    autoSync: boolean;
    syncInterval: number; // minutes
    bidirectional: boolean;
    promptFilters?: {
      tags?: string[];
      projects?: string[];
      environments?: string[];
    };
  };
}

export interface PromptDeploymentTarget {
  appId: string;
  environment: 'staging' | 'production' | 'development';
  endpoint: string;
  deploymentStrategy: 'immediate' | 'scheduled' | 'approval_required';
  rollbackConfig?: {
    enabled: boolean;
    strategy: 'automatic' | 'manual';
    criteria: {
      errorThreshold?: number;
      performanceThreshold?: number;
    };
  };
}

/**
 * Service for integrating Prompt Testing Lab with main applications
 */
export class AppIntegrationService {
  /**
   * Register a main application for integration
   */
  static async registerApp(
    userId: string,
    projectId: string,
    config: AppIntegrationConfig
  ): Promise<MainAppConnection> {
    // Validate user permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to register applications');
    }

    // Validate connection to the main app
    await this.validateAppConnection(config);

    // Store the app configuration
    const appConnection = await prisma.appIntegration.create({
      data: {
        projectId,
        name: config.name,
        type: config.type,
        baseUrl: config.baseUrl,
        apiKeyHash: await this.hashApiKey(config.apiKey),
        syncConfig: config.syncConfig,
        isActive: true,
        createdBy: userId
      }
    });

    return {
      id: appConnection.id,
      name: appConnection.name,
      baseUrl: appConnection.baseUrl,
      apiKey: '[REDACTED]',
      type: appConnection.type as any,
      isActive: appConnection.isActive,
      syncConfig: appConnection.syncConfig as any
    };
  }

  /**
   * Pull prompts from the main application
   */
  static async pullPromptsFromApp(
    userId: string,
    projectId: string,
    appId: string,
    options: {
      environment?: string;
      tags?: string[];
      forceSync?: boolean;
    } = {}
  ): Promise<PromptSyncResponse> {
    const appConnection = await this.getAppConnection(projectId, appId);
    
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole) {
      throw new AuthorizationError('Access denied to project');
    }

    try {
      // Connect to main app based on type
      const remotePrompts = await this.fetchRemotePrompts(appConnection, options);
      
      const syncResults = {
        pulled: 0,
        updated: 0,
        conflicts: [] as Array<{
          promptId: string;
          name: string;
          reason: string;
        }>
      };

      for (const remotePrompt of remotePrompts) {
        try {
          // Check if prompt already exists locally
          const existingPrompt = await prisma.prompt.findFirst({
            where: {
              projectId,
              metadata: {
                path: ['remoteId'],
                equals: remotePrompt.id
              }
            }
          });

          if (existingPrompt) {
            // Check for conflicts
            if (existingPrompt.content !== remotePrompt.content && 
                existingPrompt.updatedAt > new Date(remotePrompt.lastModified)) {
              syncResults.conflicts.push({
                promptId: existingPrompt.id,
                name: existingPrompt.name,
                reason: 'Local changes conflict with remote updates'
              });
              continue;
            }

            // Update existing prompt
            await PromptService.updatePrompt(existingPrompt.id, userId, {
              content: remotePrompt.content,
              description: remotePrompt.description,
              tags: remotePrompt.tags,
              metadata: {
                ...existingPrompt.metadata,
                remoteId: remotePrompt.id,
                lastSync: new Date().toISOString(),
                remoteSource: appId
              }
            });
            syncResults.updated++;
          } else {
            // Create new prompt
            await PromptService.createPrompt(projectId, userId, {
              name: remotePrompt.name,
              content: remotePrompt.content,
              description: remotePrompt.description,
              tags: remotePrompt.tags,
              metadata: {
                remoteId: remotePrompt.id,
                lastSync: new Date().toISOString(),
                remoteSource: appId,
                environment: remotePrompt.environment
              }
            });
            syncResults.pulled++;
          }
        } catch (error) {
          console.error(`Error syncing prompt ${remotePrompt.name}:`, error);
          syncResults.conflicts.push({
            promptId: remotePrompt.id,
            name: remotePrompt.name,
            reason: `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      // Update last sync timestamp
      await prisma.appIntegration.update({
        where: { id: appId },
        data: { lastSync: new Date() }
      });

      return {
        success: true,
        ...syncResults,
        syncedAt: new Date()
      };

    } catch (error) {
      console.error('Error pulling prompts from app:', error);
      throw new ValidationError(`Failed to pull prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Push tested prompts back to main application
   */
  static async pushPromptsToApp(
    userId: string,
    projectId: string,
    appId: string,
    promptIds: string[],
    targetEnvironment: string,
    options: {
      performImpactAnalysis?: boolean;
      requireApproval?: boolean;
      scheduleDeployment?: Date;
    } = {}
  ): Promise<PromptSyncResponse> {
    const appConnection = await this.getAppConnection(projectId, appId);
    
    // Check deployment permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions for deployment');
    }

    const deploymentResults = {
      deployed: 0,
      failed: 0,
      pending: 0,
      errors: [] as Array<{
        promptId: string;
        name: string;
        error: string;
      }>
    };

    for (const promptId of promptIds) {
      try {
        const prompt = await PromptService.getPromptById(promptId, userId);
        
        // Perform impact analysis if requested
        if (options.performImpactAnalysis && prompt.metadata?.remoteId) {
          const analysis = await ImpactAnalysisService.performImpactAnalysis(
            userId,
            projectId,
            {
              promptId: promptId,
              baselinePromptId: prompt.metadata.remoteId as string,
              modelConfig: {
                provider: 'openai',
                modelName: 'gpt-4',
                temperature: 0.7,
                maxTokens: 1000
              }
            }
          );

          // If impact is too high, require manual approval
          if (analysis.impactPercentage > 50 && !options.requireApproval) {
            deploymentResults.pending++;
            await this.createApprovalRequest(userId, projectId, promptId, appId, analysis);
            continue;
          }
        }

        // Deploy to main application
        const deploymentResult = await this.deployPromptToApp(
          appConnection,
          prompt,
          targetEnvironment,
          options.scheduleDeployment
        );

        if (deploymentResult.success) {
          deploymentResults.deployed++;
          
          // Update prompt metadata with deployment info
          await PromptService.updatePrompt(promptId, userId, {
            metadata: {
              ...prompt.metadata,
              deployments: {
                ...((prompt.metadata?.deployments as any) || {}),
                [targetEnvironment]: {
                  deployedAt: new Date().toISOString(),
                  deploymentId: deploymentResult.deploymentId,
                  version: deploymentResult.version
                }
              }
            }
          });
        } else {
          deploymentResults.failed++;
          deploymentResults.errors.push({
            promptId,
            name: prompt.name,
            error: deploymentResult.error || 'Unknown deployment error'
          });
        }

      } catch (error) {
        deploymentResults.failed++;
        deploymentResults.errors.push({
          promptId,
          name: 'Unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: deploymentResults.failed === 0,
      ...deploymentResults,
      syncedAt: new Date()
    };
  }

  /**
   * Check dependency updates (LangSmith, etc.) when prompts change
   */
  static async checkDependencyUpdates(
    userId: string,
    projectId: string,
    promptId: string
  ): Promise<DependencyUpdate[]> {
    const prompt = await PromptService.getPromptById(promptId, userId);
    const updates: DependencyUpdate[] = [];

    // Check for LangSmith integration
    const appConnections = await this.getProjectAppConnections(projectId);
    
    for (const connection of appConnections) {
      if (connection.type === 'langsmith') {
        // Check if prompt is tracked in LangSmith
        const langsmithPrompts = await this.fetchLangSmithPrompts(connection, prompt.name);
        
        if (langsmithPrompts.length > 0) {
          updates.push({
            type: 'langsmith',
            service: 'LangSmith',
            description: `Prompt "${prompt.name}" has dependencies in LangSmith that may need updating`,
            affectedItems: langsmithPrompts.map(p => p.name),
            severity: 'medium',
            action: 'update_langsmith_prompt',
            metadata: {
              promptId: prompt.id,
              langsmithPrompts: langsmithPrompts
            }
          });
        }
      }

      // Check for API integrations
      if (connection.type === 'direct_api') {
        const apiDependencies = await this.checkAPIDependencies(connection, prompt);
        updates.push(...apiDependencies);
      }
    }

    return updates;
  }

  /**
   * Get integration status for a project
   */
  static async getIntegrationStatus(
    userId: string,
    projectId: string
  ): Promise<IntegrationStatus> {
    // Check permissions
    await ProjectService.getProjectById(projectId, userId);

    const appConnections = await this.getProjectAppConnections(projectId);
    
    const status: IntegrationStatus = {
      connected: appConnections.length > 0,
      applications: appConnections.map(app => ({
        id: app.id,
        name: app.name,
        type: app.type,
        status: app.isActive ? 'active' : 'inactive',
        lastSync: app.lastSync,
        health: 'unknown' // Could be determined by health check
      })),
      lastSync: appConnections.reduce((latest, app) => {
        return !latest || (app.lastSync && app.lastSync > latest) ? app.lastSync : latest;
      }, null as Date | null),
      pendingActions: await this.getPendingActions(projectId)
    };

    return status;
  }

  // Private helper methods

  private static async validateAppConnection(config: AppIntegrationConfig): Promise<void> {
    // Implement connection validation based on app type
    switch (config.type) {
      case 'langsmith':
        await this.validateLangSmithConnection(config);
        break;
      case 'direct_api':
        await this.validateDirectAPIConnection(config);
        break;
      case 'webhook':
        await this.validateWebhookConnection(config);
        break;
      default:
        throw new ValidationError(`Unsupported integration type: ${config.type}`);
    }
  }

  private static async validateLangSmithConnection(config: AppIntegrationConfig): Promise<void> {
    // Validate LangSmith API connection
    try {
      const response = await fetch(`${config.baseUrl}/api/v1/sessions`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new ValidationError('Invalid LangSmith API credentials');
      }
    } catch (error) {
      throw new ValidationError(`LangSmith connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async validateDirectAPIConnection(config: AppIntegrationConfig): Promise<void> {
    // Validate direct API connection
    try {
      const response = await fetch(`${config.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new ValidationError('Main application API connection failed');
      }
    } catch (error) {
      throw new ValidationError(`API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async validateWebhookConnection(config: AppIntegrationConfig): Promise<void> {
    // Validate webhook endpoint
    try {
      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'ping' })
      });

      if (!response.ok) {
        throw new ValidationError('Webhook endpoint validation failed');
      }
    } catch (error) {
      throw new ValidationError(`Webhook validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async hashApiKey(apiKey: string): Promise<string> {
    // Simple hash - in production, use proper encryption
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static async getAppConnection(projectId: string, appId: string): Promise<any> {
    const connection = await prisma.appIntegration.findUnique({
      where: { 
        id: appId,
        projectId: projectId 
      }
    });

    if (!connection) {
      throw new NotFoundError('App integration not found');
    }

    return connection;
  }

  private static async fetchRemotePrompts(
    connection: any,
    options: { environment?: string; tags?: string[] }
  ): Promise<any[]> {
    // Implementation depends on connection type
    switch (connection.type) {
      case 'langsmith':
        return this.fetchLangSmithPrompts(connection, null, options);
      case 'direct_api':
        return this.fetchDirectAPIPrompts(connection, options);
      default:
        throw new ValidationError(`Unsupported connection type for prompt fetching: ${connection.type}`);
    }
  }

  private static async fetchLangSmithPrompts(
    connection: any,
    promptName?: string | null,
    options: { environment?: string; tags?: string[] } = {}
  ): Promise<any[]> {
    // Fetch prompts from LangSmith
    const url = new URL(`${connection.baseUrl}/api/v1/prompts`);
    if (promptName) {
      url.searchParams.set('name', promptName);
    }
    if (options.environment) {
      url.searchParams.set('environment', options.environment);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${connection.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new ValidationError('Failed to fetch prompts from LangSmith');
    }

    return response.json();
  }

  private static async fetchDirectAPIPrompts(
    connection: any,
    options: { environment?: string; tags?: string[] }
  ): Promise<any[]> {
    // Fetch prompts from direct API
    const url = new URL(`${connection.baseUrl}/api/prompts`);
    if (options.environment) {
      url.searchParams.set('environment', options.environment);
    }
    if (options.tags) {
      url.searchParams.set('tags', options.tags.join(','));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${connection.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new ValidationError('Failed to fetch prompts from main application');
    }

    return response.json();
  }

  private static async deployPromptToApp(
    connection: any,
    prompt: any,
    environment: string,
    scheduleDate?: Date
  ): Promise<{ success: boolean; deploymentId?: string; version?: string; error?: string }> {
    // Deploy prompt based on connection type
    try {
      const deploymentPayload = {
        name: prompt.name,
        content: prompt.content,
        description: prompt.description,
        tags: prompt.tags,
        environment: environment,
        scheduledFor: scheduleDate?.toISOString()
      };

      const response = await fetch(`${connection.baseUrl}/api/prompts/deploy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deploymentPayload)
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const result = await response.json();
      return {
        success: true,
        deploymentId: result.deploymentId,
        version: result.version
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      };
    }
  }

  private static async createApprovalRequest(
    userId: string,
    projectId: string,
    promptId: string,
    appId: string,
    analysis: any
  ): Promise<void> {
    // Create an approval request for high-impact deployments
    await prisma.approvalRequest.create({
      data: {
        projectId,
        promptId,
        appId,
        requestedBy: userId,
        status: 'PENDING',
        impactAnalysisId: analysis.id,
        metadata: {
          impactPercentage: analysis.impactPercentage,
          reason: 'High impact deployment requires approval'
        }
      }
    });
  }

  private static async getProjectAppConnections(projectId: string): Promise<any[]> {
    return prisma.appIntegration.findMany({
      where: { projectId, isActive: true }
    });
  }

  private static async checkAPIDependencies(
    connection: any,
    prompt: any
  ): Promise<DependencyUpdate[]> {
    // Check for API dependencies that might be affected by prompt changes
    const updates: DependencyUpdate[] = [];

    try {
      const response = await fetch(`${connection.baseUrl}/api/dependencies/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          promptName: prompt.name,
          promptContent: prompt.content
        })
      });

      if (response.ok) {
        const dependencies = await response.json();
        updates.push(...dependencies);
      }
    } catch (error) {
      console.warn('Failed to check API dependencies:', error);
    }

    return updates;
  }

  private static async getPendingActions(projectId: string): Promise<any[]> {
    // Get pending approval requests and other actions
    const approvals = await prisma.approvalRequest.findMany({
      where: { 
        projectId, 
        status: 'PENDING' 
      },
      include: {
        prompt: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return approvals.map(approval => ({
      type: 'approval_required',
      id: approval.id,
      promptId: approval.promptId,
      promptName: approval.prompt.name,
      createdAt: approval.createdAt,
      metadata: approval.metadata
    }));
  }
}