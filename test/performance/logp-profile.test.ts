import { describe, it } from "bun:test";
import { parseSMILES, computeLogP } from "index";

describe("LogP Performance Profile", () => {
  const testMolecules = [
    { smiles: "C", name: "methane" },
    { smiles: "CCO", name: "ethanol" },
    { smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", name: "ibuprofen" },
    { smiles: "CC(=O)Oc1ccccc1C(=O)O", name: "aspirin" },
    { smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", name: "ibuprofen" },
  ];

  it("profile LogP computation", () => {
    for (const { smiles, name } of testMolecules) {
      const mol = parseSMILES(smiles).molecules[0];
      if (!mol) return;

      // First call (with hydrogen addition and SMARTS matching)
      const start1 = performance.now();
      computeLogP(mol);
      const time1 = performance.now() - start1;

      // Second call (should be cached)
      const start2 = performance.now();
      computeLogP(mol);
      const time2 = performance.now() - start2;

      if (process.env.VERBOSE) {
        console.log(
          `${name}: first=${time1.toFixed(3)}ms, cached=${time2.toFixed(3)}ms, speedup=${(time1 / time2).toFixed(0)}x`,
        );
      }
    }
  });
});
