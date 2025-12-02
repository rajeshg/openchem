/**
 * Rigid Unit Detection for 2D Coordinate Generation
 *
 * Identifies rigid molecular fragments that should be treated as units:
 * - Ring systems (fused, spiro, bridged)
 * - Chains connecting ring systems
 *
 * This follows the CoordGen/RDKit approach where molecules are split into
 * rigid fragments with parent-child relationships, then assembled.
 *
 * Key insight: Force-field optimization should operate on rigid units as
 * bodies (translate + rotate), not on individual atoms within rings.
 */

import type { Molecule } from "types";
import type { Ring, RingSystem, Vec2 } from "./types";

/**
 * Rigid unit types:
 * - ring-system: One or more fused/spiro/bridged rings
 * - chain: Linear or branched chain connecting ring systems
 * - single-atom: Isolated atom (rare, usually terminal)
 */
export type RigidUnitType = "ring-system" | "chain" | "single-atom";

/**
 * Degree of freedom for a rigid unit.
 * These are the only ways a rigid unit can move during optimization.
 */
export interface RigidUnitDOF {
  type: "rotate" | "flip" | "translate" | "scale";
  /** Pivot point for rotation/flip (usually bond to parent) */
  pivot?: Vec2;
  /** Axis for flip operation */
  flipAxis?: { p1: Vec2; p2: Vec2 };
  /** Current state (for discrete DOFs like flip) */
  state: number;
  /** Number of possible states */
  numStates: number;
}

/**
 * A rigid unit is a fragment of the molecule that moves as a single body.
 * Internal coordinates are fixed; only the unit's position/orientation can change.
 */
export interface RigidUnit {
  id: number;
  type: RigidUnitType;
  /** All atom IDs in this unit */
  atomIds: Set<number>;
  /** Rings in this unit (if ring-system) */
  rings: Ring[];
  /** Ring system classification (if ring-system) */
  ringSystemType?: "isolated" | "fused" | "spiro" | "bridged";
  /** Parent unit (null for root) */
  parent: RigidUnit | null;
  /** Child units */
  children: RigidUnit[];
  /** Bond connecting this unit to parent: [parentAtom, thisAtom] */
  bondToParent: { parentAtom: number; childAtom: number } | null;
  /** Degrees of freedom for this unit */
  dofs: RigidUnitDOF[];
  /** Priority for placement (higher = place first) */
  priority: number;
  /** Whether this unit contains aromatic rings */
  hasAromatic: boolean;
  /** Largest ring size in this unit */
  maxRingSize: number;
}

/**
 * Result of rigid unit detection
 */
export interface RigidUnitGraph {
  /** All rigid units */
  units: RigidUnit[];
  /** Root unit (main fragment, placed first) */
  root: RigidUnit;
  /** Map from atom ID to its rigid unit */
  atomToUnit: Map<number, RigidUnit>;
  /** Bonds between rigid units: [unit1, unit2, atom1, atom2] */
  interUnitBonds: Array<{
    unit1: RigidUnit;
    unit2: RigidUnit;
    atom1: number;
    atom2: number;
  }>;
}

/**
 * Detect all rigid units in a molecule and build the unit graph.
 *
 * Algorithm:
 * 1. Identify all ring systems (using existing detection)
 * 2. Identify chain fragments connecting ring systems
 * 3. Build parent-child relationships (tree structure)
 * 4. Assign priorities for placement order
 * 5. Create degrees of freedom for each unit
 */
