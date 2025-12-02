import { describe, it, expect } from "bun:test";
import { parseSMILES } from "src/parsers/smiles-parser";
import { generateCoordinates } from "src/generators/coordinate-generator";

describe("Fused Ring System Coordinate Generation", () => {
  it("should correctly generate coordinates for naphthalene", () => {
    const result = parseSMILES("c1ccc2ccccc2c1");
    expect(result.errors).toHaveLength(0);
    const molecule = result.molecules[0]!;
    expect(molecule.atoms).toHaveLength(10);

    const coords = generateCoordinates(molecule);

    // All atoms should have coordinates
    expect(coords.length).toBeGreaterThanOrEqual(10);
    const definedCoords = coords.filter((c) => c !== undefined);
    expect(definedCoords.length).toBe(10);
    expect(definedCoords.every((c) => c.x !== undefined && c.y !== undefined)).toBe(true);

    // Check that bond lengths are consistent (within 5% tolerance)
    const bondLengths = molecule.bonds.map((bond) => {
      const coord1 = coords[bond.atom1]!;
      const coord2 = coords[bond.atom2]!;
      const dx = coord1.x - coord2.x;
      const dy = coord1.y - coord2.y;
      return Math.sqrt(dx * dx + dy * dy);
    });

    const avgLength = bondLengths.reduce((a, b) => a + b, 0) / bondLengths.length;
    const maxDeviation = Math.max(...bondLengths.map((len) => Math.abs(len - avgLength)));
    expect(maxDeviation / avgLength).toBeLessThan(0.05); // Within 5%
  });

  it("should handle shared atoms correctly in fused systems", () => {
    const result = parseSMILES("c1ccc2ccccc2c1"); // Naphthalene
    const molecule = result.molecules[0]!;

    const coords = generateCoordinates(molecule);

    // Count unique coordinate positions (filter out undefined)
    const definedCoords = coords.filter((c) => c !== undefined);
    const coordSet = new Set(definedCoords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`));

    // Should have 10 unique positions (10 atoms, no duplicates)
    expect(coordSet.size).toBe(10);
  });

  it("should maintain bond connectivity with fused ring systems", () => {
    const result = parseSMILES("c1ccc2cc3ccccc3cc2c1"); // Anthracene
    const molecule = result.molecules[0]!;

    const coords = generateCoordinates(molecule);

    // Verify all bonds connect properly placed atoms
    for (const bond of molecule.bonds) {
      const coord1 = coords[bond.atom1];
      const coord2 = coords[bond.atom2];

      expect(coord1).toBeDefined();
      expect(coord2).toBeDefined();
      expect(coord1!.x).toBeDefined();
      expect(coord1!.y).toBeDefined();
      expect(coord2!.x).toBeDefined();
      expect(coord2!.y).toBeDefined();

      // Bond length should be reasonable (25-45 for default 35 bonds)
      const dx = coord1!.x - coord2!.x;
      const dy = coord1!.y - coord2!.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      expect(length).toBeGreaterThan(25);
      expect(length).toBeLessThan(45);
    }
  });

  it("should handle heterocycles with correct atom mapping", () => {
    const result = parseSMILES("c1ccc2c(c1)[nH]c1ccccc12"); // Carbazole
    const molecule = result.molecules[0]!;

    const coords = generateCoordinates(molecule);

    // Find the nitrogen atom
    const nitrogenAtom = molecule.atoms.find((a) => a.symbol === "N");
    expect(nitrogenAtom).toBeDefined();

    const nCoord = coords[nitrogenAtom!.id];
    expect(nCoord).toBeDefined();
    expect(nCoord!.x).toBeDefined();
    expect(nCoord!.y).toBeDefined();

    // Nitrogen should be bonded to exactly 2 carbons (in carbazole)
    const nBonds = molecule.bonds.filter(
      (b) => b.atom1 === nitrogenAtom!.id || b.atom2 === nitrogenAtom!.id,
    );
    expect(nBonds).toHaveLength(2);
  });

  it("should produce valid coordinates for all fused ring molecules", () => {
    const fusedMolecules = [
      "c1ccc2ccccc2c1", // Naphthalene
      "c1ccc2cc3ccccc3cc2c1", // Anthracene
      "c1ccc2c(c1)ccc1ccccc12", // Phenanthrene
      "c1cc2ccc3cccc4ccc(c1)c2c34", // Pyrene
      "c1ccc2c(c1)Cc1ccccc1-2", // Fluorene
      "c1ccc2c(c1)[nH]c1ccccc12", // Carbazole
      "c1ccc2c(c1)oc1ccccc12", // Benzofuran (fused)
      "c1ccc2c(c1)sc1ccccc12", // Benzothiophene (fused)
      "c1ccc2c(c1)nccc2", // Quinoline
      "c1ccc2c(c1)cc[nH]2", // Indole
      "c1nc2ncnc2[nH]1", // Purine
    ];

    for (const smiles of fusedMolecules) {
      const result = parseSMILES(smiles);
      expect(result.errors).toHaveLength(0);
      const molecule = result.molecules[0]!;

      const coords = generateCoordinates(molecule);

      // All atoms should have valid coordinates
      const definedCoords = coords.filter((c) => c !== undefined);
      expect(definedCoords.length).toBe(molecule.atoms.length);
      expect(definedCoords.every((c) => !isNaN(c.x) && !isNaN(c.y))).toBe(true);
    }
  });

  it("should handle simple cyclic structures", () => {
    const result = parseSMILES("C1CCCCC1"); // Cyclohexane
    const molecule = result.molecules[0]!;

    const coords = generateCoordinates(molecule);

    // Should generate valid coordinates
    const definedCoords = coords.filter((c) => c !== undefined);
    expect(definedCoords.length).toBe(molecule.atoms.length);
  });

  it("should scale coordinates correctly to bond length", () => {
    const result = parseSMILES("c1ccc2ccccc2c1"); // Naphthalene
    const molecule = result.molecules[0]!;

    const customBondLength = 25;
    const coords = generateCoordinates(molecule, {
      bondLength: customBondLength,
    });

    // Check average bond length
    const bondLengths = molecule.bonds.map((bond) => {
      const coord1 = coords[bond.atom1]!;
      const coord2 = coords[bond.atom2]!;
      const dx = coord1.x - coord2.x;
      const dy = coord1.y - coord2.y;
      return Math.sqrt(dx * dx + dy * dy);
    });

    const avgLength = bondLengths.reduce((a, b) => a + b, 0) / bondLengths.length;
    expect(Math.abs(avgLength - customBondLength)).toBeLessThan(2); // Within 2 tolerance
  });
});
