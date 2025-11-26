import type { Molecule } from "types";
import { generateSMILES } from "src/generators/smiles-generator";
import { computeMorganFingerprint } from "src/utils/morgan-fingerprint";

const debugDedup = !!process.env.OPENCHEM_DEBUG_TAUTOMER;

export interface DeduplicationOptions {
  useFingerprints?: boolean;
  fpRadius?: number;
  fpSize?: number;
}

function fingerprintToString(fp: Uint8Array): string {
  return Array.from(fp).join(",");
}

function tanimotoSimilarity(fp1: Uint8Array, fp2: Uint8Array): number {
  if (fp1.length !== fp2.length) return 0;

  let intersection = 0;
  let union = 0;

  for (let i = 0; i < fp1.length; i++) {
    const byte1 = fp1[i] ?? 0;
    const byte2 = fp2[i] ?? 0;

    const and = byte1 & byte2;
    const or = byte1 | byte2;

    // Count set bits
    intersection += and.toString(2).split("1").length - 1;
    union += or.toString(2).split("1").length - 1;
  }

  return union === 0 ? 0 : intersection / union;
}

export class CanonicalDeduplicator {
  private smilesMap: Map<string, Molecule>;
  private fpMap: Map<string, { smiles: string; fingerprint: Uint8Array }>;
  private useFingerprints: boolean;
  private fpRadius: number;
  private fpSize: number;

  constructor(options: DeduplicationOptions = {}) {
    this.smilesMap = new Map();
    this.fpMap = new Map();
    // Disable fingerprint dedup by default - SMILES canonicalization is sufficient
    this.useFingerprints = options.useFingerprints ?? false;
    this.fpRadius = options.fpRadius ?? 2;
    this.fpSize = options.fpSize ?? 2048;
  }

  add(mol: Molecule): boolean {
    const smiles = generateSMILES(mol);

    // Primary check: exact SMILES match
    // This is the ground truth - always check SMILES first
    if (this.smilesMap.has(smiles)) {
      if (debugDedup) {
        console.debug(`[deduplicator] Duplicate SMILES: ${smiles}`);
      }
      return false;
    }

    // Secondary check: fingerprint similarity (if enabled)
    // Fingerprints are a HEURISTIC only - they can have false positives (collisions)
    // We only use them to reject likely duplicates, not to definitively reject molecules
    // If fingerprint says "duplicate" but SMILES differ, trust SMILES (not fingerprint)
    if (this.useFingerprints) {
      try {
        const fp = computeMorganFingerprint(mol, this.fpRadius, this.fpSize);
        const fpStr = fingerprintToString(fp);

        // Check if we've seen this exact fingerprint
        // BUT: if SMILES differ, this is a fingerprint collision - still add the molecule
        if (this.fpMap.has(fpStr)) {
          const existing = this.fpMap.get(fpStr);
          // Only reject if SMILES match (already handled above)
          // If SMILES differ, this is a fingerprint collision - keep going
          if (existing?.smiles !== smiles) {
            if (debugDedup) {
              console.debug(
                `[deduplicator] Fingerprint collision (different SMILES): ${smiles} vs ${existing?.smiles}`,
              );
            }
            // Don't return false - this is a legitimate new molecule
            // Continue to add it to smilesMap
          }
        } else {
          // New fingerprint - check for high similarity
          // Tanimoto > 0.995 suggests likely duplicate
          let isDuplicate = false;
          for (const [_existingFpStr, existing] of this.fpMap.entries()) {
            const similarity = tanimotoSimilarity(fp, existing.fingerprint);
            if (similarity > 0.995) {
              if (debugDedup) {
                console.debug(
                  `[deduplicator] High similarity (${similarity.toFixed(4)}): ${smiles} ≈ ${existing.smiles}`,
                );
              }
              isDuplicate = true;
              break;
            }
          }

          if (isDuplicate) {
            return false;
          }

          // New fingerprint - add to map
          this.fpMap.set(fpStr, { smiles, fingerprint: fp });
        }
      } catch (e) {
        // Fingerprint computation failed, fall back to SMILES-only
        if (debugDedup) {
          console.debug(`[deduplicator] Fingerprint computation failed for ${smiles}: ${e}`);
        }
      }
    }

    // Add to SMILES map (this is the ground truth)
    this.smilesMap.set(smiles, mol);
    return true;
  }

  has(mol: Molecule): boolean {
    const smiles = generateSMILES(mol);
    return this.smilesMap.has(smiles);
  }

  get(smiles: string): Molecule | undefined {
    return this.smilesMap.get(smiles);
  }

  getAll(): Molecule[] {
    return Array.from(this.smilesMap.values());
  }

  getAllWithSmiles(): Array<{ smiles: string; molecule: Molecule }> {
    return Array.from(this.smilesMap.entries()).map(([smiles, molecule]) => ({
      smiles,
      molecule,
    }));
  }

  size(): number {
    return this.smilesMap.size;
  }

  clear(): void {
    this.smilesMap.clear();
    this.fpMap.clear();
  }
}

export function deduplicate(molecules: Molecule[], options: DeduplicationOptions = {}): Molecule[] {
  const dedup = new CanonicalDeduplicator(options);
  const unique: Molecule[] = [];

  for (const mol of molecules) {
    if (dedup.add(mol)) {
      unique.push(mol);
    }
  }

  if (debugDedup) {
    console.debug(
      `[deduplicator] Deduplication: ${molecules.length} → ${unique.length} unique molecules`,
    );
  }

  return unique;
}
