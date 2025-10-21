import { PrismaClient, QueueJob } from '../generated/client';
import { TestExecutionService } from './test-execution.service';
import { TestingPipelineService } from './testing-pipeline.service';
import { PromptSyncService } from './prompt-sync.service';
import { SafeDeploymentService } from './safe-deployment.service';
import { DependencyManagerService } from './dependency-manager.service';

const prisma = new PrismaClient();

export interface JobData {
  [key: string]: any;
}

export interface JobConfig {
  type: string;
  data: JobData;
  priority?: number;
  delay?: number; // milliseconds
  retryAttempts?: number;
  timeout?: number; // milliseconds
}

export interface RecurringJobConfig {
  type: string;
  data: JobData;
  interval: number; // milliseconds
  priority?: number;
  enabled?: boolean;
}

export class QueueService {
  private static isProcessing = false;
  private static processingInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the queue processor
   */
  static initialize(): void {
    this.startProcessor();
  }

  /**
   * Add a job to the queue
   */
  static async addJob(config: JobConfig): Promise<QueueJob> {
    const scheduleAt = config.delay ? new Date(Date.now() + config.delay) : new Date();
    
    const job = await prisma.queueJob.create({
      data: {
        type: config.type,
        data: config.data,
        priority: config.priority || 0,
        maxAttempts: config.retryAttempts || 3,
        status: 'pending',
        metadata: {
          scheduleAt: scheduleAt.toISOString(),
          timeout: config.timeout || 300000, // 5 minutes default
          createdBy: 'system'
        } as any
      },
    });

    // Trigger immediate processing if not already running and no delay
    if (!this.isProcessing && !config.delay) {
      this.processNextJob();
    }

    return job;
  }

  /**
   * Add a recurring job
   */
  static async addRecurringJob(config: RecurringJobConfig): Promise<void> {
    // Store recurring job configuration
    await prisma.recurringJob.create({
      data: {
        type: config.type,
        data: config.data as any,
        interval: config.interval,
        priority: config.priority || 0,
        enabled: config.enabled !== false,
        nextRun: new Date(Date.now() + config.interval)
      }
    });

    // Schedule the first execution
    await this.addJob({
      type: config.type,
      data: config.data,
      priority: config.priority,
      delay: config.interval
    });
  }

  /**
   * Cancel a job
   */
  static async cancelJob(type: string, data: Partial<JobData>): Promise<number> {
    const result = await prisma.queueJob.updateMany({
      where: {
        type,
        status: { in: ['pending', 'active'] },
        // Simple data matching - in production, you'd want more sophisticated matching
        data: { path: Object.keys(data), hasEvery: Object.values(data) }
      },
      data: {
        status: 'cancelled',
        error: 'Cancelled by user request'
      }
    });

    return result.count;
  }

  /**
   * Cancel recurring job
   */
  static async cancelRecurringJob(type: string, data: Partial<JobData>): Promise<void> {
    await prisma.recurringJob.updateMany({
      where: {
        type,
        enabled: true
      },
      data: {
        enabled: false
      }
    });
  }

  /**
   * Remove a job from the queue
   */
  static async removeJob(jobId: string): Promise<void> {
    await prisma.queueJob.delete({
      where: { id: jobId },
    });
  }

