# Changelog

## 0.2.0

- Add `smartEncode(payload, options?)`: analyzes, then returns `{ format, data, analysis }` with the TOON or JSON string.
- `verify` (on by default): decodes the TOON output and checks it preserves everything JSON would, falling back to JSON with a reason if it does not.
- Add `toonOptions` (`delimiter`, `indentSize`) to `analyze()` and `smartEncode()`. It is applied to both measurement and output, so the decision matches the output. `replacer` is not supported.
- `smartEncode` throws a `TypeError` for payloads JSON cannot serialize, such as `undefined`.
- Export the `ToonOptions`, `SmartEncodeOptions` and `SmartEncodeResult` types.
- Tests: 68 (was 40), including every fixture and real-world payload run through `smartEncode`.

## 0.1.2

- Documentation and package metadata updates; no code changes.

## 0.1.1

- Add author links to the README and package metadata.
- CI: update GitHub Actions to Node 24-based versions and pin the runner to Ubuntu 24.04.

## 0.1.0

First release.

- `analyze()`: structural analysis, real token measurement with the official TOON encoder, three-tier decision, explainable `reasons`.
- Pluggable synchronous tokenizer; default `cl100k_base` via `js-tiktoken`.
- Options: `tokenizer`, `minSavingsRatio` (0.10), `tabularCoverageFloor` (0.20).
- Test suite: unit tests, 12 hand-built fixtures, 3 real-world payloads.