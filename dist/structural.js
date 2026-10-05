"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeStructure = analyzeStructure;
function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isPrimitive(v) {
    return (v === null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean");
}
/** Count total nodes (primitives + containers) in a value, for weighting. */
function countNodes(v) {
    if (isPrimitive(v))
        return 1;
    if (Array.isArray(v)) {
        return 1 + v.reduce((sum, item) => sum + countNodes(item), 0);
    }
    if (isPlainObject(v)) {
        return (1 +
            Object.values(v).reduce((sum, val) => sum + countNodes(val), 0));
    }
    return 1;
}
/** Max nesting depth within a value (0 for a primitive). */
function maxDepth(v) {
    if (isPrimitive(v))
        return 0;
    if (Array.isArray(v)) {
        if (v.length === 0)
            return 1;
        return 1 + Math.max(...v.map(maxDepth));
    }
    if (isPlainObject(v)) {
        const vals = Object.values(v);
        if (vals.length === 0)
            return 1;
        return 1 + Math.max(...vals.map(maxDepth));
    }
    return 0;
}
/** Fraction of leaf nodes within a value that are primitives (0-1). */
function primitiveDensity(v) {
    let primitives = 0;
    let total = 0;
    function walk(node) {
        if (isPrimitive(node)) {
            primitives++;
            total++;
            return;
        }
        if (Array.isArray(node)) {
            if (node.length === 0)
                total++; // empty array counts as one non-primitive leaf
            node.forEach(walk);
            return;
        }
        if (isPlainObject(node)) {
            const entries = Object.values(node);
            if (entries.length === 0)
                total++;
            entries.forEach(walk);
            return;
        }
    }
    walk(v);
    return total === 0 ? 0 : primitives / total;
}
/**
 * For an array, determine if it's "array-of-objects" and, if so, how
 * uniform the objects are (same keys, same order-independent key set,
 * scalar values only — no nested objects/arrays inside each item, since
 * that would itself need its own tabular judgment).
 *
 * Returns { uniformity, flags } — uniformity is null if the array isn't
 * array-of-objects at all.
 */
function analyzeArrayUniformity(arr) {
    const flags = [];
    if (arr.length === 0) {
        return { uniformity: null, flags, tabularEligible: false };
    }
    const allObjects = arr.every(isPlainObject);
    if (!allObjects) {
        // array-of-primitives or mixed-type array
        const allPrimitive = arr.every(isPrimitive);
        if (!allPrimitive && !allObjects) {
            flags.push("mixed-type-array");
        }
        return { uniformity: null, flags, tabularEligible: false };
    }
    const objects = arr;
    const keySets = objects.map((o) => new Set(Object.keys(o)));
    // Reference key set = union of all keys seen (captures sparse/optional keys)
    const unionKeys = new Set();
    keySets.forEach((ks) => ks.forEach((k) => unionKeys.add(k)));
    // Reference key set for "core" schema = intersection (keys present in ALL items)
    const intersectionKeys = new Set([...unionKeys].filter((k) => keySets.every((ks) => ks.has(k))));
    const missingKeyRatio = unionKeys.size === 0
        ? 0
        : 1 - intersectionKeys.size / unionKeys.size;
    if (missingKeyRatio > 0) {
        flags.push(`sparse-keys (${Math.round(missingKeyRatio * 100)}% of keys are optional/inconsistent)`);
    }
    // Check value shapes: uniform tabular form wants scalar values per key,
    // not nested objects/arrays (those would need their own analysis).
    let scalarFieldCount = 0;
    let totalFieldCount = 0;
    let selfReferentialCount = 0;
    objects.forEach((o) => {
        Object.entries(o).forEach(([key, v]) => {
            totalFieldCount++;
            if (isPrimitive(v)) {
                scalarFieldCount++;
            }
            else if (Array.isArray(v)) {
                // Self-referential check: does this array field contain items
                // shaped like the parent objects themselves (same key set)?
                // This is what makes recursive tree structures (comments, replies,
                // nested categories) fundamentally unlike a flat tabular array —
                // depth is unbounded and can't be flattened into rows.
                const parentKeys = new Set(Object.keys(o));
                const childLooksLikeParent = v.some((item) => isPlainObject(item) &&
                    Object.keys(item).some((k) => parentKeys.has(k)) &&
                    Object.keys(item).length >= parentKeys.size * 0.5);
                if (childLooksLikeParent) {
                    selfReferentialCount++;
                }
            }
        });
    });
    const scalarRatio = totalFieldCount === 0 ? 1 : scalarFieldCount / totalFieldCount;
    const isRecursiveStructure = selfReferentialCount > 0;
    if (scalarRatio < 0.8) {
        flags.push("non-scalar-fields (many values are nested objects/arrays)");
    }
    if (isRecursiveStructure) {
        flags.push("self-referential-recursion (items contain nested items of the same shape — unbounded tree depth)");
    }
    // Uniformity score: combination of key consistency and scalar-value ratio.
    const keyConsistency = 1 - missingKeyRatio;
    let uniformity = keyConsistency * 0.7 + scalarRatio * 0.3;
    // Self-referential recursion is a hard penalty, not a soft weighting —
    // a recursive tree can look perfectly "uniform" sibling-to-sibling while
    // still being fundamentally unbounded/unflattenable, which sibling-key
    // consistency alone can't detect.
    if (isRecursiveStructure) {
        uniformity = Math.min(uniformity, 0.3);
    }
    const tabularEligible = uniformity >= 0.5 && arr.length >= 1;
    return { uniformity, flags, tabularEligible };
}
function classifyKind(v) {
    if (isPrimitive(v))
        return "primitive";
    if (Array.isArray(v)) {
        if (v.length === 0)
            return "array-of-primitives";
        return v.every(isPlainObject) ? "array-of-objects" : "array-of-primitives";
    }
    return "object";
}
// ---------------------------------------------------------------------------
// Subtree analysis — one per top-level key (v1 locked decision: no deeper
// recursion into separate subtree nodes; nested structure is folded into
// this subtree's own stats instead).
// ---------------------------------------------------------------------------
function analyzeSubtree(path, value) {
    const kind = classifyKind(value);
    const flags = [];
    let arrayUniformity = null;
    let tabularEligible = false;
    let itemCount = null;
    if (Array.isArray(value)) {
        itemCount = value.length;
        const result = analyzeArrayUniformity(value);
        arrayUniformity = result.uniformity;
        tabularEligible = result.tabularEligible;
        flags.push(...result.flags);
    }
    const depth = maxDepth(value);
    const density = primitiveDensity(value);
    if (depth >= 4) {
        flags.push(`deep-nesting (depth ${depth})`);
    }
    return {
        path,
        kind,
        tabularEligible,
        arrayUniformity,
        nestingDepth: depth,
        primitiveDensity: density,
        itemCount,
        irregularityFlags: flags,
        weight: countNodes(value),
    };
}
// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------
function analyzeStructure(payload) {
    const subtrees = [];
    if (isPlainObject(payload)) {
        for (const [key, value] of Object.entries(payload)) {
            subtrees.push(analyzeSubtree(key, value));
        }
    }
    else if (Array.isArray(payload)) {
        // Root itself is an array — treat as a single subtree at path "".
        subtrees.push(analyzeSubtree("", payload));
    }
    else {
        // Root is a primitive — degenerate case.
        subtrees.push(analyzeSubtree("", payload));
    }
    const totalWeight = subtrees.reduce((sum, s) => sum + s.weight, 0) || 1;
    const tabularCoverage = subtrees
        .filter((s) => s.tabularEligible)
        .reduce((sum, s) => sum + s.weight, 0) / totalWeight;
    const eligibleSubtrees = subtrees.filter((s) => s.arrayUniformity !== null);
    const aggregateUniformity = eligibleSubtrees.length === 0
        ? 0
        : eligibleSubtrees.reduce((sum, s) => sum + (s.arrayUniformity ?? 0) * s.weight, 0) /
            (eligibleSubtrees.reduce((sum, s) => sum + s.weight, 0) || 1);
    const maxNestingDepth = Math.max(0, ...subtrees.map((s) => s.nestingDepth));
    const payloadLevelFlags = [];
    if (maxNestingDepth >= 5) {
        payloadLevelFlags.push(`payload-max-depth (${maxNestingDepth})`);
    }
    return {
        subtrees,
        tabularCoverage,
        aggregateUniformity,
        maxNestingDepth,
        irregularityFlags: payloadLevelFlags,
    };
}