  /**
   * Start the queue processor
   */
  private static startProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Check for jobs every 5 seconds
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processNextJob();
      }
    }, 5000);
  }

  /**
   * Process the next job in the queue
   */
  private static async processNextJob(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      // Get the next pending job with highest priority
      const job = await prisma.queueJob.findFirst({
        where: { status: 'pending' },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      if (!job) {
        this.isProcessing = false;
        return;
      }

      // Mark job as active
      await prisma.queueJob.update({
        where: { id: job.id },
        data: {
          status: 'active',
          processedAt: new Date(),
        },
      });

      try {
        // Process the job based on type
        await this.executeJob(job);

        // Mark job as completed
        await prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
          },
        });

      } catch (error) {
        // Handle job failure
        const attempts = job.attempts + 1;
        const shouldRetry = attempts < job.maxAttempts;

        if (shouldRetry) {
          // Retry the job
          await prisma.queueJob.update({
            where: { id: job.id },
            data: {
              status: 'pending',
              attempts,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        } else {
          // Mark as failed
          await prisma.queueJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              attempts,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }

        console.error(`Job ${job.id} failed:`, error);
      }

    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
      
      // Check for more jobs after a short delay
      setTimeout(() => {
        if (!this.isProcessing) {
          this.processNextJob();
        }
      }, 1000);
    }
  }

  /**
   * Execute a specific job based on its type
   */
  private static async executeJob(job: QueueJob): Promise<void> {
    const data = job.data as JobData;
    const timeout = job.metadata?.timeout || 300000; // 5 minutes default

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Job execution timeout')), timeout);
    });

    // Execute job with timeout
    const executionPromise = this.executeJobByType(job.type, data);

    try {
      await Promise.race([executionPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Job execution timeout') {
        throw new Error(`Job ${job.id} timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Execute job by type
   */
  private static async executeJobByType(type: string, data: JobData): Promise<void> {
    switch (type) {
      case 'test_execution':
        await TestExecutionService.executeTestRun(data.testRunId);
        break;
      
      case 'batch_test':
        await this.executeBatchTest(data);
        break;
      
      case 'pipeline_execution':
        await TestingPipelineService.runPipelineExecution(
          data.executionId,
          data.pipeline,
          data.prompt,
          data.options
        );
        break;

      case 'prompt_sync':
        await PromptSyncService.executeSyncOperation(
          data.operationId,
          data.connection,
          data.projectId,
          data.userId,
          data.config
        );
        break;

      case 'auto_prompt_sync':
        // For recurring auto-sync jobs
        await this.executeAutoSync(data);
        break;

      case 'deployment_execution':
        await SafeDeploymentService.runDeploymentExecution(
          data.executionId,
          data.plan,
          data.options
        );
        break;

      case 'dependency_update':
        await DependencyManagerService.executeDependencyUpdates(
          data.userId,
          data.projectId,
          data.planId,
          data.options
        );
        break;

      case 'health_check':
        await this.executeHealthCheck(data);
        break;
      
      case 'cleanup':
        await this.executeCleanupJob(data);
        break;

      case 'webhook_retry':
        await this.executeWebhookRetry(data);
        break;
      
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  }

  /**
   * Execute batch test job
   */
  private static async executeBatchTest(data: JobData): Promise<void> {
    // This would handle batch testing across multiple prompts
    const { testRunIds } = data;
    
    for (const testRunId of testRunIds) {
      await TestExecutionService.executeTestRun(testRunId);
    }
  }

  /**
   * Execute cleanup job
   */
  private static async executeCleanupJob(data: JobData): Promise<void> {
    const { type, olderThan } = data;
    const cutoffDate = new Date(Date.now() - olderThan * 24 * 60 * 60 * 1000);

    switch (type) {
      case 'completed_jobs':
        await prisma.queueJob.deleteMany({
          where: {
            status: 'completed',
            createdAt: { lt: cutoffDate },
          },
        });
        break;
      
      case 'failed_jobs':
        await prisma.queueJob.deleteMany({
          where: {
            status: 'failed',
            createdAt: { lt: cutoffDate },
          },
        });
        break;
    }
  }

  /**
   * Get queue status
   */
  static async getQueueStatus(): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const [pending, active, completed, failed] = await Promise.all([
      prisma.queueJob.count({ where: { status: 'pending' } }),
      prisma.queueJob.count({ where: { status: 'active' } }),
      prisma.queueJob.count({ where: { status: 'completed' } }),
      prisma.queueJob.count({ where: { status: 'failed' } }),
    ]);

    return {
      pending,
      active,
      completed,
      failed,
      total: pending + active + completed + failed,
    };
  }

  /**
   * Get jobs by status
   */
  static async getJobsByStatus(
    status: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<QueueJob[]> {
    return prisma.queueJob.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Clear completed jobs older than specified days
   */
  static async cleanupCompletedJobs(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    const result = await prisma.queueJob.deleteMany({
      where: {
        status: 'completed',
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Retry failed jobs
   */
  static async retryFailedJobs(): Promise<number> {
    const result = await prisma.queueJob.updateMany({
      where: { status: 'failed' },
      data: {
        status: 'pending',
        attempts: 0,
        error: null,
      },
    });

    // Trigger processing
    if (!this.isProcessing) {
      this.processNextJob();
    }

    return result.count;
  }

  /**
   * Stop the queue processor
   */
  static stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
  }

  /**
   * Execute auto-sync job
   */
  private static async executeAutoSync(data: JobData): Promise<void> {
    const { connectionId, projectId, direction, conflictResolution } = data;
    
    // Start a new sync operation
    await PromptSyncService.startSync('system', projectId, connectionId, {
      direction,
      strategy: 'safe',
      conflictResolution,
      autoResolve: true
    });

    // Schedule next execution
    const connection = await prisma.appIntegration.findUnique({
      where: { id: connectionId }
    });

    if (connection?.syncConfig?.autoSync && connection.syncConfig.syncInterval) {
      await this.addJob({
        type: 'auto_prompt_sync',
        data,
        delay: connection.syncConfig.syncInterval * 60 * 1000, // Convert minutes to milliseconds
        priority: 0
      });
    }
  }

  /**
   * Execute health check job
   */
  private static async executeHealthCheck(data: JobData): Promise<void> {
    const { projectId, type } = data;

    switch (type) {
      case 'dependencies':
        await DependencyManagerService.monitorDependencyHealth('system', projectId);
        break;
      case 'integrations':
        // Check integration health
        const integrations = await prisma.appIntegration.findMany({
          where: { projectId, isActive: true }
        });
        
        for (const integration of integrations) {
          // Perform health check for each integration
          console.log(`Health check for integration ${integration.name}`);
        }
        break;
    }
  }

  /**
   * Execute webhook retry job
   */
  private static async executeWebhookRetry(data: JobData): Promise<void> {
    const { webhookId, payload, url, headers } = data;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      // Mark webhook as successful
      await prisma.webhookDelivery.update({
        where: { id: webhookId },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          response: {
            status: response.status,
            statusText: response.statusText
          } as any
        }
      });

    } catch (error) {
      // Mark webhook as failed
      await prisma.webhookDelivery.update({
        where: { id: webhookId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          attempts: { increment: 1 }
        }
      });
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  static async getJobById(jobId: string): Promise<QueueJob | null> {
    return prisma.queueJob.findUnique({
      where: { id: jobId }
    });
  }

  /**
   * Get jobs by project
   */
  static async getJobsByProject(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<QueueJob[]> {
    return prisma.queueJob.findMany({
      where: {
        OR: [
          { data: { path: ['projectId'], equals: projectId } },
          { data: { path: ['project_id'], equals: projectId } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Schedule recurring cleanup job
   */
  static async scheduleCleanup(): Promise<void> {
    // Add cleanup job for completed jobs older than 7 days
    await this.addJob({
      type: 'cleanup',
      data: {
        type: 'completed_jobs',
        olderThan: 7,
      },
      priority: -1 // Low priority
    });

    // Add cleanup job for failed jobs older than 30 days
    await this.addJob({
      type: 'cleanup',
      data: {
        type: 'failed_jobs',
        olderThan: 30,
      },
      priority: -1
    });
  }

  /**
   * Process scheduled jobs
   */
  static async processScheduledJobs(): Promise<void> {
    const now = new Date();
    
    // Find jobs that are scheduled to run
    const scheduledJobs = await prisma.queueJob.findMany({
      where: {
        status: 'pending',
        metadata: {
          path: ['scheduleAt'],
          lte: now.toISOString()
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 10 // Process up to 10 jobs at once
    });

    for (const job of scheduledJobs) {
      if (!this.isProcessing) {
        this.processNextJob();
        break;
      }
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<{
    byStatus: { [status: string]: number };
    byType: { [type: string]: number };
    avgProcessingTime: number;
    totalJobs: number;
  }> {
    const jobs = await prisma.queueJob.findMany({
      select: {
        status: true,
        type: true,
        createdAt: true,
        processedAt: true
      }
    });

    const byStatus: { [status: string]: number } = {};
    const byType: { [type: string]: number } = {};
    let totalProcessingTime = 0;
    let processedCount = 0;

    for (const job of jobs) {
      // Count by status
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
      
      // Count by type
      byType[job.type] = (byType[job.type] || 0) + 1;

      // Calculate processing time
      if (job.processedAt) {
        const processingTime = job.processedAt.getTime() - job.createdAt.getTime();
        totalProcessingTime += processingTime;
        processedCount++;
      }
    }

    return {
      byStatus,
      byType,
      avgProcessingTime: processedCount > 0 ? totalProcessingTime / processedCount : 0,
      totalJobs: jobs.length
    };
  }
}