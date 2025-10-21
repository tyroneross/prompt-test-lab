/**
 * Unified Parser - Generic parser for any structured content format
 * This is the main entry point for parsing LLM outputs in the prompt lab
 */

import { BaseParser, ParserRegistry } from './base-parser';
import { SmartBrevityParser } from './smart-brevity-parser';
import type { ParsedOutput, ParserConfig, ContextType } from '../types';

// Default generic parser for any content
export class UnifiedParser extends BaseParser {
  name = 'unified';
  description = 'Generic parser that attempts to extract any structured data from LLM output';

  getFormatInstructions(): string {
    return `
Output format options (choose the most natural for the model):

OPTION 1 - JSON Format:
Return a valid JSON object with your structured data:
{
  "field1": "value1",
  "field2": ["item1", "item2"],
  "field3": { "nested": "data" }
}

OPTION 2 - Markdown Format:
Use headers and lists to structure your output:

## Main Section
Your content here

### Subsection
- Bullet point 1
- Bullet point 2

### Another Section
More structured content

OPTION 3 - Mixed Format:
You can also use JSON wrapped in markdown code blocks:

\`\`\`json
{
  "structured": "data"
}
\`\`\`
`;
  }

  parse(rawOutput: string, config: Partial<ParserConfig> = {}): ParsedOutput {
    if (!rawOutput || typeof rawOutput !== 'string') {
      return this.createFallbackResult(rawOutput || '', 'Invalid output: Empty or non-string response');
    }

    const mergedConfig: ParserConfig = {
      outputFormat: 'auto',
      strictMode: false,
      fallbackStrategy: 'partial',
      ...config
    };

    // Strategy 1: Try JSON parsing
    if (mergedConfig.outputFormat === 'json' || mergedConfig.outputFormat === 'auto') {
      const jsonResult = this.tryParseAsJSON(rawOutput);
      if (jsonResult) {
        return this.normalizeResult(jsonResult, mergedConfig);
      }
    }

    // Strategy 2: Try Markdown parsing
    if (mergedConfig.outputFormat === 'markdown' || mergedConfig.outputFormat === 'auto') {
      const markdownResult = this.parseMarkdownSections(rawOutput);
      if (Object.keys(markdownResult).length > 0) {
        return this.normalizeResult(markdownResult, mergedConfig);
      }
    }

    // Strategy 3: Extract any structured data
    const extractedResult = this.extractStructuredData(rawOutput);
    if (extractedResult) {
      return this.normalizeResult(extractedResult, mergedConfig);
    }

    // Apply fallback strategy
    switch (mergedConfig.fallbackStrategy) {
      case 'error':
        throw new Error('Failed to parse structured output');
      case 'raw':
        return { rawOutput, parseError: true };
      case 'partial':
      default:
        return this.createFallbackResult(rawOutput, 'No structured data found');
    }
  }

  validate(parsed: ParsedOutput): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (parsed.parseError) {
      warnings.push('Parsing failed - raw output available');
    }

    if (Object.keys(parsed).length === 0) {
      warnings.push('No structured data extracted');
    }

    // Check for common issues
    if (typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value.length === 0) {
          warnings.push(`Empty field: ${key}`);
        }
        if (Array.isArray(value) && value.length === 0) {
          warnings.push(`Empty array: ${key}`);
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  }

  private normalizeResult(data: any, config: ParserConfig): ParsedOutput {
    if (!config.customFields) {
      return data;
    }

    const normalized: ParsedOutput = {};

    // Apply custom field mappings and validations
    for (const [fieldName, fieldConfig] of Object.entries(config.customFields)) {
      if (data[fieldName] !== undefined) {
        // Field exists, validate type
        const value = data[fieldName];
        const expectedType = fieldConfig.type;

        if (expectedType === 'string' && typeof value === 'string') {
          normalized[fieldName] = value;
        } else if (expectedType === 'array' && Array.isArray(value)) {
          normalized[fieldName] = value;
        } else if (expectedType === 'object' && typeof value === 'object' && !Array.isArray(value)) {
          normalized[fieldName] = value;
        } else {
          // Type mismatch, try to convert or use fallback
          normalized[fieldName] = this.convertType(value, expectedType) || fieldConfig.fallback;
        }
      } else if (fieldConfig.required) {
        // Required field missing
        normalized[fieldName] = fieldConfig.fallback || this.getDefaultForType(fieldConfig.type);
      }
    }

    // Include any additional fields not in custom config
    for (const [key, value] of Object.entries(data)) {
      if (!config.customFields[key]) {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  private convertType(value: any, targetType: 'string' | 'array' | 'object'): any {
    switch (targetType) {
      case 'string':
        return String(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : { value };
      default:
        return value;
    }
  }

  private getDefaultForType(type: 'string' | 'array' | 'object'): any {
    switch (type) {
      case 'string':
        return '';
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }
}

// Create and export the global parser registry
export const globalParserRegistry = new ParserRegistry();

// Register built-in parsers
globalParserRegistry.register(new UnifiedParser());
globalParserRegistry.register(new SmartBrevityParser());

/**
 * Main parsing function - uses registry with fallbacks
 */
export function parseStructuredOutput(
  rawOutput: string,
  contextType: ContextType = 'generic',
  config?: Partial<ParserConfig>
): { result: ParsedOutput; parserUsed: string; validation: any } {
  // Determine parser based on context
  let preferredParser: string;
  let fallbackParsers: string[];

  switch (contextType) {
    case 'news-summary':
      preferredParser = 'smart-brevity';
      fallbackParsers = ['unified'];
      break;
    case 'generic':
    default:
      preferredParser = 'unified';
      fallbackParsers = ['smart-brevity'];
      break;
  }

  const { result, parserUsed } = globalParserRegistry.parseWithFallback(
    rawOutput,
    preferredParser,
    fallbackParsers,
    config
  );

  // Validate the result
  const parser = globalParserRegistry.get(parserUsed);
  const validation = parser ? parser.validate(result) : { isValid: false, warnings: ['Parser not found'] };

  return {
    result,
    parserUsed,
    validation
  };
}

/**
 * Get format instructions for a specific context
 */
export function getFormatInstructions(contextType: ContextType = 'generic'): string {
  const parserName = contextType === 'news-summary' ? 'smart-brevity' : 'unified';
  const parser = globalParserRegistry.get(parserName);
  return parser ? parser.getFormatInstructions() : '';
}

/**
 * Legacy compatibility - for backwards compatibility with atomize-news
 */
export const UNIFIED_FORMAT_INSTRUCTIONS = getFormatInstructions('generic');
export const parseSmartBrevityOutput = (rawOutput: string) => {
  const { result } = parseStructuredOutput(rawOutput, 'news-summary');
  return result;
};
export const validateSummary = (summary: any) => {
  const parser = globalParserRegistry.get('smart-brevity');
  return parser ? parser.validate(summary) : { isValid: false, warnings: ['Parser not available'] };
};