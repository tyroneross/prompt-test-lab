/**
 * Validation utilities
 */

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeInput(input: string, maxLength = 1000): string {
  return input.trim().substring(0, maxLength);
}

export function validateRequired<T>(value: T, fieldName: string): T {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

export function validateEnum<T extends string>(value: string, validValues: T[], fieldName: string): T {
  if (!validValues.includes(value as T)) {
    throw new Error(`${fieldName} must be one of: ${validValues.join(', ')}`);
  }
  return value as T;
}