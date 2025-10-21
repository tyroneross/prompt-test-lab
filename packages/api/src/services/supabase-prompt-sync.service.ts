import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/realtime-js';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { PrismaClient } from '../generated/client';
import { ProjectService } from './project.service';
import { PromptService } from './prompt.service';
import { QueueService } from './queue.service';
import { SupabaseIntegrationService, SupabaseConnection, SupabasePrompt } from './supabase-integration.service';
import { WebsocketService } from './websocket.service';
import { z } from 'zod';

const prisma = new PrismaClient();

// Sync configuration schema
export const SupabaseSyncConfigSchema = z.object({
  direction: z.enum(['pull', 'push', 'bidirectional']).default('bidirectional'),
  strategy: z.enum(['safe', 'aggressive', 'manual']).default('safe'),
  tableName: z.string().min(1, 'Table name is required'),
  schema: z.string().default('public'),
  columnMapping: z.object({
    id: z.string().default('id'),
    name: z.string().default('name'),
    content: z.string().default('content'),
    description: z.string().default('description').optional(),
    tags: z.string().default('tags').optional(),
    metadata: z.string().default('metadata').optional(),
    created_at: z.string().default('created_at'),
    updated_at: z.string().default('updated_at'),
    user_id: z.string().default('user_id').optional(),
    project_id: z.string().default('project_id').optional()
  }),
  filters: z.object({
    user_id: z.string().optional(),
    project_id: z.string().optional(),
    tags: z.array(z.string()).optional(),
    modifiedAfter: z.date().optional()
  }).optional(),
  conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins', 'newest_wins']).default('manual'),
  realTimeEvents: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])).default(['INSERT', 'UPDATE', 'DELETE']),
  batchSize: z.number().min(1).max(1000).default(100),
  enableRetry: z.boolean().default(true),
  maxRetries: z.number().min(1).max(10).default(3)
});

export type SupabaseSyncConfig = z.infer<typeof SupabaseSyncConfigSchema>;

export interface SupabaseSyncResult {
  success: boolean;
  pulled: number;
  pushed: number;
  updated: number;
  conflicts: SupabaseConflict[];
  errors: SupabaseSyncError[];
  syncedAt: Date;
  batchInfo?: {
    totalBatches: number;
    processedBatches: number;
    currentBatch: number;
  };
}

export interface SupabaseConflict {
  type: 'content_conflict' | 'version_conflict' | 'permission_conflict' | 'schema_conflict';
  promptId: string;
  localPrompt: any;
  remotePrompt: SupabasePrompt;
  reason: string;
  resolution: 'manual' | 'auto_resolved';
  metadata?: Record<string, any>;
}

export interface SupabaseSyncError {
  type: 'sync_error' | 'auth_error' | 'network_error' | 'validation_error';
  promptId?: string;
  error: string;
  retryable: boolean;
  attemptCount: number;
}

export interface RealtimeSubscription {
  connectionId: string;
  channel: RealtimeChannel;
  tableName: string;
  filters: Record<string, any>;
  isActive: boolean;
  lastActivity: Date;
}

/**
 * Service for real-time bidirectional prompt synchronization with Supabase
 */
export class SupabasePromptSyncService {
  private static subscriptions = new Map<string, RealtimeSubscription>();
  private static syncOperations = new Map<string, { status: string; progress: any }>();

  /**
   * Start bidirectional sync with Supabase
   */
  static async startSupabaseSync(
    userId: string,
    projectId: string,
    connectionId: string,
    config: SupabaseSyncConfig
  ): Promise<{ operationId: string; subscription?: RealtimeSubscription }> {
    // Validate permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to sync with Supabase');
    }

    // Validate configuration
    const validatedConfig = SupabaseSyncConfigSchema.parse(config);

