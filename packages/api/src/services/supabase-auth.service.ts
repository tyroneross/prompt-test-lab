import { User, Session, AuthError } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { PrismaClient } from '../generated/client';
import { SupabaseIntegrationService, SupabaseConnection } from './supabase-integration.service';
import { z } from 'zod';

const prisma = new PrismaClient();

// JWT payload schema for Supabase tokens
export const SupabaseJWTPayloadSchema = z.object({
  aud: z.string(),
  exp: z.number(),
  iat: z.number(),
  iss: z.string(),
  sub: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  app_metadata: z.object({
    provider: z.string().optional(),
    providers: z.array(z.string()).optional()
  }).optional(),
  user_metadata: z.record(z.string(), z.any()).optional(),
  role: z.string().optional(),
  aal: z.string().optional(),
  amr: z.array(z.object({
    method: z.string(),
    timestamp: z.number()
  })).optional(),
  session_id: z.string().optional()
});

export const RLSPolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  table: z.string().min(1, 'Table name is required'),
  command: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL']),
  role: z.string().optional(),
  using: z.string().optional(),
  withCheck: z.string().optional(),
  enabled: z.boolean().default(true)
});

export type SupabaseJWTPayload = z.infer<typeof SupabaseJWTPayloadSchema>;
export type RLSPolicy = z.infer<typeof RLSPolicySchema>;

export interface SupabaseAuthConfig {
  jwtSecret: string;
  issuer?: string;
  audience?: string;
  expirationTime?: string; // e.g., '1h', '24h'
  refreshTokenExpiration?: string; // e.g., '7d', '30d'
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  metadata?: Record<string, any>;
  session?: Session;
  supabaseUser?: User;
  labUser?: any; // Local lab user if exists
}

export interface RLSContext {
  user_id: string;
  role: string;
  project_id?: string;
  organization_id?: string;
  [key: string]: any;
}

/**
 * Service for handling Supabase authentication and Row Level Security (RLS)
 */
export class SupabaseAuthService {
  private static jwtSecrets = new Map<string, string>(); // connectionId -> jwtSecret
  private static authConfigs = new Map<string, SupabaseAuthConfig>(); // connectionId -> config

  /**
   * Configure authentication for a Supabase connection
   */
  static async configureAuth(
    connectionId: string,
    authConfig: SupabaseAuthConfig
  ): Promise<void> {
    // Validate configuration
    if (!authConfig.jwtSecret) {
      throw new ValidationError('JWT secret is required');
    }

    this.jwtSecrets.set(connectionId, authConfig.jwtSecret);
    this.authConfigs.set(connectionId, authConfig);

    // Store encrypted configuration in database
    await prisma.appIntegration.update({
      where: { id: connectionId },
      data: {
        syncConfig: {
          ...((await prisma.appIntegration.findUnique({ where: { id: connectionId } }))?.syncConfig as any || {}),
          auth: {
            configured: true,
            issuer: authConfig.issuer,
            audience: authConfig.audience,
            expirationTime: authConfig.expirationTime,
            refreshTokenExpiration: authConfig.refreshTokenExpiration
          }
        } as any
      }
    });
  }

  /**
   * Verify and decode Supabase JWT token
   */
  static async verifySupabaseToken(
    connectionId: string,
    token: string
  ): Promise<{
    valid: boolean;
    payload?: SupabaseJWTPayload;
    user?: AuthenticatedUser;
    error?: string;
  }> {
    try {
      const jwtSecret = this.jwtSecrets.get(connectionId);
      if (!jwtSecret) {
        return { valid: false, error: 'JWT secret not configured for this connection' };
      }

      const authConfig = this.authConfigs.get(connectionId);

      // Verify JWT token
      const decoded = jwt.verify(token, jwtSecret, {
        issuer: authConfig?.issuer,
        audience: authConfig?.audience
      });

      if (typeof decoded === 'string') {
        return { valid: false, error: 'Invalid token format' };
      }

      // Validate payload structure
      const payload = SupabaseJWTPayloadSchema.parse(decoded);

      // Get Supabase connection to fetch user details
      const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId);
      const { user: supabaseUser, session, error: userError } = await SupabaseIntegrationService.getUserFromToken(connectionId, token);

      if (userError && !supabaseUser) {
        console.warn('Could not fetch Supabase user details:', userError);
      }

      // Try to find corresponding local lab user
      const labUser = await this.findOrCreateLabUser(payload, supabaseUser);

      const authenticatedUser: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email || supabaseUser?.email,
        role: payload.role || 'authenticated',
        metadata: {
          ...payload.user_metadata,
          app_metadata: payload.app_metadata
        },
        session,
        supabaseUser,
        labUser
      };

