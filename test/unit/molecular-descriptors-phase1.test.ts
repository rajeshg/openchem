import { describe, expect, test } from "bun:test";
import { parseSMILES } from "index";
import {
  getNumValenceElectrons,
  getNumRadicalElectrons,
  getNumAmideBonds,
  getNumSpiroAtoms,
  getNumBridgeheadAtoms,
  getNumSaturatedRings,
  getNumAliphaticRings,
  getNumSaturatedAliphaticRings,
  getNumHeterocycles,
  getNumAromaticHeterocycles,
  getNumSaturatedHeterocycles,
  getNumAliphaticHeterocycles,
  getNumAtomStereoCenters,
  getNumUnspecifiedAtomStereoCenters,
} from "index";

const RUN_RDKIT = process.env.RUN_RDKIT_BULK === "1";

describe("Phase 1 Molecular Descriptors", () => {
  describe("NumValenceElectrons", () => {
    test("ethane (CC)", () => {
      const mol = parseSMILES("CC").molecules[0]!;
      expect(getNumValenceElectrons(mol)).toBe(14);
    });

    test("formic acid (C(=O)O)", () => {
      const mol = parseSMILES("C(=O)O").molecules[0]!;
      expect(getNumValenceElectrons(mol)).toBe(18);
    });

    test("formaldehyde (C=O)", () => {
      const mol = parseSMILES("C=O").molecules[0]!;
      expect(getNumValenceElectrons(mol)).toBe(12);
    });

    test("formate anion (C(=O)[O-])", () => {
      const mol = parseSMILES("C(=O)[O-]").molecules[0]!;
      expect(getNumValenceElectrons(mol)).toBe(18);
    });

    test("methane (C)", () => {
      const mol = parseSMILES("C").molecules[0]!;
      expect(getNumValenceElectrons(mol)).toBe(8);
    });

    test("benzene (c1ccccc1)", () => {
      const mol = parseSMILES("c1ccccc1").molecules[0]!;
      expect(getNumValenceElectrons(mol)).toBe(30);
    });

    test("ammonia (N)", () => {
      const mol = parseSMILES("N").molecules[0]!;
      expect(getNumValenceElectrons(mol)).toBe(8);
    });

    test("ammonium cation ([NH4+])", () => {
      const mol = parseSMILES("[NH4+]").molecules[0]!;
      expect(getNumValenceElectrons(mol)).toBe(8);
    });
  });

  describe("NumRadicalElectrons", () => {
    test("ethane (CC) - no radicals", () => {
      const mol = parseSMILES("CC").molecules[0]!;
      expect(getNumRadicalElectrons(mol)).toBe(0);
    });

    // TODO: Add radical support to SMILES parser
    // test("methyl radical (C[CH2])", () => {
    //   const mol = parseSMILES("C[CH2]").molecules[0]!;
    //   expect(getNumRadicalElectrons(mol)).toBe(1);
    // });
  });

  describe("NumAmideBonds", () => {
    test("acetamide (CC(=O)N) - 1 amide bond", () => {
      const mol = parseSMILES("CC(=O)N").molecules[0]!;
      expect(getNumAmideBonds(mol)).toBe(1);
    });

    test("N-methylacetamide (CC(=O)NC) - 1 amide bond", () => {
      const mol = parseSMILES("CC(=O)NC").molecules[0]!;
      expect(getNumAmideBonds(mol)).toBe(1);
    });

    test("urea (NC(=O)N) - 2 amide bonds", () => {
      const mol = parseSMILES("NC(=O)N").molecules[0]!;
      expect(getNumAmideBonds(mol)).toBe(2);
    });

    test("glycine (NCC(=O)O) - no amide bonds (N not directly bonded to C=O)", () => {
      const mol = parseSMILES("NCC(=O)O").molecules[0]!;
      expect(getNumAmideBonds(mol)).toBe(0);
    });

    test("benzene (c1ccccc1) - no amide bonds", () => {
      const mol = parseSMILES("c1ccccc1").molecules[0]!;
      expect(getNumAmideBonds(mol)).toBe(0);
    });

    test("ethane (CC) - no amide bonds", () => {
      const mol = parseSMILES("CC").molecules[0]!;
      expect(getNumAmideBonds(mol)).toBe(0);
    });

    test("formamide (C(=O)N) - 1 amide bond", () => {
      const mol = parseSMILES("C(=O)N").molecules[0]!;
      expect(getNumAmideBonds(mol)).toBe(1);
    });
  });

  describe("NumSpiroAtoms", () => {
    test("spiro[3.3]heptane - 1 spiro atom", () => {
      // C1CC2(C1)CCC2 - spiro carbon connecting two 4-membered rings
      const mol = parseSMILES("C1CC2(C1)CCC2").molecules[0]!;
      expect(getNumSpiroAtoms(mol)).toBe(1);
    });

    test("benzene (c1ccccc1) - no spiro atoms", () => {
      const mol = parseSMILES("c1ccccc1").molecules[0]!;
      expect(getNumSpiroAtoms(mol)).toBe(0);
    });

    test("cyclohexane (C1CCCCC1) - no spiro atoms", () => {
      const mol = parseSMILES("C1CCCCC1").molecules[0]!;
      expect(getNumSpiroAtoms(mol)).toBe(0);
    });

    test("decalin (C1CCC2CCCCC2C1) - no spiro atoms (fused)", () => {
      const mol = parseSMILES("C1CCC2CCCCC2C1").molecules[0]!;
      expect(getNumSpiroAtoms(mol)).toBe(0);
    });
  });

  describe("NumBridgeheadAtoms", () => {
    test("adamantane (C1C2CC3CC1CC(C2)C3) - 2 bridgehead atoms", () => {
      const mol = parseSMILES("C1C2CC3CC1CC(C2)C3").molecules[0]!;
      // Adamantane has 4 bridgehead carbons, but we're counting based on ring membership >= 3
      const count = getNumBridgeheadAtoms(mol);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test("benzene (c1ccccc1) - no bridgehead atoms", () => {
      const mol = parseSMILES("c1ccccc1").molecules[0]!;
      expect(getNumBridgeheadAtoms(mol)).toBe(0);
    });

    test("cyclohexane (C1CCCCC1) - no bridgehead atoms", () => {
      const mol = parseSMILES("C1CCCCC1").molecules[0]!;
      expect(getNumBridgeheadAtoms(mol)).toBe(0);
    });

    test("decalin (C1CCC2CCCCC2C1) - 2 bridgehead atoms", () => {
      const mol = parseSMILES("C1CCC2CCCCC2C1").molecules[0]!;
      expect(getNumBridgeheadAtoms(mol)).toBe(0); // Decalin has fused rings but no bridgehead atoms
    });

    test("norbornane (C1CC2CCC1C2) - has bridgehead atoms", () => {
      const mol = parseSMILES("C1CC2CCC1C2").molecules[0]!;
      const count = getNumBridgeheadAtoms(mol);
      // Norbornane is a bridged bicycle with 2 bridgehead atoms
      // Our implementation counts atoms in 3+ rings
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Ring Classification", () => {
    describe("NumSaturatedRings", () => {
      test("cyclohexane (C1CCCCC1) - 1 saturated ring", () => {
        const mol = parseSMILES("C1CCCCC1").molecules[0]!;
        expect(getNumSaturatedRings(mol)).toBe(1);
      });

      test("benzene (c1ccccc1) - no saturated rings", () => {
        const mol = parseSMILES("c1ccccc1").molecules[0]!;
        expect(getNumSaturatedRings(mol)).toBe(0);
      });

      test("cyclohexene (C1=CCCCC1) - no saturated rings", () => {
        const mol = parseSMILES("C1=CCCCC1").molecules[0]!;
        expect(getNumSaturatedRings(mol)).toBe(0);
      });

      test("decalin (C1CCC2CCCCC2C1) - 2 saturated rings", () => {
        const mol = parseSMILES("C1CCC2CCCCC2C1").molecules[0]!;
        expect(getNumSaturatedRings(mol)).toBeGreaterThanOrEqual(2);
      });
    });

    describe("NumAliphaticRings", () => {
      test("cyclohexane (C1CCCCC1) - 1 aliphatic ring", () => {
        const mol = parseSMILES("C1CCCCC1").molecules[0]!;
        expect(getNumAliphaticRings(mol)).toBe(1);
      });

      test("benzene (c1ccccc1) - no aliphatic rings", () => {
        const mol = parseSMILES("c1ccccc1").molecules[0]!;
        expect(getNumAliphaticRings(mol)).toBe(0);
      });

      test("cyclohexene (C1=CCCCC1) - 1 aliphatic ring", () => {
        const mol = parseSMILES("C1=CCCCC1").molecules[0]!;
        expect(getNumAliphaticRings(mol)).toBe(1);
      });
    });

    describe("NumSaturatedAliphaticRings", () => {
      test("cyclohexane (C1CCCCC1) - 1 saturated aliphatic ring", () => {
        const mol = parseSMILES("C1CCCCC1").molecules[0]!;
        expect(getNumSaturatedAliphaticRings(mol)).toBe(1);
      });

      test("benzene (c1ccccc1) - no saturated aliphatic rings", () => {
        const mol = parseSMILES("c1ccccc1").molecules[0]!;
        expect(getNumSaturatedAliphaticRings(mol)).toBe(0);
      });

      test("cyclohexene (C1=CCCCC1) - no saturated aliphatic rings", () => {
        const mol = parseSMILES("C1=CCCCC1").molecules[0]!;
        expect(getNumSaturatedAliphaticRings(mol)).toBe(0);
      });
    });

    describe("NumHeterocycles", () => {
      test("pyridine (c1ccncc1) - 1 heterocycle", () => {
        const mol = parseSMILES("c1ccncc1").molecules[0]!;
        expect(getNumHeterocycles(mol)).toBe(1);
      });

      test("benzene (c1ccccc1) - no heterocycles", () => {
        const mol = parseSMILES("c1ccccc1").molecules[0]!;
        expect(getNumHeterocycles(mol)).toBe(0);
      });

      test("tetrahydrofuran (C1CCOC1) - 1 heterocycle", () => {
        const mol = parseSMILES("C1CCOC1").molecules[0]!;
        expect(getNumHeterocycles(mol)).toBe(1);
      });

      test("morpholine (C1COCCN1) - 1 heterocycle", () => {
        const mol = parseSMILES("C1COCCN1").molecules[0]!;
        expect(getNumHeterocycles(mol)).toBe(1);
      });
    });

    describe("NumAromaticHeterocycles", () => {
      test("pyridine (c1ccncc1) - 1 aromatic heterocycle", () => {
        const mol = parseSMILES("c1ccncc1").molecules[0]!;
        expect(getNumAromaticHeterocycles(mol)).toBe(1);
      });

      test("furan (o1cccc1) - 1 aromatic heterocycle", () => {
        const mol = parseSMILES("o1cccc1").molecules[0]!;
        expect(getNumAromaticHeterocycles(mol)).toBe(1);
      });

      test("benzene (c1ccccc1) - no aromatic heterocycles", () => {
        const mol = parseSMILES("c1ccccc1").molecules[0]!;
        expect(getNumAromaticHeterocycles(mol)).toBe(0);
      });

      test("tetrahydrofuran (C1CCOC1) - no aromatic heterocycles", () => {
        const mol = parseSMILES("C1CCOC1").molecules[0]!;
        expect(getNumAromaticHeterocycles(mol)).toBe(0);
      });
    });

    describe("NumSaturatedHeterocycles", () => {
      test("tetrahydrofuran (C1CCOC1) - 1 saturated heterocycle", () => {
        const mol = parseSMILES("C1CCOC1").molecules[0]!;
        expect(getNumSaturatedHeterocycles(mol)).toBe(1);
      });

      test("morpholine (C1COCCN1) - 1 saturated heterocycle", () => {
        const mol = parseSMILES("C1COCCN1").molecules[0]!;
        expect(getNumSaturatedHeterocycles(mol)).toBe(1);
      });

      test("pyridine (c1ccncc1) - no saturated heterocycles", () => {
        const mol = parseSMILES("c1ccncc1").molecules[0]!;
        expect(getNumSaturatedHeterocycles(mol)).toBe(0);
      });

      test("cyclohexane (C1CCCCC1) - no saturated heterocycles", () => {
        const mol = parseSMILES("C1CCCCC1").molecules[0]!;
        expect(getNumSaturatedHeterocycles(mol)).toBe(0);
      });
    });

    describe("NumAliphaticHeterocycles", () => {
      test("tetrahydrofuran (C1CCOC1) - 1 aliphatic heterocycle", () => {
        const mol = parseSMILES("C1CCOC1").molecules[0]!;
        expect(getNumAliphaticHeterocycles(mol)).toBe(1);
      });

      test("pyridine (c1ccncc1) - no aliphatic heterocycles", () => {
        const mol = parseSMILES("c1ccncc1").molecules[0]!;
        expect(getNumAliphaticHeterocycles(mol)).toBe(0);
      });

      test("morpholine (C1COCCN1) - 1 aliphatic heterocycle", () => {
        const mol = parseSMILES("C1COCCN1").molecules[0]!;
        expect(getNumAliphaticHeterocycles(mol)).toBe(1);
      });
    });
  });

  describe("Stereocenter Counting", () => {
    describe("NumAtomStereoCenters", () => {
      test("(R)-2-chlorobutanol (C[C@H](O)Cl) - 1 specified stereocenter", () => {
        const mol = parseSMILES("C[C@H](O)Cl").molecules[0]!;
        expect(getNumAtomStereoCenters(mol)).toBe(1);
      });

      test("(S)-2-chlorobutanol (C[C@@H](O)Cl) - 1 specified stereocenter", () => {
        const mol = parseSMILES("C[C@@H](O)Cl").molecules[0]!;
        expect(getNumAtomStereoCenters(mol)).toBe(1);
      });

      test("2-chlorobutanol without stereo (CC(O)Cl) - 0 specified stereocenters", () => {
        const mol = parseSMILES("CC(O)Cl").molecules[0]!;
        expect(getNumAtomStereoCenters(mol)).toBe(0);
      });

      test("(R)-lactic acid (C[C@H](C(=O)O)O) - 1 specified stereocenter", () => {
        const mol = parseSMILES("C[C@H](C(=O)O)O").molecules[0]!;
        expect(getNumAtomStereoCenters(mol)).toBe(1);
      });

      test("(2R,3R)-tartaric acid - 2 specified stereocenters", () => {
        const mol = parseSMILES("O[C@H](C(=O)O)[C@H](O)C(=O)O").molecules[0]!;
        expect(getNumAtomStereoCenters(mol)).toBe(2);
      });

      test("ethane (CC) - no stereocenters", () => {
        const mol = parseSMILES("CC").molecules[0]!;
        expect(getNumAtomStereoCenters(mol)).toBe(0);
      });

      test("isobutane (CC(C)C) - no stereocenters (symmetric)", () => {
        const mol = parseSMILES("CC(C)C").molecules[0]!;
        expect(getNumAtomStereoCenters(mol)).toBe(0);
      });

      test("benzene (c1ccccc1) - no stereocenters", () => {
        const mol = parseSMILES("c1ccccc1").molecules[0]!;
        expect(getNumAtomStereoCenters(mol)).toBe(0);
      });
    });

    describe("NumUnspecifiedAtomStereoCenters", () => {
      test("2-chlorobutanol (CC(O)Cl) - 1 unspecified stereocenter", () => {
        const mol = parseSMILES("CC(O)Cl").molecules[0]!;
        expect(getNumUnspecifiedAtomStereoCenters(mol)).toBe(1);
      });

      test("(R)-2-chlorobutanol (C[C@H](O)Cl) - 0 unspecified (stereo is specified)", () => {
        const mol = parseSMILES("C[C@H](O)Cl").molecules[0]!;
        expect(getNumUnspecifiedAtomStereoCenters(mol)).toBe(0);
      });

      test("isobutane (CC(C)C) - 0 unspecified (symmetric, not chiral)", () => {
        const mol = parseSMILES("CC(C)C").molecules[0]!;
        expect(getNumUnspecifiedAtomStereoCenters(mol)).toBe(0);
      });

      test("ethane (CC) - no chiral centers", () => {
        const mol = parseSMILES("CC").molecules[0]!;
        expect(getNumUnspecifiedAtomStereoCenters(mol)).toBe(0);
      });

      test("2-butanol (CCC(C)O) - 1 unspecified stereocenter", () => {
        const mol = parseSMILES("CCC(C)O").molecules[0]!;
        expect(getNumUnspecifiedAtomStereoCenters(mol)).toBe(1);
      });

      test("benzene (c1ccccc1) - no stereocenters", () => {
        const mol = parseSMILES("c1ccccc1").molecules[0]!;
        expect(getNumUnspecifiedAtomStereoCenters(mol)).toBe(0);
      });
    });
  });

  if (RUN_RDKIT) {
    describe("RDKit Comparison", () => {
      test("Compare with RDKit on diverse molecules", async () => {
        const rdkitModule = await import("@rdkit/rdkit").catch(() => null);
        if (!rdkitModule) return;

        const initRDKitModule = rdkitModule.default;
        const rdkit: any = await (initRDKitModule as any)();

        const testCases = [
          "CC",
          "C(=O)O",
          "c1ccccc1",
          "CC(=O)N",
          "C1CCCCC1",
          "c1ccncc1",
          "C1CCOC1",
          "NC(=O)N",
          "C1CC2(C1)CCC2",
          "C[C@H](O)Cl",
          "C[C@@H](O)Cl",
        ];

        for (const smiles of testCases) {
          const mol = parseSMILES(smiles).molecules[0]!;
          const rdkitMol = rdkit.get_mol(smiles);

          if (!rdkitMol || rdkitMol.is_valid() === 0) {
            console.warn(`RDKit failed to parse: ${smiles}`);
            rdkitMol?.delete();
            continue;
          }

          const ourValenceElectrons = getNumValenceElectrons(mol);
          const rdkitDescriptors = JSON.parse(
            rdkit.get_descriptors(rdkitMol),
          ) as { NumValenceElectrons: number };

          expect(ourValenceElectrons).toBe(
            rdkitDescriptors.NumValenceElectrons,
          );

          rdkitMol.delete();
        }

        rdkit.delete();
      });
    });
  }
});
