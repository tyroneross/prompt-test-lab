/**
 * Unified Parser System - Extracted and modularized from atomize-news
 * 
 * This system provides flexible parsing for LLM outputs in multiple formats:
 * - JSON (strict or loose)
 * - Markdown with headers
 * - Mixed formats
 * - Graceful fallbacks
 * 
 * Generic and extensible for different content types beyond news
 */

export * from './unified-parser';
export * from './smart-brevity-parser';
export * from './base-parser';