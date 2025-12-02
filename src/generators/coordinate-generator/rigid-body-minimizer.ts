/**
 * Rigid Body Minimizer
 *
 * Optimizes 2D layout by manipulating rigid unit DOFs (degrees of freedom):
 * - Rotation around bond to parent
 * - Flip across bond axis
 * - Translation (for root unit only)
 *
 * Key difference from standard force-field:
 * - Individual atoms within a rigid unit NEVER move relative to each other
 * - All atoms in a unit move together as a single body
 * - Only inter-unit forces are computed (clash, bond stretch at connections)
 *
 * This preserves perfect ring geometry while resolving overlaps and
 * optimizing overall layout.
 *
 * Algorithm:
 * 1. For each non-root unit, try discrete DOF states (rotations, flips)
 * 2. Score each configuration based on:
 *    - Bond stretch at unit connections
 *    - Clashes between atoms in different units
 *    - Angle strain at connection points
 * 3. Select best configuration
 * 4. Optional: gradient descent for continuous rotation optimization
 */

import type { Molecule } from "types";
import type { Vec2 } from "./types";
import type { RigidUnit, RigidUnitGraph } from "./rigid-unit-detector";
import { getPlacementOrder } from "./rigid-unit-detector";

/** Options for rigid body minimization */
export interface RigidBodyMinimizerOptions {
  bondLength: number;
  /** Number of discrete rotation angles to try (default: 12 = 30° steps) */
  rotationSteps?: number;
  /** Try flipping each unit (default: true) */
  tryFlips?: boolean;
  /** Number of gradient descent iterations (default: 50) */
  refinementIterations?: number;
  /** Weight for bond stretch penalty (default: 1.0) */
  stretchWeight?: number;
  /** Weight for clash penalty (default: 1.0) */
  clashWeight?: number;
  /** Weight for angle deviation penalty (default: 0.3) */
  angleWeight?: number;
}

const DEFAULT_OPTIONS: Required<RigidBodyMinimizerOptions> = {
  bondLength: 35,
  rotationSteps: 12,
  tryFlips: true,
  refinementIterations: 50,
  stretchWeight: 1.0,
  clashWeight: 1.0,
  angleWeight: 0.3,
};

/** Configuration state for a unit */
interface UnitConfiguration {
  rotationAngle: number; // in radians
  flipped: boolean;
}

/**
 * Optimize rigid unit positions by trying discrete DOF configurations.
 * Modifies coords in-place.
 *
 * @returns Final energy score
 */
export function minimizeRigidBodies(
  graph: RigidUnitGraph,
  molecule: Molecule,
  coords: Map<number, Vec2>,
  options: Partial<RigidBodyMinimizerOptions> = {},
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options } as Required<RigidBodyMinimizerOptions>;
  const bondLength = opts.bondLength;

  // Get units in placement order (children after parents)
  const units = getPlacementOrder(graph);

  // Store current best configurations
  const configurations = new Map<number, UnitConfiguration>();
  for (const unit of units) {
    configurations.set(unit.id, { rotationAngle: 0, flipped: false });
  }

  // Phase 1: Discrete DOF optimization
  // For each non-root unit, try different rotation angles and flip states
  for (const unit of units) {
    if (!unit.parent) continue; // Root unit doesn't rotate

    const bestConfig = findBestConfiguration(unit, graph, molecule, coords, configurations, opts);

    configurations.set(unit.id, bestConfig);

    // Apply best configuration
    applyConfiguration(unit, bestConfig, graph, coords, bondLength);
  }

  // Phase 2: Continuous refinement via gradient descent
  if (opts.refinementIterations > 0) {
    refineConfigurations(graph, molecule, coords, configurations, opts);
  }

  // Return final energy
  return computeTotalEnergy(graph, molecule, coords, opts);
}

/**
 * Find the best discrete configuration for a unit.
 */
