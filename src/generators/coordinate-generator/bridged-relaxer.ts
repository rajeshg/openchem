/**
 * Bridged System Relaxation
 *
 * Force-directed relaxation for bridged polycyclic ring systems.
 * Bridged systems (adamantane, norbornane, cubane) are inherently 3D
 * and cannot be represented with uniform bond lengths in 2D.
 * This relaxer minimizes bond length variance for these systems.
 */

import type { Molecule } from "types";
import type { Vec2 } from "./types";
import type { RigidUnitGraph } from "./rigid-unit-detector";

/**
 * Apply force-directed relaxation to bridged ring systems.
 * Only applies relaxation if the system has severely stretched bonds.
 * Modifies coords in-place.
 */
export function relaxBridgedSystems(
  rigidGraph: RigidUnitGraph,
  molecule: Molecule,
  coords: Map<number, Vec2>,
  bondLength: number,
): void {
  // Find bridged ring systems
  for (const unit of rigidGraph.units) {
    if (unit.type !== "ring-system" || unit.ringSystemType !== "bridged") {
      continue;
    }

    // Get atoms in this bridged system
    const coreAtomIds = [...unit.atomIds];
    const coreSet = new Set(coreAtomIds);

    // Get bonds within this system
    const coreBonds = molecule.bonds.filter((b) => coreSet.has(b.atom1) && coreSet.has(b.atom2));

    // Check if relaxation is needed: only if we have severely stretched bonds
    let maxStretch = 0;
    for (const bond of coreBonds) {
      const c1 = coords.get(bond.atom1);
      const c2 = coords.get(bond.atom2);
      if (c1 && c2) {
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const stretch = dist / bondLength;
        if (stretch > maxStretch) maxStretch = stretch;
      }
    }

    // Only relax if we have bonds stretched more than 1.5x target
    // This avoids relaxing systems that are already reasonably placed
    if (maxStretch < 1.5) {
      continue;
    }

    // Find atoms directly attached to the core (substituents)
    const attachedAtoms = new Map<number, number>(); // attached atom -> core atom it's bonded to
    for (const bond of molecule.bonds) {
      if (coreSet.has(bond.atom1) && !coreSet.has(bond.atom2)) {
        attachedAtoms.set(bond.atom2, bond.atom1);
      } else if (coreSet.has(bond.atom2) && !coreSet.has(bond.atom1)) {
        attachedAtoms.set(bond.atom1, bond.atom2);
      }
    }

    // Store relative positions of attached atoms before relaxation
    const attachedRelativePos = new Map<number, { dx: number; dy: number }>();
    for (const [attachedId, coreId] of attachedAtoms) {
      const attachedPos = coords.get(attachedId);
      const corePos = coords.get(coreId);
      if (attachedPos && corePos) {
        attachedRelativePos.set(attachedId, {
          dx: attachedPos.x - corePos.x,
          dy: attachedPos.y - corePos.y,
        });
      }
    }

    // Apply force-directed relaxation to the core system
    relaxBridgedUnit(coreAtomIds, coreBonds, coords, bondLength);

    // Reposition attached atoms to maintain their relative position
    for (const [attachedId, coreId] of attachedAtoms) {
      const relPos = attachedRelativePos.get(attachedId);
      const corePos = coords.get(coreId);
      if (relPos && corePos) {
        coords.set(attachedId, {
          x: corePos.x + relPos.dx,
          y: corePos.y + relPos.dy,
        });
      }
    }
  }
}

interface SimpleBond {
  atom1: number;
  atom2: number;
}

/**
 * Relax a single bridged unit using force-directed approach.
 */
function relaxBridgedUnit(
  atomIds: number[],
  bonds: SimpleBond[],
  coords: Map<number, Vec2>,
  bondLength: number,
  iterations = 150,
): void {
  // Build adjacency
  const adj = new Map<number, Set<number>>();
  for (const id of atomIds) {
    adj.set(id, new Set());
  }
  for (const bond of bonds) {
    adj.get(bond.atom1)?.add(bond.atom2);
    adj.get(bond.atom2)?.add(bond.atom1);
  }

  // Calculate center of mass (to keep system centered)
  const getCenter = (): Vec2 => {
    let cx = 0,
      cy = 0;
    for (const id of atomIds) {
      const p = coords.get(id)!;
      cx += p.x;
      cy += p.y;
    }
    return { x: cx / atomIds.length, y: cy / atomIds.length };
  };

  const initialCenter = getCenter();

  // Force-directed relaxation
  const k = bondLength; // Ideal spring length
  let temperature = bondLength * 0.3; // Initial displacement limit
  const cooling = 0.97;

  for (let iter = 0; iter < iterations; iter++) {
    // Calculate forces
    const forces = new Map<number, Vec2>();
    for (const id of atomIds) {
      forces.set(id, { x: 0, y: 0 });
    }

    // Spring forces (bonds want to be at target length)
    for (const bond of bonds) {
      const p1 = coords.get(bond.atom1)!;
      const p2 = coords.get(bond.atom2)!;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.001) {
        // Spring force: F = k * (dist - ideal)
        // Stronger force for longer bonds (to compress them)
        // Weaker force for shorter bonds (allow some compression)
        const stretch = (dist - k) / k;
        let force: number;
        if (stretch > 0) {
          // Bond is too long - strong compression force
          force = stretch * 0.15;
        } else {
          // Bond is too short - weaker extension force
          force = stretch * 0.05;
        }

        const fx = ((force * dx) / dist) * k;
        const fy = ((force * dy) / dist) * k;

        const f1 = forces.get(bond.atom1)!;
        const f2 = forces.get(bond.atom2)!;
        f1.x += fx;
        f1.y += fy;
        f2.x -= fx;
        f2.y -= fy;
      }
    }

    // Repulsion forces (non-bonded atoms shouldn't overlap)
    for (let i = 0; i < atomIds.length; i++) {
      for (let j = i + 1; j < atomIds.length; j++) {
        const a1 = atomIds[i]!;
        const a2 = atomIds[j]!;

        // Skip bonded atoms
        if (adj.get(a1)?.has(a2)) continue;

        const p1 = coords.get(a1)!;
        const p2 = coords.get(a2)!;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Minimum distance for non-bonded atoms
        const minDist = k * 0.8;
        if (dist < minDist && dist > 0.001) {
          const force = ((minDist - dist) / minDist) * 0.1;
          const fx = ((force * dx) / dist) * k;
          const fy = ((force * dy) / dist) * k;

          const f1 = forces.get(a1)!;
          const f2 = forces.get(a2)!;
          f1.x -= fx;
          f1.y -= fy;
          f2.x += fx;
          f2.y += fy;
        }
      }
    }

    // Apply forces with temperature-limited displacement
    for (const id of atomIds) {
      const pos = coords.get(id)!;
      const force = forces.get(id)!;

      // Limit displacement
      const forceMag = Math.sqrt(force.x * force.x + force.y * force.y);
      if (forceMag > temperature) {
        force.x = (force.x / forceMag) * temperature;
        force.y = (force.y / forceMag) * temperature;
      }

      pos.x += force.x;
      pos.y += force.y;
    }

    // Re-center to maintain original position
    const newCenter = getCenter();
    const shiftX = initialCenter.x - newCenter.x;
    const shiftY = initialCenter.y - newCenter.y;
    for (const id of atomIds) {
      const pos = coords.get(id)!;
      pos.x += shiftX;
      pos.y += shiftY;
    }

    // Cool down
    temperature *= cooling;
  }
}
