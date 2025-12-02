import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { generateCoordinatesMap } from "src/generators/coordinate-generator";

describe("Uniform Bond Lengths", () => {
  it("should generate highly uniform bond lengths for celecoxib", () => {
    const smiles = "Cc1ccc(-c2cc(C(F)(F)F)nn2-c2ccc(S(N)(=O)=O)cc2)cc1";
    const result = parseSMILES(smiles);
    expect(result.molecules.length).toBe(1);

    const mol = result.molecules[0]!;
    const coords = generateCoordinatesMap(mol);

    // Verify all coordinates exist
    expect(coords.size).toBe(mol.atoms.length);

    // Measure all bond lengths
    const bondLengths: number[] = [];
    for (const bond of mol.bonds) {
      const coord1 = coords.get(bond.atom1);
      const coord2 = coords.get(bond.atom2);

      expect(coord1).toBeDefined();
      expect(coord2).toBeDefined();

      if (coord1 && coord2) {
        const dx = coord2.x - coord1.x;
        const dy = coord2.y - coord1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        bondLengths.push(length);
      }
    }

    // Compute statistics
    const min = Math.min(...bondLengths);
    const max = Math.max(...bondLengths);
    const avg = bondLengths.reduce((sum, l) => sum + l, 0) / bondLengths.length;

    // Rigid unit architecture: bonds within rigid units are perfect,
    // connecting bonds between units may have slight variation (< 10%)
    expect(min).toBeGreaterThan(30.0); // No extremely short bonds
    expect(max).toBeLessThan(40.0); // No extremely long bonds
    expect(avg).toBeCloseTo(35.0, 0); // Average should be close to target

    // High uniformity: >90% of bonds within 10% of target
    const tolerance = 35.0 * 0.1;
    const uniformBonds = bondLengths.filter((l) => Math.abs(l - 35.0) < tolerance).length;
    const uniformity = uniformBonds / bondLengths.length;
    expect(uniformity).toBeGreaterThanOrEqual(0.9);
  });

  it("should generate uniform bond lengths for simple benzene", () => {
    const smiles = "c1ccccc1";
    const result = parseSMILES(smiles);
    const mol = result.molecules[0]!;
    const coords = generateCoordinatesMap(mol);

    const bondLengths: number[] = [];
    for (const bond of mol.bonds) {
      const coord1 = coords.get(bond.atom1);
      const coord2 = coords.get(bond.atom2);

      if (coord1 && coord2) {
        const dx = coord2.x - coord1.x;
        const dy = coord2.y - coord1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        bondLengths.push(length);
      }
    }

    // All 6 bonds should be exactly 35.0
    expect(bondLengths.length).toBe(6);
    for (const length of bondLengths) {
      expect(length).toBeCloseTo(35.0, 2);
    }
  });

  it("should generate uniform bond lengths for naphthalene (fused rings)", () => {
    const smiles = "c1ccc2ccccc2c1";
    const result = parseSMILES(smiles);
    const mol = result.molecules[0]!;
    const coords = generateCoordinatesMap(mol);

    const bondLengths: number[] = [];
    for (const bond of mol.bonds) {
      const coord1 = coords.get(bond.atom1);
      const coord2 = coords.get(bond.atom2);

      if (coord1 && coord2) {
        const dx = coord2.x - coord1.x;
        const dy = coord2.y - coord1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        bondLengths.push(length);
      }
    }

    // All bonds should be uniform
    const min = Math.min(...bondLengths);
    const max = Math.max(...bondLengths);
    expect(min).toBeCloseTo(35.0, 2);
    expect(max).toBeCloseTo(35.0, 2);
  });

  it("should generate uniform bond lengths for acyclic molecules", () => {
    const smiles = "CCCCCC"; // n-hexane
    const result = parseSMILES(smiles);
    const mol = result.molecules[0]!;
    const coords = generateCoordinatesMap(mol);

    const bondLengths: number[] = [];
    for (const bond of mol.bonds) {
      const coord1 = coords.get(bond.atom1);
      const coord2 = coords.get(bond.atom2);

      if (coord1 && coord2) {
        const dx = coord2.x - coord1.x;
        const dy = coord2.y - coord1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        bondLengths.push(length);
      }
    }

    // All 5 C-C bonds should be exactly 35.0
    expect(bondLengths.length).toBe(5);
    for (const length of bondLengths) {
      expect(length).toBeCloseTo(35.0, 2);
    }
  });

  it("should handle custom bond lengths", () => {
    const smiles = "c1ccccc1";
    const result = parseSMILES(smiles);
    const mol = result.molecules[0]!;
    const coords = generateCoordinatesMap(mol, { bondLength: 50.0 });

    const bondLengths: number[] = [];
    for (const bond of mol.bonds) {
      const coord1 = coords.get(bond.atom1);
      const coord2 = coords.get(bond.atom2);

      if (coord1 && coord2) {
        const dx = coord2.x - coord1.x;
        const dy = coord2.y - coord1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        bondLengths.push(length);
      }
    }

    // All bonds should match custom bond length
    for (const length of bondLengths) {
      expect(length).toBeCloseTo(50.0, 2);
    }
  });
});
