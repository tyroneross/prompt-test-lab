import { PrismaClient } from '../generated/client';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { ProjectService } from './project.service';
import { PromptService } from './prompt.service';
import { QueueService } from './queue.service';
import type { 
  PromptSyncConfig,
  PromptSyncResult,
  PromptConflict,
  SyncDirection,
  SyncStrategy,
  RemotePrompt
} from '@prompt-lab/shared';

const prisma = new PrismaClient();

export interface SyncConnection {
  id: string;
  name: string;
  type: 'langsmith' | 'direct_api' | 'webhook';
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  lastSync?: Date;
  config: {
    autoSync: boolean;
    syncInterval: number; // minutes
    bidirectional: boolean;
    conflictResolution: 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins';
    promptFilters?: {
      tags?: string[];
      projects?: string[];
      environments?: string[];
      modifiedAfter?: Date;
    };
    webhookUrl?: string; // For real-time sync notifications
  };
}

export interface SyncOperation {
  id: string;
  connectionId: string;
  direction: SyncDirection;
  strategy: SyncStrategy;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  startedAt?: Date;
  completedAt?: Date;
  result?: PromptSyncResult;
  error?: string;
}

export interface ConflictResolution {
  promptId: string;
  resolution: 'keep_local' | 'use_remote' | 'merge' | 'create_version';
  mergeStrategy?: 'content_append' | 'metadata_merge' | 'manual';
  notes?: string;
}

/**
 * Service for bidirectional prompt synchronization between Prompt Testing Lab and external systems
 */
