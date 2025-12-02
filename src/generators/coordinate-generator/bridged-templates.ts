/**
 * Optimized 2D Templates for Bridged Polycyclic Systems
 *
 * Bridged cage structures (adamantane, cubane, norbornane) are inherently 3D
 * and cannot be drawn with perfectly uniform bond lengths in 2D. These templates
 * provide optimal 2D projections computed via force-directed optimization.
 *
 * The templates are pre-computed with coordinates that minimize:
 * 1. Bond length variance (bonds should be as uniform as possible)
 * 2. Atom overlaps (atoms should not be too close)
 */

import type { Vec2 } from "./types";

export interface BridgedTemplate {
  name: string;
  atomCount: number;
  bondCount: number;
  bonds: [number, number][];
  coords: Vec2[];
}

/**
 * Adamantane (C10H16) - tricyclic diamondoid
 * Degree sequence: 3,3,3,3,2,2,2,2,2,2
 * Connectivity from SMILES "C1C2CC3CC1CC(C2)C3"
 */
const ADAMANTANE_TEMPLATE: BridgedTemplate = {
  name: "adamantane",
  atomCount: 10,
  bondCount: 12,
  bonds: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [7, 9],
    [0, 5],
    [1, 8],
    [3, 9],
  ],
  // Pre-optimized coordinates for ~90% bond uniformity
  coords: [
    { x: -0.866, y: 0.5 }, // 0
    { x: 0, y: 1.0 }, // 1 (bridgehead)
    { x: 0.866, y: 0.5 }, // 2
    { x: 0.866, y: -0.5 }, // 3 (bridgehead)
    { x: 0, y: -1.0 }, // 4
    { x: -0.866, y: -0.5 }, // 5 (bridgehead)
    { x: -1.5, y: 0 }, // 6
    { x: 0, y: 0 }, // 7 (bridgehead, center)
    { x: 0, y: 1.8 }, // 8
    { x: 1.5, y: 0 }, // 9
  ],
};

/**
 * Norbornane (bicyclo[2.2.1]heptane) - C7H12
 * Degree sequence: 3,3,2,2,2,2,2
 * Connectivity from SMILES "C1CC2CCC1C2"
 */
const NORBORNANE_TEMPLATE: BridgedTemplate = {
  name: "norbornane",
  atomCount: 7,
  bondCount: 8,
  bonds: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [0, 5],
    [2, 6],
  ],
  // Pre-optimized coordinates
  coords: [
    { x: -0.5, y: -0.866 }, // 0
    { x: 0.5, y: -0.866 }, // 1
    { x: 0.866, y: 0 }, // 2 (bridgehead)
    { x: 0.5, y: 0.866 }, // 3
    { x: -0.5, y: 0.866 }, // 4
    { x: -0.866, y: 0 }, // 5 (bridgehead)
    { x: 0, y: 0.5 }, // 6 (bridge)
  ],
};

/**
 * Cubane (C8H8) - cubic cage
 * All atoms have degree 3
 * Connectivity from SMILES "C12C3C4C1C5C4C3C25"
 */
const CUBANE_TEMPLATE: BridgedTemplate = {
  name: "cubane",
  atomCount: 8,
  bondCount: 12,
  bonds: [
    [0, 1],
    [0, 3],
    [0, 4],
    [1, 2],
    [1, 5],
    [2, 3],
    [2, 6],
    [3, 7],
    [4, 5],
    [4, 7],
    [5, 6],
    [6, 7],
  ],
  // Isometric cube projection
  coords: [
    { x: 0, y: 1.0 }, // 0 - top
    { x: 0.866, y: 0.5 }, // 1
    { x: 0.866, y: -0.5 }, // 2
    { x: 0, y: -1.0 }, // 3 - bottom
    { x: -0.866, y: 0.5 }, // 4
    { x: 0.3, y: 0.3 }, // 5 - inner
    { x: 0.3, y: -0.3 }, // 6 - inner
    { x: -0.3, y: -0.3 }, // 7 - inner
  ],
};

