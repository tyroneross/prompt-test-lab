/**
 * Type helper utilities for handling database null values
 */

/**
 * Converts null to undefined for optional fields
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/**
 * Converts null to empty string for required string fields
 */
export function nullToEmptyString(value: string | null): string {
  return value === null ? '' : value;
}

/**
 * Normalizes user data from database to API format
 */
export function normalizeUserData(user: {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: nullToEmptyString(user.name),
    avatar: nullToUndefined(user.avatar),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Safe property access for potentially null database fields
 */
export function safeString(value: string | null, fallback: string = ''): string {
  return value ?? fallback;
}