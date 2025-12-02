/**
 * Coordinate Generator - Rigid Unit Architecture
 *
 * High-quality 2D coordinate generation using rigid unit placement:
 * - Ring systems placed with perfect geometry (regular polygons)
 * - Rigid body optimization preserves internal geometry
 * - DOF-based minimization for optimal layout
 *
 * Usage:
 *   const coords = generateCoordinates(molecule);
 *   // coords is Array<{x, y}> indexed by atom ID
 */

import type { Molecule } from "types";
import type { Vec2, Ring } from "./types";
import { DEFAULT_COORDINATE_OPTIONS } from "./types";
import { detectFusedRingSystems } from "./ring-system-detector";
import { resolveOverlaps } from "./overlap-resolver";
import { optimizeMolecularOrientation } from "./orientation-optimizer";
import { detectRigidUnits } from "./rigid-unit-detector";
import { placeRigidUnits } from "./rigid-unit-placer";
import { minimizeRigidBodies } from "./rigid-body-minimizer";
import { relaxBridgedSystems } from "./bridged-relaxer";

export interface GenerateOptions {
  bondLength?: number;
  resolveOverlapsEnabled?: boolean;
  overlapResolutionIterations?: number;
  optimizeOrientation?: boolean;
}

/**
 * Generate 2D coordinates for molecule atoms with uniform bond lengths.
 *
 * Uses the rigid unit architecture for high-quality coordinate generation:
 * 1. Detect rigid units (ring systems, chains)
 * 2. Place each unit with perfect geometry (regular polygons for rings)
 * 3. Optimize unit positions using DOF-based minimization
 * 4. Resolve any remaining overlaps
 * 5. Optimize molecular orientation (rotate to canonical view)
 *
 * Benefits:
 * - Perfect ring geometry (always regular polygons)
 * - Atoms within a unit never move relative to each other
 * - Consistent, professional-quality structures
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
  const optimizeOrientation = options.optimizeOrientation ?? true;
  const resolveOverlapsEnabled = options.resolveOverlapsEnabled ?? true;

  // Step 1: Convert molecule rings to Ring[] format
  const rings: Ring[] = (molecule.rings ?? []).map((atomIds, idx) => ({
    id: idx,
    atomIds: [...atomIds],
    size: atomIds.length,
    aromatic: atomIds.every((id) => molecule.atoms[id]?.aromatic ?? false),
  }));

  // Step 2: Detect ring systems
  const ringSystems = detectFusedRingSystems(rings, molecule);

  // Step 3: Detect rigid units
  const rigidGraph = detectRigidUnits(molecule, ringSystems);

  // Step 4: Place rigid units with perfect geometry
  const placement = placeRigidUnits(rigidGraph, molecule, { bondLength });
  const coords = placement.coords;

  // Step 5: Optimize unit positions using DOF-based minimization
  minimizeRigidBodies(rigidGraph, molecule, coords, {
    bondLength,
    rotationSteps: 12,
    tryFlips: true,
    refinementIterations: 50,
  });

  // Step 5.5: Relax bridged systems (they need special handling)
  relaxBridgedSystems(rigidGraph, molecule, coords, bondLength);

  // Step 6: Resolve any remaining overlaps
  if (resolveOverlapsEnabled) {
    for (let pass = 0; pass < 3; pass++) {
      const hadOverlaps = resolveOverlaps(molecule, coords, bondLength, {
        maxIterations: 50,
        minDistance: 0.35,
        pushFactor: 0.2,
      });
      if (!hadOverlaps) break;
    }
  }

  // Step 7: Optimize molecular orientation
  if (optimizeOrientation) {
    optimizeMolecularOrientation(molecule, ringSystems, coords);
  }

  // Convert Map to array indexed by atom ID
  const coordsArray: Array<{ x: number; y: number }> = [];
  for (const atom of molecule.atoms) {
    const coord = coords.get(atom.id);
    if (coord) {
      coordsArray[atom.id] = { x: coord.x, y: coord.y };
    } else {
      coordsArray[atom.id] = { x: 0, y: 0 };
    }
  }

  return coordsArray;
}

/**
 * Generate 2D coordinates as Map format.
 * Used internally by helper functions like hasOverlaps, centerCoordinates, etc.
 * Most users should use `generateCoordinates` instead which returns an array.
 */
export function generateCoordinatesMap(
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
export { resolveOverlaps, hasOverlaps, getOverlapStats } from "./overlap-resolver";
export { detectRigidUnits, getPlacementOrder } from "./rigid-unit-detector";
export { placeRigidUnits } from "./rigid-unit-placer";
export { minimizeRigidBodies } from "./rigid-body-minimizer";
export type { Vec2, CoordinateOptions, Ring, RingSystem } from "./types";
export type { RigidUnit, RigidUnitGraph } from "./rigid-unit-detector";
