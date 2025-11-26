/**
 * Place fused ring systems using BFS + edge alignment.
 * CRITICAL: This is canonicalization-independent (works regardless of atom ordering).
 *
 * Algorithm:
 * 1. Pick seed ring, place at origin using regular polygon template
 * 2. BFS to adjacent rings, aligning via shared edges
 * 3. For each new ring:
 *    - Find shared atoms (set intersection, order-independent)
 *    - Verify shared edge exists (bond connectivity)
 *    - Generate template for new ring
 *    - Compute alignment transform to match existing coordinates
 *    - Apply transform to all atoms in new ring
 */

import type { Ring, RingSystem, Vec2, Transform } from "./types";
import type { Molecule } from "types";
import { regularPolygon, radiusForEdgeLength, computeAlignmentTransform } from "./geometry-utils";
import {
  findSharedAtoms,
  findBondedPair,
  selectSeedRing,
  getAdjacentRings,
} from "./ring-system-detector";

/**
 * Place entire fused ring system using BFS + edge alignment.
 * Returns coordinates for all atoms in the system.
 */
export function placeFusedRingSystem(
  system: RingSystem,
  molecule: Molecule,
  bondLength: number,
): Map<number, Vec2> {
  const coords = new Map<number, Vec2>();

  // Step 1: Select seed ring and place at origin
  const seedRing = selectSeedRing(system);
  const seedTemplate = generateRingTemplate(seedRing.size, bondLength);

  for (let i = 0; i < seedRing.atomIds.length; i++) {
    const atomId = seedRing.atomIds[i]!;
    coords.set(atomId, seedTemplate[i]!);
  }

  // Step 2: BFS outward to place adjacent rings
  const placed = new Set<number>([seedRing.id]);
  const queue: Ring[] = [seedRing];

  while (queue.length > 0) {
    const currentRing = queue.shift()!;
    const adjacentRings = getAdjacentRings(currentRing, system);

    for (const neighborRing of adjacentRings) {
      if (placed.has(neighborRing.id)) continue;

      // Find shared atoms between current and neighbor rings
      const sharedAtoms = findSharedAtoms(currentRing, neighborRing);

      if (sharedAtoms.length < 2) {
        // Spiro or single shared atom: handle separately
        if (sharedAtoms.length === 1) {
          placeSpiroRing(neighborRing, coords, sharedAtoms[0]!, bondLength);
        }
        placed.add(neighborRing.id);
        queue.push(neighborRing);
        continue;
      }

      // Find bonded pair among shared atoms (the shared edge)
      const sharedEdge = findBondedPair(
        sharedAtoms,
        molecule.bonds as unknown as { atom1: number; atom2: number }[],
      );

      if (!sharedEdge) {
        // No bonded edge found (shouldn't happen in valid molecules)
        // Fall back to simple translation
        placeSpiroRing(neighborRing, coords, sharedAtoms[0]!, bondLength);
        placed.add(neighborRing.id);
        queue.push(neighborRing);
        continue;
      }

      const [sharedAtom1, sharedAtom2] = sharedEdge;

      // Get coordinates of shared atoms (already placed)
      const p1Placed = coords.get(sharedAtom1)!;
      const p2Placed = coords.get(sharedAtom2)!;

      // Generate template for neighbor ring
      const neighborTemplate = generateRingTemplate(neighborRing.size, bondLength);

      // Find positions of shared atoms in template
      const idx1 = neighborRing.atomIds.indexOf(sharedAtom1);
      const idx2 = neighborRing.atomIds.indexOf(sharedAtom2);

      if (idx1 === -1 || idx2 === -1) {
        // Atoms not found in ring (shouldn't happen)
        placed.add(neighborRing.id);
        queue.push(neighborRing);
        continue;
      }

      const p1Template = neighborTemplate[idx1]!;
      const p2Template = neighborTemplate[idx2]!;

      // Compute transform to align template edge to placed edge
      const transform = computeAlignmentTransform(p1Template, p2Template, p1Placed, p2Placed);

      // Apply transform to get candidate positions
      const candidatePositions = new Map<number, Vec2>();
      for (let i = 0; i < neighborRing.atomIds.length; i++) {
        const atomId = neighborRing.atomIds[i]!;
        if (!coords.has(atomId)) {
          const templateCoord = neighborTemplate[i]!;
          const transformedCoord = applyTransform(templateCoord, transform);
          candidatePositions.set(atomId, transformedCoord);
        }
      }

      // Check for overlaps with existing atoms
      const minDistance = bondLength * 0.7; // Atoms should be at least 70% of bond length apart
      let hasOverlap = false;

      for (const [newAtomId, newCoord] of candidatePositions.entries()) {
        for (const [existingAtomId, existingCoord] of coords.entries()) {
          // Skip if atoms are bonded
          const bonded = (molecule.bonds as readonly { atom1: number; atom2: number }[]).some(
            (b) =>
              (b.atom1 === newAtomId && b.atom2 === existingAtomId) ||
              (b.atom1 === existingAtomId && b.atom2 === newAtomId),
          );
          if (bonded) continue;

          const dx = newCoord.x - existingCoord.x;
          const dy = newCoord.y - existingCoord.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < minDistance) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) break;
      }

      // If overlap detected, try flipping the ring to the other side of the shared edge
      if (hasOverlap) {
        // Flip by reflecting across the shared edge
        const edgeVec = {
          x: p2Placed.x - p1Placed.x,
          y: p2Placed.y - p1Placed.y,
        };
        const edgeLength = Math.sqrt(edgeVec.x * edgeVec.x + edgeVec.y * edgeVec.y);
        const edgeNormal = {
          x: -edgeVec.y / edgeLength,
          y: edgeVec.x / edgeLength,
        };

        // Recompute positions on the other side
        for (const [atomId, originalCoord] of candidatePositions.entries()) {
          // Project onto the edge and reflect
          const midPoint = {
            x: (p1Placed.x + p2Placed.x) / 2,
            y: (p1Placed.y + p2Placed.y) / 2,
          };
          const vecToAtom = {
            x: originalCoord.x - midPoint.x,
            y: originalCoord.y - midPoint.y,
          };

          // Dot product with edge normal to get distance from edge
          const distFromEdge = vecToAtom.x * edgeNormal.x + vecToAtom.y * edgeNormal.y;

          // Reflect by flipping the distance sign
          const flippedCoord = {
            x: originalCoord.x - 2 * distFromEdge * edgeNormal.x,
            y: originalCoord.y - 2 * distFromEdge * edgeNormal.y,
          };

          candidatePositions.set(atomId, flippedCoord);
        }
      }

      // Apply the final positions (either original or flipped)
      for (const [atomId, coord] of candidatePositions.entries()) {
        coords.set(atomId, coord);
      }

      placed.add(neighborRing.id);
      queue.push(neighborRing);
    }
  }

  return coords;
}

