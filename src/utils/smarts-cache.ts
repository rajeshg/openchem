import type { SMARTSPattern } from "src/matchers/smarts-matcher";
import { parseSMARTS as parseSMARTSRaw } from "src/parsers/smarts-parser";

/**
 * Cache for compiled SMARTS patterns to avoid recompilation
 *
 * Since SMARTS parsing is fast but pattern compilation involves
 * ring closure analysis and constraint checking, caching helps
 * for repeated pattern matching operations.
 */
const patternCache = new Map<string, SMARTSPattern | null>();

/**
 * Clear the SMARTS pattern cache
 *
 * Useful for testing or memory cleanup
 *
 * @internal
 */
export function clearSMARTSCache(): void {
  patternCache.clear();
}

/**
 * Get the number of cached patterns
 *
 * @returns Number of patterns in cache
 * @internal
 */
export function getSMARTSCacheSize(): number {
  return patternCache.size;
}

/**
 * Parse SMARTS pattern with caching
 *
 * Returns the same pattern object for identical SMARTS strings,
 * avoiding recompilation overhead.
 *
 * @param smarts - SMARTS pattern string
 * @returns Parsed SMARTSPattern or null if parsing failed
 *
 * @internal
 */
export function parseSMARTSCached(smarts: string): SMARTSPattern | null {
  // Check cache first
  if (patternCache.has(smarts)) {
    return patternCache.get(smarts) ?? null;
  }

  // Parse and cache
  const result = parseSMARTSRaw(smarts);
  const pattern = result.pattern ?? null;

  patternCache.set(smarts, pattern);
  return pattern;
}

/**
 * Preload multiple SMARTS patterns into cache
 *
 * Useful for batch operations where you know the patterns in advance.
 *
 * @param patterns - Array of SMARTS pattern strings
 * @returns Number of patterns successfully parsed and cached
 *
 * @internal
 */
export function preloadSMARTSPatterns(patterns: string[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const result = parseSMARTSCached(pattern);
    if (result) count++;
  }
  return count;
}

/**
 * Get cache statistics
 *
 * @returns Object with cache stats
 * @internal
 */
export function getSMARTSCacheStats(): {
  size: number;
  patterns: string[];
} {
  return {
    size: patternCache.size,
    patterns: Array.from(patternCache.keys()),
  };
}
