import { describe, expect, test } from "bun:test";
import { parseSMILES } from "index";
import {
  getMaxPartialCharge,
  getMinPartialCharge,
  getMaxAbsPartialCharge,
  getMinAbsPartialCharge,
} from "index";

describe("Phase 4 Charge Descriptors", () => {
  describe("Gasteiger Partial Charges", () => {
    test("aspirin - basic test", () => {
      const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;

      const maxCharge = getMaxPartialCharge(mol);
      const minCharge = getMinPartialCharge(mol);
      const maxAbs = getMaxAbsPartialCharge(mol);
      const minAbs = getMinAbsPartialCharge(mol);

      // Expected from RDKit (approximately):
      // MaxPartialCharge: 0.339
      // MinPartialCharge: -0.478
      // MaxAbsPartialCharge: 0.478
      // MinAbsPartialCharge: 0.339 (or close to 0)

      // Allow some tolerance for algorithm differences
      expect(maxCharge).toBeGreaterThan(0.2);
      expect(maxCharge).toBeLessThan(0.5);

      expect(minCharge).toBeLessThan(-0.3);
      expect(minCharge).toBeGreaterThan(-0.6);

      expect(maxAbs).toBeGreaterThan(0.3);
      expect(maxAbs).toBeLessThan(0.6);

      expect(minAbs).toBeGreaterThan(0);
      expect(minAbs).toBeLessThan(0.5);
    });

    test("benzene - symmetric molecule", () => {
      const mol = parseSMILES("c1ccccc1").molecules[0]!;

      const maxCharge = getMaxPartialCharge(mol);
      const minCharge = getMinPartialCharge(mol);
      const maxAbs = getMaxAbsPartialCharge(mol);
      const minAbs = getMinAbsPartialCharge(mol);

      // Benzene should have very small charges (nearly zero due to symmetry)
      expect(Math.abs(maxCharge)).toBeLessThan(0.1);
      expect(Math.abs(minCharge)).toBeLessThan(0.1);
      expect(maxAbs).toBeLessThan(0.1);
      expect(minAbs).toBeLessThan(0.1);
    });

    test("water - simple polar molecule (with explicit H)", () => {
      // Note: Water with implicit H has no bonds so charges are zero
      // Using explicit H notation to test charge distribution
      const mol = parseSMILES("[H]O[H]").molecules[0]!;

      const maxCharge = getMaxPartialCharge(mol);
      const minCharge = getMinPartialCharge(mol);

      // Oxygen should be negative, hydrogens positive
      expect(minCharge).toBeLessThan(0);
      expect(maxCharge).toBeGreaterThan(0);
    });

    test("methane - non-polar molecule", () => {
      const mol = parseSMILES("C").molecules[0]!;

      const maxCharge = getMaxPartialCharge(mol);
      const minCharge = getMinPartialCharge(mol);
      const maxAbs = getMaxAbsPartialCharge(mol);

      // Should have very small charges
      expect(Math.abs(maxCharge)).toBeLessThan(0.2);
      expect(Math.abs(minCharge)).toBeLessThan(0.2);
      expect(maxAbs).toBeLessThan(0.2);
    });

    test("caffeine - complex heterocycle", () => {
      const mol = parseSMILES("CN1C=NC2=C1C(=O)N(C(=O)N2C)C").molecules[0]!;

      const maxCharge = getMaxPartialCharge(mol);
      const minCharge = getMinPartialCharge(mol);
      const maxAbs = getMaxAbsPartialCharge(mol);
      const minAbs = getMinAbsPartialCharge(mol);

      // Should have significant charge separation
      expect(maxCharge).toBeGreaterThan(0.1);
      expect(minCharge).toBeLessThan(-0.1);
      expect(maxAbs).toBeGreaterThan(0.1);
      expect(minAbs).toBeGreaterThan(0);
    });

    test("acetone - carbonyl group", () => {
      const mol = parseSMILES("CC(=O)C").molecules[0]!;

      const maxCharge = getMaxPartialCharge(mol);
      const minCharge = getMinPartialCharge(mol);

      // Oxygen should be most negative, carbon next to O should be positive
      expect(minCharge).toBeLessThan(-0.2);
      expect(maxCharge).toBeGreaterThan(0.1);
    });

    test("formaldehyde - small polar molecule", () => {
      const mol = parseSMILES("C=O").molecules[0]!;

      const maxCharge = getMaxPartialCharge(mol);
      const minCharge = getMinPartialCharge(mol);

      // Oxygen negative, carbon positive
      expect(minCharge).toBeLessThan(-0.2);
      expect(maxCharge).toBeGreaterThan(0.1);
    });

    test("ethanol - polar molecule", () => {
      const mol = parseSMILES("CCO").molecules[0]!;

      const maxCharge = getMaxPartialCharge(mol);
      const minCharge = getMinPartialCharge(mol);

      // Should have moderate charge separation
      expect(minCharge).toBeLessThan(0);
      expect(maxCharge).toBeGreaterThan(0);
    });
  });

  describe("Charge Descriptor Relationships", () => {
    test("MaxAbsPartialCharge >= MinAbsPartialCharge", () => {
      const testCases = [
        "CC(=O)Oc1ccccc1C(=O)O", // aspirin
        "c1ccccc1", // benzene
        "O", // water
        "CC(=O)C", // acetone
        "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", // caffeine
      ];

      for (const smiles of testCases) {
        const mol = parseSMILES(smiles).molecules[0]!;
        const maxAbs = getMaxAbsPartialCharge(mol);
        const minAbs = getMinAbsPartialCharge(mol);
        expect(maxAbs).toBeGreaterThanOrEqual(minAbs);
      }
    });

    test("MaxAbsPartialCharge is max of |MaxPartialCharge| and |MinPartialCharge|", () => {
      const testCases = [
        "CC(=O)Oc1ccccc1C(=O)O", // aspirin
        "O", // water
        "CC(=O)C", // acetone
      ];

      for (const smiles of testCases) {
        const mol = parseSMILES(smiles).molecules[0]!;
        const maxCharge = getMaxPartialCharge(mol);
        const minCharge = getMinPartialCharge(mol);
        const maxAbs = getMaxAbsPartialCharge(mol);

        const expected = Math.max(Math.abs(maxCharge), Math.abs(minCharge));
        expect(Math.abs(maxAbs - expected)).toBeLessThan(0.001);
      }
    });
  });
});
