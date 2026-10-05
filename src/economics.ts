import { Tokenizer, TokenEconomics } from "./types";
import { defaultTokenizer } from "./tokenizer";
import { encode as toonEncode } from "@toon-format/toon";

export function measureEconomics(
  payload: unknown,
  tokenizer: Tokenizer = defaultTokenizer
): TokenEconomics {
  const jsonString = JSON.stringify(payload);
  const toonString = toonEncode(payload as any);

  const jsonTokens = tokenizer.count(jsonString);
  const toonTokens = tokenizer.count(toonString);
  const tokensSaved = jsonTokens - toonTokens;
  const savingsRatio = jsonTokens === 0 ? 0 : tokensSaved / jsonTokens;

  return {
    jsonTokens,
    toonTokens,
    tokensSaved,
    savingsRatio,
    measured: true,
  };
}