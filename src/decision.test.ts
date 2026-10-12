import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./decision";
import type { Tokenizer } from "../src/types";

const table = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: `user${i}`, email: `user${i}@example.com`, active: i % 2 === 0 }));

// Issue-report-shaped records. With sparse=true, every third issue omits `column`.
// Regression for the real-world finding: one inconsistently present field
// turned TOON from a win into a loss on otherwise identical data.
const issues = (n: number, sparse: boolean) =>
  Array.from({ length: n }, (_, i) => {
    const issue: Record<string, unknown> = {
      id: `rule-src_App_jsx-${i}`,
      component: i % 2 ? "AppShell" : "Global/Module",
      file: "src\\App.jsx",
      line: 10 + i,
      severity: i % 3 ? "warning" : "info",
      message: `Unused Variable found: "Item${i}"`,
      suggestion: "Remove the unused variable to clean up the code and reduce bundle size.",
    };
    if (!sparse || i % 3 !== 0) issue.column = 2 + i;
    return issue;
  });

function spyTokenizer() {
  const state = { calls: 0 };
  const tokenizer: Tokenizer = {
    name: "spy",
    count: (text: string) => {
      state.calls++;
      return Math.ceil(text.length / 4);
    },
  };
  return { tokenizer, state };
}

describe("analyze: decisions", () => {
  test("a large uniform table chooses toon, with measured savings above the threshold", () => {
    const r = analyze(table(30));
    assert.equal(r.decision, "toon");
    assert.ok(r.economics);
    assert.equal(r.economics.measured, true);
    assert.ok(r.economics.savingsRatio >= 0.1);
  });

  test("a deeply nested config chooses json", () => {
    const config = { build: { target: "es2022", rollupOptions: { output: { manualChunks: { vendor: ["react"] } } } }, server: { port: 5173 } };
    assert.equal(analyze(config).decision, "json");
  });

  test("a heterogeneous array chooses json", () => {
    const feed = [
      { type: "post", id: "p1", author: "alice", likes: 3 },
      { type: "ad", id: "a1", sponsor: "Acme", creative: { headline: "Sale" } },
      { type: "comment", id: "c1", postId: "p1", body: "nice" },
      { type: "system", id: "s1", message: "followed you" },
      { type: "ad", id: "a2", sponsor: "Beta", creative: { headline: "New" } },
      { type: "post", id: "p2", author: "carol", poll: { votes: [1, 2] } },
    ];
    assert.equal(analyze(feed).decision, "json");
  });

  test("regression: one optional field flips the same data from toon to json", () => {
    const uniform = analyze(issues(30, false));
    const sparse = analyze(issues(30, true));
    assert.equal(uniform.decision, "toon", uniform.reasons.join(" | "));
    assert.equal(sparse.decision, "json", sparse.reasons.join(" | "));
    assert.ok(sparse.economics && sparse.economics.savingsRatio < uniform.economics!.savingsRatio);
  });

  test("regression: small arrays are measured, not rejected by a size floor", () => {
    const small = [
      { id: 1, status: "active" },
      { id: 2, status: "inactive" },
      { id: 3, status: "active" },
    ];
    const r = analyze(small);
    assert.ok(r.economics, "a 3-item array must reach measurement");
  });

  test("a mostly-table payload with metadata still chooses toon (whole-payload rollup)", () => {
    const payload = { pagination: { page: 1, perPage: 20, links: { next: "/a", prev: null } }, users: table(20) };
    assert.equal(analyze(payload).decision, "toon");
  });
});

describe("analyze: Tier 1 short-circuit", () => {
  test("a recursive structure is rejected without calling the tokenizer", () => {
    const tree = { replies: [{ id: "c2", author: "bob", body: "x", replies: [{ id: "c3", author: "carol", body: "y", replies: [] }] }, { id: "c5", author: "eve", body: "z", replies: [] }] };
    const { tokenizer, state } = spyTokenizer();
    const r = analyze(tree, { tokenizer });
    assert.equal(r.decision, "json");
    assert.equal(r.economics, null);
    assert.equal(state.calls, 0);
    assert.ok(r.reasons[0].includes("recursive"));
  });

  test("a payload that passes Tier 1 does call the tokenizer", () => {
    const { tokenizer, state } = spyTokenizer();
    const r = analyze(table(30), { tokenizer });
    assert.ok(state.calls > 0);
    assert.ok(r.economics);
  });

  test("tabularCoverageFloor is configurable and reported in the reason", () => {
    const payload = { pagination: { page: 1, perPage: 20, links: { next: "/a", prev: null } }, users: table(20) };
    const strict = analyze(payload, { tabularCoverageFloor: 0.99 });
    assert.equal(strict.decision, "json");
    assert.equal(strict.economics, null);
    assert.ok(strict.reasons[0].includes("floor"));
    assert.ok(analyze(payload, { tabularCoverageFloor: 0 }).economics);
  });
});

describe("analyze: configuration and determinism", () => {
  test("minSavingsRatio decides at the boundary (>= means toon)", () => {
    const payload = table(30);
    const ratio = analyze(payload, { minSavingsRatio: 0 }).economics!.savingsRatio;
    assert.equal(analyze(payload, { minSavingsRatio: ratio }).decision, "toon");
    assert.equal(analyze(payload, { minSavingsRatio: ratio + 1e-9 }).decision, "json");
  });

  test("raising the threshold can only move a decision from toon to json", () => {
    const payload = table(30);
    const decisions = [0, 0.1, 0.3, 0.5, 0.9].map((t) => analyze(payload, { minSavingsRatio: t }).decision);
    const firstJson = decisions.indexOf("json");
    if (firstJson !== -1) assert.ok(decisions.slice(firstJson).every((d) => d === "json"));
  });

  test("a custom tokenizer is used and reported", () => {
    const payload = table(30);
    const chars: Tokenizer = { name: "chars", count: (t) => t.length };
    const r = analyze(payload, { tokenizer: chars });
    assert.equal(r.config.tokenizerUsed, "chars");
    assert.equal(r.economics!.jsonTokens, JSON.stringify(payload).length);
  });

  test("tokenizer choice changes the economics", () => {
    const payload = table(30);
    const a = analyze(payload, { tokenizer: { name: "chars", count: (t) => t.length } });
    const b = analyze(payload);
    assert.notEqual(a.economics!.jsonTokens, b.economics!.jsonTokens);
  });

  test("the same input, tokenizer and config give identical results", () => {
    const payload = issues(30, true);
    assert.deepStrictEqual(analyze(payload), analyze(payload));
  });

  test("reasons are always present and explain the decision", () => {
    for (const p of [table(30), { a: { b: { c: 1 } } }, issues(30, true), []]) {
      const r = analyze(p);
      assert.ok(r.reasons.length > 0);
      assert.ok(r.reasons.every((x) => typeof x === "string" && x.length > 0));
    }
  });
});

describe("analyze: awkward inputs", () => {
  test("primitives, empty containers and flat arrays return json without throwing", () => {
    for (const v of [null, 42, "hello", true, [], {}, [1, 2, 3, 4, 5, 6, 7, 8], { a: [] }, [[1, 2], [3, 4]], undefined]) {
      const r = analyze(v);
      assert.equal(r.decision, "json");
    }
  });

  test("known limitation: a circular object is not supported and throws", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    assert.throws(() => analyze(circular));
  });
});