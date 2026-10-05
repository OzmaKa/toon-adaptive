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
const decision_1 = require("./decision");
const VALIDATION_DIR = "C:/Users/Ozma/Desktop/Pro/toon-adaptive/validation";
const expected = JSON.parse(fs.readFileSync(path.join(VALIDATION_DIR, "expected.json"), "utf-8"));
const files = fs
    .readdirSync(VALIDATION_DIR)
    .filter((f) => f.endsWith(".json") && f !== "expected.json");
let correct = 0;
let total = 0;
console.log("payload".padEnd(35), "expected".padEnd(10), "actual".padEnd(8), "savings%".padEnd(10), "match");
console.log("-".repeat(75));
for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(VALIDATION_DIR, file), "utf-8"));
    const result = (0, decision_1.analyze)(payload);
    const exp = expected[file];
    if (!exp) {
        console.log(file.padEnd(35), "(no expected label — skipped)");
        continue;
    }
    const match = result.decision === exp.expectedDecision;
    total++;
    if (match)
        correct++;
    const savings = result.economics
        ? (result.economics.savingsRatio * 100).toFixed(1)
        : "n/a (T1)";
    console.log(file.padEnd(35), exp.expectedDecision.padEnd(10), result.decision.padEnd(8), String(savings).padEnd(10), match ? "✓" : "✗");
    if (!match) {
        console.log("    your reasoning:", exp.reasoning);
        console.log("    analyze reasons:", result.reasons.join(" | "));
    }
}
console.log("-".repeat(75));
console.log(`${correct}/${total} correct`);