export function detectRigidUnits(molecule: Molecule, ringSystems: RingSystem[]): RigidUnitGraph {
  const units: RigidUnit[] = [];
  const atomToUnit = new Map<number, RigidUnit>();
  let nextId = 0;

  // Step 1: Create rigid units from ring systems
  for (const system of ringSystems) {
    const unit: RigidUnit = {
      id: nextId++,
      type: "ring-system",
      atomIds: new Set(system.atomIds),
      rings: system.rings,
      ringSystemType: system.type,
      parent: null,
      children: [],
      bondToParent: null,
      dofs: [],
      priority: computeRingSystemPriority(system, molecule),
      hasAromatic: system.rings.some((r) => r.aromatic),
      maxRingSize: Math.max(...system.rings.map((r) => r.size)),
    };
    units.push(unit);

    for (const atomId of system.atomIds) {
      atomToUnit.set(atomId, unit);
    }
  }

  // Step 2: Find atoms not in any ring system (chain/substituent atoms)
  const nonRingAtoms = new Set<number>();
  for (const atom of molecule.atoms) {
    if (!atomToUnit.has(atom.id)) {
      nonRingAtoms.add(atom.id);
    }
  }

  // Step 3: Group non-ring atoms into chain fragments
  // A chain fragment is a connected component of non-ring atoms
  const chainFragments = findChainFragments(molecule, nonRingAtoms, atomToUnit);

  for (const fragment of chainFragments) {
    const unit: RigidUnit = {
      id: nextId++,
      type: fragment.size === 1 ? "single-atom" : "chain",
      atomIds: fragment,
      rings: [],
      parent: null,
      children: [],
      bondToParent: null,
      dofs: [],
      priority: 0, // Chains have lowest priority
      hasAromatic: false,
      maxRingSize: 0,
    };
    units.push(unit);

    for (const atomId of fragment) {
      atomToUnit.set(atomId, unit);
    }
  }

  // Step 4: Find inter-unit bonds
  const interUnitBonds: RigidUnitGraph["interUnitBonds"] = [];
  for (const bond of molecule.bonds) {
    const unit1 = atomToUnit.get(bond.atom1);
    const unit2 = atomToUnit.get(bond.atom2);
    if (unit1 && unit2 && unit1 !== unit2) {
      // Check if this bond is already recorded
      const exists = interUnitBonds.some(
        (b) => (b.unit1 === unit1 && b.unit2 === unit2) || (b.unit1 === unit2 && b.unit2 === unit1),
      );
      if (!exists) {
        interUnitBonds.push({
          unit1,
          unit2,
          atom1: bond.atom1,
          atom2: bond.atom2,
        });
      }
    }
  }

  // Step 5: Build parent-child tree using BFS from highest priority unit
  const root = findRootUnit(units);
  buildUnitTree(root, units, interUnitBonds, molecule);

  // Step 6: Create degrees of freedom for each unit
  for (const unit of units) {
    unit.dofs = createDegreesOfFreedom(unit, molecule);
  }

  return {
    units,
    root,
    atomToUnit,
    interUnitBonds,
  };
}

/**
 * Compute priority for a ring system.
 * Higher priority = placed first.
 *
 * Priority factors (in order):
 * 1. Contains aromatic rings
 * 2. Number of rings
 * 3. Largest ring size
 * 4. Total atom count
 */
function computeRingSystemPriority(system: RingSystem, molecule: Molecule): number {
  let priority = 0;

  // Aromatic rings get highest priority
  const hasAromatic = system.rings.some((r) => r.aromatic);
  if (hasAromatic) priority += 10000;

  // More rings = higher priority
  priority += system.rings.length * 100;

  // Larger rings = higher priority
  const maxSize = Math.max(...system.rings.map((r) => r.size));
  priority += maxSize * 10;

  // More atoms = higher priority
  priority += system.atomIds.size;

  // Benzene-like rings (6-membered all carbon) get bonus
  for (const ring of system.rings) {
    if (ring.size === 6) {
      const allCarbon = ring.atomIds.every((id) => molecule.atoms[id]?.symbol === "C");
      if (allCarbon) priority += 50;
    }
  }

  return priority;
}

/**
 * Find connected components of non-ring atoms (chains).
 */
function findChainFragments(
  molecule: Molecule,
  nonRingAtoms: Set<number>,
  _atomToUnit: Map<number, RigidUnit>,
): Set<number>[] {
  const fragments: Set<number>[] = [];
  const visited = new Set<number>();

  // Build adjacency list for non-ring atoms
  const adj = new Map<number, number[]>();
  for (const atomId of nonRingAtoms) {
    adj.set(atomId, []);
  }
  for (const bond of molecule.bonds) {
    if (nonRingAtoms.has(bond.atom1) && nonRingAtoms.has(bond.atom2)) {
      adj.get(bond.atom1)?.push(bond.atom2);
      adj.get(bond.atom2)?.push(bond.atom1);
    }
  }

  // BFS to find connected components
  for (const startAtom of nonRingAtoms) {
    if (visited.has(startAtom)) continue;

    const fragment = new Set<number>();
    const queue = [startAtom];
    visited.add(startAtom);

    while (queue.length > 0) {
      const current = queue.shift()!;
      fragment.add(current);

      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    fragments.push(fragment);
  }

  return fragments;
}

/**
 * Find the root unit (highest priority, typically main aromatic system).
 */
function findRootUnit(units: RigidUnit[]): RigidUnit {
  if (units.length === 0) {
    throw new Error("No rigid units found");
  }

  let best = units[0]!;
  for (const unit of units) {
    if (unit.priority > best.priority) {
      best = unit;
    }
  }
  return best;
}

/**
 * Build parent-child tree structure via BFS from root.
 */
function buildUnitTree(
  root: RigidUnit,
  units: RigidUnit[],
  interUnitBonds: RigidUnitGraph["interUnitBonds"],
  _molecule: Molecule,
): void {
  const visited = new Set<RigidUnit>([root]);
  const queue: RigidUnit[] = [root];

  // Build adjacency map for units
  const unitAdj = new Map<
    RigidUnit,
    Array<{ unit: RigidUnit; bond: (typeof interUnitBonds)[0] }>
  >();
  for (const unit of units) {
    unitAdj.set(unit, []);
  }
  for (const bond of interUnitBonds) {
    unitAdj.get(bond.unit1)?.push({ unit: bond.unit2, bond });
    unitAdj.get(bond.unit2)?.push({ unit: bond.unit1, bond });
  }

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const { unit: neighbor, bond } of unitAdj.get(current) || []) {
      if (visited.has(neighbor)) continue;

      visited.add(neighbor);
      neighbor.parent = current;
      current.children.push(neighbor);

      // Determine which atom is parent's and which is child's
      const atom1InCurrent = current.atomIds.has(bond.atom1);
      neighbor.bondToParent = {
        parentAtom: atom1InCurrent ? bond.atom1 : bond.atom2,
        childAtom: atom1InCurrent ? bond.atom2 : bond.atom1,
      };

      queue.push(neighbor);
    }
  }

  // Handle disconnected units (shouldn't happen in valid molecules)
  for (const unit of units) {
    if (!visited.has(unit)) {
      // Orphan unit - attach to root
      unit.parent = root;
      root.children.push(unit);
      visited.add(unit);
    }
  }
}

