import { PrismaClient, Project, ProjectMember } from '../generated/client';
import { ProjectRole } from '../types/enums';
import { ValidationError, AuthorizationError, NotFoundError } from '@prompt-lab/shared';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export interface CreateProjectRequest {
  name: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface AddMemberRequest {
  userId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface ProjectWithDetails extends Project {
  members: (ProjectMember & {
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    };
  })[];
  _count: {
    prompts: number;
    testRuns: number;
  };
}

export class ProjectService {
  /**
   * Create a new project
   */
  static async createProject(ownerId: string, data: CreateProjectRequest): Promise<Project> {
    const validated = createProjectSchema.parse(data);

    const project = await prisma.project.create({
      data: {
        name: validated.name,
        description: validated.description,
        settings: validated.settings,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              }
            }
          }
        }
      }
    });

    return project;
  }

  /**
   * Get all projects for a user
   */
  static async getUserProjects(userId: string): Promise<ProjectWithDetails[]> {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              }
            }
          }
        },
        _count: {
          select: {
            prompts: true,
            testRuns: true,
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return projects;
  }

  /**
   * Get a specific project by ID
   */
  static async getProjectById(projectId: string, userId: string): Promise<ProjectWithDetails> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              }
            }
          }
        },
        _count: {
          select: {
            prompts: true,
            testRuns: true,
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundError('Project not found or access denied');
    }

    return project;
  }

  /**
   * Update a project
   */
  static async updateProject(
    projectId: string, 
    userId: string, 
    data: UpdateProjectRequest
  ): Promise<Project> {
    const validated = updateProjectSchema.parse(data);

    // Check if user has permission to update (owner or admin)
    await this.checkProjectPermission(projectId, userId, ['OWNER', 'ADMIN']);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: validated.name,
        description: validated.description,
        settings: validated.settings,
      }
    });

    return project;
  }

  /**
   * Delete a project
   */
  static async deleteProject(projectId: string, userId: string): Promise<void> {
    // Only owners can delete projects
    await this.checkProjectPermission(projectId, userId, ['OWNER']);

    await prisma.project.delete({
      where: { id: projectId }
    });
  }

  /**
   * Add a member to a project
   */
  static async addProjectMember(
    projectId: string, 
    adminUserId: string, 
    data: AddMemberRequest
  ): Promise<ProjectMember> {
    const validated = addMemberSchema.parse(data);

    // Check if admin has permission to add members
    await this.checkProjectPermission(projectId, adminUserId, ['OWNER', 'ADMIN']);

    // Check if user is already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: validated.userId
        }
      }
    });

    if (existingMember) {
      throw new ValidationError('User is already a member of this project');
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: validated.userId,
        role: validated.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      }
    });

    return member;
  }

  /**
   * Update member role
   */
  static async updateMemberRole(
    projectId: string,
    adminUserId: string,
    memberId: string,
    role: string
  ): Promise<ProjectMember> {
    // Check if admin has permission
    await this.checkProjectPermission(projectId, adminUserId, ['OWNER', 'ADMIN']);

    const member = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      }
    });

    return member;
  }

  /**
   * Remove a member from a project
   */
  static async removeMember(
    projectId: string,
    adminUserId: string,
    memberId: string
  ): Promise<void> {
    // Check if admin has permission
    await this.checkProjectPermission(projectId, adminUserId, ['OWNER', 'ADMIN']);

    // Cannot remove the owner
    const member = await prisma.projectMember.findUnique({
      where: { id: memberId }
    });

    if (member?.role === 'OWNER') {
      throw new ValidationError('Cannot remove project owner');
    }

    await prisma.projectMember.delete({
      where: { id: memberId }
    });
  }

  /**
   * Get user's role in a project
   */
  static async getUserProjectRole(projectId: string, userId: string): Promise<string | null> {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    });

    return member?.role || null;
  }

  /**
   * Check if user has required permission for a project
   */
  private static async checkProjectPermission(
    projectId: string,
    userId: string,
    allowedRoles: string[]
  ): Promise<void> {
    const userRole = await this.getUserProjectRole(projectId, userId);

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions for this action');
    }
  }

  /**
   * Get project statistics
   */
  static async getProjectStats(projectId: string, userId: string) {
    await this.checkProjectPermission(projectId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);

    const stats = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        _count: {
          select: {
            prompts: true,
            testRuns: true,
            members: true,
          }
        }
      }
    });

    if (!stats) {
      throw new NotFoundError('Project not found');
    }

    // Get additional stats
    const recentTestRuns = await prisma.testRun.count({
      where: {
        projectId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    });

    const completedTestRuns = await prisma.testRun.count({
      where: {
        projectId,
        status: 'COMPLETED'
      }
    });

    return {
      totalPrompts: stats._count.prompts,
      totalTestRuns: stats._count.testRuns,
      totalMembers: stats._count.members,
      recentTestRuns,
      completedTestRuns,
    };
  }
}