"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const decision_1 = require("./decision");
const table = (n) => Array.from({ length: n }, (_, i) => ({ id: i, name: `user${i}`, email: `user${i}@example.com`, active: i % 2 === 0 }));
// Issue-report-shaped records. With sparse=true, every third issue omits `column`.
// Regression for the real-world finding: one inconsistently present field
// turned TOON from a win into a loss on otherwise identical data.
const issues = (n, sparse) => Array.from({ length: n }, (_, i) => {
    const issue = {
        id: `rule-src_App_jsx-${i}`,
        component: i % 2 ? "AppShell" : "Global/Module",
        file: "src\\App.jsx",
        line: 10 + i,
        severity: i % 3 ? "warning" : "info",
        message: `Unused Variable found: "Item${i}"`,
        suggestion: "Remove the unused variable to clean up the code and reduce bundle size.",
    };
    if (!sparse || i % 3 !== 0)
        issue.column = 2 + i;
    return issue;
});
function spyTokenizer() {
    const state = { calls: 0 };
    const tokenizer = {
        name: "spy",
        count: (text) => {
            state.calls++;
            return Math.ceil(text.length / 4);
        },
    };
    return { tokenizer, state };
}
(0, node_test_1.describe)("analyze: decisions", () => {
    (0, node_test_1.test)("a large uniform table chooses toon, with measured savings above the threshold", () => {
        const r = (0, decision_1.analyze)(table(30));
        strict_1.default.equal(r.decision, "toon");
        strict_1.default.ok(r.economics);
        strict_1.default.equal(r.economics.measured, true);
        strict_1.default.ok(r.economics.savingsRatio >= 0.1);
    });
    (0, node_test_1.test)("a deeply nested config chooses json", () => {
        const config = { build: { target: "es2022", rollupOptions: { output: { manualChunks: { vendor: ["react"] } } } }, server: { port: 5173 } };
        strict_1.default.equal((0, decision_1.analyze)(config).decision, "json");
    });
    (0, node_test_1.test)("a heterogeneous array chooses json", () => {
        const feed = [
            { type: "post", id: "p1", author: "alice", likes: 3 },
            { type: "ad", id: "a1", sponsor: "Acme", creative: { headline: "Sale" } },
            { type: "comment", id: "c1", postId: "p1", body: "nice" },
            { type: "system", id: "s1", message: "followed you" },
            { type: "ad", id: "a2", sponsor: "Beta", creative: { headline: "New" } },
            { type: "post", id: "p2", author: "carol", poll: { votes: [1, 2] } },
        ];
        strict_1.default.equal((0, decision_1.analyze)(feed).decision, "json");
    });
    (0, node_test_1.test)("regression: one optional field flips the same data from toon to json", () => {
        const uniform = (0, decision_1.analyze)(issues(30, false));
        const sparse = (0, decision_1.analyze)(issues(30, true));
        strict_1.default.equal(uniform.decision, "toon", uniform.reasons.join(" | "));
        strict_1.default.equal(sparse.decision, "json", sparse.reasons.join(" | "));
        strict_1.default.ok(sparse.economics && sparse.economics.savingsRatio < uniform.economics.savingsRatio);
    });
    (0, node_test_1.test)("regression: small arrays are measured, not rejected by a size floor", () => {
        const small = [
            { id: 1, status: "active" },
            { id: 2, status: "inactive" },
            { id: 3, status: "active" },
        ];
        const r = (0, decision_1.analyze)(small);
        strict_1.default.ok(r.economics, "a 3-item array must reach measurement");
    });
    (0, node_test_1.test)("a mostly-table payload with metadata still chooses toon (whole-payload rollup)", () => {
        const payload = { pagination: { page: 1, perPage: 20, links: { next: "/a", prev: null } }, users: table(20) };
        strict_1.default.equal((0, decision_1.analyze)(payload).decision, "toon");
    });
});
(0, node_test_1.describe)("analyze: Tier 1 short-circuit", () => {
    (0, node_test_1.test)("a recursive structure is rejected without calling the tokenizer", () => {
        const tree = { replies: [{ id: "c2", author: "bob", body: "x", replies: [{ id: "c3", author: "carol", body: "y", replies: [] }] }, { id: "c5", author: "eve", body: "z", replies: [] }] };
        const { tokenizer, state } = spyTokenizer();
        const r = (0, decision_1.analyze)(tree, { tokenizer });
        strict_1.default.equal(r.decision, "json");
        strict_1.default.equal(r.economics, null);
        strict_1.default.equal(state.calls, 0);
        strict_1.default.ok(r.reasons[0].includes("recursive"));
    });
    (0, node_test_1.test)("a payload that passes Tier 1 does call the tokenizer", () => {
        const { tokenizer, state } = spyTokenizer();
        const r = (0, decision_1.analyze)(table(30), { tokenizer });
        strict_1.default.ok(state.calls > 0);
        strict_1.default.ok(r.economics);
    });
    (0, node_test_1.test)("tabularCoverageFloor is configurable and reported in the reason", () => {
        const payload = { pagination: { page: 1, perPage: 20, links: { next: "/a", prev: null } }, users: table(20) };
        const strict = (0, decision_1.analyze)(payload, { tabularCoverageFloor: 0.99 });
        strict_1.default.equal(strict.decision, "json");
        strict_1.default.equal(strict.economics, null);
        strict_1.default.ok(strict.reasons[0].includes("floor"));
        strict_1.default.ok((0, decision_1.analyze)(payload, { tabularCoverageFloor: 0 }).economics);
    });
});
(0, node_test_1.describe)("analyze: configuration and determinism", () => {
    (0, node_test_1.test)("minSavingsRatio decides at the boundary (>= means toon)", () => {
        const payload = table(30);
        const ratio = (0, decision_1.analyze)(payload, { minSavingsRatio: 0 }).economics.savingsRatio;
        strict_1.default.equal((0, decision_1.analyze)(payload, { minSavingsRatio: ratio }).decision, "toon");
        strict_1.default.equal((0, decision_1.analyze)(payload, { minSavingsRatio: ratio + 1e-9 }).decision, "json");
    });
    (0, node_test_1.test)("raising the threshold can only move a decision from toon to json", () => {
        const payload = table(30);
        const decisions = [0, 0.1, 0.3, 0.5, 0.9].map((t) => (0, decision_1.analyze)(payload, { minSavingsRatio: t }).decision);
        const firstJson = decisions.indexOf("json");
        if (firstJson !== -1)
            strict_1.default.ok(decisions.slice(firstJson).every((d) => d === "json"));
    });
    (0, node_test_1.test)("a custom tokenizer is used and reported", () => {
        const payload = table(30);
        const chars = { name: "chars", count: (t) => t.length };
        const r = (0, decision_1.analyze)(payload, { tokenizer: chars });
        strict_1.default.equal(r.config.tokenizerUsed, "chars");
        strict_1.default.equal(r.economics.jsonTokens, JSON.stringify(payload).length);
    });
    (0, node_test_1.test)("tokenizer choice changes the economics", () => {
        const payload = table(30);
        const a = (0, decision_1.analyze)(payload, { tokenizer: { name: "chars", count: (t) => t.length } });
        const b = (0, decision_1.analyze)(payload);
        strict_1.default.notEqual(a.economics.jsonTokens, b.economics.jsonTokens);
    });
    (0, node_test_1.test)("the same input, tokenizer and config give identical results", () => {
        const payload = issues(30, true);
        strict_1.default.deepStrictEqual((0, decision_1.analyze)(payload), (0, decision_1.analyze)(payload));
    });
    (0, node_test_1.test)("reasons are always present and explain the decision", () => {
        for (const p of [table(30), { a: { b: { c: 1 } } }, issues(30, true), []]) {
            const r = (0, decision_1.analyze)(p);
            strict_1.default.ok(r.reasons.length > 0);
            strict_1.default.ok(r.reasons.every((x) => typeof x === "string" && x.length > 0));
        }
    });
});
(0, node_test_1.describe)("analyze: awkward inputs", () => {
    (0, node_test_1.test)("primitives, empty containers and flat arrays return json without throwing", () => {
        for (const v of [null, 42, "hello", true, [], {}, [1, 2, 3, 4, 5, 6, 7, 8], { a: [] }, [[1, 2], [3, 4]], undefined]) {
            const r = (0, decision_1.analyze)(v);
            strict_1.default.equal(r.decision, "json");
        }
    });
    (0, node_test_1.test)("known limitation: a circular object is not supported and throws", () => {
        const circular = { a: 1 };
        circular.self = circular;
        strict_1.default.throws(() => (0, decision_1.analyze)(circular));
    });
});
