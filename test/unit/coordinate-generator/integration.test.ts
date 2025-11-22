/**
 * Integration tests for coordinate-generator-v2 pipeline.
 * Tests full molecule coordinate generation from start to finish.
 */

import { describe, test, expect } from "bun:test";
import { parseSMILES } from "index";
import {
  generateCoordinatesV2,
  hasValidCoordinates,
  getBoundingBox,
  centerCoordinates,
  hasOverlaps,
} from "src/generators/coordinate-generator";

describe("Coordinate Generator V2 - Integration Tests", () => {
  test("Simple molecule: ethane (CC)", () => {
    const result = parseSMILES("CC");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(2);
    expect(hasValidCoordinates(coords)).toBe(true);

    // Check bond length is reasonable
    const c1 = coords.get(0)!;
    const c2 = coords.get(1)!;
    const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
    expect(dist).toBeGreaterThan(30);
    expect(dist).toBeLessThan(40);
  });

  test("Linear chain: pentane (CCCCC)", () => {
    const result = parseSMILES("CCCCC");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(5);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);
  });

  test("Simple ring: cyclohexane (C1CCCCC1)", () => {
    const result = parseSMILES("C1CCCCC1");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(6);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);

    // Check ring is roughly circular
    const bbox = getBoundingBox(coords);
    expect(bbox).not.toBeNull();
    const aspectRatio = bbox!.width / bbox!.height;
    expect(aspectRatio).toBeGreaterThan(0.8);
    expect(aspectRatio).toBeLessThan(1.2);
  });

  test("Aromatic ring: benzene (c1ccccc1)", () => {
    const result = parseSMILES("c1ccccc1");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(6);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);
  });

  test("Fused rings: naphthalene (c1ccc2ccccc2c1)", () => {
    const result = parseSMILES("c1ccc2ccccc2c1");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(10);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);

    // Naphthalene should be wider than tall
    const bbox = getBoundingBox(coords);
    expect(bbox).not.toBeNull();
    expect(bbox!.width).toBeGreaterThan(bbox!.height);
  });

  test("Branched molecule: isobutane (CC(C)C)", () => {
    const result = parseSMILES("CC(C)C");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(4);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);
  });

  test("Complex fused: anthracene (c1ccc2cc3ccccc3cc2c1)", () => {
    const result = parseSMILES("c1ccc2cc3ccccc3cc2c1");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(14);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);
  });

  test("Ring with substituent: toluene (Cc1ccccc1)", () => {
    const result = parseSMILES("Cc1ccccc1");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(7);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);
  });

  test("Spiro system: spiro[4.5]decane (C1CCC2(C1)CCCCC2)", () => {
    const result = parseSMILES("C1CCC2(C1)CCCCC2");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(10);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);
  });

  test("Center coordinates", () => {
    const result = parseSMILES("c1ccccc1");
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);
    centerCoordinates(coords);

    // Check that coordinates are centered around origin
    const bbox = getBoundingBox(coords);
    expect(bbox).not.toBeNull();
    expect(Math.abs((bbox!.minX + bbox!.maxX) / 2)).toBeLessThan(1);
    expect(Math.abs((bbox!.minY + bbox!.maxY) / 2)).toBeLessThan(1);
  });

  test("Custom bond length", () => {
    const result = parseSMILES("CC");
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule, { bondLength: 50 });

    const c1 = coords.get(0)!;
    const c2 = coords.get(1)!;
    const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);

    // Bond length should be close to 50
    expect(dist).toBeGreaterThan(45);
    expect(dist).toBeLessThan(55);
  });

  test("Multiple ring systems: biphenyl (c1ccc(cc1)c2ccccc2)", () => {
    const result = parseSMILES("c1ccc(cc1)c2ccccc2");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(12);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);
  });

  test("Drug molecule: aspirin (CC(=O)Oc1ccccc1C(=O)O)", () => {
    const result = parseSMILES("CC(=O)Oc1ccccc1C(=O)O");
    expect(result.errors).toEqual([]);
    const molecule = result.molecules[0]!;

    const coords = generateCoordinatesV2(molecule);

    expect(coords.size).toBe(13);
    expect(hasValidCoordinates(coords)).toBe(true);
    expect(hasOverlaps(molecule, coords, 35)).toBe(false);
  });
});
