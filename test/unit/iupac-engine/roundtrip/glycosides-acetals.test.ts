import { describe, it, expect } from "bun:test";
import { parseSMILES, generateSMILES } from "index";

describe("Glycosides and Acetals - SMILES Round-Trip Validation", () => {
  const testCases = [
    {
      name: "1,1-Dimethoxymethane (simple acetal)",
      smiles: "COC(OC)C",
      expectedAtoms: 6,
      expectedOxygens: 2,
    },
    {
      name: "1,1-Dimethoxyethane",
      smiles: "CC(OC)OC",
      expectedAtoms: 6,
      expectedOxygens: 2,
    },
    {
      name: "1,1-Diethoxyethane",
      smiles: "CC(OCC)OCC",
      expectedAtoms: 8,
      expectedOxygens: 2,
    },
    {
      name: "1,3-Dioxolane (5-membered acetal)",
      smiles: "O1CCOC1",
      expectedAtoms: 5,
      expectedOxygens: 2,
    },
    {
      name: "2-Methyl-1,3-dioxolane",
      smiles: "CC1OCCO1",
      expectedAtoms: 6,
      expectedOxygens: 2,
    },
    {
      name: "1,3-Dioxane (6-membered acetal)",
      smiles: "O1CCOC(C)C1",
      expectedAtoms: 7,
      expectedOxygens: 2,
    },
    {
      name: "2-Methyl-1,3-dioxane",
      smiles: "CC1OCOCC1",
      expectedAtoms: 7,
      expectedOxygens: 2,
    },
    {
      name: "1,4-Dioxane",
      smiles: "C1COCCOC1",
      expectedAtoms: 7,
      expectedOxygens: 2,
    },
    {
      name: "Paraldehyde (2,4,6-trimethyl-1,3,5-trioxane)",
      smiles: "CC1OC(C)OC(C)O1",
      expectedAtoms: 9,
      expectedOxygens: 3,
    },
    {
      name: "Trimethyl orthoformate",
      smiles: "COC(OC)OC",
      expectedAtoms: 7,
      expectedOxygens: 3,
    },
  ];

  describe("Basic parsing and atom counts", () => {
    testCases.forEach((testCase) => {
      it(`should parse ${testCase.name}`, () => {
        const parsed = parseSMILES(testCase.smiles);
        expect(parsed.molecules.length).toBe(1);
        const mol = parsed.molecules[0]!;
        expect(mol.atoms.length).toBe(testCase.expectedAtoms);
      });
    });
  });

  describe("Oxygen content validation", () => {
    testCases
      .filter((tc) => tc.expectedOxygens)
      .forEach((testCase) => {
        it(`${testCase.name} should contain ${testCase.expectedOxygens} oxygens`, () => {
          const mol = parseSMILES(testCase.smiles).molecules[0]!;
          const oxygenCount = mol.atoms.filter((a) => a.atomicNumber === 8).length;
          expect(oxygenCount).toBe(testCase.expectedOxygens);
        });
      });
  });

  describe("SMILES round-trip and canonicalization", () => {
    testCases.forEach((testCase) => {
      it(`${testCase.name} should reach stable SMILES form`, () => {
        const parsed1 = parseSMILES(testCase.smiles);
        const mol1 = parsed1.molecules[0]!;

        const generated1 = generateSMILES(mol1, true);
        const parsed2 = parseSMILES(generated1);
        const mol2 = parsed2.molecules[0]!;

        const generated2 = generateSMILES(mol2, true);

        expect(generated1).toBe(generated2);
        expect(mol1.atoms.length).toBe(mol2.atoms.length);
      });
    });
  });

  describe("Distinguish acetal types", () => {
    it("should differentiate 1,3-dioxolane from 1,4-dioxolane", () => {
      const dioxolane13 = parseSMILES("O1CCOC1").molecules[0]!;
      const dioxane14 = parseSMILES("C1COCCOC1").molecules[0]!;

      // 1,3-dioxolane: 5 atoms, 2 oxygens
      // 1,4-dioxane: 7 atoms, 2 oxygens
      expect(dioxolane13.atoms.length).toBe(5);
      expect(dioxane14.atoms.length).toBe(7);
    });

    it("should differentiate 1,3-dioxane from 1,4-dioxane", () => {
      const dioxane13 = parseSMILES("O1CCOC(C)C1").molecules[0]!;
      const dioxane14 = parseSMILES("C1COCCOC1").molecules[0]!;

      // Both 6-7 membered, 2 oxygens each
      expect(dioxane13.atoms.length).toBe(7);
      expect(dioxane14.atoms.length).toBe(7);

      const dioxane13Smiles = generateSMILES(dioxane13, true);
      const dioxane14Smiles = generateSMILES(dioxane14, true);

      // Should generate different SMILES
      expect(dioxane13Smiles).not.toBe(dioxane14Smiles);
    });

    it("should differentiate orthoformate from dioxolane", () => {
      const orthoformate = parseSMILES("COC(OC)OC").molecules[0]!;
      const dioxolane = parseSMILES("O1CCOC1").molecules[0]!;

      // Orthoformate: 7 atoms, 3 oxygens
      // Dioxolane: 5 atoms, 2 oxygens
      const orthoformatOxygens = orthoformate.atoms.filter((a) => a.atomicNumber === 8).length;
      const dioxolaneOxygens = dioxolane.atoms.filter((a) => a.atomicNumber === 8).length;

      expect(orthoformatOxygens).toBe(3);
      expect(dioxolaneOxygens).toBe(2);
    });
  });

  describe("Ring structure preservation", () => {
    it("1,3-dioxolane should be 5-membered ring", () => {
      const mol = parseSMILES("O1CCOC1").molecules[0]!;
      expect(mol.atoms.length).toBe(5);
      expect(mol.bonds.length).toBe(5); // Cyclic: atoms = bonds
    });

    it("1,3-dioxane should be 6-membered ring", () => {
      const mol = parseSMILES("O1CCOC(C)C1").molecules[0]!;
      expect(mol.atoms.length).toBe(7);
      expect(mol.bonds.length).toBe(7); // Cyclic
    });

    it("paraldehyde should be 6-membered ring with 3 methyls", () => {
      const mol = parseSMILES("CC1OC(C)OC(C)O1").molecules[0]!;
      expect(mol.atoms.length).toBe(9); // 6 ring + 3 methyls outside ring
      expect(mol.bonds.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe("Bond connectivity in acetals", () => {
    it("1,3-dioxolane should have 2 C-O and 3 C-C bonds", () => {
      const mol = parseSMILES("O1CCOC1").molecules[0]!;

      const carbonOxygenBonds = mol.bonds.filter((b) => {
        const atom1 = mol.atoms[b.atom1];
        const atom2 = mol.atoms[b.atom2];
        if (!atom1 || !atom2) return false;
        return (
          (atom1.atomicNumber === 6 && atom2.atomicNumber === 8) ||
          (atom1.atomicNumber === 8 && atom2.atomicNumber === 6)
        );
      });

      expect(carbonOxygenBonds.length).toBeGreaterThanOrEqual(2);
    });

    it("paraldehyde should have all C-O-C ether linkages", () => {
      const mol = parseSMILES("CC1OCC(C)OC1").molecules[0]!;

      const etherBonds = mol.bonds.filter((b) => {
        const atom1 = mol.atoms[b.atom1];
        const atom2 = mol.atoms[b.atom2];
        if (!atom1 || !atom2) return false;
        return (
          (atom1.atomicNumber === 6 && atom2.atomicNumber === 8) ||
          (atom1.atomicNumber === 8 && atom2.atomicNumber === 6)
        );
      });

      // 3 ether linkages in trioxane
      expect(etherBonds.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Complex acetal structures", () => {
    it("should handle methylated dioxolane", () => {
      const mol = parseSMILES("CC1OCCO1").molecules[0]!;
      expect(mol.atoms.length).toBe(6); // 5 ring + 1 methyl
      expect(mol.atoms.filter((a) => a.atomicNumber === 8).length).toBe(2);

      const generated = generateSMILES(mol, true);
      const reparsed = parseSMILES(generated).molecules[0]!;
      expect(reparsed.atoms.length).toBe(6);
    });

    it("should handle methylated dioxane", () => {
      const mol = parseSMILES("CC1OCOCC1").molecules[0]!;
      expect(mol.atoms.length).toBe(7); // 6 ring + 1 methyl
      expect(mol.atoms.filter((a) => a.atomicNumber === 8).length).toBe(2);

      const generated = generateSMILES(mol, true);
      const reparsed = parseSMILES(generated).molecules[0]!;
      expect(reparsed.atoms.length).toBe(7);
    });

    it("should handle orthoformate", () => {
      const mol = parseSMILES("COC(OC)OC").molecules[0]!;
      expect(mol.atoms.length).toBe(7); // C(OMe)3
      expect(mol.atoms.filter((a) => a.atomicNumber === 8).length).toBe(3);

      const generated = generateSMILES(mol, true);
      const reparsed = parseSMILES(generated).molecules[0]!;
      expect(reparsed.atoms.length).toBe(7);
    });
  });
});
