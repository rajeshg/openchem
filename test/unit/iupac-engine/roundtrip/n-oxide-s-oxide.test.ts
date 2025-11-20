import { describe, it, expect } from "bun:test";
import { parseSMILES, generateSMILES } from "index";

describe("N-oxide and S-oxide Compounds - SMILES Round-Trip Validation", () => {
  const testCases = [
    {
      name: "Dimethyl sulfoxide (DMSO)",
      smiles: "CS(=O)C",
      expectedAtoms: 4,
      expectedBonds: 3,
      expectedElementCount: { C: 2, S: 1, O: 1 },
    },
    {
      name: "Dimethyl sulfone",
      smiles: "CS(=O)(=O)C",
      expectedAtoms: 5,
      expectedBonds: 4,
      expectedElementCount: { C: 2, S: 1, O: 2 },
    },
    {
      name: "Triethylamine N-oxide",
      smiles: "CCN(CC)(CC)=O",
      expectedAtoms: 8,
      expectedBonds: 7,
    },
    {
      name: "Diethyl sulfoxide",
      smiles: "CCS(=O)CC",
      expectedAtoms: 6,
      expectedBonds: 5,
    },
    {
      name: "Phenyl methyl sulfoxide",
      smiles: "CS(=O)c1ccccc1",
      expectedAtoms: 9,
      expectedBonds: 9,
    },
    {
      name: "Diphenyl sulfone",
      smiles: "c1ccccc1S(=O)(=O)c2ccccc2",
      expectedAtoms: 15,
      expectedBonds: 16,
    },
    {
      name: "Methyl phenyl sulfone",
      smiles: "CS(=O)(=O)c1ccccc1",
      expectedAtoms: 10,
      expectedBonds: 10,
    },
    {
      name: "Thiophene 1-oxide",
      smiles: "c1ccsc1",
      expectedAtoms: 5,
      expectedBonds: 5,
    },
    {
      name: "Pyridine",
      smiles: "c1ccncc1",
      expectedAtoms: 6,
      expectedBonds: 6,
    },
  ];

  describe("Parsing and atom/bond structure", () => {
    testCases.forEach((testCase) => {
      it(`should parse ${testCase.name} with correct atom count`, () => {
        const parsed = parseSMILES(testCase.smiles);
        expect(parsed.molecules.length).toBe(1);
        const mol = parsed.molecules[0]!;
        expect(mol.atoms.length).toBe(testCase.expectedAtoms);
        expect(mol.bonds.length).toBe(testCase.expectedBonds);
      });
    });
  });

  describe("Round-trip SMILES canonicalization", () => {
    testCases.forEach((testCase) => {
      it(`should stabilize ${testCase.name} after round-trip`, () => {
        // First parse
        const parsed1 = parseSMILES(testCase.smiles);
        const mol1 = parsed1.molecules[0]!;

        // First generation
        const smiles1 = generateSMILES(mol1, true);
        expect(smiles1).toBeDefined();

        // Second parse
        const parsed2 = parseSMILES(smiles1);
        const mol2 = parsed2.molecules[0]!;

        // Second generation
        const smiles2 = generateSMILES(mol2, true);

        // Third generation should equal second (stable)
        const parsed3 = parseSMILES(smiles2);
        const mol3 = parsed3.molecules[0]!;
        const smiles3 = generateSMILES(mol3, true);

        expect(smiles3).toBe(smiles2);
      });
    });
  });

  describe("Element composition validation", () => {
    testCases
      .filter((tc) => tc.expectedElementCount)
      .forEach((testCase) => {
        it(`${testCase.name} should have correct element composition`, () => {
          const parsed = parseSMILES(testCase.smiles);
          const mol = parsed.molecules[0]!;

          const expected = testCase.expectedElementCount!;

          // Count elements
          const counts: { [key: string]: number } = {};
          mol.atoms.forEach((atom) => {
            counts[atom.symbol] = (counts[atom.symbol] || 0) + 1;
          });

          Object.entries(expected).forEach(([element, count]) => {
            expect(counts[element]).toBe(count);
          });
        });
      });
  });

  describe("Sulfoxide vs sulfone differentiation", () => {
    it("should differentiate dimethyl sulfoxide from dimethyl sulfone", () => {
      const sulfoxide = parseSMILES("CS(=O)C").molecules[0]!;
      const sulfone = parseSMILES("CS(=O)(=O)C").molecules[0]!;

      // Sulfoxide has 1 oxygen, sulfone has 2
      const sulfoxideOxygens = sulfoxide.atoms.filter(
        (a) => a.atomicNumber === 8,
      ).length;
      const sulfoneOxygens = sulfone.atoms.filter(
        (a) => a.atomicNumber === 8,
      ).length;

      expect(sulfoxideOxygens).toBe(1);
      expect(sulfoneOxygens).toBe(2);

      // Verify round-trip preserves difference
      const sulfoxideSmiles = generateSMILES(sulfoxide, true);
      const sulfoneSmiles = generateSMILES(sulfone, true);

      expect(sulfoxideSmiles).not.toBe(sulfoneSmiles);

      // Re-parse and verify identity
      const reparsedSulfoxide = parseSMILES(sulfoxideSmiles).molecules[0]!;
      const reparsedSulfone = parseSMILES(sulfoneSmiles).molecules[0]!;

      expect(
        reparsedSulfoxide.atoms.filter((a) => a.atomicNumber === 8).length,
      ).toBe(1);
      expect(
        reparsedSulfone.atoms.filter((a) => a.atomicNumber === 8).length,
      ).toBe(2);
    });
  });

  describe("Aromatic vs aliphatic sulfur compounds", () => {
    it("should preserve aromaticity in thiophene", () => {
      const smiles = "c1ccsc1";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      const aromaticAtoms = mol.atoms.filter((a) => a.aromatic);
      expect(aromaticAtoms.length).toBe(5); // 4 carbons + 1 sulfur aromatic

      // Round-trip should preserve aromaticity
      const generated = generateSMILES(mol, true);
      const reparsed = parseSMILES(generated).molecules[0]!;

      const rearomaticAtoms = reparsed.atoms.filter((a) => a.aromatic);
      expect(rearomaticAtoms.length).toBe(5);
    });

    it("should preserve aromaticity in pyridine", () => {
      const smiles = "c1ccncc1";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      const aromaticAtoms = mol.atoms.filter((a) => a.aromatic);
      expect(aromaticAtoms.length).toBe(6); // All aromatic

      // Round-trip
      const generated = generateSMILES(mol, true);
      const reparsed = parseSMILES(generated).molecules[0]!;

      const rearomaticAtoms = reparsed.atoms.filter((a) => a.aromatic);
      expect(rearomaticAtoms.length).toBe(6);
    });
  });

  describe("Connectivity validation", () => {
    it("dimethyl sulfoxide should have S bonded to 2 carbons", () => {
      const mol = parseSMILES("CS(=O)C").molecules[0]!;
      const sulfur = mol.atoms.find((a) => a.atomicNumber === 16);
      expect(sulfur).toBeDefined();

      const sulfurBonds = mol.bonds.filter(
        (b) => b.atom1 === sulfur!.id || b.atom2 === sulfur!.id,
      );
      expect(sulfurBonds.length).toBe(3); // 2 C-S + 1 S=O
    });

    it("dimethyl sulfone should have S bonded to 2 carbons and 2 oxygens", () => {
      const mol = parseSMILES("CS(=O)(=O)C").molecules[0]!;
      const sulfur = mol.atoms.find((a) => a.atomicNumber === 16);
      expect(sulfur).toBeDefined();

      const sulfurBonds = mol.bonds.filter(
        (b) => b.atom1 === sulfur!.id || b.atom2 === sulfur!.id,
      );
      expect(sulfurBonds.length).toBe(4); // 2 C-S + 2 S=O
    });
  });
});