      return {
        valid: true,
        payload,
        user: authenticatedUser
      };

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: `JWT Error: ${error.message}` };
      }
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown token verification error' 
      };
    }
  }

  /**
   * Generate lab-compatible JWT token for Supabase user
   */
  static async generateLabToken(
    connectionId: string,
    supabaseUser: User,
    additionalClaims?: Record<string, any>
  ): Promise<{ token: string; expiresAt: Date; refreshToken?: string }> {
    const authConfig = this.authConfigs.get(connectionId);
    const jwtSecret = this.jwtSecrets.get(connectionId);

    if (!jwtSecret) {
      throw new ValidationError('JWT secret not configured');
    }

    const expirationTime = authConfig?.expirationTime || '1h';
    const expiresIn = this.parseExpirationTime(expirationTime);
    const expiresAt = new Date(Date.now() + expiresIn);

    // Create JWT payload compatible with prompt lab expectations
    const payload = {
      sub: supabaseUser.id,
      email: supabaseUser.email,
      role: supabaseUser.role || 'authenticated',
      aud: authConfig?.audience || 'prompt-lab',
      iss: authConfig?.issuer || 'supabase-integration',
      exp: Math.floor(expiresAt.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      user_metadata: supabaseUser.user_metadata,
      app_metadata: supabaseUser.app_metadata,
      ...additionalClaims
    };

    const token = jwt.sign(payload, jwtSecret);

    // Generate refresh token if configured
    let refreshToken: string | undefined;
    if (authConfig?.refreshTokenExpiration) {
      const refreshExpiresIn = this.parseExpirationTime(authConfig.refreshTokenExpiration);
      const refreshPayload = {
        sub: supabaseUser.id,
        type: 'refresh',
        exp: Math.floor((Date.now() + refreshExpiresIn) / 1000),
        iat: Math.floor(Date.now() / 1000)
      };
      refreshToken = jwt.sign(refreshPayload, jwtSecret);
    }

    return { token, expiresAt, refreshToken };
  }

  /**
   * Create or update RLS policy
   */
  static async createRLSPolicy(
    connectionId: string,
    policy: RLSPolicy
  ): Promise<{ success: boolean; policyId?: string; error?: string }> {
    try {
      const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId);
      
      if (!connection.authClient) {
        throw new ValidationError('Service key required to manage RLS policies');
      }

      // Drop existing policy if it exists
      await this.dropRLSPolicy(connectionId, policy.table, policy.name);

      // Build policy SQL
      let policySQL = `CREATE POLICY "${policy.name}" ON "${policy.table}"`;
      
      if (policy.command !== 'ALL') {
        policySQL += ` FOR ${policy.command}`;
      }
      
      if (policy.role) {
        policySQL += ` TO ${policy.role}`;
      }
      
      if (policy.using) {
        policySQL += ` USING (${policy.using})`;
      }
      
      if (policy.withCheck && ['INSERT', 'UPDATE', 'ALL'].includes(policy.command)) {
        policySQL += ` WITH CHECK (${policy.withCheck})`;
      }

      policySQL += ';';

      // Execute policy creation
      const { error } = await connection.authClient.rpc('exec_sql', { sql: policySQL });

      if (error) {
        return { success: false, error: error.message };
      }

      // Store policy metadata locally
      const policyId = await this.storePolicyMetadata(connectionId, policy);

      return { success: true, policyId };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List RLS policies for a table
   */
  static async listRLSPolicies(
    connectionId: string,
    tableName: string,
    schema: string = 'public'
  ): Promise<{
    success: boolean;
    policies?: Array<{
      name: string;
      table: string;
      command: string;
      role?: string;
      definition: string;
      enabled: boolean;
    }>;
    error?: string;
  }> {
    try {
      const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId);
      
      if (!connection.authClient) {
        throw new ValidationError('Service key required to list RLS policies');
      }

      const { data, error } = await connection.authClient
        .from('pg_policies')
        .select('policyname, tablename, cmd, roles, qual, with_check, enable')
        .eq('schemaname', schema)
        .eq('tablename', tableName);

      if (error) {
        return { success: false, error: error.message };
      }

      const policies = (data || []).map(policy => ({
        name: policy.policyname,
        table: policy.tablename,
        command: policy.cmd,
        role: policy.roles?.[0],
        definition: policy.qual || policy.with_check || '',
        enabled: policy.enable
      }));

      return { success: true, policies };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enable RLS on table
   */
  static async enableRLS(
    connectionId: string,
    tableName: string,
    schema: string = 'public'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId);
      
      if (!connection.authClient) {
        throw new ValidationError('Service key required to enable RLS');
      }

      const { error } = await connection.authClient.rpc('exec_sql', {
        sql: `ALTER TABLE "${schema}"."${tableName}" ENABLE ROW LEVEL SECURITY;`
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
   * Disable RLS on table
   */
  static async disableRLS(
    connectionId: string,
    tableName: string,
    schema: string = 'public'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId);
      
      if (!connection.authClient) {
        throw new ValidationError('Service key required to disable RLS');
      }

      const { error } = await connection.authClient.rpc('exec_sql', {
        sql: `ALTER TABLE "${schema}"."${tableName}" DISABLE ROW LEVEL SECURITY;`
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
   * Set RLS context for a session
   */
  static async setRLSContext(
    connectionId: string,
    context: RLSContext
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId);
      
      // Set session variables that can be used in RLS policies
      const contextQueries = Object.entries(context).map(([key, value]) => 
        `SELECT set_config('rls.${key}', '${value}', true);`
      ).join('\n');

      const { error } = await connection.client.rpc('exec_sql', { sql: contextQueries });

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
   * Create standard prompt lab RLS policies
   */
  static async createStandardRLSPolicies(
    connectionId: string,
    tableName: string,
    options: {
      enableUserIsolation?: boolean;
      enableProjectIsolation?: boolean;
      enableRoleBasedAccess?: boolean;
      customPolicies?: RLSPolicy[];
    } = {}
  ): Promise<{
    success: boolean;
    createdPolicies: string[];
    errors: string[];
  }> {
    const result = {
      success: true,
      createdPolicies: [] as string[],
      errors: [] as string[]
    };

    // Enable RLS on the table first
    const rlsResult = await this.enableRLS(connectionId, tableName);
    if (!rlsResult.success) {
      result.errors.push(`Failed to enable RLS: ${rlsResult.error}`);
      result.success = false;
    }

    const policiesToCreate: RLSPolicy[] = [];

    // User isolation policies
    if (options.enableUserIsolation) {
      policiesToCreate.push({
        name: `${tableName}_user_isolation_select`,
        table: tableName,
        command: 'SELECT',
        using: `user_id = auth.uid() OR auth.role() = 'service_role'`
      });

      policiesToCreate.push({
        name: `${tableName}_user_isolation_insert`,
        table: tableName,
        command: 'INSERT',
        withCheck: `user_id = auth.uid()`
      });

      policiesToCreate.push({
        name: `${tableName}_user_isolation_update`,
        table: tableName,
        command: 'UPDATE',
        using: `user_id = auth.uid()`,
        withCheck: `user_id = auth.uid()`
      });

      policiesToCreate.push({
        name: `${tableName}_user_isolation_delete`,
        table: tableName,
        command: 'DELETE',
        using: `user_id = auth.uid()`
      });
    }

    // Project isolation policies
    if (options.enableProjectIsolation) {
      policiesToCreate.push({
        name: `${tableName}_project_access`,
        table: tableName,
        command: 'ALL',
        using: `project_id IN (
          SELECT p.id FROM projects p 
          JOIN project_members pm ON p.id = pm.project_id 
          WHERE pm.user_id = auth.uid()
        )`
      });
    }

    // Role-based access policies
    if (options.enableRoleBasedAccess) {
      policiesToCreate.push({
        name: `${tableName}_admin_access`,
        table: tableName,
        command: 'ALL',
        role: 'admin',
        using: 'true'
      });

      policiesToCreate.push({
        name: `${tableName}_service_role_access`,
        table: tableName,
        command: 'ALL',
        role: 'service_role',
        using: 'true'
      });
    }

    // Add custom policies
    if (options.customPolicies) {
      policiesToCreate.push(...options.customPolicies);
    }

    // Create all policies
    for (const policy of policiesToCreate) {
      const policyResult = await this.createRLSPolicy(connectionId, policy);
      if (policyResult.success) {
        result.createdPolicies.push(policy.name);
      } else {
        result.errors.push(`Failed to create policy ${policy.name}: ${policyResult.error}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Test RLS policies with sample queries
   */
  static async testRLSPolicies(
    connectionId: string,
    tableName: string,
    testUser: { id: string; role?: string; project_id?: string }
  ): Promise<{
    success: boolean;
    results: Array<{
      operation: string;
      query: string;
      success: boolean;
      error?: string;
      rowCount?: number;
    }>;
  }> {
    const results: Array<{
      operation: string;
      query: string;
      success: boolean;
      error?: string;
      rowCount?: number;
    }> = [];

    try {
      const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId);

      // Set test context
      await this.setRLSContext(connectionId, {
        user_id: testUser.id,
        role: testUser.role || 'authenticated',
        project_id: testUser.project_id || ''
      });

      // Test queries
      const testQueries = [
        { operation: 'SELECT', query: `SELECT COUNT(*) FROM ${tableName}` },
        { operation: 'INSERT', query: `INSERT INTO ${tableName} (user_id, name, content) VALUES ('${testUser.id}', 'test', 'test content')` },
        { operation: 'UPDATE', query: `UPDATE ${tableName} SET content = 'updated' WHERE user_id = '${testUser.id}'` },
        { operation: 'DELETE', query: `DELETE FROM ${tableName} WHERE user_id = '${testUser.id}' AND name = 'test'` }
      ];

      for (const test of testQueries) {
        try {
          const { data, error, count } = await connection.client.rpc('exec_sql', { 
            sql: test.query 
          });

          results.push({
            operation: test.operation,
            query: test.query,
            success: !error,
            error: error?.message,
            rowCount: count || (data ? (Array.isArray(data) ? data.length : 1) : 0)
          });
        } catch (error) {
          results.push({
            operation: test.operation,
            query: test.query,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return { success: true, results };

    } catch (error) {
      return {
        success: false,
        results: [{
          operation: 'TEST_SETUP',
          query: 'Setting up test context',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }

  // Private helper methods

  private static async findOrCreateLabUser(
    payload: SupabaseJWTPayload,
    supabaseUser?: User | null
  ): Promise<any> {
    if (!payload.email) return null;

    // Try to find existing user by email
    let labUser = await prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (!labUser && supabaseUser) {
      // Create new user based on Supabase user data
      try {
        labUser = await prisma.user.create({
          data: {
            email: payload.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || payload.email.split('@')[0],
            avatar: supabaseUser.user_metadata?.avatar_url
          }
        });
      } catch (error) {
        console.warn('Failed to create lab user:', error);
      }
    }

    return labUser;
  }

  private static async dropRLSPolicy(
    connectionId: string,
    tableName: string,
    policyName: string
  ): Promise<void> {
    try {
      const connection = await SupabaseIntegrationService.getSupabaseConnection(connectionId);
      
      if (connection.authClient) {
        await connection.authClient.rpc('exec_sql', {
          sql: `DROP POLICY IF EXISTS "${policyName}" ON "${tableName}";`
        });
      }
    } catch (error) {
      // Ignore errors when dropping policies - they might not exist
      console.debug('Policy drop failed (might not exist):', error);
    }
  }

  private static async storePolicyMetadata(
    connectionId: string,
    policy: RLSPolicy
  ): Promise<string> {
    // Store policy metadata in a simple JSON structure
    // In a production system, you might want a separate table for this
    const policyId = `${connectionId}-${policy.table}-${policy.name}`;
    
    // This would typically be stored in a policies table
    // For now, we'll just return the generated ID
    
    return policyId;
  }

  private static parseExpirationTime(timeString: string): number {
    const units: Record<string, number> = {
      's': 1000,           // seconds
      'm': 60 * 1000,      // minutes  
      'h': 60 * 60 * 1000, // hours
      'd': 24 * 60 * 60 * 1000 // days
    };

    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new ValidationError(`Invalid expiration time format: ${timeString}`);
    }

    const [, amount, unit] = match;
    const multiplier = units[unit];
    
    if (!multiplier) {
      throw new ValidationError(`Invalid time unit: ${unit}`);
    }

    return parseInt(amount) * multiplier;
  }
}