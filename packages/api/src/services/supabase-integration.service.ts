import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/realtime-js';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { PrismaClient } from '../generated/client';
import { ProjectService } from './project.service';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const SupabaseConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  supabaseUrl: z.string().url('Invalid Supabase URL'),
  supabaseAnonKey: z.string().min(1, 'Anon key is required'),
  supabaseServiceKey: z.string().min(1, 'Service key is required').optional(),
  projectRef: z.string().min(1, 'Project reference is required'),
  useServiceKey: z.boolean().default(false),
  enableRealtime: z.boolean().default(true),
  enableRLS: z.boolean().default(true),
  syncConfig: z.object({
    autoSync: z.boolean().default(false),
    syncInterval: z.number().min(1).default(60), // minutes
    bidirectional: z.boolean().default(true),
    conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins', 'newest_wins']).default('manual'),
    promptFilters: z.object({
      tables: z.array(z.string()).optional(),
      schemas: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      modifiedAfter: z.date().optional()
    }).optional(),
    realTimeEvents: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])).default(['INSERT', 'UPDATE', 'DELETE'])
  })
});

export const SupabaseAuthConfigSchema = z.object({
  jwt: z.object({
    secret: z.string().min(1, 'JWT secret is required'),
    issuer: z.string().optional(),
    audience: z.string().optional()
  }),
  rls: z.object({
    enabled: z.boolean().default(true),
    policies: z.array(z.object({
      table: z.string(),
      policy: z.string(),
      role: z.string().optional()
    })).optional()
  }).optional()
});

export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;
export type SupabaseAuthConfig = z.infer<typeof SupabaseAuthConfigSchema>;

export interface SupabaseConnection {
  id: string;
  name: string;
  supabaseUrl: string;
  projectRef: string;
  useServiceKey: boolean;
  enableRealtime: boolean;
  enableRLS: boolean;
  isActive: boolean;
  lastSync?: Date;
  syncConfig: SupabaseConfig['syncConfig'];
  client: SupabaseClient;
  authClient?: SupabaseClient; // Service key client for admin operations
}

export interface SupabasePrompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  user_id?: string;
  project_id?: string;
}

export interface SupabaseTableConfig {
  tableName: string;
  schema: string;
  columns: {
    id: string;
    name: string;
    content: string;
    description?: string;
    tags?: string;
    metadata?: string;
    created_at: string;
    updated_at: string;
    user_id?: string;
    project_id?: string;
  };
}

/**
 * Service for integrating with Supabase applications
 */
export class SupabaseIntegrationService {
  private static connections = new Map<string, SupabaseConnection>();
  private static realtimeChannels = new Map<string, RealtimeChannel>();

  /**
   * Register a Supabase integration
   */
  static async registerSupabaseIntegration(
    userId: string,
    projectId: string,
    config: SupabaseConfig
  ): Promise<SupabaseConnection> {
    // Validate user permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to register Supabase integrations');
    }

    // Validate configuration
    const validatedConfig = SupabaseConfigSchema.parse(config);

    // Test connection to Supabase
    const connection = await this.createSupabaseConnection(validatedConfig);
    await this.validateSupabaseConnection(connection);

    // Store the integration configuration
    const integration = await prisma.appIntegration.create({
      data: {
        projectId,
        name: validatedConfig.name,
        type: 'supabase',
        baseUrl: validatedConfig.supabaseUrl,
        apiKeyHash: await this.hashApiKey(validatedConfig.supabaseAnonKey),
        syncConfig: validatedConfig.syncConfig,
        isActive: true,
        createdBy: userId
      }
    });

