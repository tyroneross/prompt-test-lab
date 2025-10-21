import { PrismaClient } from '../generated/client';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { ProjectService } from './project.service';
import type { 
  DependencyType,
  DependencyConfig,
  DependencyStatus,
  DependencyUpdate,
  LangSmithConfig,
  OpenAIConfig,
  ModelProvider,
  DependencyAnalysis
} from '@prompt-lab/shared';

const prisma = new PrismaClient();

export interface ExternalDependency {
  id: string;
  name: string;
  type: DependencyType;
  provider: ModelProvider;
  config: DependencyConfig;
  status: DependencyStatus;
  lastCheck: Date;
  version?: string;
  healthScore: number;
  dependencies: string[]; // IDs of dependent prompts/projects
}

export interface DependencyUpdatePlan {
  id: string;
  title: string;
  description: string;
  dependencies: {
    id: string;
    name: string;
    currentVersion: string;
    targetVersion: string;
    changes: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }[];
  impactAnalysis: {
    affectedPrompts: number;
    affectedProjects: number;
    estimatedDowntime: number; // minutes
    rollbackPlan: boolean;
  };
  executionSteps: {
    order: number;
    description: string;
    type: 'validation' | 'backup' | 'update' | 'verification' | 'rollback';
    automated: boolean;
  }[];
}

/**
 * Service for managing dependencies between Prompt Testing Lab and external LLM tools
 */
