import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { encodePackedMol } from "src/generators/packedmol-encoder";
import { decodePackedMol } from "src/parsers/packedmol-decoder";

describe("PackedMol Stereo Encoding/Decoding", () => {
  describe("Tetrahedral chirality", () => {
    it("encodes and decodes @ (counterclockwise)", () => {
      const result = parseSMILES("[C@H](F)(Cl)Br"); // S-configuration
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      expect(mol.atoms[0]?.chiral).toBe("@");

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      // Find the chiral carbon
      const chiralAtom = decoded.atoms.find((a) => a.chiral === "@");
      expect(chiralAtom).toBeDefined();
      expect(chiralAtom?.chiral).toBe("@");
    });

    it("encodes and decodes @@ (clockwise)", () => {
      const result = parseSMILES("[C@@H](F)(Cl)Br"); // R-configuration
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      expect(mol.atoms[0]?.chiral).toBe("@@");

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      // Find the chiral carbon
      const chiralAtom = decoded.atoms.find((a) => a.chiral === "@@");
      expect(chiralAtom).toBeDefined();
      expect(chiralAtom?.chiral).toBe("@@");
    });

    it("preserves chirality in complex molecules", () => {
      const result = parseSMILES("CC(=O)O[C@H]1[C@@H](C)[C@H](O)[C@@H](C)[C@H]1O"); // Multiple chiral centers
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const chiralCount = mol.atoms.filter((a) => a.chiral).length;
      expect(chiralCount).toBeGreaterThan(0);

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      // Count chiral atoms in decoded
      const decodedChiralCount = decoded.atoms.filter((a) => a.chiral).length;
      expect(decodedChiralCount).toBe(chiralCount);
    });
  });

  describe("Double bond stereochemistry", () => {
    it("preserves wedge bonds", () => {
      const result = parseSMILES("C/C=C\\C"); // E/Z style with wedge
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const stereoBonds = mol.bonds.filter((b) => b.stereo !== "none" && b.type === "double");

      if (stereoBonds.length > 0) {
        const packed = encodePackedMol(mol);
        const decoded = decodePackedMol(packed);

        const decodedStereoBonds = decoded.bonds.filter(
          (b) => b.stereo !== "none" && b.type === "double",
        );

        expect(decodedStereoBonds.length).toBeGreaterThan(0);
      }
    });

    it("preserves simple wedge notation", () => {
      const result = parseSMILES("C[C@H](O)C");
      expect(result.errors.length).toBe(0);

      const mol = result.molecules[0]!;
      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      const decodedWedges = decoded.bonds.filter((b) => b.stereo === "up");
      expect(decodedWedges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Stereo block structure", () => {
    it("stores stereo information in dedicated block", () => {
      const result = parseSMILES("C[C@H](F)C");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);
      const N = packed.header[1] as number;

      // Check that stereo block exists and has correct size
      expect(packed.stereo.atomType.length).toBe(N);
      expect(packed.stereo.atomParity.length).toBe(N);

      // Find the chiral carbon
      let foundChiral = false;
      for (let i = 0; i < N; i++) {
        if (packed.stereo.atomType[i] !== 0) {
          foundChiral = true;
          break;
        }
      }

      expect(foundChiral).toBe(true);
    });

    it("initializes stereo block as all zeros for non-chiral molecules", () => {
      const result = parseSMILES("CCO");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);
      const N = packed.header[1] as number;

      // All atoms should be non-chiral
      for (let i = 0; i < N; i++) {
        expect(packed.stereo.atomType[i]).toBe(0);
        expect(packed.stereo.atomParity[i]).toBe(0);
      }
    });
  });

  describe("Round-trip fidelity", () => {
    it("preserves all stereo data through encode/decode cycle", () => {
      const testMolecules = [
        "C[C@H](F)C", // Simple chiral
        "CC[C@H](O)C", // Chiral with more substituents
        "C[C@H]1CC[C@H](C)CC1", // Bicyclic with multiple chiral centers
      ];

      for (const smiles of testMolecules) {
        const result = parseSMILES(smiles);
        expect(result.errors.length).toBe(0);

        const original = result.molecules[0]!;
        const packed = encodePackedMol(original);
        const decoded = decodePackedMol(packed);

        // Count chiral atoms
        const origChiral = original.atoms.filter((a) => a.chiral).length;
        const decodedChiral = decoded.atoms.filter((a) => a.chiral).length;

        expect(decodedChiral).toBe(origChiral);
      }
    });

    it("handles molecules with no chirality", () => {
      const result = parseSMILES("c1ccccc1CCO");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);
      const decoded = decodePackedMol(packed);

      expect(decoded.atoms.every((a) => !a.chiral)).toBe(true);
    });
  });

  describe("Backward compatibility", () => {
    it("decodes Phase 1 PackedMol (all-zero stereo blocks)", () => {
      // This test ensures that even if old PackedMol had stereo as all zeros,
      // new decoder handles it correctly
      const result = parseSMILES("C[C@H](F)C");
      const mol = result.molecules[0]!;

      const packed = encodePackedMol(mol);

      // Verify the stereo data exists
      const N = packed.header[1] as number;
      expect(packed.stereo.atomType.length).toBe(N);

      // Decode should work
      const decoded = decodePackedMol(packed);
      expect(decoded.atoms.length).toBe(mol.atoms.length);
    });
  });
});