function findBestConfiguration(
  unit: RigidUnit,
  graph: RigidUnitGraph,
  molecule: Molecule,
  coords: Map<number, Vec2>,
  _currentConfigs: Map<number, UnitConfiguration>,
  opts: Required<RigidBodyMinimizerOptions>,
): UnitConfiguration {
  const bondLength = opts.bondLength;
  const rotationSteps = opts.rotationSteps;
  const angleStep = (2 * Math.PI) / rotationSteps;

  let bestConfig: UnitConfiguration = { rotationAngle: 0, flipped: false };
  let bestEnergy = Infinity;

  // Store original coordinates
  const originalCoords = new Map<number, Vec2>();
  for (const atomId of unit.atomIds) {
    const coord = coords.get(atomId);
    if (coord) {
      originalCoords.set(atomId, { x: coord.x, y: coord.y });
    }
  }

  // Try each rotation angle
  for (let r = 0; r < rotationSteps; r++) {
    const rotation = r * angleStep;

    // Try without flip
    const config1: UnitConfiguration = { rotationAngle: rotation, flipped: false };
    applyConfiguration(unit, config1, graph, coords, bondLength);
    const energy1 = computeUnitEnergy(unit, graph, molecule, coords, opts);

    if (energy1 < bestEnergy) {
      bestEnergy = energy1;
      bestConfig = config1;
    }

    // Restore original
    for (const [atomId, coord] of originalCoords) {
      coords.set(atomId, { x: coord.x, y: coord.y });
    }

    // Try with flip (if enabled)
    if (opts.tryFlips) {
      const config2: UnitConfiguration = { rotationAngle: rotation, flipped: true };
      applyConfiguration(unit, config2, graph, coords, bondLength);
      const energy2 = computeUnitEnergy(unit, graph, molecule, coords, opts);

      if (energy2 < bestEnergy) {
        bestEnergy = energy2;
        bestConfig = config2;
      }

      // Restore original
      for (const [atomId, coord] of originalCoords) {
        coords.set(atomId, { x: coord.x, y: coord.y });
      }
    }
  }

  return bestConfig;
}

/**
 * Apply a configuration (rotation + flip) to a unit.
 */
function applyConfiguration(
  unit: RigidUnit,
  config: UnitConfiguration,
  _graph: RigidUnitGraph,
  coords: Map<number, Vec2>,
  bondLength: number,
): void {
  if (!unit.bondToParent) return;

  const parentAtomId = unit.bondToParent.parentAtom;
  const childAtomId = unit.bondToParent.childAtom;

  const parentPos = coords.get(parentAtomId);
  const childPos = coords.get(childAtomId);
  if (!parentPos || !childPos) return;

  // Calculate pivot point (connection to parent)
  const pivot: Vec2 = {
    x: parentPos.x + bondLength * Math.cos(config.rotationAngle),
    y: parentPos.y + bondLength * Math.sin(config.rotationAngle),
  };

  // Rotation angle to align child with pivot
  const currentAngle = Math.atan2(childPos.y - parentPos.y, childPos.x - parentPos.x);
  const targetAngle = config.rotationAngle;
  const deltaAngle = targetAngle - currentAngle;

  // Transform all atoms in unit
  for (const atomId of unit.atomIds) {
    const pos = coords.get(atomId);
    if (!pos) continue;

    // Translate to origin (relative to child position)
    let x = pos.x - childPos.x;
    let y = pos.y - childPos.y;

    // Rotate
    const cos = Math.cos(deltaAngle);
    const sin = Math.sin(deltaAngle);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;

    // Flip if needed
    let fx = rx;
    let fy = ry;
    if (config.flipped) {
      // Flip across the bond axis
      fy = -fy;
    }

    // Translate to pivot position
    coords.set(atomId, {
      x: pivot.x + fx,
      y: pivot.y + fy,
    });
  }
}

/**
 * Compute energy contribution from a single unit.
 */
