/**
 * Comprehensive tests for molecular orientation with complex molecules
 * Tests large molecules, fused rings, bridged systems, and real drugs
 */

import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { generateCoordinatesV2 } from "src/generators/coordinate-generator";

function getAspectRatio(coords: Map<number, { x: number; y: number }>): number {
  if (coords.size === 0) return 1.0;
  if (coords.size === 1) return 1.0;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const coord of coords.values()) {
    minX = Math.min(minX, coord.x);
    maxX = Math.max(maxX, coord.x);
    minY = Math.min(minY, coord.y);
    maxY = Math.max(maxY, coord.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  if (height < 1e-6 && width > 1e-6) return Infinity;
  if (width < 1e-6 && height > 1e-6) return 0;
  if (width < 1e-6 && height < 1e-6) return 1.0;

  return width / height;
}

describe("Complex Molecule Orientation Tests", () => {
  describe("Large Polycyclic Aromatic Hydrocarbons (PAHs)", () => {
    it("should orient pyrene (4 fused rings) horizontally", () => {
      const result = parseSMILES("c1cc2ccc3cccc4ccc(c1)c2c34");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Pyrene is a compact 4-ring system, should be roughly square to horizontal
      expect(aspectRatio).toBeGreaterThan(0.8);
      expect(coords.size).toBe(16);
    });

    it("should orient tetracene (4 linear rings) horizontally", () => {
      const result = parseSMILES("c1ccc2cc3cc4ccccc4cc3cc2c1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Tetracene is 4 linearly fused rings, should be very horizontal
      expect(aspectRatio).toBeGreaterThan(2.5);
      expect(coords.size).toBe(18);
    });

    it("should orient pentacene (5 linear rings) horizontally", () => {
      const result = parseSMILES("c1ccc2cc3cc4cc5ccccc5cc4cc3cc2c1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Pentacene is 5 linearly fused rings, should be extremely horizontal
      expect(aspectRatio).toBeGreaterThan(3.0);
      expect(coords.size).toBe(22);
    });

    it("should orient chrysene (4 fused rings, angular) appropriately", () => {
      const result = parseSMILES("c1ccc2c(c1)ccc3c2ccc4ccccc43");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Chrysene is angular, should be horizontal to square
      expect(aspectRatio).toBeGreaterThan(1.0);
      expect(coords.size).toBe(18);
    });
  });

  describe("Bridged Ring Systems", () => {
    it("should orient adamantane (bridged tricyclic) appropriately", () => {
      const result = parseSMILES("C1C2CC3CC1CC(C2)C3");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Adamantane is compact and symmetric, should be roughly square
      expect(aspectRatio).toBeGreaterThan(0.5);
      expect(aspectRatio).toBeLessThan(2.0);
      expect(coords.size).toBe(10);
    });

    it("should orient norbornane (bicyclic bridged) appropriately", () => {
      const result = parseSMILES("C1CC2CCC1C2");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Norbornane is compact, should be roughly compact
      // Note: Improved seed selection may produce slightly wider orientations
      expect(aspectRatio).toBeGreaterThan(0.6);
      expect(aspectRatio).toBeLessThan(2.1);
      expect(coords.size).toBe(7);
    });

    it("should orient cubane (highly symmetric cage) appropriately", () => {
      const result = parseSMILES("C12C3C4C1C5C4C3C25");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Cubane is perfectly symmetric cube, should be roughly square
      expect(aspectRatio).toBeGreaterThan(0.7);
      expect(aspectRatio).toBeLessThan(2.0);
      expect(coords.size).toBe(8);
    });
  });

  describe("Spiro Compounds", () => {
    it("should orient spiro[4.5]decane appropriately", () => {
      const result = parseSMILES("C1CCC2(C1)CCCCC2");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Spiro compound, two rings sharing one atom
      expect(aspectRatio).toBeGreaterThan(0.5);
      expect(aspectRatio).toBeLessThan(2.5);
      expect(coords.size).toBe(10);
    });

    it("should orient spiro[5.5]undecane appropriately", () => {
      const result = parseSMILES("C1CCCC2(C1)CCCCC2");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Spiro compound with two 6-membered rings
      expect(aspectRatio).toBeGreaterThan(0.6);
      expect(aspectRatio).toBeLessThan(2.0);
      expect(coords.size).toBe(11);
    });
  });

  describe("Complex Drug Molecules", () => {
    it("should orient caffeine appropriately", () => {
      const result = parseSMILES("CN1C=NC2=C1C(=O)N(C(=O)N2C)C");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Caffeine has fused rings with substituents
      expect(aspectRatio).toBeGreaterThan(0.7);
      expect(aspectRatio).toBeLessThan(2.5);
      expect(coords.size).toBe(14);
    });

    it("should orient codeine (morphine derivative, 5 fused rings) appropriately", () => {
      const result = parseSMILES("COc1ccc2c3c1O[C@H]4[C@@H]5[C@H]3CC[C@@]24CCN5C");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Codeine is complex polycyclic, expect reasonable orientation
      expect(coords.size).toBe(mol.atoms.length);
      expect(aspectRatio).toBeGreaterThan(0.5);
      expect(aspectRatio).toBeLessThan(3.0);
    });

    it("should orient testosterone (steroid, 4 fused rings) appropriately", () => {
      const result = parseSMILES("C[C@]12CC[C@H]3[C@H]([C@@H]1CC[C@@H]2O)CCC4=CC(=O)CC[C@]34C");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Testosterone is a steroid (4 fused rings), should be horizontal
      expect(coords.size).toBe(mol.atoms.length);
      expect(aspectRatio).toBeGreaterThan(1.0);
    });

    it("should orient ibuprofen (benzene + branched chain)", () => {
      const result = parseSMILES("CC(C)Cc1ccc(cc1)C(C)C(=O)O");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Ibuprofen: ring with side chains
      expect(coords.size).toBe(mol.atoms.length);
      expect(aspectRatio).toBeGreaterThan(0.5);
      expect(aspectRatio).toBeLessThan(2.5);
    });

    it("should orient paracetamol (acetaminophen) appropriately", () => {
      const result = parseSMILES("CC(=O)Nc1ccc(cc1)O");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Paracetamol: benzene with linear substituents, oriented horizontally
      expect(coords.size).toBe(mol.atoms.length);
      expect(aspectRatio).toBeGreaterThan(1.5);
      expect(aspectRatio).toBeLessThan(3.5);
    });
  });

  describe("Large Molecules (50+ atoms)", () => {
    it("should handle cholesterol (74 atoms) without errors", () => {
      const result = parseSMILES(
        "C[C@H](CCCC(C)C)[C@H]1CC[C@@H]2[C@@]1(CC[C@H]3[C@H]2CC=C4[C@@]3(CC[C@@H](C4)O)C)C",
      );
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Cholesterol is large steroid with long side chain
      expect(coords.size).toBe(mol.atoms.length);
      expect(aspectRatio).toBeGreaterThan(0.5);
      expect(aspectRatio).toBeLessThan(3.0);

      // Should generate valid coordinates for all atoms
      expect(coords.size).toBe(mol.atoms.length);
    });

    it("should handle vitamin E (tocopherol, 43 atoms)", () => {
      const result = parseSMILES("Cc1c(c2c(c(c1O)C)CCC(O2)(C)CCC[C@H](C)CCC[C@H](C)CCCC(C)C)C");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);

      // Should generate valid coordinates for all atoms
      expect(coords.size).toBe(mol.atoms.length);
      expect(coords.size).toBe(31);

      const aspectRatio = getAspectRatio(coords);
      expect(aspectRatio).toBeGreaterThan(0.5);
    });
  });

  describe("Multiple Ring Systems (Isolated)", () => {
    it("should orient biphenyl (2 isolated rings) horizontally", () => {
      const result = parseSMILES("c1ccccc1-c2ccccc2");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Biphenyl should be horizontal
      expect(aspectRatio).toBeGreaterThan(1.3);
      expect(coords.size).toBe(12);
    });

    it("should orient diphenylmethane appropriately", () => {
      const result = parseSMILES("c1ccc(cc1)Cc2ccccc2");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Two rings connected by CH2 bridge - nearly square layout
      expect(coords.size).toBe(13);
      expect(aspectRatio).toBeGreaterThan(0.8); // More lenient: allows nearly square (0.99) to slightly horizontal
    });
  });

  describe("Heterocycles - Complex Fused Systems", () => {
    it("should orient quinoline (fused benzene + pyridine) horizontally", () => {
      const result = parseSMILES("c1ccc2ncccc2c1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Quinoline: 2 fused rings, should be horizontal
      expect(aspectRatio).toBeGreaterThan(1.3);
      expect(coords.size).toBe(mol.atoms.length);
    });

    it("should orient indole (fused benzene + pyrrole) horizontally", () => {
      const result = parseSMILES("c1ccc2c(c1)[nH]cc2");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Indole: 2 fused rings, should be horizontal
      expect(aspectRatio).toBeGreaterThan(1.2);
      expect(coords.size).toBe(mol.atoms.length);
    });

    it("should orient purine (fused imidazole + pyrimidine) horizontally", () => {
      const result = parseSMILES("c1nc2ncnc2[nH]1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Purine: 2 fused rings, should be horizontal
      expect(aspectRatio).toBeGreaterThan(1.2);
      expect(coords.size).toBe(mol.atoms.length);
    });

    it("should orient acridine (3 fused rings) horizontally", () => {
      const result = parseSMILES("c1ccc2cc3ccccc3nc2c1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Acridine: 3 linearly fused rings, should be very horizontal
      expect(aspectRatio).toBeGreaterThan(1.8);
      expect(coords.size).toBe(mol.atoms.length);
    });
  });

  describe("Regression Tests - Preserve Specific Orientations", () => {
    it("should consistently orient benzene as square (flat-top)", () => {
      const smilesList = ["c1ccccc1", "C1=CC=CC=C1"];

      const aspectRatios: number[] = [];
      for (const smiles of smilesList) {
        const result = parseSMILES(smiles);
        const mol = result.molecules[0]!;
        const coords = generateCoordinatesV2(mol);
        aspectRatios.push(getAspectRatio(coords));
      }

      // All should be square-ish (0.9 - 1.3)
      for (const ratio of aspectRatios) {
        expect(ratio).toBeGreaterThan(0.8);
        expect(ratio).toBeLessThan(1.3);
      }

      // All should be similar (within 20%)
      const avgRatio = aspectRatios.reduce((a, b) => a + b, 0) / aspectRatios.length;
      for (const ratio of aspectRatios) {
        expect(Math.abs(ratio - avgRatio) / avgRatio).toBeLessThan(0.2);
      }
    });

    it("should consistently orient naphthalene horizontally", () => {
      const smilesList = ["c1ccc2ccccc2c1", "c1cccc2c1cccc2"];

      for (const smiles of smilesList) {
        const result = parseSMILES(smiles);
        const mol = result.molecules[0]!;
        const coords = generateCoordinatesV2(mol);
        const aspectRatio = getAspectRatio(coords);

        // Should always be horizontal
        expect(aspectRatio).toBeGreaterThan(1.3);
      }
    });

    it("should consistently orient anthracene horizontally", () => {
      const result = parseSMILES("c1ccc2cc3ccccc3cc2c1");
      const mol = result.molecules[0]!;

      // Generate multiple times to ensure consistency
      for (let i = 0; i < 5; i++) {
        const coords = generateCoordinatesV2(mol);
        const aspectRatio = getAspectRatio(coords);

        expect(aspectRatio).toBeGreaterThan(2.0);
      }
    });

    it("should preserve orientation across multiple generations", () => {
      const result = parseSMILES("c1ccc2ccccc2c1"); // Naphthalene
      const mol = result.molecules[0]!;

      const aspectRatios: number[] = [];
      for (let i = 0; i < 10; i++) {
        const coords = generateCoordinatesV2(mol);
        aspectRatios.push(getAspectRatio(coords));
      }

      // All 10 generations should produce identical aspect ratios
      const firstRatio = aspectRatios[0]!;
      for (const ratio of aspectRatios) {
        expect(Math.abs(ratio - firstRatio)).toBeLessThan(0.001);
      }
    });
  });

  describe("Edge Cases and Robustness", () => {
    it("should handle molecules with no rings gracefully", () => {
      const result = parseSMILES("CCC(C)CC(C)C");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);

      expect(coords.size).toBe(mol.atoms.length);
    });

    it("should handle single atom gracefully", () => {
      const result = parseSMILES("C");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);

      expect(coords.size).toBe(1);
    });

    it("should handle two-atom molecule", () => {
      const result = parseSMILES("CC");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      expect(coords.size).toBe(2);
      // Should be horizontal (two atoms in a line)
      expect(aspectRatio).toBe(Infinity);
    });

    it("should handle highly branched molecules", () => {
      const result = parseSMILES("CC(C)(C)C"); // Neopentane
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);

      expect(coords.size).toBe(5);
      // Should be compact
      const aspectRatio = getAspectRatio(coords);
      expect(aspectRatio).toBeGreaterThan(0.5);
      expect(aspectRatio).toBeLessThan(2.0);
    });
  });

  describe("Performance Tests", () => {
    it("should orient large molecule in reasonable time", () => {
      const result = parseSMILES(
        "C[C@H](CCCC(C)C)[C@H]1CC[C@@H]2[C@@]1(CC[C@H]3[C@H]2CC=C4[C@@]3(CC[C@@H](C4)O)C)C",
      );
      const mol = result.molecules[0]!;

      const startTime = performance.now();
      const coords = generateCoordinatesV2(mol);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in < 100ms (generous timeout)
      expect(duration).toBeLessThan(100);
      expect(coords.size).toBe(mol.atoms.length);
    });
  });
});
