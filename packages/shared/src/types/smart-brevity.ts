/**
 * Smart Brevity format types - extracted from atomize-news
 * This is a specific content format that can be used as an example context
 */

export interface SmartBrevitySummary {
  headline: string;
  keyTakeaway: string;
  whyItMatters: string[];
  additionalDetails?: string[];
  bottomLine: string;
  sourceAttribution?: string;
  // Flexible fields for backward compatibility and error handling
  rawOutput?: string;
  parseError?: boolean;
  [key: string]: any;
}

export interface SmartBrevityValidation {
  isValid: boolean;
  warnings: string[];
  score?: number;
  suggestions?: string[];
}

// Format instructions for Smart Brevity
export const SMART_BREVITY_FORMAT_INSTRUCTIONS = `
Output format options (choose the most natural for the model):

OPTION 1 - JSON Format:
Use this exact structure with your content:
- "headline": Your 4-8 words action-oriented summary
- "keyTakeaway": Your 1-2 full sentences about what happened and strategic implication  
- "whyItMatters": Array of complete sentences about strategic risk/opportunity and market impact
- "additionalDetails": Optional array of timing/metrics/context (≤25 words each)
- "bottomLine": Your one strong sentence about the overarching threat or opportunity

OPTION 2 - Markdown Format:
## Headline
Your 4-8 words action-oriented summary

## Key Takeaway  
Your 1-2 full sentences about what happened and strategic implication

### Why It Matters
- Your complete sentence about strategic risk/opportunity  
- Your complete sentence about market impact

### Additional Details
- Optional: Your timing/metrics/context (≤25 words)

### Bottom Line
Your one strong sentence about the overarching threat or opportunity
`;

// Quality scoring criteria for Smart Brevity format
export interface SmartBrevityQualityMetrics {
  headlineScore: number; // 0-100, based on length and action-orientation
  takeawayClarity: number; // 0-100, based on completeness and clarity
  whyItMattersRelevance: number; // 0-100, based on strategic importance
  bottomLineImpact: number; // 0-100, based on strength and clarity
  overallStructure: number; // 0-100, based on adherence to format
}

export interface SmartBrevityFeedback {
  score: SmartBrevityQualityMetrics;
  suggestions: {
    headline?: string[];
    keyTakeaway?: string[];
    whyItMatters?: string[];
    bottomLine?: string[];
    structure?: string[];
  };
  examples?: {
    betterHeadline?: string;
    improvedTakeaway?: string;
    strongerBottomLine?: string;
  };
}