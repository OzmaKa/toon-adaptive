import * as fs from "fs";
import * as path from "path";
import { analyzeStructure } from "./structural";

const FIXTURES_DIR = "C:/Users/Ozma/Desktop/Pro/toon-adaptive/fixtures";
const expected = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf-8")
);

const categories = ["strong", "weak", "boundary"];

console.log(
  "fixture".padEnd(45),
  "expected".padEnd(10),
  "tabularCov".padEnd(11),
  "aggUniform".padEnd(11),
  "maxDepth".padEnd(9),
  "flags"
);
console.log("-".repeat(120));

for (const cat of categories) {
  const dir = path.join(FIXTURES_DIR, cat);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const key = `${cat}/${file}`;
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const payload = JSON.parse(raw);

    const result = analyzeStructure(payload);
    const exp = expected[key];

    const flagSummary = result.subtrees
      .flatMap((s) => s.irregularityFlags.map((f) => `${s.path}:${f}`))
      .concat(result.irregularityFlags)
      .join(" | ");

    console.log(
      key.padEnd(45),
      (exp?.expectedDecision ?? "?").padEnd(10),
      result.tabularCoverage.toFixed(2).padEnd(11),
      result.aggregateUniformity.toFixed(2).padEnd(11),
      String(result.maxNestingDepth).padEnd(9),
      flagSummary || "(none)"
    );
  }
}
