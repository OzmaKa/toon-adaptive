import {
  AnalysisResult,
  AnalyzeOptions,
  StructuralAnalysis,
  TokenEconomics,
} from "./types";
import { analyzeStructure } from "./structural";
import { measureEconomicsInternal } from "./economics";
import { defaultTokenizer } from "./tokenizer";

const DEFAULT_CONFIG = {
  minSavingsRatio: 0.10,
  tabularCoverageFloor: 0.20,
};

function checkHardSignals(
  structural: StructuralAnalysis,
  config: typeof DEFAULT_CONFIG
): string | null {
  const recursionFlag = structural.subtrees
    .flatMap((s) => s.irregularityFlags)
    .find((f) => f.startsWith("self-referential-recursion"));
  if (recursionFlag) {
    return `Payload contains self-referential recursive structure (${recursionFlag}) — cannot be meaningfully tabularized`;
  }

  if (structural.tabularCoverage < config.tabularCoverageFloor) {
    return `Only ${(structural.tabularCoverage * 100).toFixed(
      0
    )}% of the payload is tabular-eligible — below the ${(
      config.tabularCoverageFloor * 100
    ).toFixed(0)}% floor`;
  }

  return null;
}

function decideFromEconomics(
  economics: TokenEconomics,
  config: typeof DEFAULT_CONFIG
): { decision: "toon" | "json"; reason: string } {
  if (economics.savingsRatio >= config.minSavingsRatio) {
    return {
      decision: "toon",
      reason: `TOON produced ${(economics.savingsRatio * 100).toFixed(
        1
      )}% token savings (${economics.jsonTokens} → ${economics.toonTokens} tokens) — above the ${(
        config.minSavingsRatio * 100
      ).toFixed(0)}% threshold`,
    };
  }

  return {
    decision: "json",
    reason: `TOON produced only ${(economics.savingsRatio * 100).toFixed(
      1
    )}% token savings — below the ${(config.minSavingsRatio * 100).toFixed(
      0
    )}% threshold`,
  };
}

/**
 * Internal variant used by smartEncode: identical decision logic, but
 * also returns the TOON string produced during measurement (when
 * measurement ran) so the caller never has to encode the same payload
 * twice.
 */
export function analyzeInternal(
  payload: unknown,
  options: AnalyzeOptions = {}
): { result: AnalysisResult; toonString: string | null; jsonString: string | null } {
  if (options.toonOptions && "replacer" in options.toonOptions) {
    throw new TypeError(
      "toonOptions.replacer is not supported: it changes the data being measured. Transform the payload before calling instead."
    );
  }
  const config = {
    minSavingsRatio: options.minSavingsRatio ?? DEFAULT_CONFIG.minSavingsRatio,
    tabularCoverageFloor:
      options.tabularCoverageFloor ?? DEFAULT_CONFIG.tabularCoverageFloor,
  };
  const tokenizer = options.tokenizer ?? defaultTokenizer;

  const structural = analyzeStructure(payload as any);

  const disqualifyReason = checkHardSignals(structural, config);
  if (disqualifyReason) {
    return {
      result: {
        decision: "json",
        structural,
        economics: null,
        reasons: [disqualifyReason],
        config: { minSavingsRatio: config.minSavingsRatio, tokenizerUsed: tokenizer.name },
      },
      toonString: null,
      jsonString: null,
    };
  }

  const { economics, toonString, jsonString } = measureEconomicsInternal(
    payload,
    tokenizer,
    options.toonOptions
  );
  const { decision, reason } = decideFromEconomics(economics, config);

  const reasons: string[] = [reason];
  if (structural.tabularCoverage >= 0.8) {
    reasons.unshift(
      `${(structural.tabularCoverage * 100).toFixed(0)}% of the payload is tabular-eligible with high structural uniformity`
    );
  }

  return {
    result: {
      decision,
      structural,
      economics,
      reasons,
      config: { minSavingsRatio: config.minSavingsRatio, tokenizerUsed: tokenizer.name },
    },
    toonString,
    jsonString,
  };
}

export function analyze(
  payload: unknown,
  options: AnalyzeOptions = {}
): AnalysisResult {
  return analyzeInternal(payload, options).result;
}