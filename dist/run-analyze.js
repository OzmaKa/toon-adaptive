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
const FIXTURES_DIR = "C:/Users/Ozma/Desktop/Pro/toon-adaptive/fixtures";
const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf-8"));
const categories = ["strong", "weak", "boundary"];
let correct = 0;
let total = 0;
console.log("fixture".padEnd(45), "expected".padEnd(10), "actual".padEnd(8), "match");
console.log("-".repeat(75));
for (const cat of categories) {
    const dir = path.join(FIXTURES_DIR, cat);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
        const key = `${cat}/${file}`;
        const raw = fs.readFileSync(path.join(dir, file), "utf-8");
        const payload = JSON.parse(raw);
        const result = (0, decision_1.analyze)(payload);
        const exp = expected[key];
        const match = result.decision === exp?.expectedDecision;
        total++;
        if (match)
            correct++;
        console.log(key.padEnd(45), (exp?.expectedDecision ?? "?").padEnd(10), result.decision.padEnd(8), match ? "✓" : "✗");
        if (!match) {
            console.log("    reasons:", result.reasons.join(" | "));
        }
    }
}
console.log("-".repeat(75));
console.log(`${correct}/${total} correct`);
