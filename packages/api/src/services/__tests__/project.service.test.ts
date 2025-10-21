/**
 * Project Service Unit Tests
 * 
 * Tests project management functionality including CRUD operations,
 * user authorization, and project settings management.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ProjectService } from '../project.service';
import { mockPrismaClient } from '../../tests/setup';
import { userFactory, projectFactory } from '../../tests/fixtures';

describe('ProjectService', () => {
  let projectService: ProjectService;

  beforeEach(() => {
    projectService = new ProjectService();
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should successfully create a new project', async () => {
      const userId = 'user_id';
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        settings: { maxConcurrentTests: 5 }
      };

      const createdProject = projectFactory.create({
        ...projectData,
        userId
      });

      mockPrismaClient.project.create.mockResolvedValue(createdProject);

      const result = await projectService.createProject(userId, projectData);

      expect(mockPrismaClient.project.create).toHaveBeenCalledWith({
        data: {
          name: projectData.name,
          description: projectData.description,
          settings: projectData.settings,
          userId
        }
      });
      expect(result).toEqual(createdProject);
    });

    it('should use default settings if none provided', async () => {
      const userId = 'user_id';
      const projectData = {
        name: 'Test Project',
        description: 'A test project'
      };

      const createdProject = projectFactory.create({
        ...projectData,
        userId,
        settings: {} // Default empty settings
      });

      mockPrismaClient.project.create.mockResolvedValue(createdProject);

      await projectService.createProject(userId, projectData);

      expect(mockPrismaClient.project.create).toHaveBeenCalledWith({
        data: {
          name: projectData.name,
          description: projectData.description,
          settings: {},
          userId
        }
      });
    });
  });

  describe('getProject', () => {
    it('should return project if user is owner', async () => {
      const userId = 'user_id';
      const projectId = 'project_id';
      const project = projectFactory.create({ id: projectId, userId });

      mockPrismaClient.project.findUnique.mockResolvedValue(project);

      const result = await projectService.getProject(projectId, userId);

      expect(mockPrismaClient.project.findUnique).toHaveBeenCalledWith({
        where: { id: projectId },
        include: {
          prompts: true,
          testRuns: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });
      expect(result).toEqual(project);
    });

    it('should throw error if project not found', async () => {
      const userId = 'user_id';
      const projectId = 'nonexistent_project';

      mockPrismaClient.project.findUnique.mockResolvedValue(null);

      await expect(
        projectService.getProject(projectId, userId)
      ).rejects.toThrow('Project not found');
    });

    it('should throw error if user is not owner', async () => {
      const userId = 'user_id';
      const otherUserId = 'other_user_id';
      const projectId = 'project_id';
      const project = projectFactory.create({ id: projectId, userId: otherUserId });

      mockPrismaClient.project.findUnique.mockResolvedValue(project);

      await expect(
        projectService.getProject(projectId, userId)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('listProjects', () => {
    it('should return paginated list of user projects', async () => {
      const userId = 'user_id';
      const projects = projectFactory.createMany(3, { userId });

      mockPrismaClient.project.findMany.mockResolvedValue(projects);
      mockPrismaClient.project.count.mockResolvedValue(3);

      const result = await projectService.listProjects(userId, { page: 1, limit: 10 });

      expect(mockPrismaClient.project.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          _count: {
            select: { prompts: true, testRuns: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10
      });

      expect(mockPrismaClient.project.count).toHaveBeenCalledWith({
        where: { userId }
      });

      expect(result).toEqual({
        projects,
        total: 3,
        page: 1,
        limit: 10,
        totalPages: 1
      });
    });

    it('should handle search filter', async () => {
      const userId = 'user_id';
      const searchTerm = 'test';
      const projects = projectFactory.createMany(2, { userId });

      mockPrismaClient.project.findMany.mockResolvedValue(projects);
      mockPrismaClient.project.count.mockResolvedValue(2);

      await projectService.listProjects(userId, { 
        page: 1, 
        limit: 10, 
        search: searchTerm 
      });

      expect(mockPrismaClient.project.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        include: {
          _count: {
            select: { prompts: true, testRuns: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10
      });
    });
  });

  describe('updateProject', () => {
    it('should successfully update project if user is owner', async () => {
      const userId = 'user_id';
      const projectId = 'project_id';
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description'
      };

      const existingProject = projectFactory.create({ id: projectId, userId });
      const updatedProject = { ...existingProject, ...updateData };

      mockPrismaClient.project.findUnique.mockResolvedValue(existingProject);
      mockPrismaClient.project.update.mockResolvedValue(updatedProject);

      const result = await projectService.updateProject(projectId, userId, updateData);

      expect(mockPrismaClient.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: updateData
      });
      expect(result).toEqual(updatedProject);
    });

    it('should throw error if user is not owner', async () => {
      const userId = 'user_id';
      const otherUserId = 'other_user_id';
      const projectId = 'project_id';
      const project = projectFactory.create({ id: projectId, userId: otherUserId });

      mockPrismaClient.project.findUnique.mockResolvedValue(project);

      await expect(
        projectService.updateProject(projectId, userId, { name: 'Updated' })
      ).rejects.toThrow('Access denied');
    });
  });

  describe('deleteProject', () => {
    it('should successfully delete project if user is owner', async () => {
      const userId = 'user_id';
      const projectId = 'project_id';
      const project = projectFactory.create({ id: projectId, userId });

      mockPrismaClient.project.findUnique.mockResolvedValue(project);
      mockPrismaClient.project.delete.mockResolvedValue(project);

      await projectService.deleteProject(projectId, userId);

      expect(mockPrismaClient.project.delete).toHaveBeenCalledWith({
        where: { id: projectId }
      });
    });

    it('should throw error if user is not owner', async () => {
      const userId = 'user_id';
      const otherUserId = 'other_user_id';
      const projectId = 'project_id';
      const project = projectFactory.create({ id: projectId, userId: otherUserId });

      mockPrismaClient.project.findUnique.mockResolvedValue(project);

      await expect(
        projectService.deleteProject(projectId, userId)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('updateProjectSettings', () => {
    it('should successfully update project settings', async () => {
      const userId = 'user_id';
      const projectId = 'project_id';
      const newSettings = {
        maxConcurrentTests: 10,
        timeoutMs: 60000,
        retryCount: 5
      };

      const existingProject = projectFactory.create({ 
        id: projectId, 
        userId,
        settings: { maxConcurrentTests: 5 }
      });
      const updatedProject = { 
        ...existingProject, 
        settings: { ...existingProject.settings, ...newSettings }
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(existingProject);
      mockPrismaClient.project.update.mockResolvedValue(updatedProject);

      const result = await projectService.updateProjectSettings(
        projectId, 
        userId, 
        newSettings
      );

      expect(mockPrismaClient.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          settings: { ...existingProject.settings, ...newSettings }
        }
      });
      expect(result).toEqual(updatedProject);
    });
  });
});