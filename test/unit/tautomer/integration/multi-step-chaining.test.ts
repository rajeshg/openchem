import { parseSMILES } from "index";
import { enumerateTautomers } from "src/utils/tautomer/tautomer-enumerator";
import { describe, it, expect } from "bun:test";

describe("tautomer: multi-step chaining", () => {
  it("should produce multiple tautomers for pentane-2,4-dione", () => {
    const parsed = parseSMILES("CC(=O)CH2C(=O)C");
    if (!parsed || !parsed.molecules || parsed.molecules.length === 0)
      throw new Error("Failed to parse SMILES");
    const mol = parsed.molecules[0]!;
    const tautomers = enumerateTautomers(mol, {
      maxTautomers: 128,
    });

    // Should produce multiple tautomers through chained transformations
    expect(tautomers.length).toBeGreaterThanOrEqual(4);

    // Should include both keto forms and enol forms
    const smiles = tautomers.map((t) => t.smiles);
    const hasKetoForm = smiles.some((s) => s.includes("C(=O)"));
    const hasEnolForm = smiles.some((s) => s.includes("C(O)=C") || s.includes("C(=C)O"));

    expect(hasKetoForm).toBe(true);
    expect(hasEnolForm).toBe(true);
  });
});
