/**
 * Attach substituents (chains, branches) to placed ring atoms.
 * Uses BFS with hybridization-aware angle selection.
 */

import type { Vec2 } from "./types";
import type { Molecule } from "types";
import { angleFromTo } from "./geometry-utils";

/**
 * Attach substituents to placed ring atoms.
 * Modifies coords in-place.
 */
export function attachSubstituents(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  ringAtomIds: Set<number>,
  bondLength: number,
): void {
  const visited = new Set<number>(ringAtomIds);
  const queue: Array<{ atomId: number; parentId: number }> = [];

  // Seed queue with ring atoms that have unplaced neighbors
  for (const ringAtomId of ringAtomIds) {
    for (const bond of molecule.bonds) {
      if (bond.atom1 !== ringAtomId && bond.atom2 !== ringAtomId) continue;

      const neighborId = bond.atom1 === ringAtomId ? bond.atom2 : bond.atom1;
      if (!visited.has(neighborId)) {
        queue.push({ atomId: neighborId, parentId: ringAtomId });
      }
    }
  }

  // BFS outward from ring atoms
  while (queue.length > 0) {
    const { atomId, parentId } = queue.shift()!;

    if (visited.has(atomId)) continue;
    visited.add(atomId);

    const parentAtom = molecule.atoms[parentId]!;
    const parentCoord = coords.get(parentId)!;

    // Check if this is a terminal atom (leaf node with degree 1)
    const atomDegree = molecule.bonds.filter(
      (b) => b.atom1 === atomId || b.atom2 === atomId,
    ).length;
    const isTerminal = atomDegree === 1;

    // Compute occupied angles (angles to already-placed neighbors)
    const occupiedAngles: number[] = [];
    for (const bond of molecule.bonds) {
      if (bond.atom1 !== parentId && bond.atom2 !== parentId) continue;

      const neighborId = bond.atom1 === parentId ? bond.atom2 : bond.atom1;
      if (visited.has(neighborId) && neighborId !== atomId) {
        const neighborCoord = coords.get(neighborId);
        if (neighborCoord) {
          const angle = angleFromTo(parentCoord, neighborCoord);
          occupiedAngles.push(angle);
        }
      }
    }

    let freeAngle: number;

    if (isTerminal && occupiedAngles.length >= 1) {
      // Terminal atom (degree=1): place in largest gap to extend radially outward
      // This ensures leaf nodes (like OH, NH2, etc.) extend cleanly from their attachment point
      freeAngle = pickFreeAngleForTerminal(occupiedAngles);
    } else {
      // Non-terminal or first substituent: use standard angle selection
      freeAngle = pickFreeAngle(occupiedAngles, parentAtom.hybridization);
    }

    // Place atom at bondLength distance
    const coord: Vec2 = {
      x: parentCoord.x + Math.cos(freeAngle) * bondLength,
      y: parentCoord.y + Math.sin(freeAngle) * bondLength,
    };
    coords.set(atomId, coord);

    // Enqueue unplaced neighbors
    for (const bond of molecule.bonds) {
      if (bond.atom1 !== atomId && bond.atom2 !== atomId) continue;

      const neighborId = bond.atom1 === atomId ? bond.atom2 : bond.atom1;
      if (!visited.has(neighborId)) {
        queue.push({ atomId: neighborId, parentId: atomId });
      }
    }
  }
}

/**
 * Pick free angle for terminal (leaf) atom - place in largest gap.
 * Terminal atoms should extend radially outward from their attachment point.
 */
function pickFreeAngleForTerminal(occupiedAngles: number[]): number {
  if (occupiedAngles.length === 0) return 0;
  if (occupiedAngles.length === 1) {
    // Only one occupied angle: place opposite to it
    return occupiedAngles[0]! + Math.PI;
  }

  // Find largest gap between occupied angles
  const sorted = [...occupiedAngles].sort((a, b) => a - b);
  let largestGap = 0;
  let bestAngle = 0;

  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]!;
    const end = sorted[(i + 1) % sorted.length]!;

    let gapSize = end - start;
    if (gapSize < 0) gapSize += 2 * Math.PI; // Wrap around

    if (gapSize > largestGap) {
      largestGap = gapSize;
      // Place in middle of gap
      bestAngle = start + gapSize / 2;
      if (bestAngle > Math.PI) bestAngle -= 2 * Math.PI;
    }
  }

  return bestAngle;
}

/**
 * Pick best free angle for new atom based on:
 * - Hybridization of the atom being placed
 * - Hybridization of the parent atom
 * - Already-occupied angles around parent
 */
function pickFreeAngle(occupiedAngles: number[], parentHybridization?: string): number {
  if (occupiedAngles.length === 0) {
    // First neighbor: default angle (East)
    return 0;
  }

  // Sort occupied angles for easier analysis
  const sorted = [...occupiedAngles].sort((a, b) => a - b);

  // Get ideal angles for this hybridization
  const idealAngles = getIdealAngles(parentHybridization ?? "sp3");

  // Find largest gap in occupied angles
  const gaps: Array<{ angle: number; size: number }> = [];

  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]!;
    const end = sorted[(i + 1) % sorted.length]!;
    const gapStart = start + Math.PI / 180; // Small offset to avoid overlap
    const gapEnd = end - Math.PI / 180;

    let gapSize = gapEnd - gapStart;
    if (gapSize < 0) gapSize += 2 * Math.PI; // Wrap around

    const midAngle = gapStart + gapSize / 2;
    gaps.push({ angle: midAngle, size: gapSize });
  }

  // Pick gap closest to ideal angles
  let bestAngle = gaps[0]!.angle;
  let bestScore = -Infinity;

  for (const gap of gaps) {
    let score = gap.size; // Prefer larger gaps

    // Bonus for angles close to ideal
    for (const ideal of idealAngles) {
      const diff = Math.abs(angleDiff(gap.angle, ideal));
      score += Math.max(0, 1 - diff / (Math.PI / 3)); // Bonus within 60°
    }

    if (score > bestScore) {
      bestScore = score;
      bestAngle = gap.angle;
    }
  }

  return bestAngle;
}

/**
 * Get ideal angles for atom with given hybridization.
 * Returns angles in radians, relative to first bond.
 */
function getIdealAngles(hybridization: string): number[] {
  switch (hybridization.toLowerCase()) {
    case "sp":
      // Linear: 180°
      return [0, Math.PI];

    case "sp2":
      // Trigonal planar: 120° apart
      return [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

    case "sp3":
    default:
      // Tetrahedral: 109.5° → ~120° in 2D
      return [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  }
}

/**
 * Smallest absolute difference between two angles (in radians).
 * Handles wraparound at ±π.
 */
function angleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b);
  if (diff > Math.PI) {
    diff = 2 * Math.PI - diff;
  }
  return diff;
}
