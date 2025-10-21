import { PrismaClient, Prompt } from '../generated/client';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { ProjectService } from './project.service';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const createPromptSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
  outputSchema: z.record(z.any()).optional(),
  outputFormat: z.enum(['json', 'text', 'markdown', 'structured']).optional(),
});

const updatePromptSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  outputSchema: z.record(z.any()).optional(),
  outputFormat: z.enum(['json', 'text', 'markdown', 'structured']).optional(),
});

export interface CreatePromptRequest {
  name: string;
  description?: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, any>;
  outputSchema?: Record<string, any>;
  outputFormat?: 'json' | 'text' | 'markdown' | 'structured';
}

export interface UpdatePromptRequest {
  name?: string;
  description?: string;
  content?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  outputSchema?: Record<string, any>;
  outputFormat?: 'json' | 'text' | 'markdown' | 'structured';
}

export interface PromptWithVersions extends Prompt {
  versions?: Prompt[];
  parent?: {
    id: string;
    name: string;
    version: number;
  } | null;
  _count: {
    testRuns: number;
    versions: number;
  };
}

export class PromptService {
  /**
   * Create a new prompt
   */
  static async createPrompt(
    projectId: string,
    userId: string,
    data: CreatePromptRequest
  ): Promise<Prompt> {
    const validated = createPromptSchema.parse(data);

    // Check project access
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to create prompts');
    }

    const prompt = await prisma.prompt.create({
      data: {
        name: validated.name,
        description: validated.description,
        content: validated.content,
        tags: validated.tags,
        metadata: validated.metadata,
        outputSchema: validated.outputSchema,
        outputFormat: validated.outputFormat,
        projectId,
      },
      include: {
        _count: {
          select: {
            testRuns: true,
            versions: true,
          }
        }
      }
    });