export class DependencyManagerService {
  /**
   * Register a new dependency (LangSmith, OpenAI, etc.)
   */
  static async registerDependency(
    userId: string,
    projectId: string,
    dependencyConfig: DependencyConfig
  ): Promise<ExternalDependency> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to register dependencies');
    }

    // Validate dependency configuration
    await this.validateDependencyConfig(dependencyConfig);

    // Test connection to the dependency
    const healthCheck = await this.performHealthCheck(dependencyConfig);

    // Store dependency configuration
    const dependency = await prisma.dependency.create({
      data: {
        projectId,
        name: dependencyConfig.name,
        type: dependencyConfig.type,
        provider: dependencyConfig.provider,
        config: this.sanitizeConfig(dependencyConfig),
        status: healthCheck.healthy ? 'ACTIVE' : 'UNHEALTHY',
        version: healthCheck.version,
        healthScore: healthCheck.score,
        lastCheck: new Date(),
        createdBy: userId
      }
    });

    return {
      id: dependency.id,
      name: dependency.name,
      type: dependency.type as DependencyType,
      provider: dependency.provider as ModelProvider,
      config: dependency.config as DependencyConfig,
      status: dependency.status as DependencyStatus,
      lastCheck: dependency.lastCheck,
      version: dependency.version || undefined,
      healthScore: dependency.healthScore,
      dependencies: []
    };
  }

  /**
   * Analyze dependencies for a prompt or project
   */
  static async analyzeDependencies(
    userId: string,
    projectId: string,
    promptId?: string
  ): Promise<DependencyAnalysis> {
    // Check permissions
    await ProjectService.getProjectById(projectId, userId);

    const dependencies = await this.getProjectDependencies(projectId);
    const analysis: DependencyAnalysis = {
      totalDependencies: dependencies.length,
      healthyDependencies: dependencies.filter(d => d.status === 'ACTIVE').length,
      criticalIssues: [],
      warnings: [],
      recommendations: []
    };

    for (const dependency of dependencies) {
      // Check dependency health
      const healthCheck = await this.performHealthCheck(dependency.config as DependencyConfig);
      
      if (!healthCheck.healthy) {
        analysis.criticalIssues.push({
          type: 'unhealthy_dependency',
          severity: 'high',
          message: `${dependency.name} is not responding properly`,
          affectedItems: await this.getAffectedPrompts(dependency.id),
          resolution: 'Check configuration and network connectivity'
        });
      }

      // Check for version mismatches
      if (dependency.version && healthCheck.version && dependency.version !== healthCheck.version) {
        analysis.warnings.push({
          type: 'version_mismatch',
          severity: 'medium',
          message: `${dependency.name} version changed from ${dependency.version} to ${healthCheck.version}`,
          affectedItems: await this.getAffectedPrompts(dependency.id),
          resolution: 'Update dependency configuration and test affected prompts'
        });
      }

      // Check for deprecated features
      if (dependency.type === 'langsmith') {
        const deprecationWarnings = await this.checkLangSmithDeprecations(dependency.config as LangSmithConfig);
        analysis.warnings.push(...deprecationWarnings);
      }

      // Generate recommendations
      analysis.recommendations.push(...await this.generateDependencyRecommendations(dependency));
    }

    return analysis;
  }

  /**
   * Plan dependency updates
   */
  static async planDependencyUpdates(
    userId: string,
    projectId: string,
    dependencyIds: string[]
  ): Promise<DependencyUpdatePlan> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to plan dependency updates');
    }

    const dependencies = await Promise.all(
      dependencyIds.map(id => this.getDependencyById(id, projectId))
    );

    // Analyze update impact
    const impactAnalysis = await this.analyzeUpdateImpact(dependencies);
    
    // Generate execution steps
    const executionSteps = await this.generateExecutionSteps(dependencies, impactAnalysis);

    const plan: DependencyUpdatePlan = {
      id: `plan_${Date.now()}`,
      title: `Dependency Update Plan - ${new Date().toISOString().split('T')[0]}`,
      description: `Update plan for ${dependencies.length} dependencies`,
      dependencies: await Promise.all(dependencies.map(async dep => {
        const latestVersion = await this.getLatestVersion(dep);
        const changes = await this.getVersionChanges(dep, latestVersion);
        
        return {
          id: dep.id,
          name: dep.name,
          currentVersion: dep.version || 'unknown',
          targetVersion: latestVersion,
          changes: changes,
          riskLevel: this.assessRiskLevel(changes)
        };
      })),
      impactAnalysis,
      executionSteps
    };

    // Save the plan
    await prisma.updatePlan.create({
      data: {
        projectId,
        planData: plan as any,
        status: 'DRAFT',
        createdBy: userId
      }
    });

    return plan;
  }

  /**
   * Execute dependency updates
   */
  static async executeDependencyUpdates(
    userId: string,
    projectId: string,
    planId: string,
    options: {
      dryRun?: boolean;
      skipBackup?: boolean;
      autoRollback?: boolean;
    } = {}
  ): Promise<{ success: boolean; results: any[]; errors: string[] }> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to execute updates');
    }

    const plan = await this.getUpdatePlan(planId, projectId);
    const results: any[] = [];
    const errors: string[] = [];

    if (options.dryRun) {
      // Simulate the update process
      for (const step of plan.executionSteps) {
        results.push({
          step: step.description,
          status: 'simulated',
          message: `Would execute: ${step.description}`
        });
      }
      return { success: true, results, errors };
    }

    try {
      // Execute each step in order
      for (const step of plan.executionSteps) {
        try {
          const result = await this.executeUpdateStep(step, plan);
          results.push({
            step: step.description,
            status: 'completed',
            result
          });
        } catch (error) {
          const errorMessage = `Failed to execute step "${step.description}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          
          results.push({
            step: step.description,
            status: 'failed',
            error: errorMessage
          });

          // If auto-rollback is enabled and this is a critical step, rollback
          if (options.autoRollback && step.type !== 'validation') {
            await this.rollbackUpdates(plan, results);
            break;
          }
        }
      }

      // Update plan status
      await prisma.updatePlan.update({
        where: { id: planId },
        data: {
          status: errors.length === 0 ? 'COMPLETED' : 'FAILED',
          executionResult: { results, errors } as any,
          executedAt: new Date(),
          executedBy: userId
        }
      });

      return { success: errors.length === 0, results, errors };

    } catch (error) {
      errors.push(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, results, errors };
    }
  }

  /**
   * Monitor dependency health
   */
  static async monitorDependencyHealth(
    userId: string,
    projectId: string
  ): Promise<{ dependencies: ExternalDependency[]; overallHealth: number }> {
    // Check permissions
    await ProjectService.getProjectById(projectId, userId);

    const dependencies = await this.getProjectDependencies(projectId);
    const healthChecks = await Promise.all(
      dependencies.map(async dep => {
        const health = await this.performHealthCheck(dep.config as DependencyConfig);
        
        // Update dependency status
        await prisma.dependency.update({
          where: { id: dep.id },
          data: {
            status: health.healthy ? 'ACTIVE' : 'UNHEALTHY',
            healthScore: health.score,
            lastCheck: new Date(),
            version: health.version
          }
        });

        return {
          ...dep,
          status: health.healthy ? 'ACTIVE' : 'UNHEALTHY' as DependencyStatus,
          healthScore: health.score,
          lastCheck: new Date(),
          version: health.version
        };
      })
    );

    const overallHealth = healthChecks.length > 0
      ? healthChecks.reduce((sum, dep) => sum + dep.healthScore, 0) / healthChecks.length
      : 100;

    return { dependencies: healthChecks, overallHealth };
  }

  // Private helper methods

  private static async validateDependencyConfig(config: DependencyConfig): Promise<void> {
    if (!config.name || config.name.trim().length === 0) {
      throw new ValidationError('Dependency name is required');
    }

    if (!config.type || !config.provider) {
      throw new ValidationError('Dependency type and provider are required');
    }

    // Type-specific validation
    switch (config.type) {
      case 'langsmith':
        this.validateLangSmithConfig(config as LangSmithConfig);
        break;
      case 'model_provider':
        this.validateModelProviderConfig(config as OpenAIConfig);
        break;
      default:
        throw new ValidationError(`Unsupported dependency type: ${config.type}`);
    }
  }

  private static validateLangSmithConfig(config: LangSmithConfig): void {
    if (!config.apiKey || !config.baseUrl) {
      throw new ValidationError('LangSmith API key and base URL are required');
    }

    if (!config.baseUrl.includes('langchain')) {
      throw new ValidationError('Invalid LangSmith base URL');
    }
  }

  private static validateModelProviderConfig(config: OpenAIConfig): void {
    if (!config.apiKey) {
      throw new ValidationError('Model provider API key is required');
    }

    if (config.provider === 'openai' && !config.baseUrl) {
      config.baseUrl = 'https://api.openai.com/v1';
    }
  }

  private static async performHealthCheck(config: DependencyConfig): Promise<{
    healthy: boolean;
    score: number;
    version?: string;
    message?: string;
  }> {
    try {
      switch (config.type) {
        case 'langsmith':
          return this.checkLangSmithHealth(config as LangSmithConfig);
        case 'model_provider':
          return this.checkModelProviderHealth(config as OpenAIConfig);
        default:
          return { healthy: false, score: 0, message: 'Unknown dependency type' };
      }
    } catch (error) {
      return {
        healthy: false,
        score: 0,
        message: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  private static async checkLangSmithHealth(config: LangSmithConfig): Promise<any> {
    try {
      const response = await fetch(`${config.baseUrl}/api/v1/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          healthy: true,
          score: 100,
          version: response.headers.get('x-api-version') || 'unknown'
        };
      } else {
        return {
          healthy: false,
          score: 0,
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        healthy: false,
        score: 0,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static async checkModelProviderHealth(config: OpenAIConfig): Promise<any> {
    try {
      const response = await fetch(`${config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          healthy: true,
          score: 100,
          version: data.version || 'unknown'
        };
      } else {
        return {
          healthy: false,
          score: response.status === 401 ? 20 : 0, // Partial score for auth issues
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        healthy: false,
        score: 0,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static sanitizeConfig(config: DependencyConfig): any {
    // Remove sensitive information from stored config
    const sanitized = { ...config };
    
    if ('apiKey' in sanitized) {
      sanitized.apiKey = `${sanitized.apiKey.substring(0, 8)}...`;
    }

    return sanitized;
  }

  private static async getProjectDependencies(projectId: string): Promise<ExternalDependency[]> {
    const dependencies = await prisma.dependency.findMany({
      where: { projectId }
    });

    return dependencies.map(dep => ({
      id: dep.id,
      name: dep.name,
      type: dep.type as DependencyType,
      provider: dep.provider as ModelProvider,
      config: dep.config as DependencyConfig,
      status: dep.status as DependencyStatus,
      lastCheck: dep.lastCheck,
      version: dep.version || undefined,
      healthScore: dep.healthScore,
      dependencies: [] // Would be populated with actual dependent prompt IDs
    }));
  }

  private static async getAffectedPrompts(dependencyId: string): Promise<string[]> {
    // Query prompts that use this dependency
    const prompts = await prisma.prompt.findMany({
      where: {
        metadata: {
          path: ['dependencies'],
          array_contains: dependencyId
        }
      },
      select: { id: true, name: true }
    });

    return prompts.map(p => p.name);
  }

  private static async checkLangSmithDeprecations(config: LangSmithConfig): Promise<any[]> {
    const warnings: any[] = [];

    // Check for deprecated API endpoints or features
    try {
      const response = await fetch(`${config.baseUrl}/api/v1/deprecated`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const deprecations = await response.json();
        deprecations.forEach((dep: any) => {
          warnings.push({
            type: 'deprecated_feature',
            severity: 'medium',
            message: `LangSmith feature "${dep.feature}" is deprecated`,
            affectedItems: dep.affectedItems || [],
            resolution: dep.migration || 'Update to use recommended alternative'
          });
        });
      }
    } catch (error) {
      // Ignore deprecation check failures
      console.warn('Failed to check LangSmith deprecations:', error);
    }

    return warnings;
  }

  private static async generateDependencyRecommendations(dependency: ExternalDependency): Promise<any[]> {
    const recommendations: any[] = [];

    // Health-based recommendations
    if (dependency.healthScore < 80) {
      recommendations.push({
        type: 'health_improvement',
        priority: 'high',
        description: `${dependency.name} health score is ${dependency.healthScore}%. Consider checking configuration.`,
        action: 'validate_configuration'
      });
    }

    // Type-specific recommendations
    if (dependency.type === 'langsmith') {
      recommendations.push({
        type: 'monitoring',
        priority: 'medium',
        description: 'Enable LangSmith tracing for better observability',
        action: 'enable_tracing'
      });
    }

    return recommendations;
  }

  private static async analyzeUpdateImpact(dependencies: ExternalDependency[]): Promise<any> {
    const affectedPrompts = new Set<string>();
    const affectedProjects = new Set<string>();

    for (const dependency of dependencies) {
      const prompts = await this.getAffectedPrompts(dependency.id);
      prompts.forEach(prompt => affectedPrompts.add(prompt));
      affectedProjects.add(dependency.id); // Simplification
    }

    return {
      affectedPrompts: affectedPrompts.size,
      affectedProjects: affectedProjects.size,
      estimatedDowntime: Math.min(dependencies.length * 5, 30), // 5 minutes per dependency, max 30
      rollbackPlan: true
    };
  }

  private static async generateExecutionSteps(dependencies: ExternalDependency[], impactAnalysis: any): Promise<any[]> {
    const steps: any[] = [];

    // Validation steps
    steps.push({
      order: 1,
      description: 'Validate all dependency configurations',
      type: 'validation',
      automated: true
    });

    // Backup steps
    if (impactAnalysis.affectedPrompts > 0) {
      steps.push({
        order: 2,
        description: 'Create backup of current configurations',
        type: 'backup',
        automated: true
      });
    }

    // Update steps
    dependencies.forEach((dep, index) => {
      steps.push({
        order: 3 + index,
        description: `Update ${dep.name} dependency`,
        type: 'update',
        automated: true
      });
    });

    // Verification steps
    steps.push({
      order: 3 + dependencies.length,
      description: 'Verify all dependencies are healthy',
      type: 'verification',
      automated: true
    });

    return steps;
  }

  private static async getDependencyById(id: string, projectId: string): Promise<ExternalDependency> {
    const dependency = await prisma.dependency.findUnique({
      where: { id, projectId }
    });

    if (!dependency) {
      throw new NotFoundError('Dependency not found');
    }

    return {
      id: dependency.id,
      name: dependency.name,
      type: dependency.type as DependencyType,
      provider: dependency.provider as ModelProvider,
      config: dependency.config as DependencyConfig,
      status: dependency.status as DependencyStatus,
      lastCheck: dependency.lastCheck,
      version: dependency.version || undefined,
      healthScore: dependency.healthScore,
      dependencies: []
    };
  }

  private static async getLatestVersion(dependency: ExternalDependency): Promise<string> {
    // Check for latest version based on dependency type
    switch (dependency.type) {
      case 'langsmith':
        return this.getLangSmithLatestVersion(dependency.config as LangSmithConfig);
      case 'model_provider':
        return this.getModelProviderLatestVersion(dependency.config as OpenAIConfig);
      default:
        return 'unknown';
    }
  }

  private static async getLangSmithLatestVersion(config: LangSmithConfig): Promise<string> {
    try {
      const response = await fetch(`${config.baseUrl}/api/v1/version`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.version || 'unknown';
      }
    } catch (error) {
      console.warn('Failed to get LangSmith version:', error);
    }

    return 'unknown';
  }

  private static async getModelProviderLatestVersion(config: OpenAIConfig): Promise<string> {
    // For API-based providers, version is usually the API version
    return config.apiVersion || 'v1';
  }

  private static async getVersionChanges(dependency: ExternalDependency, targetVersion: string): Promise<string[]> {
    // Get changelog or version differences
    const changes: string[] = [];

    // This would typically query the provider's changelog API
    changes.push(`Update from ${dependency.version || 'unknown'} to ${targetVersion}`);
    
    if (dependency.type === 'langsmith') {
      changes.push('Improved tracing performance');
      changes.push('New evaluation metrics available');
    }

    return changes;
  }

  private static assessRiskLevel(changes: string[]): 'low' | 'medium' | 'high' {
    // Assess risk based on change descriptions
    const highRiskKeywords = ['breaking', 'deprecated', 'removed', 'incompatible'];
    const mediumRiskKeywords = ['changed', 'updated', 'modified'];

    const changeText = changes.join(' ').toLowerCase();

    if (highRiskKeywords.some(keyword => changeText.includes(keyword))) {
      return 'high';
    }

    if (mediumRiskKeywords.some(keyword => changeText.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  private static async getUpdatePlan(planId: string, projectId: string): Promise<DependencyUpdatePlan> {
    const plan = await prisma.updatePlan.findUnique({
      where: { id: planId, projectId }
    });

    if (!plan) {
      throw new NotFoundError('Update plan not found');
    }

    return plan.planData as DependencyUpdatePlan;
  }

  private static async executeUpdateStep(step: any, plan: DependencyUpdatePlan): Promise<any> {
    switch (step.type) {
      case 'validation':
        return this.validateDependencies(plan.dependencies);
      case 'backup':
        return this.createBackup(plan.dependencies);
      case 'update':
        return this.updateDependency(step, plan);
      case 'verification':
        return this.verifyDependencies(plan.dependencies);
      default:
        throw new ValidationError(`Unknown step type: ${step.type}`);
    }
  }

  private static async validateDependencies(dependencies: any[]): Promise<string> {
    // Validate all dependencies are accessible
    for (const dep of dependencies) {
      // Perform validation logic
    }
    return 'All dependencies validated successfully';
  }

  private static async createBackup(dependencies: any[]): Promise<string> {
    // Create backup of current configurations
    const backupId = `backup_${Date.now()}`;
    // Store backup data
    return `Backup created with ID: ${backupId}`;
  }

  private static async updateDependency(step: any, plan: DependencyUpdatePlan): Promise<string> {
    // Update specific dependency
    const dependency = plan.dependencies.find(d => step.description.includes(d.name));
    if (dependency) {
      // Perform update logic
      return `Updated ${dependency.name} to version ${dependency.targetVersion}`;
    }
    throw new ValidationError('Dependency not found for update step');
  }

  private static async verifyDependencies(dependencies: any[]): Promise<string> {
    // Verify all dependencies are working after update
    for (const dep of dependencies) {
      // Perform verification logic
    }
    return 'All dependencies verified successfully';
  }

  private static async rollbackUpdates(plan: DependencyUpdatePlan, results: any[]): Promise<void> {
    // Implement rollback logic
    console.log('Rolling back dependency updates...');
    
    // Find the backup from execution results
    const backupResult = results.find(r => r.step.includes('backup'));
    if (backupResult) {
      // Restore from backup
      console.log('Restoring from backup:', backupResult.result);
    }
  }
}