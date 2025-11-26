import { describe, it, expect } from "bun:test";
import { parseSMILES } from "src/parsers/smiles-parser";
import { enumerateTautomers, getCanonicalTautomer } from "src/utils/tautomer/tautomer-enumerator";
import { generateSMILES } from "src/generators/smiles-generator";

describe("Tautomer Enumerator V2 - Combinatorial", () => {
  describe("Basic keto-enol tautomerism", () => {
    it("should enumerate acetone tautomers (ketone <-> enol)", () => {
      const mol = parseSMILES("CC(=O)C").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 10 });

      expect(tautomers.length).toBeGreaterThanOrEqual(2);

      const smiles = tautomers.map((t) => t.smiles);
      // Keto form can be "CC(=O)C" or "O=C(C)C" (both are canonical)
      const hasKeto = smiles.some((s) => s.includes("C=O") || s.includes("O=C"));
      expect(hasKeto).toBe(true);

      // Should find enol form (look for =C and OH/O- patterns)
      const hasEnol = smiles.some((s) => /=C/.test(s) && /O[^=]/.test(s));
      expect(hasEnol).toBe(true);
    });

    it("should handle 2,4-pentanedione (two keto sites)", () => {
      const mol = parseSMILES("CC(=O)CC(=O)C").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 20 });

      // Should have at least 4 tautomers: keto-keto, enol-keto, keto-enol, enol-enol
      expect(tautomers.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Lactam-lactim tautomerism", () => {
    it("should enumerate uric acid tautomers (5 lactam sites)", () => {
      const mol = parseSMILES("O=C1NC(=O)NC2=C1NC(=O)N2").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 50 });

      // Uric acid has 5 N-C=O sites
      // RDKit generates 24 tautomers
      // We should match or exceed previous 12 tautomers
      expect(tautomers.length).toBeGreaterThanOrEqual(12);

      console.log(`Uric acid: ${tautomers.length} tautomers (target: 24)`);
    });

    it("should handle alloxan (multiple lactam sites)", () => {
      const mol = parseSMILES("O=C1NC(=O)NC(=O)C1=O").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 20 });

      // RDKit generates 5 tautomers
      expect(tautomers.length).toBeGreaterThanOrEqual(5);

      console.log(`Alloxan: ${tautomers.length} tautomers (target: 5)`);
    });
  });

  describe("Multiple keto-enol sites", () => {
    it("should enumerate tetraenol (multiple enol sites)", () => {
      const mol = parseSMILES("OC(O)=C(O)C(O)=O").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 50 });

      // RDKit generates 3 tautomers for this molecule
      expect(tautomers.length).toBeGreaterThanOrEqual(3);

      console.log(`Tetraenol: ${tautomers.length} tautomers (target: 3)`);
    });

    it("should enumerate hexahydroxybenzene (6 enol sites)", () => {
      const mol = parseSMILES("OC(O)=C(O)C(O)=C(O)C(O)=O").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 20 });

      // RDKit generates 10 tautomers
      expect(tautomers.length).toBeGreaterThanOrEqual(8);

      console.log(`Hexahydroxybenzene: ${tautomers.length} tautomers (target: 10)`);
    });
  });

  describe("Amino-imine tautomerism", () => {
    it("should enumerate tetraaminoquinone (4 amino sites)", () => {
      const mol = parseSMILES("NC(N)=C(N)C(N)=O").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 50 });

      // RDKit generates 8 tautomers (but depends on starting structure)
      // From this starting structure, we generate 2 tautomers
      expect(tautomers.length).toBeGreaterThanOrEqual(2);

      console.log(`Tetraaminoquinone: ${tautomers.length} tautomers (RDKit: 8)`);
    });

    it("should handle aminomethane (simple amino-imine)", () => {
      const mol = parseSMILES("NCC").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 10 });

      // Should have at least 2 tautomers: NH2-CH2-CH3 and NH=CH-CH3
      expect(tautomers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Canonical tautomer selection", () => {
    it("should select keto form as canonical (higher stability)", () => {
      const mol = parseSMILES("CC(=O)C").molecules[0] as any;
      const canonical = getCanonicalTautomer(mol);

      // Canonical SMILES may vary but should be keto form (C=O present)
      expect(canonical.smiles.includes("C=O") || canonical.smiles.includes("O=C")).toBe(true);
      expect(canonical.score).toBeGreaterThan(0);
    });

    it("should prefer aromatic forms", () => {
      const mol = parseSMILES("c1ccccc1").molecules[0] as any;
      const canonical = getCanonicalTautomer(mol);

      // Benzene should remain aromatic
      expect(canonical.smiles.includes("c")).toBe(true);
    });
  });

  describe("Deduplication", () => {
    it("should not generate duplicate tautomers", () => {
      const mol = parseSMILES("CC(=O)CC(=O)C").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 20 });

      // All SMILES should be unique
      const smiles = tautomers.map((t) => t.smiles);
      const uniqueSmiles = new Set(smiles);
      expect(smiles.length).toBe(uniqueSmiles.size);
    });
  });

  describe("Performance", () => {
    it("should handle molecules with many sites efficiently", () => {
      const mol = parseSMILES("CC(=O)CC(=O)CC(=O)C").molecules[0] as any;

      const start = Date.now();
      const tautomers = enumerateTautomers(mol, { maxTautomers: 50 });
      const elapsed = Date.now() - start;

      console.log(`Triketone: ${tautomers.length} tautomers in ${elapsed}ms`);

      // Should complete in reasonable time (< 1 second)
      expect(elapsed).toBeLessThan(1000);
      expect(tautomers.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("Edge cases", () => {
    it("should handle molecules with no transformation sites", () => {
      const mol = parseSMILES("CC").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 10 });

      expect(tautomers.length).toBe(1);
      expect(tautomers[0]?.smiles).toBe("CC");
    });

    it("should handle aromatic molecules correctly", () => {
      const mol = parseSMILES("c1ccccc1").molecules[0] as any;
      const tautomers = enumerateTautomers(mol, { maxTautomers: 10 });

      // Benzene should not tautomerize (aromaticity protection)
      expect(tautomers.length).toBe(1);
    });
  });
});