function computeUnitEnergy(
  unit: RigidUnit,
  graph: RigidUnitGraph,
  molecule: Molecule,
  coords: Map<number, Vec2>,
  opts: Required<RigidBodyMinimizerOptions>,
): number {
  let energy = 0;
  const bondLength = opts.bondLength;

  // 1. Bond stretch at connection to parent
  if (unit.bondToParent) {
    const parentPos = coords.get(unit.bondToParent.parentAtom);
    const childPos = coords.get(unit.bondToParent.childAtom);
    if (parentPos && childPos) {
      const dx = childPos.x - parentPos.x;
      const dy = childPos.y - parentPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const stretch = dist - bondLength;
      energy += opts.stretchWeight * stretch * stretch;
    }
  }

  // 2. Clashes with atoms in OTHER units
  for (const atomId of unit.atomIds) {
    const pos = coords.get(atomId);
    if (!pos) continue;

    // Check against all atoms not in this unit
    for (const otherUnit of graph.units) {
      if (otherUnit.id === unit.id) continue;

      for (const otherAtomId of otherUnit.atomIds) {
        // Skip bonded atoms
        const bonded = molecule.bonds.some(
          (b) =>
            (b.atom1 === atomId && b.atom2 === otherAtomId) ||
            (b.atom1 === otherAtomId && b.atom2 === atomId),
        );
        if (bonded) continue;

        const otherPos = coords.get(otherAtomId);
        if (!otherPos) continue;

        const dx = pos.x - otherPos.x;
        const dy = pos.y - otherPos.y;
        const distSq = dx * dx + dy * dy;

        const minDist = bondLength * 0.7;
        const minDistSq = minDist * minDist;

        if (distSq < minDistSq) {
          const dist = Math.sqrt(distSq);
          const penetration = (minDist - dist) / minDist;
          energy += opts.clashWeight * penetration * penetration * 100;
        }
      }
    }
  }

  // 3. Angle deviation at connection
  if (unit.bondToParent) {
    const parentAtomId = unit.bondToParent.parentAtom;
    const parentPos = coords.get(parentAtomId);
    if (parentPos) {
      // Get other neighbors of parent
      const parentNeighbors: Vec2[] = [];
      for (const bond of molecule.bonds) {
        let neighborId = -1;
        if (bond.atom1 === parentAtomId) neighborId = bond.atom2;
        else if (bond.atom2 === parentAtomId) neighborId = bond.atom1;

        if (neighborId !== -1 && neighborId !== unit.bondToParent.childAtom) {
          const nPos = coords.get(neighborId);
          if (nPos) parentNeighbors.push(nPos);
        }
      }

      const childPos = coords.get(unit.bondToParent.childAtom);
      if (childPos && parentNeighbors.length > 0) {
        // Check angle between child bond and other bonds
        const childVec = {
          x: childPos.x - parentPos.x,
          y: childPos.y - parentPos.y,
        };
        const childLen = Math.sqrt(childVec.x * childVec.x + childVec.y * childVec.y);

        for (const nPos of parentNeighbors) {
          const nVec = { x: nPos.x - parentPos.x, y: nPos.y - parentPos.y };
          const nLen = Math.sqrt(nVec.x * nVec.x + nVec.y * nVec.y);

          if (childLen > 0.001 && nLen > 0.001) {
            const dot = (childVec.x * nVec.x + childVec.y * nVec.y) / (childLen * nLen);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

            // Ideal angle is 120° (2π/3) in 2D
            const idealAngle = (2 * Math.PI) / 3;
            const deviation = angle - idealAngle;
            energy += opts.angleWeight * deviation * deviation;
          }
        }
      }
    }
  }

  return energy;
}

/**
 * Compute total energy for all units.
 */
function computeTotalEnergy(
  graph: RigidUnitGraph,
  molecule: Molecule,
  coords: Map<number, Vec2>,
  opts: Required<RigidBodyMinimizerOptions>,
): number {
  let total = 0;
  for (const unit of graph.units) {
    total += computeUnitEnergy(unit, graph, molecule, coords, opts);
  }
  return total;
}

/**
 * Refine configurations using gradient descent on rotation angles.
 */
function refineConfigurations(
  graph: RigidUnitGraph,
  molecule: Molecule,
  coords: Map<number, Vec2>,
  configurations: Map<number, UnitConfiguration>,
  opts: Required<RigidBodyMinimizerOptions>,
): void {
  const stepSize = 0.05; // radians
  const units = getPlacementOrder(graph);

  for (let iter = 0; iter < opts.refinementIterations; iter++) {
    let improved = false;

    for (const unit of units) {
      if (!unit.parent) continue;

      const config = configurations.get(unit.id);
      if (!config) continue;

      // Store current coordinates
      const originalCoords = new Map<number, Vec2>();
      for (const atomId of unit.atomIds) {
        const pos = coords.get(atomId);
        if (pos) originalCoords.set(atomId, { x: pos.x, y: pos.y });
      }

      const currentEnergy = computeUnitEnergy(unit, graph, molecule, coords, opts);

      // Try small rotation in positive direction
      const config1: UnitConfiguration = {
        rotationAngle: config.rotationAngle + stepSize,
        flipped: config.flipped,
      };
      applyConfiguration(unit, config1, graph, coords, opts.bondLength);
      const energy1 = computeUnitEnergy(unit, graph, molecule, coords, opts);

      // Restore
      for (const [atomId, pos] of originalCoords) {
        coords.set(atomId, { x: pos.x, y: pos.y });
      }

      // Try small rotation in negative direction
      const config2: UnitConfiguration = {
        rotationAngle: config.rotationAngle - stepSize,
        flipped: config.flipped,
      };
      applyConfiguration(unit, config2, graph, coords, opts.bondLength);
      const energy2 = computeUnitEnergy(unit, graph, molecule, coords, opts);

      // Restore
      for (const [atomId, pos] of originalCoords) {
        coords.set(atomId, { x: pos.x, y: pos.y });
      }

      // Apply best improvement
      if (energy1 < currentEnergy && energy1 <= energy2) {
        configurations.set(unit.id, config1);
        applyConfiguration(unit, config1, graph, coords, opts.bondLength);
        improved = true;
      } else if (energy2 < currentEnergy) {
        configurations.set(unit.id, config2);
        applyConfiguration(unit, config2, graph, coords, opts.bondLength);
        improved = true;
      }
    }

    // Early termination if no improvement
    if (!improved) break;
  }
}