/**
 * Generate regular polygon template for a ring.
 * Radius is computed from desired bond length.
 */
function generateRingTemplate(ringSize: number, bondLength: number): Vec2[] {
  // For ring with n atoms and ideal edge length d:
  // radius = d / (2 * sin(π/n))
  const radius = radiusForEdgeLength(ringSize, bondLength);
  return regularPolygon(ringSize, radius);
}

/**
 * Place ring that shares single atom with already-placed ring (spiro).
 * Rotate to minimize overlap.
 */
function placeSpiroRing(
  ring: Ring,
  coords: Map<number, Vec2>,
  spiroAtomId: number,
  bondLength: number,
): void {
  const template = generateRingTemplate(ring.size, bondLength);

  // Find position of spiro atom in template
  const spiroIdx = ring.atomIds.indexOf(spiroAtomId);
  if (spiroIdx === -1) return;

  const templateSpiro = template[spiroIdx]!;
  const placedSpiro = coords.get(spiroAtomId)!;

  // Compute translation
  const dx = placedSpiro.x - templateSpiro.x;
  const dy = placedSpiro.y - templateSpiro.y;

  // Apply translation to all atoms
  for (let i = 0; i < ring.atomIds.length; i++) {
    const atomId = ring.atomIds[i]!;
    if (!coords.has(atomId)) {
      const p = template[i]!;
      coords.set(atomId, { x: p.x + dx, y: p.y + dy });
    }
  }
}

/**
 * Apply geometric transform to a point.
 */
function applyTransform(point: Vec2, transform: Transform): Vec2 {
  // Rotate
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  const rotated = {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };

  // Translate
  return {
    x: rotated.x + transform.translation.x,
    y: rotated.y + transform.translation.y,
  };
}
