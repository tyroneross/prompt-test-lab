import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { PrismaClient } from '../generated/client';
import { ProjectService } from './project.service';
import { z } from 'zod';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Environment configuration schema
export const SupabaseEnvironmentConfigSchema = z.object({
  name: z.string().min(1, 'Environment name is required'),
  type: z.enum(['development', 'staging', 'production', 'preview']),
  supabaseUrl: z.string().url('Invalid Supabase URL'),
  supabaseAnonKey: z.string().min(1, 'Anon key is required'),
  supabaseServiceKey: z.string().min(1, 'Service key is required').optional(),
  projectRef: z.string().min(1, 'Project reference is required'),
  region: z.string().optional(),
  databaseUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  features: z.object({
    realtime: z.boolean().default(true),
    auth: z.boolean().default(true),
    storage: z.boolean().default(false),
    edgeFunctions: z.boolean().default(false)
  }).default({}),
  limits: z.object({
    maxConnections: z.number().min(1).max(1000).default(100),
    maxSubscriptions: z.number().min(1).max(100).default(50),
    rateLimitRpm: z.number().min(1).max(10000).default(1000), // requests per minute
    maxPayloadSize: z.number().min(1000).max(10000000).default(1000000) // bytes
  }).default({}),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    metricsEnabled: z.boolean().default(true),
    alertingEnabled: z.boolean().default(false),
    webhookUrl: z.string().url().optional()
  }).default({})
});

export const ConnectionPoolConfigSchema = z.object({
  minConnections: z.number().min(1).max(50).default(5),
  maxConnections: z.number().min(1).max(100).default(20),
  idleTimeoutMs: z.number().min(10000).max(300000).default(60000), // 1 minute
  connectionTimeoutMs: z.number().min(1000).max(30000).default(10000), // 10 seconds
  retryAttempts: z.number().min(0).max(10).default(3),
  retryDelayMs: z.number().min(1000).max(30000).default(5000),
  healthCheckIntervalMs: z.number().min(30000).max(300000).default(60000) // 1 minute
});

export const SecurityConfigSchema = z.object({
  encryptApiKeys: z.boolean().default(true),
  allowInsecureConnections: z.boolean().default(false),
  tlsMinVersion: z.string().default('1.2'),
  certificateValidation: z.boolean().default(true),
  ipWhitelist: z.array(z.string()).optional(),
  apiKeyRotationDays: z.number().min(1).max(365).default(90),
  sessionTimeoutMinutes: z.number().min(1).max(1440).default(60), // 1 hour
  maxFailedAttempts: z.number().min(1).max(20).default(5)
});

export const BackupConfigSchema = z.object({
  enabled: z.boolean().default(false),
  schedule: z.string().default('0 2 * * *'), // Daily at 2 AM
  retention: z.object({
    daily: z.number().min(1).max(365).default(7),
    weekly: z.number().min(1).max(52).default(4),
    monthly: z.number().min(1).max(12).default(3)
  }).default({}),
  compression: z.boolean().default(true),
  encryption: z.boolean().default(true),
  storageLocation: z.string().optional()
});

export type SupabaseEnvironmentConfig = z.infer<typeof SupabaseEnvironmentConfigSchema>;
export type ConnectionPoolConfig = z.infer<typeof ConnectionPoolConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type BackupConfig = z.infer<typeof BackupConfigSchema>;

export interface SupabaseProjectConfig {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  environments: SupabaseEnvironmentConfig[];
  connectionPool: ConnectionPoolConfig;
  security: SecurityConfig;
  backup?: BackupConfig;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ConnectionMetrics {
  environmentName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'down';
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  lastHealthCheck: Date;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  errors: Array<{
    timestamp: Date;
    error: string;
    type: string;
  }>;
}

/**
 * Service for managing Supabase configuration and environments
 */
export class SupabaseConfigService {
  private static encryptionKey: string = process.env.SUPABASE_ENCRYPTION_KEY || 'default-key-change-in-production';
  private static configCache = new Map<string, SupabaseProjectConfig>();
  private static metricsCache = new Map<string, ConnectionMetrics>();

