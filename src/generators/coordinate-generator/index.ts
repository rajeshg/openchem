/**
 * Coordinate Generator v2 - Main Pipeline
 *
 * Canonicalization-independent 2D coordinate generation with:
 * - Ring system detection and placement
 * - Substituent attachment
 * - Force-directed relaxation
 * - Overlap resolution
 *
 * Usage:
 *   const coords = generateCoordinatesV2(molecule);
 *   // coords is Map<atomId, {x, y}>
 */

import type { Molecule } from "types";
import type { Vec2, Ring } from "./types";
import { DEFAULT_COORDINATE_OPTIONS } from "./types";
import { detectFusedRingSystems } from "./ring-system-detector";
import { placeFusedRingSystem } from "./fused-ring-placer";
import { attachSubstituents } from "./substituent-placer";
import { relaxCoordinates } from "./constrained-relaxer";
import { resolveOverlaps } from "./overlap-resolver";
import { normalizeBondLengths } from "./geometry-utils";

export interface GenerateOptions {
  bondLength?: number;
  relaxIterations?: number;
  resolveOverlapsEnabled?: boolean;
  lockRingAtoms?: boolean;
  overlapResolutionIterations?: number;
}

/**
 * Generate 2D coordinates for molecule atoms with uniform bond lengths.
 *
 * This is the primary coordinate generation algorithm that produces
 * professional-quality 2D structures with uniform bond lengths throughout
 * the entire molecule.
 *
 * Algorithm:
 * 1. Detect ring systems (fused, spiro, bridged)
 * 2. Place ring systems with correct geometry
 * 3. Attach substituents via BFS
 * 4. Apply force-directed relaxation
 * 5. Resolve any remaining overlaps
 * 6. Normalize all bond lengths for uniformity (critical step for SVG rendering)
 *
 * @param molecule - Molecule to generate coordinates for
 * @param options - Generation options
 * @returns Array of coordinates indexed by atom ID
 */
export function generateCoordinates(
  molecule: Molecule,
  options: GenerateOptions = {},
): Array<{ x: number; y: number }> {
  const bondLength = options.bondLength ?? DEFAULT_COORDINATE_OPTIONS.bondLength;
  const relaxIterations = options.relaxIterations ?? 0; // No relaxation to preserve terminal atom placement
  const resolveOverlapsEnabled = options.resolveOverlapsEnabled ?? true;
  const lockRingAtoms = options.lockRingAtoms ?? true;
  const overlapResolutionIterations = options.overlapResolutionIterations ?? 100;

  // Initialize coordinate map
  const coords = new Map<number, Vec2>();

  // Step 1: Convert molecule rings to Ring[] format
  const rings: Ring[] = (molecule.rings ?? []).map((atomIds, idx) => ({
    id: idx,
    atomIds: [...atomIds],
    size: atomIds.length,
    aromatic: atomIds.some((id) => molecule.atoms[id]?.aromatic ?? false),
  }));

  // Step 2: Detect ring systems
  const ringSystems = detectFusedRingSystems(rings, molecule);

  // Track which atoms are in rings
  const ringAtomIds = new Set<number>();
  for (const system of ringSystems) {
    for (const ring of system.rings) {
      for (const atomId of ring.atomIds) {
        ringAtomIds.add(atomId);
      }
    }
  }

  // Step 3: Place ring systems
  // Track which systems have been placed
  const placedSystems = new Set<number>();

  for (const system of ringSystems) {
    const systemCoords = placeFusedRingSystem(system, molecule, bondLength);

    // Check if this system is connected to an already-placed system via a bond
    let connectedToPlaced = false;
    let connectingBond: {
      from: number;
      to: number;
      fromCoord?: Vec2;
      toCoord?: Vec2;
    } | null = null;

    if (placedSystems.size > 0) {
      // Check all bonds to see if any connect this system to a placed system
      for (const bond of molecule.bonds) {
        const fromInCurrent = system.atomIds.has(bond.atom1);
        const toInCurrent = system.atomIds.has(bond.atom2);
        const fromInPlaced = coords.has(bond.atom1);
        const toInPlaced = coords.has(bond.atom2);

        // Bond connects current system to already-placed system
        if (fromInCurrent && toInPlaced) {
          connectedToPlaced = true;
          connectingBond = {
            from: bond.atom2, // already placed atom
            to: bond.atom1, // atom in current system
            fromCoord: coords.get(bond.atom2),
            toCoord: systemCoords.get(bond.atom1),
          };
          break;
        } else if (toInCurrent && fromInPlaced) {
          connectedToPlaced = true;
          connectingBond = {
            from: bond.atom1, // already placed atom
            to: bond.atom2, // atom in current system
            fromCoord: coords.get(bond.atom1),
            toCoord: systemCoords.get(bond.atom2),
          };
          break;
        }
      }
    }

    // If connected, position the system relative to the connecting bond
    if (connectedToPlaced && connectingBond?.fromCoord && connectingBond?.toCoord) {
      // Calculate angle from 'to' atom in system to center of system
      const centerX =
        Array.from(systemCoords.values()).reduce((sum, c) => sum + c.x, 0) / systemCoords.size;
      const centerY =
        Array.from(systemCoords.values()).reduce((sum, c) => sum + c.y, 0) / systemCoords.size;

      const angle = Math.atan2(
        centerY - connectingBond.toCoord.y,
        centerX - connectingBond.toCoord.x,
      );

      // Position the system so the connecting atom is at bond-length distance
      const targetX = connectingBond.fromCoord.x + bondLength * Math.cos(angle);
      const targetY = connectingBond.fromCoord.y + bondLength * Math.sin(angle);

      // Calculate translation
      const dx = targetX - connectingBond.toCoord.x;
      const dy = targetY - connectingBond.toCoord.y;

      // Translate all atoms in this system
      for (const coord of systemCoords.values()) {
        coord.x += dx;
        coord.y += dy;
      }
    }

    // Merge system coords into main coords map
    for (const [atomId, coord] of systemCoords.entries()) {
      coords.set(atomId, coord);
    }

    placedSystems.add(system.id);
  }

  // Step 4: Handle molecules with no rings (acyclic molecules)
  if (ringAtomIds.size === 0 && molecule.atoms.length > 0) {
    // Place first atom at origin
    coords.set(0, { x: 0, y: 0 });
    ringAtomIds.add(0); // Seed the BFS from first atom
  }

  // Step 5: Attach substituents (non-ring atoms)
  attachSubstituents(molecule, coords, ringAtomIds, bondLength);

  // Step 6: Apply force-directed relaxation
  relaxCoordinates(molecule, coords, ringAtomIds, bondLength, {
    iterations: relaxIterations,
    lockRingAtoms,
  });

  // Step 7: Resolve overlaps (if enabled)
  if (resolveOverlapsEnabled) {
    resolveOverlaps(molecule, coords, bondLength, {
      maxIterations: overlapResolutionIterations,
    });
  }

  // Step 8: Normalize all bond lengths to enforce uniformity
  // This is critical for professional-looking diagrams with consistent bond lengths
  normalizeBondLengths(molecule.bonds, coords, bondLength);

  // Convert Map to array indexed by atom ID
  const coordsArray: Array<{ x: number; y: number }> = [];
  for (const atom of molecule.atoms) {
    const coord = coords.get(atom.id);
    if (coord) {
      coordsArray[atom.id] = { x: coord.x, y: coord.y };
    } else {
      // Fallback: place at origin if coordinate missing
      coordsArray[atom.id] = { x: 0, y: 0 };
    }
  }

  return coordsArray;
}

