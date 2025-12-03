/**
 * Rigid Unit Placer
 *
 * Places rigid units (ring systems, chains) as perfect geometric shapes.
 * Each unit is placed relative to its parent in the unit tree, with
 * perfect internal geometry that is never distorted.
 *
 * Key principles:
 * 1. Ring systems are placed as perfect regular polygons
 * 2. Fused rings share edges exactly
 * 3. Chains are placed with ideal 120° angles
 * 4. Units are connected via single bonds at ideal angles
 *
 * This is step 2 in the rigid unit architecture:
 * 1. Detection (rigid-unit-detector.ts) - identify rigid units
 * 2. Placement (this file) - place units as perfect shapes
 * 3. Minimization (rigid-body-minimizer.ts) - optimize DOFs only
 */

import type { Molecule } from "types";
import type { Vec2, Ring, Transform } from "./types";
import type { RigidUnit, RigidUnitGraph } from "./rigid-unit-detector";
import { getPlacementOrder } from "./rigid-unit-detector";
import { regularPolygon, radiusForEdgeLength, computeAlignmentTransform } from "./geometry-utils";
import { findSharedAtoms, findBondedPair } from "./ring-system-detector";
import { placeMacrocycle, isMacrocycle } from "./macrocycle-placer";
import { findBridgedTemplate, applyBridgedTemplate } from "./bridged-templates";

/** Options for rigid unit placement */
export interface RigidUnitPlacementOptions {
  bondLength: number;
}

/** Result of placing all rigid units */
export interface PlacementResult {
  coords: Map<number, Vec2>;
  unitCoords: Map<number, Map<number, Vec2>>; // unit id -> atom coords within unit
}

/**
 * Place all rigid units in the molecule.
 * Units are placed in tree order (root first, then children).
 * Each unit is placed as a perfect geometric shape.
 */
export function placeRigidUnits(
  graph: RigidUnitGraph,
  molecule: Molecule,
  options: RigidUnitPlacementOptions,
): PlacementResult {
  const { bondLength } = options;
  const coords = new Map<number, Vec2>();
  const unitCoords = new Map<number, Map<number, Vec2>>();

  // Get placement order (BFS from root)
  const order = getPlacementOrder(graph);

  for (const unit of order) {
    const localCoords = new Map<number, Vec2>();

    if (unit.type === "ring-system") {
      // Place ring system with perfect geometry
      placeRingSystemUnit(unit, molecule, bondLength, coords, localCoords);
    } else if (unit.type === "chain") {
      // Place chain with ideal angles
      placeChainUnit(unit, molecule, bondLength, coords, localCoords);
    } else {
      // Single atom - position relative to parent
      placeSingleAtomUnit(unit, molecule, bondLength, coords, localCoords);
    }

    // Store local coordinates for this unit
    unitCoords.set(unit.id, localCoords);

    // Merge into global coords
    for (const [atomId, coord] of localCoords) {
      coords.set(atomId, coord);
    }
  }

  return { coords, unitCoords };
}

/**
 * Place a ring system unit as perfect polygons.
 * Uses BFS to place rings, aligning fused rings via shared edges.
 */
