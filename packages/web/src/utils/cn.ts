/**
 * Class name utility for merging Tailwind CSS classes
 * Uses clsx for conditional classes and tailwind-merge for deduplication
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge class names with Tailwind CSS class deduplication
 * 
 * @param inputs - Class values to merge
 * @returns Merged and deduplicated class names
 * 
 * @example
 * ```tsx
 * cn('px-2 py-1', 'px-4') // 'py-1 px-4' (px-2 is overridden)
 * cn('text-red-500', condition && 'text-blue-500') // Conditional classes
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}