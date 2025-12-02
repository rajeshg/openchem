/**
 * Tests for Rigid Unit Detection and Placement
 *
 * Verifies that:
 * 1. Rigid units are correctly identified
 * 2. Ring systems form proper units
 * 3. Chains are correctly segmented
 * 4. Parent-child relationships are correct
 */

import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import type { Molecule } from "types";
import { detectFusedRingSystems } from "src/generators/coordinate-generator/ring-system-detector";
import {
  detectRigidUnits,
  getPlacementOrder,
} from "src/generators/coordinate-generator/rigid-unit-detector";
import { placeRigidUnits } from "src/generators/coordinate-generator/rigid-unit-placer";
import type { Ring } from "src/generators/coordinate-generator/types";

function getMoleculeRings(molecule: Molecule): Ring[] {
  return (molecule.rings ?? []).map((atomIds, idx) => ({
    id: idx,
    atomIds: [...atomIds],
    size: atomIds.length,
    aromatic: atomIds.every((id) => molecule.atoms[id]?.aromatic ?? false),
  }));
}

describe("Rigid Unit Detection", () => {
  describe("Single Ring Molecules", () => {
    it("should detect benzene as single ring-system unit", () => {
      const result = parseSMILES("c1ccccc1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      expect(graph.units.length).toBe(1);
      expect(graph.units[0]!.type).toBe("ring-system");
      expect(graph.units[0]!.atomIds.size).toBe(6);
      expect(graph.root.id).toBe(graph.units[0]!.id);
    });

    it("should detect cyclohexane as single ring-system unit", () => {
      const result = parseSMILES("C1CCCCC1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      expect(graph.units.length).toBe(1);
      expect(graph.units[0]!.type).toBe("ring-system");
      expect(graph.units[0]!.atomIds.size).toBe(6);
    });
  });

  describe("Fused Ring Systems", () => {
    it("should detect naphthalene as single ring-system unit", () => {
      const result = parseSMILES("c1ccc2ccccc2c1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      expect(graph.units.length).toBe(1);
      expect(graph.units[0]!.type).toBe("ring-system");
      expect(graph.units[0]!.atomIds.size).toBe(10);
      expect(graph.units[0]!.rings.length).toBe(2);
    });

    it("should detect anthracene as single ring-system unit", () => {
      const result = parseSMILES("c1ccc2cc3ccccc3cc2c1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      expect(graph.units.length).toBe(1);
      expect(graph.units[0]!.type).toBe("ring-system");
      expect(graph.units[0]!.rings.length).toBe(3);
    });
  });

  describe("Ring + Substituent Molecules", () => {
    it("should detect toluene as ring-system + chain units", () => {
      const result = parseSMILES("Cc1ccccc1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      // Should have ring-system unit and single-atom unit (methyl)
      expect(graph.units.length).toBe(2);

      const ringUnit = graph.units.find((u) => u.type === "ring-system");
      const chainUnit = graph.units.find((u) => u.type === "single-atom" || u.type === "chain");

      expect(ringUnit).toBeDefined();
      expect(chainUnit).toBeDefined();
      expect(ringUnit!.atomIds.size).toBe(6);
      expect(chainUnit!.atomIds.size).toBe(1);
    });

    it("should detect ethylbenzene with chain correctly", () => {
      const result = parseSMILES("CCc1ccccc1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      expect(graph.units.length).toBe(2);

      const ringUnit = graph.units.find((u) => u.type === "ring-system");
      const chainUnit = graph.units.find((u) => u.type === "chain");

      expect(ringUnit).toBeDefined();
      expect(chainUnit).toBeDefined();
      expect(ringUnit!.atomIds.size).toBe(6);
      expect(chainUnit!.atomIds.size).toBe(2);
    });
  });

  describe("Acyclic Molecules", () => {
    it("should detect butane as single chain unit", () => {
      const result = parseSMILES("CCCC");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      expect(graph.units.length).toBe(1);
      expect(graph.units[0]!.type).toBe("chain");
      expect(graph.units[0]!.atomIds.size).toBe(4);
    });

    it("should detect methane as single-atom unit", () => {
      const result = parseSMILES("C");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      expect(graph.units.length).toBe(1);
      expect(graph.units[0]!.type).toBe("single-atom");
      expect(graph.units[0]!.atomIds.size).toBe(1);
    });
  });

  describe("Parent-Child Relationships", () => {
    it("should establish correct parent-child for toluene", () => {
      const result = parseSMILES("Cc1ccccc1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      // Ring should be root (higher priority)
      const ringUnit = graph.units.find((u) => u.type === "ring-system")!;
      const methylUnit = graph.units.find((u) => u.type !== "ring-system")!;

      expect(graph.root).toBe(ringUnit);
      expect(ringUnit.parent).toBeNull();
      expect(methylUnit.parent).toBe(ringUnit);
      expect(ringUnit.children).toContain(methylUnit);
    });
  });

  describe("Placement Order", () => {
    it("should return units in BFS order from root", () => {
      const result = parseSMILES("CCCc1ccccc1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      const order = getPlacementOrder(graph);

      // Root (ring) should be first
      expect(order[0]).toBe(graph.root);

      // Children come after parent
      for (const unit of order) {
        if (unit.parent) {
          const parentIdx = order.indexOf(unit.parent);
          const unitIdx = order.indexOf(unit);
          expect(parentIdx).toBeLessThan(unitIdx);
        }
      }
    });
  });
});

describe("Rigid Unit Placement", () => {
  describe("Single Ring Placement", () => {
    it("should place benzene with uniform bond lengths", () => {
      const result = parseSMILES("c1ccccc1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      const placement = placeRigidUnits(graph, mol, { bondLength: 35 });

      expect(placement.coords.size).toBe(6);

      // Check bond lengths are uniform
      for (const bond of mol.bonds) {
        const c1 = placement.coords.get(bond.atom1)!;
        const c2 = placement.coords.get(bond.atom2)!;
        const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
        expect(Math.abs(dist - 35)).toBeLessThan(1);
      }
    });

    it("should place cyclohexane with perfect hexagon geometry", () => {
      const result = parseSMILES("C1CCCCC1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      const placement = placeRigidUnits(graph, mol, { bondLength: 35 });

      expect(placement.coords.size).toBe(6);

      // Check all bond lengths are equal
      const bondLengths: number[] = [];
      for (const bond of mol.bonds) {
        const c1 = placement.coords.get(bond.atom1)!;
        const c2 = placement.coords.get(bond.atom2)!;
        bondLengths.push(Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2));
      }

      const avgLength = bondLengths.reduce((a, b) => a + b, 0) / bondLengths.length;
      for (const len of bondLengths) {
        expect(Math.abs(len - avgLength)).toBeLessThan(1);
      }
    });
  });

  describe("Fused Ring Placement", () => {
    it("should place naphthalene with correct fused geometry", () => {
      const result = parseSMILES("c1ccc2ccccc2c1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      const placement = placeRigidUnits(graph, mol, { bondLength: 35 });

      expect(placement.coords.size).toBe(10);

      // Check no atoms overlap
      const coords = Array.from(placement.coords.entries());
      for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
          const [, c1] = coords[i]!;
          const [, c2] = coords[j]!;
          const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
          expect(dist).toBeGreaterThan(10); // Min distance
        }
      }
    });
  });

  describe("Ring + Chain Placement", () => {
    it("should place toluene with methyl attached correctly", () => {
      const result = parseSMILES("Cc1ccccc1");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      const placement = placeRigidUnits(graph, mol, { bondLength: 35 });

      expect(placement.coords.size).toBe(7);

      // Check all bonds are placed
      for (const bond of mol.bonds) {
        expect(placement.coords.has(bond.atom1)).toBe(true);
        expect(placement.coords.has(bond.atom2)).toBe(true);
      }
    });
  });

  describe("Chain-Only Molecules", () => {
    it("should place propane with correct geometry", () => {
      const result = parseSMILES("CCC");
      const mol = result.molecules[0]!;
      const rings = getMoleculeRings(mol);
      const ringSystems = detectFusedRingSystems(rings, mol);
      const graph = detectRigidUnits(mol, ringSystems);

      const placement = placeRigidUnits(graph, mol, { bondLength: 35 });

      expect(placement.coords.size).toBe(3);

      // Check bonds exist and are reasonable length
      for (const bond of mol.bonds) {
        const c1 = placement.coords.get(bond.atom1)!;
        const c2 = placement.coords.get(bond.atom2)!;
        const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
        expect(dist).toBeGreaterThan(20);
        expect(dist).toBeLessThan(50);
      }
    });
  });
});

describe("Integration: Detection + Placement", () => {
  it("should handle complex molecule: caffeine", () => {
    const result = parseSMILES("Cn1cnc2c1c(=O)n(C)c(=O)n2C");
    const mol = result.molecules[0]!;
    const rings = getMoleculeRings(mol);
    const ringSystems = detectFusedRingSystems(rings, mol);
    const graph = detectRigidUnits(mol, ringSystems);

    // Caffeine has fused 5+6 ring system plus methyl groups
    expect(graph.units.length).toBeGreaterThan(1);

    const placement = placeRigidUnits(graph, mol, { bondLength: 35 });
    expect(placement.coords.size).toBe(mol.atoms.length);
  });

  it("should handle biphenyl (two ring systems)", () => {
    const result = parseSMILES("c1ccccc1-c2ccccc2");
    const mol = result.molecules[0]!;
    const rings = getMoleculeRings(mol);
    const ringSystems = detectFusedRingSystems(rings, mol);
    const graph = detectRigidUnits(mol, ringSystems);

    const placement = placeRigidUnits(graph, mol, { bondLength: 35 });
    expect(placement.coords.size).toBe(12);

    // Check no overlaps
    const coords = Array.from(placement.coords.values());
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const c1 = coords[i]!;
        const c2 = coords[j]!;
        const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
        expect(dist).toBeGreaterThan(5);
      }
    }
  });
});

describe("generateCoordinates with useRigidUnits option", () => {
  it("should generate coordinates for benzene using rigid units", () => {
    const result = parseSMILES("c1ccccc1");
    const mol = result.molecules[0]!;

    // Import generateCoordinates dynamically to test the option
    const { generateCoordinates } = require("src/generators/coordinate-generator/index");
    const coords = generateCoordinates(mol, { useRigidUnits: true, bondLength: 35 });

    expect(coords.length).toBe(6);

    // Check all coordinates are defined
    for (let i = 0; i < 6; i++) {
      expect(coords[i]).toBeDefined();
      expect(Number.isFinite(coords[i].x)).toBe(true);
      expect(Number.isFinite(coords[i].y)).toBe(true);
    }

    // Check bond lengths are approximately 35
    for (const bond of mol.bonds) {
      const c1 = coords[bond.atom1];
      const c2 = coords[bond.atom2];
      const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
      expect(dist).toBeGreaterThan(25);
      expect(dist).toBeLessThan(45);
    }
  });

  it("should generate coordinates for naphthalene using rigid units", () => {
    const result = parseSMILES("c1ccc2ccccc2c1");
    const mol = result.molecules[0]!;

    const { generateCoordinates } = require("src/generators/coordinate-generator/index");
    const coords = generateCoordinates(mol, { useRigidUnits: true, bondLength: 35 });

    expect(coords.length).toBe(10);

    // Check no overlapping atoms
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const c1 = coords[i];
        const c2 = coords[j];
        if (c1 && c2) {
          const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
          expect(dist).toBeGreaterThan(10);
        }
      }
    }
  });

  it("should generate coordinates for toluene (ring + substituent)", () => {
    const result = parseSMILES("Cc1ccccc1");
    const mol = result.molecules[0]!;

    const { generateCoordinates } = require("src/generators/coordinate-generator/index");
    const coords = generateCoordinates(mol, { useRigidUnits: true, bondLength: 35 });

    expect(coords.length).toBe(7);

    // All atoms should be placed
    for (let i = 0; i < 7; i++) {
      expect(coords[i]).toBeDefined();
    }
  });

  it("should generate coordinates for propane (chain only)", () => {
    const result = parseSMILES("CCC");
    const mol = result.molecules[0]!;

    const { generateCoordinates } = require("src/generators/coordinate-generator/index");
    const coords = generateCoordinates(mol, { useRigidUnits: true, bondLength: 35 });

    expect(coords.length).toBe(3);

    // Check bond lengths
    for (const bond of mol.bonds) {
      const c1 = coords[bond.atom1];
      const c2 = coords[bond.atom2];
      const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
      expect(dist).toBeGreaterThan(20);
      expect(dist).toBeLessThan(50);
    }
  });

  it("should handle caffeine with rigid units", () => {
    const result = parseSMILES("Cn1cnc2c1c(=O)n(C)c(=O)n2C");
    const mol = result.molecules[0]!;

    const { generateCoordinates } = require("src/generators/coordinate-generator/index");
    const coords = generateCoordinates(mol, { useRigidUnits: true, bondLength: 35 });

    expect(coords.length).toBe(mol.atoms.length);

    // All atoms should have valid coordinates
    for (let i = 0; i < coords.length; i++) {
      expect(coords[i]).toBeDefined();
      expect(Number.isFinite(coords[i].x)).toBe(true);
      expect(Number.isFinite(coords[i].y)).toBe(true);
    }
  });

  it("should produce same results with default option (false)", () => {
    const result = parseSMILES("c1ccccc1");
    const mol = result.molecules[0]!;

    const { generateCoordinates } = require("src/generators/coordinate-generator/index");

    // Without option (default)
    const coords1 = generateCoordinates(mol, { bondLength: 35 });

    // With explicit false
    const coords2 = generateCoordinates(mol, { useRigidUnits: false, bondLength: 35 });

    // Should be the same
    expect(coords1.length).toBe(coords2.length);
    for (let i = 0; i < coords1.length; i++) {
      expect(coords1[i].x).toBeCloseTo(coords2[i].x, 5);
      expect(coords1[i].y).toBeCloseTo(coords2[i].y, 5);
    }
  });
});