function placeRingSystemUnit(
  unit: RigidUnit,
  molecule: Molecule,
  bondLength: number,
  globalCoords: Map<number, Vec2>,
  localCoords: Map<number, Vec2>,
): void {
  if (unit.rings.length === 0) return;

  // Try to match a bridged template (adamantane, cubane, norbornane, etc.)
  // Only use templates for standalone bridged systems (no parent connection)
  // This ensures templates work well for molecules like adamantane but don't interfere
  // with complex molecules where the bridged system is part of a larger structure
  if (unit.ringSystemType === "bridged" && !unit.bondToParent) {
    const atomIds = [...unit.atomIds];
    const bonds = molecule.bonds.map((b) => ({ atom1: b.atom1, atom2: b.atom2 }));
    const templateMatch = findBridgedTemplate(atomIds, bonds);
    
    if (templateMatch) {
      // Apply the template coordinates
      const templateCoords = applyBridgedTemplate(
        templateMatch.template,
        templateMatch.atomMapping,
        bondLength,
      );
      
      // No parent connection, use template as-is (centered at origin)
      for (const [atomId, coord] of templateCoords) {
        localCoords.set(atomId, coord);
      }
      
      // Successfully placed using template - done!
      return;
    }
  }

  // If this unit has a parent, we need to position it relative to the parent
  const hasParentConnection = unit.bondToParent !== null;
  let anchorAtomId: number | null = null;
  let anchorPosition: Vec2 | null = null;

  if (hasParentConnection && unit.bondToParent) {
    anchorAtomId = unit.bondToParent.childAtom;
    const parentAtomId = unit.bondToParent.parentAtom;
    const parentPos = globalCoords.get(parentAtomId);
    if (parentPos) {
      // Calculate center of parent system (all already-placed atoms)
      let parentCenterX = 0;
      let parentCenterY = 0;
      let parentCount = 0;
      for (const coord of globalCoords.values()) {
        parentCenterX += coord.x;
        parentCenterY += coord.y;
        parentCount++;
      }
      if (parentCount > 0) {
        parentCenterX /= parentCount;
        parentCenterY /= parentCount;
      }

      // Direction from parent center through the connecting atom (outward direction)
      const outwardAngle = Math.atan2(parentPos.y - parentCenterY, parentPos.x - parentCenterX);

      // Position anchor at bond length from parent in the outward direction
      anchorPosition = {
        x: parentPos.x + bondLength * Math.cos(outwardAngle),
        y: parentPos.y + bondLength * Math.sin(outwardAngle),
      };
    }
  }

  // Select seed ring (largest aromatic ring, or largest ring)
  const seedRing = selectBestSeedRing(unit.rings);

  // Generate perfect template for seed ring (centered at origin)
  const seedTemplate = generatePerfectRingTemplate(seedRing.size, bondLength);

  // Calculate rotation and center for placing the ring
  let templateRotation = 0;
  let center: Vec2 = { x: 0, y: 0 };

  if (anchorAtomId !== null && anchorPosition !== null && unit.bondToParent) {
    const anchorIdx = seedRing.atomIds.indexOf(anchorAtomId);
    if (anchorIdx !== -1) {
      // Get the parent atom position to know the bond direction
      const parentAtomId = unit.bondToParent.parentAtom;
      const parentPos = globalCoords.get(parentAtomId);

      if (parentPos) {
        // Direction from parent to anchor (the bond direction)
        const bondAngle = Math.atan2(
          anchorPosition.y - parentPos.y,
          anchorPosition.x - parentPos.x,
        );

        // In the template, the anchor atom is at some position relative to center (origin)
        const templateAnchor = seedTemplate[anchorIdx]!;
        // Angle from center to anchor in template
        const templateAnchorAngle = Math.atan2(templateAnchor.y, templateAnchor.x);

        // We want the anchor to be on the side facing the parent
        // So the angle from center to anchor should be opposite to the bond direction
        // bondAngle points from parent to anchor
        // We want templateAnchorAngle (after rotation) to point from center toward parent
        // That means: rotatedAnchorAngle = bondAngle + PI (pointing back toward parent)
        // So: templateAnchorAngle + rotation = bondAngle + PI
        // rotation = bondAngle + PI - templateAnchorAngle
        templateRotation = bondAngle + Math.PI - templateAnchorAngle;

        // Now calculate where the center should be
        // After rotation, the anchor atom will be at:
        const rotatedAnchor = rotatePoint(templateAnchor, templateRotation);
        // Center = anchorPosition - rotatedAnchor
        center = {
          x: anchorPosition.x - rotatedAnchor.x,
          y: anchorPosition.y - rotatedAnchor.y,
        };
      }
    }
  }

  // Apply rotation and place seed ring
  for (let i = 0; i < seedRing.atomIds.length; i++) {
    const atomId = seedRing.atomIds[i]!;
    const templatePos = seedTemplate[i]!;
    const rotated = rotatePoint(templatePos, templateRotation);
    const final: Vec2 = {
      x: rotated.x + center.x,
      y: rotated.y + center.y,
    };
    localCoords.set(atomId, final);
  }

  // BFS to place adjacent rings
  const placedRings = new Set<number>([seedRing.id]);
  const queue: Ring[] = [seedRing];

  while (queue.length > 0) {
    const currentRing = queue.shift()!;

    for (const neighborRing of unit.rings) {
      if (placedRings.has(neighborRing.id)) continue;
      if (neighborRing.id === currentRing.id) continue;

      // Find shared atoms
      const sharedAtoms = findSharedAtoms(currentRing, neighborRing);
      if (sharedAtoms.length < 2) {
        // Spiro connection
        if (sharedAtoms.length === 1) {
          placeSpiroRing(neighborRing, localCoords, sharedAtoms[0]!, bondLength);
          placedRings.add(neighborRing.id);
          queue.push(neighborRing);
        }
        continue;
      }

      // Find the shared edge (bonded pair)
      const sharedEdge = findBondedPair(
        sharedAtoms,
        molecule.bonds as unknown as { atom1: number; atom2: number }[],
      );

      if (!sharedEdge) {
        // Fallback: use first two shared atoms
        placeAdjacentRing(
          neighborRing,
          [sharedAtoms[0]!, sharedAtoms[1]!],
          localCoords,
          bondLength,
          molecule,
        );
      } else {
        placeAdjacentRing(neighborRing, sharedEdge, localCoords, bondLength, molecule);
      }

      placedRings.add(neighborRing.id);
      queue.push(neighborRing);
    }
  }
}

