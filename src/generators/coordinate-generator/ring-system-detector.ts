/**
 * Detect and group rings into fused ring systems.
 * Canonicalization-independent: works via set operations and bond topology.
 */

import type { Ring, RingSystem } from "./types";
import type { Molecule } from "types";

/**
 * Find all shared atoms between two rings (set intersection).
 * Canonicalization-independent: order doesn't matter.
 */
export function findSharedAtoms(ring1: Ring, ring2: Ring): number[] {
  const set1 = new Set(ring1.atomIds);
  const set2 = new Set(ring2.atomIds);
  return Array.from(set1).filter((id) => set2.has(id));
}

/**
 * Find bonded pair among a set of atoms.
 * Returns edge if two atoms are bonded, null otherwise.
 */
export function findBondedPair(
  atomIds: number[],
  bonds: { atom1: number; atom2: number }[],
): [number, number] | null {
  for (let i = 0; i < atomIds.length; i++) {
    for (let j = i + 1; j < atomIds.length; j++) {
      const a1 = atomIds[i]!;
      const a2 = atomIds[j]!;
      const isBonded = bonds.some(
        (b) => (b.atom1 === a1 && b.atom2 === a2) || (b.atom1 === a2 && b.atom2 === a1),
      );
      if (isBonded) {
        return [a1, a2];
      }
    }
  }
  return null;
}

/**
 * Check if two rings share an edge (≥2 bonded atoms).
 * Canonicalization-independent.
 */
export function areRingsFused(
  ring1: Ring,
  ring2: Ring,
  bonds: Array<{ atom1: number; atom2: number }>,
): boolean {
  const shared = findSharedAtoms(ring1, ring2);

  // Fused: 2+ shared atoms
  if (shared.length >= 2) {
    // Check if at least one pair is bonded (they should all be bonded)
    const pair = findBondedPair(shared, bonds);
    return pair !== null;
  }

  return false;
}

/**
 * Check if two rings share a single atom (spiro center).
 */
export function areRingsSpiro(ring1: Ring, ring2: Ring): boolean {
  const shared = findSharedAtoms(ring1, ring2);
  return shared.length === 1;
}

/**
 * Classify ring system type based on fusion pattern.
 *
 * Types:
 * - isolated: single ring
 * - fused: rings share exactly 2 atoms (edge fusion)
 * - spiro: rings share exactly 1 atom
 * - bridged: TRUE cages like adamantane, cubane (high bridgehead density)
 *
 * Note: For "bridged fused" systems like morphine (mostly fused with some
 * bridgehead atoms), we return "fused" because the fused placer handles
 * these better than the force-field bridged placer.
 */
export type SystemType = "isolated" | "fused" | "spiro" | "bridged";

export function classifyRingSystemType(
  rings: Ring[],
  bonds: { atom1: number; atom2: number }[],
): SystemType {
  if (rings.length === 1) return "isolated";

  let hasFused = false;
  let hasSpiro = false;
  let hasOversharing = false; // rings sharing >2 atoms

  // Count atoms that are in multiple rings
  const atomRingCount = new Map<number, number>();
  for (const ring of rings) {
    for (const atomId of ring.atomIds) {
      atomRingCount.set(atomId, (atomRingCount.get(atomId) ?? 0) + 1);
    }
  }

  // Count bridgehead atoms (in 3+ rings)
  let bridgeheadCount = 0;
  for (const count of atomRingCount.values()) {
    if (count >= 3) bridgeheadCount++;
  }

  for (let i = 0; i < rings.length; i++) {
    for (let j = i + 1; j < rings.length; j++) {
      const shared = findSharedAtoms(rings[i]!, rings[j]!);

      // If rings share more than 2 atoms, it's an oversharing (bridge-like)
      if (shared.length > 2) {
        hasOversharing = true;
      }

      if (areRingsFused(rings[i]!, rings[j]!, bonds)) {
        hasFused = true;
      }
      if (areRingsSpiro(rings[i]!, rings[j]!)) {
        hasSpiro = true;
      }
    }
  }

  // Only classify as "bridged" if it's a complex polycyclic structure:
  // - TRUE cage structures (small + high bridgehead density)
  // - OR complex polycyclics with multiple bridgeheads (morphine-like)
  // - Larger flat fused systems (anthracene, phenanthrene, coronene) use fused placer
  const totalAtoms = atomRingCount.size;
  const bridgeheadDensity = bridgeheadCount / totalAtoms;

  // Check if all rings are aromatic (flat polycyclic aromatic like coronene)
  const allRingsAromatic = rings.every((r) => r.aromatic);

  // TRUE cage structures:
  // - Small molecules (<12 atoms) with ring oversharing (shared atoms > 2)
  // - OR very high bridgehead density (>0.3) indicating a cage
  // - OR complex polycyclics with 3+ bridgeheads (morphine, strychnine)
  // BUT NOT fully aromatic systems (coronene, pyrene) which are flat
  const isTrueCage =
    !allRingsAromatic && // Exclude flat polycyclic aromatics
    ((totalAtoms <= 12 && hasOversharing) || // Bicyclic bridged (norbornane, camphor)
      bridgeheadDensity >= 0.3 ||
      bridgeheadCount >= 3); // Complex polycyclics with many bridgeheads

  if (isTrueCage) return "bridged";
  // Fused takes precedence over spiro (many systems have both)
  if (hasFused) return "fused";
  if (hasSpiro) return "spiro";
  return "isolated";
}

