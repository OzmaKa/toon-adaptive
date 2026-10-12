import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { analyze } from "./decision";

// dist/ sits next to fixtures/ and validation/ at the project root.
const ROOT = path.join(__dirname, "..");

function corpus(label: string, dir: string) {
  const expectedPath = path.join(dir, "expected.json");
  const exists = fs.existsSync(expectedPath);
  describe(label, { skip: !exists && `no ${expectedPath}` }, () => {
    const expected: Record<string, { expectedDecision: string }> = exists
      ? JSON.parse(fs.readFileSync(expectedPath, "utf8"))
      : {};
    for (const [file, exp] of Object.entries(expected)) {
      test(`${file} -> ${exp.expectedDecision}`, () => {
        const payload = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        const result = analyze(payload);
        assert.equal(result.decision, exp.expectedDecision, result.reasons.join(" | "));
      });
    }
  });
}

corpus("fixture corpus (hand-built)", path.join(ROOT, "fixtures"));
corpus("real-world validation", path.join(ROOT, "validation"));