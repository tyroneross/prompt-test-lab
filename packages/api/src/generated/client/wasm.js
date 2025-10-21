
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  avatar: 'avatar',
  passwordHash: 'passwordHash',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  settings: 'settings',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  ownerId: 'ownerId'
};

exports.Prisma.ProjectMemberScalarFieldEnum = {
  id: 'id',
  role: 'role',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  userId: 'userId'
};

exports.Prisma.PromptScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  content: 'content',
  version: 'version',
  isArchived: 'isArchived',
  tags: 'tags',
  metadata: 'metadata',
  outputSchema: 'outputSchema',
  outputFormat: 'outputFormat',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  parentId: 'parentId'
};

exports.Prisma.TestRunScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  status: 'status',
  config: 'config',
  metadata: 'metadata',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  userId: 'userId',
  promptId: 'promptId'
};

exports.Prisma.TestResponseScalarFieldEnum = {
  id: 'id',
  modelProvider: 'modelProvider',
  modelName: 'modelName',
  input: 'input',
  output: 'output',
  parsedOutput: 'parsedOutput',
  outputStructure: 'outputStructure',
  tokenUsage: 'tokenUsage',
  latencyMs: 'latencyMs',
  cost: 'cost',
  error: 'error',
  rawResponse: 'rawResponse',
  evaluationData: 'evaluationData',
  createdAt: 'createdAt',
  testRunId: 'testRunId'
};

exports.Prisma.TestMetricScalarFieldEnum = {
  id: 'id',
  name: 'name',
  value: 'value',
  unit: 'unit',
  metadata: 'metadata',
  createdAt: 'createdAt',
  testRunId: 'testRunId'
};

exports.Prisma.EvaluationPluginScalarFieldEnum = {
  id: 'id',
  name: 'name',
  version: 'version',
  description: 'description',
  config: 'config',
  code: 'code',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QueueJobScalarFieldEnum = {
  id: 'id',
  type: 'type',
  data: 'data',
  priority: 'priority',
  attempts: 'attempts',
  maxAttempts: 'maxAttempts',
  status: 'status',
  error: 'error',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  processedAt: 'processedAt'
};

exports.Prisma.RecurringJobScalarFieldEnum = {
  id: 'id',
  type: 'type',
  data: 'data',
  interval: 'interval',
  priority: 'priority',
  enabled: 'enabled',
  nextRun: 'nextRun',
  lastRun: 'lastRun',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SyncOperationScalarFieldEnum = {
  id: 'id',
  direction: 'direction',
  strategy: 'strategy',
  status: 'status',
  progress: 'progress',
  result: 'result',
  error: 'error',
  config: 'config',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  connectionId: 'connectionId',
  initiatedBy: 'initiatedBy'
};

exports.Prisma.WebhookSubscriptionScalarFieldEnum = {
  id: 'id',
  url: 'url',
  events: 'events',
  headers: 'headers',
  secret: 'secret',
  enabled: 'enabled',
  retryAttempts: 'retryAttempts',
  lastDelivery: 'lastDelivery',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  createdBy: 'createdBy'
};

exports.Prisma.WebhookDeliveryScalarFieldEnum = {
  id: 'id',
  url: 'url',
  payload: 'payload',
  headers: 'headers',
  status: 'status',
  attempts: 'attempts',
  maxAttempts: 'maxAttempts',
  response: 'response',
  error: 'error',
  deliveredAt: 'deliveredAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  eventType: 'eventType',
  projectId: 'projectId',
  webhookId: 'webhookId',
  failedWebhookId: 'failedWebhookId'
};

exports.Prisma.ApiKeyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  provider: 'provider',
  keyHash: 'keyHash',
  isActive: 'isActive',
  lastUsed: 'lastUsed',
  usageCount: 'usageCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId'
};

exports.Prisma.EnvironmentScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  description: 'description',
  config: 'config',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId'
};

exports.Prisma.DeploymentScalarFieldEnum = {
  id: 'id',
  version: 'version',
  status: 'status',
  deployedUrl: 'deployedUrl',
  config: 'config',
  metadata: 'metadata',
  deployedAt: 'deployedAt',
  rollbackAt: 'rollbackAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  promptId: 'promptId',
  environmentId: 'environmentId',
  deployedBy: 'deployedBy'
};

exports.Prisma.DeploymentHistoryScalarFieldEnum = {
  id: 'id',
  action: 'action',
  status: 'status',
  metadata: 'metadata',
  timestamp: 'timestamp',
  deploymentId: 'deploymentId',
  performedBy: 'performedBy'
};

