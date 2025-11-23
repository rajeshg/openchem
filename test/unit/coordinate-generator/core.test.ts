/**
 * Unit tests for coordinate-generator-v2 core modules.
 * Testing basic functionality before integration.
 */

import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import {
  add,
  sub,
  scale,
  distance,
  normalize,
  regularPolygon,
  radiusForEdgeLength,
  edgeLengthForRadius,
} from "src/generators/coordinate-generator/geometry-utils";
import { detectFusedRingSystems } from "src/generators/coordinate-generator/ring-system-detector";

describe("geometry-utils", () => {
  it("vector addition", () => {
    const a = { x: 1, y: 2 };
    const b = { x: 3, y: 4 };
    const result = add(a, b);
    expect(result.x).toBe(4);
    expect(result.y).toBe(6);
  });

  it("vector subtraction", () => {
    const a = { x: 5, y: 7 };
    const b = { x: 2, y: 3 };
    const result = sub(a, b);
    expect(result.x).toBe(3);
    expect(result.y).toBe(4);
  });

  it("vector scaling", () => {
    const v = { x: 2, y: 3 };
    const result = scale(v, 3);
    expect(result.x).toBe(6);
    expect(result.y).toBe(9);
  });

  it("distance calculation", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 4 };
    const d = distance(a, b);
    expect(d).toBeCloseTo(5, 0.001);
  });

  it("normalize vector", () => {
    const v = { x: 3, y: 4 };
    const n = normalize(v);
    expect(distance({ x: 0, y: 0 }, n)).toBeCloseTo(1, 0.001);
  });

  it("regular polygon generation", () => {
    const hex = regularPolygon(6, 35);
    expect(hex).toHaveLength(6);

    // Check bond lengths
    for (let i = 0; i < 6; i++) {
      const p1 = hex[i]!;
      const p2 = hex[(i + 1) % 6]!;
      const d = distance(p1, p2);
      expect(d).toBeCloseTo(35, 0.1);
    }
  });

  it("radius for edge length", () => {
    const radius = radiusForEdgeLength(6, 35);
    expect(radius).toBeCloseTo(35, 0.1);
  });

  it("edge length for radius", () => {
    const radius = radiusForEdgeLength(6, 35);
    const edge = edgeLengthForRadius(6, radius);
    expect(edge).toBeCloseTo(35, 0.1);
  });
});

describe("ring-system-detector", () => {
  it("detects single ring in benzene", () => {
    const benzene = parseSMILES("c1ccccc1").molecules[0]!;
    expect(benzene.rings).toBeTruthy();
    expect(benzene.rings![0]).toHaveLength(6);
  });

  it("detects fused rings in naphthalene", () => {
    const naphthalene = parseSMILES("c1ccc2ccccc2c1").molecules[0]!;
    expect(naphthalene.rings).toBeTruthy();
    expect(naphthalene.rings!.length).toBe(2);
  });

  it("detects isolated rings in biphenyl", () => {
    const biphenyl = parseSMILES("c1ccccc1-c2ccccc2").molecules[0]!;
    expect(biphenyl.rings).toHaveLength(2);
  });

  it("detects fused rings in anthracene", () => {
    const anthracene = parseSMILES("c1ccc2cc3ccccc3cc2c1").molecules[0]!;
    expect(anthracene.rings).toHaveLength(3);
  });

  it("detects bridged system in adamantane", () => {
    const adamantane = parseSMILES("C1C2CC3CC1CC(C2)C3").molecules[0]!;
    expect(adamantane.rings).toHaveLength(3);
  });
});
