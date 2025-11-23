import { describe, it, expect } from "bun:test";
import { parseSMILES, Descriptors } from "index";

describe("Metformin rotatable bonds", () => {
  it("should count 0 rotatable bonds in metformin (guanidine conjugation)", () => {
    const result = parseSMILES("CN(C)C(=N)NC(=N)N");
    expect(result.errors).toHaveLength(0);
    expect(result.molecules).toHaveLength(1);

    const metformin = result.molecules[0]!;
    const rotatableBonds = Descriptors.rotatableBonds(metformin);

    expect(rotatableBonds).toBe(0);
  });
});
