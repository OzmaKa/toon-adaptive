// toon-adaptive — core types
// Matches the data model locked in the project README, Section 4.

export type SubtreeKind =
  | "array-of-objects"
  | "object"
  | "array-of-primitives"
  | "primitive";

export interface SubtreeAnalysis {
  path: string;
  kind: SubtreeKind;
  tabularEligible: boolean;
  arrayUniformity: number | null;
  nestingDepth: number;
  primitiveDensity: number;
  itemCount: number | null;
  irregularityFlags: string[];
  weight: number;
}

export interface StructuralAnalysis {
  subtrees: SubtreeAnalysis[];
  tabularCoverage: number;
  aggregateUniformity: number;
  maxNestingDepth: number;
  irregularityFlags: string[];
}

export interface TokenEconomics {
  jsonTokens: number;
  toonTokens: number;
  tokensSaved: number;
  savingsRatio: number;
  measured: boolean;
}

export interface AnalysisResult {
  decision: "toon" | "json";
  structural: StructuralAnalysis;
  economics: TokenEconomics | null;
  reasons: string[];
  config: {
    minSavingsRatio: number;
    tokenizerUsed: string;
  };
}

export interface Tokenizer {
  name: string;
  count(text: string): number;
}

export interface AnalyzeOptions {
  tokenizer?: Tokenizer;
  minSavingsRatio?: number;
  tabularCoverageFloor?: number;
}