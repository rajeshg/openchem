import { parseSMILES, renderSVG } from "index";
import { writeFileSync } from "fs";

const molecules = [
  { name: "playground", smiles: "C(C1C(C(C(C(O1)O)O)O)O)O" },
  { name: "my-version", smiles: "OCC1OC(O)C(O)C(O)C1O" },
];

for (const { name, smiles } of molecules) {
  const result = parseSMILES(smiles);
  if (result.molecules.length > 0) {
    const svg = renderSVG(result.molecules[0]!, { width: 400, height: 400 });
    writeFileSync(`test-output/glucose-${name}.svg`, svg.svg);
    console.log(`Generated: glucose-${name}.svg`);
  }
}

console.log("\nYou can view these files in a browser to compare visually.");