    // Store the connection for reuse
    const connectionInfo: SupabaseConnection = {
      id: integration.id,
      name: validatedConfig.name,
      supabaseUrl: validatedConfig.supabaseUrl,
      projectRef: validatedConfig.projectRef,
      useServiceKey: validatedConfig.useServiceKey,
      enableRealtime: validatedConfig.enableRealtime,
      enableRLS: validatedConfig.enableRLS,
      isActive: true,
      syncConfig: validatedConfig.syncConfig,
      client: connection,
      authClient: validatedConfig.supabaseServiceKey ? 
        createClient(validatedConfig.supabaseUrl, validatedConfig.supabaseServiceKey) : undefined
    };

    this.connections.set(integration.id, connectionInfo);

    return connectionInfo;
  }

  /**
   * Get Supabase connection by ID
   */
  static async getSupabaseConnection(
    connectionId: string,
    projectId?: string
  ): Promise<SupabaseConnection> {
    // Check if connection is cached
    const cachedConnection = this.connections.get(connectionId);
    if (cachedConnection) {
      return cachedConnection;
    }

    // Load from database
    const integration = await prisma.appIntegration.findUnique({
      where: { id: connectionId, type: 'supabase' }
    });

    if (!integration) {
      throw new NotFoundError('Supabase integration not found');
    }

    if (projectId && integration.projectId !== projectId) {
      throw new AuthorizationError('Integration does not belong to project');
    }

    // Recreate connection (Note: API keys would need to be retrieved securely)
    throw new ValidationError('Connection not cached. Please re-register the Supabase integration.');
  }

  /**
   * Test Supabase connection health
   */
  static async testConnection(connectionId: string): Promise<{
    healthy: boolean;
    latency?: number;
    version?: string;
    error?: string;
  }> {
    try {
      const connection = await this.getSupabaseConnection(connectionId);
      const startTime = Date.now();
      
      // Test basic connection
      const { data, error } = await connection.client
        .from('test_connection')
        .select('*')
        .limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 = table not found, which is expected
        return {
          healthy: false,
          error: error.message
        };
      }

      const latency = Date.now() - startTime;

      // Get Supabase version if possible
      let version: string | undefined;
      try {
        const { data: versionData } = await connection.client.rpc('version');
        version = versionData?.toString();
      } catch {
        // Version check failed, but connection is still healthy
      }

      return {
        healthy: true,
        latency,
        version
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List tables in Supabase project
   */
  static async listTables(
    connectionId: string,
    schema: string = 'public'
  ): Promise<Array<{
    name: string;
    schema: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  }>> {
    const connection = await this.getSupabaseConnection(connectionId);
    
    if (!connection.authClient) {
      throw new ValidationError('Service key required to list tables');
    }

    try {
      // Query information_schema to get table information
      const { data: tables, error } = await connection.authClient
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', schema)
        .eq('table_type', 'BASE TABLE');

      if (error) {
        throw new ValidationError(`Failed to list tables: ${error.message}`);
      }

      const tablesWithColumns = [];
      
      for (const table of tables || []) {
        const { data: columns, error: columnsError } = await connection.authClient
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_schema', schema)
          .eq('table_name', table.table_name);

        if (columnsError) {
          console.warn(`Failed to get columns for table ${table.table_name}:`, columnsError);
          continue;
        }

        tablesWithColumns.push({
          name: table.table_name,
          schema,
          columns: (columns || []).map(col => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES'
          }))
        });
      }

      return tablesWithColumns;
    } catch (error) {
      throw new ValidationError(`Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute direct query on Supabase
   */
  static async executeQuery(
    connectionId: string,
    query: {
      table: string;
      operation: 'select' | 'insert' | 'update' | 'delete';
      columns?: string[];
      filters?: Record<string, any>;
      data?: Record<string, any>;
      limit?: number;
    }
  ): Promise<{ data: any[]; count?: number; error?: string }> {
    const connection = await this.getSupabaseConnection(connectionId);
    
    try {
      let queryBuilder = connection.client.from(query.table);

      switch (query.operation) {
        case 'select':
          queryBuilder = queryBuilder.select(query.columns?.join(',') || '*');
          
          if (query.filters) {
            Object.entries(query.filters).forEach(([key, value]) => {
              queryBuilder = queryBuilder.eq(key, value);
            });
          }
          
          if (query.limit) {
            queryBuilder = queryBuilder.limit(query.limit);
          }
          break;

        case 'insert':
          if (!query.data) {
            throw new ValidationError('Data is required for insert operations');
          }
          queryBuilder = queryBuilder.insert(query.data);
          break;

        case 'update':
          if (!query.data) {
            throw new ValidationError('Data is required for update operations');
          }
          queryBuilder = queryBuilder.update(query.data);
          
          if (query.filters) {
            Object.entries(query.filters).forEach(([key, value]) => {
              queryBuilder = queryBuilder.eq(key, value);
            });
          }
          break;

        case 'delete':
          if (query.filters) {
            Object.entries(query.filters).forEach(([key, value]) => {
              queryBuilder = queryBuilder.eq(key, value);
            });
          }
          queryBuilder = queryBuilder.delete();
          break;
      }

      const { data, error, count } = await queryBuilder;

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: data || [], count };
    } catch (error) {
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user session from Supabase JWT token
   */
  static async getUserFromToken(
    connectionId: string,
    token: string
  ): Promise<{ user: User | null; session: Session | null; error?: string }> {
    const connection = await this.getSupabaseConnection(connectionId);
    
    try {
      const { data, error } = await connection.client.auth.getUser(token);

      if (error) {
        return { user: null, session: null, error: error.message };
      }

      // Get session information
      const { data: sessionData, error: sessionError } = await connection.client.auth.getSession();

      return { 
        user: data.user,
        session: sessionData.session,
        error: sessionError?.message
      };
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create RLS policy for prompt access
   */
  static async createRLSPolicy(
    connectionId: string,
    tableName: string,
    policyName: string,
    policyDefinition: {
      command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
      role?: string;
      using?: string;
      withCheck?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const connection = await this.getSupabaseConnection(connectionId);
    
    if (!connection.authClient) {
      throw new ValidationError('Service key required to create RLS policies');
    }

    try {
      const policy = `
        CREATE POLICY "${policyName}" ON "${tableName}"
        FOR ${policyDefinition.command}
        ${policyDefinition.role ? `TO ${policyDefinition.role}` : ''}
        ${policyDefinition.using ? `USING (${policyDefinition.using})` : ''}
        ${policyDefinition.withCheck ? `WITH CHECK (${policyDefinition.withCheck})` : ''}
      `;

      const { error } = await connection.authClient.rpc('exec_sql', { sql: policy });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enable RLS on a table
   */
  static async enableRLS(
    connectionId: string,
    tableName: string
  ): Promise<{ success: boolean; error?: string }> {
    const connection = await this.getSupabaseConnection(connectionId);
    
    if (!connection.authClient) {
      throw new ValidationError('Service key required to enable RLS');
    }

    try {
      const { error } = await connection.authClient.rpc('exec_sql', {
        sql: `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Close Supabase connection and cleanup
   */
  static async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove realtime subscriptions
    const channel = this.realtimeChannels.get(connectionId);
    if (channel) {
      await connection.client.removeChannel(channel);
      this.realtimeChannels.delete(connectionId);
    }

    // Remove connection from cache
    this.connections.delete(connectionId);

    // Update database status
    await prisma.appIntegration.update({
      where: { id: connectionId },
      data: { isActive: false }
    });
  }

  // Private helper methods

  private static async createSupabaseConnection(config: SupabaseConfig): Promise<SupabaseClient> {
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });

    return client;
  }

  private static async validateSupabaseConnection(client: SupabaseClient): Promise<void> {
    try {
      // Test basic connection
      const { error } = await client.from('test_connection').select('*').limit(1);
      
      // PGRST116 = table not found, which is expected for validation
      if (error && error.code !== 'PGRST116') {
        throw new ValidationError(`Supabase connection failed: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(`Supabase validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}