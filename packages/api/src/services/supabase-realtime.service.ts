import { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_LISTEN_TYPES, REALTIME_POSTGRES_CHANGES_LISTEN_EVENT } from '@supabase/realtime-js';
import { ValidationError, NotFoundError } from '@prompt-lab/shared';
import { PrismaClient } from '../generated/client';
import { SupabaseIntegrationService, SupabaseConnection } from './supabase-integration.service';
import { WebsocketService } from './websocket.service';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema for realtime subscription configuration
export const RealtimeSubscriptionConfigSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: z.string().default('public'),
  events: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE', '*'])).default(['*']),
  filter: z.string().optional(), // e.g., "user_id=eq.123"
  enablePresence: z.boolean().default(false),
  enableBroadcast: z.boolean().default(false),
  bufferSize: z.number().min(1).max(1000).default(100),
  bufferDelay: z.number().min(100).max(10000).default(1000), // ms
  retryAttempts: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(1000).max(30000).default(5000), // ms
  autoReconnect: z.boolean().default(true),
  heartbeatInterval: z.number().min(10000).max(60000).default(30000) // ms
});

export const PresenceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  track: z.record(z.string(), z.any()).optional(),
  syncInitialState: z.boolean().default(true)
});

export const BroadcastConfigSchema = z.object({
  enabled: z.boolean().default(false),
  acknowledgments: z.boolean().default(false),
  selfBroadcast: z.boolean().default(false)
});

export type RealtimeSubscriptionConfig = z.infer<typeof RealtimeSubscriptionConfigSchema>;
export type PresenceConfig = z.infer<typeof PresenceConfigSchema>;
export type BroadcastConfig = z.infer<typeof BroadcastConfigSchema>;

export interface RealtimeSubscription {
  id: string;
  connectionId: string;
  projectId: string;
  userId: string;
  channel: RealtimeChannel;
  config: RealtimeSubscriptionConfig;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'closed';
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
  errorCount: number;
  lastError?: string;
  buffer: RealtimeMessage[];
  presenceState?: Record<string, any>;
  callbacks: {
    onMessage?: (message: RealtimeMessage) => void;
    onPresence?: (presence: any) => void;
    onBroadcast?: (broadcast: any) => void;
    onError?: (error: any) => void;
    onStatusChange?: (status: string) => void;
  };
}

export interface RealtimeMessage {
  id: string;
  type: 'postgres' | 'presence' | 'broadcast' | 'system';
  event: string;
  payload: any;
  timestamp: Date;
  subscriptionId: string;
  retryCount?: number;
}

export interface RealtimeStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalMessages: number;
  messagesPerSecond: number;
  errorRate: number;
  connectionHealth: 'healthy' | 'degraded' | 'unhealthy';
  subscriptionDetails: Array<{
    id: string;
    table: string;
    status: string;
    messageCount: number;
    errorCount: number;
    uptime: number;
  }>;
}

/**
 * Service for managing Supabase realtime subscriptions and connections
 */
export class SupabaseRealtimeService {
  private static subscriptions = new Map<string, RealtimeSubscription>();
  private static connectionPools = new Map<string, SupabaseConnection>();
  private static messageBuffer = new Map<string, RealtimeMessage[]>();
  private static stats = {
    totalMessages: 0,
    startTime: Date.now(),
    lastMessageTime: Date.now()
  };

  /**
   * Create a realtime subscription to a Supabase table
   */
  static async createSubscription(
    connectionId: string,
    projectId: string,
    userId: string,
    config: RealtimeSubscriptionConfig,
    callbacks?: RealtimeSubscription['callbacks']
  ): Promise<RealtimeSubscription> {
    // Validate configuration
    const validatedConfig = RealtimeSubscriptionConfigSchema.parse(config);

    // Get Supabase connection
    const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId, projectId);
    
    if (!connection.enableRealtime) {
      throw new ValidationError('Realtime is not enabled for this connection');
    }

    // Generate subscription ID
    const subscriptionId = `${connectionId}-${projectId}-${validatedConfig.table}-${Date.now()}`;

    // Create channel
    const channelName = `table:${validatedConfig.schema}:${validatedConfig.table}`;
    const channel = connection.client.channel(channelName, {
      config: {
        presence: { key: userId },
        broadcast: { ack: validatedConfig.events.length > 0 }
      }
    });

    // Create subscription object
    const subscription: RealtimeSubscription = {
      id: subscriptionId,
      connectionId,
      projectId,
      userId,
      channel,
      config: validatedConfig,
      status: 'connecting',
      createdAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      errorCount: 0,
      buffer: [],
      callbacks: callbacks || {}
    };