/**
 * Place a ring adjacent to already-placed atoms via shared edge.
 */
function placeAdjacentRing(
  ring: Ring,
  sharedEdge: [number, number],
  coords: Map<number, Vec2>,
  bondLength: number,
  molecule: Molecule,
): void {
  const [atom1, atom2] = sharedEdge;
  const p1 = coords.get(atom1)!;
  const p2 = coords.get(atom2)!;

  // Generate perfect template
  const template = generatePerfectRingTemplate(ring.size, bondLength);

  // Find positions of shared atoms in template
  const idx1 = ring.atomIds.indexOf(atom1);
  const idx2 = ring.atomIds.indexOf(atom2);

  if (idx1 === -1 || idx2 === -1) return;

  const t1 = template[idx1]!;
  const t2 = template[idx2]!;

  // Compute alignment transform
  const transform = computeAlignmentTransform(t1, t2, p1, p2);

  // Apply transform to get candidate positions
  const candidates = new Map<number, Vec2>();
  for (let i = 0; i < ring.atomIds.length; i++) {
    const atomId = ring.atomIds[i]!;
    if (!coords.has(atomId)) {
      const tPos = template[i]!;
      candidates.set(atomId, applyTransform(tPos, transform));
    }
  }

  // Check for overlaps
  const minDist = bondLength * 0.6;
  let hasOverlap = false;

  for (const [newId, newPos] of candidates) {
    for (const [existId, existPos] of coords) {
      // Skip bonded atoms
      const bonded = molecule.bonds.some(
        (b) =>
          (b.atom1 === newId && b.atom2 === existId) || (b.atom1 === existId && b.atom2 === newId),
      );
      if (bonded) continue;

      const dx = newPos.x - existPos.x;
      const dy = newPos.y - existPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        hasOverlap = true;
        break;
      }
    }
    if (hasOverlap) break;
  }

  // If overlap, flip across shared edge
  if (hasOverlap) {
    flipAcrossEdge(candidates, p1, p2);
  }

  // Apply final positions
  for (const [atomId, pos] of candidates) {
    coords.set(atomId, pos);
  }
}

/**
 * Flip atoms across an edge (reflection).
 */
function flipAcrossEdge(coords: Map<number, Vec2>, edgeP1: Vec2, edgeP2: Vec2): void {
  const edgeVec = {
    x: edgeP2.x - edgeP1.x,
    y: edgeP2.y - edgeP1.y,
  };
  const edgeLen = Math.sqrt(edgeVec.x * edgeVec.x + edgeVec.y * edgeVec.y);
  const normal = {
    x: -edgeVec.y / edgeLen,
    y: edgeVec.x / edgeLen,
  };

  const mid = {
    x: (edgeP1.x + edgeP2.x) / 2,
    y: (edgeP1.y + edgeP2.y) / 2,
  };

  for (const [atomId, pos] of coords) {
    const toAtom = { x: pos.x - mid.x, y: pos.y - mid.y };
    const dist = toAtom.x * normal.x + toAtom.y * normal.y;
    coords.set(atomId, {
      x: pos.x - 2 * dist * normal.x,
      y: pos.y - 2 * dist * normal.y,
    });
  }
}

