import { describe, it, expect } from "bun:test";
import { parseSMILES, generateSMILES } from "index";

describe("Cyclic Ethers - SMILES Round-Trip Validation", () => {
  // Core test cases from realistic dataset - strict SMILES validation
  const testCases = [
    {
      name: "Tetrahydrofuran (oxolane)",
      smiles: "C1CCCO1",
      expectedAtoms: 5,
      expectedBonds: 5,
    },
    {
      name: "Tetrahydropyran (oxane)",
      smiles: "C1CCCCO1",
      expectedAtoms: 6,
      expectedBonds: 6,
    },
    {
      name: "1,4-Dioxane",
      smiles: "C1COCCOC1",
      expectedAtoms: 7,
      expectedBonds: 7,
    },
    {
      name: "1,3-Dioxolane",
      smiles: "O1CCOC1",
      expectedAtoms: 5,
      expectedBonds: 5,
    },
    {
      name: "1,3-Dioxane",
      smiles: "C1CCOCC1",
      expectedAtoms: 6,
      expectedBonds: 6,
    },
    {
      name: "2-Methyloxolane",
      smiles: "CC1CCCO1",
      expectedAtoms: 6,
      expectedBonds: 6,
    },
    {
      name: "2,2-Dimethyloxolane",
      smiles: "CC1(C)CCCO1",
      expectedAtoms: 7,
      expectedBonds: 7,
    },
    {
      name: "Oxolane-2-one (gamma-butyrolactone)",
      smiles: "O=C1CCCO1",
      expectedAtoms: 6,
      expectedBonds: 6,
    },
    {
      name: "Oxan-2-one (delta-valerolactone)",
      smiles: "O=C1CCCCO1",
      expectedAtoms: 7,
      expectedBonds: 7,
    },
  ];

  describe("Parsing and structure validation", () => {
    testCases.forEach((testCase) => {
      it(`should correctly parse ${testCase.name}`, () => {
        const parsed = parseSMILES(testCase.smiles);
        expect(parsed.molecules.length).toBe(1);
        const mol = parsed.molecules[0]!;
        expect(mol.atoms.length).toBe(testCase.expectedAtoms);
        expect(mol.bonds.length).toBe(testCase.expectedBonds);
      });
    });
  });

  describe("SMILES round-trip validation", () => {
    testCases.forEach((testCase) => {
      it(`should preserve ${testCase.name} through round-trip conversion`, () => {
        // Parse original SMILES
        const parsed1 = parseSMILES(testCase.smiles);
        const mol1 = parsed1.molecules[0]!;

        // Generate canonical SMILES
        const generated1 = generateSMILES(mol1, true);
        expect(generated1).toBeDefined();

        // Re-parse generated SMILES
        const parsed2 = parseSMILES(generated1);
        const mol2 = parsed2.molecules[0]!;

        // Generate again to verify canonicalization
        const generated2 = generateSMILES(mol2, true);

        // Both should be identical (canonical form)
        expect(generated2).toBe(generated1);

        // Atom and bond counts must match
        expect(mol2.atoms.length).toBe(mol1.atoms.length);
        expect(mol2.bonds.length).toBe(mol1.bonds.length);
      });
    });
  });

  describe("Complex cyclic ether cases", () => {
    it("should handle fused benzofuran system", () => {
      const smiles = "c1ccc2occc2c1"; // benzofuran
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      // Verify aromatic structure
      const aromaticAtoms = mol.atoms.filter((a) => a.aromatic);
      expect(aromaticAtoms.length).toBeGreaterThan(0);

      // Round-trip test
      const generated = generateSMILES(mol, true);
      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });

    it("should handle 1,4-dioxane correctly", () => {
      const smiles = "C1COCCOC1";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      // Should have 2 oxygen atoms
      const oxygens = mol.atoms.filter((a) => a.atomicNumber === 8);
      expect(oxygens.length).toBe(2);

      // Round-trip
      const generated1 = generateSMILES(mol, true);
      const reparsed = parseSMILES(generated1);
      const generated2 = generateSMILES(reparsed.molecules[0]!, true);

      expect(generated1).toBe(generated2);
    });

    it("should handle 1,3-dioxolane correctly", () => {
      const smiles = "O1CCOC1";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      // Should have 2 oxygen atoms in 5-membered ring
      const oxygens = mol.atoms.filter((a) => a.atomicNumber === 8);
      expect(oxygens.length).toBe(2);

      // 5-membered ring
      expect(mol.atoms.length).toBe(5);

      const generated = generateSMILES(mol, true);
      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(5);
    });
  });

  describe("Chemical validity", () => {
    testCases.forEach((testCase) => {
      it(`${testCase.name} should maintain valence through round-trip`, () => {
        const parsed1 = parseSMILES(testCase.smiles);
        const mol1 = parsed1.molecules[0]!;

        const generated = generateSMILES(mol1, true);
        const parsed2 = parseSMILES(generated);
        const mol2 = parsed2.molecules[0]!;

        // Check that all atoms still have valid degree
        mol2.atoms.forEach((atom) => {
          if (atom.degree !== undefined) {
            expect(atom.degree).toBeGreaterThan(0);
            expect(atom.degree).toBeLessThanOrEqual(4); // Max 4 for carbon
          }
        });
      });
    });
  });
});
