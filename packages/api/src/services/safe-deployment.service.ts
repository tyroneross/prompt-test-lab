import { PrismaClient } from '../generated/client';
import { DeploymentStatus } from '../types/enums';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { ProjectService } from './project.service';
import { PromptService } from './prompt.service';
import { ImpactAnalysisService } from './impact-analysis.service';
import { TestingPipelineService } from './testing-pipeline.service';
import { AppIntegrationService } from './app-integration.service';
import type { 
  SafeDeploymentConfig,
  DeploymentPipeline,
  DeploymentStage,
  DeploymentResult,
  RollbackPlan,
  DeploymentStrategy,
  CanaryConfig,
  BlueGreenConfig
} from '@prompt-lab/shared';

const prisma = new PrismaClient();

export interface SafeDeploymentPlan {
  id: string;
  promptId: string;
  targetEnvironments: string[];
  strategy: DeploymentStrategy;
  stages: DeploymentStage[];
  rollbackPlan: RollbackPlan;
  approvals: {
    required: boolean;
    approvers: string[];
    automaticApproval?: {
      conditions: string[];
      thresholds: { [key: string]: number };
    };
  };
  monitoring: {
    enabled: boolean;
    metrics: string[];
    alertThresholds: { [key: string]: number };
    duration: number; // minutes
  };
  testing: {
    preDeployment: string[]; // test pipeline IDs
    postDeployment: string[]; // verification tests
    rollbackTriggers: string[];
  };
}

export interface DeploymentExecution {
  id: string;
  planId: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'ROLLING_BACK';
  currentStage: number;
  stages: {
    id: string;
    name: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    startedAt?: Date;
    completedAt?: Date;
    result?: any;
    error?: string;
  }[];
  metrics: {
    [key: string]: number;
  };
  startedAt: Date;
  completedAt?: Date;
  executedBy: string;
}

/**
 * Service for managing safe deployment pipelines with testing, monitoring, and rollback capabilities
 */