    // Get Supabase connection
    const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId, projectId);

    // Create sync operation record
    const operation = await prisma.syncOperation.create({
      data: {
        projectId,
        connectionId,
        direction: validatedConfig.direction,
        strategy: validatedConfig.strategy,
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0
        } as any,
        config: validatedConfig as any,
        initiatedBy: userId
      }
    });

    // Set up real-time subscription if enabled
    let subscription: RealtimeSubscription | undefined;
    if (connection.enableRealtime && validatedConfig.direction !== 'push') {
      subscription = await this.setupRealtimeSubscription(
        connection,
        validatedConfig,
        projectId,
        userId
      );
    }

    // Queue the sync operation
    await QueueService.addJob({
      type: 'supabase_prompt_sync',
      data: {
        operationId: operation.id,
        connectionId,
        projectId,
        userId,
        config: validatedConfig
      },
      priority: 1
    });

    return {
      operationId: operation.id,
      subscription
    };
  }

  /**
   * Execute Supabase sync operation (called by queue worker)
   */
  static async executeSupabaseSync(
    operationId: string,
    connection: SupabaseConnection,
    projectId: string,
    userId: string,
    config: SupabaseSyncConfig
  ): Promise<SupabaseSyncResult> {
    try {
      await this.updateSyncOperationStatus(operationId, 'running');

      let result: SupabaseSyncResult = {
        success: true,
        pulled: 0,
        pushed: 0,
        updated: 0,
        conflicts: [],
        errors: [],
        syncedAt: new Date()
      };

      // Execute pull operation
      if (config.direction === 'pull' || config.direction === 'bidirectional') {
        const pullResult = await this.pullPromptsFromSupabase(
          operationId,
          connection,
          projectId,
          userId,
          config
        );
        result.pulled = pullResult.pulled;
        result.updated += pullResult.updated;
        result.conflicts.push(...pullResult.conflicts);
        result.errors.push(...pullResult.errors);
      }

      // Execute push operation
      if (config.direction === 'push' || config.direction === 'bidirectional') {
        const pushResult = await this.pushPromptsToSupabase(
          operationId,
          connection,
          projectId,
          userId,
          config
        );
        result.pushed = pushResult.pushed;
        result.conflicts.push(...pushResult.conflicts);
        result.errors.push(...pushResult.errors);
      }

      // Determine overall success
      result.success = result.errors.length === 0;

      await this.updateSyncOperationStatus(operationId, 'completed', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      await this.updateSyncOperationStatus(operationId, 'failed', undefined, errorMessage);
      throw error;
    }
  }

  /**
   * Pull prompts from Supabase in batches
   */
  private static async pullPromptsFromSupabase(
    operationId: string,
    connection: SupabaseConnection,
    projectId: string,
    userId: string,
    config: SupabaseSyncConfig
  ): Promise<{ pulled: number; updated: number; conflicts: SupabaseConflict[]; errors: SupabaseSyncError[] }> {
    const result = { pulled: 0, updated: 0, conflicts: [] as SupabaseConflict[], errors: [] as SupabaseSyncError[] };

    try {
      // Build query with filters
      let query = connection.client.from(config.tableName).select('*');
      
      if (config.filters?.user_id) {
        query = query.eq(config.columnMapping.user_id || 'user_id', config.filters.user_id);
      }
      if (config.filters?.project_id) {
        query = query.eq(config.columnMapping.project_id || 'project_id', config.filters.project_id);
      }
      if (config.filters?.modifiedAfter) {
        query = query.gte(config.columnMapping.updated_at, config.filters.modifiedAfter.toISOString());
      }

      // Get total count for progress tracking
      const { count } = await query.select('*', { count: 'exact', head: true });
      await this.updateSyncOperationProgress(operationId, { total: count || 0 });

      // Process in batches
      const totalBatches = Math.ceil((count || 0) / config.batchSize);
      let currentBatch = 0;

      for (let offset = 0; offset < (count || 0); offset += config.batchSize) {
        currentBatch++;
        
        // Update batch progress
        result.batchInfo = {
          totalBatches,
          processedBatches: currentBatch - 1,
          currentBatch
        };

        const { data: remotePrompts, error } = await query
          .range(offset, offset + config.batchSize - 1);

        if (error) {
          result.errors.push({
            type: 'sync_error',
            error: `Batch ${currentBatch} failed: ${error.message}`,
            retryable: true,
            attemptCount: 1
          });
          continue;
        }

        // Process each prompt in the batch
        for (const remotePrompt of remotePrompts || []) {
          try {
            const processResult = await this.processRemotePrompt(
              remotePrompt,
              projectId,
              userId,
              connection.id,
              config
            );

            if (processResult.action === 'created') {
              result.pulled++;
            } else if (processResult.action === 'updated') {
              result.updated++;
            } else if (processResult.conflict) {
              result.conflicts.push(processResult.conflict);
            }

            await this.incrementSyncProgress(operationId, 'successful');
          } catch (error) {
            result.errors.push({
              type: 'sync_error',
              promptId: remotePrompt[config.columnMapping.id],
              error: error instanceof Error ? error.message : 'Unknown error',
              retryable: true,
              attemptCount: 1
            });
            await this.incrementSyncProgress(operationId, 'failed');
          }
        }

        // Notify progress via WebSocket
        await this.notifyProgress(operationId, {
          ...result,
          batchInfo: result.batchInfo
        });
      }
    } catch (error) {
      result.errors.push({
        type: 'sync_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        attemptCount: 1
      });
    }

    return result;
  }

  /**
   * Push prompts to Supabase in batches
   */
  private static async pushPromptsToSupabase(
    operationId: string,
    connection: SupabaseConnection,
    projectId: string,
    userId: string,
    config: SupabaseSyncConfig
  ): Promise<{ pushed: number; conflicts: SupabaseConflict[]; errors: SupabaseSyncError[] }> {
    const result = { pushed: 0, conflicts: [] as SupabaseConflict[], errors: [] as SupabaseSyncError[] };

    try {
      // Get local prompts to sync
      const localPrompts = await this.getLocalPromptsToSync(projectId, config);
      
      // Update total count for progress tracking
      const currentProgress = await this.getSyncOperationProgress(operationId);
      await this.updateSyncOperationProgress(operationId, { 
        total: currentProgress.total + localPrompts.length 
      });

      // Process in batches
      const totalBatches = Math.ceil(localPrompts.length / config.batchSize);
      let currentBatch = 0;

      for (let i = 0; i < localPrompts.length; i += config.batchSize) {
        currentBatch++;
        const batch = localPrompts.slice(i, i + config.batchSize);
        
        try {
          const batchResult = await this.pushPromptBatch(
            batch,
            connection,
            config
          );

          result.pushed += batchResult.pushed;
          result.conflicts.push(...batchResult.conflicts);
          result.errors.push(...batchResult.errors);

          // Update local prompts with remote metadata
          for (const success of batchResult.successful) {
            await this.updateLocalPromptMetadata(success.localId, success.remoteData);
          }

          await this.incrementSyncProgress(operationId, 'successful', batchResult.pushed);
        } catch (error) {
          result.errors.push({
            type: 'sync_error',
            error: `Batch ${currentBatch} push failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            retryable: true,
            attemptCount: 1
          });
          await this.incrementSyncProgress(operationId, 'failed', batch.length);
        }

        // Notify progress
        await this.notifyProgress(operationId, result);
      }
    } catch (error) {
      result.errors.push({
        type: 'sync_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        attemptCount: 1
      });
    }

    return result;
  }

  /**
   * Set up real-time subscription to Supabase table
   */
  private static async setupRealtimeSubscription(
    connection: SupabaseConnection,
    config: SupabaseSyncConfig,
    projectId: string,
    userId: string
  ): Promise<RealtimeSubscription> {
    const subscriptionId = `${connection.id}-${config.tableName}`;
    
    // Remove existing subscription if it exists
    await this.removeRealtimeSubscription(subscriptionId);

    // Create new channel
    const channel = connection.client.channel(`table-db-changes:${config.schema}:${config.tableName}`);

    // Set up event handlers
    const eventHandlers = {
      INSERT: (payload: RealtimePostgresChangesPayload<SupabasePrompt>) => 
        this.handleRealtimeInsert(payload, projectId, userId, connection.id, config),
      UPDATE: (payload: RealtimePostgresChangesPayload<SupabasePrompt>) => 
        this.handleRealtimeUpdate(payload, projectId, userId, connection.id, config),
      DELETE: (payload: RealtimePostgresChangesPayload<SupabasePrompt>) => 
        this.handleRealtimeDelete(payload, projectId, userId, connection.id, config)
    };

    // Subscribe to configured events
    for (const event of config.realTimeEvents) {
      channel.on(
        'postgres_changes',
        {
          event,
          schema: config.schema,
          table: config.tableName,
          filter: config.filters?.project_id ? `project_id=eq.${config.filters.project_id}` : undefined
        },
        eventHandlers[event]
      );
    }

    // Subscribe to channel
    await channel.subscribe((status) => {
      console.log(`Supabase realtime subscription status: ${status}`);
      if (status === 'SUBSCRIBED') {
        console.log(`Successfully subscribed to ${config.tableName} changes`);
      }
    });

    const subscription: RealtimeSubscription = {
      connectionId: connection.id,
      channel,
      tableName: config.tableName,
      filters: config.filters || {},
      isActive: true,
      lastActivity: new Date()
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  /**
   * Handle real-time INSERT events
   */
  private static async handleRealtimeInsert(
    payload: RealtimePostgresChangesPayload<SupabasePrompt>,
    projectId: string,
    userId: string,
    connectionId: string,
    config: SupabaseSyncConfig
  ): Promise<void> {
    try {
      const remotePrompt = payload.new;
      const processResult = await this.processRemotePrompt(
        remotePrompt,
        projectId,
        userId,
        connectionId,
        config
      );

      // Notify via WebSocket
      await WebsocketService.broadcastToProject(projectId, {
        type: 'supabase_realtime_insert',
        data: {
          action: processResult.action,
          promptId: processResult.promptId,
          promptName: remotePrompt[config.columnMapping.name],
          conflict: processResult.conflict
        }
      });
    } catch (error) {
      console.error('Error handling realtime insert:', error);
    }
  }

  /**
   * Handle real-time UPDATE events
   */
  private static async handleRealtimeUpdate(
    payload: RealtimePostgresChangesPayload<SupabasePrompt>,
    projectId: string,
    userId: string,
    connectionId: string,
    config: SupabaseSyncConfig
  ): Promise<void> {
    try {
      const remotePrompt = payload.new;
      const processResult = await this.processRemotePrompt(
        remotePrompt,
        projectId,
        userId,
        connectionId,
        config
      );

      // Notify via WebSocket
      await WebsocketService.broadcastToProject(projectId, {
        type: 'supabase_realtime_update',
        data: {
          action: processResult.action,
          promptId: processResult.promptId,
          promptName: remotePrompt[config.columnMapping.name],
          conflict: processResult.conflict,
          oldData: payload.old
        }
      });
    } catch (error) {
      console.error('Error handling realtime update:', error);
    }
  }

  /**
   * Handle real-time DELETE events
   */
  private static async handleRealtimeDelete(
    payload: RealtimePostgresChangesPayload<SupabasePrompt>,
    projectId: string,
    userId: string,
    connectionId: string,
    config: SupabaseSyncConfig
  ): Promise<void> {
    try {
      const deletedPrompt = payload.old;
      const remoteId = deletedPrompt[config.columnMapping.id];

      // Find local prompt
      const localPrompt = await prisma.prompt.findFirst({
        where: {
          projectId,
          metadata: {
            path: ['supabase', 'remoteId'],
            equals: remoteId
          }
        }
      });

      if (localPrompt) {
        // Soft delete or archive the local prompt
        await PromptService.updatePrompt(localPrompt.id, userId, {
          isArchived: true,
          metadata: {
            ...localPrompt.metadata,
            supabase: {
              ...(localPrompt.metadata as any)?.supabase,
              deletedAt: new Date().toISOString(),
              lastSync: new Date().toISOString()
            }
          }
        });

        // Notify via WebSocket
        await WebsocketService.broadcastToProject(projectId, {
          type: 'supabase_realtime_delete',
          data: {
            action: 'archived',
            promptId: localPrompt.id,
            promptName: localPrompt.name,
            remoteId
          }
        });
      }
    } catch (error) {
      console.error('Error handling realtime delete:', error);
    }
  }

  /**
   * Process a remote prompt (create/update/conflict)
   */
  private static async processRemotePrompt(
    remotePrompt: SupabasePrompt,
    projectId: string,
    userId: string,
    connectionId: string,
    config: SupabaseSyncConfig
  ): Promise<{
    action: 'created' | 'updated' | 'skipped';
    promptId: string;
    conflict?: SupabaseConflict;
  }> {
    const remoteId = remotePrompt[config.columnMapping.id];
    
    // Find existing local prompt
    const existingPrompt = await prisma.prompt.findFirst({
      where: {
        projectId,
        metadata: {
          path: ['supabase', 'remoteId'],
          equals: remoteId
        }
      }
    });

    if (existingPrompt) {
      // Check for conflicts
      const conflict = await this.detectSupabaseConflict(existingPrompt, remotePrompt, config);
      
      if (conflict) {
        if (config.conflictResolution === 'manual') {
          return { action: 'skipped', promptId: existingPrompt.id, conflict };
        } else {
          // Apply automatic resolution
          const resolved = await this.resolveSupabaseConflict(conflict, config.conflictResolution);
          if (resolved) {
            await this.updateLocalPromptFromRemote(existingPrompt.id, remotePrompt, userId, connectionId, config);
            return { action: 'updated', promptId: existingPrompt.id };
          } else {
            return { action: 'skipped', promptId: existingPrompt.id, conflict };
          }
        }
      } else {
        // No conflict, update
        await this.updateLocalPromptFromRemote(existingPrompt.id, remotePrompt, userId, connectionId, config);
        return { action: 'updated', promptId: existingPrompt.id };
      }
    } else {
      // Create new prompt
      const newPrompt = await this.createLocalPromptFromRemote(remotePrompt, projectId, userId, connectionId, config);
      return { action: 'created', promptId: newPrompt.id };
    }
  }

  // Additional helper methods...

  private static async removeRealtimeSubscription(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      await subscription.channel.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  private static async detectSupabaseConflict(
    localPrompt: any,
    remotePrompt: SupabasePrompt,
    config: SupabaseSyncConfig
  ): Promise<SupabaseConflict | null> {
    const localContent = localPrompt.content;
    const remoteContent = remotePrompt[config.columnMapping.content];
    
    const lastSync = localPrompt.metadata?.supabase?.lastSync ? 
      new Date(localPrompt.metadata.supabase.lastSync) : null;
    const localModified = localPrompt.updatedAt;
    const remoteModified = new Date(remotePrompt[config.columnMapping.updated_at]);

    if (lastSync && localModified > lastSync && remoteModified > lastSync && localContent !== remoteContent) {
      return {
        type: 'content_conflict',
        promptId: localPrompt.id,
        localPrompt,
        remotePrompt,
        reason: 'Both local and remote versions modified since last sync',
        resolution: 'manual'
      };
    }

    return null;
  }

  private static async resolveSupabaseConflict(
    conflict: SupabaseConflict,
    strategy: string
  ): Promise<boolean> {
    // Implementation similar to base PromptSyncService
    switch (strategy) {
      case 'local_wins':
        return true; // Keep local, mark as resolved
      case 'remote_wins':
        return true; // Will update local with remote
      case 'newest_wins':
        const localModified = new Date(conflict.localPrompt.updatedAt);
        const remoteModified = new Date(conflict.remotePrompt.updated_at);
        return remoteModified > localModified;
      default:
        return false;
    }
  }

  private static async createLocalPromptFromRemote(
    remotePrompt: SupabasePrompt,
    projectId: string,
    userId: string,
    connectionId: string,
    config: SupabaseSyncConfig
  ): Promise<any> {
    const promptData = {
      name: remotePrompt[config.columnMapping.name],
      description: config.columnMapping.description ? remotePrompt[config.columnMapping.description] : undefined,
      content: remotePrompt[config.columnMapping.content],
      tags: config.columnMapping.tags ? this.parseTags(remotePrompt[config.columnMapping.tags]) : [],
      metadata: {
        supabase: {
          remoteId: remotePrompt[config.columnMapping.id],
          remoteSource: connectionId,
          lastSync: new Date().toISOString(),
          tableName: config.tableName,
          schema: config.schema
        },
        ...this.parseMetadata(config.columnMapping.metadata ? remotePrompt[config.columnMapping.metadata] : null)
      }
    };

    return await PromptService.createPrompt(projectId, userId, promptData);
  }

  private static async updateLocalPromptFromRemote(
    promptId: string,
    remotePrompt: SupabasePrompt,
    userId: string,
    connectionId: string,
    config: SupabaseSyncConfig
  ): Promise<void> {
    const existingPrompt = await prisma.prompt.findUnique({ where: { id: promptId } });
    if (!existingPrompt) return;

    await PromptService.updatePrompt(promptId, userId, {
      content: remotePrompt[config.columnMapping.content],
      description: config.columnMapping.description ? remotePrompt[config.columnMapping.description] : undefined,
      tags: config.columnMapping.tags ? this.parseTags(remotePrompt[config.columnMapping.tags]) : undefined,
      metadata: {
        ...existingPrompt.metadata,
        supabase: {
          ...(existingPrompt.metadata as any)?.supabase,
          remoteId: remotePrompt[config.columnMapping.id],
          lastSync: new Date().toISOString(),
          remoteVersion: remotePrompt[config.columnMapping.updated_at]
        }
      }
    });
  }

  private static parseTags(tagsData: any): string[] {
    if (!tagsData) return [];
    if (Array.isArray(tagsData)) return tagsData;
    if (typeof tagsData === 'string') {
      try {
        return JSON.parse(tagsData);
      } catch {
        return tagsData.split(',').map(tag => tag.trim());
      }
    }
    return [];
  }

  private static parseMetadata(metadataData: any): Record<string, any> {
    if (!metadataData) return {};
    if (typeof metadataData === 'object') return metadataData;
    if (typeof metadataData === 'string') {
      try {
        return JSON.parse(metadataData);
      } catch {
        return {};
      }
    }
    return {};
  }

  // Operation tracking methods
  private static async updateSyncOperationStatus(
    operationId: string,
    status: string,
    result?: any,
    error?: string
  ): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'running') {
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

  private static async updateSyncOperationProgress(
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

  private static async incrementSyncProgress(
    operationId: string,
    type: 'successful' | 'failed' | 'skipped',
    count: number = 1
  ): Promise<void> {
    const operation = await prisma.syncOperation.findUnique({ where: { id: operationId } });
    if (!operation) return;

    const progress = operation.progress as any || {
      total: 0, processed: 0, successful: 0, failed: 0, skipped: 0
    };

    progress[type] += count;
    progress.processed += count;

    await prisma.syncOperation.update({
      where: { id: operationId },
      data: { progress: progress as any }
    });
  }

  private static async getSyncOperationProgress(operationId: string): Promise<any> {
    const operation = await prisma.syncOperation.findUnique({ where: { id: operationId } });
    return operation?.progress || { total: 0, processed: 0, successful: 0, failed: 0, skipped: 0 };
  }

  private static async getLocalPromptsToSync(
    projectId: string,
    config: SupabaseSyncConfig
  ): Promise<any[]> {
    const whereClause: any = {
      projectId,
      isArchived: false
    };

    if (config.filters?.tags && config.filters.tags.length > 0) {
      whereClause.tags = { hasEvery: config.filters.tags };
    }

    if (config.filters?.modifiedAfter) {
      whereClause.updatedAt = { gte: config.filters.modifiedAfter };
    }

    return prisma.prompt.findMany({ where: whereClause });
  }

  private static async pushPromptBatch(
    prompts: any[],
    connection: SupabaseConnection,
    config: SupabaseSyncConfig
  ): Promise<{
    pushed: number;
    conflicts: SupabaseConflict[];
    errors: SupabaseSyncError[];
    successful: Array<{ localId: string; remoteData: any }>;
  }> {
    const result = {
      pushed: 0,
      conflicts: [] as SupabaseConflict[],
      errors: [] as SupabaseSyncError[],
      successful: [] as Array<{ localId: string; remoteData: any }>
    };

    // Prepare batch data
    const batchData = prompts.map(prompt => ({
      [config.columnMapping.id]: prompt.metadata?.supabase?.remoteId || undefined,
      [config.columnMapping.name]: prompt.name,
      [config.columnMapping.content]: prompt.content,
      [config.columnMapping.description || 'description']: prompt.description,
      [config.columnMapping.tags || 'tags']: JSON.stringify(prompt.tags),
      [config.columnMapping.metadata || 'metadata']: JSON.stringify(prompt.metadata),
      [config.columnMapping.updated_at]: new Date().toISOString()
    }));

    try {
      const { data, error } = await connection.client
        .from(config.tableName)
        .upsert(batchData, { onConflict: config.columnMapping.id });

      if (error) {
        result.errors.push({
          type: 'sync_error',
          error: error.message,
          retryable: true,
          attemptCount: 1
        });
        return result;
      }

      result.pushed = prompts.length;
      
      // Track successful pushes
      prompts.forEach((prompt, index) => {
        result.successful.push({
          localId: prompt.id,
          remoteData: data?.[index] || batchData[index]
        });
      });

    } catch (error) {
      result.errors.push({
        type: 'sync_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
        attemptCount: 1
      });
    }

    return result;
  }

  private static async updateLocalPromptMetadata(localId: string, remoteData: any): Promise<void> {
    const existingPrompt = await prisma.prompt.findUnique({ where: { id: localId } });
    if (!existingPrompt) return;

    await prisma.prompt.update({
      where: { id: localId },
      data: {
        metadata: {
          ...existingPrompt.metadata,
          supabase: {
            ...(existingPrompt.metadata as any)?.supabase,
            remoteId: remoteData.id,
            lastPushed: new Date().toISOString(),
            lastSync: new Date().toISOString()
          }
        } as any
      }
    });
  }

  private static async notifyProgress(operationId: string, progress: any): Promise<void> {
    try {
      const operation = await prisma.syncOperation.findUnique({
        where: { id: operationId }
      });

      if (operation) {
        await WebsocketService.broadcastToProject(operation.projectId, {
          type: 'supabase_sync_progress',
          data: {
            operationId,
            progress
          }
        });
      }
    } catch (error) {
      console.warn('Failed to notify sync progress:', error);
    }
  }
}