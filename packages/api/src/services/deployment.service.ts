import { PrismaClient } from '../generated/client';
import { DeploymentStatus } from '../types/enums';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import type { 
  DeploymentCreate, 
  DeploymentUpdate, 
  DeploymentResponse,
  DeploymentHistory,
  Environment 
} from '@prompt-lab/shared';
import { ProjectService } from './project.service';

const prisma = new PrismaClient();

export class DeploymentService {
  /**
   * Create a new deployment
   */
  static async createDeployment(
    userId: string,
    projectId: string,
    deploymentData: DeploymentCreate
  ): Promise<DeploymentResponse> {
    // Check if user has deployment permissions for this project
    await this.validateDeploymentPermissions(userId, projectId);

    // Validate that the prompt belongs to the project
    const prompt = await prisma.prompt.findUnique({
      where: { 
        id: deploymentData.promptId,
        projectId: projectId 
      }
    });

    if (!prompt) {
      throw new NotFoundError('Prompt not found or does not belong to this project');
    }

    // Validate that the environment belongs to the project
    const environment = await prisma.environment.findUnique({
      where: { 
        id: deploymentData.environmentId,
        projectId: projectId 
      }
    });

    if (!environment) {
      throw new NotFoundError('Environment not found or does not belong to this project');
    }

    // Check if there's already an active deployment for this environment
    const existingDeployment = await prisma.deployment.findFirst({
      where: {
        environmentId: deploymentData.environmentId,
        status: 'ACTIVE'
      }
    });

    // Create the deployment
    const deployment = await prisma.deployment.create({
      data: {
        promptId: deploymentData.promptId,
        environmentId: deploymentData.environmentId,
        version: deploymentData.version,
        config: deploymentData.config,
        metadata: deploymentData.metadata,
        deployedBy: userId,
        status: 'PENDING'
      },
      include: {
        environment: true,
        deployedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Create deployment history entry
    await prisma.deploymentHistory.create({
      data: {
        deploymentId: deployment.id,
        action: 'deploy',
        status: 'PENDING',
        performedBy: userId,
        metadata: {
          version: deploymentData.version,
          previousDeployment: existingDeployment?.id
        }
      }
    });

    // If there was an existing active deployment, deactivate it
    if (existingDeployment) {
      await this.deactivateDeployment(existingDeployment.id, userId);
    }

    return this.formatDeploymentResponse(deployment);
  }

  /**
   * Get deployments for a project
   */
  static async getProjectDeployments(
    userId: string,
    projectId: string,
    filters: {
      environmentId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ deployments: DeploymentResponse[]; total: number }> {
    // Check if user has access to this project
    await ProjectService.getProjectById(projectId, userId);

    const where = {
      environment: {
        projectId: projectId
      },
      ...(filters.environmentId && { environmentId: filters.environmentId }),
      ...(filters.status && { status: filters.status as DeploymentStatus })
    };

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where,
        include: {
          environment: true,
          deployedByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset
      }),
      prisma.deployment.count({ where })
    ]);

    return {
      deployments: deployments.map(this.formatDeploymentResponse),
      total
    };
  }

  /**
   * Get a specific deployment
   */
  static async getDeploymentById(
    userId: string,
    deploymentId: string
  ): Promise<DeploymentResponse> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        environment: {
          include: {
            project: true
          }
        },
        deployedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!deployment) {
      throw new NotFoundError('Deployment not found');
    }

    // Check if user has access to the project
    await ProjectService.getProjectById(deployment.environment.project.id, userId);