  /**
   * Create Supabase project configuration
   */
  static async createProjectConfig(
    userId: string,
    projectId: string,
    config: {
      name: string;
      description?: string;
      environments: SupabaseEnvironmentConfig[];
      connectionPool?: ConnectionPoolConfig;
      security?: SecurityConfig;
      backup?: BackupConfig;
    }
  ): Promise<SupabaseProjectConfig> {
    // Validate user permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to create Supabase configuration');
    }

    // Validate environments
    const validatedEnvironments = config.environments.map(env =>
      SupabaseEnvironmentConfigSchema.parse(env)
    );

    // Validate other configurations
    const validatedConnectionPool = config.connectionPool ?
      ConnectionPoolConfigSchema.parse(config.connectionPool) :
      ConnectionPoolConfigSchema.parse({});

    const validatedSecurity = config.security ?
      SecurityConfigSchema.parse(config.security) :
      SecurityConfigSchema.parse({});

    const validatedBackup = config.backup ?
      BackupConfigSchema.parse(config.backup) :
      undefined;

    // Encrypt sensitive data
    const encryptedEnvironments = await Promise.all(
      validatedEnvironments.map(env => this.encryptEnvironmentSecrets(env))
    );

    // Create configuration record
    const configData = {
      name: config.name,
      description: config.description,
      environments: encryptedEnvironments,
      connectionPool: validatedConnectionPool,
      security: validatedSecurity,
      backup: validatedBackup,
      metadata: {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        totalEnvironments: encryptedEnvironments.length
      }
    };

    // Store in database
    const dbConfig = await prisma.appIntegration.create({
      data: {
        projectId,
        name: config.name,
        type: 'supabase_config',
        baseUrl: encryptedEnvironments[0]?.supabaseUrl || '',
        apiKeyHash: await this.hashApiKey(encryptedEnvironments[0]?.supabaseAnonKey || ''),
        syncConfig: configData as any,
        isActive: true,
        createdBy: userId
      }
    });

    const projectConfig: SupabaseProjectConfig = {
      id: dbConfig.id,
      projectId,
      name: config.name,
      description: config.description,
      environments: validatedEnvironments, // Return decrypted for immediate use
      connectionPool: validatedConnectionPool,
      security: validatedSecurity,
      backup: validatedBackup,
      metadata: configData.metadata,
      createdAt: dbConfig.createdAt,
      updatedAt: dbConfig.updatedAt,
      createdBy: userId
    };

    // Cache configuration
    this.configCache.set(dbConfig.id, projectConfig);

    return projectConfig;
  }

  /**
   * Get Supabase project configuration
   */
  static async getProjectConfig(
    configId: string,
    userId: string
  ): Promise<SupabaseProjectConfig> {
    // Check cache first
    const cachedConfig = this.configCache.get(configId);
    if (cachedConfig) {
      return cachedConfig;
    }

    // Load from database
    const dbConfig = await prisma.appIntegration.findUnique({
      where: { id: configId, type: 'supabase_config' }
    });

    if (!dbConfig) {
      throw new NotFoundError('Supabase configuration not found');
    }

    // Validate user access
    await ProjectService.getProjectById(dbConfig.projectId, userId);

    const syncConfig = dbConfig.syncConfig as any;
    
    // Decrypt environments
    const decryptedEnvironments = await Promise.all(
      (syncConfig.environments || []).map((env: any) => this.decryptEnvironmentSecrets(env))
    );

    const projectConfig: SupabaseProjectConfig = {
      id: dbConfig.id,
      projectId: dbConfig.projectId,
      name: syncConfig.name,
      description: syncConfig.description,
      environments: decryptedEnvironments,
      connectionPool: syncConfig.connectionPool,
      security: syncConfig.security,
      backup: syncConfig.backup,
      metadata: syncConfig.metadata,
      createdAt: dbConfig.createdAt,
      updatedAt: dbConfig.updatedAt,
      createdBy: dbConfig.createdBy
    };

    // Cache configuration
    this.configCache.set(configId, projectConfig);

    return projectConfig;
  }