    return prompt;
  }

  /**
   * Get all prompts for a project
   */
  static async getProjectPrompts(
    projectId: string,
    userId: string,
    options: {
      includeArchived?: boolean;
      tags?: string[];
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ prompts: PromptWithVersions[]; total: number }> {
    // Check project access
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole) {
      throw new AuthorizationError('Access denied to project');
    }

    const where: any = {
      projectId,
      isArchived: options.includeArchived ? undefined : false,
    };

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      where.tags = {
        hasSome: options.tags,
      };
    }

    // Search functionality
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { content: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [prompts, total] = await Promise.all([
      prisma.prompt.findMany({
        where,
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 5, // Latest 5 versions
          },
          parent: {
            select: {
              id: true,
              name: true,
              version: true,
            }
          },
          _count: {
            select: {
              testRuns: true,
              versions: true,
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      prisma.prompt.count({ where }),
    ]);

    return { prompts, total };
  }

  /**
   * Get a specific prompt by ID
   */
  static async getPromptById(
    promptId: string,
    userId: string
  ): Promise<PromptWithVersions> {
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          }
        },
        versions: {
          orderBy: { version: 'desc' },
        },
        parent: {
          select: {
            id: true,
            name: true,
            version: true,
          }
        },
        _count: {
          select: {
            testRuns: true,
            versions: true,
          }
        }
      }
    });

    if (!prompt) {
      throw new NotFoundError('Prompt not found');
    }

    // Check project access
    const userRole = await ProjectService.getUserProjectRole(prompt.projectId, userId);
    if (!userRole) {
      throw new AuthorizationError('Access denied to prompt');
    }

    return prompt;
  }

  /**
   * Update a prompt
   */
  static async updatePrompt(
    promptId: string,
    userId: string,
    data: UpdatePromptRequest
  ): Promise<Prompt> {
    const validated = updatePromptSchema.parse(data);

    const existingPrompt = await this.getPromptById(promptId, userId);

    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(existingPrompt.projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to update prompt');
    }

    const prompt = await prisma.prompt.update({
      where: { id: promptId },
      data: {
        name: validated.name,
        description: validated.description,
        content: validated.content,
        tags: validated.tags,
        metadata: validated.metadata,
        outputSchema: validated.outputSchema,
        outputFormat: validated.outputFormat,
      },
      include: {
        _count: {
          select: {
            testRuns: true,
            versions: true,
          }
        }
      }
    });

    return prompt;
  }

  /**
   * Create a new version of a prompt
   */
  static async createPromptVersion(
    promptId: string,
    userId: string,
    data: UpdatePromptRequest
  ): Promise<Prompt> {
    const validated = updatePromptSchema.parse(data);

    const parentPrompt = await this.getPromptById(promptId, userId);

    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(parentPrompt.projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to create prompt version');
    }

    // Get the next version number
    const latestVersion = await prisma.prompt.findFirst({
      where: {
        OR: [
          { id: promptId },
          { parentId: promptId }
        ]
      },
      orderBy: { version: 'desc' },
      select: { version: true }
    });

    const nextVersion = (latestVersion?.version || 0) + 1;

    const newVersion = await prisma.prompt.create({
      data: {
        name: validated.name || parentPrompt.name,
        description: validated.description || parentPrompt.description,
        content: validated.content || parentPrompt.content,
        tags: validated.tags || parentPrompt.tags,
        metadata: validated.metadata || parentPrompt.metadata,
        outputSchema: validated.outputSchema || parentPrompt.outputSchema,
        outputFormat: validated.outputFormat || parentPrompt.outputFormat,
        version: nextVersion,
        parentId: promptId,
        projectId: parentPrompt.projectId,
      },
      include: {
        _count: {
          select: {
            testRuns: true,
            versions: true,
          }
        }
      }
    });

    return newVersion;
  }

  /**
   * Archive/unarchive a prompt
   */
  static async archivePrompt(
    promptId: string,
    userId: string,
    archive: boolean = true
  ): Promise<Prompt> {
    const prompt = await this.getPromptById(promptId, userId);

    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(prompt.projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to archive prompt');
    }

    const updatedPrompt = await prisma.prompt.update({
      where: { id: promptId },
      data: { isArchived: archive },
      include: {
        _count: {
          select: {
            testRuns: true,
            versions: true,
          }
        }
      }
    });

    return updatedPrompt;
  }

  /**
   * Delete a prompt (hard delete)
   */
  static async deletePrompt(promptId: string, userId: string): Promise<void> {
    const prompt = await this.getPromptById(promptId, userId);

    // Check permissions (only owners and admins can delete)
    const userRole = await ProjectService.getUserProjectRole(prompt.projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to delete prompt');
    }

    // Check if prompt has test runs
    const testRunCount = await prisma.testRun.count({
      where: { promptId }
    });

    if (testRunCount > 0) {
      throw new ValidationError('Cannot delete prompt with existing test runs. Archive instead.');
    }

    await prisma.prompt.delete({
      where: { id: promptId }
    });
  }

  /**
   * Get prompt version history
   */
  static async getPromptVersions(
    promptId: string,
    userId: string
  ): Promise<Prompt[]> {
    const prompt = await this.getPromptById(promptId, userId);

    // Get all versions (including the original)
    const versions = await prisma.prompt.findMany({
      where: {
        OR: [
          { id: promptId },
          { parentId: promptId }
        ]
      },
      orderBy: { version: 'desc' },
      include: {
        _count: {
          select: {
            testRuns: true,
            versions: true,
          }
        }
      }
    });

    return versions;
  }

  /**
   * Get prompts by tags
   */
  static async getPromptsByTags(
    projectId: string,
    userId: string,
    tags: string[]
  ): Promise<Prompt[]> {
    // Check project access
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole) {
      throw new AuthorizationError('Access denied to project');
    }

    const prompts = await prisma.prompt.findMany({
      where: {
        projectId,
        tags: {
          hasSome: tags,
        },
        isArchived: false,
      },
      include: {
        _count: {
          select: {
            testRuns: true,
            versions: true,
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    return prompts;
  }

  /**
   * Get all unique tags for a project
   */
  static async getProjectTags(projectId: string, userId: string): Promise<string[]> {
    // Check project access
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole) {
      throw new AuthorizationError('Access denied to project');
    }

    const prompts = await prisma.prompt.findMany({
      where: {
        projectId,
        isArchived: false,
      },
      select: {
        tags: true,
      }
    });

    // Flatten and deduplicate tags
    const allTags = prompts.flatMap(prompt => prompt.tags);
    const uniqueTags = [...new Set(allTags)].sort();

    return uniqueTags;
  }
}