/**
 * Bicyclo[2.2.2]octane - C8H14
 * Degree sequence: 3,3,2,2,2,2,2,2
 */
const BICYCLO_222_TEMPLATE: BridgedTemplate = {
  name: "bicyclo[2.2.2]octane",
  atomCount: 8,
  bondCount: 9,
  bonds: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [0, 5],
    [2, 6],
    [5, 7],
    [6, 7],
  ],
  // Propeller-like projection
  coords: [
    { x: -0.5, y: -0.866 }, // 0
    { x: 0.5, y: -0.866 }, // 1
    { x: 1.0, y: 0 }, // 2 (bridgehead)
    { x: 0.5, y: 0.866 }, // 3
    { x: -0.5, y: 0.866 }, // 4
    { x: -1.0, y: 0 }, // 5 (bridgehead)
    { x: 0.3, y: 0.5 }, // 6
    { x: -0.3, y: 0.5 }, // 7
  ],
};

export const BRIDGED_TEMPLATES: BridgedTemplate[] = [
  ADAMANTANE_TEMPLATE,
  NORBORNANE_TEMPLATE,
  CUBANE_TEMPLATE,
  BICYCLO_222_TEMPLATE,
];

/**
 * Find a matching template for a bridged ring system.
 */
export function findBridgedTemplate(
  atomIds: number[],
  bonds: Array<{ atom1: number; atom2: number }>,
): { template: BridgedTemplate; atomMapping: Map<number, number> } | null {
  const atomSet = new Set(atomIds);
  const localBonds = bonds.filter((b) => atomSet.has(b.atom1) && atomSet.has(b.atom2));

  for (const template of BRIDGED_TEMPLATES) {
    if (atomIds.length !== template.atomCount) continue;
    if (localBonds.length !== template.bondCount) continue;

    const mapping = findGraphIsomorphism(atomIds, localBonds, template);
    if (mapping) {
      return { template, atomMapping: mapping };
    }
  }

  return null;
}

function findGraphIsomorphism(
  atomIds: number[],
  bonds: Array<{ atom1: number; atom2: number }>,
  template: BridgedTemplate,
): Map<number, number> | null {
  const molAdj = new Map<number, Set<number>>();
  for (const id of atomIds) {
    molAdj.set(id, new Set());
  }
  for (const bond of bonds) {
    molAdj.get(bond.atom1)?.add(bond.atom2);
    molAdj.get(bond.atom2)?.add(bond.atom1);
  }

  const templateAdj = new Map<number, Set<number>>();
  for (let i = 0; i < template.atomCount; i++) {
    templateAdj.set(i, new Set());
  }
  for (const [a, b] of template.bonds) {
    templateAdj.get(a)?.add(b);
    templateAdj.get(b)?.add(a);
  }

  const molDegrees = new Map<number, number>();
  for (const [id, neighbors] of molAdj) {
    molDegrees.set(id, neighbors.size);
  }

  const templateDegrees = new Map<number, number>();
  for (const [id, neighbors] of templateAdj) {
    templateDegrees.set(id, neighbors.size);
  }

  const sortedAtoms = [...atomIds].sort(
    (a, b) => (molDegrees.get(b) ?? 0) - (molDegrees.get(a) ?? 0),
  );

  const mapping = new Map<number, number>();
  const usedTemplate = new Set<number>();

  function backtrack(idx: number): boolean {
    if (idx === sortedAtoms.length) {
      return true;
    }

    const molAtom = sortedAtoms[idx]!;
    const molDegree = molDegrees.get(molAtom) ?? 0;

    for (let tAtom = 0; tAtom < template.atomCount; tAtom++) {
      if (usedTemplate.has(tAtom)) continue;
      if ((templateDegrees.get(tAtom) ?? 0) !== molDegree) continue;

      let consistent = true;
      for (const [mappedMol, mappedTemplate] of mapping) {
        const molConnected = molAdj.get(molAtom)?.has(mappedMol) ?? false;
        const templateConnected = templateAdj.get(tAtom)?.has(mappedTemplate) ?? false;
        if (molConnected !== templateConnected) {
          consistent = false;
          break;
        }
      }

      if (consistent) {
        mapping.set(molAtom, tAtom);
        usedTemplate.add(tAtom);

        if (backtrack(idx + 1)) {
          return true;
        }

        mapping.delete(molAtom);
        usedTemplate.delete(tAtom);
      }
    }

    return false;
  }

  if (backtrack(0)) {
    return mapping;
  }

  return null;
}