/**
 * Place a spiro ring (shares single atom).
 * The new ring is rotated to minimize overlap with existing atoms.
 */
function placeSpiroRing(
  ring: Ring,
  coords: Map<number, Vec2>,
  spiroAtomId: number,
  bondLength: number,
): void {
  const template = generatePerfectRingTemplate(ring.size, bondLength);
  const spiroIdx = ring.atomIds.indexOf(spiroAtomId);
  if (spiroIdx === -1) return;

  const templateSpiro = template[spiroIdx]!;
  const placedSpiro = coords.get(spiroAtomId)!;

  // Find neighbors of spiro atom that are already placed (from existing ring)
  const placedNeighbors: Vec2[] = [];
  for (const [atomId, pos] of coords) {
    if (atomId === spiroAtomId) continue;
    // Check if this is adjacent to spiro in the coordinate layout
    const dx = pos.x - placedSpiro.x;
    const dy = pos.y - placedSpiro.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bondLength * 1.5) {
      placedNeighbors.push(pos);
    }
  }

  // Calculate angle bisector of existing neighbors (to avoid)
  let avoidAngle = 0;
  if (placedNeighbors.length >= 2) {
    const angles = placedNeighbors.map((n) => Math.atan2(n.y - placedSpiro.y, n.x - placedSpiro.x));
    avoidAngle = (angles[0]! + angles[1]!) / 2;
  } else if (placedNeighbors.length === 1) {
    avoidAngle = Math.atan2(
      placedNeighbors[0]!.y - placedSpiro.y,
      placedNeighbors[0]!.x - placedSpiro.x,
    );
  }

  // Get neighbors of spiro atom in the new ring template
  const n = ring.size;
  const prev = (spiroIdx - 1 + n) % n;
  const next = (spiroIdx + 1) % n;
  const templatePrev = template[prev]!;
  const templateNext = template[next]!;

  // Calculate angle bisector of template neighbors relative to spiro center
  const templatePrevAngle = Math.atan2(
    templatePrev.y - templateSpiro.y,
    templatePrev.x - templateSpiro.x,
  );
  const templateNextAngle = Math.atan2(
    templateNext.y - templateSpiro.y,
    templateNext.x - templateSpiro.x,
  );
  const templateBisector = (templatePrevAngle + templateNextAngle) / 2;

  // Rotate so template bisector is perpendicular to avoid angle
  // (place new ring perpendicular to existing ring)
  const targetAngle = avoidAngle + Math.PI / 2;
  const rotation = targetAngle - templateBisector;

  // Apply rotation and translation
  for (let i = 0; i < ring.atomIds.length; i++) {
    const atomId = ring.atomIds[i]!;
    if (!coords.has(atomId)) {
      const p = template[i]!;
      // Rotate around template spiro position
      const rx = p.x - templateSpiro.x;
      const ry = p.y - templateSpiro.y;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const rotatedX = rx * cos - ry * sin;
      const rotatedY = rx * sin + ry * cos;
      coords.set(atomId, {
        x: placedSpiro.x + rotatedX,
        y: placedSpiro.y + rotatedY,
      });
    }
  }
}

/**
 * Place a chain unit with ideal 120° angles.
 *
 * Key geometry: For sp2 centers (like carboxylic acid carbon), all three
 * neighbors should be at 120° intervals. When a chain connects to a parent,
 * the parent bond is one of the three directions, so remaining neighbors
 * go at ±120° from the parent direction.
 */
