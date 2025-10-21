import { PrismaClient } from '../generated/client';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

/**
 * Seed the database with sample data
 */
export async function seedDatabase(): Promise<void> {
  try {
    console.log('🌱 Seeding database...');

    // Create sample users
    const users = await createSampleUsers();
    console.log(`✅ Created ${users.length} sample users`);

    // Create sample projects
    const projects = await createSampleProjects(users);
    console.log(`✅ Created ${projects.length} sample projects`);

    // Create sample prompts
    const prompts = await createSamplePrompts(projects);
    console.log(`✅ Created ${prompts.length} sample prompts`);

    // Create sample test runs
    const testRuns = await createSampleTestRuns(prompts, users);
    console.log(`✅ Created ${testRuns.length} sample test runs`);

    // Create evaluation plugins
    await createEvaluationPlugins();
    console.log('✅ Created evaluation plugins');

    console.log('🎉 Database seeding completed successfully');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Create sample users
 */
async function createSampleUsers() {
  const users = [
    {
      email: 'admin@promptlab.dev',
      name: 'Admin User',
      avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
    {
      email: 'developer@promptlab.dev',
      name: 'Developer User',
      avatar: 'https://avatars.githubusercontent.com/u/2?v=4',
    },
    {
      email: 'tester@promptlab.dev',
      name: 'QA Tester',
      avatar: 'https://avatars.githubusercontent.com/u/3?v=4',
    },
  ];

  const createdUsers = [];
  for (const userData of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (!existingUser) {
      const user = await prisma.user.create({
        data: userData,
      });
      createdUsers.push(user);
    } else {
      createdUsers.push(existingUser);
    }
  }

  return createdUsers;
}

/**
 * Create sample projects
 */
async function createSampleProjects(users: any[]) {
  const projectsData = [
    {
      name: 'Customer Support Chatbot',
      description: 'Testing prompts for customer support automation',
      settings: JSON.stringify({
        defaultModels: ['openai/gpt-4', 'openai/gpt-3.5-turbo'],
        defaultTemperature: 0.7,
        maxTokens: 1000,
      }),
      ownerId: users[0].id,
    },
    {
      name: 'Content Generation Engine',
      description: 'Marketing copy and blog post generation prompts',
      settings: JSON.stringify({
        defaultModels: ['openai/gpt-4-turbo', 'groq/mixtral-8x7b-32768'],
        defaultTemperature: 0.8,
        maxTokens: 2000,
      }),
      ownerId: users[1].id,
    },
    {
      name: 'Code Review Assistant',
      description: 'Automated code review and documentation generation',
      settings: JSON.stringify({
        defaultModels: ['openai/gpt-4', 'anthropic/claude-3-sonnet'],
        defaultTemperature: 0.3,
        maxTokens: 1500,
      }),
      ownerId: users[0].id,
    },
  ];

  const createdProjects = [];
  for (const projectData of projectsData) {
    // Create project first
    const project = await prisma.project.create({
      data: {
        ...projectData,
        members: {
          create: [
            { userId: projectData.ownerId, role: "OWNER" },
          ],
        },
      },
    });

    // Add additional members (avoid adding owner again)
    const additionalMembers = [];
    
    // Add different members for each project to avoid constraint violations
    if (projectData.ownerId !== users[1].id) {
      additionalMembers.push({ userId: users[1].id, role: "MEMBER" });
    }
    
    if (projectData.ownerId !== users[2].id) {
      additionalMembers.push({ userId: users[2].id, role: "VIEWER" });
    }

    // Create additional members if any
    if (additionalMembers.length > 0) {
      await prisma.projectMember.createMany({
        data: additionalMembers.map(member => ({
          ...member,
          projectId: project.id,
        })),
      });
    }

    createdProjects.push(project);
  }

  return createdProjects;
}

/**
 * Create sample prompts
 */
async function createSamplePrompts(projects: any[]) {
  const promptsData = [
    // Customer Support prompts
    {
      projectId: projects[0].id,
      name: 'Greeting and Problem Identification',
      description: 'Initial customer greeting and problem identification',
      content: `You are a helpful customer support agent. Greet the customer warmly and help identify their issue.

Customer message: {customer_message}

Respond with:
1. A warm, professional greeting
2. Acknowledgment of their concern
3. A clarifying question to better understand their issue`,
      tags: ['customer-support', 'greeting', 'problem-identification'],
      outputFormat: 'text',
      outputSchema: {
        type: 'object',
        properties: {
          greeting: { type: 'string' },
          acknowledgment: { type: 'string' },
          clarifying_question: { type: 'string' }
        }
      },
    },
    {
      projectId: projects[0].id,
      name: 'Solution Recommendation',
      description: 'Provide solution recommendations based on customer issues',
      content: `Based on the customer's issue, provide a clear solution with step-by-step instructions.

Issue: {customer_issue}
Product: {product_name}

Provide:
1. A brief empathetic response
2. Step-by-step solution
3. Alternative options if the main solution doesn't work`,
      tags: ['customer-support', 'solutions', 'troubleshooting'],
      outputFormat: 'structured',
    },
    // Content Generation prompts
    {
      projectId: projects[1].id,
      name: 'Blog Post Introduction',
      description: 'Generate engaging blog post introductions',
      content: `Write an engaging introduction for a blog post about {topic}.

Requirements:
- Hook the reader in the first sentence
- Clearly state what the post will cover
- Make it conversational and engaging
- Keep it between 100-150 words

Topic: {topic}
Target audience: {audience}
Tone: {tone}`,
      tags: ['content', 'blog', 'introduction', 'marketing'],
      outputFormat: 'markdown',
    },
    {
      projectId: projects[1].id,
      name: 'Social Media Caption',
      description: 'Create compelling social media captions',
      content: `Create an engaging social media caption for {platform}.

Content description: {content_description}
Call to action: {cta}
Hashtags needed: {hashtag_count}

Make it {tone} and include relevant emojis.`,
      tags: ['social-media', 'captions', 'marketing'],
      outputFormat: 'text',
    },
    // Code Review prompts
    {
      projectId: projects[2].id,
      name: 'Code Review Feedback',
      description: 'Provide constructive code review feedback',
      content: `Review the following code and provide constructive feedback.

Code:
\`\`\`{language}
{code}
\`\`\`

Focus on:
1. Code quality and best practices
2. Potential bugs or issues
3. Performance considerations
4. Readability and maintainability
5. Security concerns

Provide specific suggestions for improvement.`,
      tags: ['code-review', 'quality', 'best-practices'],
      outputFormat: 'markdown',
      outputSchema: {
        type: 'object',
        properties: {
          overall_rating: { type: 'number', minimum: 1, maximum: 10 },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                severity: { type: 'string' },
                description: { type: 'string' },
                suggestion: { type: 'string' }
              }
            }
          },
          positive_aspects: { type: 'array', items: { type: 'string' } }
        }
      },
    },
  ];

  const createdPrompts = [];
  for (const promptData of promptsData) {
    const prompt = await prisma.prompt.create({
      data: promptData,
    });
    createdPrompts.push(prompt);
  }

  return createdPrompts;
}

