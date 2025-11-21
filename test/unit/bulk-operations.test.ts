import { describe, it, expect } from "bun:test";
import {
  parseSMILES,
  bulkMatchSMARTS,
  bulkComputeProperties,
  bulkComputeSimilarities,
  bulkFindSimilar,
  bulkFilterDrugLike,
} from "index";

describe("Bulk Operations API", () => {
  const testMolecules = [
    { smiles: "c1ccccc1", name: "benzene" },
    { smiles: "CCO", name: "ethanol" },
    { smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", name: "ibuprofen" },
    { smiles: "CC(=O)Oc1ccccc1C(=O)O", name: "aspirin" },
    { smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", name: "caffeine" },
  ];

  const molecules = testMolecules.map((m) => {
    const parsed = parseSMILES(m.smiles);
    return parsed.molecules[0]!;
  });

  it("bulkMatchSMARTS - find pattern matches across molecules", () => {
    const result = bulkMatchSMARTS("[#6]~[#8]", molecules);

    expect(result.pattern).toBe("[#6]~[#8]");
    expect(result.moleculeMatches.length).toBe(molecules.length);

    // Ethanol has a C-O bond
    expect(result.moleculeMatches[1]!.matches.length).toBeGreaterThan(0);

    // Benzene has no C-O bonds
    expect(result.moleculeMatches[0]!.matches.length).toBe(0);
  });

  it("bulkComputeProperties - compute drug-likeness for multiple molecules", () => {
    const results = bulkComputeProperties(molecules);

    expect(results.length).toBe(molecules.length);

    for (const result of results) {
      expect(result.moleculeIndex).toBeDefined();
      expect(typeof result.logp).toBe("number");
      expect(result.lipinski).toBeDefined();
      expect(typeof result.lipinski.passed).toBe("boolean");
      expect(Array.isArray(result.lipinski.violations)).toBe(true);
      expect(result.veber).toBeDefined();
      expect(typeof result.veber.passed).toBe("boolean");
      expect(result.bbb).toBeDefined();
      expect(typeof result.bbb.passed).toBe("boolean");
    }

    // Aspirin should pass Lipinski's rule
    const aspirinResult = results.find((r) => r.moleculeIndex === 3);
    expect(aspirinResult!.lipinski.passed).toBe(true);
  });

  it("bulkComputeSimilarities - compute pairwise fingerprint similarities", () => {
    const results = bulkComputeSimilarities(molecules, 2, 512);

    // Should have (n * (n - 1)) / 2 comparisons for n molecules
    const expectedPairs = (molecules.length * (molecules.length - 1)) / 2;
    expect(results.length).toBe(expectedPairs);

    for (const result of results) {
      expect(typeof result.queryIndex).toBe("number");
      expect(typeof result.targetIndex).toBe("number");
      expect(typeof result.similarity).toBe("number");
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    }

    // Same molecules should have similarity of 1.0
    // (but not directly compared in pairwise)
    // We can verify at least some similarity exists
    expect(results.some((r) => r.similarity > 0)).toBe(true);
  });

  it("bulkFindSimilar - find molecules similar to a query", () => {
    const queryParsed = parseSMILES("CC(C)Cc1ccc(cc1)C(C)C(=O)O").molecules[0]!; // ibuprofen

    const results = bulkFindSimilar(queryParsed, molecules, 0.5, 2, 512);

    // Should find at least ibuprofen itself (not in target) or similar compounds
    expect(Array.isArray(results)).toBe(true);

    for (const result of results) {
      expect(typeof result.targetIndex).toBe("number");
      expect(typeof result.similarity).toBe("number");
      expect(result.similarity).toBeGreaterThanOrEqual(0.5);
      expect(result.similarity).toBeLessThanOrEqual(1);
    }

    // With a very high threshold, we might get no results or just the exact match
    const strictResults = bulkFindSimilar(queryParsed, molecules, 0.99, 2, 512);
    expect(Array.isArray(strictResults)).toBe(true);
  });

  it("bulkFilterDrugLike - filter molecules by drug-likeness criteria", () => {
    const results = bulkFilterDrugLike(molecules);

    expect(results.lipinskiPassers).toBeDefined();
    expect(results.veberPassers).toBeDefined();
    expect(results.bbbPassers).toBeDefined();
    expect(results.allPassers).toBeDefined();

    // All passers should be subsets of individual filters
    for (const passer of results.allPassers) {
      const foundInLipinski = results.lipinskiPassers.some(
        (p) => p.index === passer.index,
      );
      const foundInVeber = results.veberPassers.some(
        (p) => p.index === passer.index,
      );
      const foundInBBB = results.bbbPassers.some(
        (p) => p.index === passer.index,
      );

      expect(foundInLipinski).toBe(true);
      expect(foundInVeber).toBe(true);
      expect(foundInBBB).toBe(true);
    }

    // Small molecules like ethanol should pass most filters
    const ethanolIndex = 1;
    expect(results.lipinskiPassers.some((p) => p.index === ethanolIndex)).toBe(
      true,
    );
  });

  it("bulk operations preserve molecule order and indices", () => {
    const smarts = "[#6]";
    const result = bulkMatchSMARTS(smarts, molecules);

    for (let i = 0; i < molecules.length; i++) {
      expect(result.moleculeMatches[i]!.moleculeIndex).toBe(i);
    }
  });
});
