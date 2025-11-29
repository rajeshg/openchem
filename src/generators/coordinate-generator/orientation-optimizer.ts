/**
 * Molecular Orientation Optimization
 *
 * Determines optimal viewing angle for molecules based on:
 * - Ring system topology (linear fused, single ring, etc.)
 * - Molecular shape (linear chain, branched, compact)
 * - Chemical drawing conventions
 *
 * Goal: Produce consistent, canonical orientations that match
 * standard chemical drawing practices.
 */

import type { Molecule } from "types";
import type { Vec2, RingSystem } from "./types";
import { computePrincipalAxis, rotateMolecule, getAspectRatio } from "./geometry-utils";

/**
 * Molecule type classification for orientation heuristics.
 */
export type MoleculeType =
  | "linear-fused-rings" // 3+ rings in linear arrangement (anthracene-like)
  | "two-fused-rings" // 2 rings fused (naphthalene-like)
  | "single-ring" // 1 ring (benzene-like)
  | "multiple-isolated-rings" // 2+ rings not fused
  | "linear-chain" // No rings, linear arrangement
  | "branched-chain" // No rings, branched
  | "ring-with-chain" // Ring(s) with attached chains
  | "compact"; // Cubane-like, no clear orientation

/**
 * Detect molecule type based on ring systems and topology.
 */
export function detectMoleculeType(
  molecule: Molecule,
  ringSystems: RingSystem[],
  coords: Map<number, Vec2>,
): MoleculeType {
  const totalRings = ringSystems.reduce((sum, sys) => sum + sys.rings.length, 0);

  // No rings: linear or branched chain
  if (totalRings === 0) {
    const aspectRatio = getAspectRatio(coords);
    return aspectRatio > 1.5 ? "linear-chain" : "branched-chain";
  }

  // Single ring
  if (totalRings === 1) {
    const ringAtoms = ringSystems[0]!.atomIds.size;
    const totalAtoms = molecule.atoms.length;

    // Pure ring (benzene, cyclopentane)
    if (ringAtoms === totalAtoms) {
      return "single-ring";
    }

    // Ring with substituents (toluene, aspirin)
    return "ring-with-chain";
  }

  // Multiple rings: check if fused or isolated
  if (ringSystems.length === 1) {
    // All rings in one system (fused/spiro/bridged)
    const system = ringSystems[0]!;

    // Check if rings are linearly fused
    if (system.type === "fused" && totalRings >= 3) {
      const isLinear = checkLinearFusion(system, coords);
      if (isLinear) return "linear-fused-rings";
    }

    if (totalRings === 2) {
      return "two-fused-rings";
    }

    // Complex fused system
    return "compact";
  }

  // Multiple isolated ring systems
  return "multiple-isolated-rings";
}

/**
 * Check if fused ring system has linear topology.
 * A linear system has each ring connected to at most 2 other rings,
 * and the rings form a chain (not a branched tree).
 */
function checkLinearFusion(system: RingSystem, coords: Map<number, Vec2>): boolean {
  if (system.rings.length < 3) return false;

  // Build adjacency graph of rings
  const adj = new Map<number, number[]>();
  for (const ring of system.rings) {
    adj.set(ring.id, []);
  }

  for (let i = 0; i < system.rings.length; i++) {
    for (let j = i + 1; j < system.rings.length; j++) {
      const ring1 = system.rings[i]!;
      const ring2 = system.rings[j]!;

      // Check if rings share atoms (fused)
      const shared = ring1.atomIds.filter((id) => ring2.atomIds.includes(id));
      if (shared.length >= 2) {
        adj.get(ring1.id)!.push(ring2.id);
        adj.get(ring2.id)!.push(ring1.id);
      }
    }
  }

  // Check if graph is a chain:
  // - Exactly 2 rings with degree 1 (ends)
  // - All other rings have degree 2 (middle)
  let endCount = 0;
  for (const neighbors of adj.values()) {
    if (neighbors.length === 1) endCount++;
    else if (neighbors.length === 2) continue;
    else return false; // Branched or cyclic
  }

  // Aspect ratio check: linear systems should be elongated
  const aspectRatio = getAspectRatio(coords);
  return endCount === 2 && aspectRatio > 1.3;
}

/**
 * Determine target orientation angle based on molecule type.
 * Returns angle in radians.
 *
 * Conventions:
 * - 0° = horizontal (along x-axis)
 * - π/2 = vertical (along y-axis)
 * - We prefer horizontal orientation for most molecules
 */