    return this.formatDeploymentResponse(deployment);
  }

  /**
   * Update a deployment
   */
  static async updateDeployment(
    userId: string,
    deploymentId: string,
    updateData: DeploymentUpdate
  ): Promise<DeploymentResponse> {
    const deployment = await this.getDeploymentById(userId, deploymentId);
    
    // Check deployment permissions
    await this.validateDeploymentPermissions(userId, deployment.environment.projectId);

    const updatedDeployment = await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        ...updateData,
        ...(updateData.status === 'ACTIVE' && { deployedAt: new Date() }),
        ...(updateData.status === 'ROLLED_BACK' && { rollbackAt: new Date() })
      },
      include: {
        environment: true,
        deployedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Create history entry for the update
    await prisma.deploymentHistory.create({
      data: {
        deploymentId: deploymentId,
        action: updateData.status === 'ROLLED_BACK' ? 'rollback' : 'update',
        status: updateData.status || deployment.status as any,
        performedBy: userId,
        metadata: updateData as any
      }
    });

    return this.formatDeploymentResponse(updatedDeployment);
  }

  /**
   * Rollback a deployment
   */
  static async rollbackDeployment(
    userId: string,
    deploymentId: string
  ): Promise<DeploymentResponse> {
    const deployment = await this.getDeploymentById(userId, deploymentId);

    if (deployment.status !== 'ACTIVE') {
      throw new ValidationError('Can only rollback active deployments');
    }

    return this.updateDeployment(userId, deploymentId, {
      status: 'ROLLED_BACK'
    });
  }

  /**
   * Get deployment history
   */
  static async getDeploymentHistory(
    userId: string,
    deploymentId: string
  ): Promise<DeploymentHistory[]> {
    const deployment = await this.getDeploymentById(userId, deploymentId);

    const history = await prisma.deploymentHistory.findMany({
      where: { deploymentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return history.map(entry => ({
      id: entry.id,
      action: entry.action as 'deploy' | 'rollback' | 'update' | 'deactivate',
      status: entry.status,
      metadata: entry.metadata as Record<string, any>,
      timestamp: entry.timestamp,
      deploymentId: entry.deploymentId,
      performedBy: entry.performedBy,
      user: entry.user
    }));
  }

  /**
   * Delete a deployment
   */
  static async deleteDeployment(
    userId: string,
    deploymentId: string
  ): Promise<void> {
    const deployment = await this.getDeploymentById(userId, deploymentId);
    
    // Check deployment permissions
    await this.validateDeploymentPermissions(userId, deployment.environment.projectId);

    if (deployment.status === 'ACTIVE') {
      throw new ValidationError('Cannot delete active deployment. Please deactivate it first.');
    }

    await prisma.deployment.delete({
      where: { id: deploymentId }
    });
  }

  /**
   * Deactivate a deployment
   */
  private static async deactivateDeployment(
    deploymentId: string,
    userId: string
  ): Promise<void> {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { 
        status: 'INACTIVE',
        rollbackAt: new Date()
      }
    });

    await prisma.deploymentHistory.create({
      data: {
        deploymentId: deploymentId,
        action: 'deactivate',
        status: 'INACTIVE',
        performedBy: userId,
        metadata: { reason: 'Replaced by new deployment' }
      }
    });
  }

  /**
   * Validate deployment permissions
   */
  private static async validateDeploymentPermissions(
    userId: string,
    projectId: string
  ): Promise<void> {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    });

    if (!membership) {
      throw new AuthorizationError('User is not a member of this project');
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new AuthorizationError('Insufficient permissions for deployment operations');
    }
  }

  /**
   * Format deployment response
   */
  private static formatDeploymentResponse(deployment: any): DeploymentResponse {
    return {
      id: deployment.id,
      version: deployment.version,
      status: deployment.status,
      deployedUrl: deployment.deployedUrl,
      config: deployment.config,
      metadata: deployment.metadata,
      deployedAt: deployment.deployedAt,
      rollbackAt: deployment.rollbackAt,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
      promptId: deployment.promptId,
      environmentId: deployment.environmentId,
      deployedBy: deployment.deployedBy,
      environment: {
        id: deployment.environment.id,
        name: deployment.environment.name,
        type: deployment.environment.type,
        description: deployment.environment.description,
        config: deployment.environment.config,
        isActive: deployment.environment.isActive,
        projectId: deployment.environment.projectId,
        createdAt: deployment.environment.createdAt,
        updatedAt: deployment.environment.updatedAt
      },
      deployedByUser: deployment.deployedByUser
    };
  }
}