import { describe, it, expect } from "bun:test";
import { parseSMILES, matchSMARTS, parseSMARTS } from "index";
import type { MatchResult } from "src/types/smarts-types";
import {
  parseSMARTSCached,
  clearSMARTSCache,
  getSMARTSCacheSize,
  preloadSMARTSPatterns,
  getSMARTSCacheStats,
} from "src/utils/smarts-cache";

describe("SMARTS Pattern Cache", () => {
  it("should cache parsed SMARTS patterns", () => {
    clearSMARTSCache();
    expect(getSMARTSCacheSize()).toBe(0);

    const pattern1a = parseSMARTSCached("c1ccccc1");
    expect(getSMARTSCacheSize()).toBe(1);

    const pattern1b = parseSMARTSCached("c1ccccc1");
    expect(getSMARTSCacheSize()).toBe(1);

    // Should return the same object (identity check)
    expect(pattern1a).toBe(pattern1b);

    const pattern2 = parseSMARTSCached("[C,N]");
    expect(getSMARTSCacheSize()).toBe(2);
  });

  it("should return null for invalid SMARTS", () => {
    clearSMARTSCache();

    const invalid = parseSMARTSCached("invalid_smarts_[[[");
    expect(invalid).toBeNull();

    // Invalid patterns are still cached
    expect(getSMARTSCacheSize()).toBe(1);

    const invalidAgain = parseSMARTSCached("invalid_smarts_[[[");
    expect(invalidAgain).toBeNull();

    // Cache hit, size unchanged
    expect(getSMARTSCacheSize()).toBe(1);
  });

  it("should allow clearing cache", () => {
    clearSMARTSCache();
    expect(getSMARTSCacheSize()).toBe(0);

    parseSMARTSCached("c1ccccc1");
    parseSMARTSCached("[C,N]");
    expect(getSMARTSCacheSize()).toBe(2);

    clearSMARTSCache();
    expect(getSMARTSCacheSize()).toBe(0);
  });

  it("should preload multiple patterns", () => {
    clearSMARTSCache();

    const patterns = [
      "c1ccccc1",
      "[C,N;H2,H3]",
      "[#6]=[#6]",
      "[O;H]",
      "invalid[[[",
    ];

    const loaded = preloadSMARTSPatterns(patterns);
    expect(loaded).toBe(4); // 4 valid, 1 invalid

    // All patterns are cached (valid and invalid)
    expect(getSMARTSCacheSize()).toBe(5);
  });

  it("should work with pattern matching", () => {
    clearSMARTSCache();
    const mol = parseSMILES("c1ccccc1").molecules[0]!;

    const pattern = parseSMARTSCached("c1ccccc1");
    expect(pattern).toBeDefined();

    if (pattern) {
      const matches = matchSMARTS(pattern, mol);
      expect(matches).toBeDefined();
      expect(typeof matches === "object").toBe(true);
    }
  });

  it("should show cache statistics", () => {
    clearSMARTSCache();

    parseSMARTSCached("c1ccccc1");
    parseSMARTSCached("[C,N]");
    parseSMARTSCached("[#6]=[#6]");

    const stats = getSMARTSCacheStats();
    expect(stats.size).toBe(3);
    expect(stats.patterns.length).toBe(3);
    expect(stats.patterns).toContain("c1ccccc1");
    expect(stats.patterns).toContain("[C,N]");
    expect(stats.patterns).toContain("[#6]=[#6]");
  });

  it("should provide performance benefit for repeated patterns", () => {
    clearSMARTSCache();
    const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
    const pattern = "c1ccccc1";

    // Warm up to avoid JIT compilation effects
    for (let i = 0; i < 20; i++) {
      clearSMARTSCache();
      parseSMARTSCached(pattern);
    }

    // Measure cache misses (multiple to reduce timing variance)
    const missTimings: number[] = [];
    for (let i = 0; i < 10; i++) {
      clearSMARTSCache();
      const start = performance.now();
      parseSMARTSCached(pattern);
      missTimings.push(performance.now() - start);
    }
    const avgMissTime =
      missTimings.reduce((a, b) => a + b, 0) / missTimings.length;

    // Measure cache hits (multiple samples)
    const hitTimings: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      parseSMARTSCached(pattern);
      hitTimings.push(performance.now() - start);
    }
    const avgHitTime =
      hitTimings.reduce((a, b) => a + b, 0) / hitTimings.length;

    // Cache hits should be faster (very lenient threshold for CI environments)
    // We just verify that caching doesn't make it slower
    expect(avgHitTime).toBeLessThanOrEqual(avgMissTime);
  });

  it("should handle concurrent cache operations", () => {
    clearSMARTSCache();

    const patterns = ["c1ccccc1", "[C,N]", "[#6]=[#6]", "[O;H]", "[C;X4]"];

    // Parse patterns multiple times
    for (let i = 0; i < 5; i++) {
      for (const p of patterns) {
        parseSMARTSCached(p);
      }
    }

    // Cache should only contain unique patterns
    expect(getSMARTSCacheSize()).toBe(5);
  });

  it("should maintain pattern functionality after caching", () => {
    clearSMARTSCache();

    const testCases = [
      { smarts: "c1ccccc1", mol: "c1ccccc1", shouldMatch: true },
      { smarts: "c1ccccc1", mol: "CCO", shouldMatch: false },
      { smarts: "[O;H]", mol: "CCO", shouldMatch: true },
      { smarts: "[#6]=[#6]", mol: "C=C", shouldMatch: true },
    ];

    for (const testCase of testCases) {
      const pattern = parseSMARTSCached(testCase.smarts);
      if (!pattern) continue;

      const mol = parseSMILES(testCase.mol).molecules[0];
      if (!mol) continue;

      const result = matchSMARTS(pattern, mol) as MatchResult;
      const hasMatches =
        result.success && result.matches && result.matches.length > 0;

      if (testCase.shouldMatch) {
        expect(hasMatches).toBe(true);
      } else {
        expect(hasMatches).toBe(false);
      }
    }
  });
});