/**
 * Create degrees of freedom for a rigid unit.
 */
function createDegreesOfFreedom(unit: RigidUnit, _molecule: Molecule): RigidUnitDOF[] {
  const dofs: RigidUnitDOF[] = [];

  // Root unit has no DOFs (it's the reference frame)
  if (!unit.parent) {
    return dofs;
  }

  // All non-root units can rotate around bond to parent
  dofs.push({
    type: "rotate",
    state: 0,
    numStates: 12, // 30-degree increments
  });

  // All non-root units can flip across the bond axis
  dofs.push({
    type: "flip",
    state: 0,
    numStates: 2, // flip or no flip
  });

  // Ring systems with bridged rings may need additional DOFs
  if (unit.type === "ring-system" && unit.ringSystemType === "bridged") {
    // Bridged systems might need scaling DOF for distorted rings
    dofs.push({
      type: "scale",
      state: 0,
      numStates: 3, // 0.9x, 1.0x, 1.1x
    });
  }

  return dofs;
}

/**
 * Get units in placement order (BFS from root, respecting priorities).
 */
export function getPlacementOrder(graph: RigidUnitGraph): RigidUnit[] {
  const order: RigidUnit[] = [];
  const queue: RigidUnit[] = [graph.root];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    // Sort children by priority (highest first)
    const sortedChildren = [...current.children].sort((a, b) => b.priority - a.priority);
    queue.push(...sortedChildren);
  }

  return order;
}

/**
 * Check if two units are connected.
 */
export function areUnitsConnected(
  unit1: RigidUnit,
  unit2: RigidUnit,
  graph: RigidUnitGraph,
): boolean {
  return graph.interUnitBonds.some(
    (b) => (b.unit1 === unit1 && b.unit2 === unit2) || (b.unit1 === unit2 && b.unit2 === unit1),
  );
}

/**
 * Get the bond connecting two units (if any).
 */
export function getConnectingBond(
  unit1: RigidUnit,
  unit2: RigidUnit,
  graph: RigidUnitGraph,
): { atom1: number; atom2: number } | null {
  const bond = graph.interUnitBonds.find(
    (b) => (b.unit1 === unit1 && b.unit2 === unit2) || (b.unit1 === unit2 && b.unit2 === unit1),
  );
  if (!bond) return null;

  // Return atoms in order: unit1's atom first
  if (bond.unit1 === unit1) {
    return { atom1: bond.atom1, atom2: bond.atom2 };
  } else {
    return { atom1: bond.atom2, atom2: bond.atom1 };
  }
}

/**
 * Debug: Print rigid unit graph structure.
 */
export function debugPrintUnitGraph(graph: RigidUnitGraph): void {
  console.log("\n=== Rigid Unit Graph ===");
  console.log(`Total units: ${graph.units.length}`);
  console.log(`Root: Unit ${graph.root.id} (${graph.root.type})`);
  console.log(`Inter-unit bonds: ${graph.interUnitBonds.length}`);

  for (const unit of graph.units) {
    const parentInfo = unit.parent ? `parent=${unit.parent.id}` : "ROOT";
    const childInfo =
      unit.children.length > 0
        ? `children=[${unit.children.map((c) => c.id).join(",")}]`
        : "no children";
    console.log(
      `  Unit ${unit.id}: ${unit.type} (${unit.atomIds.size} atoms) ` +
        `priority=${unit.priority} ${parentInfo} ${childInfo}`,
    );
    if (unit.bondToParent) {
      console.log(
        `    Bond to parent: ${unit.bondToParent.parentAtom} -> ${unit.bondToParent.childAtom}`,
      );
    }
  }
}
