import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import {
  getChi0,
  getChi0n,
  getChi0v,
  getChi1,
  getChi1n,
  getChi1v,
  getChi2n,
  getChi2v,
  getChi3n,
  getChi3v,
  getChi4n,
  getChi4v,
} from "src/utils/chi-indices";

function parse(smiles: string) {
  const result = parseSMILES(smiles);
  if (!result.molecules[0]) throw new Error(`Failed to parse: ${smiles}`);
  return result.molecules[0];
}

describe("Chi Connectivity Indices", () => {
  describe("Chi0 (order 0 - atoms)", () => {
    it("should calculate Chi0 for methane", () => {
      const methane = parse("C");
      expect(getChi0(methane)).toBe(0);
    });

    it("should calculate Chi0 for ethane", () => {
      const ethane = parse("CC");
      expect(getChi0(ethane)).toBeCloseTo(2.0, 3);
    });

    it("should calculate Chi0 for propane", () => {
      const propane = parse("CCC");
      expect(getChi0(propane)).toBeCloseTo(2.7071, 3);
    });

    it("should calculate Chi0 for butane", () => {
      const butane = parse("CCCC");
      expect(getChi0(butane)).toBeCloseTo(3.4142, 3);
    });

    it("should calculate Chi0 for isobutane", () => {
      const isobutane = parse("CC(C)C");
      expect(getChi0(isobutane)).toBeCloseTo(3.5774, 3);
    });

    it("should match RDKit for ethanol", () => {
      const ethanol = parse("CCO");
      expect(getChi0(ethanol)).toBeCloseTo(2.7071, 3);
    });
  });

  describe("Chi0n (order 0 - valence adjusted)", () => {
    it("should calculate Chi0n for alkanes (same as Chi0)", () => {
      const ethane = parse("CC");
      const propane = parse("CCC");
      expect(getChi0n(ethane)).toBeCloseTo(2.0, 3);
      expect(getChi0n(propane)).toBeCloseTo(2.7071, 3);
    });

    it("should differ from Chi0 for heteroatoms", () => {
      const ethanol = parse("CCO");
      const chi0 = getChi0(ethanol);
      const chi0n = getChi0n(ethanol);

      expect(chi0).toBeCloseTo(2.7071, 3);
      expect(chi0n).toBeCloseTo(2.1543, 3);
      expect(chi0n).toBeLessThan(chi0);
    });

    it("should match RDKit for methylamine", () => {
      const methylamine = parse("CN");
      expect(getChi0n(methylamine)).toBeCloseTo(1.5774, 3);
    });
  });

  describe("Chi0v (order 0 - valence)", () => {
    it("should equal Chi0n for most molecules", () => {
      const ethanol = parse("CCO");
      expect(getChi0v(ethanol)).toBeCloseTo(getChi0n(ethanol), 3);
    });
  });

  describe("Chi1 (order 1 - bonds)", () => {
    it("should calculate Chi1 for ethane", () => {
      const ethane = parse("CC");
      expect(getChi1(ethane)).toBeCloseTo(1.0, 3);
    });

    it("should calculate Chi1 for propane", () => {
      const propane = parse("CCC");
      expect(getChi1(propane)).toBeCloseTo(1.4142, 3);
    });

    it("should calculate Chi1 for butane", () => {
      const butane = parse("CCCC");
      expect(getChi1(butane)).toBeCloseTo(1.9142, 3);
    });

    it("should calculate Chi1 for isobutane", () => {
      const isobutane = parse("CC(C)C");
      expect(getChi1(isobutane)).toBeCloseTo(1.7321, 3);
    });

    it("should match RDKit for ethanol", () => {
      const ethanol = parse("CCO");
      expect(getChi1(ethanol)).toBeCloseTo(1.4142, 3);
    });
  });

  describe("Chi1n (order 1 - valence adjusted)", () => {
    it("should calculate Chi1n for alkanes (same as Chi1)", () => {
      const ethane = parse("CC");
      const propane = parse("CCC");
      expect(getChi1n(ethane)).toBeCloseTo(1.0, 3);
      expect(getChi1n(propane)).toBeCloseTo(1.4142, 3);
    });

    it("should differ from Chi1 for heteroatoms", () => {
      const ethanol = parse("CCO");
      const chi1 = getChi1(ethanol);
      const chi1n = getChi1n(ethanol);

      expect(chi1).toBeCloseTo(1.4142, 3);
      expect(chi1n).toBeCloseTo(1.0233, 3);
      expect(chi1n).toBeLessThan(chi1);
    });

    it("should match RDKit for methylamine", () => {
      const methylamine = parse("CN");
      expect(getChi1n(methylamine)).toBeCloseTo(0.5774, 3);
    });
  });

  describe("Chi1v (order 1 - valence)", () => {
    it("should equal Chi1n for most molecules", () => {
      const ethanol = parse("CCO");
      expect(getChi1v(ethanol)).toBeCloseTo(getChi1n(ethanol), 3);
    });
  });

  describe("Chi2n (order 2 - 2-paths)", () => {
    it("should return 0 for ethane (no 2-paths)", () => {
      const ethane = parse("CC");
      expect(getChi2n(ethane)).toBe(0);
    });

    it("should calculate Chi2n for propane", () => {
      const propane = parse("CCC");
      expect(getChi2n(propane)).toBeCloseTo(0.7071, 3);
    });

    it("should calculate Chi2n for butane", () => {
      const butane = parse("CCCC");
      expect(getChi2n(butane)).toBeCloseTo(1.0, 3);
    });

    it("should calculate Chi2n for isobutane", () => {
      const isobutane = parse("CC(C)C");
      expect(getChi2n(isobutane)).toBeCloseTo(1.7321, 3);
    });

    it("should match RDKit for ethanol", () => {
      const ethanol = parse("CCO");
      expect(getChi2n(ethanol)).toBeCloseTo(0.3162, 3);
    });
  });

  describe("Chi2v (order 2 - valence)", () => {
    it("should equal Chi2n for most molecules", () => {
      const propane = parse("CCC");
      expect(getChi2v(propane)).toBeCloseTo(getChi2n(propane), 3);
    });
  });

  describe("Chi3n (order 3 - 3-paths)", () => {
    it("should return 0 for propane (no 3-paths)", () => {
      const propane = parse("CCC");
      expect(getChi3n(propane)).toBe(0);
    });

    it("should calculate Chi3n for butane", () => {
      const butane = parse("CCCC");
      expect(getChi3n(butane)).toBeCloseTo(0.5, 3);
    });

    it("should calculate Chi3n for pentane", () => {
      const pentane = parse("CCCCC");
      expect(getChi3n(pentane)).toBeCloseTo(0.7071, 3);
    });

    it("should return 0 for isobutane (no 3-paths in branched C4)", () => {
      const isobutane = parse("CC(C)C");
      expect(getChi3n(isobutane)).toBe(0);
    });
  });

  describe("Chi3v (order 3 - valence)", () => {
    it("should equal Chi3n for most molecules", () => {
      const butane = parse("CCCC");
      expect(getChi3v(butane)).toBeCloseTo(getChi3n(butane), 3);
    });
  });

  describe("Chi4n (order 4 - 4-paths)", () => {
    it("should return 0 for butane (no 4-paths)", () => {
      const butane = parse("CCCC");
      expect(getChi4n(butane)).toBe(0);
    });

    it("should calculate Chi4n for pentane", () => {
      const pentane = parse("CCCCC");
      expect(getChi4n(pentane)).toBeCloseTo(0.3536, 3);
    });

    it("should calculate Chi4n for hexane", () => {
      const hexane = parse("CCCCCC");
      expect(getChi4n(hexane)).toBeCloseTo(0.5, 3);
    });
  });

  describe("Chi4v (order 4 - valence)", () => {
    it("should equal Chi4n for most molecules", () => {
      const pentane = parse("CCCCC");
      expect(getChi4v(pentane)).toBeCloseTo(getChi4n(pentane), 3);
    });
  });

  describe("Edge cases", () => {
    it("should handle single atom", () => {
      const methane = parse("C");
      expect(getChi0(methane)).toBe(0);
      expect(getChi1(methane)).toBe(0);
      expect(getChi2n(methane)).toBe(0);
    });

    it("should handle cyclic structures", () => {
      const cyclohexane = parse("C1CCCCC1");
      const chi0 = getChi0(cyclohexane);
      const chi1 = getChi1(cyclohexane);

      expect(chi0).toBeGreaterThan(0);
      expect(chi1).toBeGreaterThan(0);
    });

    it("should handle heteroatoms", () => {
      const water = parse("O");
      expect(getChi0(water)).toBe(0);
    });

    it("should handle nitrogen compounds", () => {
      const methylamine = parse("CN");
      expect(getChi0(methylamine)).toBeCloseTo(2.0, 3);
      expect(getChi0n(methylamine)).toBeCloseTo(1.5774, 3);
    });
  });

  describe("Comparison tests", () => {
    it("should show Chi0n <= Chi0 for molecules with heteroatoms", () => {
      const ethanol = parse("CCO");
      expect(getChi0n(ethanol)).toBeLessThanOrEqual(getChi0(ethanol));
    });

    it("should show Chi0 = Chi0n for pure hydrocarbons", () => {
      const butane = parse("CCCC");
      expect(getChi0n(butane)).toBeCloseTo(getChi0(butane), 3);
    });

    it("should show higher chi values for longer chains", () => {
      const propane = parse("CCC");
      const butane = parse("CCCC");
      const pentane = parse("CCCCC");

      expect(getChi0(butane)).toBeGreaterThan(getChi0(propane));
      expect(getChi0(pentane)).toBeGreaterThan(getChi0(butane));
    });
  });
});
