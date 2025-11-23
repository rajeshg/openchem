/**
 * Constrained force-directed relaxation for 2D coordinates.
 * Improves layout via spring forces while preserving ring geometry.
 */

import type { Vec2 } from "./types";
import type { Molecule, BondType } from "types";

export interface RelaxationOptions {
  iterations?: number;
  springConstant?: number;
  repulsionConstant?: number;
  angleConstant?: number;
  damping?: number;
  lockRingAtoms?: boolean;
}

const DEFAULT_OPTIONS: Required<RelaxationOptions> = {
  iterations: 100,
  springConstant: 0.5, // Reduce spring constant
  repulsionConstant: 5.0, // Reduce repulsion
  angleConstant: 0.2, // Reduce angle forces
  damping: 0.9, // Increase damping to prevent oscillation
  lockRingAtoms: true,
};

/**
 * Apply constrained force-directed relaxation.
 * Modifies coords in-place.
 */
export function relaxCoordinates(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  ringAtomIds: Set<number>,
  bondLength: number,
  options: RelaxationOptions = {},
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Initialize velocity map
  const velocities = new Map<number, Vec2>();
  for (const atom of molecule.atoms) {
    velocities.set(atom.id, { x: 0, y: 0 });
  }

  // Run relaxation iterations
  for (let iter = 0; iter < opts.iterations; iter++) {
    const forces = new Map<number, Vec2>();

    // Initialize forces to zero
    for (const atom of molecule.atoms) {
      forces.set(atom.id, { x: 0, y: 0 });
    }

    // Apply spring forces (bonds)
    applyBondForces(molecule, coords, forces, bondLength, opts.springConstant);

    // Apply repulsion forces (non-bonded atoms)
    applyRepulsionForces(
      molecule,
      coords,
      forces,
      bondLength,
      opts.repulsionConstant,
    );

    // Apply angle forces (maintain bond angles)
    applyAngleForces(molecule, coords, forces, opts.angleConstant);

    // Update velocities and positions (Verlet integration)
    for (const atom of molecule.atoms) {
      // Skip atoms without coordinates
      const coord = coords.get(atom.id);
      if (!coord) continue;

      // Skip locked ring atoms
      if (opts.lockRingAtoms && ringAtomIds.has(atom.id)) {
        continue;
      }

      const force = forces.get(atom.id)!;
      const velocity = velocities.get(atom.id)!;

      // Update velocity: v' = v * damping + force
      velocity.x = velocity.x * opts.damping + force.x;
      velocity.y = velocity.y * opts.damping + force.y;

      // Update position: pos' = pos + velocity
      coord.x += velocity.x;
      coord.y += velocity.y;
    }
  }
}

/**
 * Apply spring forces to maintain bond lengths.
 */
function applyBondForces(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  forces: Map<number, Vec2>,
  targetLength: number,
  springConstant: number,
): void {
  for (const bond of molecule.bonds) {
    const coord1 = coords.get(bond.atom1);
    const coord2 = coords.get(bond.atom2);

    if (!coord1 || !coord2) continue;

    // Compute displacement vector
    const dx = coord2.x - coord1.x;
    const dy = coord2.y - coord1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.001) continue; // Avoid division by zero

    // Ideal bond length (adjust for bond type)
    const idealLength = getIdealBondLength(bond.type, targetLength);

    // Spring force: F = k * (dist - ideal) / dist
    const displacement = dist - idealLength;
    const forceMagnitude = (springConstant * displacement) / dist;

    const fx = forceMagnitude * dx;
    const fy = forceMagnitude * dy;

    // Apply equal and opposite forces
    const force1 = forces.get(bond.atom1)!;
    const force2 = forces.get(bond.atom2)!;

    force1.x += fx;
    force1.y += fy;
    force2.x -= fx;
    force2.y -= fy;
  }
}

/**
 * Apply repulsion forces to prevent atom overlap.
 */
