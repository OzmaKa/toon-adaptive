"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const structural_1 = require("./structural");
const structure = (v) => (0, structural_1.analyzeStructure)(v);
const table = (n) => Array.from({ length: n }, (_, i) => ({ id: i, name: `user${i}`, active: i % 2 === 0 }));
(0, node_test_1.describe)("analyzeStructure", () => {
    (0, node_test_1.test)("a uniform array of flat objects is fully tabular", () => {
        const s = structure(table(10));
        strict_1.default.equal(s.tabularCoverage, 1);
        strict_1.default.ok(s.aggregateUniformity >= 0.99);
        strict_1.default.deepEqual(s.irregularityFlags, []);
    });
    (0, node_test_1.test)("top-level keys become subtrees; a root array is one subtree at path ''", () => {
        const wrapped = structure({ meta: { page: 1 }, users: table(5) });
        strict_1.default.deepEqual(wrapped.subtrees.map((x) => x.path), ["meta", "users"]);
        const root = structure(table(5));
        strict_1.default.deepEqual(root.subtrees.map((x) => x.path), [""]);
    });
    (0, node_test_1.test)("a key missing from some items is flagged as sparse and lowers uniformity", () => {
        const items = Array.from({ length: 9 }, (_, i) => (i % 3 === 0 ? { id: i } : { id: i, column: 1 }));
        const s = structure(items);
        strict_1.default.ok(s.subtrees[0].irregularityFlags.some((f) => f.startsWith("sparse-keys")));
        strict_1.default.ok(s.aggregateUniformity < 1);
    });
    (0, node_test_1.test)("items with completely different shapes are not tabular-eligible", () => {
        const s = structure([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }, { e: 5 }, { f: 6 }]);
        strict_1.default.equal(s.tabularCoverage, 0);
    });
    (0, node_test_1.test)("self-referential recursion is flagged and removes tabular coverage", () => {
        const tree = {
            replies: [
                { id: "c2", author: "bob", body: "reply", replies: [{ id: "c3", author: "carol", body: "deeper", replies: [] }] },
                { id: "c5", author: "eve", body: "another", replies: [] },
            ],
        };
        const s = structure(tree);
        strict_1.default.equal(s.tabularCoverage, 0);
        strict_1.default.ok(s.subtrees[0].irregularityFlags.some((f) => f.startsWith("self-referential-recursion")));
    });
    (0, node_test_1.test)("a payload with no arrays has zero tabular coverage", () => {
        const s = structure({ build: { target: "es2022", output: { dir: "dist" } }, server: { port: 5173 } });
        strict_1.default.equal(s.tabularCoverage, 0);
    });
    (0, node_test_1.test)("the weighted rollup lets a big table outweigh small metadata", () => {
        const s = structure({ pagination: { page: 1, perPage: 20, links: { next: "/a", prev: null } }, users: table(20) });
        strict_1.default.ok(s.tabularCoverage > 0.8, `coverage was ${s.tabularCoverage}`);
        const [pagination, users] = s.subtrees;
        strict_1.default.ok(users.weight > pagination.weight);
    });
    (0, node_test_1.test)("primitives and empty containers do not throw", () => {
        for (const v of [null, 1, "x", true, [], {}]) {
            strict_1.default.doesNotThrow(() => structure(v));
            strict_1.default.equal(structure(v).tabularCoverage, 0);
        }
    });
});
