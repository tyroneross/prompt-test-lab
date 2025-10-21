import { PrismaClient } from '../generated/client';
import { ValidationError, NotFoundError } from '@prompt-lab/shared';
import type { 
  ImpactAnalysisRequest, 
  ImpactAnalysisResult,
  ModelConfig 
} from '@prompt-lab/shared';
import { LLMService } from './llm.service';
import { ProjectService } from './project.service';

const prisma = new PrismaClient();

export class ImpactAnalysisService {
  /**
   * Perform impact analysis between two prompts
   */
  static async performImpactAnalysis(
    userId: string,
    projectId: string,
    request: ImpactAnalysisRequest,
    deploymentId?: string
  ): Promise<ImpactAnalysisResult> {
    // Validate user access to project
    await ProjectService.getProjectById(projectId, userId);

    // Validate that both prompts exist and belong to the project
    const [currentPrompt, newPrompt] = await Promise.all([
      this.validatePromptAccess(request.baselinePromptId, projectId),
      this.validatePromptAccess(request.promptId, projectId)
    ]);

    // Generate sample inputs if not provided
    const sampleInputs = request.sampleInputs || await this.generateSampleInputs(currentPrompt.content);

    // Run both prompts against the sample inputs
    const modelConfig = request.modelConfig || {
      provider: 'openai' as const,
      modelName: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000
    };

    const [currentOutputs, newOutputs] = await Promise.all([
      this.runPromptTests(currentPrompt.content, sampleInputs, modelConfig),
      this.runPromptTests(newPrompt.content, sampleInputs, modelConfig)
    ]);

    // Perform diff analysis
    const diffAnalysis = this.analyzeDifferences(currentPrompt.content, newPrompt.content);

    // Calculate impact percentage
    const impactPercentage = this.calculateImpactPercentage(currentOutputs, newOutputs);

    // Create sample comparisons
    const sampleComparisons = sampleInputs.map((input, index) => ({
      input,
      currentOutput: currentOutputs[index] || '',
      newOutput: newOutputs[index] || '',
      score: this.calculateSimilarityScore(currentOutputs[index] || '', newOutputs[index] || '')
    }));

    // Save the analysis to database
    const analysis = await prisma.impactAnalysis.create({
      data: {
        impactPercentage,
        diffAnalysis: {
          added: diffAnalysis.added,
          removed: diffAnalysis.removed,
          modified: diffAnalysis.modified
        },
        sampleComparisons,
        deploymentId: deploymentId || null,
        baselinePromptId: request.baselinePromptId
      }
    });

    return {
      id: analysis.id,
      impactPercentage: analysis.impactPercentage,
      diffAnalysis: analysis.diffAnalysis as any,
      sampleComparisons: analysis.sampleComparisons as any,
      createdAt: analysis.createdAt,
      deploymentId: analysis.deploymentId || '',
      baselinePromptId: analysis.baselinePromptId
    };
  }