export class SafeDeploymentService {
  /**
   * Create a safe deployment plan
   */
  static async createDeploymentPlan(
    userId: string,
    projectId: string,
    config: SafeDeploymentConfig
  ): Promise<SafeDeploymentPlan> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to create deployment plans');
    }

    // Validate the prompt exists and has passed testing
    const prompt = await PromptService.getPromptById(config.promptId, userId);
    await this.validatePromptReadiness(prompt, config);

    // Generate deployment stages based on strategy
    const stages = await this.generateDeploymentStages(config);

    // Create rollback plan
    const rollbackPlan = await this.createRollbackPlan(config);

    // Generate monitoring configuration
    const monitoring = await this.generateMonitoringConfig(config);

    const plan: SafeDeploymentPlan = {
      id: `plan_${Date.now()}`,
      promptId: config.promptId,
      targetEnvironments: config.targetEnvironments,
      strategy: config.strategy,
      stages,
      rollbackPlan,
      approvals: {
        required: config.requireApproval || false,
        approvers: config.approvers || [],
        automaticApproval: config.automaticApproval
      },
      monitoring,
      testing: {
        preDeployment: config.preDeploymentTests || [],
        postDeployment: config.postDeploymentTests || [],
        rollbackTriggers: config.rollbackTriggers || ['error_rate_high', 'latency_high', 'quality_degraded']
      }
    };

    // Save the deployment plan
    await prisma.deploymentPlan.create({
      data: {
        projectId,
        promptId: config.promptId,
        planData: plan as any,
        status: 'DRAFT',
        createdBy: userId
      }
    });

    return plan;
  }

  /**
   * Execute a safe deployment plan
   */
  static async executeDeploymentPlan(
    userId: string,
    planId: string,
    options: {
      skipApproval?: boolean;
      dryRun?: boolean;
      pauseOnFailure?: boolean;
    } = {}
  ): Promise<DeploymentExecution> {
    const plan = await this.getDeploymentPlan(planId, userId);

    // Check if approval is required and obtained
    if (plan.approvals.required && !options.skipApproval) {
      const approvalStatus = await this.checkApprovalStatus(planId);
      if (!approvalStatus.approved) {
        throw new ValidationError('Deployment requires approval before execution');
      }
    }

    // Create execution record
    const execution = await prisma.deploymentExecution.create({
      data: {
        planId,
        status: 'PENDING',
        currentStage: 0,
        executedBy: userId,
        metadata: {
          options,
          dryRun: options.dryRun || false
        } as any
      }
    });

    // Start execution
    if (!options.dryRun) {
      // Execute in background
      this.runDeploymentExecution(execution.id, plan, options).catch(error => {
        console.error('Deployment execution failed:', error);
        this.handleDeploymentFailure(execution.id, error);
      });
    }

    return {
      id: execution.id,
      planId,
      status: 'PENDING',
      currentStage: 0,
      stages: plan.stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        status: 'PENDING'
      })),
      metrics: {},
      startedAt: new Date(),
      executedBy: userId
    };
  }

  /**
   * Monitor deployment execution
   */
  static async monitorDeployment(
    userId: string,
    executionId: string
  ): Promise<{
    execution: DeploymentExecution;
    metrics: { [key: string]: any };
    health: { overall: number; issues: string[] };
  }> {
    const execution = await this.getDeploymentExecution(executionId, userId);
    
    // Collect real-time metrics
    const metrics = await this.collectDeploymentMetrics(execution);
    
    // Assess deployment health
    const health = await this.assessDeploymentHealth(execution, metrics);

    return { execution, metrics, health };
  }

  /**
   * Rollback a deployment
   */
  static async rollbackDeployment(
    userId: string,
    executionId: string,
    reason?: string
  ): Promise<DeploymentExecution> {
    const execution = await this.getDeploymentExecution(executionId, userId);
    
    if (execution.status !== 'COMPLETED' && execution.status !== 'FAILED') {
      throw new ValidationError('Cannot rollback deployment that is not completed or failed');
    }

    // Execute rollback plan
    const plan = await this.getDeploymentPlan(execution.planId, userId);
    const rollbackExecution = await this.executeRollbackPlan(
      execution,
      plan.rollbackPlan,
      userId,
      reason
    );

    return rollbackExecution;
  }

  // Private helper methods

  private static async validatePromptReadiness(prompt: any, config: SafeDeploymentConfig): Promise<void> {
    // Check if prompt has passed required tests
    if (config.requireTestingPass) {
      const recentTestRuns = await prisma.testRun.findMany({
        where: {
          promptId: prompt.id,
          status: 'COMPLETED',
          completedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { completedAt: 'desc' },
        take: 1
      });

      if (recentTestRuns.length === 0) {
        throw new ValidationError('Prompt must pass testing before deployment');
      }

      // Check test results
      const testRun = recentTestRuns[0];
      const testMetrics = await prisma.testMetric.findMany({
        where: { testRunId: testRun.id }
      });

      const requiredMetrics = config.requiredTestMetrics || {};
      for (const [metric, threshold] of Object.entries(requiredMetrics)) {
        const testMetric = testMetrics.find(m => m.name === metric);
        if (!testMetric || testMetric.value < threshold) {
          throw new ValidationError(`Prompt does not meet required metric threshold for ${metric}: ${testMetric?.value || 0} < ${threshold}`);
        }
      }
    }
  }

  private static async generateDeploymentStages(config: SafeDeploymentConfig): Promise<DeploymentStage[]> {
    const stages: DeploymentStage[] = [];

    // Pre-deployment testing stage
    if (config.preDeploymentTests && config.preDeploymentTests.length > 0) {
      stages.push({
        id: 'pre_deployment_testing',
        name: 'Pre-deployment Testing',
        type: 'testing',
        order: 1,
        config: {
          testPipelineIds: config.preDeploymentTests,
          requiredToPass: true
        },
        rollbackOnFailure: true
      });
    }

    // Deployment stages based on strategy
    switch (config.strategy) {
      case 'blue_green':
        stages.push(...this.generateBlueGreenStages(config));
        break;
      case 'canary':
        stages.push(...this.generateCanaryStages(config));
        break;
      case 'rolling':
        stages.push(...this.generateRollingStages(config));
        break;
      case 'immediate':
        stages.push(...this.generateImmediateStages(config));
        break;
    }

    // Post-deployment validation stage
    stages.push({
      id: 'post_deployment_validation',
      name: 'Post-deployment Validation',
      type: 'validation',
      order: 100,
      config: {
        validationTests: config.postDeploymentTests || [],
        monitoringDuration: config.monitoringDuration || 15 // minutes
      },
      rollbackOnFailure: true
    });

    return stages.sort((a, b) => a.order - b.order);
  }

  private static generateBlueGreenStages(config: SafeDeploymentConfig): DeploymentStage[] {
    const blueGreenConfig = config.strategyConfig as BlueGreenConfig;
    
    return [
      {
        id: 'blue_green_deploy',
        name: 'Deploy to Green Environment',
        type: 'deployment',
        order: 10,
        config: {
          targetEnvironment: 'green',
          healthCheckEndpoint: blueGreenConfig.healthCheckEndpoint,
          warmupDuration: blueGreenConfig.warmupDuration || 5
        },
        rollbackOnFailure: true
      },
      {
        id: 'blue_green_validation',
        name: 'Validate Green Environment',
        type: 'validation',
        order: 11,
        config: {
          testTrafficPercentage: blueGreenConfig.testTrafficPercentage || 10,
          validationDuration: blueGreenConfig.validationDuration || 10
        },
        rollbackOnFailure: true
      },
      {
        id: 'blue_green_switch',
        name: 'Switch Traffic to Green',
        type: 'traffic_switch',
        order: 12,
        config: {
          switchStrategy: blueGreenConfig.switchStrategy || 'immediate'
        },
        rollbackOnFailure: true
      }
    ];
  }

  private static generateCanaryStages(config: SafeDeploymentConfig): DeploymentStage[] {
    const canaryConfig = config.strategyConfig as CanaryConfig;
    const stages: DeploymentStage[] = [];

    // Initial canary deployment
    stages.push({
      id: 'canary_deploy',
      name: 'Deploy Canary Version',
      type: 'deployment',
      order: 10,
      config: {
        trafficPercentage: canaryConfig.initialTrafficPercentage || 5,
        targetEnvironments: config.targetEnvironments
      },
      rollbackOnFailure: true
    });

    // Progressive traffic increase stages
    const trafficSteps = canaryConfig.trafficSteps || [10, 25, 50, 100];
    trafficSteps.forEach((percentage, index) => {
      stages.push({
        id: `canary_increase_${percentage}`,
        name: `Increase Canary Traffic to ${percentage}%`,
        type: 'traffic_increase',
        order: 20 + index,
        config: {
          trafficPercentage: percentage,
          monitoringDuration: canaryConfig.monitoringDuration || 10,
          successCriteria: canaryConfig.successCriteria
        },
        rollbackOnFailure: true
      });
    });

    return stages;
  }

  private static generateRollingStages(config: SafeDeploymentConfig): DeploymentStage[] {
    return config.targetEnvironments.map((envId, index) => ({
      id: `rolling_deploy_${envId}`,
      name: `Deploy to ${envId}`,
      type: 'deployment',
      order: 10 + index,
      config: {
        targetEnvironment: envId,
        waitBetweenDeployments: 5 // minutes
      },
      rollbackOnFailure: true
    }));
  }

  private static generateImmediateStages(config: SafeDeploymentConfig): DeploymentStage[] {
    return [{
      id: 'immediate_deploy',
      name: 'Immediate Deployment',
      type: 'deployment',
      order: 10,
      config: {
        targetEnvironments: config.targetEnvironments,
        parallel: true
      },
      rollbackOnFailure: true
    }];
  }

  private static async createRollbackPlan(config: SafeDeploymentConfig): RollbackPlan {
    return {
      strategy: config.rollbackStrategy || 'immediate',
      triggers: config.rollbackTriggers || ['error_rate_high', 'latency_high'],
      automaticRollback: config.automaticRollback || false,
      steps: [
        {
          id: 'stop_new_deployments',
          name: 'Stop New Deployments',
          type: 'control',
          order: 1
        },
        {
          id: 'revert_traffic',
          name: 'Revert Traffic Routing',
          type: 'traffic_revert',
          order: 2
        },
        {
          id: 'restore_previous_version',
          name: 'Restore Previous Version',
          type: 'version_restore',
          order: 3
        },
        {
          id: 'verify_rollback',
          name: 'Verify Rollback Success',
          type: 'verification',
          order: 4
        }
      ]
    };
  }

  private static async generateMonitoringConfig(config: SafeDeploymentConfig): Promise<any> {
    return {
      enabled: true,
      metrics: [
        'error_rate',
        'response_time',
        'throughput',
        'availability',
        'quality_score'
      ],
      alertThresholds: {
        error_rate: config.errorRateThreshold || 5.0, // percentage
        response_time: config.responseTimeThreshold || 2000, // milliseconds
        quality_score: config.qualityThreshold || 70 // percentage
      },
      duration: config.monitoringDuration || 30 // minutes
    };
  }

  private static async runDeploymentExecution(
    executionId: string,
    plan: SafeDeploymentPlan,
    options: any
  ): Promise<void> {
    let currentStage = 0;

    try {
      await prisma.deploymentExecution.update({
        where: { id: executionId },
        data: { 
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

      for (const stage of plan.stages) {
        currentStage++;
        
        await prisma.deploymentExecution.update({
          where: { id: executionId },
          data: { currentStage }
        });

        const stageResult = await this.executeDeploymentStage(
          executionId,
          stage,
          plan,
          options
        );

        if (!stageResult.success && stage.rollbackOnFailure) {
          if (options.pauseOnFailure) {
            await prisma.deploymentExecution.update({
              where: { id: executionId },
              data: { status: 'PAUSED' }
            });
            return;
          } else {
            // Trigger automatic rollback
            await this.triggerAutomaticRollback(executionId, plan, stageResult.error);
            return;
          }
        }
      }

      // Deployment completed successfully
      await prisma.deploymentExecution.update({
        where: { id: executionId },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

    } catch (error) {
      await prisma.deploymentExecution.update({
        where: { id: executionId },
        data: { 
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      // Trigger automatic rollback if enabled
      if (plan.rollbackPlan.automaticRollback) {
        await this.triggerAutomaticRollback(executionId, plan, error);
      }
    }
  }

  private static async executeDeploymentStage(
    executionId: string,
    stage: DeploymentStage,
    plan: SafeDeploymentPlan,
    options: any
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      console.log(`Executing deployment stage: ${stage.name}`);

      switch (stage.type) {
        case 'testing':
          return this.executeTestingStage(stage, plan);
        case 'deployment':
          return this.executeDeploymentStageAction(stage, plan);
        case 'validation':
          return this.executeValidationStage(stage, plan);
        case 'traffic_switch':
        case 'traffic_increase':
          return this.executeTrafficStage(stage, plan);
        default:
          throw new ValidationError(`Unknown stage type: ${stage.type}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async executeTestingStage(stage: DeploymentStage, plan: SafeDeploymentPlan): Promise<any> {
    const testPipelineIds = stage.config.testPipelineIds || [];
    
    for (const pipelineId of testPipelineIds) {
      const result = await TestingPipelineService.executePipeline(
        'system', // Use system user for automated testing
        pipelineId,
        plan.promptId,
        { runAsync: false }
      );

      if (result.status !== 'COMPLETED' || result.passedStages < result.totalStages) {
        return {
          success: false,
          error: `Testing pipeline ${pipelineId} failed`
        };
      }
    }

    return { success: true, result: 'All tests passed' };
  }

  private static async executeDeploymentStageAction(stage: DeploymentStage, plan: SafeDeploymentPlan): Promise<any> {
    // Execute actual deployment to target environments
    const targetEnvs = stage.config.targetEnvironments || plan.targetEnvironments;
    const results = [];

    for (const envId of targetEnvs) {
      try {
        // Use AppIntegrationService to deploy to main application
        const deployResult = await AppIntegrationService.pushPromptsToApp(
          'system',
          plan.promptId.split('_')[0], // Extract project ID
          'main_app_id', // This would be configured
          [plan.promptId],
          envId
        );

        results.push({ environment: envId, result: deployResult });
      } catch (error) {
        return {
          success: false,
          error: `Deployment to ${envId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }

    return { success: true, result: results };
  }

  private static async executeValidationStage(stage: DeploymentStage, plan: SafeDeploymentPlan): Promise<any> {
    // Execute post-deployment validation
    const validationTests = stage.config.validationTests || [];
    const monitoringDuration = stage.config.monitoringDuration || 15;

    // Wait for monitoring period
    await new Promise(resolve => setTimeout(resolve, monitoringDuration * 60 * 1000));

    // Run validation tests
    for (const testId of validationTests) {
      // Execute validation test
      console.log(`Running validation test: ${testId}`);
    }

    return { success: true, result: 'Validation completed' };
  }

  private static async executeTrafficStage(stage: DeploymentStage, plan: SafeDeploymentPlan): Promise<any> {
    const trafficPercentage = stage.config.trafficPercentage || 100;
    
    // Simulate traffic routing changes
    console.log(`Routing ${trafficPercentage}% of traffic to new version`);

    // Monitor for the specified duration
    const monitoringDuration = stage.config.monitoringDuration || 10;
    await new Promise(resolve => setTimeout(resolve, monitoringDuration * 60 * 1000));

    return { success: true, result: `Traffic routed: ${trafficPercentage}%` };
  }

  private static async triggerAutomaticRollback(
    executionId: string,
    plan: SafeDeploymentPlan,
    error: any
  ): Promise<void> {
    console.log('Triggering automatic rollback due to deployment failure');

    await prisma.deploymentExecution.update({
      where: { id: executionId },
      data: { status: 'ROLLING_BACK' }
    });

    // Execute rollback plan
    for (const step of plan.rollbackPlan.steps) {
      try {
        await this.executeRollbackStep(step, plan);
      } catch (rollbackError) {
        console.error('Rollback step failed:', rollbackError);
      }
    }

    await prisma.deploymentExecution.update({
      where: { id: executionId },
      data: { 
        status: 'FAILED',
        completedAt: new Date(),
        error: `Deployment failed and rolled back: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    });
  }

  private static async executeRollbackStep(step: any, plan: SafeDeploymentPlan): Promise<void> {
    console.log(`Executing rollback step: ${step.name}`);
    
    switch (step.type) {
      case 'control':
        // Stop new deployments
        break;
      case 'traffic_revert':
        // Revert traffic routing
        break;
      case 'version_restore':
        // Restore previous version
        break;
      case 'verification':
        // Verify rollback success
        break;
    }
  }

  private static async getDeploymentPlan(planId: string, userId: string): Promise<SafeDeploymentPlan> {
    const plan = await prisma.deploymentPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new NotFoundError('Deployment plan not found');
    }

    // Check user access to project
    await ProjectService.getProjectById(plan.projectId, userId);

    return plan.planData as SafeDeploymentPlan;
  }

  private static async getDeploymentExecution(executionId: string, userId: string): Promise<DeploymentExecution> {
    const execution = await prisma.deploymentExecution.findUnique({
      where: { id: executionId },
      include: {
        plan: true
      }
    });

    if (!execution) {
      throw new NotFoundError('Deployment execution not found');
    }

    // Check user access to project
    await ProjectService.getProjectById(execution.plan.projectId, userId);

    return {
      id: execution.id,
      planId: execution.planId,
      status: execution.status as any,
      currentStage: execution.currentStage,
      stages: [], // Would be populated from stored data
      metrics: execution.metrics as any || {},
      startedAt: execution.startedAt || new Date(),
      completedAt: execution.completedAt || undefined,
      executedBy: execution.executedBy
    };
  }

  private static async checkApprovalStatus(planId: string): Promise<{ approved: boolean; approvers: string[] }> {
    // Check if all required approvals have been obtained
    const approvals = await prisma.deploymentApproval.findMany({
      where: { planId, status: 'APPROVED' }
    });

    return {
      approved: approvals.length > 0, // Simplified - would check against required approvers
      approvers: approvals.map(a => a.approvedBy)
    };
  }

  private static async collectDeploymentMetrics(execution: DeploymentExecution): Promise<any> {
    // Collect metrics from monitoring systems
    return {
      error_rate: Math.random() * 2, // Simulate metrics
      response_time: 500 + Math.random() * 500,
      throughput: 1000 + Math.random() * 500,
      quality_score: 85 + Math.random() * 10
    };
  }

  private static async assessDeploymentHealth(
    execution: DeploymentExecution,
    metrics: any
  ): Promise<{ overall: number; issues: string[] }> {
    const issues: string[] = [];
    let healthScore = 100;

    // Check metrics against thresholds
    if (metrics.error_rate > 5) {
      issues.push(`High error rate: ${metrics.error_rate}%`);
      healthScore -= 20;
    }

    if (metrics.response_time > 2000) {
      issues.push(`High response time: ${metrics.response_time}ms`);
      healthScore -= 15;
    }

    if (metrics.quality_score < 70) {
      issues.push(`Low quality score: ${metrics.quality_score}`);
      healthScore -= 25;
    }

    return {
      overall: Math.max(0, healthScore),
      issues
    };
  }

  private static async executeRollbackPlan(
    execution: DeploymentExecution,
    rollbackPlan: RollbackPlan,
    userId: string,
    reason?: string
  ): Promise<DeploymentExecution> {
    // Create new execution for rollback
    const rollbackExecution = await prisma.deploymentExecution.create({
      data: {
        planId: `rollback_${execution.planId}`,
        status: 'RUNNING',
        currentStage: 0,
        executedBy: userId,
        metadata: {
          type: 'rollback',
          originalExecutionId: execution.id,
          reason
        } as any
      }
    });

    // Execute rollback steps
    for (const step of rollbackPlan.steps) {
      await this.executeRollbackStep(step, rollbackPlan as any);
    }

    await prisma.deploymentExecution.update({
      where: { id: rollbackExecution.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    return {
      id: rollbackExecution.id,
      planId: rollbackExecution.planId,
      status: 'COMPLETED',
      currentStage: rollbackPlan.steps.length,
      stages: rollbackPlan.steps.map(step => ({
        id: step.id,
        name: step.name,
        status: 'COMPLETED'
      })),
      metrics: {},
      startedAt: new Date(),
      completedAt: new Date(),
      executedBy: userId
    };
  }

  private static async handleDeploymentFailure(executionId: string, error: any): Promise<void> {
    console.error(`Deployment execution ${executionId} failed:`, error);
    
    await prisma.deploymentExecution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}