export function determineTargetOrientation(
  moleculeType: MoleculeType,
  molecule: Molecule,
  coords: Map<number, Vec2>,
): number {
  switch (moleculeType) {
    case "linear-fused-rings":
      // Anthracene, tetracene: horizontal
      return 0;

    case "two-fused-rings":
      // Naphthalene: horizontal
      return 0;

    case "single-ring": {
      // Benzene: prefer flat-top (top edge horizontal)
      // Flat-top means rotating so top edge is horizontal
      const ringSize = molecule.rings?.[0]?.length ?? 6;

      // For regular hexagon, flat-top means rotating by π/2 - π/6 = π/3
      // For regular pentagon, flat-top means rotating by π/2
      // General formula for flat-top: π/2 - π/n for even n, π/2 for odd n
      if (ringSize % 2 === 0) {
        // Even-sided polygon: rotate to flat-top
        return Math.PI / 2 - Math.PI / ringSize;
      } else {
        // Odd-sided polygon: rotate to point-top
        return Math.PI / 2;
      }
    }

    case "linear-chain":
      // n-hexane, n-octane: horizontal
      return 0;

    case "ring-with-chain": {
      // Aspirin, ibuprofen: orient so ring is on left, chain on right
      // Find centroid of ring vs centroid of non-ring atoms
      const ringAtoms = new Set<number>();
      if (molecule.rings && molecule.rings.length > 0) {
        for (const atomId of molecule.rings[0]!) {
          ringAtoms.add(atomId);
        }
      }

      // Compute ring centroid
      let ringCenterX = 0,
        ringCenterY = 0,
        ringCount = 0;
      for (const atomId of ringAtoms) {
        const coord = coords.get(atomId);
        if (coord) {
          ringCenterX += coord.x;
          ringCenterY += coord.y;
          ringCount++;
        }
      }
      if (ringCount > 0) {
        ringCenterX /= ringCount;
        ringCenterY /= ringCount;
      }

      // Compute non-ring centroid
      let chainCenterX = 0,
        chainCenterY = 0,
        chainCount = 0;
      for (const atom of molecule.atoms) {
        if (!ringAtoms.has(atom.id)) {
          const coord = coords.get(atom.id);
          if (coord) {
            chainCenterX += coord.x;
            chainCenterY += coord.y;
            chainCount++;
          }
        }
      }
      if (chainCount > 0) {
        chainCenterX /= chainCount;
        chainCenterY /= chainCount;
      }

      // Rotate so chain is to the right of ring
      const dx = chainCenterX - ringCenterX;
      const dy = chainCenterY - ringCenterY;
      const chainAngle = Math.atan2(dy, dx);

      // Target: chain on right (0°)
      return -chainAngle; // Rotation needed to make chain horizontal-right
    }

    case "multiple-isolated-rings":
      // Biphenyl: horizontal
      return 0;

    case "branched-chain":
    case "compact":
    default:
      // No strong preference: align principal axis horizontally
      return 0;
  }
}

/**
 * Optimize molecular orientation for canonical view.
 * Rotates molecule to match chemical drawing conventions.
 *
 * @param molecule - Molecule structure
 * @param ringSystems - Detected ring systems
 * @param coords - Atom coordinates (modified in place)
 */
export function optimizeMolecularOrientation(
  molecule: Molecule,
  ringSystems: RingSystem[],
  coords: Map<number, Vec2>,
): void {
  if (coords.size === 0) return;

  // Step 1: Detect molecule type
  const moleculeType = detectMoleculeType(molecule, ringSystems, coords);

  // Step 2: Compute current principal axis
  const principalAxis = computePrincipalAxis(coords);

  // Step 3: Determine target orientation
  const targetOrientation = determineTargetOrientation(moleculeType, molecule, coords);

  // Step 4: Compute rotation needed
  let rotationAngle = targetOrientation - principalAxis;

  // Normalize to [-π, π]
  while (rotationAngle > Math.PI) rotationAngle -= 2 * Math.PI;
  while (rotationAngle < -Math.PI) rotationAngle += 2 * Math.PI;

  // Step 5: Apply rotation
  if (Math.abs(rotationAngle) > 0.01) {
    // Only rotate if angle is significant (> 0.5°)
    rotateMolecule(coords, rotationAngle);
  }
}
