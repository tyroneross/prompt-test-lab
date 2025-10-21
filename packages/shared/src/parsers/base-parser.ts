/**
 * Base Parser Interface - Generic parsing system for any content type
 * This allows the prompt lab to work with different content formats beyond Smart Brevity
 */

import type { ParsedOutput, ParserConfig } from '../types';

export interface Parser<T extends ParsedOutput = ParsedOutput> {
  name: string;
  description: string;
  parse(rawOutput: string, config?: Partial<ParserConfig>): T;
  validate(parsed: T): ParserValidationResult;
  getFormatInstructions(): string;
}

export interface ParserValidationResult {
  isValid: boolean;
  score?: number;
  warnings: string[];
  suggestions?: string[];
  errors?: string[];
}

export abstract class BaseParser<T extends ParsedOutput = ParsedOutput> implements Parser<T> {
  abstract name: string;
  abstract description: string;

  abstract parse(rawOutput: string, config?: Partial<ParserConfig>): T;
  abstract validate(parsed: T): ParserValidationResult;
  abstract getFormatInstructions(): string;

  /**
   * Common utility: Try to parse as JSON (including wrapped in code blocks)
   */
  protected tryParseAsJSON(text: string): any | null {
    try {
      // First, try direct JSON parsing
      return JSON.parse(text.trim());
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonBlockMatch) {
        try {
          return JSON.parse(jsonBlockMatch[1].trim());
        } catch {
          // Continue to other strategies
        }
      }

      // Try to extract JSON object from text
      const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        try {
          return JSON.parse(jsonObjectMatch[0]);
        } catch {
          // Continue to other strategies
        }
      }
    }
    return null;
  }

  /**
   * Common utility: Parse markdown headers and content
   */
  protected parseMarkdownSections(text: string): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {};
    const lines = text.trim().split('\n');
    let currentSection: string | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check for headers
      if (trimmedLine.startsWith('#')) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          this.saveMarkdownSection(result, currentSection, currentContent);
        }

        // Start new section
        currentSection = this.extractSectionName(trimmedLine);
        currentContent = [];
      } else if (currentSection) {
        // Add content to current section
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || trimmedLine.startsWith('•')) {
          currentContent.push(trimmedLine.substring(1).trim());
        } else {
          currentContent.push(trimmedLine);
        }
      }
    }

    // Save final section
    if (currentSection && currentContent.length > 0) {
      this.saveMarkdownSection(result, currentSection, currentContent);
    }

    return result;
  }

  /**
   * Extract section name from markdown header
   */
  private extractSectionName(headerLine: string): string {
    return headerLine
      .replace(/^#+\s*/, '')
      .replace(/^\*\*/, '')
      .replace(/\*\*$/, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Save markdown section content (override in subclasses for specific logic)
   */
  private saveMarkdownSection(result: Record<string, string | string[]>, sectionName: string, content: string[]) {
    const cleanContent = content.filter(c => c.trim().length > 0);
    
    if (cleanContent.length === 1) {
      result[sectionName] = cleanContent[0];
    } else if (cleanContent.length > 1) {
      result[sectionName] = cleanContent;
    }
  }

  /**
   * Common utility: Extract structured data from unformatted text
   */
  protected extractStructuredData(text: string): Record<string, any> | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return null;

    const result: Record<string, any> = {};
    
    // Extract bullets
    const bullets = lines.filter(line => 
      line.startsWith('-') || line.startsWith('*') || line.startsWith('•')
    ).map(line => line.substring(1).trim());

    if (bullets.length > 0) {
      result.bullets = bullets;
    }

    // Extract potential title (first line if short)
    if (lines[0] && lines[0].length <= 100) {
      result.title = lines[0];
    }

    // Extract potential conclusion (last substantial line)
    const lastLine = lines[lines.length - 1];
    if (lastLine && lastLine.length > 20 && lastLine.length <= 200) {
      result.conclusion = lastLine;
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Create fallback result when parsing fails
   */
  protected createFallbackResult(rawOutput: string, errorMessage: string): T {
    const truncated = rawOutput.substring(0, 200);
    
    return {
      parseError: true,
      errorMessage,
      rawOutput: truncated,
      fallback: true
    } as unknown as T;
  }
}

/**
 * Parser Registry - Manages different parser types
 */
export class ParserRegistry {
  private parsers = new Map<string, Parser>();

  register<T extends ParsedOutput>(parser: Parser<T>): void {
    this.parsers.set(parser.name, parser);
  }

  get<T extends ParsedOutput>(name: string): Parser<T> | null {
    return (this.parsers.get(name) as Parser<T>) || null;
  }

  list(): Array<{ name: string; description: string }> {
    return Array.from(this.parsers.values()).map(parser => ({
      name: parser.name,
      description: parser.description
    }));
  }

  parseWithFallback<T extends ParsedOutput>(
    rawOutput: string, 
    preferredParser: string,
    fallbackParsers: string[] = [],
    config?: Partial<ParserConfig>
  ): { result: T; parserUsed: string } {
    // Try preferred parser first
    const preferredParserInstance = this.get<T>(preferredParser);
    if (preferredParserInstance) {
      try {
        const result = preferredParserInstance.parse(rawOutput, config);
        const validation = preferredParserInstance.validate(result);
        
        if (validation.isValid || !validation.errors?.length) {
          return { result, parserUsed: preferredParser };
        }
      } catch (error) {
        console.warn(`Preferred parser ${preferredParser} failed:`, error);
      }
    }

    // Try fallback parsers
    for (const fallbackName of fallbackParsers) {
      const fallbackParser = this.get<T>(fallbackName);
      if (fallbackParser) {
        try {
          const result = fallbackParser.parse(rawOutput, config);
          return { result, parserUsed: fallbackName };
        } catch (error) {
          console.warn(`Fallback parser ${fallbackName} failed:`, error);
        }
      }
    }

    // Final fallback - return raw output with error
    return {
      result: {
        parseError: true,
        errorMessage: 'All parsers failed',
        rawOutput: rawOutput.substring(0, 500)
      } as unknown as T,
      parserUsed: 'fallback'
    };
  }
}