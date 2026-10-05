import * as fs from "fs";
import * as path from "path";
import { measureEconomics } from "./economics";

const FIXTURES_DIR = "C:/Users/Ozma/Desktop/Pro/toon-adaptive/fixtures";

const expected = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf-8")
);

const categories = ["strong", "weak", "boundary"];

console.log(
  "fixture".padEnd(45),
  "expected".padEnd(10),
  "jsonTok".padEnd(9),
  "toonTok".padEnd(9),
  "savings%".padEnd(10),
  "would-pick(0.10 threshold)"
);
console.log("-".repeat(110));

for (const cat of categories) {
  const dir = path.join(FIXTURES_DIR, cat);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const key = `${cat}/${file}`;
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const payload = JSON.parse(raw);

    const econ = measureEconomics(payload);
    const exp = expected[key];
    const wouldPick = econ.savingsRatio >= 0.10 ? "toon" : "json";
    const match = wouldPick === exp?.expectedDecision ? "✓" : "✗";

    console.log(
      key.padEnd(45),
      (exp?.expectedDecision ?? "?").padEnd(10),
      String(econ.jsonTokens).padEnd(9),
      String(econ.toonTokens).padEnd(9),
      (econ.savingsRatio * 100).toFixed(1).padEnd(10),
      `${wouldPick} ${match}`
    );
  }
}