export class PromptSyncService {
  /**
   * Start a bidirectional sync operation
   */
  static async startSync(
    userId: string,
    projectId: string,
    connectionId: string,
    config: PromptSyncConfig
  ): Promise<SyncOperation> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to sync prompts');
    }

    const connection = await this.getSyncConnection(connectionId, projectId);
    
    // Create sync operation record
    const operation = await prisma.syncOperation.create({
      data: {
        projectId,
        connectionId,
        direction: config.direction,
        strategy: config.strategy || 'safe',
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0
        } as any,
        config: config as any,
        initiatedBy: userId
      }
    });

    // Queue the sync operation for background processing
    await QueueService.addJob({
      type: 'prompt_sync',
      data: {
        operationId: operation.id,
        connectionId,
        projectId,
        userId,
        config
      },
      priority: config.priority || 1
    });

    return {
      id: operation.id,
      connectionId,
      direction: config.direction,
      strategy: config.strategy || 'safe',
      status: 'pending',
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      }
    };
  }

  /**
   * Execute sync operation (called by queue worker)
   */
  static async executeSyncOperation(
    operationId: string,
    connection: SyncConnection,
    projectId: string,
    userId: string,
    config: PromptSyncConfig
  ): Promise<PromptSyncResult> {
    try {
      await this.updateOperationStatus(operationId, 'running');

      let result: PromptSyncResult = {
        success: true,
        pulled: 0,
        pushed: 0,
        updated: 0,
        conflicts: [],
        syncedAt: new Date()
      };

      // Execute pull operation
      if (config.direction === 'pull' || config.direction === 'bidirectional') {
        const pullResult = await this.pullPromptsFromRemote(
          operationId,
          connection,
          projectId,
          userId,
          config
        );
        result.pulled = pullResult.pulled;
        result.updated += pullResult.updated;
        result.conflicts.push(...pullResult.conflicts);
      }

      // Execute push operation
      if (config.direction === 'push' || config.direction === 'bidirectional') {
        const pushResult = await this.pushPromptsToRemote(
          operationId,
          connection,
          projectId,
          userId,
          config
        );
        result.pushed = pushResult.pushed;
        result.conflicts.push(...pushResult.conflicts);
      }

      // Update operation status
      await this.updateOperationStatus(operationId, 'completed', result);
      
      // Update connection last sync time
      await this.updateConnectionLastSync(connection.id);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      await this.updateOperationStatus(operationId, 'failed', undefined, errorMessage);
      throw error;
    }
  }

  /**
   * Pull prompts from remote system
   */
  private static async pullPromptsFromRemote(
    operationId: string,
    connection: SyncConnection,
    projectId: string,
    userId: string,
    config: PromptSyncConfig
  ): Promise<{ pulled: number; updated: number; conflicts: PromptConflict[] }> {
    const result = { pulled: 0, updated: 0, conflicts: [] as PromptConflict[] };

    // Fetch remote prompts
    const remotePrompts = await this.fetchRemotePrompts(connection, config);
    
    await this.updateOperationProgress(operationId, { total: remotePrompts.length });

    for (const remotePrompt of remotePrompts) {
      try {
        // Check if prompt already exists locally
        const existingPrompt = await this.findLocalPrompt(projectId, remotePrompt);

        if (existingPrompt) {
          // Handle potential conflicts
          const conflict = await this.detectConflict(existingPrompt, remotePrompt);
          
          if (conflict) {
            if (connection.config.conflictResolution === 'manual') {
              result.conflicts.push(conflict);
              await this.incrementOperationProgress(operationId, 'skipped');
              continue;
            } else {
              // Apply automatic conflict resolution
              const resolved = await this.resolveConflictAutomatically(
                conflict,
                connection.config.conflictResolution
              );
              if (resolved) {
                result.updated++;
                await this.incrementOperationProgress(operationId, 'successful');
              } else {
                result.conflicts.push(conflict);
                await this.incrementOperationProgress(operationId, 'skipped');
              }
            }
          } else {
            // No conflict, update prompt
            await this.updateLocalPrompt(existingPrompt.id, remotePrompt, userId);
            result.updated++;
            await this.incrementOperationProgress(operationId, 'successful');
          }
        } else {
          // Create new prompt
          await this.createLocalPrompt(projectId, remotePrompt, userId, connection.id);
          result.pulled++;
          await this.incrementOperationProgress(operationId, 'successful');
        }
      } catch (error) {
        console.error(`Error syncing prompt ${remotePrompt.name}:`, error);
        result.conflicts.push({
          type: 'sync_error',
          promptId: remotePrompt.id,
          localPrompt: null,
          remotePrompt,
          reason: `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          resolution: 'manual'
        });
        await this.incrementOperationProgress(operationId, 'failed');
      }
    }

    return result;
  }

  /**
   * Push prompts to remote system
   */
  private static async pushPromptsToRemote(
    operationId: string,
    connection: SyncConnection,
    projectId: string,
    userId: string,
    config: PromptSyncConfig
  ): Promise<{ pushed: number; conflicts: PromptConflict[] }> {
    const result = { pushed: 0, conflicts: [] as PromptConflict[] };

    // Get local prompts to sync
    const localPrompts = await this.getLocalPromptsToSync(projectId, config);
    
    await this.updateOperationProgress(operationId, { 
      total: (await this.getOperationProgress(operationId)).total + localPrompts.length 
    });

    for (const localPrompt of localPrompts) {
      try {
        // Check if prompt exists remotely
        const remotePrompt = await this.findRemotePrompt(connection, localPrompt);

        if (remotePrompt) {
          // Handle conflicts during push
          const conflict = await this.detectConflict(localPrompt, remotePrompt);
          
          if (conflict) {
            result.conflicts.push(conflict);
            await this.incrementOperationProgress(operationId, 'skipped');
            continue;
          }
        }

        // Push prompt to remote
        const pushResult = await this.pushPromptToRemote(connection, localPrompt);
        
        if (pushResult.success) {
          // Update local prompt with remote metadata
          await this.updateLocalPromptMetadata(localPrompt.id, {
            remoteId: pushResult.remoteId,
            remoteVersion: pushResult.version,
            lastPushed: new Date(),
            remoteUrl: pushResult.url
          });
          
          result.pushed++;
          await this.incrementOperationProgress(operationId, 'successful');
        } else {
          result.conflicts.push({
            type: 'push_error',
            promptId: localPrompt.id,
            localPrompt,
            remotePrompt: null,
            reason: `Push failed: ${pushResult.error}`,
            resolution: 'manual'
          });
          await this.incrementOperationProgress(operationId, 'failed');
        }
      } catch (error) {
        console.error(`Error pushing prompt ${localPrompt.name}:`, error);
        result.conflicts.push({
          type: 'push_error',
          promptId: localPrompt.id,
          localPrompt,
          remotePrompt: null,
          reason: `Push error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          resolution: 'manual'
        });
        await this.incrementOperationProgress(operationId, 'failed');
      }
    }

    return result;
  }

  /**
   * Resolve sync conflicts
   */
  static async resolveConflicts(
    userId: string,
    projectId: string,
    operationId: string,
    resolutions: ConflictResolution[]
  ): Promise<{ resolved: number; remaining: number }> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to resolve conflicts');
    }

    const operation = await this.getSyncOperation(operationId, projectId);
    if (!operation.result || !operation.result.conflicts) {
      throw new ValidationError('No conflicts found for this operation');
    }

    let resolved = 0;
    const remainingConflicts = [...operation.result.conflicts];

    for (const resolution of resolutions) {
      const conflictIndex = remainingConflicts.findIndex(
        c => c.promptId === resolution.promptId
      );
      
      if (conflictIndex === -1) continue;

      const conflict = remainingConflicts[conflictIndex];
      
      try {
        await this.applyConflictResolution(conflict, resolution, userId);
        remainingConflicts.splice(conflictIndex, 1);
        resolved++;
      } catch (error) {
        console.error(`Failed to resolve conflict for prompt ${resolution.promptId}:`, error);
      }
    }

    // Update operation result
    const updatedResult = {
      ...operation.result,
      conflicts: remainingConflicts
    };

    await this.updateOperationStatus(operationId, 'completed', updatedResult);

    return { resolved, remaining: remainingConflicts.length };
  }

  /**
   * Get sync operation status
   */
  static async getSyncOperationStatus(
    userId: string,
    operationId: string
  ): Promise<SyncOperation> {
    const operation = await prisma.syncOperation.findUnique({
      where: { id: operationId },
      include: { project: true }
    });

    if (!operation) {
      throw new NotFoundError('Sync operation not found');
    }

    // Check user access to project
    await ProjectService.getProjectById(operation.projectId, userId);

    return {
      id: operation.id,
      connectionId: operation.connectionId,
      direction: operation.direction as SyncDirection,
      strategy: operation.strategy as SyncStrategy,
      status: operation.status as any,
      progress: operation.progress as any,
      startedAt: operation.startedAt || undefined,
      completedAt: operation.completedAt || undefined,
      result: operation.result as PromptSyncResult || undefined,
      error: operation.error || undefined
    };
  }

  /**
   * Cancel sync operation
   */
  static async cancelSyncOperation(
    userId: string,
    operationId: string
  ): Promise<void> {
    const operation = await this.getSyncOperation(operationId);
    
    // Check permissions
    await ProjectService.getProjectById(operation.projectId, userId);

    if (operation.status !== 'pending' && operation.status !== 'running') {
      throw new ValidationError('Cannot cancel operation that is not pending or running');
    }

    // Cancel queue job if it exists
    await QueueService.cancelJob('prompt_sync', { operationId });

    // Update operation status
    await this.updateOperationStatus(operationId, 'cancelled');
  }

  /**
   * Set up automatic sync schedule
   */
  static async setupAutoSync(
    userId: string,
    projectId: string,
    connectionId: string,
    config: {
      enabled: boolean;
      interval: number; // minutes
      direction: SyncDirection;
      conflictResolution: 'manual' | 'local_wins' | 'remote_wins';
    }
  ): Promise<void> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to setup auto-sync');
    }

    const connection = await this.getSyncConnection(connectionId, projectId);
    
    // Update connection with auto-sync settings
    await prisma.appIntegration.update({
      where: { id: connectionId },
      data: {
        syncConfig: {
          ...connection.config,
          autoSync: config.enabled,
          syncInterval: config.interval,
          conflictResolution: config.conflictResolution
        } as any
      }
    });

    if (config.enabled) {
      // Schedule recurring sync job
      await QueueService.addRecurringJob({
        type: 'auto_prompt_sync',
        data: {
          connectionId,
          projectId,
          direction: config.direction,
          conflictResolution: config.conflictResolution
        },
        interval: config.interval * 60 * 1000, // Convert to milliseconds
        priority: 0
      });
    } else {
      // Cancel existing auto-sync job
      await QueueService.cancelRecurringJob('auto_prompt_sync', { connectionId });
    }
  }

  // Private helper methods

  private static async fetchRemotePrompts(
    connection: SyncConnection,
    config: PromptSyncConfig
  ): Promise<RemotePrompt[]> {
    switch (connection.type) {
      case 'langsmith':
        return this.fetchLangSmithPrompts(connection, config);
      case 'direct_api':
        return this.fetchDirectAPIPrompts(connection, config);
      case 'webhook':
        throw new ValidationError('Webhook connections do not support pulling prompts');
      default:
        throw new ValidationError(`Unsupported connection type: ${connection.type}`);
    }
  }

  private static async fetchLangSmithPrompts(
    connection: SyncConnection,
    config: PromptSyncConfig
  ): Promise<RemotePrompt[]> {
    const url = new URL(`${connection.baseUrl}/api/v1/prompts`);
    
    // Apply filters
    if (connection.config.promptFilters?.tags) {
      url.searchParams.set('tags', connection.config.promptFilters.tags.join(','));
    }
    if (connection.config.promptFilters?.modifiedAfter) {
      url.searchParams.set('modified_after', connection.config.promptFilters.modifiedAfter.toISOString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${connection.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new ValidationError(`Failed to fetch prompts from LangSmith: ${response.statusText}`);
    }

    const data = await response.json();
    return data.prompts || data;
  }

  private static async fetchDirectAPIPrompts(
    connection: SyncConnection,
    config: PromptSyncConfig
  ): Promise<RemotePrompt[]> {
    const url = new URL(`${connection.baseUrl}/api/prompts`);
    
    // Apply filters
    if (connection.config.promptFilters?.tags) {
      url.searchParams.set('tags', connection.config.promptFilters.tags.join(','));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${connection.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new ValidationError(`Failed to fetch prompts from API: ${response.statusText}`);
    }

    return response.json();
  }

  private static async findLocalPrompt(projectId: string, remotePrompt: RemotePrompt): Promise<any> {
    // First try to find by remote ID in metadata
    let localPrompt = await prisma.prompt.findFirst({
      where: {
        projectId,
        metadata: {
          path: ['remoteId'],
          equals: remotePrompt.id
        }
      }
    });

    // If not found, try to find by name
    if (!localPrompt) {
      localPrompt = await prisma.prompt.findFirst({
        where: {
          projectId,
          name: remotePrompt.name,
          isArchived: false
        }
      });
    }

    return localPrompt;
  }

  private static async detectConflict(localPrompt: any, remotePrompt: RemotePrompt): Promise<PromptConflict | null> {
    // Check if both have been modified since last sync
    const lastSync = localPrompt.metadata?.lastSync ? new Date(localPrompt.metadata.lastSync) : null;
    const localModified = localPrompt.updatedAt;
    const remoteModified = new Date(remotePrompt.lastModified);

    if (lastSync && localModified > lastSync && remoteModified > lastSync) {
      // Both have changes since last sync
      if (localPrompt.content !== remotePrompt.content) {
        return {
          type: 'content_conflict',
          promptId: localPrompt.id,
          localPrompt,
          remotePrompt,
          reason: 'Both local and remote versions have been modified since last sync',
          resolution: 'manual'
        };
      }
    }

    return null;
  }

  private static async resolveConflictAutomatically(
    conflict: PromptConflict,
    strategy: string
  ): Promise<boolean> {
    switch (strategy) {
      case 'local_wins':
        // Keep local version, mark as resolved
        return true;
      
      case 'remote_wins':
        // Update local with remote version
        if (conflict.localPrompt && conflict.remotePrompt) {
          await this.updateLocalPrompt(conflict.localPrompt.id, conflict.remotePrompt, 'system');
          return true;
        }
        break;
      
      case 'newest_wins':
        // Use the most recently modified version
        if (conflict.localPrompt && conflict.remotePrompt) {
          const localModified = new Date(conflict.localPrompt.updatedAt);
          const remoteModified = new Date(conflict.remotePrompt.lastModified);
          
          if (remoteModified > localModified) {
            await this.updateLocalPrompt(conflict.localPrompt.id, conflict.remotePrompt, 'system');
          }
          return true;
        }
        break;
    }

    return false;
  }

  private static async createLocalPrompt(
    projectId: string,
    remotePrompt: RemotePrompt,
    userId: string,
    connectionId: string
  ): Promise<void> {
    await PromptService.createPrompt(projectId, userId, {
      name: remotePrompt.name,
      description: remotePrompt.description,
      content: remotePrompt.content,
      tags: remotePrompt.tags || [],
      metadata: {
        remoteId: remotePrompt.id,
        remoteSource: connectionId,
        lastSync: new Date().toISOString(),
        remoteVersion: remotePrompt.version,
        remoteUrl: remotePrompt.url
      }
    });
  }

  private static async updateLocalPrompt(
    promptId: string,
    remotePrompt: RemotePrompt,
    userId: string
  ): Promise<void> {
    await PromptService.updatePrompt(promptId, userId, {
      content: remotePrompt.content,
      description: remotePrompt.description,
      tags: remotePrompt.tags,
      metadata: {
        remoteId: remotePrompt.id,
        lastSync: new Date().toISOString(),
        remoteVersion: remotePrompt.version,
        remoteUrl: remotePrompt.url
      }
    });
  }

  private static async getLocalPromptsToSync(
    projectId: string,
    config: PromptSyncConfig
  ): Promise<any[]> {
    const whereClause: any = {
      projectId,
      isArchived: false
    };

    // Apply filters
    if (config.promptIds && config.promptIds.length > 0) {
      whereClause.id = { in: config.promptIds };
    }

    if (config.tags && config.tags.length > 0) {
      whereClause.tags = { hasEvery: config.tags };
    }

    if (config.modifiedAfter) {
      whereClause.updatedAt = { gte: config.modifiedAfter };
    }

    return prisma.prompt.findMany({ where: whereClause });
  }

  private static async findRemotePrompt(
    connection: SyncConnection,
    localPrompt: any
  ): Promise<RemotePrompt | null> {
    // Implementation depends on connection type
    // This would query the remote system to find matching prompt
    return null; // Placeholder
  }

  private static async pushPromptToRemote(
    connection: SyncConnection,
    localPrompt: any
  ): Promise<{ success: boolean; remoteId?: string; version?: string; url?: string; error?: string }> {
    try {
      const payload = {
        name: localPrompt.name,
        description: localPrompt.description,
        content: localPrompt.content,
        tags: localPrompt.tags,
        metadata: localPrompt.metadata
      };

      const response = await fetch(`${connection.baseUrl}/api/prompts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const result = await response.json();
      return {
        success: true,
        remoteId: result.id,
        version: result.version,
        url: result.url
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateLocalPromptMetadata(promptId: string, metadata: any): Promise<void> {
    const existingPrompt = await prisma.prompt.findUnique({ where: { id: promptId } });
    if (!existingPrompt) return;

    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        metadata: {
          ...existingPrompt.metadata,
          ...metadata
        } as any
      }
    });
  }

  private static async applyConflictResolution(
    conflict: PromptConflict,
    resolution: ConflictResolution,
    userId: string
  ): Promise<void> {
    switch (resolution.resolution) {
      case 'keep_local':
        // No action needed, local version is kept
        break;

      case 'use_remote':
        if (conflict.localPrompt && conflict.remotePrompt) {
          await this.updateLocalPrompt(conflict.localPrompt.id, conflict.remotePrompt, userId);
        }
        break;

      case 'create_version':
        if (conflict.localPrompt && conflict.remotePrompt) {
          // Create a new version of the prompt with remote content
          await PromptService.createPrompt(conflict.localPrompt.projectId, userId, {
            name: `${conflict.remotePrompt.name} (Remote Version)`,
            description: conflict.remotePrompt.description,
            content: conflict.remotePrompt.content,
            tags: conflict.remotePrompt.tags || [],
            parentId: conflict.localPrompt.id,
            metadata: {
              remoteId: conflict.remotePrompt.id,
              conflictResolution: 'version_created',
              originalConflictId: conflict.promptId
            }
          });
        }
        break;

      case 'merge':
        // Implement merge logic based on strategy
        if (resolution.mergeStrategy === 'content_append' && conflict.localPrompt && conflict.remotePrompt) {
          const mergedContent = `${conflict.localPrompt.content}\n\n--- Remote Changes ---\n${conflict.remotePrompt.content}`;
          await PromptService.updatePrompt(conflict.localPrompt.id, userId, {
            content: mergedContent,
            metadata: {
              ...conflict.localPrompt.metadata,
              mergedFromRemote: true,
              remoteId: conflict.remotePrompt.id
            }
          });
        }
        break;
    }
  }

  private static async getSyncConnection(connectionId: string, projectId?: string): Promise<SyncConnection> {
    const connection = await prisma.appIntegration.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      throw new NotFoundError('Sync connection not found');
    }

    if (projectId && connection.projectId !== projectId) {
      throw new AuthorizationError('Connection does not belong to project');
    }

    return {
      id: connection.id,
      name: connection.name,
      type: connection.type as any,
      baseUrl: connection.baseUrl,
      apiKey: '[REDACTED]', // Don't expose actual API key
      isActive: connection.isActive,
      lastSync: connection.lastSync || undefined,
      config: connection.syncConfig as any
    };
  }

  private static async getSyncOperation(operationId: string, projectId?: string): Promise<any> {
    const operation = await prisma.syncOperation.findUnique({
      where: { id: operationId },
      include: { project: true }
    });

    if (!operation) {
      throw new NotFoundError('Sync operation not found');
    }

    if (projectId && operation.projectId !== projectId) {
      throw new AuthorizationError('Operation does not belong to project');
    }

    return operation;
  }

  private static async updateOperationStatus(
    operationId: string,
    status: string,
    result?: any,
    error?: string
  ): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'running' && !result) {
      updateData.startedAt = new Date();
    }
    
    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }
    
    if (result) {
      updateData.result = result;
    }
    
    if (error) {
      updateData.error = error;
    }

    await prisma.syncOperation.update({
      where: { id: operationId },
      data: updateData
    });
  }

  private static async updateOperationProgress(
    operationId: string,
    progress: Partial<{ total: number; processed: number; successful: number; failed: number; skipped: number }>
  ): Promise<void> {
    const operation = await prisma.syncOperation.findUnique({ where: { id: operationId } });
    if (!operation) return;

    const currentProgress = operation.progress as any || {
      total: 0, processed: 0, successful: 0, failed: 0, skipped: 0
    };

    const updatedProgress = { ...currentProgress, ...progress };

    await prisma.syncOperation.update({
      where: { id: operationId },
      data: { progress: updatedProgress as any }
    });
  }

  private static async incrementOperationProgress(
    operationId: string,
    type: 'processed' | 'successful' | 'failed' | 'skipped'
  ): Promise<void> {
    const operation = await prisma.syncOperation.findUnique({ where: { id: operationId } });
    if (!operation) return;

    const progress = operation.progress as any || {
      total: 0, processed: 0, successful: 0, failed: 0, skipped: 0
    };

    progress[type]++;
    if (type !== 'processed') {
      progress.processed++;
    }

    await prisma.syncOperation.update({
      where: { id: operationId },
      data: { progress: progress as any }
    });
  }

  private static async getOperationProgress(operationId: string): Promise<any> {
    const operation = await prisma.syncOperation.findUnique({ where: { id: operationId } });
    return operation?.progress || { total: 0, processed: 0, successful: 0, failed: 0, skipped: 0 };
  }

  private static async updateConnectionLastSync(connectionId: string): Promise<void> {
    await prisma.appIntegration.update({
      where: { id: connectionId },
      data: { lastSync: new Date() }
    });
  }
}