  /**
   * Update Supabase project configuration
   */
  static async updateProjectConfig(
    configId: string,
    userId: string,
    updates: Partial<{
      name: string;
      description: string;
      environments: SupabaseEnvironmentConfig[];
      connectionPool: ConnectionPoolConfig;
      security: SecurityConfig;
      backup: BackupConfig;
    }>
  ): Promise<SupabaseProjectConfig> {
    const existingConfig = await this.getProjectConfig(configId, userId);

    // Validate user permissions
    const userRole = await ProjectService.getUserProjectRole(existingConfig.projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to update Supabase configuration');
    }

    // Merge updates
    const updatedConfig = {
      ...existingConfig,
      ...updates,
      metadata: {
        ...existingConfig.metadata,
        lastUpdated: new Date().toISOString(),
        version: this.incrementVersion(existingConfig.metadata.version || '1.0')
      }
    };

    // Validate updated environments if provided
    if (updates.environments) {
      updatedConfig.environments = updates.environments.map(env =>
        SupabaseEnvironmentConfigSchema.parse(env)
      );
    }

    // Encrypt sensitive data
    const encryptedEnvironments = await Promise.all(
      updatedConfig.environments.map(env => this.encryptEnvironmentSecrets(env))
    );

    // Update database
    await prisma.appIntegration.update({
      where: { id: configId },
      data: {
        name: updatedConfig.name,
        syncConfig: {
          name: updatedConfig.name,
          description: updatedConfig.description,
          environments: encryptedEnvironments,
          connectionPool: updatedConfig.connectionPool,
          security: updatedConfig.security,
          backup: updatedConfig.backup,
          metadata: updatedConfig.metadata
        } as any
      }
    });

    // Update cache
    this.configCache.set(configId, updatedConfig);

    return updatedConfig;
  }

  /**
   * Add environment to project configuration
   */
  static async addEnvironment(
    configId: string,
    userId: string,
    environment: SupabaseEnvironmentConfig
  ): Promise<SupabaseProjectConfig> {
    const config = await this.getProjectConfig(configId, userId);
    
    // Validate environment
    const validatedEnvironment = SupabaseEnvironmentConfigSchema.parse(environment);

    // Check for duplicate environment names
    const existingEnv = config.environments.find(env => env.name === validatedEnvironment.name);
    if (existingEnv) {
      throw new ValidationError(`Environment with name '${validatedEnvironment.name}' already exists`);
    }

    // Add environment
    const updatedEnvironments = [...config.environments, validatedEnvironment];

    return this.updateProjectConfig(configId, userId, {
      environments: updatedEnvironments
    });
  }

  /**
   * Remove environment from project configuration
   */
  static async removeEnvironment(
    configId: string,
    userId: string,
    environmentName: string
  ): Promise<SupabaseProjectConfig> {
    const config = await this.getProjectConfig(configId, userId);

    // Find environment
    const envIndex = config.environments.findIndex(env => env.name === environmentName);
    if (envIndex === -1) {
      throw new NotFoundError(`Environment '${environmentName}' not found`);
    }

    // Prevent removing last environment
    if (config.environments.length === 1) {
      throw new ValidationError('Cannot remove the last environment');
    }

    // Remove environment
    const updatedEnvironments = config.environments.filter(env => env.name !== environmentName);

    return this.updateProjectConfig(configId, userId, {
      environments: updatedEnvironments
    });
  }

