import { readFileSync } from "fs";

const csv = readFileSync(
  "test/unit/iupac-engine/iupac-to-smiles-detailed-report.csv",
  "utf-8",
);
const lines = csv.split("\n").slice(1);

console.log("## Parenthetical Cases (first 10):\n");
let count = 0;

for (const line of lines) {
  if (!line.includes("STRUCTURAL_MISMATCH")) continue;

  const parts = line.split("|");
  if (parts.length < 3) continue;

  const name = parts[1]?.replace(/^"/, "").replace(/"$/, "");
  const expected = parts[2]?.replace(/^"/, "").replace(/"$/, "");

  if (!name || !expected) continue;

  if (name.includes("(") && name.includes(")")) {
    count++;
    console.log(`${count}. ${name}`);
    console.log(`   Expected: ${expected}\n`);

    if (count >= 10) break;
  }
}
