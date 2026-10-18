# Changelog

## 0.1.1

- Add author links to the README and package metadata.
- CI: update GitHub Actions to Node 24-based versions and pin the runner to Ubuntu 24.04.

## 0.1.0

First release.

- `analyze()`: structural analysis, real token measurement with the official TOON encoder, three-tier decision, explainable `reasons`.
- Pluggable synchronous tokenizer; default `cl100k_base` via `js-tiktoken`.
- Options: `tokenizer`, `minSavingsRatio` (0.10), `tabularCoverageFloor` (0.20).
- Test suite: unit tests, 12 hand-built fixtures, 3 real-world payloads.
