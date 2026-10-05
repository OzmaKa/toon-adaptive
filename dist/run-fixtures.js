"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const structural_1 = require("./structural");
const FIXTURES_DIR = "C:/Users/Ozma/Desktop/Pro/toon-adaptive/fixtures";
const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf-8"));
const categories = ["strong", "weak", "boundary"];
console.log("fixture".padEnd(45), "expected".padEnd(10), "tabularCov".padEnd(11), "aggUniform".padEnd(11), "maxDepth".padEnd(9), "flags");
console.log("-".repeat(120));
for (const cat of categories) {
    const dir = path.join(FIXTURES_DIR, cat);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
        const key = `${cat}/${file}`;
        const raw = fs.readFileSync(path.join(dir, file), "utf-8");
        const payload = JSON.parse(raw);
        const result = (0, structural_1.analyzeStructure)(payload);
        const exp = expected[key];
        const flagSummary = result.subtrees
            .flatMap((s) => s.irregularityFlags.map((f) => `${s.path}:${f}`))
            .concat(result.irregularityFlags)
            .join(" | ");
        console.log(key.padEnd(45), (exp?.expectedDecision ?? "?").padEnd(10), result.tabularCoverage.toFixed(2).padEnd(11), result.aggregateUniformity.toFixed(2).padEnd(11), String(result.maxNestingDepth).padEnd(9), flagSummary || "(none)");
    }
}
