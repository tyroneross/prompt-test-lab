/**
 * Validation utilities and common validation schemas
 */

import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Please enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const promptNameSchema = z
  .string()
  .min(1, 'Prompt name is required')
  .max(100, 'Prompt name must be less than 100 characters')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Prompt name can only contain letters, numbers, spaces, hyphens, and underscores');

export const promptContentSchema = z
  .string()
  .min(1, 'Prompt content is required')
  .max(10000, 'Prompt content must be less than 10,000 characters');

export const projectNameSchema = z
  .string()
  .min(1, 'Project name is required')
  .max(50, 'Project name must be less than 50 characters')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Project name can only contain letters, numbers, spaces, hyphens, and underscores');

// Validation helper functions
export function validateEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function validatePassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

export function validatePromptName(name: string): boolean {
  return promptNameSchema.safeParse(name).success;
}

export function validatePromptContent(content: string): boolean {
  return promptContentSchema.safeParse(content).success;
}

export function validateProjectName(name: string): boolean {
  return projectNameSchema.safeParse(name).success;
}

/**
 * Validates file upload restrictions
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [] } = options; // Default 10MB

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates JSON string
 */
export function validateJson(jsonString: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(jsonString);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON format',
    };
  }
}

/**
 * Validates test configuration
 */
export const testConfigSchema = z.object({
  name: z.string().min(1, 'Test name is required').max(100),
  prompts: z.array(z.string()).min(1, 'At least one prompt is required'),
  models: z.array(z.string()).min(1, 'At least one model is required'),
  content: z.array(z.string()).min(1, 'At least one test content is required'),
  parameters: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(4096).optional(),
    topP: z.number().min(0).max(1).optional(),
  }).optional(),
});

export type TestConfig = z.infer<typeof testConfigSchema>;

/**
 * Validates model configuration
 */
export const modelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'cohere', 'huggingface', 'custom']),
  endpoint: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  parameters: z.object({
    maxTokens: z.number().min(1).max(4096),
    temperature: z.number().min(0).max(2),
    topP: z.number().min(0).max(1),
  }),
});

export type ModelConfig = z.infer<typeof modelConfigSchema>;

/**
 * Sanitizes user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates and formats phone numbers
 */
export function validatePhoneNumber(phone: string): { valid: boolean; formatted?: string; error?: string } {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's a valid US phone number (10 digits)
  if (digits.length === 10) {
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return { valid: true, formatted };
  }
  
  // Check if it's a valid international number (11+ digits)
  if (digits.length >= 11) {
    return { valid: true, formatted: `+${digits}` };
  }
  
  return {
    valid: false,
    error: 'Please enter a valid phone number',
  };
}

/**
 * Password strength checker
 */
export function checkPasswordStrength(password: string): {
  strength: 'weak' | 'medium' | 'strong';
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push('Include special characters');

  // Common patterns check
  if (!/(.)\1{2,}/.test(password)) score += 1;
  else feedback.push('Avoid repeating characters');

  const strength = score <= 3 ? 'weak' : score <= 5 ? 'medium' : 'strong';

  return { strength, score, feedback };
}