/**
 * Detect and resolve atom overlaps in 2D coordinates.
 * Uses collision detection and iterative adjustment.
 */

import type { Vec2 } from "./types";
import type { Molecule } from "types";

export interface OverlapOptions {
  minDistance?: number;
  maxIterations?: number;
  pushFactor?: number;
}

const DEFAULT_OPTIONS: Required<OverlapOptions> = {
  minDistance: 0.6, // 60% of bond length (realistic van der Waals radius)
  maxIterations: 50,
  pushFactor: 0.15, // Push atoms apart by 15% of overlap per iteration
};

/**
 * Detect and resolve atom overlaps.
 * Returns true if overlaps were found and resolved.
 */
export function resolveOverlaps(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  bondLength: number,
  options: OverlapOptions = {},
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const minDist = bondLength * opts.minDistance;
  let hadOverlaps = false;

  for (let iter = 0; iter < opts.maxIterations; iter++) {
    const overlaps = detectOverlaps(molecule, coords, minDist);

    if (overlaps.length === 0) {
      break; // No more overlaps
    }

    hadOverlaps = true;

    // Resolve each overlap by pushing atoms apart
    for (const { atom1, atom2, overlap } of overlaps) {
      const coord1 = coords.get(atom1)!;
      const coord2 = coords.get(atom2)!;

      // Compute push direction (away from each other)
      const dx = coord2.x - coord1.x;
      const dy = coord2.y - coord1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.001) {
        // Atoms at same position: push in random direction
        const angle = Math.random() * 2 * Math.PI;
        coord1.x -= Math.cos(angle) * overlap * opts.pushFactor;
        coord1.y -= Math.sin(angle) * overlap * opts.pushFactor;
        coord2.x += Math.cos(angle) * overlap * opts.pushFactor;
        coord2.y += Math.sin(angle) * overlap * opts.pushFactor;
      } else {
        // Push along line connecting atoms
        const pushDist = (overlap * opts.pushFactor) / dist;
        const pushX = dx * pushDist;
        const pushY = dy * pushDist;

        coord1.x -= pushX;
        coord1.y -= pushY;
        coord2.x += pushX;
        coord2.y += pushY;
      }
    }
  }

  return hadOverlaps;
}

/**
 * Detect all atom overlaps (atoms too close together).
 * Only checks non-bonded atom pairs.
 */
function detectOverlaps(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  minDistance: number,
): Array<{ atom1: number; atom2: number; overlap: number }> {
  const overlaps: Array<{ atom1: number; atom2: number; overlap: number }> = [];
  const atoms = Array.from(molecule.atoms);

  // Build bond set for fast lookup
  const bondSet = new Set<string>();
  for (const bond of molecule.bonds) {
    const key1 = `${bond.atom1}-${bond.atom2}`;
    const key2 = `${bond.atom2}-${bond.atom1}`;
    bondSet.add(key1);
    bondSet.add(key2);
  }

  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const atom1 = atoms[i]!;
      const atom2 = atoms[j]!;

      // Skip bonded atoms
      const bondKey = `${atom1.id}-${atom2.id}`;
      if (bondSet.has(bondKey)) continue;

      const coord1 = coords.get(atom1.id);
      const coord2 = coords.get(atom2.id);

      if (!coord1 || !coord2) continue;

      // Compute distance
      const dx = coord2.x - coord1.x;
      const dy = coord2.y - coord1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if too close
      if (dist < minDistance) {
        overlaps.push({
          atom1: atom1.id,
          atom2: atom2.id,
          overlap: minDistance - dist,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Check if any atoms overlap.
 */
export function hasOverlaps(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  bondLength: number,
  minDistance = 0.3,
): boolean {
  const minDist = bondLength * minDistance;
  const overlaps = detectOverlaps(molecule, coords, minDist);
  return overlaps.length > 0;
}

/**
 * Get overlap statistics for debugging.
 */
export function getOverlapStats(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  bondLength: number,
  minDistance = 0.3,
): { count: number; maxOverlap: number; avgOverlap: number } {
  const minDist = bondLength * minDistance;
  const overlaps = detectOverlaps(molecule, coords, minDist);

  if (overlaps.length === 0) {
    return { count: 0, maxOverlap: 0, avgOverlap: 0 };
  }

  const maxOverlap = Math.max(...overlaps.map((o) => o.overlap));
  const avgOverlap =
    overlaps.reduce((sum, o) => sum + o.overlap, 0) / overlaps.length;

  return { count: overlaps.length, maxOverlap, avgOverlap };
}