/**
 * Group rings into connected fused systems using Union-Find.
 * Two rings are in the same system if they share atoms or connect transitively.
 */
export function detectFusedRingSystems(rings: Ring[], molecule: Molecule): RingSystem[] {
  if (rings.length === 0) return [];
  if (rings.length === 1) {
    return [
      {
        id: 0,
        rings,
        atomIds: new Set(rings[0]!.atomIds),
        bondIds: new Set(),
        type: "isolated",
      },
    ];
  }

  // Union-Find to group connected rings
  const parent = new Map<number, number>();
  rings.forEach((ring) => {
    parent.set(ring.id, ring.id);
  });

  function find(id: number): number {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  }

  function union(id1: number, id2: number): void {
    const p1 = find(id1);
    const p2 = find(id2);
    if (p1 !== p2) {
      parent.set(p2, p1);
    }
  }

  // Union rings that share atoms
  for (let i = 0; i < rings.length; i++) {
    for (let j = i + 1; j < rings.length; j++) {
      const shared = findSharedAtoms(rings[i]!, rings[j]!);
      if (shared.length > 0) {
        union(rings[i]!.id, rings[j]!.id);
      }
    }
  }

  // Group rings by their root
  const groups = new Map<number, Ring[]>();
  for (const ring of rings) {
    const root = find(ring.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(ring);
  }

  // Convert groups to RingSystem objects
  const systems: RingSystem[] = [];
  let systemId = 0;

  for (const groupRings of groups.values()) {
    const atomIds = new Set<number>();
    const bondIds = new Set<string>();

    for (const ring of groupRings) {
      for (const atomId of ring.atomIds) {
        atomIds.add(atomId);
      }
    }

    // Find bonds that connect atoms in this system
    for (const bond of molecule.bonds) {
      if (atomIds.has(bond.atom1) && atomIds.has(bond.atom2)) {
        const key = `${Math.min(bond.atom1, bond.atom2)}-${Math.max(bond.atom1, bond.atom2)}`;
        bondIds.add(key);
      }
    }

    const systemType = classifyRingSystemType(
      groupRings,
      molecule.bonds as unknown as { atom1: number; atom2: number }[],
    );

    systems.push({
      id: systemId++,
      rings: groupRings,
      atomIds,
      bondIds,
      type: systemType,
    });
  }

  return systems;
}

/**
 * Build adjacency graph of rings within a system.
 * Returns map of ring ID -> connected ring IDs.
 */
export function buildRingAdjacency(system: RingSystem): Map<number, number[]> {
  const adj = new Map<number, number[]>();

  for (const ring of system.rings) {
    adj.set(ring.id, []);
  }

  for (let i = 0; i < system.rings.length; i++) {
    for (let j = i + 1; j < system.rings.length; j++) {
      const ring1 = system.rings[i]!;
      const ring2 = system.rings[j]!;
      const shared = findSharedAtoms(ring1, ring2);

      if (shared.length > 0) {
        adj.get(ring1.id)!.push(ring2.id);
        adj.get(ring2.id)!.push(ring1.id);
      }
    }
  }

  return adj;
}

/**
 * Select seed ring for placement (largest or most connected).
 */
export function selectSeedRing(system: RingSystem): Ring {
  if (system.rings.length === 0) {
    throw new Error("Cannot select seed from empty system");
  }

  if (system.rings.length === 1) {
    return system.rings[0]!;
  }

  // Build adjacency for this system
  const adj = buildRingAdjacency(system);

  // Pick ring with most connections (most central)
  let seedRing = system.rings[0]!;
  let maxConnections = adj.get(seedRing.id)!.length;

  for (const ring of system.rings) {
    const connections = adj.get(ring.id)!.length;
    if (connections > maxConnections) {
      maxConnections = connections;
      seedRing = ring;
    }
  }

  // Tiebreak: pick largest ring
  if (maxConnections === adj.get(seedRing.id)!.length) {
    seedRing = system.rings.reduce((a, b) => (a.size > b.size ? a : b));
  }

  return seedRing;
}

/**
 * Get rings adjacent to a given ring in a system.
 */
export function getAdjacentRings(ring: Ring, system: RingSystem): Ring[] {
  const shared = new Set<number>();

  for (const other of system.rings) {
    if (other.id === ring.id) continue;
    const sharedAtoms = findSharedAtoms(ring, other);
    if (sharedAtoms.length > 0) {
      shared.add(other.id);
    }
  }

  return system.rings.filter((r) => shared.has(r.id));
}

/**
 * Order rings for placement (BFS from seed).
 */
export function orderRingsForPlacement(system: RingSystem): Ring[] {
  if (system.rings.length === 0) return [];
  if (system.rings.length === 1) return system.rings;

  const seed = selectSeedRing(system);
  const ordered: Ring[] = [seed];
  const visited = new Set<number>([seed.id]);
  const queue: Ring[] = [seed];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const adjacent = getAdjacentRings(current, system);

    for (const ring of adjacent) {
      if (!visited.has(ring.id)) {
        visited.add(ring.id);
        ordered.push(ring);
        queue.push(ring);
      }
    }
  }

  return ordered;
}
