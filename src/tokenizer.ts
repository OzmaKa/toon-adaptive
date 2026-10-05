import { Tokenizer } from "./types";
import { getEncoding } from "js-tiktoken";

const encoding = getEncoding("cl100k_base");

export const defaultTokenizer: Tokenizer = {
  name: "cl100k_base",
  count: (text: string) => encoding.encode(text).length,
};