import type { EncodeOptions } from "@toon-format/toon";

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

/**
 * Encoder settings shared by measurement and the final output.
 * `replacer` is deliberately excluded: it changes the data being
 * encoded, so the decision would describe different data than the
 * JSON baseline it is compared against. Transform your payload before
 * calling instead.
 */
export type ToonOptions = Omit<EncodeOptions, "replacer">;

export interface AnalyzeOptions {
  tokenizer?: Tokenizer;
  minSavingsRatio?: number;
  tabularCoverageFloor?: number;
  /**
   * Passed to the real @toon-format/toon encoder for both measurement
   * and, in smartEncode, the final output, so the decision always
   * describes the output you actually get.
   */
  toonOptions?: ToonOptions;
}