# toon-adaptive

[![npm version](https://img.shields.io/npm/v/toon-adaptive.svg)](https://www.npmjs.com/package/toon-adaptive)
[![CI](https://github.com/OzmaKa/toon-adaptive/actions/workflows/ci.yml/badge.svg)](https://github.com/OzmaKa/toon-adaptive/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/toon-adaptive.svg)](LICENSE)
[![node](https://img.shields.io/node/v/toon-adaptive.svg)](package.json)

Decides whether a JSON payload should go to an LLM as [TOON](https://www.npmjs.com/package/@toon-format/toon) or stay JSON, using real token measurement instead of guesswork. Can also do the encoding for you and check that nothing was lost.

TOON can cut token usage substantially on uniform, table-like data, but it can cost *more* than JSON when the data is irregular. Today that call is made by eye, every time. `toon-adaptive` makes it for your exact payload and tokenizer, and tells you why.

## Install

```
npm install toon-adaptive
```

Requires Node >= 22.12 (`@toon-format/toon` is ESM-only and is loaded with `require`). Tested on Node 22 and 24. Ships with TypeScript types.

## Quick start

Just the decision:

```ts
import { analyze } from "toon-adaptive";

const result = analyze(payload); // payload: JSON-compatible data, e.g. JSON.parse output

result.decision; // "toon" | "json"
result.reasons;  // human-readable explanation
```

Decision plus the encoded string, ready to put in a prompt:

```ts
import { smartEncode } from "toon-adaptive";

const { format, data, analysis } = smartEncode(payload);

format;   // "toon" | "json"
data;     // the string to send: TOON, or compact JSON
analysis; // the same result analyze() returns, including reasons
```

Example `analyze()` result for 20 uniform rows:

```
{
  decision: "toon",
  reasons: [
    "100% of the payload is tabular-eligible with high structural uniformity",
    "TOON produced 43.5% token savings (262 → 148 tokens) — above the 10% threshold"
  ],
  economics: { jsonTokens: 262, toonTokens: 148, tokensSaved: 114, savingsRatio: 0.435, measured: true },
  structural: { tabularCoverage: 1, ... },
  config: { minSavingsRatio: 0.1, tokenizerUsed: "cl100k_base" }
}
```

Everything runs locally: no network calls, no LLM. The first call loads the tokenizer, which took roughly 0.3 to 0.5 seconds in my tests.

## API

### `analyze(payload, options?)`

| Option | Default | Meaning |
|---|---|---|
| `tokenizer` | `cl100k_base` (via `js-tiktoken`) | Object with `name` and a synchronous `count(text)` |
| `minSavingsRatio` | `0.10` | Choose TOON only if measured savings are at least this fraction |
| `tabularCoverageFloor` | `0.20` | Return `json` without measuring if less of the payload than this is tabular |
| `toonOptions` | encoder defaults | `delimiter` (`","`, `"\t"` or `"|"`) and `indentSize`, passed to the TOON encoder |

Bring your own tokenizer if you target a model whose tokenization differs:

```ts
analyze(payload, { tokenizer: { name: "my-model", count: (text) => myCount(text) } });
```

`toonOptions` is used for the measurement, so the decision describes the output you will actually get. `replacer` is not supported, because it changes the data being measured. Transform your payload before calling instead.

### `smartEncode(payload, options?)`

Takes every option above, plus:

| Option | Default | Meaning |
|---|---|---|
| `verify` | `true` | Decode the TOON output and check it preserves everything JSON would. Fall back to JSON if not |

Returns `{ format, data, analysis }`:

- `format` is `"toon"` or `"json"`, and always equals `analysis.decision`.
- `data` is the TOON string, or compact `JSON.stringify` output.
- `analysis` is the full `analyze()` result. If `verify` rejected the TOON output, `decision` is `"json"`, the reasons say why, and `economics` still shows the TOON measurement so you can see what you gave up.

It throws a `TypeError` for payloads JSON cannot serialize, such as `undefined` or a function.

### Result of `analyze()`

| Field | Meaning |
|---|---|
| `decision` | `"toon"` or `"json"` |
| `reasons` | Specific, human-readable reasons for the decision |
| `economics` | `jsonTokens`, `toonTokens`, `tokensSaved`, `savingsRatio`, `measured`. `null` when a hard signal rejected the payload before measurement |
| `structural` | Per-key `subtrees`, `tabularCoverage`, `aggregateUniformity`, `maxNestingDepth`, `irregularityFlags` |
| `config` | The threshold and tokenizer name actually used |

## How it decides

1. **Structural analysis** (cheap, no tokenizer). For each top-level key: is it an array of objects, how uniform, any missing keys, any self-referential nesting. Results are combined by size.
2. **Hard signals.** Recursive structures, or tabular coverage under the floor, return `json` immediately with no encoder or tokenizer call. These signals can only rule TOON out, never confirm it.
3. **Measurement.** Encode with the official `@toon-format/toon`, count tokens for both formats. The baseline is compact `JSON.stringify` output.
4. **Decision.** `toon` if `savingsRatio >= minSavingsRatio`, otherwise `json`.

Deterministic: the same payload, tokenizer and config give the same result.

`smartEncode` runs the same steps and reuses the strings produced during measurement, so nothing is encoded twice. If the decision is `toon` and `verify` is on, it then decodes the TOON and compares it with the JSON round-trip of your payload. The baseline is JSON's own round-trip, not the original JavaScript value, so TOON has to preserve everything JSON would. Values both formats normalize the same way are accepted (`NaN` and `Infinity` become `null` in both). Differences between the formats are caught, for example an `undefined` property, which JSON drops and TOON writes as `null`.

`verify` costs an extra decode and parse. On my machine (median of 5 runs after warm-up), it added about 1.5 ms at 30 rows, 28 ms at 500 rows and 82 ms at 5,000 rows, on top of 1.6, 32 and 319 ms without it. Your numbers will differ. Measure with your own data and turn it off with `verify: false` if the extra time matters and your data is already known to be safe.

## What validation found

| Payload | Tokens saved by TOON | Decision |
|---|---|---|
| Uniform tables (4 hand-built fixtures) | 24.7% to 36.4% | toon |
| RandomUser API, 20 records (3-level nesting) | 23.6% | toon |
| React Doctor static report (Instagram Vault) | -12.4% | json |
| CoinMarketCap prices, 10 coins | 3.2% | json |
| CoinMarketCap prices, 1 coin | -21.8% | json |

What these taught me, and what changed in the code because of it:

1. **One optional field can flip the decision.** Every issue in a React Doctor report looked identical by eye, but `column` was missing from some. On a 5-issue sample of that data, TOON was 14.1% *worse* than JSON; after backfilling `column: null` it was 17.5% *better*.
2. **The encoder handles uniform nested objects.** RandomUser's three-level records collapse into one header. What breaks tabular form is variable-length arrays and inconsistent keys. My first "strong" fixture was wrong for exactly this reason.
3. **Fixed size floors were wrong twice, and both were removed.** A minimum payload size and a minimum array length each rejected payloads that measured well. 2 RandomUser records already saved 13.2%, while narrow price rows needed far more items. Break-even depends on row width, so measurement decides.
4. **Flat arrays of numbers or strings save about nothing** (-0.5% to 0.0% on synthetic tests), so rejecting them early is correct.
5. **Encoder versions agreed.** `@toon-format/toon` 4.1.1 and 4.4.0 produced identical output on every payload shape I compared.
6. **TOON round-trips faithfully.** 144 hand-picked awkward cases and 3,000 random payloads full of backslashes, newlines, quotes, delimiters and emoji all decoded to exactly what JSON's own round-trip gives. The random generator used a limited alphabet and three payload shapes, so this is evidence, not proof.
7. **`undefined` is a real difference.** JSON drops an `undefined` property and TOON writes `null`, so `verify` falls back to JSON for such payloads.
8. **My first `verify` compared against the wrong thing.** It compared TOON with the original JavaScript value, which rejected `NaN` even though JSON loses it identically. It now compares with JSON's round-trip.

## Known limitations

- Thresholds (10%, 20%) are provisional, derived from 12 hand-built fixtures and a handful of real payloads. That is a small sample.
- The hand-built fixtures were adjusted during development after measurement, so passing them shows the logic is coherent, not that it generalizes. Some real-world labels were written with knowledge of my synthetic experiments.
- Decisions use the savings *ratio* only. 3 saved tokens at 11% passes. An absolute minimum may be needed.
- Savings are measured against compact JSON. If your current JSON is pretty-printed, your real savings are larger than reported.
- Fewer tokens does not necessarily mean lower latency. That is not measured here (see roadmap).
- The default tokenizer is OpenAI-family. Other models tokenize differently.
- The structural pre-filter is cruder than the encoder's own rule. Measurement is authoritative.
- Only top-level keys are analyzed as subtrees, and a payload is encoded entirely as TOON or entirely as JSON (no hybrid).
- The delimiter is not chosen automatically. Pass `toonOptions.delimiter` yourself if you want a different one.
- Circular objects are unsupported. Input must be JSON-compatible.

## Prior art

`toonpy` (Python) and `json2toon_rs` (Rust) detect tabular arrays per array and estimate savings; an MT5 MCP server has a heuristic for one trading-data use case; the official TOON docs publish rules of thumb for humans. In searches in October 2026 I did not find a general-purpose JS/TS package that makes a whole-payload decision from measured tokens. That means I didn't find one, not that none exists.

## Roadmap

- Framework middleware (e.g. Express)
- A small CLI: `npx toon-adaptive data.json`
- Optional automatic delimiter choice, if real data shows it is worth the extra measurement
- A separate study of TOON vs JSON latency (time to first token) on local models via Ollama

## Development

```
git clone https://github.com/OzmaKa/toon-adaptive.git
cd toon-adaptive
npm install
npm test
```

`fixtures/` holds hand-built payloads and `validation/` holds real ones, each with an `expected.json` of the decision I predicted *before* running. Both `analyze` and `smartEncode` are tested against them. To add a real payload: save it in `validation/`, write your prediction first, then run the tests. Issues and payloads that break the decision are very welcome.

## Author

Built by **Oussamah Kabalan**, a software engineer working on AI systems and full-stack TypeScript.

- Portfolio: https://oussamah-kabalan.netlify.app
- GitHub: https://github.com/OzmaKa
- LinkedIn: https://www.linkedin.com/in/oussamah-kabalan

## License

[MIT](LICENSE)