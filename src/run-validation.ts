import * as fs from "fs";
import * as path from "path";
import { analyze } from "./decision";

const VALIDATION_DIR = "C:/Users/Ozma/Desktop/Pro/toon-adaptive/validation";

const expected = JSON.parse(
  fs.readFileSync(path.join(VALIDATION_DIR, "expected.json"), "utf-8")
);

const files = fs
  .readdirSync(VALIDATION_DIR)
  .filter((f) => f.endsWith(".json") && f !== "expected.json");

let correct = 0;
let total = 0;

console.log(
  "payload".padEnd(35),
  "expected".padEnd(10),
  "actual".padEnd(8),
  "savings%".padEnd(10),
  "match"
);
console.log("-".repeat(75));

for (const file of files) {
  const payload = JSON.parse(
    fs.readFileSync(path.join(VALIDATION_DIR, file), "utf-8")
  );
  const result = analyze(payload);
  const exp = expected[file];

  if (!exp) {
    console.log(file.padEnd(35), "(no expected label — skipped)");
    continue;
  }

  const match = result.decision === exp.expectedDecision;
  total++;
  if (match) correct++;

  const savings = result.economics
    ? (result.economics.savingsRatio * 100).toFixed(1)
    : "n/a (T1)";

  console.log(
    file.padEnd(35),
    exp.expectedDecision.padEnd(10),
    result.decision.padEnd(8),
    String(savings).padEnd(10),
    match ? "✓" : "✗"
  );
  if (!match) {
    console.log("    your reasoning:", exp.reasoning);
    console.log("    analyze reasons:", result.reasons.join(" | "));
  }
}

console.log("-".repeat(75));
console.log(`${correct}/${total} correct`);