/**
 * Rotate all atoms in a unit around a pivot point.
 */
export function rotateUnitAroundPivot(
  unit: RigidUnit,
  coords: Map<number, Vec2>,
  pivot: Vec2,
  angle: number,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (const atomId of unit.atomIds) {
    const pos = coords.get(atomId);
    if (!pos) continue;

    const dx = pos.x - pivot.x;
    const dy = pos.y - pivot.y;

    coords.set(atomId, {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos,
    });
  }
}

/**
 * Flip all atoms in a unit across an axis through a pivot.
 */
export function flipUnitAcrossAxis(
  unit: RigidUnit,
  coords: Map<number, Vec2>,
  pivot: Vec2,
  axisAngle: number,
): void {
  // Flip across line through pivot at axisAngle
  const cos2 = Math.cos(2 * axisAngle);
  const sin2 = Math.sin(2 * axisAngle);

  for (const atomId of unit.atomIds) {
    const pos = coords.get(atomId);
    if (!pos) continue;

    const dx = pos.x - pivot.x;
    const dy = pos.y - pivot.y;

    // Reflection formula: p' = 2(p·n)n - p where n is unit normal
    coords.set(atomId, {
      x: pivot.x + dx * cos2 + dy * sin2,
      y: pivot.y + dx * sin2 - dy * cos2,
    });
  }
}

/**
 * Translate all atoms in a unit.
 */
export function translateUnit(
  unit: RigidUnit,
  coords: Map<number, Vec2>,
  dx: number,
  dy: number,
): void {
  for (const atomId of unit.atomIds) {
    const pos = coords.get(atomId);
    if (!pos) continue;
    coords.set(atomId, { x: pos.x + dx, y: pos.y + dy });
  }
}

/**
 * Get centroid of a unit.
 */
export function getUnitCentroid(unit: RigidUnit, coords: Map<number, Vec2>): Vec2 {
  let cx = 0,
    cy = 0,
    count = 0;

  for (const atomId of unit.atomIds) {
    const pos = coords.get(atomId);
    if (pos) {
      cx += pos.x;
      cy += pos.y;
      count++;
    }
  }

  return count > 0 ? { x: cx / count, y: cy / count } : { x: 0, y: 0 };
}

/**
 * Debug: print minimization progress.
 */
export function debugPrintMinimization(
  graph: RigidUnitGraph,
  molecule: Molecule,
  coords: Map<number, Vec2>,
  opts: RigidBodyMinimizerOptions,
): void {
  const fullOpts = { ...DEFAULT_OPTIONS, ...opts };
  const energy = computeTotalEnergy(graph, molecule, coords, fullOpts);

  console.log("\n=== Rigid Body Minimization ===");
  console.log(`Total units: ${graph.units.length}`);
  console.log(`Total energy: ${energy.toFixed(4)}`);

  for (const unit of graph.units) {
    const unitEnergy = computeUnitEnergy(unit, graph, molecule, coords, fullOpts);
    const centroid = getUnitCentroid(unit, coords);
    console.log(
      `  Unit ${unit.id} (${unit.type}): ` +
        `energy=${unitEnergy.toFixed(4)}, ` +
        `centroid=(${centroid.x.toFixed(2)}, ${centroid.y.toFixed(2)})`,
    );
  }
}
