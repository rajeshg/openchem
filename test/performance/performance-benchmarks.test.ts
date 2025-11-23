import { describe, it, expect } from "bun:test";
import {
  parseSMILES,
  generateSMILES,
  Descriptors,
  getRingInfo,
  matchSMARTS,
  parseSMARTS,
  generateMolfile,
  parseMolfile,
  computeMorganFingerprint,
} from "index";

// Test molecules (realistic drug-like compounds)
const MOLECULES = {
  aspirin: "CC(=O)Oc1ccccc1C(=O)O",
  caffeine: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
  ibuprofen: "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
  glucose: "C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O",
  cholesterol: "CC(C)CCCC(C)C1CCC2C1(CCCC2=CC=C3CC(CCC3=C)O)C",
};

describe("Performance Benchmarks", () => {
  it("should benchmark SMILES parsing", () => {
    const smilesList = Object.values(MOLECULES);
    const iterations = 50;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const smiles of smilesList) {
        parseSMILES(smiles);
      }
    }
    const end = performance.now();

    const totalMs = end - start;
    const avgMs = totalMs / (iterations * smilesList.length);

    console.log(`\n📊 SMILES Parsing Performance:`);
    console.log(
      `   Total time: ${totalMs.toFixed(2)}ms (${iterations} iterations × ${smilesList.length} molecules)`,
    );
    console.log(`   Average: ${avgMs.toFixed(4)}ms per molecule`);

    expect(avgMs).toBeGreaterThan(0);
  });

  it("should benchmark SMILES generation", () => {
    const molecules = Object.values(MOLECULES).map(
      (s) => parseSMILES(s).molecules[0]!,
    );
    const iterations = 50;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const mol of molecules) {
        generateSMILES(mol);
      }
    }
    const end = performance.now();

    const totalMs = end - start;
    const avgMs = totalMs / (iterations * molecules.length);

    console.log(`\n📊 SMILES Generation Performance:`);
    console.log(
      `   Total time: ${totalMs.toFixed(2)}ms (${iterations} iterations × ${molecules.length} molecules)`,
    );
    console.log(`   Average: ${avgMs.toFixed(4)}ms per molecule`);

    expect(avgMs).toBeGreaterThan(0);
  });

  it(
    "should benchmark molecular properties calculation",
    () => {
      const molecules = Object.values(MOLECULES).map(
        (s) => parseSMILES(s).molecules[0]!,
      );
      const iterations = 50;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        for (const mol of molecules) {
          Descriptors.drugLikeness(mol);
          getRingInfo(mol);
          computeMorganFingerprint(mol);
        }
      }
      const end = performance.now();

      const totalMs = end - start;
      const avgMs = totalMs / (iterations * molecules.length * 3);

      console.log(`\n📊 Molecular Properties Performance:`);
      console.log(
        `   Total time: ${totalMs.toFixed(2)}ms (${iterations} iterations × ${molecules.length} molecules × 3 operations)`,
      );
      console.log(`   Average: ${avgMs.toFixed(4)}ms per operation`);

      expect(avgMs).toBeGreaterThan(0);
    },
    { timeout: 30000 }, // 30s timeout for CI environments
  );

  it("should benchmark SMARTS matching", () => {
    const molecules = Object.values(MOLECULES).map(
      (s) => parseSMILES(s).molecules[0]!,
    );

    // Simple SMARTS patterns that are known to work
    const patterns = ["c1ccccc1", "[C,N]", "[#6]=[#6]", "[O;H]"];

    const smartsPatterns = patterns
      .map((p) => {
        const result = parseSMARTS(p);
        return result.pattern;
      })
      .filter((p) => p !== null);

    const iterations = 20;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const mol of molecules) {
        for (const pattern of smartsPatterns) {
          if (pattern) {
            matchSMARTS(pattern, mol);
          }
        }
      }
    }
    const end = performance.now();

    const totalMs = end - start;
    const totalMatches = iterations * molecules.length * smartsPatterns.length;
    const avgMs = totalMs / totalMatches;

    console.log(`\n📊 SMARTS Matching Performance:`);
    console.log(
      `   Total time: ${totalMs.toFixed(2)}ms (${totalMatches} match operations)`,
    );
    console.log(`   Average: ${avgMs.toFixed(4)}ms per pattern match`);

    expect(avgMs).toBeGreaterThan(0);
  });

  it("should benchmark MOL file I/O", () => {
    const molecules = Object.values(MOLECULES).map(
      (s) => parseSMILES(s).molecules[0]!,
    );
    const iterations = 20;

    // Generate MOL files
    const molfiles = molecules.map((m) => generateMolfile(m));

    const startWrite = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const mol of molecules) {
        generateMolfile(mol);
      }
    }
    const endWrite = performance.now();

    const startRead = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const molfile of molfiles) {
        parseMolfile(molfile);
      }
    }
    const endRead = performance.now();

    const writeMs = endWrite - startWrite;
    const readMs = endRead - startRead;
    const totalOps = iterations * molecules.length;

    console.log(`\n📊 MOL File I/O Performance:`);
    console.log(
      `   Write time: ${writeMs.toFixed(2)}ms (${(writeMs / totalOps).toFixed(4)}ms per molecule)`,
    );
    console.log(
      `   Read time: ${readMs.toFixed(2)}ms (${(readMs / totalOps).toFixed(4)}ms per molecule)`,
    );

    expect(writeMs + readMs).toBeGreaterThan(0);
  });
});
