#!/usr/bin/env node

/**
 * Dev Doctor - Robust Development Environment Health Check
 * 
 * Ensures Node LTS, consistent package manager, unlocked ports, and proper environment setup
 * for the Prompt Testing Lab monorepo (Vite + Express + pnpm).
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.cyan}🔧 ${msg}${colors.reset}\n`),
  cmd: (msg) => console.log(`${colors.dim}   $ ${msg}${colors.reset}`)
};

class DevDoctor {
  constructor(options = {}) {
    this.isPredev = options.predev || false;
    this.autofix = options.autofix || false;
    this.issues = [];
    this.warnings = [];
    
    // Framework detection
    this.frameworks = this.detectFrameworks();
    this.requiredPorts = this.getRequiredPorts();
  }

  async run() {
    log.section('Dev Doctor - Environment Health Check');
    
    try {
      await this.checkNodeVersion();
      await this.checkPackageManager();
      await this.checkNodeVersionFile();
      await this.checkPorts();
      await this.checkEnvironmentFiles();
      await this.cleanupConflictingLockfiles();
      await this.checkFrameworkHealth();
      await this.suggestPreflightChecks();
      
      this.printSummary();
      
      if (this.issues.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      log.error(`Dev Doctor failed: ${error.message}`);
      process.exit(1);
    }
  }

  detectFrameworks() {
    const frameworks = [];
    
    // Check web package for Vite
    const webPkg = this.readPackageJson('packages/web/package.json');
    if (webPkg?.devDependencies?.vite) {
      frameworks.push({ name: 'Vite', type: 'vite', package: 'web' });
    }
    
    // Check for Next.js
    if (webPkg?.dependencies?.next || webPkg?.devDependencies?.next) {
      frameworks.push({ name: 'Next.js', type: 'nextjs', package: 'web' });
    }
    
    // Check for Express API
    const apiPkg = this.readPackageJson('packages/api/package.json');
    if (apiPkg?.dependencies?.express) {
      frameworks.push({ name: 'Express', type: 'express', package: 'api' });
    }
    
    return frameworks;
  }

  getRequiredPorts() {
    const ports = [];
    
    this.frameworks.forEach(framework => {
      switch (framework.type) {
        case 'vite':
          ports.push({ port: 5173, service: 'Vite Dev Server', fallbacks: [3000, 3001, 5174] });
          break;
        case 'nextjs':
          ports.push({ port: 3000, service: 'Next.js Dev Server', fallbacks: [3001, 3002] });
          break;
        case 'express':
          ports.push({ port: 4001, service: 'Express API Server', fallbacks: [4000, 4002, 8000] });
          break;
      }
    });
    
    // Add common dev ports as fallbacks
    if (ports.length === 0) {
      ports.push(
        { port: 3000, service: 'Dev Server', fallbacks: [3001, 5173, 4321] },
        { port: 4001, service: 'API Server', fallbacks: [4000, 8000] }
      );
    }
    
    return ports;
  }

  async checkNodeVersion() {
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    log.info(`Node.js version: ${nodeVersion}`);
    
    // Check for LTS (Node 18, 20, 22+ are current LTS versions)
    const isLTS = nodeMajor >= 18 && nodeMajor % 2 === 0;
    
    if (nodeMajor < 18) {
      this.issues.push(`Node.js version ${nodeVersion} is too old. Requires >= 18.0.0 (LTS)`);
      log.error(`Node.js ${nodeVersion} is below minimum required version 18.0.0`);
      
      if (this.autofix) {
        log.warning('Consider using nvm to install Node.js LTS: nvm install --lts && nvm use --lts');
      }
    } else if (!isLTS) {
      this.warnings.push(`Node.js ${nodeVersion} is not LTS. Consider using LTS version.`);
      log.warning(`Node.js ${nodeVersion} is not LTS. For stability, use: nvm install --lts`);
    } else {
      log.success(`Node.js ${nodeVersion} (LTS) ✓`);
    }

    // Check for beta/RC versions
    if (nodeVersion.includes('rc') || nodeVersion.includes('beta')) {
      this.warnings.push('Using pre-release Node.js version in development');
      log.warning('Pre-release Node.js detected. Consider using stable LTS for development.');
    }
  }

  async checkPackageManager() {
    const hasPnpmLock = existsSync(join(PROJECT_ROOT, 'pnpm-lock.yaml'));
    const hasYarnLock = existsSync(join(PROJECT_ROOT, 'yarn.lock'));
    const hasNpmLock = existsSync(join(PROJECT_ROOT, 'package-lock.json'));
    
    // Enable Corepack for pnpm
    if (hasPnpmLock) {
      try {
        execSync('corepack enable', { stdio: 'pipe' });
        const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
        log.success(`Using pnpm v${pnpmVersion} (Corepack enabled)`);
      } catch (error) {
        this.issues.push('Failed to enable Corepack or detect pnpm');
        log.error('Failed to enable Corepack. Run: corepack enable');
      }
    } else if (hasYarnLock) {
      log.info('Using Yarn package manager');
      try {
        const yarnVersion = execSync('yarn --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
        log.success(`Yarn v${yarnVersion} detected`);
      } catch (error) {
        this.warnings.push('Yarn lockfile exists but yarn command not found');
      }
    } else if (hasNpmLock) {
      log.info('Using npm package manager');
      const npmVersion = execSync('npm --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
      log.success(`npm v${npmVersion} detected`);
    } else {
      this.warnings.push('No lockfile detected. Run your package manager install command.');
    }
  }

  async checkNodeVersionFile() {
    const nvmrcPath = join(PROJECT_ROOT, '.nvmrc');
    const nodeVersionPath = join(PROJECT_ROOT, '.node-version');
    
    const hasNvmrc = existsSync(nvmrcPath);
    const hasNodeVersion = existsSync(nodeVersionPath);
    
    if (!hasNvmrc && !hasNodeVersion) {
      this.warnings.push('No .nvmrc or .node-version file found');
      log.warning('No Node version file found');
      
      if (this.autofix) {
        // Get current LTS version
        const nodeMajor = parseInt(process.version.slice(1).split('.')[0]);
        const ltsVersion = nodeMajor >= 18 && nodeMajor % 2 === 0 ? nodeMajor : 18;
        
        writeFileSync(nvmrcPath, `${ltsVersion}\n`);
        log.success(`Created .nvmrc with Node ${ltsVersion} (LTS)`);
      } else {
        log.cmd('To create .nvmrc: echo "18" > .nvmrc');
      }
    } else {
      if (hasNvmrc) {
        const nvmrcContent = readFileSync(nvmrcPath, 'utf8').trim();
        log.success(`.nvmrc found: Node ${nvmrcContent}`);
      }
      if (hasNodeVersion) {
        const nodeVersionContent = readFileSync(nodeVersionPath, 'utf8').trim();
        log.success(`.node-version found: Node ${nodeVersionContent}`);
      }
    }
  }

  async checkPorts() {
    log.info('Checking required ports...');
    
    for (const { port, service, fallbacks } of this.requiredPorts) {
      const isPortFree = await this.isPortFree(port);
      
      if (!isPortFree) {
        log.warning(`Port ${port} (${service}) is in use`);
        
        // Find next free port
        const freePort = await this.findFreePort([port, ...fallbacks]);
        if (freePort) {
          log.info(`Suggested alternative: PORT=${freePort} for ${service}`);
          this.warnings.push(`Port ${port} occupied. Use PORT=${freePort} instead`);
        } else {
          this.issues.push(`No free ports found for ${service}`);
        }
      } else {
        log.success(`Port ${port} (${service}) is available`);
      }
    }
  }

  async isPortFree(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      
      server.on('error', () => resolve(false));
    });
  }

  async findFreePort(ports) {
    for (const port of ports) {
      if (await this.isPortFree(port)) {
        return port;
      }
    }
    return null;
  }

  async checkEnvironmentFiles() {
    const envExamplePath = join(PROJECT_ROOT, '.env.example');
    const envPath = join(PROJECT_ROOT, '.env');
    const envLocalPath = join(PROJECT_ROOT, '.env.local');
    
    // Check .env.example exists
    if (existsSync(envExamplePath)) {
      log.success('.env.example found');
      
      // Parse required vars from .env.example
      const requiredVars = this.parseEnvFile(envExamplePath);
      
      // Check .env or .env.local
      let activeEnvPath = null;
      if (existsSync(envLocalPath)) {
        activeEnvPath = envLocalPath;
      } else if (existsSync(envPath)) {
        activeEnvPath = envPath;
      }
      
      if (activeEnvPath) {
        log.success(`Environment file found: ${activeEnvPath.split('/').pop()}`);
        this.validateEnvironmentVars(requiredVars, activeEnvPath);
      } else {
        this.warnings.push('No .env or .env.local file found');
        log.warning('No environment file found');
        
        if (this.autofix) {
          // Copy .env.example to .env
          const envContent = readFileSync(envExamplePath, 'utf8');
          writeFileSync(envPath, envContent);
          log.success('Created .env from .env.example template');
        } else {
          log.cmd('Create environment file: cp .env.example .env');
        }
      }
    } else {
      this.warnings.push('No .env.example file found');
      log.warning('.env.example not found');
      
      if (this.autofix) {
        this.createDefaultEnvExample();
      }
    }
  }

  parseEnvFile(filePath) {
    const content = readFileSync(filePath, 'utf8');
    const vars = [];
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const key = line.split('=')[0].trim();
        vars.push(key);
      }
    });
    
    return vars;
  }

  validateEnvironmentVars(requiredVars, envPath) {
    const envContent = readFileSync(envPath, 'utf8');
    const setVars = this.parseEnvFile(envPath);
    const missingVars = [];
    const emptyVars = [];
    
    // Check each line for empty values (but don't expose them)
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, value] = line.split('=', 2);
        if (!value || value.trim() === '' || value.includes('your-') || value.includes('TODO')) {
          emptyVars.push(key.trim());
        }
      }
    });
    
    requiredVars.forEach(varName => {
      if (!setVars.includes(varName)) {
        missingVars.push(varName);
      }
    });
    
    if (missingVars.length > 0) {
      this.warnings.push(`Missing environment variables: ${missingVars.join(', ')}`);
      log.warning(`Missing vars: ${missingVars.join(', ')}`);
    }
    
    if (emptyVars.length > 0) {
      this.warnings.push(`${emptyVars.length} environment variables need values`);
      log.warning(`${emptyVars.length} variables need values (check .env file)`);
    }
    
    if (missingVars.length === 0 && emptyVars.length === 0) {
      log.success('Environment variables look good');
    }
  }

  createDefaultEnvExample() {
    const defaultEnv = `# Prompt Testing Lab - Environment Variables
# Copy to .env and fill in your values

# Application
NODE_ENV=development
PORT=4001

# Database
DATABASE_URL=file:./dev.db

# JWT Authentication
JWT_SECRET=your-jwt-secret-minimum-32-characters
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# LLM Providers (optional)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Development
DEBUG=prompt-lab:*
`;
    
    writeFileSync(join(PROJECT_ROOT, '.env.example'), defaultEnv);
    log.success('Created .env.example with common variables');
  }

  async cleanupConflictingLockfiles() {
    const hasPnpmLock = existsSync(join(PROJECT_ROOT, 'pnpm-lock.yaml'));
    const hasYarnLock = existsSync(join(PROJECT_ROOT, 'yarn.lock'));
    const hasNpmLock = existsSync(join(PROJECT_ROOT, 'package-lock.json'));
    
    const lockfiles = [
      { file: 'pnpm-lock.yaml', exists: hasPnpmLock },
      { file: 'yarn.lock', exists: hasYarnLock },
      { file: 'package-lock.json', exists: hasNpmLock }
    ];
    
    const existingLockfiles = lockfiles.filter(lf => lf.exists);
    
    if (existingLockfiles.length > 1) {
      log.warning('Multiple lockfiles detected');
      
      // Prefer pnpm > yarn > npm
      let keepLockfile = null;
      if (hasPnpmLock) keepLockfile = 'pnpm-lock.yaml';
      else if (hasYarnLock) keepLockfile = 'yarn.lock';
      else if (hasNpmLock) keepLockfile = 'package-lock.json';
      
      if (this.autofix && keepLockfile) {
        lockfiles.forEach(({ file, exists }) => {
          if (exists && file !== keepLockfile) {
            try {
              unlinkSync(join(PROJECT_ROOT, file));
              log.success(`Removed conflicting ${file}`);
            } catch (error) {
              log.error(`Failed to remove ${file}: ${error.message}`);
            }
          }
        });
        
        log.success(`Keeping ${keepLockfile} as primary lockfile`);
      } else {
        log.warning(`Consider keeping only ${keepLockfile}`);
        lockfiles.forEach(({ file, exists }) => {
          if (exists && file !== keepLockfile) {
            log.cmd(`rm ${file}`);
          }
        });
      }
    } else if (existingLockfiles.length === 1) {
      log.success(`Using ${existingLockfiles[0].file}`);
    }
  }

  async checkFrameworkHealth() {
    if (this.frameworks.length === 0) {
      log.warning('No recognized frameworks detected');
      return;
    }
    
    log.info(`Detected frameworks: ${this.frameworks.map(f => f.name).join(', ')}`);
    
    this.frameworks.forEach(framework => {
      log.success(`${framework.name} detected in packages/${framework.package}`);
    });
    
    // Check if dev scripts are properly configured
    const rootPkg = this.readPackageJson('package.json');
    
    this.frameworks.forEach(framework => {
      const expectedScript = `dev:${framework.package}`;
      if (rootPkg?.scripts?.[expectedScript]) {
        log.success(`Dev script configured: npm run ${expectedScript}`);
      } else {
        this.warnings.push(`Missing dev script for ${framework.name}`);
      }
    });
  }

  async suggestPreflightChecks() {
    const rootPkg = this.readPackageJson('package.json');
    const suggestions = [];
    
    // Type checking
    if (rootPkg?.scripts?.['type-check']) {
      suggestions.push('npm run type-check');
    } else if (rootPkg?.devDependencies?.typescript) {
      suggestions.push('npx tsc --noEmit');
    }
    
    // Linting
    if (rootPkg?.scripts?.lint) {
      suggestions.push('npm run lint');
    }
    
    // Tests
    if (rootPkg?.scripts?.test) {
      suggestions.push('npm run test');
    }
    
    if (suggestions.length > 0) {
      log.info('Suggested preflight checks:');
      suggestions.forEach(cmd => log.cmd(cmd));
    }
  }

  readPackageJson(relativePath) {
    try {
      const fullPath = join(PROJECT_ROOT, relativePath);
      const content = readFileSync(fullPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    
    if (this.issues.length === 0 && this.warnings.length === 0) {
      log.success('🎉 Environment health check passed! Ready for development.');
    } else {
      if (this.issues.length > 0) {
        log.error(`Found ${this.issues.length} critical issue(s):`);
        this.issues.forEach(issue => console.log(`   • ${issue}`));
      }
      
      if (this.warnings.length > 0) {
        log.warning(`Found ${this.warnings.length} warning(s):`);
        this.warnings.forEach(warning => console.log(`   • ${warning}`));
      }
      
      if (this.issues.length === 0) {
        log.info('Issues found but not critical. Development can proceed.');
      }
    }
    
    console.log('='.repeat(60));
    
    if (!this.isPredev) {
      console.log(`
${colors.cyan}Quick Commands:${colors.reset}
  ${colors.dim}npm run dev:doctor${colors.reset}         # Run health check
  ${colors.dim}npm run dev:safe${colors.reset}           # Auto-fix and start dev
  ${colors.dim}npm run dev${colors.reset}                # Start development servers
  ${colors.dim}npm run dev:api${colors.reset}            # Start API server only
  ${colors.dim}npm run dev:web${colors.reset}            # Start web server only
`);
    }
  }
}

// CLI Entry Point
const args = process.argv.slice(2);
const options = {
  predev: args.includes('--predev'),
  autofix: args.includes('--autofix')
};

const doctor = new DevDoctor(options);
await doctor.run();