import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { encode, decode } from "@toon-format/toon";
import { analyze } from "./decision";
import { smartEncode, verifyRoundTrip } from "./smartEncode";
import type { Tokenizer } from "./types";

const table = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: `user${i}`, email: `user${i}@example.com`, active: i % 2 === 0 }));

const normalize = (v: unknown) => JSON.parse(JSON.stringify(v));

const config = { build: { target: "es2022", rollupOptions: { output: { manualChunks: { vendor: ["react"] } } } }, server: { port: 5173 } };

const withMetadata = () => ({
  meta: { page: 1, links: { next: "/a", prev: null } },
  users: table(20),
});

describe("smartEncode: output", () => {
  test("a large uniform table is returned as TOON that round-trips", () => {
    const payload = table(30);
    const r = smartEncode(payload);
    assert.equal(r.format, "toon");
    assert.equal(r.data, encode(payload));
    assert.deepStrictEqual(decode(r.data), normalize(payload));
  });

  test("a payload that should stay JSON is returned as compact JSON", () => {
    const r = smartEncode(config);
    assert.equal(r.format, "json");
    assert.equal(r.data, JSON.stringify(config));
    assert.equal(r.analysis.economics, null);
  });

  test("format always equals analysis.decision and agrees with analyze()", () => {
    for (const payload of [table(30), config, withMetadata(), [{ id: 1, status: "a" }, { id: 2, status: "b" }]]) {
      const r = smartEncode(payload);
      assert.equal(r.format, r.analysis.decision);
      assert.equal(r.format, analyze(payload).decision);
    }
  });

  test("the same input and options give identical results", () => {
    assert.deepStrictEqual(smartEncode(withMetadata()), smartEncode(withMetadata()));
  });

  test("a payload JSON cannot serialize throws a clear TypeError", () => {
    assert.throws(() => smartEncode(undefined), TypeError);
    assert.throws(() => smartEncode(() => 1), TypeError);
  });
});

describe("smartEncode: toonOptions keep the decision and the output consistent", () => {
  test("a tab delimiter reaches both the measurement and the output", () => {
    const payload = table(30);
    const chars: Tokenizer = { name: "chars", count: (t) => t.length };
    const r = smartEncode(payload, { tokenizer: chars, toonOptions: { delimiter: "\t" } });
    assert.equal(r.format, "toon");
    assert.ok(r.data.includes("\t"));
    assert.equal(r.analysis.economics!.toonTokens, chars.count(r.data));
    assert.equal(r.data, encode(payload, { delimiter: "\t" }));
  });

  test("a custom indentSize is used for encoding and for the verification decode", () => {
    const payload = withMetadata();
    const r = smartEncode(payload, { toonOptions: { indentSize: 4 } });
    assert.equal(r.format, "toon", r.analysis.reasons.join(" | "));
    assert.deepStrictEqual(decode(r.data, { indentSize: 4 }), normalize(payload));
  });

  test("a replacer is rejected, because it would change the data being compared", () => {
    assert.throws(
      () => smartEncode(table(30), { toonOptions: { replacer: () => undefined } as any }),
      /replacer/
    );
  });
});

describe("smartEncode: verify", () => {
  // TOON writes null for an undefined property; JSON drops the key.
  const withUndefined = () =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      name: `user${i}`,
      email: `user${i}@example.com`,
      score: i % 5 === 2 ? undefined : i * 1.5,
    }));

  test("verify catches a real difference between TOON and JSON and falls back to JSON", () => {
    const payload = withUndefined();
    const unchecked = smartEncode(payload, { verify: false });
    assert.equal(unchecked.format, "toon", "precondition: TOON wins on tokens without the check");

    const checked = smartEncode(payload);
    assert.equal(checked.format, "json");
    assert.equal(checked.data, JSON.stringify(payload));
    assert.equal(checked.analysis.decision, "json");
    assert.ok(checked.analysis.reasons.some((r) => r.includes("verify")));
  });

  test("NaN is accepted: JSON and TOON both turn it into null, so TOON is no less faithful", () => {
    const payload = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      name: `user${i}`,
      email: `user${i}@example.com`,
      score: i === 4 ? NaN : i * 1.5,
    }));
    const r = smartEncode(payload);
    assert.equal(r.format, "toon", r.analysis.reasons.join(" | "));
    assert.deepStrictEqual(decode(r.data), normalize(payload));
  });

  test("verifyRoundTrip accepts matching output", () => {
    const payload = table(10);
    assert.deepEqual(verifyRoundTrip(JSON.stringify(payload), encode(payload)), { ok: true });
  });

  test("verifyRoundTrip reports a mismatch", () => {
    const result = verifyRoundTrip(JSON.stringify(table(10)), encode(table(9)));
    assert.equal(result.ok, false);
  });

  test("verifyRoundTrip reports undecodable output instead of throwing", () => {
    const result = verifyRoundTrip(JSON.stringify(table(3)), "[3]{id}:\n  1\n  2");
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reason.includes("could not be decoded"));
  });
});

// Every labeled payload in fixtures/ and validation/ must get the format its label says,
// and must survive the verification round-trip (so verify never rejects real data by accident).
const ROOT = path.join(__dirname, "..");

function corpus(label: string, dir: string) {
  const expectedPath = path.join(dir, "expected.json");
  const exists = fs.existsSync(expectedPath);
  describe(`smartEncode on ${label}`, { skip: !exists && `no ${expectedPath}` }, () => {
    const expected: Record<string, { expectedDecision: string }> = exists
      ? JSON.parse(fs.readFileSync(expectedPath, "utf8"))
      : {};
    for (const [file, exp] of Object.entries(expected)) {
      test(`${file} -> ${exp.expectedDecision}`, () => {
        const payload = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        const r = smartEncode(payload);
        assert.equal(r.format, exp.expectedDecision, r.analysis.reasons.join(" | "));
        if (r.format === "toon") assert.deepStrictEqual(decode(r.data), payload);
      });
    }
  });
}

corpus("fixture corpus (hand-built)", path.join(ROOT, "fixtures"));
corpus("real-world validation", path.join(ROOT, "validation"));