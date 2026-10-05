import * as fs from "fs";
import * as path from "path";
import { analyze } from "./decision";

const FIXTURES_DIR = "C:/Users/Ozma/Desktop/Pro/toon-adaptive/fixtures";

const expected = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf-8")
);

const categories = ["strong", "weak", "boundary"];
let correct = 0;
let total = 0;

console.log(
  "fixture".padEnd(45),
  "expected".padEnd(10),
  "actual".padEnd(8),
  "match"
);
console.log("-".repeat(75));

for (const cat of categories) {
  const dir = path.join(FIXTURES_DIR, cat);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const key = `${cat}/${file}`;
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const payload = JSON.parse(raw);

    const result = analyze(payload);
    const exp = expected[key];
    const match = result.decision === exp?.expectedDecision;
    total++;
    if (match) correct++;

    console.log(
      key.padEnd(45),
      (exp?.expectedDecision ?? "?").padEnd(10),
      result.decision.padEnd(8),
      match ? "✓" : "✗"
    );
    if (!match) {
      console.log("    reasons:", result.reasons.join(" | "));
    }
  }
}

console.log("-".repeat(75));
console.log(`${correct}/${total} correct`);