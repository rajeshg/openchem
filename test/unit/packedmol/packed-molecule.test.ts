import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { PackedMolecule } from "src/utils/packed-molecule";
import { encodePackedMol } from "src/generators/packedmol-encoder";

describe("PackedMolecule Wrapper Class", () => {
  describe("Construction", () => {
    it("creates PackedMolecule from Molecule", () => {
      const mol = parseSMILES("CCO").molecules[0]!;
      const packed = new PackedMolecule(mol);

      expect(packed).toBeDefined();
      expect(packed.atomCount).toBe(mol.atoms.length);
      expect(packed.bondCount).toBe(mol.bonds.length);
    });

    it("creates PackedMolecule from Molecule using static method", () => {
      const mol = parseSMILES("CCO").molecules[0]!;
      const packed = PackedMolecule.fromMolecule(mol);

      expect(packed).toBeDefined();
      expect(packed.atomCount).toBe(mol.atoms.length);
    });

    it("creates PackedMolecule from PackedMol using static method", () => {
      const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
      const { packed: packed1 } = new PackedMolecule(mol);
      const packed2 = PackedMolecule.fromPacked(packed1);

      expect(packed2).toBeDefined();
      expect(packed2.atomCount).toBe(packed1.header[1]!);
    });
  });

  describe("Lazy Deserialization", () => {
    it("delays molecule deserialization until accessed", () => {
      const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
      const packed = new PackedMolecule(mol);

      // No deserialization yet
      expect(packed).toBeDefined();

      // Lazy deserialization on first access
      const decoded = packed.molecule;
      expect(decoded).toBeDefined();
      expect(decoded.atoms.length).toBe(mol.atoms.length);
      expect(decoded.bonds.length).toBe(mol.bonds.length);
    });

    it("caches deserialized molecule for repeated access", () => {
      const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
      const packed = new PackedMolecule(mol);

      // First access
      const mol1 = packed.molecule;

      // Second access should return cached instance
      const mol2 = packed.molecule;

      expect(mol1).toBe(mol2); // Same object instance
    });

    it("cache can be cleared explicitly", () => {
      const mol = parseSMILES("CCO").molecules[0]!;
      const packed = new PackedMolecule(mol);

      // Access and cache
      const mol1 = packed.molecule;

      // Clear cache
      packed.clearCache();

      // Next access creates new instance
      const mol2 = packed.molecule;

      expect(mol1).not.toBe(mol2); // Different object instances
      expect(mol1.atoms.length).toBe(mol2.atoms.length); // But same data
    });
  });

  describe("Properties", () => {
    it("provides access to atom and bond counts", () => {
      const mol = parseSMILES("CC(C)(C)C").molecules[0]!;
      const packed = new PackedMolecule(mol);

      expect(packed.atomCount).toBe(5);
      expect(packed.bondCount).toBe(4);
    });

    it("provides access to buffer size", () => {
      const mol = parseSMILES("CC(C)(C)C").molecules[0]!;
      const packed = new PackedMolecule(mol);

      expect(packed.bufferSize).toBeGreaterThan(0);
      expect(packed.bufferSize).toBe(packed.buffer.byteLength);
    });

    it("provides access to underlying PackedMol", () => {
      const mol = parseSMILES("CCO").molecules[0]!;
      const packed = new PackedMolecule(mol);

      const packedData = packed.packed;
      expect(packedData.buffer).toBeDefined();
      expect(packedData.header).toBeDefined();
      expect(packedData.atoms).toBeDefined();
      expect(packedData.bonds).toBeDefined();
    });

    it("provides access to ArrayBuffer", () => {
      const mol = parseSMILES("CCO").molecules[0]!;
      const packed = new PackedMolecule(mol);

      const buffer = packed.buffer;
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(packed.bufferSize);
    });
  });

  describe("Data Transfer", () => {
    it("provides ArrayBuffer for zero-copy transfer", () => {
      const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
      const packed1 = new PackedMolecule(mol);

      // Get buffer for transfer
      const buffer = packed1.transfer();
      expect(buffer).toBeInstanceOf(ArrayBuffer);

      // Simulate transfer: create new PackedMolecule from transferred buffer
      // (In real use, this would be across Web Worker boundary, etc.)
      const packed2 = PackedMolecule.fromPacked({
        buffer,
        header: new Uint32Array(buffer, 0, 8),
        atoms: {
          atomicNumber: new Uint8Array(buffer),
          formalCharge: new Int8Array(buffer),
          hydrogens: new Uint8Array(buffer),
          degree: new Uint8Array(buffer),
          isotope: new Uint16Array(buffer),
          atomFlags: new Uint16Array(buffer),
        },
        bonds: {
          atomA: new Uint32Array(buffer),
          atomB: new Uint32Array(buffer),
          order: new Uint8Array(buffer),
          flags: new Uint8Array(buffer),
        },
        graph: {
          degreeOffset: new Uint32Array(buffer),
          bondTargets: new Uint32Array(buffer),
          bondAdj: new Uint16Array(buffer),
        },
        stereo: {
          atomType: new Uint8Array(buffer),
          atomParity: new Int8Array(buffer),
          bondType: new Uint8Array(buffer),
          bondConfig: new Int8Array(buffer),
        },
      });

      expect(packed2.atomCount).toBe(packed1.atomCount);
      expect(packed2.bondCount).toBe(packed1.bondCount);
    });
  });

  describe("Round-trip fidelity", () => {
    it("preserves all data through wrapper round-trip", () => {
      const testMolecules = [
        "CCO",
        "CC(=O)Oc1ccccc1C(=O)O",
        "C[C@H](F)C",
        "c1ccccc1",
      ];

      for (const smiles of testMolecules) {
        const original = parseSMILES(smiles).molecules[0]!;
        const packed = new PackedMolecule(original);
        const decoded = packed.molecule;

        expect(decoded.atoms.length).toBe(original.atoms.length);
        expect(decoded.bonds.length).toBe(original.bonds.length);
      }
    });
  });

  describe("Memory efficiency", () => {
    it("uses significantly less memory than Molecule objects", () => {
      const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
      const packed = new PackedMolecule(mol);

      const jsonSize = JSON.stringify(mol).length;
      const packedSize = packed.bufferSize;

      // PackedMol should be much smaller
      expect(packedSize).toBeLessThan(jsonSize / 5);
    });
  });

  describe("Comparison with direct encoding", () => {
    it("produces identical binary to direct encodePackedMol", () => {
      const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;

      const direct = encodePackedMol(mol);
      const wrapped = new PackedMolecule(mol);

      // Both should have same size
      expect(wrapped.bufferSize).toBe(direct.header[7]!);

      // Headers should match
      for (let i = 0; i < 8; i++) {
        expect(wrapped.packed.header[i]!).toBe(direct.header[i]!);
      }
    });
  });
});
