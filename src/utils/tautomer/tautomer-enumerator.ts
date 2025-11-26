import type { Molecule } from "types";
import { identifyAllTransformationSites } from "./site-detector";
import { applyMultiSiteTransformation } from "./site-transformer";
import { CanonicalDeduplicator } from "./canonical-deduplicator";
import { scoreTautomer } from "./tautomer-scoring";
import { perceiveAromaticity } from "src/utils/aromaticity-perceiver";

const debugEnum = !!process.env.OPENCHEM_DEBUG_TAUTOMER;

export interface TautomerOptions {
  maxTautomers?: number;
  maxCombinations?: number;
  useFingerprintDedup?: boolean;
  fpRadius?: number;
  fpSize?: number;
}

export interface TautomerResult {
  smiles: string;
  molecule: Molecule;
  score: number;
  transformations: string[];
}

export function enumerateTautomers(
  inputMol: Molecule,
  opts: TautomerOptions = {},
): TautomerResult[] {
  const maxTautomers = opts.maxTautomers ?? 256;
  const maxTransforms = opts.maxCombinations ?? 8192;
  const useFingerprintDedup = opts.useFingerprintDedup ?? false;
  const fpRadius = opts.fpRadius ?? 2;
  const fpSize = opts.fpSize ?? 2048;

  if (debugEnum) {
    console.debug("[tautomer] Starting iterative BFS enumeration");
  }

  // Initialize deduplicator
  const dedup = new CanonicalDeduplicator({
    useFingerprints: useFingerprintDedup,
    fpRadius,
    fpSize,
  });

  // Add original molecule
  dedup.add(inputMol);

  // Priority queue: molecules to process, sorted by score (high to low)
  type QueueItem = { mol: Molecule; score: number };
  const queue: QueueItem[] = [{ mol: inputMol, score: scoreTautomer(inputMol) }];
  let transformCount = 0;

  while (queue.length > 0 && dedup.size() < maxTautomers && transformCount < maxTransforms) {
    // Pop highest scoring molecule
    const currentItem = queue.shift() as QueueItem;
    const currentMol = currentItem.mol;

    // Detect transformation sites for this molecule
    const sites = identifyAllTransformationSites(currentMol);

    if (sites.length === 0) continue;

    // Apply each site transformation independently
    for (const site of sites) {
      if (dedup.size() >= maxTautomers) break;
      if (transformCount >= maxTransforms) break;

      transformCount++;

      // Apply single-site transformation
      const result = applyMultiSiteTransformation(currentMol, [site], 1);

      if (!result.success || !result.molecule) continue;

      // Perceive aromaticity on the transformed molecule
      // This is crucial for detecting aromatic H-shifts in subsequent iterations
      const { atoms: aromaticAtoms, bonds: aromaticBonds } = perceiveAromaticity(
        result.molecule.atoms,
        result.molecule.bonds,
      );
      const aromaticMol = {
        ...result.molecule,
        atoms: aromaticAtoms,
        bonds: aromaticBonds,
      } as Molecule;

      // Try to add to deduplicator
      const isNew = dedup.add(aromaticMol);
      if (isNew) {
        // New tautomer found - add to queue for further transformation
        const score = scoreTautomer(aromaticMol);
        queue.push({ mol: aromaticMol, score });

        if (debugEnum && dedup.size() % 10 === 0) {
          console.debug(
            `[tautomer] Found ${dedup.size()} unique tautomers (${transformCount} transforms, queue: ${queue.length})`,
          );
        }
      }
    }
  }

  if (debugEnum) {
    console.debug(
      `[tautomer] Enumeration complete: ${dedup.size()} unique tautomers ` +
        `(${transformCount} transforms applied)`,
    );
  }

  // Score and return results
  const results: TautomerResult[] = dedup.getAllWithSmiles().map(({ smiles, molecule }) => ({
    smiles,
    molecule,
    score: scoreTautomer(molecule),
    transformations: [],
  }));

  // Sort by score (highest first) for canonical form selection
  results.sort((a, b) => b.score - a.score);

  if (debugEnum) {
    console.debug(`[tautomer] Top 5 tautomers by score:`);
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const r = results[i];
      console.debug(`  ${i + 1}. ${r?.smiles} (score: ${r?.score})`);
    }
  }

  return results;
}

export function getCanonicalTautomer(
  inputMol: Molecule,
  opts: TautomerOptions = {},
): TautomerResult {
  const tautomers = enumerateTautomers(inputMol, opts);

  if (tautomers.length === 0) {
    // Fallback: return original molecule if no tautomers found
    return {
      smiles: "",
      molecule: inputMol,
      score: scoreTautomer(inputMol),
      transformations: [],
    };
  }

  // Highest scoring tautomer is canonical
  return tautomers[0] as TautomerResult;
}
