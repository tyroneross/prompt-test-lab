/**
 * Smart Brevity Parser - Extracted from atomize-news unified-parser.ts
 * This is a specific implementation for news content format
 */

import { BaseParser } from './base-parser';
import type { 
  SmartBrevitySummary, 
  SmartBrevityValidation
} from '../types/smart-brevity';
import { SMART_BREVITY_FORMAT_INSTRUCTIONS } from '../types/smart-brevity';
import type { ParserConfig } from '../types';

export class SmartBrevityParser extends BaseParser<SmartBrevitySummary> {
  name = 'smart-brevity';
  description = 'Parser for Smart Brevity news summary format with headline, key takeaway, why it matters, and bottom line';

  getFormatInstructions(): string {
    return SMART_BREVITY_FORMAT_INSTRUCTIONS;
  }

  parse(rawOutput: string, config?: Partial<ParserConfig>): SmartBrevitySummary {
    if (!rawOutput || typeof rawOutput !== 'string') {
      return this.createFallbackSummary('Invalid output: Empty or non-string response');
    }

    // Strategy 1: Try to parse as JSON (wrapped or unwrapped)
    const jsonResult = this.tryParseAsJSON(rawOutput);
    if (jsonResult) {
      return this.normalizeToSchema(jsonResult);
    }

    // Strategy 2: Try to parse as Markdown format
    const markdownResult = this.parseMarkdownSections(rawOutput);
    if (Object.keys(markdownResult).length > 0) {
      return this.normalizeToSchema(markdownResult);
    }

    // Strategy 3: Try to extract any structured data
    const extractedResult = this.extractStructuredData(rawOutput);
    if (extractedResult) {
      return this.normalizeToSchema(extractedResult);
    }

    // Fallback: Create a basic summary from the raw output
    return this.createFallbackSummary(rawOutput);
  }

  validate(summary: SmartBrevitySummary): SmartBrevityValidation {
    const warnings: string[] = [];
    
    if (!summary.headline || summary.headline.length < 5) {
      warnings.push('Headline is too short or missing');
    }
    
    if (!summary.keyTakeaway || summary.keyTakeaway.length < 10) {
      warnings.push('Key takeaway is too short or missing');
    }
    
    if (!summary.whyItMatters || summary.whyItMatters.length < 2) {
      warnings.push('Why It Matters should have at least 2 points');
    }
    
    if (!summary.bottomLine || summary.bottomLine.length < 10) {
      warnings.push('Bottom line is too short or missing');
    }

    // Calculate quality score
    let score = 100;
    score -= warnings.length * 20; // -20 points per warning
    score = Math.max(0, score);

    return {
      isValid: warnings.length === 0,
      warnings,
      score
    };
  }

  /**
   * Normalize parsed data to Smart Brevity schema format
   */
  private normalizeToSchema(data: any): SmartBrevitySummary {
    const normalized: SmartBrevitySummary = {
      headline: '',
      keyTakeaway: '',
      whyItMatters: [],
      bottomLine: ''
    };

    // Headline
    if (data.headline) {
      normalized.headline = String(data.headline).trim();
    }

    // Key Takeaway (flexible field names)
    if (data.keyTakeaway || data['key takeaway']) {
      normalized.keyTakeaway = String(data.keyTakeaway || data['key takeaway']).trim();
    } else if (data.dek) {
      normalized.keyTakeaway = String(data.dek).trim();
    } else if (data.summary) {
      normalized.keyTakeaway = String(data.summary).trim();
    }

    // Why It Matters (flexible field names)
    const whyItMattersField = data.whyItMatters || data['why it matters'] || data.matters;
    if (Array.isArray(whyItMattersField)) {
      normalized.whyItMatters = whyItMattersField.map((item: any) => String(item).trim());
    } else if (Array.isArray(data.bullets)) {
      normalized.whyItMatters = data.bullets.map((item: any) => String(item).trim());
    } else if (Array.isArray(data.keyPoints)) {
      normalized.whyItMatters = data.keyPoints.map((item: any) => String(item).trim());
    }

    // Additional Details (optional)
    const additionalDetailsField = data.additionalDetails || data['additional details'];
    if (Array.isArray(additionalDetailsField)) {
      normalized.additionalDetails = additionalDetailsField.map((item: any) => String(item).trim());
    } else if (Array.isArray(data.keyDetails)) {
      normalized.additionalDetails = data.keyDetails.map((item: any) => String(item).trim());
    }

    // Bottom Line
    const bottomLineField = data.bottomLine || data['bottom line'];
    if (bottomLineField) {
      normalized.bottomLine = String(bottomLineField).trim();
    } else if (data.actionContext) {
      normalized.bottomLine = String(data.actionContext).trim();
    } else if (data.conclusion) {
      normalized.bottomLine = String(data.conclusion).trim();
    }

    // Source Attribution (optional)
    if (data.sourceAttribution) {
      normalized.sourceAttribution = String(data.sourceAttribution).trim();
    }

    return normalized;
  }

  /**
   * Create a fallback summary when parsing fails
   */
  private createFallbackSummary(rawOutput: string): SmartBrevitySummary {
    const truncated = rawOutput.substring(0, 200);
    
    return {
      headline: 'Parsing Error - See Raw Output',
      keyTakeaway: 'Unable to parse LLM response into structured format.',
      whyItMatters: ['Raw output available for manual review', 'Consider adjusting prompt for better structure'],
      bottomLine: 'LLM output requires manual processing.',
      sourceAttribution: 'System',
      rawOutput: truncated,
      parseError: true
    };
  }
}