/**
 * Tests for molecular orientation optimization
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

  // Perfectly linear (all atoms on same horizontal or vertical line)
  if (height < 1e-6 && width > 1e-6) return Infinity;
  if (width < 1e-6 && height > 1e-6) return 0;
  if (width < 1e-6 && height < 1e-6) return 1.0;

  return width / height;
}

describe("Molecular Orientation Optimization", () => {
  describe("Linear Fused Rings", () => {
    it("should orient naphthalene horizontally", () => {
      const result = parseSMILES("c1ccc2ccccc2c1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Naphthalene should be horizontal (width > height)
      expect(aspectRatio).toBeGreaterThan(1.3);
    });

    it("should orient anthracene horizontally", () => {
      const result = parseSMILES("c1ccc2cc3ccccc3cc2c1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Anthracene (3 linear rings) should be very horizontal
      expect(aspectRatio).toBeGreaterThan(1.8);
    });

    it("should orient tetracene horizontally", () => {
      const result = parseSMILES("c1ccc2cc3cc4ccccc4cc3cc2c1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Tetracene (4 linear rings) should be extremely horizontal
      expect(aspectRatio).toBeGreaterThan(2.5);
    });
  });

  describe("Two Fused Rings", () => {
    it("should orient naphthalene horizontally", () => {
      const result = parseSMILES("c1ccc2ccccc2c1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      expect(aspectRatio).toBeGreaterThan(1.2);
    });
  });

  describe("Single Rings", () => {
    it("should orient benzene roughly square (flat-top)", () => {
      const result = parseSMILES("c1ccccc1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Benzene should be roughly square (aspect ratio near 1.0)
      expect(aspectRatio).toBeGreaterThan(0.7);
      expect(aspectRatio).toBeLessThan(1.3);
    });

    it("should orient cyclohexane roughly square", () => {
      const result = parseSMILES("C1CCCCC1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      expect(aspectRatio).toBeGreaterThan(0.7);
      expect(aspectRatio).toBeLessThan(1.3);
    });

    it("should orient cyclopentane vertically (point-top)", () => {
      const result = parseSMILES("C1CCCC1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Cyclopentane (pentagon) should have height >= width (point-top)
      expect(aspectRatio).toBeLessThan(1.2);
    });
  });

  describe("Linear Chains", () => {
    it("should orient n-hexane horizontally", () => {
      const result = parseSMILES("CCCCCC");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // n-hexane should be horizontal (width > height), possibly perfectly horizontal (Infinity)
      expect(aspectRatio).toBeGreaterThanOrEqual(1.5);
    });

    it("should orient n-octane horizontally", () => {
      const result = parseSMILES("CCCCCCCC");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // n-octane should be even more horizontal, possibly perfectly horizontal (Infinity)
      expect(aspectRatio).toBeGreaterThanOrEqual(2.0);
    });

    it("should orient n-decane horizontally", () => {
      const result = parseSMILES("CCCCCCCCCC");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // n-decane should be very horizontal, possibly perfectly horizontal (Infinity)
      expect(aspectRatio).toBeGreaterThanOrEqual(2.5);
    });
  });

  describe("Ring with Chain", () => {
    it("should orient toluene horizontally", () => {
      const result = parseSMILES("Cc1ccccc1");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Toluene (benzene + methyl) should be roughly square to slightly horizontal
      expect(aspectRatio).toBeGreaterThan(0.8);
      expect(aspectRatio).toBeLessThan(2.0);
    });

    it("should orient aspirin horizontally", () => {
      const result = parseSMILES("CC(=O)Oc1ccccc1C(=O)O");
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Aspirin should be horizontally oriented
      expect(aspectRatio).toBeGreaterThan(1.0);
    });
  });

  describe("Orientation Consistency", () => {
    it("should produce consistent orientation regardless of atom ordering", () => {
      // Different SMILES for benzene (different atom orderings)
      const smilesList = ["c1ccccc1", "C1=CC=CC=C1"];

      const aspectRatios: number[] = [];

      for (const smiles of smilesList) {
        const result = parseSMILES(smiles);
        const mol = result.molecules[0]!;
        const coords = generateCoordinatesV2(mol);
        aspectRatios.push(getAspectRatio(coords));
      }

      // All benzene representations should have similar aspect ratios
      const avgRatio = aspectRatios.reduce((a, b) => a + b, 0) / aspectRatios.length;
      for (const ratio of aspectRatios) {
        expect(Math.abs(ratio - avgRatio)).toBeLessThan(0.3);
      }
    });

    it("should produce horizontal naphthalene from different SMILES", () => {
      const smilesList = ["c1ccc2ccccc2c1", "c1cccc2c1cccc2"];

      for (const smiles of smilesList) {
        const result = parseSMILES(smiles);
        const mol = result.molecules[0]!;
        const coords = generateCoordinatesV2(mol);
        const aspectRatio = getAspectRatio(coords);

        // All should be horizontal
        expect(aspectRatio).toBeGreaterThan(1.2);
      }
    });
  });

  describe("Principal Axis Calculation", () => {
    it("should correctly identify principal axis of horizontal molecule", () => {
      const result = parseSMILES("c1ccc2cc3ccccc3cc2c1"); // Anthracene
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // After optimization, anthracene should be horizontal
      expect(aspectRatio).toBeGreaterThan(1.5);
    });

    it("should handle compact molecules gracefully", () => {
      const result = parseSMILES("C1C2CC3CC1CC(C2)C3"); // Adamantane
      const mol = result.molecules[0]!;

      const coords = generateCoordinatesV2(mol);
      const aspectRatio = getAspectRatio(coords);

      // Adamantane is compact, should be roughly square
      expect(aspectRatio).toBeGreaterThan(0.5);
      expect(aspectRatio).toBeLessThan(2.0);
    });
  });

  describe("Disable Orientation Optimization", () => {
    it("should allow disabling orientation optimization", () => {
      const result = parseSMILES("c1ccc2ccccc2c1"); // Naphthalene
      const mol = result.molecules[0]!;

      // Generate with optimization disabled
      const coords = generateCoordinatesV2(mol, { optimizeOrientation: false });

      // Should still generate valid coordinates
      expect(coords.size).toBe(10);

      // Aspect ratio may not be horizontal (no guarantee without optimization)
      const aspectRatio = getAspectRatio(coords);
      expect(aspectRatio).toBeGreaterThan(0);
    });
  });
});
