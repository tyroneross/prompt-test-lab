import { PrismaClient } from '../generated/client';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { ProjectService } from './project.service';
import { QueueService } from './queue.service';
import { z } from 'zod';

const prisma = new PrismaClient();

export interface WebhookConfig {
  url: string;
  events: string[];
  headers?: Record<string, string>;
  secret?: string;
  enabled?: boolean;
  retryAttempts?: number;
}

export interface WebhookEvent {
  type: string;
  data: any;
  projectId?: string;
  userId?: string;
  timestamp: Date;
  id?: string;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  headers: Record<string, string>;
  secret?: string;
  enabled: boolean;
  retryAttempts: number;
  projectId?: string;
  createdAt: Date;
  lastDelivery?: Date;
  totalDeliveries: number;
  failedDeliveries: number;
}

/**
 * Service for managing webhooks and real-time event notifications
 */
export class WebhookService {
  private static readonly SUPPORTED_EVENTS = [
    'prompt.created',
    'prompt.updated',
    'prompt.deleted',
    'test_run.started',
    'test_run.completed',
    'test_run.failed',
    'sync.started',
    'sync.completed',
    'sync.failed',
    'deployment.started',
    'deployment.completed',
    'deployment.failed',
    'dependency.health_check',
    'pipeline.executed',
    'approval.requested',
    'approval.approved',
    'approval.rejected'
  ];