/**
 * Create sample test runs
 */
async function createSampleTestRuns(prompts: any[], users: any[]) {
  const testRunsData = [
    {
      name: 'Customer Support Response Quality Test',
      description: 'Testing response quality across different models',
      promptId: prompts[0].id,
      userId: users[0].id,
      projectId: prompts[0].projectId,
      status: 'COMPLETED' as const,
      config: {
        models: [
          { provider: 'openai', modelName: 'gpt-4', temperature: 0.7 },
          { provider: 'openai', modelName: 'gpt-3.5-turbo', temperature: 0.7 },
        ],
        testInputs: [
          "Hi, I'm having trouble logging into my account. I keep getting an error message.",
          "My order hasn't arrived yet and it was supposed to be here yesterday. What's going on?",
          "I need to return a product but I can't find the return policy on your website.",
        ],
        evaluationCriteria: [
          { name: 'helpfulness', pluginId: 'relevance', weight: 0.4 },
          { name: 'tone', pluginId: 'sentiment', weight: 0.3 },
          { name: 'safety', pluginId: 'toxicity', weight: 0.3 },
        ],
        iterations: 1,
        concurrency: 2,
      },
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    },
    {
      name: 'Blog Content A/B Test',
      description: 'Testing different models for blog introduction generation',
      promptId: prompts[2].id,
      userId: users[1].id,
      projectId: prompts[2].projectId,
      status: 'COMPLETED' as const,
      config: {
        models: [
          { provider: 'openai', modelName: 'gpt-4-turbo', temperature: 0.8 },
          { provider: 'groq', modelName: 'mixtral-8x7b-32768', temperature: 0.8 },
        ],
        testInputs: [
          "The Future of AI in Healthcare",
          "10 Tips for Remote Work Productivity",
          "Sustainable Living: Small Changes, Big Impact",
        ],
        systemPrompt: "You are a professional content writer with expertise in engaging blog content.",
        iterations: 2,
        concurrency: 1,
      },
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
    },
  ];

  const createdTestRuns = [];
  for (const testRunData of testRunsData) {
    const testRun = await prisma.testRun.create({
      data: testRunData,
    });
    createdTestRuns.push(testRun);
  }

  return createdTestRuns;
}

/**
 * Create evaluation plugins
 */
async function createEvaluationPlugins() {
  const plugins = [
    {
      name: 'similarity',
      version: '1.0.0',
      description: 'Measures text similarity using various algorithms',
      config: { threshold: 0.5 },
      isActive: true,
    },
    {
      name: 'sentiment',
      version: '1.0.0',
      description: 'Analyzes sentiment of the response',
      config: { requiredSentiment: 'positive' },
      isActive: true,
    },
    {
      name: 'toxicity',
      version: '1.0.0',
      description: 'Detects toxic content in responses',
      config: { threshold: 0.3 },
      isActive: true,
    },
    {
      name: 'relevance',
      version: '1.0.0',
      description: 'Evaluates response relevance to the prompt',
      config: { threshold: 0.4 },
      isActive: true,
    },
  ];

  for (const plugin of plugins) {
    await prisma.evaluationPlugin.upsert({
      where: { name: plugin.name },
      update: plugin,
      create: plugin,
    });
  }
}

/**
 * Clear all data (development only)
 */
export async function clearDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clear database in production');
  }

  console.log('🗑️ Clearing database...');

  // Delete in reverse dependency order
  await prisma.testMetric.deleteMany();
  await prisma.testResponse.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.prompt.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.evaluationPlugin.deleteMany();
  await prisma.queueJob.deleteMany();

  console.log('✅ Database cleared');
}

// CLI execution
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const command = process.argv[2];
  
  switch (command) {
    case 'seed':
      seedDatabase();
      break;
    case 'clear':
      clearDatabase();
      break;
    case 'reset':
      clearDatabase().then(() => seedDatabase());
      break;
    default:
      seedDatabase();
  }
}