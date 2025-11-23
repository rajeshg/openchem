import { describe, it, expect } from "bun:test";
import {
  parseSMILES,
  generateSMILES,
  computeLogP,
  checkLipinskiRuleOfFive,
  matchSMARTS,
  computeMorganFingerprint,
  bulkMatchSMARTS,
  bulkComputeProperties,
  bulkComputeSimilarities,
} from "index";

/**
 * Performance regression tests to track and prevent performance degradation
 * These tests establish baseline performance metrics and warn if exceeded
 */
describe("Performance Regression Tests", () => {
  // Define performance budgets (in milliseconds) for key operations
  const PERF_BUDGETS = {
    // SMILES parsing should be very fast
    smilesParsing: 5, // 5ms for typical molecules

    // SMILES generation should be fast
    smilesGeneration: 5,

    // LogP computation (first call with hydrogen addition)
    logpComputation: 50,

    // LogP cached calls should be nearly instant
    logpCached: 1,

    // SMARTS pattern matching on small molecules
    smartsMatching: 10,

    // Fingerprint computation
    fingerprintComputation: 10,

    // Drug-likeness checks
    drugLikenessCheck: 5,

    // Bulk operations should be proportional to molecule count
    bulkSMARTS: 100, // for 100 molecules
    bulkProperties: 100,
  };

  const testMolecules = [
    "c1ccccc1", // benzene
    "CCO", // ethanol
    "CC(C)Cc1ccc(cc1)C(C)C(=O)O", // ibuprofen
    "CC(=O)Oc1ccccc1C(=O)O", // aspirin
  ];

  // Warmup to stabilize V8 JIT
  function warmup() {
    for (const smiles of testMolecules) {
      parseSMILES(smiles);
    }
  }

  it("SMILES parsing performance", () => {
    warmup();

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      for (const smiles of testMolecules) {
        parseSMILES(smiles);
      }
    }
    const total = performance.now() - start;
    const avgPerMol = total / (100 * testMolecules.length);

    if (process.env.VERBOSE) {
      console.log(
        `SMILES parsing: ${avgPerMol.toFixed(3)}ms/mol (budget: ${PERF_BUDGETS.smilesParsing}ms)`,
      );
    }

    // Allow 2x budget for CI environments that might be slower
    expect(avgPerMol).toBeLessThan(PERF_BUDGETS.smilesParsing * 2);
  });

  it("SMILES generation performance", () => {
    warmup();
    const mol = parseSMILES(testMolecules[0]!).molecules[0]!;

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      generateSMILES(mol);
    }
    const total = performance.now() - start;
    const avgTime = total / 100;

    if (process.env.VERBOSE) {
      console.log(
        `SMILES generation: ${avgTime.toFixed(3)}ms (budget: ${PERF_BUDGETS.smilesGeneration}ms)`,
      );
    }

    expect(avgTime).toBeLessThan(PERF_BUDGETS.smilesGeneration * 2);
  });

  it("LogP computation performance (first call)", () => {
    warmup();
    const mol = parseSMILES(testMolecules[2]!).molecules[0]!;

    // Note: Fresh molecule to ensure no cache
    const start = performance.now();
    computeLogP(mol);
    const firstCallTime = performance.now() - start;

    if (process.env.VERBOSE) {
      console.log(
        `LogP first call: ${firstCallTime.toFixed(3)}ms (budget: ${PERF_BUDGETS.logpComputation}ms)`,
      );
    }

    // First call includes hydrogen addition and pattern matching
    expect(firstCallTime).toBeLessThan(PERF_BUDGETS.logpComputation * 2);
  });

  it("LogP computation performance (cached calls)", () => {
    warmup();
    const mol = parseSMILES(testMolecules[2]!).molecules[0]!;

    // Warm up cache
    computeLogP(mol);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      computeLogP(mol);
    }
    const total = performance.now() - start;
    const avgTime = total / 100;

    if (process.env.VERBOSE) {
      console.log(
        `LogP cached call: ${avgTime.toFixed(4)}ms (budget: ${PERF_BUDGETS.logpCached}ms)`,
      );
    }

    // Cached calls should be extremely fast (WeakMap lookup + return)
    expect(avgTime).toBeLessThan(PERF_BUDGETS.logpCached * 5);
  });

  it("SMARTS pattern matching performance", () => {
    warmup();
    const mol = parseSMILES(testMolecules[3]!).molecules[0]!;

    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      matchSMARTS("[#6]~[#8]", mol);
    }
    const total = performance.now() - start;
    const avgTime = total / 50;

    if (process.env.VERBOSE) {
      console.log(
        `SMARTS matching: ${avgTime.toFixed(3)}ms (budget: ${PERF_BUDGETS.smartsMatching}ms)`,
      );
    }

    // Allow 2x budget due to pattern caching variations
    expect(avgTime).toBeLessThan(PERF_BUDGETS.smartsMatching * 2);
  });

  it("Fingerprint computation performance", () => {
    warmup();
    const mol = parseSMILES(testMolecules[2]!).molecules[0]!;

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      computeMorganFingerprint(mol, 2, 512);
    }
    const total = performance.now() - start;
    const avgTime = total / 100;

    if (process.env.VERBOSE) {
      console.log(
        `Fingerprint computation: ${avgTime.toFixed(3)}ms (budget: ${PERF_BUDGETS.fingerprintComputation}ms)`,
      );
    }

    expect(avgTime).toBeLessThan(PERF_BUDGETS.fingerprintComputation * 2);
  });

  it("Drug-likeness checks performance", () => {
    warmup();
    const mol = parseSMILES(testMolecules[2]!).molecules[0]!;

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      checkLipinskiRuleOfFive(mol);
    }
    const total = performance.now() - start;
    const avgTime = total / 100;

    if (process.env.VERBOSE) {
      console.log(
        `Drug-likeness check: ${avgTime.toFixed(3)}ms (budget: ${PERF_BUDGETS.drugLikenessCheck}ms)`,
      );
    }

    expect(avgTime).toBeLessThan(PERF_BUDGETS.drugLikenessCheck * 2);
  });

  it("Bulk SMARTS matching performance", () => {
    warmup();
    const molecules = testMolecules.map((s) => parseSMILES(s).molecules[0]!);

    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      bulkMatchSMARTS("[#6]~[#8]", molecules);
    }
    const total = performance.now() - start;
    const avgTime = total / 10;

    if (process.env.VERBOSE) {
      console.log(
        `Bulk SMARTS (${molecules.length} mols): ${avgTime.toFixed(3)}ms (budget: ${PERF_BUDGETS.bulkSMARTS}ms)`,
      );
    }

    // Bulk operations should scale linearly
    expect(avgTime).toBeLessThan(PERF_BUDGETS.bulkSMARTS * 2);
  });

  it("Bulk properties computation performance", () => {
    warmup();
    const molecules = testMolecules.map((s) => parseSMILES(s).molecules[0]!);

    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      bulkComputeProperties(molecules);
    }
    const total = performance.now() - start;
    const avgTime = total / 10;

    if (process.env.VERBOSE) {
      console.log(
        `Bulk properties (${molecules.length} mols): ${avgTime.toFixed(3)}ms (budget: ${PERF_BUDGETS.bulkProperties}ms)`,
      );
    }

    expect(avgTime).toBeLessThan(PERF_BUDGETS.bulkProperties * 2);
  });

  it("Bulk similarity computation performance", () => {
    warmup();
    const molecules = testMolecules.map((s) => parseSMILES(s).molecules[0]!);

    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      bulkComputeSimilarities(molecules, 2, 512);
    }
    const total = performance.now() - start;
    const avgTime = total / 10;

    if (process.env.VERBOSE) {
      console.log(
        `Bulk similarities (${molecules.length} mols): ${avgTime.toFixed(3)}ms`,
      );
    }

    // Pairwise comparisons are O(n^2), so budget should be larger
    expect(avgTime).toBeLessThan(500);
  });

  it("performance test summary", () => {
    if (process.env.VERBOSE) {
      console.log("\n=== Performance Regression Test Summary ===");
      console.log(
        "Budgets are 2x the typical performance to allow for CI variance",
      );
      console.log("If tests fail, performance has degraded significantly");
      console.log("==========================================\n");
    }
  });
});
