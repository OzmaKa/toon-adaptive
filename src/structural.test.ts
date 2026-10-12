import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analyzeStructure } from "./structural";

const structure = (v: unknown) => analyzeStructure(v as any);

const table = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: `user${i}`, active: i % 2 === 0 }));

describe("analyzeStructure", () => {
  test("a uniform array of flat objects is fully tabular", () => {
    const s = structure(table(10));
    assert.equal(s.tabularCoverage, 1);
    assert.ok(s.aggregateUniformity >= 0.99);
    assert.deepEqual(s.irregularityFlags, []);
  });

  test("top-level keys become subtrees; a root array is one subtree at path ''", () => {
    const wrapped = structure({ meta: { page: 1 }, users: table(5) });
    assert.deepEqual(wrapped.subtrees.map((x: { path: any; }) => x.path), ["meta", "users"]);
    const root = structure(table(5));
    assert.deepEqual(root.subtrees.map((x: { path: any; }) => x.path), [""]);
  });

  test("a key missing from some items is flagged as sparse and lowers uniformity", () => {
    const items = Array.from({ length: 9 }, (_, i) => (i % 3 === 0 ? { id: i } : { id: i, column: 1 }));
    const s = structure(items);
    assert.ok(s.subtrees[0].irregularityFlags.some((f: string) => f.startsWith("sparse-keys")));
    assert.ok(s.aggregateUniformity < 1);
  });

  test("items with completely different shapes are not tabular-eligible", () => {
    const s = structure([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }, { e: 5 }, { f: 6 }]);
    assert.equal(s.tabularCoverage, 0);
  });

  test("self-referential recursion is flagged and removes tabular coverage", () => {
    const tree = {
      replies: [
        { id: "c2", author: "bob", body: "reply", replies: [{ id: "c3", author: "carol", body: "deeper", replies: [] }] },
        { id: "c5", author: "eve", body: "another", replies: [] },
      ],
    };
    const s = structure(tree);
    assert.equal(s.tabularCoverage, 0);
    assert.ok(s.subtrees[0].irregularityFlags.some((f: string) => f.startsWith("self-referential-recursion")));
  });

  test("a payload with no arrays has zero tabular coverage", () => {
    const s = structure({ build: { target: "es2022", output: { dir: "dist" } }, server: { port: 5173 } });
    assert.equal(s.tabularCoverage, 0);
  });

  test("the weighted rollup lets a big table outweigh small metadata", () => {
    const s = structure({ pagination: { page: 1, perPage: 20, links: { next: "/a", prev: null } }, users: table(20) });
    assert.ok(s.tabularCoverage > 0.8, `coverage was ${s.tabularCoverage}`);
    const [pagination, users] = s.subtrees;
    assert.ok(users.weight > pagination.weight);
  });

  test("primitives and empty containers do not throw", () => {
    for (const v of [null, 1, "x", true, [], {}]) {
      assert.doesNotThrow(() => structure(v));
      assert.equal(structure(v).tabularCoverage, 0);
    }
  });
});