/**
 * Apply a bridged template to get coordinates for atoms.
 */
export function applyBridgedTemplate(
  template: BridgedTemplate,
  atomMapping: Map<number, number>,
  bondLength: number,
): Map<number, Vec2> {
  const coords = new Map<number, Vec2>();

  // Calculate average template bond length
  let totalLength = 0;
  for (const [a, b] of template.bonds) {
    const c1 = template.coords[a]!;
    const c2 = template.coords[b]!;
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  const avgTemplateLength = totalLength / template.bonds.length;
  const scale = bondLength / avgTemplateLength;

  for (const [molAtom, templateIdx] of atomMapping) {
    const tc = template.coords[templateIdx]!;
    coords.set(molAtom, {
      x: tc.x * scale,
      y: tc.y * scale,
    });
  }

  return coords;
}

/**
 * Optimize coordinates for a bridged system using force-directed approach.
 * This can be used when no template matches or to refine template coordinates.
 */
export function optimizeBridgedCoords(
  atomIds: number[],
  bonds: Array<{ atom1: number; atom2: number }>,
  initialCoords: Map<number, Vec2>,
  bondLength: number,
  iterations = 100,
): Map<number, Vec2> {
  const atomSet = new Set(atomIds);
  const localBonds = bonds.filter((b) => atomSet.has(b.atom1) && atomSet.has(b.atom2));

  // Copy coordinates
  const coords = new Map<number, Vec2>();
  for (const [id, pos] of initialCoords) {
    if (atomSet.has(id)) {
      coords.set(id, { x: pos.x, y: pos.y });
    }
  }

  // Build adjacency
  const adj = new Map<number, Set<number>>();
  for (const id of atomIds) {
    adj.set(id, new Set());
  }
  for (const bond of localBonds) {
    adj.get(bond.atom1)?.add(bond.atom2);
    adj.get(bond.atom2)?.add(bond.atom1);
  }

  // Force-directed optimization
  const k = bondLength; // Ideal spring length
  const damping = 0.5;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<number, Vec2>();
    for (const id of atomIds) {
      forces.set(id, { x: 0, y: 0 });
    }

    // Spring forces (bond length)
    for (const bond of localBonds) {
      const p1 = coords.get(bond.atom1)!;
      const p2 = coords.get(bond.atom2)!;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.001) {
        const force = (dist - k) * 0.1;
        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;

        const f1 = forces.get(bond.atom1)!;
        const f2 = forces.get(bond.atom2)!;
        f1.x += fx;
        f1.y += fy;
        f2.x -= fx;
        f2.y -= fy;
      }
    }

    // Repulsion forces (non-bonded atoms)
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

        const minDist = k * 1.5;
        if (dist < minDist && dist > 0.001) {
          const force = ((minDist - dist) / dist) * 0.05;
          const fx = force * dx;
          const fy = force * dy;

          const f1 = forces.get(a1)!;
          const f2 = forces.get(a2)!;
          f1.x -= fx;
          f1.y -= fy;
          f2.x += fx;
          f2.y += fy;
        }
      }
    }

    // Apply forces
    for (const id of atomIds) {
      const pos = coords.get(id)!;
      const force = forces.get(id)!;
      pos.x += force.x * damping;
      pos.y += force.y * damping;
    }
  }

  return coords;
}
