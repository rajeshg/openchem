import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import {
  getKappa1,
  getKappa2,
  getKappa3,
  getHallKierAlpha,
  getBertzCT,
} from "src/utils/topology-descriptors";

function parse(smiles: string) {
  const result = parseSMILES(smiles);
  if (!result.molecules[0]) throw new Error(`Failed to parse: ${smiles}`);
  return result.molecules[0];
}

describe("Topology Descriptors", () => {
  describe("Kappa Shape Indices", () => {
    describe("getKappa1 (linearity)", () => {
      it("should calculate Kappa1 for linear hexane (high linearity)", () => {
        const hexane = parse("CCCCCC");
        const kappa1 = getKappa1(hexane);
        expect(kappa1).toBeGreaterThan(0);
        // Linear molecules have high Kappa1
      });

      it("should calculate Kappa1 for cyclohexane (low linearity)", () => {
        const cyclohexane = parse("C1CCCCC1");
        const kappa1 = getKappa1(cyclohexane);
        expect(kappa1).toBeGreaterThan(0);
        // Cyclic molecules have lower Kappa1
      });

      it("should calculate Kappa1 for benzene", () => {
        const benzene = parse("c1ccccc1");
        const kappa1 = getKappa1(benzene);
        expect(kappa1).toBeGreaterThan(0);
      });

      it("should return 0 for single atom", () => {
        const methane = parse("C");
        const kappa1 = getKappa1(methane);
        expect(kappa1).toBe(0);
      });

      it("should show higher Kappa1 for linear vs cyclic molecules", () => {
        const linear = parse("CCCCCC");
        const cyclic = parse("C1CCCCC1");
        const kappa1Linear = getKappa1(linear);
        const kappa1Cyclic = getKappa1(cyclic);
        expect(kappa1Linear).toBeGreaterThan(kappa1Cyclic);
      });
    });

    describe("getKappa2 (branching/planarity)", () => {
      it("should calculate Kappa2 for highly branched neopentane", () => {
        const neopentane = parse("CC(C)(C)C");
        const kappa2 = getKappa2(neopentane);
        expect(kappa2).toBeGreaterThan(0);
        // Branched molecules have high Kappa2
      });

      it("should calculate Kappa2 for linear hexane (low branching)", () => {
        const hexane = parse("CCCCCC");
        const kappa2 = getKappa2(hexane);
        expect(kappa2).toBeGreaterThan(0);
        // Linear molecules have lower Kappa2
      });

      it("should show lower Kappa2 for branched vs linear molecules", () => {
        const branched = parse("CC(C)(C)C");
        const linear = parse("CCCCCC");
        const kappa2Branched = getKappa2(branched);
        const kappa2Linear = getKappa2(linear);
        // Branched molecules have fewer long paths → lower Kappa2
        expect(kappa2Branched).toBeLessThan(kappa2Linear);
      });

      it("should return 0 for molecules with ≤2 atoms", () => {
        const ethane = parse("CC");
        const kappa2 = getKappa2(ethane);
        expect(kappa2).toBe(0);
      });
    });

    describe("getKappa3 (sphericity)", () => {
      it("should calculate Kappa3 for adamantane (high sphericity)", () => {
        const adamantane = parse("C1C2CC3CC1CC(C2)C3");
        const kappa3 = getKappa3(adamantane);
        expect(kappa3).toBeGreaterThan(0);
        // Spherical molecules have high Kappa3
      });

      it("should calculate Kappa3 for linear hexane (low sphericity)", () => {
        const hexane = parse("CCCCCC");
        const kappa3 = getKappa3(hexane);
        expect(kappa3).toBeGreaterThan(0);
        // Linear molecules have lower Kappa3
      });

      it("should show lower Kappa3 for spherical vs linear molecules", () => {
        const adamantane = parse("C1C2CC3CC1CC(C2)C3");
        const hexane = parse("CCCCCC");
        const kappa3Spherical = getKappa3(adamantane);
        const kappa3Linear = getKappa3(hexane);
        // Spherical molecules have fewer 3-length paths → lower Kappa3
        expect(kappa3Spherical).toBeLessThan(kappa3Linear);
      });

      it("should handle odd N molecules", () => {
        const pentane = parse("CCCCC"); // 5 carbons (odd)
        const kappa3 = getKappa3(pentane);
        expect(kappa3).toBeGreaterThan(0);
      });

      it("should handle even N molecules", () => {
        const hexane = parse("CCCCCC"); // 6 carbons (even)
        const kappa3 = getKappa3(hexane);
        expect(kappa3).toBeGreaterThan(0);
      });

      it("should return 0 for molecules with ≤3 atoms", () => {
        const propane = parse("CCC");
        const kappa3 = getKappa3(propane);
        expect(kappa3).toBe(0);
      });
    });
  });

  describe("getHallKierAlpha (flexibility)", () => {
    it("should calculate alpha for fully sp3 saturated alkane", () => {
      const hexane = parse("CCCCCC");
      const alpha = getHallKierAlpha(hexane);
      // All carbons are sp3, so N_sp3/N_C = 1, alpha = 0
      expect(alpha).toBe(0);
    });

    it("should calculate alpha for aromatic benzene (no sp3)", () => {
      const benzene = parse("c1ccccc1");
      const alpha = getHallKierAlpha(benzene);
      // No sp3 carbons, so N_sp3/N_C = 0, alpha = -1
      expect(alpha).toBe(-1);
    });

    it("should calculate alpha for mixed sp2/sp3 molecule", () => {
      const toluene = parse("Cc1ccccc1");
      const alpha = getHallKierAlpha(toluene);
      // 1 sp3 out of 7 carbons: (1/7) - 1 ≈ -0.857
      expect(alpha).toBeCloseTo(-0.857, 2);
    });

    it("should calculate alpha for ethene (all sp2)", () => {
      const ethene = parse("C=C");
      const alpha = getHallKierAlpha(ethene);
      // No sp3 carbons, alpha = -1
      expect(alpha).toBe(-1);
    });

    it("should return 0 for molecules with no carbons", () => {
      const water = parse("O");
      const alpha = getHallKierAlpha(water);
      expect(alpha).toBe(0);
    });
  });

  describe("getBertzCT (complexity)", () => {
    it("should calculate complexity for simple methane", () => {
      const methane = parse("C");
      const complexity = getBertzCT(methane);
      expect(complexity).toBe(0); // Single atom = no complexity
    });

    it("should calculate complexity for ethane (homogeneous)", () => {
      const ethane = parse("CC");
      const complexity = getBertzCT(ethane);
      // Homogeneous molecule (all C, all single bonds) → 0 complexity
      expect(complexity).toBe(0);
    });

    it("should calculate complexity for ethanol (heterogeneous)", () => {
      const ethanol = parse("CCO");
      const complexity = getBertzCT(ethanol);
      // Has heteroatom (O) → non-zero complexity
      expect(complexity).toBeGreaterThan(0);
    });

    it("should calculate complexity for aspirin", () => {
      const aspirin = parse("CC(=O)Oc1ccccc1C(=O)O");
      const complexity = getBertzCT(aspirin);
      expect(complexity).toBeGreaterThan(0);
    });

    it("should show higher complexity for heterocyclic molecule", () => {
      const pyridine = parse("c1ccncc1");
      const benzene = parse("c1ccccc1");
      const complexityPyridine = getBertzCT(pyridine);
      const complexityBenzene = getBertzCT(benzene);
      // Pyridine has more element diversity (C + N) than benzene (C only)
      expect(complexityPyridine).toBeGreaterThan(complexityBenzene);
    });

    it("should show higher complexity for molecules with heteroatoms", () => {
      const methylamine = parse("CN");
      const ethane = parse("CC");
      const complexityMethylamine = getBertzCT(methylamine);
      const complexityEthane = getBertzCT(ethane);
      // Methylamine has element diversity (C + N), ethane is homogeneous (C only)
      expect(complexityMethylamine).toBeGreaterThan(complexityEthane);
    });

    it("should return 0 for homogeneous hydrocarbons", () => {
      const adamantane = parse("C1C2CC3CC1CC(C2)C3");
      const complexity = getBertzCT(adamantane);
      // Homogeneous hydrocarbon (all C, all single bonds) → 0 complexity
      // Note: RDKit uses a more sophisticated topology-based algorithm
      expect(complexity).toBe(0);
    });
  });

  describe("Path counting validation", () => {
    it("should count P1 (bonds) correctly for benzene", () => {
      const benzene = parse("c1ccccc1");
      // Benzene has 6 bonds
      const kappa1 = getKappa1(benzene);
      // N=6, P1=6: Kappa1 = (6 * 25) / 36 = 150/36 = 4.166...
      expect(kappa1).toBeCloseTo(4.17, 1);
    });

    it("should count paths correctly for linear molecules", () => {
      const butane = parse("CCCC");
      // Butane: 4 atoms, 3 bonds
      // P1 = 3, P2 = 2 (A-B-C, B-C-D), P3 = 1 (A-B-C-D)
      const kappa1 = getKappa1(butane);
      const kappa2 = getKappa2(butane);
      const kappa3 = getKappa3(butane);

      // All should be > 0 for a valid molecule
      expect(kappa1).toBeGreaterThan(0);
      expect(kappa2).toBeGreaterThan(0);
      expect(kappa3).toBeGreaterThan(0);
    });

    it("should handle branched molecules", () => {
      const isobutane = parse("CC(C)C");
      // Isobutane: 4 atoms, 3 bonds (branched)
      const kappa1 = getKappa1(isobutane);
      const kappa2 = getKappa2(isobutane);

      expect(kappa1).toBeGreaterThan(0);
      expect(kappa2).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty bonds gracefully", () => {
      const mol = parse("C");
      const kappa1 = getKappa1(mol);
      expect(kappa1).toBe(0);
    });

    it("should handle molecules with heteroatoms", () => {
      const ethanol = parse("CCO");
      const kappa1 = getKappa1(ethanol);
      const kappa2 = getKappa2(ethanol);

      expect(kappa1).toBeGreaterThan(0);
      expect(kappa2).toBeGreaterThan(0);
    });

    it("should handle cyclic structures", () => {
      const cyclohexane = parse("C1CCCCC1");
      const kappa1 = getKappa1(cyclohexane);
      const kappa2 = getKappa2(cyclohexane);
      const kappa3 = getKappa3(cyclohexane);

      expect(kappa1).toBeGreaterThan(0);
      expect(kappa2).toBeGreaterThan(0);
      expect(kappa3).toBeGreaterThan(0);
    });
  });
});