    // Set up event listeners
    await this.setupEventListeners(subscription);

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription);
    this.connectionPools.set(connectionId, connection);

    // Subscribe to channel
    await this.subscribeToChannel(subscription);

    // Store subscription metadata in database
    await this.storeSubscriptionMetadata(subscription);

    return subscription;
  }

  /**
   * Setup event listeners for a subscription
   */
  private static async setupEventListeners(subscription: RealtimeSubscription): Promise<void> {
    const { channel, config, callbacks } = subscription;

    // Postgres changes listeners
    for (const event of config.events) {
      if (event === '*') {
        // Listen to all postgres events
        const allEvents: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT[] = ['INSERT', 'UPDATE', 'DELETE'];
        
        for (const pgEvent of allEvents) {
          channel.on(
            'postgres_changes',
            {
              event: pgEvent,
              schema: config.schema,
              table: config.table,
              filter: config.filter
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              this.handlePostgresChange(subscription, pgEvent, payload);
            }
          );
        }
      } else if (event !== '*') {
        channel.on(
          'postgres_changes',
          {
            event: event as REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
            schema: config.schema,
            table: config.table,
            filter: config.filter
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            this.handlePostgresChange(subscription, event, payload);
          }
        );
      }
    }

    // Presence listeners
    if (config.enablePresence) {
      channel.on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        subscription.presenceState = presenceState;
        
        if (callbacks?.onPresence) {
          callbacks.onPresence(presenceState);
        }

        this.handlePresenceEvent(subscription, 'sync', presenceState);
      });

      channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (callbacks?.onPresence) {
          callbacks.onPresence({ event: 'join', key, newPresences });
        }

        this.handlePresenceEvent(subscription, 'join', { key, newPresences });
      });

      channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        if (callbacks?.onPresence) {
          callbacks.onPresence({ event: 'leave', key, leftPresences });
        }

        this.handlePresenceEvent(subscription, 'leave', { key, leftPresences });
      });
    }

    // Broadcast listeners
    if (config.enableBroadcast) {
      channel.on('broadcast', { event: '*' }, (payload) => {
        if (callbacks?.onBroadcast) {
          callbacks.onBroadcast(payload);
        }

        this.handleBroadcastEvent(subscription, payload);
      });
    }

    // System listeners
    channel.on('system', {}, (payload, ref) => {
      console.log('Supabase system event:', payload, ref);
      
      if (payload.extension === 'postgres_changes') {
        if (payload.status === 'ok') {
          subscription.status = 'connected';
        } else {
          subscription.status = 'error';
          subscription.errorCount++;
          subscription.lastError = payload.message || 'System error';
        }
      }

      if (callbacks?.onStatusChange) {
        callbacks.onStatusChange(subscription.status);
      }

      this.notifyStatusChange(subscription);
    });
  }

  /**
   * Subscribe to channel and handle connection
   */
  private static async subscribeToChannel(subscription: RealtimeSubscription): Promise<void> {
    const { channel, config } = subscription;

    try {
      // Subscribe with timeout
      const subscribePromise = new Promise<void>((resolve, reject) => {
        channel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            subscription.status = 'connected';
            subscription.lastActivity = new Date();
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            subscription.status = 'error';
            subscription.errorCount++;
            subscription.lastError = err?.message || `Subscription failed with status: ${status}`;
            reject(new Error(subscription.lastError));
          }
        });
      });

      // Add timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Subscription timeout')), 10000);
      });

      await Promise.race([subscribePromise, timeoutPromise]);

      // Track presence if enabled
      if (config.enablePresence) {
        await channel.track({
          user_id: subscription.userId,
          project_id: subscription.projectId,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      subscription.status = 'error';
      subscription.errorCount++;
      subscription.lastError = error instanceof Error ? error.message : 'Unknown subscription error';

      // Retry if configured
      if (config.autoReconnect && subscription.errorCount <= config.retryAttempts) {
        setTimeout(() => {
          this.retrySubscription(subscription);
        }, config.retryDelay);
      }

      throw error;
    }
  }

  /**
   * Handle postgres change events
   */
  private static handlePostgresChange(
    subscription: RealtimeSubscription,
    event: string,
    payload: RealtimePostgresChangesPayload<any>
  ): void {
    const message: RealtimeMessage = {
      id: `${subscription.id}-${Date.now()}-${Math.random()}`,
      type: 'postgres',
      event,
      payload,
      timestamp: new Date(),
      subscriptionId: subscription.id
    };

    // Update subscription stats
    subscription.messageCount++;
    subscription.lastActivity = new Date();
    this.stats.totalMessages++;
    this.stats.lastMessageTime = Date.now();

    // Add to buffer
    this.addToBuffer(subscription, message);

    // Call user callback
    if (subscription.callbacks.onMessage) {
      try {
        subscription.callbacks.onMessage(message);
      } catch (error) {
        console.error('Error in user message callback:', error);
      }
    }

    // Broadcast to project WebSocket clients
    this.broadcastToProject(subscription.projectId, {
      type: 'supabase_realtime_change',
      data: {
        subscriptionId: subscription.id,
        table: subscription.config.table,
        event,
        payload: payload,
        timestamp: message.timestamp
      }
    });
  }

  /**
   * Handle presence events
   */
  private static handlePresenceEvent(
    subscription: RealtimeSubscription,
    event: string,
    data: any
  ): void {
    const message: RealtimeMessage = {
      id: `${subscription.id}-presence-${Date.now()}`,
      type: 'presence',
      event,
      payload: data,
      timestamp: new Date(),
      subscriptionId: subscription.id
    };

    subscription.messageCount++;
    subscription.lastActivity = new Date();

    this.addToBuffer(subscription, message);

    // Broadcast presence updates
    this.broadcastToProject(subscription.projectId, {
      type: 'supabase_presence_change',
      data: {
        subscriptionId: subscription.id,
        event,
        data,
        timestamp: message.timestamp
      }
    });
  }

  /**
   * Handle broadcast events
   */
  private static handleBroadcastEvent(
    subscription: RealtimeSubscription,
    payload: any
  ): void {
    const message: RealtimeMessage = {
      id: `${subscription.id}-broadcast-${Date.now()}`,
      type: 'broadcast',
      event: payload.event || 'message',
      payload: payload.payload || payload,
      timestamp: new Date(),
      subscriptionId: subscription.id
    };

    subscription.messageCount++;
    subscription.lastActivity = new Date();

    this.addToBuffer(subscription, message);

    // Broadcast to project
    this.broadcastToProject(subscription.projectId, {
      type: 'supabase_broadcast',
      data: {
        subscriptionId: subscription.id,
        payload: payload,
        timestamp: message.timestamp
      }
    });
  }

  /**
   * Add message to buffer with overflow management
   */
  private static addToBuffer(subscription: RealtimeSubscription, message: RealtimeMessage): void {
    subscription.buffer.push(message);

    // Maintain buffer size
    if (subscription.buffer.length > subscription.config.bufferSize) {
      subscription.buffer = subscription.buffer.slice(-subscription.config.bufferSize);
    }

    // Also maintain global buffer
    let globalBuffer = this.messageBuffer.get(subscription.id) || [];
    globalBuffer.push(message);
    
    if (globalBuffer.length > subscription.config.bufferSize) {
      globalBuffer = globalBuffer.slice(-subscription.config.bufferSize);
    }
    
    this.messageBuffer.set(subscription.id, globalBuffer);
  }

  /**
   * Broadcast message using WebSocket service
   */
  private static async broadcastToProject(projectId: string, message: any): Promise<void> {
    try {
      await WebsocketService.broadcastToProject(projectId, message);
    } catch (error) {
      console.error('Failed to broadcast realtime message:', error);
    }
  }

  /**
   * Notify about subscription status changes
   */
  private static async notifyStatusChange(subscription: RealtimeSubscription): Promise<void> {
    await this.broadcastToProject(subscription.projectId, {
      type: 'supabase_subscription_status',
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        errorCount: subscription.errorCount,
        lastError: subscription.lastError,
        timestamp: new Date()
      }
    });
  }

  /**
   * Retry failed subscription
   */
  private static async retrySubscription(subscription: RealtimeSubscription): Promise<void> {
    console.log(`Retrying subscription ${subscription.id}, attempt ${subscription.errorCount}/${subscription.config.retryAttempts}`);

    try {
      // Reset channel
      const connection = this.connectionPools.get(subscription.connectionId);
      if (!connection) {
        throw new Error('Connection not found in pool');
      }

      const channelName = `table:${subscription.config.schema}:${subscription.config.table}`;
      subscription.channel = connection.client.channel(channelName);

      // Resubscribe
      await this.setupEventListeners(subscription);
      await this.subscribeToChannel(subscription);

      console.log(`Successfully reconnected subscription ${subscription.id}`);
    } catch (error) {
      console.error(`Failed to retry subscription ${subscription.id}:`, error);
      
      if (subscription.errorCount >= subscription.config.retryAttempts) {
        subscription.status = 'error';
        await this.notifyStatusChange(subscription);
      }
    }
  }

  /**
   * Get subscription by ID
   */
  static getSubscription(subscriptionId: string): RealtimeSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * List subscriptions for a project
   */
  static getProjectSubscriptions(projectId: string): RealtimeSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      sub => sub.projectId === projectId
    );
  }

  /**
   * Close subscription
   */
  static async closeSubscription(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new NotFoundError(`Subscription ${subscriptionId} not found`);
    }

    try {
      // Unsubscribe from channel
      await subscription.channel.unsubscribe();
      subscription.status = 'closed';

      // Remove from maps
      this.subscriptions.delete(subscriptionId);
      this.messageBuffer.delete(subscriptionId);

      // Notify status change
      await this.notifyStatusChange(subscription);

      // Clean up database metadata
      await this.removeSubscriptionMetadata(subscriptionId);

    } catch (error) {
      console.error(`Error closing subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Close all subscriptions for a project
   */
  static async closeProjectSubscriptions(projectId: string): Promise<void> {
    const projectSubscriptions = this.getProjectSubscriptions(projectId);
    
    await Promise.all(
      projectSubscriptions.map(sub => this.closeSubscription(sub.id))
    );
  }

  /**
   * Send broadcast message through subscription
   */
  static async sendBroadcast(
    subscriptionId: string,
    event: string,
    payload: any
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new NotFoundError(`Subscription ${subscriptionId} not found`);
    }

    if (!subscription.config.enableBroadcast) {
      throw new ValidationError('Broadcast is not enabled for this subscription');
    }

    if (subscription.status !== 'connected') {
      throw new ValidationError('Subscription is not connected');
    }

    try {
      await subscription.channel.send({
        type: 'broadcast',
        event,
        payload
      });
    } catch (error) {
      subscription.errorCount++;
      subscription.lastError = error instanceof Error ? error.message : 'Broadcast failed';
      throw error;
    }
  }

  /**
   * Get realtime statistics
   */
  static getRealtimeStats(): RealtimeStats {
    const now = Date.now();
    const uptime = now - this.stats.startTime;
    const timeSinceLastMessage = now - this.stats.lastMessageTime;
    
    const totalSubscriptions = this.subscriptions.size;
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.status === 'connected'
    ).length;

    const messagesPerSecond = uptime > 0 ? (this.stats.totalMessages / (uptime / 1000)) : 0;
    
    const totalErrors = Array.from(this.subscriptions.values()).reduce(
      (sum, sub) => sum + sub.errorCount, 0
    );
    const errorRate = this.stats.totalMessages > 0 ? (totalErrors / this.stats.totalMessages) : 0;

    let connectionHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 0.1 || activeSubscriptions < totalSubscriptions * 0.5) {
      connectionHealth = 'unhealthy';
    } else if (errorRate > 0.05 || timeSinceLastMessage > 300000) { // 5 minutes
      connectionHealth = 'degraded';
    }

    const subscriptionDetails = Array.from(this.subscriptions.values()).map(sub => ({
      id: sub.id,
      table: sub.config.table,
      status: sub.status,
      messageCount: sub.messageCount,
      errorCount: sub.errorCount,
      uptime: now - sub.createdAt.getTime()
    }));

    return {
      totalSubscriptions,
      activeSubscriptions,
      totalMessages: this.stats.totalMessages,
      messagesPerSecond,
      errorRate,
      connectionHealth,
      subscriptionDetails
    };
  }

  /**
   * Get buffered messages for a subscription
   */
  static getBufferedMessages(
    subscriptionId: string,
    limit?: number,
    offset?: number
  ): RealtimeMessage[] {
    const buffer = this.messageBuffer.get(subscriptionId) || [];
    
    if (!limit) return buffer;
    
    const start = offset || 0;
    const end = start + limit;
    
    return buffer.slice(start, end);
  }

  /**
   * Health check for all subscriptions
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: RealtimeStats;
  }> {
    const stats = this.getRealtimeStats();
    const issues: string[] = [];

    // Check for unhealthy subscriptions
    const unhealthySubs = Array.from(this.subscriptions.values()).filter(
      sub => sub.status === 'error' || sub.errorCount > 5
    );

    if (unhealthySubs.length > 0) {
      issues.push(`${unhealthySubs.length} unhealthy subscriptions`);
    }

    // Check for stale connections
    const now = Date.now();
    const staleSubs = Array.from(this.subscriptions.values()).filter(
      sub => now - sub.lastActivity.getTime() > 600000 // 10 minutes
    );

    if (staleSubs.length > 0) {
      issues.push(`${staleSubs.length} stale connections`);
    }

    // Check error rate
    if (stats.errorRate > 0.1) {
      issues.push(`High error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
    }

    return {
      healthy: issues.length === 0 && stats.connectionHealth === 'healthy',
      issues,
      stats
    };
  }

  // Private helper methods

  private static async storeSubscriptionMetadata(subscription: RealtimeSubscription): Promise<void> {
    // In a production system, you might want to store subscription metadata
    // in the database for persistence across restarts
    try {
      // This could be stored in a subscriptions table
      console.debug(`Storing metadata for subscription ${subscription.id}`);
    } catch (error) {
      console.warn('Failed to store subscription metadata:', error);
    }
  }

  private static async removeSubscriptionMetadata(subscriptionId: string): Promise<void> {
    try {
      // Remove subscription metadata from database
      console.debug(`Removing metadata for subscription ${subscriptionId}`);
    } catch (error) {
      console.warn('Failed to remove subscription metadata:', error);
    }
  }
}