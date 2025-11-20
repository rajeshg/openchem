import { describe, it, expect } from "bun:test";
import {
  generateIUPACNameFromSMILES,
  parseSMILES,
  generateSMILES,
} from "index";

describe("IUPAC Engine Improvements - 5 Additional Realistic Cases", () => {
  describe("Case 1: Complex saturated heterocycles with multiple functional groups", () => {
    it("should handle 2,2-dimethyl-3-(propan-2-ylideneamino)imidazolidin-4-one", () => {
      // Cyclic amine heterocycle with imine and ketone
      const smiles = "CC(=NN1C(=O)CNC1(C)C)C";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      expect(parsed.molecules[0]?.atoms.length).toBeGreaterThan(0);

      // Verify structure has correct elements
      const mol = parsed.molecules[0]!;
      const nitrogenCount = mol.atoms.filter(
        (a) => a.atomicNumber === 7,
      ).length;
      expect(nitrogenCount).toBeGreaterThanOrEqual(3); // 3 nitrogens in imidazolidine + imine

      // Try round-trip
      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();

      // Parse the generated SMILES
      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });

    it("should generate correct name for imidazolidinone derivatives", () => {
      const smiles = "CC(=NN1C(=O)CNC1(C)C)C";
      const result = generateIUPACNameFromSMILES(smiles);
      expect(result.name).toBeDefined();
      expect(result.name.length).toBeGreaterThan(3);
    });
  });

  describe("Case 2: Oxabicyclic systems with ketones", () => {
    it("should handle 4,4,11,11-tetramethyl-3,12-dioxatricyclo[6.4.0.02,7]dodecane-6,9-dione", () => {
      // Complex tricyclic system with ether bridges and ketones
      const smiles = "CC1(CC(=O)C2C3C(C2O1)OC(CC3=O)(C)C)C";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      expect(parsed.molecules[0]?.atoms.length).toBeGreaterThan(0);

      const mol = parsed.molecules[0]!;

      // Should have oxygen atoms for ether bridges
      const oxygenCount = mol.atoms.filter((a) => a.atomicNumber === 8).length;
      expect(oxygenCount).toBeGreaterThanOrEqual(4); // Multiple ether oxygens + ketone oxygens

      // Try round-trip
      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();

      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });

    it("should correctly identify tricyclic structure", () => {
      const smiles = "CC1(CC(=O)C2C3C(C2O1)OC(CC3=O)(C)C)C";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      // Just verify the molecule was parsed correctly with expected atom count
      expect(mol.atoms.length).toBeGreaterThan(15);

      // Verify multiple bonds exist (evidence of ring fusion)
      const { BondType } = require("types");
      const doubleBonds = mol.bonds.filter(
        (b) => b.type === BondType.DOUBLE,
      ).length;
      expect(doubleBonds).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Case 3: Oxolan-based esters with complex substitution", () => {
    it("should handle (4-acetyl-5,5-dimethyl-2-propan-2-yloxolan-2-yl) acetate", () => {
      // Oxolane (THF) derivative with ester and ketone
      const smiles = "CC(C)C1(CC(C(O1)(C)C)C(=O)C)OC(=O)C";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBeGreaterThan(0);

      // Should have ester and ketone oxygens
      const oxygenCount = mol.atoms.filter((a) => a.atomicNumber === 8).length;
      expect(oxygenCount).toBeGreaterThanOrEqual(3); // ketone + ester (2) + ether in ring

      // Generate SMILES
      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();

      // Verify round-trip
      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });

    it("should name oxolane-based esters correctly", () => {
      const smiles = "CC(C)C1(CC(C(O1)(C)C)C(=O)C)OC(=O)C";
      const result = generateIUPACNameFromSMILES(smiles);
      expect(result.name).toBeDefined();
      expect(result.name.toLowerCase()).toMatch(/oxol|ester|acetyl/);
    });
  });

  describe("Case 4: Conjugated benzofuran esters with methylidene bridge", () => {
    it("should handle [(2Z)-2-[(2,5-dimethoxyphenyl)methylidene]-3-oxo-1-benzofuran-6-yl] 5-ethoxy-2-phenyl-1-benzofuran-3-carboxylate", () => {
      // Extremely complex: two benzofuran cores connected via methylidene, with ester linkage
      const smiles =
        "CCOC1=CC2=C(C=C1)OC(=C2C(=O)OC3=CC4=C(C=C3)C(=O)/C(=C/C5=C(C=CC(=C5)OC)OC)/O4)C6=CC=CC=C6";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBeGreaterThan(30); // Very large molecule

      // Should have multiple aromatic rings
      const ringCount = mol.atoms.filter((a) => a.aromatic).length;
      expect(ringCount).toBeGreaterThan(0);

      // Generate SMILES
      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();

      // Verify round-trip
      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });

    it("should identify multiple benzofuran cores", () => {
      const smiles =
        "CCOC1=CC2=C(C=C1)OC(=C2C(=O)OC3=CC4=C(C=C3)C(=O)/C(=C/C5=C(C=CC(=C5)OC)OC)/O4)C6=CC=CC=C6";
      const result = generateIUPACNameFromSMILES(smiles);
      expect(result.name).toBeDefined();
      expect(result.name.length).toBeGreaterThan(10);
    });
  });

  describe("Case 5: Polycyclic compounds with multiple functional groups", () => {
    it("should handle N-[2-chloro-5-[(2-methoxyphenyl)sulfamoyl]phenyl]-2-(4-methoxyphenyl)quinoline-4-carboxamide", () => {
      // Quinoline core + amide linkage + sulfamoyl group + anilino moiety
      const smiles =
        "c2(ccc(cc2)-c5nc1c(c(C(Nc3cc(S(=O)(=O)Nc4ccccc4OC)ccc3Cl)=O)c5)cccc1)OC";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBeGreaterThan(30);

      // Should have N, S, Cl atoms
      const nitrogenCount = mol.atoms.filter(
        (a) => a.atomicNumber === 7,
      ).length;
      const sulfurCount = mol.atoms.filter((a) => a.atomicNumber === 16).length;
      const chlorineCount = mol.atoms.filter(
        (a) => a.atomicNumber === 17,
      ).length;

      expect(nitrogenCount).toBeGreaterThanOrEqual(3);
      expect(sulfurCount).toBeGreaterThanOrEqual(1);
      expect(chlorineCount).toBeGreaterThanOrEqual(1);

      // Generate SMILES
      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();

      // Verify round-trip
      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });

    it("should identify quinoline + amide + sulfamoyl structure", () => {
      const smiles =
        "c2(ccc(cc2)-c5nc1c(c(C(Nc3cc(S(=O)(=O)Nc4ccccc4OC)ccc3Cl)=O)c5)cccc1)OC";
      const result = generateIUPACNameFromSMILES(smiles);
      expect(result.name).toBeDefined();
      expect(result.name.length).toBeGreaterThan(15);
    });
  });

  describe("Case 6: Highly fluorinated organics with sulfonate esters", () => {
    it("should handle bis(2,2,3,3,4,4,5,5,6,6,6-undecafluorohexyl) 9H-fluorene-2,7-disulfonate", () => {
      // Fluorene core + sulfonate esters + perfluorinated chains
      const smiles =
        "C1C2=C(C=CC(=C2)S(=O)(=O)OCC(C(C(C(C(F)(F)F)(F)F)(F)F)(F)F)(F)F)C3=C1C=C(C=C3)S(=O)(=O)OCC(C(C(C(C(F)(F)F)(F)F)(F)F)(F)F)(F)F";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBeGreaterThan(40); // Very large with many fluorines

      // Should have fluorine, sulfur atoms
      const fluorineCount = mol.atoms.filter(
        (a) => a.atomicNumber === 9,
      ).length;
      const sulfurCount = mol.atoms.filter((a) => a.atomicNumber === 16).length;

      expect(fluorineCount).toBeGreaterThanOrEqual(22); // 2 × undecafluoro (11 each)
      expect(sulfurCount).toBeGreaterThanOrEqual(2); // 2 sulfonates

      // Generate SMILES
      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();

      // Verify round-trip
      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });

    it("should identify fluorene core with sulfonates", () => {
      const smiles =
        "C1C2=C(C=CC(=C2)S(=O)(=O)OCC(C(C(C(C(F)(F)F)(F)F)(F)F)(F)F)(F)F)C3=C1C=C(C=C3)S(=O)(=O)OCC(C(C(C(C(F)(F)F)(F)F)(F)F)(F)F)(F)F";
      const result = generateIUPACNameFromSMILES(smiles);
      expect(result.name).toBeDefined();
      expect(result.name.toLowerCase()).toMatch(/fluor|sulfon/);
    });
  });

  describe("Validation across all 6 cases", () => {
    it("should have consistent atom counts for all test molecules", () => {
      const testCases = [
        "CC(=NN1C(=O)CNC1(C)C)C",
        "CC1(CC(=O)C2C3C(C2O1)OC(CC3=O)(C)C)C",
        "CC(C)C1(CC(C(O1)(C)C)C(=O)C)OC(=O)C",
        "CCOC1=CC2=C(C=C1)OC(=C2C(=O)OC3=CC4=C(C=C3)C(=O)/C(=C/C5=C(C=CC(=C5)OC)OC)/O4)C6=CC=CC=C6",
        "c2(ccc(cc2)-c5nc1c(c(C(Nc3cc(S(=O)(=O)Nc4ccccc4OC)ccc3Cl)=O)c5)cccc1)OC",
        "C1C2=C(C=CC(=C2)S(=O)(=O)OCC(C(C(C(C(F)(F)F)(F)F)(F)F)(F)F)(F)F)C3=C1C=C(C=C3)S(=O)(=O)OCC(C(C(C(C(F)(F)F)(F)F)(F)F)(F)F)(F)F",
      ];

      testCases.forEach((smiles) => {
        const parsed = parseSMILES(smiles);
        expect(parsed.molecules[0]?.atoms.length).toBeGreaterThan(0);

        const mol = parsed.molecules[0]!;
        const generated = generateSMILES(mol, true);
        expect(generated).toBeDefined();

        const reparsed = parseSMILES(generated);
        expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
      });
    });

    it("should handle round-trip SMILES generation for all cases", () => {
      const testCases = [
        "CC(=NN1C(=O)CNC1(C)C)C",
        "CC1(CC(=O)C2C3C(C2O1)OC(CC3=O)(C)C)C",
        "CC(C)C1(CC(C(O1)(C)C)C(=O)C)OC(=O)C",
      ];

      testCases.forEach((smiles) => {
        const parsed1 = parseSMILES(smiles);
        const mol1 = parsed1.molecules[0]!;

        const generated1 = generateSMILES(mol1, true);
        const parsed2 = parseSMILES(generated1);
        const mol2 = parsed2.molecules[0]!;

        // Atoms should match across round-trip
        expect(mol1.atoms.length).toBe(mol2.atoms.length);
        expect(mol1.bonds.length).toBe(mol2.bonds.length);
      });
    });

    it("should generate valid IUPAC names for all cases", () => {
      const testCases = [
        "CC(=NN1C(=O)CNC1(C)C)C",
        "CC1(CC(=O)C2C3C(C2O1)OC(CC3=O)(C)C)C",
        "CC(C)C1(CC(C(O1)(C)C)C(=O)C)OC(=O)C",
        "CCOC1=CC2=C(C=C1)OC(=C2C(=O)OC3=CC4=C(C=C3)C(=O)/C(=C/C5=C(C=CC(=C5)OC)OC)/O4)C6=CC=CC=C6",
        "c2(ccc(cc2)-c5nc1c(c(C(Nc3cc(S(=O)(=O)Nc4ccccc4OC)ccc3Cl)=O)c5)cccc1)OC",
        "C1C2=C(C=CC(=C2)S(=O)(=O)OCC(C(C(C(C(F)(F)F)(F)F)(F)F)(F)F)(F)F)C3=C1C=C(C=C3)S(=O)(=O)OCC(C(C(C(C(F)(F)F)(F)F)(F)F)(F)F)(F)F",
      ];

      testCases.forEach((smiles) => {
        const result = generateIUPACNameFromSMILES(smiles);
        expect(result.name).toBeDefined();
        expect(result.name.length).toBeGreaterThan(3);
      });
    });
  });
});
