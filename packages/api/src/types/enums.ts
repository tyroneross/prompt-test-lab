// Enum replacements for Prisma string fields
// These were previously enums in the schema but are now strings

export const ProjectRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER'
} as const;

export type ProjectRole = typeof ProjectRole[keyof typeof ProjectRole];

export const TestRunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const;

export type TestRunStatus = typeof TestRunStatus[keyof typeof TestRunStatus];

export const DeploymentStatus = {
  PENDING: 'PENDING',
  DEPLOYING: 'DEPLOYING',
  DEPLOYED: 'DEPLOYED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK'
} as const;

export type DeploymentStatus = typeof DeploymentStatus[keyof typeof DeploymentStatus];

export const EnvironmentType = {
  DEVELOPMENT: 'DEVELOPMENT',
  STAGING: 'STAGING',
  PRODUCTION: 'PRODUCTION'
} as const;

export type EnvironmentType = typeof EnvironmentType[keyof typeof EnvironmentType];