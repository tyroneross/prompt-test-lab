import { PrismaClient } from '../generated/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Initialize the database with Prisma
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔧 Initializing database...');

    // Check if Prisma client is generated
    const clientPath = path.join(process.cwd(), 'src/generated/client');
    if (!fs.existsSync(clientPath)) {
      console.log('📦 Generating Prisma client...');
      execSync('npx prisma generate', { stdio: 'inherit' });
    }

    // Run migrations
    console.log('🔄 Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // Test database connection
    console.log('🔍 Testing database connection...');
    await prisma.$connect();
    
    console.log('✅ Database initialization completed successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Reset the database (development only)
 */
export async function resetDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot reset database in production');
  }

  try {
    console.log('🔄 Resetting database...');
    execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
    console.log('✅ Database reset completed');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

/**
 * Check database status
 */
export async function checkDatabaseStatus(): Promise<{
  connected: boolean;
  tablesExist: boolean;
  recordCount: Record<string, number>;
}> {
  try {
    await prisma.$connect();
    
    // Check if tables exist by trying to count records
    const [users, projects, prompts, testRuns, responses] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.project.count().catch(() => 0),
      prisma.prompt.count().catch(() => 0),
      prisma.testRun.count().catch(() => 0),
      prisma.testResponse.count().catch(() => 0),
    ]);

    return {
      connected: true,
      tablesExist: true,
      recordCount: {
        users,
        projects,
        prompts,
        testRuns,
        responses,
      },
    };
  } catch (error) {
    return {
      connected: false,
      tablesExist: false,
      recordCount: {},
    };
  } finally {
    await prisma.$disconnect();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      initializeDatabase();
      break;
    case 'reset':
      resetDatabase();
      break;
    case 'status':
      checkDatabaseStatus().then(status => {
        console.log('Database Status:', JSON.stringify(status, null, 2));
      });
      break;
    default:
      console.log('Usage: tsx init.ts [init|reset|status]');
  }
}