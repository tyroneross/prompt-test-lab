import { PrismaClient } from '../generated/client';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import type { Environment } from '@prompt-lab/shared';
import { ProjectService } from './project.service';

const prisma = new PrismaClient();

export class EnvironmentService {
  /**
   * Create a new environment
   */
  static async createEnvironment(
    userId: string,
    projectId: string,
    environmentData: Omit<Environment, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ): Promise<Environment> {
    // Check if user has access to the project and permissions to manage environments
    await this.validateEnvironmentPermissions(userId, projectId);

    // Check if environment with same name already exists in project
    const existingEnvironment = await prisma.environment.findUnique({
      where: {
        projectId_name: {
          projectId,
          name: environmentData.name
        }
      }
    });

    if (existingEnvironment) {
      throw new ValidationError(`Environment with name '${environmentData.name}' already exists in this project`);
    }

    const environment = await prisma.environment.create({
      data: {
        ...environmentData,
        projectId
      }
    });

    return this.formatEnvironmentResponse(environment);
  }

  /**
   * Get environments for a project
   */
  static async getProjectEnvironments(
    userId: string,
    projectId: string,
    filters: {
      type?: 'STAGING' | 'PRODUCTION' | 'DEVELOPMENT' | 'PREVIEW';
      isActive?: boolean;
    } = {}
  ): Promise<Environment[]> {
    // Check if user has access to this project
    await ProjectService.getProjectById(projectId, userId);

    const where = {
      projectId,
      ...(filters.type && { type: filters.type }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive })
    };

    const environments = await prisma.environment.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    });

    return environments.map(this.formatEnvironmentResponse);
  }

  /**
   * Get a specific environment
   */
  static async getEnvironmentById(
    userId: string,
    environmentId: string
  ): Promise<Environment> {
    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
      include: {
        project: true
      }
    });

    if (!environment) {
      throw new NotFoundError('Environment not found');
    }

    // Check if user has access to the project
    await ProjectService.getProjectById(environment.project.id, userId);

    return this.formatEnvironmentResponse(environment);
  }

  /**
   * Update an environment
   */
  static async updateEnvironment(
    userId: string,
    environmentId: string,
    updateData: Partial<Omit<Environment, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Environment> {
    const environment = await this.getEnvironmentById(userId, environmentId);
    
    // Check environment management permissions
    await this.validateEnvironmentPermissions(userId, environment.projectId);

    // If name is being updated, check for conflicts
    if (updateData.name && updateData.name !== environment.name) {
      const existingEnvironment = await prisma.environment.findUnique({
        where: {
          projectId_name: {
            projectId: environment.projectId,
            name: updateData.name
          }
        }
      });

      if (existingEnvironment) {
        throw new ValidationError(`Environment with name '${updateData.name}' already exists in this project`);
      }
    }

    const updatedEnvironment = await prisma.environment.update({
      where: { id: environmentId },
      data: updateData
    });

    return this.formatEnvironmentResponse(updatedEnvironment);
  }

  /**
   * Delete an environment
   */
  static async deleteEnvironment(
    userId: string,
    environmentId: string
  ): Promise<void> {
    const environment = await this.getEnvironmentById(userId, environmentId);
    
    // Check environment management permissions
    await this.validateEnvironmentPermissions(userId, environment.projectId);

    // Check if there are active deployments in this environment
    const activeDeployments = await prisma.deployment.count({
      where: {
        environmentId,
        status: 'ACTIVE'
      }
    });

    if (activeDeployments > 0) {
      throw new ValidationError('Cannot delete environment with active deployments. Please deactivate or rollback deployments first.');
    }

    await prisma.environment.delete({
      where: { id: environmentId }
    });
  }

  /**
   * Get environment deployment status
   */
  static async getEnvironmentDeploymentStatus(
    userId: string,
    environmentId: string
  ): Promise<{
    environment: Environment;
    activeDeployment?: any;
    deploymentCount: number;
    lastDeployed?: Date;
  }> {
    const environment = await this.getEnvironmentById(userId, environmentId);

    const [activeDeployment, deploymentCount, lastDeployment] = await Promise.all([
      prisma.deployment.findFirst({
        where: {
          environmentId,
          status: 'ACTIVE'
        },
        include: {
          prompt: {
            select: {
              id: true,
              name: true,
              version: true
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
      }),
      prisma.deployment.count({
        where: { environmentId }
      }),
      prisma.deployment.findFirst({
        where: { environmentId },
        orderBy: { deployedAt: 'desc' },
        select: { deployedAt: true }
      })
    ]);

    return {
      environment,
      activeDeployment,
      deploymentCount,
      lastDeployed: lastDeployment?.deployedAt || undefined
    };
  }

  /**
   * Validate environment management permissions
   */
  private static async validateEnvironmentPermissions(
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
      throw new AuthorizationError('Insufficient permissions for environment management');
    }
  }

  /**
   * Format environment response
   */
  private static formatEnvironmentResponse(environment: any): Environment {
    return {
      id: environment.id,
      name: environment.name,
      type: environment.type,
      description: environment.description,
      config: environment.config,
      isActive: environment.isActive,
      projectId: environment.projectId,
      createdAt: environment.createdAt,
      updatedAt: environment.updatedAt
    };
  }
}