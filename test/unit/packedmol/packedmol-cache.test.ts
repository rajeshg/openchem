import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { encodePackedMol } from "src/generators/packedmol-encoder";
import { getCachedPackedMol, clearCachedPackedMol } from "src/utils/packedmol-cache";

describe("PackedMol Caching", () => {
  it("caches PackedMol on first encode", () => {
    const result = parseSMILES("CC(=O)Oc1ccccc1C(=O)O"); // Aspirin
    const mol = result.molecules[0]!;

    // First encode - should compute
    const packed1 = encodePackedMol(mol);
    expect(packed1).toBeDefined();

    // Verify cache contains the result
    const cached = getCachedPackedMol(mol);
    expect(cached).toBeDefined();
    expect(cached?.buffer).toBe(packed1.buffer);
  });

  it("returns cached PackedMol on repeated encode", () => {
    const result = parseSMILES("CC(=O)Oc1ccccc1C(=O)O"); // Aspirin
    const mol = result.molecules[0]!;

    // First encode
    const packed1 = encodePackedMol(mol);
    const buffer1 = packed1.buffer;

    // Second encode - should be identical and use cache
    const packed2 = encodePackedMol(mol);
    const buffer2 = packed2.buffer;

    // Should be the exact same buffer object
    expect(buffer2).toBe(buffer1);
  });

  it("cache can be cleared", () => {
    const result = parseSMILES("CC");
    const mol = result.molecules[0]!;

    // Encode to cache
    encodePackedMol(mol);
    expect(getCachedPackedMol(mol)).toBeDefined();

    // Clear cache
    clearCachedPackedMol(mol);
    expect(getCachedPackedMol(mol)).toBeNull();
  });

  it("different molecule objects have separate caches", () => {
    const mol1 = parseSMILES("CC").molecules[0]!;
    const mol2 = parseSMILES("CC").molecules[0]!;

    const packed1 = encodePackedMol(mol1);
    const packed2 = encodePackedMol(mol2);

    // Both are cached
    expect(getCachedPackedMol(mol1)).toBeDefined();
    expect(getCachedPackedMol(mol2)).toBeDefined();

    // But they're different buffer objects (different molecule instances)
    expect(packed1.buffer).not.toBe(packed2.buffer);
  });

  it("enables O(1) lookup on repeated operations", () => {
    const result = parseSMILES("CC(=O)Oc1ccccc1C(=O)O"); // Aspirin
    const mol = result.molecules[0]!;

    // First call - compute
    const t0 = performance.now();
    const packed1 = encodePackedMol(mol);
    const t1 = performance.now();
    const firstTime = t1 - t0;

    // Second call - cache hit
    const t2 = performance.now();
    const packed2 = encodePackedMol(mol);
    const t3 = performance.now();
    const secondTime = t3 - t2;

    // Second call should be much faster (likely < 0.1ms)
    expect(secondTime).toBeLessThan(firstTime);
    expect(packed1).toBe(packed2);
  });
});