function placeChainUnit(
  unit: RigidUnit,
  molecule: Molecule,
  bondLength: number,
  globalCoords: Map<number, Vec2>,
  localCoords: Map<number, Vec2>,
): void {
  if (unit.atomIds.size === 0) return;

  // Find the attachment point to parent
  let startAtomId: number | null = null;
  let startPosition: Vec2 | null = null;
  let parentAtomId: number | null = null;

  if (unit.bondToParent) {
    startAtomId = unit.bondToParent.childAtom;
    parentAtomId = unit.bondToParent.parentAtom;
    const parentPos = globalCoords.get(parentAtomId);
    if (parentPos) {
      // Position start atom at bond length from parent
      // Calculate angle from parent's neighbors
      const parentNeighbors = getNeighborAtoms(parentAtomId, molecule);
      const outgoingAngle = calculateOutgoingAngle(parentAtomId, parentNeighbors, globalCoords);

      startPosition = {
        x: parentPos.x + bondLength * Math.cos(outgoingAngle),
        y: parentPos.y + bondLength * Math.sin(outgoingAngle),
      };
      localCoords.set(startAtomId, startPosition);
    }
  }

  // If no parent connection, start at origin
  if (startAtomId === null) {
    startAtomId = [...unit.atomIds][0]!;
    startPosition = { x: 0, y: 0 };
    localCoords.set(startAtomId, startPosition);
  }

  // BFS to place remaining chain atoms
  // Track where each atom was reached from, to compute incoming angle
  const cameFrom = new Map<number, number>();
  const queue: number[] = [startAtomId];
  const visited = new Set<number>([startAtomId]);

  // If we have a parent, the start atom "came from" the parent
  if (parentAtomId !== null) {
    cameFrom.set(startAtomId, parentAtomId);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentPos = localCoords.get(currentId)!;

    // Get neighbors in this chain unit that haven't been placed yet
    const neighbors = getNeighborAtoms(currentId, molecule).filter(
      (nId) => unit.atomIds.has(nId) && !visited.has(nId),
    );

    if (neighbors.length === 0) continue;

    // Calculate angle FROM current atom BACK TO where it came from
    let backAngle: number;
    const prevId = cameFrom.get(currentId);
    if (prevId !== undefined) {
      // We have a predecessor - compute angle to it
      const prevPos = globalCoords.get(prevId) ?? localCoords.get(prevId);
      if (prevPos) {
        backAngle = Math.atan2(prevPos.y - currentPos.y, prevPos.x - currentPos.x);
      } else {
        backAngle = Math.PI; // Default: came from the left
      }
    } else {
      // No predecessor - default direction
      backAngle = Math.PI;
    }

    // Place neighbors based on coordination number:
    // - 1 neighbor: place opposite (180°)
    // - 2 neighbors: place at ±120° (sp2 trigonal planar)
    // - 3 neighbors: place at -90°, +90°, 180° (sp3 tetrahedral projection, one bond to back)
    // - 4 neighbors: place at 0°, 90°, 180°, 270° (sp3, no predecessor)
    for (let i = 0; i < neighbors.length; i++) {
      const neighborId = neighbors[i]!;
      let angle: number;

      if (neighbors.length === 1) {
        // Single neighbor goes opposite to where we came from
        angle = backAngle + Math.PI;
      } else if (neighbors.length === 2) {
        // sp2 geometry: place at ±120° from back
        const angleStep = (2 * Math.PI) / 3; // 120°
        angle = backAngle + (i === 0 ? angleStep : -angleStep);
      } else if (neighbors.length === 3) {
        // sp3 tetrahedral: one bond already to back, place remaining at ±90° and opposite
        // This gives a cross/plus pattern in 2D
        const offsets = [-Math.PI / 2, Math.PI / 2, Math.PI]; // -90°, +90°, 180°
        angle = backAngle + offsets[i]!;
      } else {
        // 4+ neighbors (no predecessor): distribute evenly
        // For sp3 centers at chain start, use 90° intervals
        const angleStep = (2 * Math.PI) / neighbors.length;
        angle = i * angleStep;
      }

      const neighborPos: Vec2 = {
        x: currentPos.x + bondLength * Math.cos(angle),
        y: currentPos.y + bondLength * Math.sin(angle),
      };

      localCoords.set(neighborId, neighborPos);
      visited.add(neighborId);
      cameFrom.set(neighborId, currentId);
      queue.push(neighborId);
    }
  }
}

/**
 * Place a single atom unit.
 */