  /**
   * Get impact analysis by ID
   */
  static async getImpactAnalysis(
    userId: string,
    analysisId: string
  ): Promise<ImpactAnalysisResult> {
    const analysis = await prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        deployment: {
          include: {
            environment: {
              include: {
                project: true
              }
            }
          }
        }
      }
    });

    if (!analysis) {
      throw new NotFoundError('Impact analysis not found');
    }

    // Validate user access to the project
    if (analysis.deployment?.environment.project) {
      await ProjectService.getProjectById(analysis.deployment.environment.project.id, userId);
    }

    return {
      id: analysis.id,
      impactPercentage: analysis.impactPercentage,
      diffAnalysis: analysis.diffAnalysis as any,
      sampleComparisons: analysis.sampleComparisons as any,
      createdAt: analysis.createdAt,
      deploymentId: analysis.deploymentId || '',
      baselinePromptId: analysis.baselinePromptId
    };
  }

  /**
   * Get impact analyses for a deployment
   */
  static async getDeploymentImpactAnalyses(
    userId: string,
    deploymentId: string
  ): Promise<ImpactAnalysisResult[]> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        environment: {
          include: {
            project: true
          }
        }
      }
    });

    if (!deployment) {
      throw new NotFoundError('Deployment not found');
    }

    // Validate user access to the project
    await ProjectService.getProjectById(deployment.environment.project.id, userId);

    const analyses = await prisma.impactAnalysis.findMany({
      where: { deploymentId },
      orderBy: { createdAt: 'desc' }
    });

    return analyses.map(analysis => ({
      id: analysis.id,
      impactPercentage: analysis.impactPercentage,
      diffAnalysis: analysis.diffAnalysis as any,
      sampleComparisons: analysis.sampleComparisons as any,
      createdAt: analysis.createdAt,
      deploymentId: analysis.deploymentId || '',
      baselinePromptId: analysis.baselinePromptId
    }));
  }

  /**
   * Validate prompt access
   */
  private static async validatePromptAccess(promptId: string, projectId: string) {
    const prompt = await prisma.prompt.findUnique({
      where: { 
        id: promptId,
        projectId: projectId 
      }
    });

    if (!prompt) {
      throw new NotFoundError('Prompt not found or does not belong to this project');
    }

    return prompt;
  }

  /**
   * Generate sample inputs for testing
   */
  private static async generateSampleInputs(promptContent: string): Promise<string[]> {
    // Simple approach - extract common patterns or use predefined samples
    // In a real implementation, this could use AI to generate diverse test cases
    const samples = [
      "Write a professional email to a client.",
      "Explain a complex technical concept in simple terms.",
      "Create a summary of the key points from a meeting.",
      "Draft a response to a customer complaint.",
      "Generate ideas for improving team productivity."
    ];

    // Return first 3 samples for analysis
    return samples.slice(0, 3);
  }

  /**
   * Run prompt tests against sample inputs
   */
  private static async runPromptTests(
    promptContent: string, 
    sampleInputs: string[], 
    modelConfig: ModelConfig
  ): Promise<string[]> {
    const outputs: string[] = [];

    for (const input of sampleInputs) {
      try {
        const fullPrompt = `${promptContent}\n\nInput: ${input}`;
        const response = await LLMService.generateResponse(fullPrompt, modelConfig as any);
        outputs.push(response.output || '');
      } catch (error) {
        console.error('Error running prompt test:', error);
        outputs.push('Error: Could not generate response');
      }
    }

    return outputs;
  }

  /**
   * Analyze differences between two prompts
   */
  private static analyzeDifferences(oldPrompt: string, newPrompt: string) {
    const oldLines = oldPrompt.split('\n').filter(line => line.trim());
    const newLines = newPrompt.split('\n').filter(line => line.trim());

    const added: string[] = [];
    const removed: string[] = [];
    const modified: Array<{ field: string; oldValue: string; newValue: string }> = [];

    // Simple line-by-line comparison
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (!oldLine && newLine) {
        added.push(newLine);
      } else if (oldLine && !newLine) {
        removed.push(oldLine);
      } else if (oldLine && newLine && oldLine !== newLine) {
        modified.push({
          field: `line_${i + 1}`,
          oldValue: oldLine,
          newValue: newLine
        });
      }
    }

    return { added, removed, modified };
  }

  /**
   * Calculate impact percentage based on output differences
   */
  private static calculateImpactPercentage(
    currentOutputs: string[], 
    newOutputs: string[]
  ): number {
    if (currentOutputs.length !== newOutputs.length) {
      return 100; // Complete change if output counts differ
    }

    let totalSimilarity = 0;
    const count = currentOutputs.length;

    for (let i = 0; i < count; i++) {
      const similarity = this.calculateSimilarityScore(currentOutputs[i], newOutputs[i]);
      totalSimilarity += similarity;
    }

    const averageSimilarity = totalSimilarity / count;
    return Math.round((1 - averageSimilarity) * 100);
  }

  /**
   * Calculate similarity score between two strings (0 = identical, 1 = completely different)
   */
  private static calculateSimilarityScore(str1: string, str2: string): number {
    if (str1 === str2) return 0;
    if (!str1 || !str2) return 1;

    // Use Levenshtein distance for similarity calculation
    const levenshteinDistance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) return 0;
    
    return levenshteinDistance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}