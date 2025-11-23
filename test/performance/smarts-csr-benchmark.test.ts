import { describe, it } from "bun:test";
import { parseSMILES, matchSMARTS } from "index";

describe("SMARTS Performance with CSR Integration", () => {
  const testMolecules = [
    { smiles: "c1ccccc1", name: "benzene" },
    { smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", name: "ibuprofen" },
    { smiles: "CC(=O)Oc1ccccc1C(=O)O", name: "aspirin" },
    { smiles: "c1ccc2ncccc2c1", name: "quinoline" },
  ];

  const testPatterns = [
    { pattern: "c1ccccc1", name: "benzene_ring" },
    { pattern: "[#6]~[#8]", name: "carbon_oxygen" },
    { pattern: "[#6]=[#6]", name: "double_bond" },
    { pattern: "[#7]", name: "nitrogen" },
  ];

  it("SMARTS matching with CSR graphs", () => {
    // Warmup
    const warmupMol = parseSMILES("c1ccccc1").molecules[0];
    if (!warmupMol) return;
    matchSMARTS("[#6]", warmupMol);

    const results: Record<string, number[]> = {};

    for (const { smiles, name } of testMolecules) {
      const mol = parseSMILES(smiles).molecules[0];
      if (!mol) continue;

      for (const { pattern } of testPatterns) {
        const key = pattern;
        if (!results[key]) results[key] = [];

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          matchSMARTS(pattern, mol);
        }
        const end = performance.now();
        const avgTime = (end - start) / 100;
        results[key].push(avgTime);

        if (process.env.VERBOSE) {
          console.log(`${name} + ${pattern}: ${avgTime.toFixed(4)}ms`);
        }
      }
    }

    if (process.env.VERBOSE) {
      console.log("\nAverage performance by pattern:");
      for (const [pattern, times] of Object.entries(results)) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`${pattern}: ${avg.toFixed(4)}ms`);
      }
    }
  });
});