exports.Prisma.ImpactAnalysisScalarFieldEnum = {
  id: 'id',
  impactPercentage: 'impactPercentage',
  diffAnalysis: 'diffAnalysis',
  sampleComparisons: 'sampleComparisons',
  createdAt: 'createdAt',
  deploymentId: 'deploymentId',
  baselinePromptId: 'baselinePromptId'
};

exports.Prisma.CostTrackingScalarFieldEnum = {
  id: 'id',
  period: 'period',
  totalCost: 'totalCost',
  tokenUsage: 'tokenUsage',
  requestCount: 'requestCount',
  breakdown: 'breakdown',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  userId: 'userId'
};

exports.Prisma.UserBillingScalarFieldEnum = {
  id: 'id',
  billingEmail: 'billingEmail',
  plan: 'plan',
  monthlyLimit: 'monthlyLimit',
  currentUsage: 'currentUsage',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  userId: 'userId'
};

exports.Prisma.AppIntegrationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  baseUrl: 'baseUrl',
  apiKeyHash: 'apiKeyHash',
  syncConfig: 'syncConfig',
  isActive: 'isActive',
  lastSync: 'lastSync',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  createdBy: 'createdBy'
};

exports.Prisma.TestPipelineScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  config: 'config',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  createdBy: 'createdBy'
};

exports.Prisma.PipelineStageScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  config: 'config',
  order: 'order',
  status: 'status',
  result: 'result',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  pipelineId: 'pipelineId'
};

exports.Prisma.PipelineExecutionScalarFieldEnum = {
  id: 'id',
  status: 'status',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  result: 'result',
  error: 'error',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  pipelineId: 'pipelineId',
  promptId: 'promptId',
  baselinePromptId: 'baselinePromptId',
  executedBy: 'executedBy'
};

exports.Prisma.DependencyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  provider: 'provider',
  config: 'config',
  status: 'status',
  version: 'version',
  healthScore: 'healthScore',
  lastCheck: 'lastCheck',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  createdBy: 'createdBy'
};

exports.Prisma.UpdatePlanScalarFieldEnum = {
  id: 'id',
  planData: 'planData',
  status: 'status',
  executionResult: 'executionResult',
  executedAt: 'executedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  createdBy: 'createdBy',
  executedBy: 'executedBy'
};

exports.Prisma.DeploymentPlanScalarFieldEnum = {
  id: 'id',
  planData: 'planData',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  promptId: 'promptId',
  createdBy: 'createdBy'
};

exports.Prisma.DeploymentExecutionScalarFieldEnum = {
  id: 'id',
  status: 'status',
  currentStage: 'currentStage',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  metrics: 'metrics',
  error: 'error',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  planId: 'planId',
  executedBy: 'executedBy'
};

exports.Prisma.DeploymentApprovalScalarFieldEnum = {
  id: 'id',
  status: 'status',
  comments: 'comments',
  approvedAt: 'approvedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  planId: 'planId',
  approvedBy: 'approvedBy'
};

exports.Prisma.ApprovalRequestScalarFieldEnum = {
  id: 'id',
  status: 'status',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  projectId: 'projectId',
  promptId: 'promptId',
  appId: 'appId',
  requestedBy: 'requestedBy',
  impactAnalysisId: 'impactAnalysisId'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Project: 'Project',
  ProjectMember: 'ProjectMember',
  Prompt: 'Prompt',
  TestRun: 'TestRun',
  TestResponse: 'TestResponse',
  TestMetric: 'TestMetric',
  EvaluationPlugin: 'EvaluationPlugin',
  QueueJob: 'QueueJob',
  RecurringJob: 'RecurringJob',
  SyncOperation: 'SyncOperation',
  WebhookSubscription: 'WebhookSubscription',
  WebhookDelivery: 'WebhookDelivery',
  ApiKey: 'ApiKey',
  Environment: 'Environment',
  Deployment: 'Deployment',
  DeploymentHistory: 'DeploymentHistory',
  ImpactAnalysis: 'ImpactAnalysis',
  CostTracking: 'CostTracking',
  UserBilling: 'UserBilling',
  AppIntegration: 'AppIntegration',
  TestPipeline: 'TestPipeline',
  PipelineStage: 'PipelineStage',
  PipelineExecution: 'PipelineExecution',
  Dependency: 'Dependency',
  UpdatePlan: 'UpdatePlan',
  DeploymentPlan: 'DeploymentPlan',
  DeploymentExecution: 'DeploymentExecution',
  DeploymentApproval: 'DeploymentApproval',
  ApprovalRequest: 'ApprovalRequest'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
