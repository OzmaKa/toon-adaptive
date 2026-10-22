import { Tokenizer, TokenEconomics, ToonOptions } from "./types";
import { defaultTokenizer } from "./tokenizer";
import { encode as toonEncode } from "@toon-format/toon";

/**
 * Internal variant that also returns the two strings it measured, so
 * callers that go on to use them (smartEncode) never encode the same
 * payload twice. The public measureEconomics() below keeps its
 * original return shape.
 */
export function measureEconomicsInternal(
  payload: unknown,
  tokenizer: Tokenizer = defaultTokenizer,
  toonOptions?: ToonOptions
): { economics: TokenEconomics; toonString: string; jsonString: string } {
  const jsonString = JSON.stringify(payload);
  const toonString = toonEncode(payload as any, toonOptions);

  const jsonTokens = tokenizer.count(jsonString);
  const toonTokens = tokenizer.count(toonString);
  const tokensSaved = jsonTokens - toonTokens;
  const savingsRatio = jsonTokens === 0 ? 0 : tokensSaved / jsonTokens;

  return {
    economics: { jsonTokens, toonTokens, tokensSaved, savingsRatio, measured: true },
    toonString,
    jsonString,
  };
}

export function measureEconomics(
  payload: unknown,
  tokenizer: Tokenizer = defaultTokenizer,
  toonOptions?: ToonOptions
): TokenEconomics {
  return measureEconomicsInternal(payload, tokenizer, toonOptions).economics;
}