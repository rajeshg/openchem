import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { encodePackedMol } from "src/generators/packedmol-encoder";
import { decodePackedMol } from "src/parsers/packedmol-decoder";
import type { Atom, Bond } from "types";

/**
 * Test PackedMol encoding/decoding on realistic molecules
 * from the drug-like molecules dataset
 */
describe("PackedMol Realistic Dataset", () => {
  // Sample of realistic molecules
  const testMolecules = [
    // Aspirin
    { smiles: "CC(=O)Oc1ccccc1C(=O)O", name: "Aspirin" },
    // Ibuprofen
    { smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", name: "Ibuprofen" },
    // Caffeine
    { smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", name: "Caffeine" },
    // Paracetamol
    { smiles: "CC(=O)Nc1ccc(cc1)O", name: "Paracetamol" },
    // Naproxen
    { smiles: "COc1ccc2cc(ccc2c1)C(C)C(=O)O", name: "Naproxen" },
    // Atorvastatin (simplified)
    {
      smiles: "CC(C)c1c(C(=O)Nc2ccccc2)c(cc(c1OCC)C(F)(F)F)NC(=O)c3ccccc3",
      name: "Atorvastatin-like",
    },
    // Diclofenac
    {
      smiles: "OC(=O)Cc1ccccc1Nc2c(cccc2Cl)Cl",
      name: "Diclofenac",
    },
    // Metformin
    { smiles: "CN(C)C(=N)NC(=N)N", name: "Metformin" },
    // Lisinopril (simplified)
    {
      smiles: "NCCCCNC(=O)C(CCCCN)NC(=O)C(CCC(=O)O)NC(=O)CCC(O)=O",
      name: "Lisinopril-like",
    },
    // Simvastatin
    {
      smiles: "CCC(C)(C)C(=O)OC1CC(C)C=C2C=CC(C)C(CCC(O)CC(O)CC(=O)O)C12",
      name: "Simvastatin-like",
    },
  ];

  describe("Basic encoding/decoding", () => {
    for (const mol of testMolecules) {
      it(`round-trips ${mol.name}`, () => {
        const result = parseSMILES(mol.smiles);
        expect(result.errors.length).toBe(0);
        expect(result.molecules.length).toBeGreaterThan(0);

        const original = result.molecules[0]!;
        const packed = encodePackedMol(original);
        const decoded = decodePackedMol(packed);

        // Basic structural fidelity
        expect(decoded.atoms.length).toBe(original.atoms.length);
        expect(decoded.bonds.length).toBe(original.bonds.length);
      });
    }
  });

  describe("Atom property preservation", () => {
    for (const mol of testMolecules) {
      it(`preserves atom properties for ${mol.name}`, () => {
        const result = parseSMILES(mol.smiles);
        const original = result.molecules[0]!;
        const packed = encodePackedMol(original);
        const decoded = decodePackedMol(packed);

        // Count atoms by type (order may differ due to canonicalization)
        const countBySymbol = (atoms: readonly Atom[]) => {
          const counts: Record<string, number> = {};
          for (const atom of atoms) {
            counts[atom.symbol] = (counts[atom.symbol] ?? 0) + 1;
          }
          return counts;
        };

        const origCounts = countBySymbol(original.atoms);
        const decodedCounts = countBySymbol(decoded.atoms);

        // All atom types should match
        for (const symbol of Object.keys(origCounts)) {
          expect(decodedCounts[symbol]).toBe(origCounts[symbol]);
        }

        // Total charges should match
        const origTotalCharge = original.atoms.reduce(
          (sum, a) => sum + (a.charge ?? 0),
          0,
        );
        const decodedTotalCharge = decoded.atoms.reduce(
          (sum, a) => sum + (a.charge ?? 0),
          0,
        );
        expect(decodedTotalCharge).toBe(origTotalCharge);

        // Aromatic atom count should match
        const origAromatic = original.atoms.filter((a) => a.aromatic).length;
        const decodedAromatic = decoded.atoms.filter((a) => a.aromatic).length;
        expect(decodedAromatic).toBe(origAromatic);
      });
    }
  });

  describe("Bond property preservation", () => {
    for (const mol of testMolecules) {
      it(`preserves bond properties for ${mol.name}`, () => {
        const result = parseSMILES(mol.smiles);
        const original = result.molecules[0]!;
        const packed = encodePackedMol(original);
        const decoded = decodePackedMol(packed);

        // Count bonds by type (order may differ due to canonicalization)
        const countByType = (bonds: readonly Bond[]) => {
          const counts: Record<string, number> = {};
          for (const bond of bonds) {
            counts[bond.type] = (counts[bond.type] ?? 0) + 1;
          }
          return counts;
        };

        const origCounts = countByType(original.bonds);
        const decodedCounts = countByType(decoded.bonds);

        // All bond types should match in count
        for (const type of Object.keys(origCounts)) {
          expect(decodedCounts[type]).toBe(origCounts[type]);
        }
      });
    }
  });

  describe("Memory efficiency on realistic molecules", () => {
    it("PackedMol provides consistent compression", () => {
      const compressionRatios: number[] = [];

      for (const molDef of testMolecules) {
        const result = parseSMILES(molDef.smiles);
        const mol = result.molecules[0]!;
        const packed = encodePackedMol(mol);

        const jsonSize = JSON.stringify(mol).length;
        const packedSize = packed.buffer.byteLength;
        const ratio = packedSize / jsonSize;

        compressionRatios.push(ratio);

        // PackedMol should be significantly smaller than JSON
        expect(packedSize).toBeLessThan(jsonSize);
        expect(ratio).toBeLessThan(0.3); // At most 30% of JSON size
      }

      // Average compression ratio
      const avgRatio =
        compressionRatios.reduce((a, b) => a + b, 0) / compressionRatios.length;
      expect(avgRatio).toBeLessThan(0.25); // Target: < 25% of JSON size
    });
  });

  describe("Determinism", () => {
    it("same molecule produces identical packed representation", () => {
      const mol1 = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
      const mol2 = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;

      const packed1 = encodePackedMol(mol1);
      const packed2 = encodePackedMol(mol2);

      // Binary representation should be identical
      const view1 = new Uint8Array(packed1.buffer);
      const view2 = new Uint8Array(packed2.buffer);

      expect(view1.length).toBe(view2.length);
      for (let i = 0; i < view1.length; i++) {
        expect(view1[i]).toBe(view2[i]);
      }
    });
  });

  describe("Complex structures", () => {
    it("handles fused ring systems", () => {
      const result = parseSMILES("c1cc2c(cc1)ccc3c2cccc3"); // Anthracene
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      expect(decoded.atoms.length).toBe(mol.atoms.length);
      expect(decoded.bonds.length).toBe(mol.bonds.length);

      // All atoms should be aromatic
      for (const atom of decoded.atoms) {
        expect(atom.aromatic).toBe(true);
      }
    });

    it("handles branched structures", () => {
      const result = parseSMILES("CC(C)(C)C(C)(C)C(C)(C)C"); // Neopentane derivative
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      expect(decoded.atoms.length).toBe(mol.atoms.length);
      expect(decoded.bonds.length).toBe(mol.bonds.length);
    });

    it("handles heterocycles", () => {
      const result = parseSMILES("c1cnc2c(c1)ccc(n2)C"); // Quinoline derivative
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      expect(decoded.atoms.length).toBe(mol.atoms.length);
      expect(decoded.bonds.length).toBe(mol.bonds.length);

      // Check for nitrogen atoms
      const nitrogens = decoded.atoms.filter((a) => a.symbol === "N");
      expect(nitrogens.length).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("handles charged molecules", () => {
      const result = parseSMILES("[NH4+]");
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      const nitrogen = decoded.atoms.find((a) => a.symbol === "N");
      expect(nitrogen?.charge).toBe(1);
    });

    it("handles multiple charge states", () => {
      const result = parseSMILES("[O-]CC(=O)[O-]");
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      const negativeCharges = decoded.atoms.filter((a) => a.charge === -1);
      expect(negativeCharges.length).toBe(2);
    });

    it("handles isotopes", () => {
      const result = parseSMILES("[13C]C");
      const mol = result.molecules[0]!;
      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      const isotopicCarbon = decoded.atoms.find(
        (a) => a.isotope && a.isotope > 0,
      );
      expect(isotopicCarbon).toBeDefined();
      expect(isotopicCarbon?.isotope).toBe(13);
    });
  });
});