function applyRepulsionForces(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  forces: Map<number, Vec2>,
  bondLength: number,
  repulsionConstant: number,
): void {
  const atoms = Array.from(molecule.atoms);

  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const atom1 = atoms[i]!;
      const atom2 = atoms[j]!;

      // Skip bonded atoms (they're handled by spring forces)
      if (areBonded(molecule, atom1.id, atom2.id)) continue;

      const coord1 = coords.get(atom1.id);
      const coord2 = coords.get(atom2.id);

      if (!coord1 || !coord2) continue;

      // Compute distance
      const dx = coord2.x - coord1.x;
      const dy = coord2.y - coord1.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < 0.001) continue; // Avoid division by zero

      const dist = Math.sqrt(distSq);

      // Repulsion force: F = k / dist^2 (inverse square law)
      // Only apply if atoms are too close (< 2 * bondLength)
      const minDist = bondLength * 2;
      if (dist >= minDist) continue;

      const forceMagnitude = repulsionConstant / distSq;
      const fx = (forceMagnitude * dx) / dist;
      const fy = (forceMagnitude * dy) / dist;

      // Apply repulsive forces (push apart)
      const force1 = forces.get(atom1.id)!;
      const force2 = forces.get(atom2.id)!;

      force1.x -= fx;
      force1.y -= fy;
      force2.x += fx;
      force2.y += fy;
    }
  }
}

/**
 * Apply angle forces to maintain ideal bond angles.
 */
function applyAngleForces(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  forces: Map<number, Vec2>,
  angleConstant: number,
): void {
  // For each atom with 2+ neighbors, maintain ideal angles
  for (const atom of molecule.atoms) {
    const neighbors = getNeighbors(molecule, atom.id);
    if (neighbors.length < 2) continue;

    const coord = coords.get(atom.id);
    if (!coord) continue;

    // Get ideal angle for this atom's hybridization
    const idealAngle = getIdealAngle(atom.hybridization);

    // For each pair of neighbors, apply angle force
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const neighbor1 = neighbors[i]!;
        const neighbor2 = neighbors[j]!;

        const coord1 = coords.get(neighbor1);
        const coord2 = coords.get(neighbor2);

        if (!coord1 || !coord2) continue;

        // Compute vectors from center atom to neighbors
        const v1x = coord1.x - coord.x;
        const v1y = coord1.y - coord.y;
        const v2x = coord2.x - coord.x;
        const v2y = coord2.y - coord.y;

        const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

        if (len1 < 0.001 || len2 < 0.001) continue;

        // Normalize vectors
        const u1x = v1x / len1;
        const u1y = v1y / len1;
        const u2x = v2x / len2;
        const u2y = v2y / len2;

        // Compute current angle
        const dot = u1x * u2x + u1y * u2y;
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

        // Angle error
        const error = angle - idealAngle;

        // Apply torque to rotate neighbors toward ideal angle
        const torque = angleConstant * error;

        // Perpendicular vectors (rotate 90°)
        const perp1x = -u1y;
        const perp1y = u1x;
        const perp2x = -u2y;
        const perp2y = u2x;

        // Apply forces perpendicular to bonds
        const force1 = forces.get(neighbor1)!;
        const force2 = forces.get(neighbor2)!;

        force1.x += torque * perp1x;
        force1.y += torque * perp1y;
        force2.x -= torque * perp2x;
        force2.y -= torque * perp2y;
      }
    }
  }
}

/**
 * Get ideal bond length for bond type.
 */
function getIdealBondLength(
  bondType: BondType,
  baseBondLength: number,
): number {
  switch (bondType) {
    case "single":
      return baseBondLength;
    case "double":
      return baseBondLength * 0.9; // Slightly shorter
    case "triple":
      return baseBondLength * 0.85; // Even shorter
    case "aromatic":
      return baseBondLength * 0.95; // Between single and double
    default:
      return baseBondLength;
  }
}

/**
 * Get ideal angle for atom hybridization (in radians).
 */
function getIdealAngle(hybridization?: string): number {
  switch (hybridization) {
    case "sp":
      return Math.PI; // 180°
    case "sp2":
      return (2 * Math.PI) / 3; // 120°
    case "sp3":
      return (109.5 * Math.PI) / 180; // 109.5° (tetrahedral)
    default:
      return (2 * Math.PI) / 3; // Default to 120°
  }
}

/**
 * Check if two atoms are bonded.
 */
function areBonded(molecule: Molecule, atom1: number, atom2: number): boolean {
  for (const bond of molecule.bonds) {
    if (
      (bond.atom1 === atom1 && bond.atom2 === atom2) ||
      (bond.atom1 === atom2 && bond.atom2 === atom1)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Get neighbor atom IDs for given atom.
 */
function getNeighbors(molecule: Molecule, atomId: number): number[] {
  const neighbors: number[] = [];
  for (const bond of molecule.bonds) {
    if (bond.atom1 === atomId) {
      neighbors.push(bond.atom2);
    } else if (bond.atom2 === atomId) {
      neighbors.push(bond.atom1);
    }
  }
  return neighbors;
}