function placeSingleAtomUnit(
  unit: RigidUnit,
  molecule: Molecule,
  bondLength: number,
  globalCoords: Map<number, Vec2>,
  localCoords: Map<number, Vec2>,
): void {
  if (unit.atomIds.size === 0) return;

  const atomId = [...unit.atomIds][0]!;

  if (unit.bondToParent) {
    const parentAtomId = unit.bondToParent.parentAtom;
    const parentPos = globalCoords.get(parentAtomId);
    if (parentPos) {
      // Calculate outgoing angle from parent
      const parentNeighbors = getNeighborAtoms(parentAtomId, molecule);
      const angle = calculateOutgoingAngle(parentAtomId, parentNeighbors, globalCoords);

      localCoords.set(atomId, {
        x: parentPos.x + bondLength * Math.cos(angle),
        y: parentPos.y + bondLength * Math.sin(angle),
      });
      return;
    }
  }

  // Fallback: place at origin
  localCoords.set(atomId, { x: 0, y: 0 });
}

/**
 * Generate perfect ring template (regular polygon or relaxed macrocycle).
 */
function generatePerfectRingTemplate(ringSize: number, bondLength: number): Vec2[] {
  if (isMacrocycle(ringSize)) {
    return placeMacrocycle(ringSize, { bondLength });
  }
  const radius = radiusForEdgeLength(ringSize, bondLength);
  return regularPolygon(ringSize, radius);
}

/**
 * Select best seed ring for placement.
 * Prioritizes: aromatic > larger > first
 */
function selectBestSeedRing(rings: Ring[]): Ring {
  if (rings.length === 0) {
    throw new Error("No rings to select from");
  }

  // First, try to find an aromatic 6-membered ring (benzene)
  const aromaticSix = rings.find((r) => r.aromatic && r.size === 6);
  if (aromaticSix) return aromaticSix;

  // Then, any aromatic ring
  const aromatic = rings.find((r) => r.aromatic);
  if (aromatic) return aromatic;

  // Then, largest ring
  return rings.reduce((best, r) => (r.size > best.size ? r : best), rings[0]!);
}

/**
 * Rotate a point around origin.
 */
function rotatePoint(point: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

/**
 * Apply transform to a point.
 */
function applyTransform(point: Vec2, transform: Transform): Vec2 {
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  const rotated = {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
  return {
    x: rotated.x + transform.translation.x,
    y: rotated.y + transform.translation.y,
  };
}

/**
 * Get neighbor atom IDs for an atom.
 */
function getNeighborAtoms(atomId: number, molecule: Molecule): number[] {
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

/**
 * Calculate optimal outgoing angle for a new bond.
 * Tries to space bonds evenly around the atom.
 */
function calculateOutgoingAngle(
  atomId: number,
  neighbors: number[],
  coords: Map<number, Vec2>,
): number {
  const pos = coords.get(atomId);
  if (!pos) return 0;

  // Get angles to existing neighbors
  const angles: number[] = [];
  for (const nId of neighbors) {
    const nPos = coords.get(nId);
    if (nPos) {
      angles.push(Math.atan2(nPos.y - pos.y, nPos.x - pos.x));
    }
  }

  if (angles.length === 0) {
    return 0; // Default: extend to the right
  }

  if (angles.length === 1) {
    // Single neighbor: extend opposite direction
    return angles[0]! + Math.PI;
  }

  // Multiple neighbors: find largest gap
  angles.sort((a, b) => a - b);
  let maxGap = 0;
  let maxGapMid = 0;

  for (let i = 0; i < angles.length; i++) {
    const a1 = angles[i]!;
    const a2 = angles[(i + 1) % angles.length]!;
    let gap = a2 - a1;
    if (gap < 0) gap += 2 * Math.PI;

    if (gap > maxGap) {
      maxGap = gap;
      maxGapMid = a1 + gap / 2;
    }
  }

  return maxGapMid;
}

/**
 * Debug: print placement result.
 */
export function debugPrintPlacement(result: PlacementResult): void {
  console.log("\n=== Rigid Unit Placement ===");
  console.log(`Total atoms placed: ${result.coords.size}`);

  for (const [unitId, unitCoords] of result.unitCoords) {
    console.log(`Unit ${unitId}: ${unitCoords.size} atoms`);
    for (const [atomId, coord] of unitCoords) {
      console.log(`  Atom ${atomId}: (${coord.x.toFixed(2)}, ${coord.y.toFixed(2)})`);
    }
  }
}
