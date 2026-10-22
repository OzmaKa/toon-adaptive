import { AnalysisResult, AnalyzeOptions, ToonOptions } from "./types";
import { analyzeInternal } from "./decision";
import { decode as toonDecode } from "@toon-format/toon";

export interface SmartEncodeOptions extends AnalyzeOptions {
  /**
   * After choosing TOON, decode the output and check that it preserves
   * everything JSON would have preserved for this payload. If it does
   * not, fall back to JSON and say why in `analysis.reasons`.
   *
   * The baseline is the payload's own JSON round-trip, not the original
   * JavaScript value, so values both formats normalize the same way
   * (NaN and Infinity become null) are accepted, while differences
   * between the formats (for example TOON writing null where JSON drops
   * an `undefined` property) are caught.
   *
   * Costs an extra decode and parse, roughly proportional to payload
   * size.
   * @default true
   */
  verify?: boolean;
}

export interface SmartEncodeResult {
  format: "toon" | "json";
  data: string;
  analysis: AnalysisResult;
}

/** Structural equality for JSON values (the output of JSON.parse / decode). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k, i) => k === bKeys[i] && deepEqual(aObj[k], bObj[k]));
  }
  return false;
}

/** Only the settings the decoder needs; the delimiter is read from the TOON header itself. */
function decodeOptionsFrom(toonOptions?: ToonOptions): { indentSize?: number; indent?: number } {
  const out: { indentSize?: number; indent?: number } = {};
  if (toonOptions?.indentSize !== undefined) out.indentSize = toonOptions.indentSize;
  if (toonOptions?.indent !== undefined) out.indent = toonOptions.indent;
  return out;
}

/**
 * Decode `toonString` and compare it with the JSON round-trip of the
 * payload (`jsonString` is the payload's JSON.stringify output).
 * Exported for testing; not part of the public package API.
 */
export function verifyRoundTrip(
  jsonString: string,
  toonString: string,
  toonOptions?: ToonOptions
): { ok: true } | { ok: false; reason: string } {
  let decoded: unknown;
  try {
    decoded = toonDecode(toonString, decodeOptionsFrom(toonOptions));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `the TOON output could not be decoded (${message})` };
  }
  if (deepEqual(JSON.parse(jsonString), decoded)) return { ok: true };
  return { ok: false, reason: "the decoded TOON differs from what JSON preserves for this payload" };
}

export function smartEncode(
  payload: unknown,
  options: SmartEncodeOptions = {}
): SmartEncodeResult {
  const verify = options.verify ?? true;
  const { result, toonString, jsonString: measured } = analyzeInternal(payload, options);

  const jsonString: string | undefined = measured ?? JSON.stringify(payload);
  if (jsonString === undefined) {
    throw new TypeError(
      "smartEncode: payload is not JSON-serializable (JSON.stringify returned undefined)"
    );
  }

  if (result.decision === "json" || toonString === null) {
    return { format: "json", data: jsonString, analysis: result };
  }

  if (!verify) {
    return { format: "toon", data: toonString, analysis: result };
  }

  const check = verifyRoundTrip(jsonString, toonString, options.toonOptions);
  if (check.ok) {
    return { format: "toon", data: toonString, analysis: result };
  }

  return {
    format: "json",
    data: jsonString,
    analysis: {
      ...result,
      decision: "json",
      reasons: [...result.reasons, `verify: ${check.reason} — falling back to JSON`],
    },
  };
}