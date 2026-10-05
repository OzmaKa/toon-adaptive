"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyze = analyze;
const structural_1 = require("./structural");
const economics_1 = require("./economics");
const tokenizer_1 = require("./tokenizer");
// ---------------------------------------------------------------------------
// Seeded, explicitly provisional thresholds.
//
// History of removed size heuristics (both were size proxies that overrode
// real measurement, and both were removed after validation):
// - minPayloadTokens: blocked structure-vs-tokens-disagreement.json
//   (42 tokens, real 14.3% savings).
// - minTabularArraySize: blocked 2-4 item slices of real RandomUser data
//   that measured 13-19% savings. Break-even size depends on how many
//   fields each object has, so no single fixed floor is correct.
//
// Open question: ratio-only decisions treat 6 saved tokens like 600.
// A minimum absolute tokens-saved guard may be needed, but it needs more
// evidence before picking a number.
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG = {
    minSavingsRatio: 0.10,
    tabularCoverageFloor: 0.20,
};
// Tier 1 — hard signals. Structural only, no tokenizer/encoding cost paid.
// Can only push toward "json" — never confirms "toon" by itself.
function checkHardSignals(structural, config) {
    const recursionFlag = structural.subtrees
        .flatMap((s) => s.irregularityFlags)
        .find((f) => f.startsWith("self-referential-recursion"));
    if (recursionFlag) {
        return `Payload contains self-referential recursive structure (${recursionFlag}) — cannot be meaningfully tabularized`;
    }
    if (structural.tabularCoverage < config.tabularCoverageFloor) {
        return `Only ${(structural.tabularCoverage * 100).toFixed(0)}% of the payload is tabular-eligible — below the ${(config.tabularCoverageFloor * 100).toFixed(0)}% floor`;
    }
    return null;
}
// Tier 3 — final decision from measured economics.
function decideFromEconomics(economics, config) {
    if (economics.savingsRatio >= config.minSavingsRatio) {
        return {
            decision: "toon",
            reason: `TOON produced ${(economics.savingsRatio * 100).toFixed(1)}% token savings (${economics.jsonTokens} → ${economics.toonTokens} tokens) — above the ${(config.minSavingsRatio * 100).toFixed(0)}% threshold`,
        };
    }
    return {
        decision: "json",
        reason: `TOON produced only ${(economics.savingsRatio * 100).toFixed(1)}% token savings — below the ${(config.minSavingsRatio * 100).toFixed(0)}% threshold`,
    };
}
function analyze(payload, options = {}) {
    const config = {
        minSavingsRatio: options.minSavingsRatio ?? DEFAULT_CONFIG.minSavingsRatio,
        tabularCoverageFloor: options.tabularCoverageFloor ?? DEFAULT_CONFIG.tabularCoverageFloor,
    };
    const tokenizer = options.tokenizer ?? tokenizer_1.defaultTokenizer;
    const structural = (0, structural_1.analyzeStructure)(payload);
    const disqualifyReason = checkHardSignals(structural, config);
    if (disqualifyReason) {
        return {
            decision: "json",
            structural,
            economics: null,
            reasons: [disqualifyReason],
            config: { minSavingsRatio: config.minSavingsRatio, tokenizerUsed: tokenizer.name },
        };
    }
    const economics = (0, economics_1.measureEconomics)(payload, tokenizer);
    const { decision, reason } = decideFromEconomics(economics, config);
    const reasons = [reason];
    if (structural.tabularCoverage >= 0.8) {
        reasons.unshift(`${(structural.tabularCoverage * 100).toFixed(0)}% of the payload is tabular-eligible with high structural uniformity`);
    }
    return {
        decision,
        structural,
        economics,
        reasons,
        config: { minSavingsRatio: config.minSavingsRatio, tokenizerUsed: tokenizer.name },
    };
}