/**
 * Generate 2D coordinates as Map format (for advanced use cases).
 * Most users should use `generateCoordinates` instead.
 *
 * @internal
 */
export function generateCoordinatesV2(
  molecule: Molecule,
  options: GenerateOptions = {},
): Map<number, Vec2> {
  // Generate using main function
  const coordsArray = generateCoordinates(molecule, options);

  // Convert array back to Map
  const coordsMap = new Map<number, Vec2>();
  for (let i = 0; i < coordsArray.length; i++) {
    const coord = coordsArray[i];
    if (coord) {
      coordsMap.set(i, coord);
    }
  }
  return coordsMap;
}

/**
 * Check if molecule has valid coordinates.
 */
export function hasValidCoordinates(coords: Map<number, Vec2>): boolean {
  if (coords.size === 0) return false;

  for (const coord of coords.values()) {
    if (!Number.isFinite(coord.x) || !Number.isFinite(coord.y)) {
      return false;
    }
  }

  return true;
}

/**
 * Get bounding box of coordinates.
 */
export function getBoundingBox(coords: Map<number, Vec2>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} | null {
  if (coords.size === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const coord of coords.values()) {
    minX = Math.min(minX, coord.x);
    maxX = Math.max(maxX, coord.x);
    minY = Math.min(minY, coord.y);
    maxY = Math.max(maxY, coord.y);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Center coordinates around origin.
 * Modifies coords in-place.
 */
export function centerCoordinates(coords: Map<number, Vec2>): void {
  const bbox = getBoundingBox(coords);
  if (!bbox) return;

  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  for (const coord of coords.values()) {
    coord.x -= centerX;
    coord.y -= centerY;
  }
}

/**
 * Scale coordinates to fit target size.
 * Modifies coords in-place.
 */
export function scaleCoordinates(
  coords: Map<number, Vec2>,
  targetWidth: number,
  targetHeight: number,
): void {
  const bbox = getBoundingBox(coords);
  if (!bbox) return;

  const scaleX = targetWidth / bbox.width;
  const scaleY = targetHeight / bbox.height;
  const scale = Math.min(scaleX, scaleY);

  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  for (const coord of coords.values()) {
    coord.x = (coord.x - centerX) * scale;
    coord.y = (coord.y - centerY) * scale;
  }
}

/**
 * Export all public APIs
 */
export { detectFusedRingSystems } from "./ring-system-detector";
export { placeFusedRingSystem } from "./fused-ring-placer";
export { attachSubstituents } from "./substituent-placer";
export { relaxCoordinates } from "./constrained-relaxer";
export { resolveOverlaps, hasOverlaps, getOverlapStats } from "./overlap-resolver";
export type { Vec2, CoordinateOptions, Ring, RingSystem } from "./types";
