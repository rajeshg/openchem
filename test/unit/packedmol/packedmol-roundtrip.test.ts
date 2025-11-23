import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { encodePackedMol } from "src/generators/packedmol-encoder";
import { decodePackedMol } from "src/parsers/packedmol-decoder";
import type { BondType } from "types";

describe("PackedMol Encoder/Decoder", () => {
  describe("Simple molecules", () => {
    it("encodes and decodes methane (CH4)", () => {
      const result = parseSMILES("C");
      expect(result.errors.length).toBe(0);
      expect(result.molecules.length).toBeGreaterThan(0);

      const mol = result.molecules[0]!;
      expect(mol).toBeDefined();

      const packed = encodePackedMol(mol);
      expect(packed.buffer).toBeDefined();
      expect(packed.buffer.byteLength).toBeGreaterThan(0);

      const decoded = decodePackedMol(packed);
      expect(decoded).toBeDefined();
      expect(decoded.atoms.length).toBe(1); // Just carbon
      expect(decoded.atoms[0]?.symbol).toBe("C");
      expect(decoded.atoms[0]?.atomicNumber).toBe(6);
    });

    it("encodes and decodes ethanol (C2H6O)", () => {
      const result = parseSMILES("CCO");
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      expect(mol).toBeDefined();

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      expect(decoded.atoms.length).toBe(mol.atoms.length);
      expect(decoded.bonds.length).toBe(mol.bonds.length);

      // Check carbon atoms present
      const carbons = decoded.atoms.filter((a) => a.symbol === "C");
      expect(carbons.length).toBe(2);

      // Check oxygen present
      const oxygens = decoded.atoms.filter((a) => a.symbol === "O");
      expect(oxygens.length).toBe(1);
    });

    it("encodes and decodes benzene", () => {
      const result = parseSMILES("c1ccccc1");
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      expect(decoded.atoms.length).toBe(6);
      expect(decoded.bonds.length).toBe(6);

      // All atoms should be carbon and aromatic
      for (const atom of decoded.atoms) {
        expect(atom.symbol).toBe("C");
        expect(atom.aromatic).toBe(true);
      }
    });
  });

  describe("Memory efficiency", () => {
    it("PackedMol is significantly smaller than Molecule", () => {
      const result = parseSMILES("CC(=O)Oc1ccccc1C(=O)O"); // Aspirin
      const mol = result.molecules[0]!;
      expect(mol).toBeDefined();

      const packed = encodePackedMol(mol);

      // Estimate Molecule size (rough)
      const estimatedMoleculeSize = JSON.stringify(mol).length;
      const packedSize = packed.buffer.byteLength;

      // PackedMol should be much smaller
      expect(packedSize).toBeLessThan(estimatedMoleculeSize / 5);
    });
  });

  describe("Charged atoms", () => {
    it("encodes and decodes charged molecules", () => {
      const result = parseSMILES("[NH4+]");
      const mol = result.molecules[0]!;
      expect(mol).toBeDefined();

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      const nitrogen = decoded.atoms.find((a) => a.symbol === "N");
      expect(nitrogen).toBeDefined();
      expect(nitrogen?.charge).toBe(1);
    });
  });

  describe("Aromatic molecules", () => {
    it("preserves aromaticity", () => {
      const result = parseSMILES("c1ccccc1");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      for (const atom of decoded.atoms) {
        expect(atom.aromatic).toBe(true);
      }
    });
  });

  describe("Bond types", () => {
    it("preserves single bonds", () => {
      const result = parseSMILES("CC");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      const bondType = decoded.bonds[0]?.type;
      expect(bondType).toBe("single" as BondType);
    });

    it("preserves double bonds", () => {
      const result = parseSMILES("C=C");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      const bondType = decoded.bonds[0]?.type;
      expect(bondType).toBe("double" as BondType);
    });

    it("preserves triple bonds", () => {
      const result = parseSMILES("C#C");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      const bondType = decoded.bonds[0]?.type;
      expect(bondType).toBe("triple" as BondType);
    });
  });

  describe("Header information", () => {
    it("stores correct atom and bond counts in header", () => {
      const result = parseSMILES("CCO");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);

      expect(packed.header[1]).toBe(mol.atoms.length);
      expect(packed.header[2]).toBe(mol.bonds.length);
    });

    it("stores correct version number", () => {
      const result = parseSMILES("C");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);
      expect(packed.header[0]).toBe(1); // Version 1
    });
  });

  describe("CSR graph structure", () => {
    it("generates valid degreeOffset array", () => {
      const result = parseSMILES("CCO");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);

      const N = packed.header[1] as number;
      const degreeOffset = packed.graph.degreeOffset;

      // First element should be 0
      expect(degreeOffset[0]).toBe(0);

      // Last element should equal 2M (twice the bonds)
      const M = packed.header[2] as number;
      expect(degreeOffset[N]).toBe(2 * M);
    });
  });
});