  /**
   * Get environment by name
   */
  static async getEnvironment(
    configId: string,
    userId: string,
    environmentName: string
  ): Promise<SupabaseEnvironmentConfig> {
    const config = await this.getProjectConfig(configId, userId);
    
    const environment = config.environments.find(env => env.name === environmentName);
    if (!environment) {
      throw new NotFoundError(`Environment '${environmentName}' not found`);
    }

    return environment;
  }

  /**
   * Test environment connection
   */
  static async testEnvironmentConnection(
    configId: string,
    userId: string,
    environmentName: string
  ): Promise<{
    success: boolean;
    latency?: number;
    version?: string;
    features?: {
      realtime: boolean;
      auth: boolean;
      storage: boolean;
      edgeFunctions: boolean;
    };
    error?: string;
  }> {
    const environment = await this.getEnvironment(configId, userId, environmentName);

    try {
      const startTime = Date.now();

      // Create temporary client for testing
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

      // Test basic connection
      const { error: testError } = await client.from('test_connection').select('*').limit(1);
      
      const latency = Date.now() - startTime;

      // Test error is expected for non-existent table
      if (testError && testError.code !== 'PGRST116') {
        return {
          success: false,
          error: testError.message
        };
      }

      // Test various features
      const features = {
        realtime: environment.features.realtime,
        auth: environment.features.auth,
        storage: environment.features.storage,
        edgeFunctions: environment.features.edgeFunctions
      };

      // Try to get version info
      let version: string | undefined;
      try {
        const { data } = await client.rpc('version');
        version = data?.toString();
      } catch {
        // Version check failed, but connection is still valid
      }

      return {
        success: true,
        latency,
        version,
        features
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }

  /**
   * Get connection metrics for environment
   */
  static async getEnvironmentMetrics(
    configId: string,
    userId: string,
    environmentName: string
  ): Promise<ConnectionMetrics> {
    const environment = await this.getEnvironment(configId, userId, environmentName);
    const metricsKey = `${configId}-${environmentName}`;

    // Check cache first
    const cachedMetrics = this.metricsCache.get(metricsKey);
    if (cachedMetrics && Date.now() - cachedMetrics.lastHealthCheck.getTime() < 60000) { // 1 minute cache
      return cachedMetrics;
    }

    // Test connection and gather metrics
    const connectionTest = await this.testEnvironmentConnection(configId, userId, environmentName);
    
    const metrics: ConnectionMetrics = {
      environmentName,
      status: connectionTest.success ? 'healthy' : 'down',
      activeConnections: 0, // Would need to be tracked separately
      totalRequests: 0, // Would need to be tracked separately
      errorRate: connectionTest.success ? 0 : 100,
      averageResponseTime: connectionTest.latency || 0,
      lastHealthCheck: new Date(),
      uptime: connectionTest.success ? 100 : 0,
      memory: {
        used: 0, // Would need system monitoring
        total: 0,
        percentage: 0
      },
      errors: connectionTest.error ? [{
        timestamp: new Date(),
        error: connectionTest.error,
        type: 'connection_error'
      }] : []
    };

    // Cache metrics
    this.metricsCache.set(metricsKey, metrics);

    return metrics;
  }

  /**
   * Rotate API keys for environment
   */
  static async rotateEnvironmentKeys(
    configId: string,
    userId: string,
    environmentName: string,
    newKeys: {
      supabaseAnonKey?: string;
      supabaseServiceKey?: string;
    }
  ): Promise<{ success: boolean; rotatedKeys: string[]; error?: string }> {
    try {
      const config = await this.getProjectConfig(configId, userId);
      
      // Validate user permissions
      const userRole = await ProjectService.getUserProjectRole(config.projectId, userId);
      if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
        throw new AuthorizationError('Insufficient permissions to rotate API keys');
      }

      const envIndex = config.environments.findIndex(env => env.name === environmentName);
      if (envIndex === -1) {
        throw new NotFoundError(`Environment '${environmentName}' not found`);
      }

      const environment = { ...config.environments[envIndex] };
      const rotatedKeys: string[] = [];

      // Update keys
      if (newKeys.supabaseAnonKey) {
        environment.supabaseAnonKey = newKeys.supabaseAnonKey;
        rotatedKeys.push('anon_key');
      }

      if (newKeys.supabaseServiceKey) {
        environment.supabaseServiceKey = newKeys.supabaseServiceKey;
        rotatedKeys.push('service_key');
      }

      // Test new keys
      const testResult = await this.testEnvironmentConnection(configId, userId, environmentName);
      if (!testResult.success) {
        return {
          success: false,
          rotatedKeys: [],
          error: `Key rotation failed: ${testResult.error}`
        };
      }

      // Update configuration
      const updatedEnvironments = [...config.environments];
      updatedEnvironments[envIndex] = environment;

      await this.updateProjectConfig(configId, userId, {
        environments: updatedEnvironments
      });

      return {
        success: true,
        rotatedKeys
      };

    } catch (error) {
      return {
        success: false,
        rotatedKeys: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete project configuration
   */
  static async deleteProjectConfig(
    configId: string,
    userId: string
  ): Promise<void> {
    const config = await this.getProjectConfig(configId, userId);

    // Validate user permissions
    const userRole = await ProjectService.getUserProjectRole(config.projectId, userId);
    if (!userRole || !['OWNER'].includes(userRole)) {
      throw new AuthorizationError('Only project owners can delete Supabase configurations');
    }

    // Delete from database
    await prisma.appIntegration.delete({
      where: { id: configId }
    });

    // Remove from cache
    this.configCache.delete(configId);
    
    // Remove metrics cache
    config.environments.forEach(env => {
      this.metricsCache.delete(`${configId}-${env.name}`);
    });
  }

  /**
   * List project configurations for user
   */
  static async listProjectConfigs(
    userId: string,
    projectId?: string
  ): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    projectId: string;
    environmentCount: number;
    lastUpdated: Date;
    status: 'active' | 'inactive';
  }>> {
    const where: any = {
      type: 'supabase_config',
      createdBy: userId
    };

    if (projectId) {
      // Validate user access to project
      await ProjectService.getProjectById(projectId, userId);
      where.projectId = projectId;
    }

    const configs = await prisma.appIntegration.findMany({
      where,
      select: {
        id: true,
        name: true,
        projectId: true,
        syncConfig: true,
        updatedAt: true,
        isActive: true
      }
    });

    return configs.map(config => {
      const syncConfig = config.syncConfig as any;
      return {
        id: config.id,
        name: config.name,
        description: syncConfig?.description,
        projectId: config.projectId,
        environmentCount: syncConfig?.environments?.length || 0,
        lastUpdated: config.updatedAt,
        status: config.isActive ? 'active' : 'inactive'
      };
    });
  }

  // Private helper methods

  private static async encryptEnvironmentSecrets(env: SupabaseEnvironmentConfig): Promise<any> {
    const encrypted = { ...env };
    
    if (env.supabaseAnonKey) {
      encrypted.supabaseAnonKey = this.encrypt(env.supabaseAnonKey);
    }
    
    if (env.supabaseServiceKey) {
      encrypted.supabaseServiceKey = this.encrypt(env.supabaseServiceKey);
    }

    return encrypted;
  }

  private static async decryptEnvironmentSecrets(env: any): Promise<SupabaseEnvironmentConfig> {
    const decrypted = { ...env };
    
    if (env.supabaseAnonKey) {
      decrypted.supabaseAnonKey = this.decrypt(env.supabaseAnonKey);
    }
    
    if (env.supabaseServiceKey) {
      decrypted.supabaseServiceKey = this.decrypt(env.supabaseServiceKey);
    }

    return SupabaseEnvironmentConfigSchema.parse(decrypted);
  }

  private static encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private static decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private static async hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`;
  }
}