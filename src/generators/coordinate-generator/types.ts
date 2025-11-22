/**
 * Core data structures for 2D coordinate generation.
 * Supports template-based ring placement with canonicalization independence.
 */

/** 2D vector/point */
export interface Vec2 {
  x: number;
  y: number;
}

/** Geometric transformation (rotation + translation) */
export interface Transform {
  rotation: number; // in radians
  translation: Vec2;
  scale: number; // usually 1.0
}

/** Group of atoms that move together as a rigid body */
export interface RigidGroup {
  id: number;
  atomIds: number[];
  type: "ring" | "fused-system" | "bridge";
}

/** Ring within a molecule */
export interface Ring {
  id: number;
  atomIds: number[]; // cycle ordering
  size: number;
  aromatic: boolean;
  rigidGroupId?: number; // which rigid group it belongs to
}

/** Fused ring system (one or more connected rings) */
export interface RingSystem {
  id: number;
  rings: Ring[];
  atomIds: Set<number>; // all atoms in all rings
  bondIds: Set<string>; // bond IDs connecting rings
  type: "isolated" | "fused" | "spiro" | "bridged";
}

/** Options for coordinate generation algorithm */
export interface CoordinateOptions {
  /** Target bond length in Ångströms (default: 35 for SVG) */
  bondLength: number;

  /** Number of relaxation iterations (default: 200) */
  iterations: number;

  /** Spring constant for bond stretching (default: 0.2) */
  springConstant: number;

  /** Magnitude of repulsion forces (default: 0.6) */
  repulsionMagnitude: number;

  /** Weight for angle constraint forces (default: 0.15) */
  angleWeight: number;

  /** Tolerance for rigid group rotation (degrees, default: 10) */
  rigidGroupRotationTolerance: number;
}

/** Placement context for ring positioning */
export interface PlacementContext {
  molecule: unknown; // Reference to Molecule type
  bondLength: number;
  placedAtoms: Set<number>;
  coords: Map<number, Vec2>;
  rigidGroups: RigidGroup[];
}

/** Collision detected between two atoms */
export interface Collision {
  atom1: number;
  atom2: number;
  distance: number;
  minDistance: number;
  overlap: number;
}

/** Force vector for atom during relaxation */
export interface ForceVector {
  spring: Vec2; // from bond length constraints
  angle: Vec2; // from angle constraints
  repulsion: Vec2; // from atom-atom repulsion
  total: Vec2; // sum of all forces
}

/** Default options for coordinate generation */
export const DEFAULT_COORDINATE_OPTIONS: CoordinateOptions = {
  bondLength: 35,
  iterations: 200,
  springConstant: 0.2,
  repulsionMagnitude: 0.6,
  angleWeight: 0.15,
  rigidGroupRotationTolerance: 10,
};

/** Helper to create Vec2 */
export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

/** Helper to create Transform */
export function createTransform(
  rotation: number = 0,
  translation: Vec2 = { x: 0, y: 0 },
  scale: number = 1.0,
): Transform {
  return { rotation, translation, scale };
}