  /**
   * Register a webhook subscription
   */
  static async createWebhook(
    userId: string,
    projectId: string,
    config: WebhookConfig
  ): Promise<WebhookSubscription> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to create webhooks');
    }

    // Validate webhook configuration
    this.validateWebhookConfig(config);

    // Test webhook endpoint
    await this.testWebhookEndpoint(config.url, config.headers);

    // Create webhook subscription
    const webhook = await prisma.webhookSubscription.create({
      data: {
        projectId,
        url: config.url,
        events: config.events,
        headers: config.headers || {},
        secret: config.secret,
        enabled: config.enabled !== false,
        retryAttempts: config.retryAttempts || 3,
        createdBy: userId
      }
    });

    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      headers: webhook.headers as Record<string, string>,
      secret: webhook.secret || undefined,
      enabled: webhook.enabled,
      retryAttempts: webhook.retryAttempts,
      projectId: webhook.projectId || undefined,
      createdAt: webhook.createdAt,
      totalDeliveries: 0,
      failedDeliveries: 0
    };
  }

  /**
   * Update webhook subscription
   */
  static async updateWebhook(
    userId: string,
    webhookId: string,
    updates: Partial<WebhookConfig>
  ): Promise<WebhookSubscription> {
    const webhook = await this.getWebhookById(webhookId);
    
    if (webhook.projectId) {
      // Check permissions
      const userRole = await ProjectService.getUserProjectRole(webhook.projectId, userId);
      if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
        throw new AuthorizationError('Insufficient permissions to update webhook');
      }
    }

    // Validate updates
    if (updates.events) {
      this.validateEvents(updates.events);
    }

    if (updates.url) {
      await this.testWebhookEndpoint(updates.url, updates.headers);
    }

    // Update webhook
    const updatedWebhook = await prisma.webhookSubscription.update({
      where: { id: webhookId },
      data: {
        url: updates.url,
        events: updates.events,
        headers: updates.headers as any,
        secret: updates.secret,
        enabled: updates.enabled,
        retryAttempts: updates.retryAttempts
      }
    });

    return this.formatWebhookSubscription(updatedWebhook);
  }

  /**
   * Delete webhook subscription
   */
  static async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const webhook = await this.getWebhookById(webhookId);
    
    if (webhook.projectId) {
      // Check permissions
      const userRole = await ProjectService.getUserProjectRole(webhook.projectId, userId);
      if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
        throw new AuthorizationError('Insufficient permissions to delete webhook');
      }
    }

    await prisma.webhookSubscription.delete({
      where: { id: webhookId }
    });
  }

  /**
   * Get webhook subscriptions for a project
   */
  static async getProjectWebhooks(
    userId: string,
    projectId: string
  ): Promise<WebhookSubscription[]> {
    // Check permissions
    await ProjectService.getProjectById(projectId, userId);

    const webhooks = await prisma.webhookSubscription.findMany({
      where: { projectId },
      include: {
        _count: {
          select: {
            deliveries: true,
            failedDeliveries: true
          }
        }
      }
    });

    return webhooks.map(webhook => ({
      ...this.formatWebhookSubscription(webhook),
      totalDeliveries: webhook._count.deliveries,
      failedDeliveries: webhook._count.failedDeliveries
    }));
  }

  /**
   * Trigger webhook events
   */
  static async triggerEvent(event: WebhookEvent): Promise<void> {
    // Find matching webhook subscriptions
    const webhooks = await this.findMatchingWebhooks(event);

    for (const webhook of webhooks) {
      await this.deliverWebhook(webhook, event);
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  private static async deliverWebhook(
    webhook: any,
    event: WebhookEvent
  ): Promise<void> {
    const payload = {
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp.toISOString(),
      projectId: event.projectId
    };

    // Add signature if secret is provided
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PromptLab-Webhooks/1.0',
      ...webhook.headers
    };

    if (webhook.secret) {
      headers['X-Webhook-Signature'] = this.generateSignature(
        JSON.stringify(payload),
        webhook.secret
      );
    }

    // Create webhook delivery record
    const delivery = await prisma.webhookDelivery.create({
      data: {
        url: webhook.url,
        payload: payload as any,
        headers: headers as any,
        eventType: event.type,
        projectId: event.projectId,
        maxAttempts: webhook.retryAttempts,
        status: 'pending'
      }
    });

    // Queue webhook delivery
    await QueueService.addJob({
      type: 'webhook_retry',
      data: {
        webhookId: delivery.id,
        payload,
        url: webhook.url,
        headers
      },
      retryAttempts: webhook.retryAttempts,
      timeout: 30000 // 30 seconds
    });
  }

  /**
   * Get webhook delivery status
   */
  static async getWebhookDeliveries(
    userId: string,
    webhookId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const webhook = await this.getWebhookById(webhookId);
    
    if (webhook.projectId) {
      // Check permissions
      await ProjectService.getProjectById(webhook.projectId, userId);
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        url: webhook.url,
        projectId: webhook.projectId
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    return deliveries.map(delivery => ({
      id: delivery.id,
      eventType: delivery.eventType,
      status: delivery.status,
      attempts: delivery.attempts,
      response: delivery.response,
      error: delivery.error,
      deliveredAt: delivery.deliveredAt,
      createdAt: delivery.createdAt
    }));
  }

  /**
   * Retry failed webhook deliveries
   */
  static async retryFailedDeliveries(
    userId: string,
    webhookId: string
  ): Promise<{ retried: number }> {
    const webhook = await this.getWebhookById(webhookId);
    
    if (webhook.projectId) {
      // Check permissions
      const userRole = await ProjectService.getUserProjectRole(webhook.projectId, userId);
      if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
        throw new AuthorizationError('Insufficient permissions to retry webhooks');
      }
    }

    // Find failed deliveries
    const failedDeliveries = await prisma.webhookDelivery.findMany({
      where: {
        url: webhook.url,
        status: 'failed',
        attempts: { lt: webhook.retryAttempts }
      },
      take: 10 // Limit to prevent overwhelming
    });

    let retried = 0;
    for (const delivery of failedDeliveries) {
      // Reset delivery status and queue for retry
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'pending', error: null }
      });

      await QueueService.addJob({
        type: 'webhook_retry',
        data: {
          webhookId: delivery.id,
          payload: delivery.payload,
          url: delivery.url,
          headers: delivery.headers
        },
        retryAttempts: webhook.retryAttempts - delivery.attempts
      });

      retried++;
    }

    return { retried };
  }

  /**
   * Test webhook endpoint
   */
  static async testWebhook(userId: string, webhookId: string): Promise<{
    success: boolean;
    status?: number;
    response?: string;
    error?: string;
    latency: number;
  }> {
    const webhook = await this.getWebhookById(webhookId);
    
    if (webhook.projectId) {
      // Check permissions
      await ProjectService.getProjectById(webhook.projectId, userId);
    }

    const testPayload = {
      id: `test_${Date.now()}`,
      type: 'webhook.test',
      data: { message: 'This is a test webhook from Prompt Testing Lab' },
      timestamp: new Date().toISOString(),
      projectId: webhook.projectId
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PromptLab-Webhooks/1.0',
      ...webhook.headers
    };

    if (webhook.secret) {
      headers['X-Webhook-Signature'] = this.generateSignature(
        JSON.stringify(testPayload),
        webhook.secret
      );
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload)
      });

      const latency = Date.now() - startTime;
      const responseText = await response.text();

      return {
        success: response.ok,
        status: response.status,
        response: responseText,
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency
      };
    }
  }

  // Private helper methods

  private static validateWebhookConfig(config: WebhookConfig): void {
    // Validate URL
    try {
      new URL(config.url);
    } catch {
      throw new ValidationError('Invalid webhook URL');
    }

    // Validate events
    this.validateEvents(config.events);

    // Validate retry attempts
    if (config.retryAttempts !== undefined && 
        (config.retryAttempts < 0 || config.retryAttempts > 10)) {
      throw new ValidationError('Retry attempts must be between 0 and 10');
    }
  }

  private static validateEvents(events: string[]): void {
    if (!events || events.length === 0) {
      throw new ValidationError('At least one event must be specified');
    }

    const invalidEvents = events.filter(event => 
      !this.SUPPORTED_EVENTS.includes(event)
    );

    if (invalidEvents.length > 0) {
      throw new ValidationError(
        `Unsupported events: ${invalidEvents.join(', ')}`
      );
    }
  }

  private static async testWebhookEndpoint(
    url: string,
    headers?: Record<string, string>
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          type: 'webhook.test',
          data: { test: true }
        })
      });

      // Allow any 2xx or 3xx response for test
      if (response.status >= 400) {
        throw new ValidationError(
          `Webhook endpoint test failed with status ${response.status}`
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      
      throw new ValidationError(
        `Unable to reach webhook endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private static async getWebhookById(webhookId: string): Promise<any> {
    const webhook = await prisma.webhookSubscription.findUnique({
      where: { id: webhookId }
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    return webhook;
  }

  private static async findMatchingWebhooks(event: WebhookEvent): Promise<any[]> {
    const whereClause: any = {
      enabled: true,
      events: { has: event.type }
    };

    if (event.projectId) {
      whereClause.projectId = event.projectId;
    }

    return prisma.webhookSubscription.findMany({
      where: whereClause
    });
  }

  private static generateSignature(payload: string, secret: string): string {
    const crypto = require('crypto');
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private static formatWebhookSubscription(webhook: any): WebhookSubscription {
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      headers: webhook.headers,
      secret: webhook.secret || undefined,
      enabled: webhook.enabled,
      retryAttempts: webhook.retryAttempts,
      projectId: webhook.projectId || undefined,
      createdAt: webhook.createdAt,
      lastDelivery: webhook.lastDelivery || undefined,
      totalDeliveries: 0,
      failedDeliveries: 0
    };
  }

  /**
   * Clean up old webhook deliveries
   */
  static async cleanupOldDeliveries(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    const result = await prisma.webhookDelivery.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ['delivered', 'failed'] }
      }
    });

    return result.count;
  }

  /**
   * Get supported webhook events
   */
  static getSupportedEvents(): string[] {
    return [...this.SUPPORTED_EVENTS];
  }

  /**
   * Get webhook statistics
   */
  static async getWebhookStats(
    userId: string,
    projectId: string
  ): Promise<{
    totalWebhooks: number;
    activeWebhooks: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageLatency: number;
  }> {
    // Check permissions
    await ProjectService.getProjectById(projectId, userId);

    const [webhookStats, deliveryStats] = await Promise.all([
      prisma.webhookSubscription.aggregate({
        where: { projectId },
        _count: { _all: true },
        _sum: { enabled: true }
      }),
      prisma.webhookDelivery.aggregate({
        where: { projectId },
        _count: {
          _all: true,
          status: true
        }
      })
    ]);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { 
        projectId,
        deliveredAt: { not: null }
      },
      select: {
        createdAt: true,
        deliveredAt: true
      }
    });

    const totalLatency = deliveries.reduce((sum, delivery) => {
      if (delivery.deliveredAt) {
        return sum + (delivery.deliveredAt.getTime() - delivery.createdAt.getTime());
      }
      return sum;
    }, 0);

    return {
      totalWebhooks: webhookStats._count._all,
      activeWebhooks: webhookStats._sum.enabled || 0,
      totalDeliveries: deliveryStats._count._all,
      successfulDeliveries: await prisma.webhookDelivery.count({
        where: { projectId, status: 'delivered' }
      }),
      failedDeliveries: await prisma.webhookDelivery.count({
        where: { projectId, status: 'failed' }
      }),
      averageLatency: deliveries.length > 0 ? totalLatency / deliveries.length : 0
    };
  }
}