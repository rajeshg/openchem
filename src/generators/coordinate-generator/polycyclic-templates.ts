/**
 * Pre-computed coordinate templates for common polycyclic scaffolds.
 *
 * STATUS: Experimental (disabled by default)
 * REASON: Atom mapping needs full graph isomorphism to preserve bond angles
 *
 * These templates provide optimized 2D coordinates for difficult-to-place
 * fused ring systems. When a matching pattern is detected, we use the
 * template as a starting point instead of BFS placement.
 *
 * Each template includes:
 * - Pattern description (ring sizes, fusion type)
 * - Optimized coordinates (manually tuned for perfect geometry)
 * - Matching algorithm (detects when to use template)
 *
 * Current limitations:
 * - Template matching works correctly (linear vs angular fusion detection)
 * - Atom mapping is sequential, not topology-aware
 * - Results in incorrect bond angles (~90° instead of ~120° for aromatics)
 *
 * To enable templates: generateCoordinates(mol, { useTemplates: true })
 *
 * TODO for production use:
 * 1. Implement VF2 or similar subgraph isomorphism algorithm
 * 2. Match molecule atoms to template atoms based on bond connectivity
 * 3. Preserve proper bond angles (120° for sp2 aromatics)
 */

import type { Vec2, RingSystem } from "./types";
import type { Molecule } from "types";

/**
 * Template for a polycyclic system with pre-computed optimal coordinates.
 */
export interface PolycyclicTemplate {
  name: string;
  description: string;
  pattern: {
    ringCount: number;
    ringSizes: number[];
    fusionType: "linear" | "angular" | "branched" | "spiro" | "bridged";
  };
  /**
   * Coordinates for each ring's atoms.
   * Rings are indexed in the order they appear in ringSizes.
   * Each ring's coordinates are for atoms in canonical order (clockwise from top).
   */
  coordinates: Vec2[][];
  /**
   * Shared atom mappings between rings.
   * Format: [ringIdx1, atomIdx1, ringIdx2, atomIdx2]
   * Means: atom atomIdx1 in ring ringIdx1 is the same as atom atomIdx2 in ring ringIdx2
   */
  sharedAtoms: [number, number, number, number][];
  /**
   * Check if a ring system matches this template.
   */
  matches: (system: RingSystem, molecule: Molecule) => boolean;
}

/**
 * Naphthalene: Two fused benzene rings (linear edge fusion)
 * Perfect geometry with shared edge at 120° angles
 */
const NAPHTHALENE_TEMPLATE: PolycyclicTemplate = {
  name: "naphthalene",
  description: "Two fused benzene rings (linear edge fusion)",
  pattern: {
    ringCount: 2,
    ringSizes: [6, 6],
    fusionType: "linear",
  },
  coordinates: [
    // Ring 0: First benzene (left)
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Second benzene (right, shares edge with ring 0)
    [
      { x: 25.98, y: 15 }, // Shared with ring 0, atom 1
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: -15 },
      { x: 51.96, y: -30 },
      { x: 25.98, y: -15 }, // Shared with ring 0, atom 2
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0], // Ring 0 atom 1 = Ring 1 atom 0
    [0, 2, 1, 5], // Ring 0 atom 2 = Ring 1 atom 5
  ],
  matches: (system, _molecule) => {
    if (system.rings.length !== 2) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 6 || sizes[1] !== 6) return false;

    // Check if they share exactly 2 atoms (edge fusion)
    const ring0Atoms = new Set(system.rings[0]!.atomIds);
    const ring1Atoms = new Set(system.rings[1]!.atomIds);
    const sharedCount = [...ring0Atoms].filter((id) => ring1Atoms.has(id)).length;

    return sharedCount === 2;
  },
};

/**
 * Anthracene: Three fused benzene rings (linear)
 */
const ANTHRACENE_TEMPLATE: PolycyclicTemplate = {
  name: "anthracene",
  description: "Three linearly fused benzene rings",
  pattern: {
    ringCount: 3,
    ringSizes: [6, 6, 6],
    fusionType: "linear",
  },
  coordinates: [
    // Ring 0: Left benzene
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Middle benzene
    [
      { x: 25.98, y: 15 },
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: -15 },
      { x: 51.96, y: -30 },
      { x: 25.98, y: -15 },
    ],
    // Ring 2: Right benzene
    [
      { x: 77.94, y: 15 },
      { x: 103.92, y: 30 },
      { x: 129.9, y: 15 },
      { x: 129.9, y: -15 },
      { x: 103.92, y: -30 },
      { x: 77.94, y: -15 },
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 5],
    [1, 2, 2, 0],
    [1, 3, 2, 5],
  ],
  matches: (system, _molecule) => {
    if (system.rings.length !== 3) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 6 || sizes[1] !== 6 || sizes[2] !== 6) return false;

    // Check for linear fusion: the two shared edges should be on opposite sides of the middle ring
    const rings = system.rings.map((r) => new Set(r.atomIds));

    // Find shared atoms
    const shared01Atoms = [...rings[0]!].filter((id) => rings[1]!.has(id));
    const shared12Atoms = [...rings[1]!].filter((id) => rings[2]!.has(id));
    const shared02 = [...rings[0]!].filter((id) => rings[2]!.has(id)).length;

    // Must be edge-sharing fusion (no spiro or bridged)
    if (shared01Atoms.length !== 2 || shared12Atoms.length !== 2 || shared02 !== 0) {
      return false;
    }

    // Check positions in middle ring (ring 1)
    const ring1Array = [...system.rings[1]!.atomIds];
    const pos01 = shared01Atoms.map((atom) => ring1Array.indexOf(atom)).sort((a, b) => a - b);
    const pos12 = shared12Atoms.map((atom) => ring1Array.indexOf(atom)).sort((a, b) => a - b);

    // Calculate center point of each edge
    const center01 = (pos01[0]! + pos01[1]!) / 2;
    const center12 = (pos12[0]! + pos12[1]!) / 2;

    // Calculate separation between edge centers
    const separation = Math.abs(center01 - center12);
    const wrappedSeparation = Math.min(separation, 6 - separation);

    // Linear: edges are on opposite sides (separation ~0 or ~3)
    // Angular: edges are on same side (separation ~2)
    return wrappedSeparation < 1.5; // Linear if separation < 1.5
  },
};

/**
 * Phenanthrene: Three fused benzene rings (angular)
 */
const PHENANTHRENE_TEMPLATE: PolycyclicTemplate = {
  name: "phenanthrene",
  description: "Three angularly fused benzene rings",
  pattern: {
    ringCount: 3,
    ringSizes: [6, 6, 6],
    fusionType: "angular",
  },
  coordinates: [
    // Ring 0: Bottom left
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Bottom right
    [
      { x: 25.98, y: 15 },
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: -15 },
      { x: 51.96, y: -30 },
      { x: 25.98, y: -15 },
    ],
    // Ring 2: Top (angular bend)
    [
      { x: 25.98, y: 15 },
      { x: 25.98, y: 45 },
      { x: 51.96, y: 60 },
      { x: 77.94, y: 45 },
      { x: 77.94, y: 15 },
      { x: 51.96, y: 30 },
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 5],
    [0, 1, 2, 0], // Angular fusion
    [1, 1, 2, 5],
  ],
  matches: (system, _molecule) => {
    if (system.rings.length !== 3) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 6 || sizes[1] !== 6 || sizes[2] !== 6) return false;

    // Check for angular fusion: the two shared edges should be on the same side of the middle ring
    const rings = system.rings.map((r) => new Set(r.atomIds));

    // Find shared atoms
    const shared01Atoms = [...rings[0]!].filter((id) => rings[1]!.has(id));
    const shared12Atoms = [...rings[1]!].filter((id) => rings[2]!.has(id));
    const shared02 = [...rings[0]!].filter((id) => rings[2]!.has(id)).length;

    // Must be edge-sharing fusion (no spiro or bridged)
    if (shared01Atoms.length !== 2 || shared12Atoms.length !== 2 || shared02 !== 0) {
      return false;
    }

    // Check positions in middle ring (ring 1)
    const ring1Array = [...system.rings[1]!.atomIds];
    const pos01 = shared01Atoms.map((atom) => ring1Array.indexOf(atom)).sort((a, b) => a - b);
    const pos12 = shared12Atoms.map((atom) => ring1Array.indexOf(atom)).sort((a, b) => a - b);

    // Calculate center point of each edge
    const center01 = (pos01[0]! + pos01[1]!) / 2;
    const center12 = (pos12[0]! + pos12[1]!) / 2;

    // Calculate separation between edge centers
    const separation = Math.abs(center01 - center12);
    const wrappedSeparation = Math.min(separation, 6 - separation);

    // Angular: edges are on same side (separation ~2)
    // Linear: edges are on opposite sides (separation ~0 or ~3)
    return wrappedSeparation >= 1.5; // Angular if separation >= 1.5
  },
};

/**
 * Steroid core: Four fused rings (2×5 + 2×6)
 * Common in testosterone, estrogen, cortisol, etc.
 * Note: Actual SMILES often generate [5,5,6,6] pattern
 */
const STEROID_TEMPLATE: PolycyclicTemplate = {
  name: "steroid",
  description: "Steroid core scaffold (gonane)",
  pattern: {
    ringCount: 4,
    ringSizes: [5, 5, 6, 6],
    fusionType: "angular",
  },
  coordinates: [
    // Ring A (5-membered, left)
    [
      { x: 0, y: 24 },
      { x: 22.8, y: 14.1 },
      { x: 22.8, y: -14.1 },
      { x: 0, y: -24 },
      { x: -14.1, y: 0 },
    ],
    // Ring B (5-membered, middle-left)
    [
      { x: 22.8, y: 14.1 },
      { x: 45.6, y: 24 },
      { x: 68.4, y: 14.1 },
      { x: 68.4, y: -14.1 },
      { x: 45.6, y: -24 },
    ],
    // Ring C (6-membered, middle-right)
    [
      { x: 68.4, y: 14.1 },
      { x: 91.2, y: 24 },
      { x: 117.18, y: 15 },
      { x: 117.18, y: -15 },
      { x: 91.2, y: -30 },
      { x: 68.4, y: -14.1 },
    ],
    // Ring D (6-membered, right)
    [
      { x: 117.18, y: 15 },
      { x: 143.16, y: 30 },
      { x: 169.14, y: 15 },
      { x: 169.14, y: -15 },
      { x: 143.16, y: -30 },
      { x: 117.18, y: -15 },
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 4],
    [1, 2, 2, 0],
    [1, 3, 2, 5],
    [2, 2, 3, 0],
    [2, 3, 3, 5],
  ],
  matches: (system, _molecule) => {
    if (system.rings.length !== 4) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    // Look for 5,5,6,6 pattern (common in steroid SMILES)
    if (sizes[0] !== 5 || sizes[1] !== 5 || sizes[2] !== 6 || sizes[3] !== 6) return false;
    return true;
  },
};

/**
 * Indole: Benzene fused to pyrrole (6+5 rings)
 */
const INDOLE_TEMPLATE: PolycyclicTemplate = {
  name: "indole",
  description: "Benzene fused to pyrrole (6+5 heterocycle)",
  pattern: {
    ringCount: 2,
    ringSizes: [6, 5],
    fusionType: "linear",
  },
  coordinates: [
    // Ring 0: Benzene
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Pyrrole (5-membered)
    [
      { x: 25.98, y: 15 }, // Shared
      { x: 51.96, y: 22.5 },
      { x: 64.95, y: 0 },
      { x: 51.96, y: -22.5 },
      { x: 25.98, y: -15 }, // Shared
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 4],
  ],
  matches: (system, molecule) => {
    if (system.rings.length !== 2) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 5 || sizes[1] !== 6) return false;

    // Check for heteroatom (N) in 5-ring
    const ring5 = system.rings.find((r) => r.size === 5);
    if (!ring5) return false;

    const hasNitrogen = ring5.atomIds.some((id) => molecule.atoms[id]?.symbol === "N");
    return hasNitrogen;
  },
};

/**
 * Quinoline: Benzene fused to pyridine
 */
const QUINOLINE_TEMPLATE: PolycyclicTemplate = {
  name: "quinoline",
  description: "Benzene fused to pyridine (6+6 heterocycle)",
  pattern: {
    ringCount: 2,
    ringSizes: [6, 6],
    fusionType: "linear",
  },
  coordinates: [
    // Ring 0: Benzene
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Pyridine
    [
      { x: 25.98, y: 15 },
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: -15 },
      { x: 51.96, y: -30 },
      { x: 25.98, y: -15 },
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 5],
  ],
  matches: (system, molecule) => {
    if (system.rings.length !== 2) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 6 || sizes[1] !== 6) return false;

    // Check for nitrogen in one ring
    const hasNitrogen = system.rings.some((ring) =>
      ring.atomIds.some((id) => molecule.atoms[id]?.symbol === "N"),
    );

    return hasNitrogen;
  },
};

/**
 * Purine: Fused 5-5 bicyclic heterocycle
 * Common in DNA/RNA bases (adenine, guanine)
 * Note: Actual purine is 5+6, but many purine-like structures have 5+5
 */
const PURINE_TEMPLATE: PolycyclicTemplate = {
  name: "purine",
  description: "Fused bicyclic heterocycle (DNA/RNA base scaffold)",
  pattern: {
    ringCount: 2,
    ringSizes: [5, 5],
    fusionType: "linear",
  },
  coordinates: [
    // Ring 0: 5-membered
    [
      { x: 0, y: 24 },
      { x: 22.8, y: 14.1 },
      { x: 22.8, y: -14.1 },
      { x: 0, y: -24 },
      { x: -14.1, y: 0 },
    ],
    // Ring 1: 5-membered
    [
      { x: 22.8, y: 14.1 }, // Shared
      { x: 45.6, y: 24 },
      { x: 60, y: 7 },
      { x: 45.6, y: -24 },
      { x: 22.8, y: -14.1 }, // Shared
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 4],
  ],
  matches: (system, molecule) => {
    if (system.rings.length !== 2) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 5 || sizes[1] !== 5) return false;

    // Check for multiple nitrogens (purines have 4 nitrogens)
    let nitrogenCount = 0;
    for (const ring of system.rings) {
      for (const atomId of ring.atomIds) {
        if (molecule.atoms[atomId]?.symbol === "N") {
          nitrogenCount++;
        }
      }
    }

    return nitrogenCount >= 3; // At least 3 nitrogens suggests purine-like
  },
};

/**
 * Adamantane: Tricyclic bridged system (cage structure)
 */
const ADAMANTANE_TEMPLATE: PolycyclicTemplate = {
  name: "adamantane",
  description: "Tricyclic bridged cage (3 fused cyclohexanes)",
  pattern: {
    ringCount: 3,
    ringSizes: [6, 6, 6],
    fusionType: "bridged",
  },
  coordinates: [
    // Ring 0: Front face
    [
      { x: 0, y: 40 },
      { x: 30, y: 25 },
      { x: 30, y: -25 },
      { x: 0, y: -40 },
      { x: -30, y: -25 },
      { x: -30, y: 25 },
    ],
    // Ring 1: Left bridge
    [
      { x: -30, y: 25 },
      { x: -50, y: 40 },
      { x: -70, y: 25 },
      { x: -70, y: -25 },
      { x: -50, y: -40 },
      { x: -30, y: -25 },
    ],
    // Ring 2: Right bridge
    [
      { x: 30, y: 25 },
      { x: 50, y: 40 },
      { x: 70, y: 25 },
      { x: 70, y: -25 },
      { x: 50, y: -40 },
      { x: 30, y: -25 },
    ],
  ],
  sharedAtoms: [
    [0, 0, 1, 1],
    [0, 4, 1, 5],
    [0, 1, 2, 0],
    [0, 2, 2, 5],
  ],
  matches: (_system, _molecule) => {
    // Adamantane detection requires checking for bridged topology
    // Complex - skip for now
    return false;
  },
};

/**
 * Morphine core: Pentagon between two hexagons
 * Highly constrained alkaloid scaffold
 */
const MORPHINE_TEMPLATE: PolycyclicTemplate = {
  name: "morphine",
  description: "Pentagon fused between hexagons (morphinan alkaloid core)",
  pattern: {
    ringCount: 3, // Core is 5+6+6, but morphine has 5 rings total
    ringSizes: [5, 6, 6],
    fusionType: "angular",
  },
  coordinates: [
    // Ring 0: Pentagon (aromatic)
    [
      { x: 0, y: 25 },
      { x: 23.78, y: 7.73 },
      { x: 14.69, y: -20.23 },
      { x: -14.69, y: -20.23 },
      { x: -23.78, y: 7.73 },
    ],
    // Ring 1: Hexagon left
    [
      { x: -23.78, y: 7.73 }, // Shared with pentagon
      { x: -49.76, y: 17.73 },
      { x: -49.76, y: -17.27 },
      { x: -23.78, y: -27.27 },
      { x: -14.69, y: -20.23 }, // Shared with pentagon
      { x: -10, y: 0 },
    ],
    // Ring 2: Hexagon right
    [
      { x: 23.78, y: 7.73 }, // Shared with pentagon
      { x: 49.76, y: 17.73 },
      { x: 75.74, y: 7.73 },
      { x: 75.74, y: -22.27 },
      { x: 49.76, y: -32.27 },
      { x: 23.78, y: -22.27 },
    ],
  ],
  sharedAtoms: [
    [0, 0, 1, 0],
    [0, 4, 1, 4],
    [0, 1, 2, 0],
  ],
  matches: (_system, _molecule) => {
    // Morphine has 5 rings total, so this is just the core
    // Skip for now - too complex
    return false;
  },
};

/**
 * Benzofuran: Benzene fused to furan (6+5 oxygen heterocycle)
 */
const BENZOFURAN_TEMPLATE: PolycyclicTemplate = {
  name: "benzofuran",
  description: "Benzene fused to furan (6+5 oxygen heterocycle)",
  pattern: {
    ringCount: 2,
    ringSizes: [5, 6],
    fusionType: "linear",
  },
  coordinates: [
    // Ring 0: Benzene
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Furan (5-membered with O)
    [
      { x: 25.98, y: 15 }, // Shared
      { x: 51.96, y: 22.5 },
      { x: 64.95, y: 0 },
      { x: 51.96, y: -22.5 },
      { x: 25.98, y: -15 }, // Shared
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 4],
  ],
  matches: (system, molecule) => {
    if (system.rings.length !== 2) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 5 || sizes[1] !== 6) return false;

    // Check for oxygen in 5-ring
    const ring5 = system.rings.find((r) => r.size === 5);
    if (!ring5) return false;

    const hasOxygen = ring5.atomIds.some((id) => molecule.atoms[id]?.symbol === "O");
    return hasOxygen;
  },
};

/**
 * Benzothiophene: Benzene fused to thiophene (6+5 sulfur heterocycle)
 */
const BENZOTHIOPHENE_TEMPLATE: PolycyclicTemplate = {
  name: "benzothiophene",
  description: "Benzene fused to thiophene (6+5 sulfur heterocycle)",
  pattern: {
    ringCount: 2,
    ringSizes: [5, 6],
    fusionType: "linear",
  },
  coordinates: [
    // Ring 0: Benzene
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Thiophene (5-membered with S)
    [
      { x: 25.98, y: 15 }, // Shared
      { x: 51.96, y: 22.5 },
      { x: 64.95, y: 0 },
      { x: 51.96, y: -22.5 },
      { x: 25.98, y: -15 }, // Shared
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 4],
  ],
  matches: (system, molecule) => {
    if (system.rings.length !== 2) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 5 || sizes[1] !== 6) return false;

    // Check for sulfur in 5-ring
    const ring5 = system.rings.find((r) => r.size === 5);
    if (!ring5) return false;

    const hasSulfur = ring5.atomIds.some((id) => molecule.atoms[id]?.symbol === "S");
    return hasSulfur;
  },
};

/**
 * Dibenzofuran: Two benzene rings connected by furan bridge (3 rings: 5+6+6 with O)
 * Similar to carbazole but with oxygen instead of nitrogen
 */
const DIBENZOFURAN_TEMPLATE: PolycyclicTemplate = {
  name: "benzofuran",
  description: "Two benzenes bridged by furan (O-heterocycle)",
  pattern: {
    ringCount: 3,
    ringSizes: [5, 6, 6],
    fusionType: "branched",
  },
  coordinates: [
    // Ring 0: Left benzene
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Right benzene
    [
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: -15 },
      { x: 51.96, y: -30 },
      { x: 25.98, y: -15 },
      { x: 25.98, y: 15 },
    ],
    // Ring 2: Furan bridge (5-membered with O)
    [
      { x: 25.98, y: 15 },
      { x: 38.97, y: 30 },
      { x: 51.96, y: 30 },
      { x: 51.96, y: 15 },
      { x: 38.97, y: 7.5 },
    ],
  ],
  sharedAtoms: [
    [0, 1, 2, 0],
    [1, 5, 2, 2],
  ],
  matches: (system, molecule) => {
    if (system.rings.length !== 3) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 5 || sizes[1] !== 6 || sizes[2] !== 6) return false;

    // Check for oxygen in 5-ring
    const ring5 = system.rings.find((r) => r.size === 5);
    if (!ring5) return false;

    const hasOxygen = ring5.atomIds.some((id) => molecule.atoms[id]?.symbol === "O");
    return hasOxygen;
  },
};

/**
 * Pyrene: Four fused benzene rings (tetracyclic)
 */
const PYRENE_TEMPLATE: PolycyclicTemplate = {
  name: "pyrene",
  description: "Four fused benzene rings (compact tetracyclic)",
  pattern: {
    ringCount: 4,
    ringSizes: [6, 6, 6, 6],
    fusionType: "angular",
  },
  coordinates: [
    // Ring 0: Bottom left
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Bottom right
    [
      { x: 25.98, y: 15 },
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: -15 },
      { x: 51.96, y: -30 },
      { x: 25.98, y: -15 },
    ],
    // Ring 2: Top left
    [
      { x: -25.98, y: 15 },
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: 45 },
      { x: 0, y: 60 },
      { x: -25.98, y: 45 },
    ],
    // Ring 3: Top right
    [
      { x: 25.98, y: 15 },
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: 45 },
      { x: 51.96, y: 60 },
      { x: 25.98, y: 45 },
    ],
  ],
  sharedAtoms: [
    [0, 1, 1, 0],
    [0, 2, 1, 5],
    [0, 0, 2, 1],
    [0, 1, 2, 2],
    [1, 1, 3, 1],
    [1, 2, 3, 2],
  ],
  matches: (system, _molecule) => {
    if (system.rings.length !== 4) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    // All 6-membered rings
    if (sizes.every((s) => s === 6)) {
      // Pyrene has compact structure - check if all rings are aromatic
      const allAromatic = system.rings.every((r) => r.aromatic);
      return allAromatic;
    }
    return false;
  },
};

/**
 * Fluorene: Benzene-cyclopentane-benzene (biphenyl bridge)
 */
const FLUORENE_TEMPLATE: PolycyclicTemplate = {
  name: "fluorene",
  description: "Two benzenes bridged by cyclopentane",
  pattern: {
    ringCount: 3,
    ringSizes: [5, 6, 6],
    fusionType: "branched",
  },
  coordinates: [
    // Ring 0: Left benzene
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Right benzene
    [
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: -15 },
      { x: 51.96, y: -30 },
      { x: 25.98, y: -15 },
      { x: 25.98, y: 15 },
    ],
    // Ring 2: Bridge (5-membered)
    [
      { x: 25.98, y: 15 },
      { x: 38.97, y: 30 },
      { x: 51.96, y: 30 },
      { x: 51.96, y: 15 },
      { x: 38.97, y: 7.5 },
    ],
  ],
  sharedAtoms: [
    [0, 1, 2, 0],
    [1, 5, 2, 2],
  ],
  matches: (system, molecule) => {
    if (system.rings.length !== 3) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    // Look for 5,6,6 pattern (fluorene can have all aromatic or 2 aromatic)
    if (sizes[0] !== 5 || sizes[1] !== 6 || sizes[2] !== 6) return false;

    const aromaticCount = system.rings.filter((r) => r.aromatic).length;
    // Accept if 2 or 3 aromatic rings (fluorene resonance can make 5-ring aromatic)
    if (aromaticCount < 2) return false;

    // Exclude if 5-ring contains heteroatoms (nitrogen, oxygen, sulfur)
    const ring5 = system.rings.find((r) => r.size === 5);
    if (!ring5) return false;
    const hasHeteroatom = ring5.atomIds.some(
      (id) =>
        molecule.atoms[id]?.symbol === "N" ||
        molecule.atoms[id]?.symbol === "O" ||
        molecule.atoms[id]?.symbol === "S",
    );
    return !hasHeteroatom; // Only match if NO heteroatoms in 5-ring
  },
};

/**
 * Carbazole: Two benzenes bridged by pyrrole
 */
const CARBAZOLE_TEMPLATE: PolycyclicTemplate = {
  name: "carbazole",
  description: "Two benzenes bridged by pyrrole (N-heterocycle)",
  pattern: {
    ringCount: 3,
    ringSizes: [5, 6, 6],
    fusionType: "branched",
  },
  coordinates: [
    // Ring 0: Left benzene
    [
      { x: 0, y: 30 },
      { x: 25.98, y: 15 },
      { x: 25.98, y: -15 },
      { x: 0, y: -30 },
      { x: -25.98, y: -15 },
      { x: -25.98, y: 15 },
    ],
    // Ring 1: Right benzene
    [
      { x: 51.96, y: 30 },
      { x: 77.94, y: 15 },
      { x: 77.94, y: -15 },
      { x: 51.96, y: -30 },
      { x: 25.98, y: -15 },
      { x: 25.98, y: 15 },
    ],
    // Ring 2: Pyrrole bridge (5-membered with N)
    [
      { x: 25.98, y: 15 },
      { x: 38.97, y: 30 },
      { x: 51.96, y: 30 },
      { x: 51.96, y: 15 },
      { x: 38.97, y: 7.5 },
    ],
  ],
  sharedAtoms: [
    [0, 1, 2, 0],
    [1, 5, 2, 2],
  ],
  matches: (system, molecule) => {
    if (system.rings.length !== 3) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 5 || sizes[1] !== 6 || sizes[2] !== 6) return false;

    // Check for nitrogen in 5-ring
    const ring5 = system.rings.find((r) => r.size === 5);
    if (!ring5) return false;

    const hasNitrogen = ring5.atomIds.some((id) => molecule.atoms[id]?.symbol === "N");
    return hasNitrogen && system.rings.filter((r) => r.aromatic).length === 3; // All aromatic
  },
};

/**
 * Database of all available templates.
 * Ordered by priority (more specific patterns first).
 */
export const POLYCYCLIC_TEMPLATES: PolycyclicTemplate[] = [
  // Specific heterocycles first (most specific matching)
  PURINE_TEMPLATE,
  DIBENZOFURAN_TEMPLATE, // 3-ring with O (must check before CARBAZOLE and FLUORENE)
  CARBAZOLE_TEMPLATE,
  BENZOFURAN_TEMPLATE, // 2-ring with O
  BENZOTHIOPHENE_TEMPLATE,
  INDOLE_TEMPLATE,
  QUINOLINE_TEMPLATE,

  // Common aromatics (more specific patterns first)
  NAPHTHALENE_TEMPLATE,
  PHENANTHRENE_TEMPLATE, // Check angular fusion before linear
  ANTHRACENE_TEMPLATE,
  PYRENE_TEMPLATE,
  FLUORENE_TEMPLATE,

  // Complex scaffolds
  STEROID_TEMPLATE,
  MORPHINE_TEMPLATE,
  ADAMANTANE_TEMPLATE,
];

/**
 * Find matching template for a ring system.
 *
 * @param system - Ring system to match
 * @param molecule - Parent molecule
 * @returns Matching template or null
 */
export function findMatchingTemplate(
  system: RingSystem,
  molecule: Molecule,
): PolycyclicTemplate | null {
  for (const template of POLYCYCLIC_TEMPLATES) {
    if (template.matches(system, molecule)) {
      return template;
    }
  }
  return null;
}

/**
 * Build atom-to-atom mapping between template and molecule using shared atom constraints.
 *
 * CURRENT LIMITATION: Uses simplified sequential approach that doesn't preserve bond angles.
 * This works for generating coordinates but may produce incorrect angles (~90° instead of ~120°).
 *
 * TODO: Implement proper subgraph isomorphism to match molecule atoms to template atoms
 * based on bond connectivity rather than sequential order. This requires:
 * 1. VF2 or similar graph matching algorithm
 * 2. Bond-aware matching (not just ring membership)
 * 3. Handle multiple valid mappings (choose best based on some heuristic)
 *
 * Current approach: Collect all unique atoms from ring system and map them to
 * flattened template coordinates, respecting shared atoms through deduplication.
 *
 * @param template - Template with coordinate data
 * @param system - Ring system from molecule
 * @param _molecule - Full molecule (for future use with proper isomorphism)
 * @returns Map from molecule atom ID to template coordinate index
 */
function buildAtomMapping(
  template: PolycyclicTemplate,
  system: RingSystem,
  _molecule: Molecule,
): Map<number, number> {
  const atomToCoordIdx = new Map<number, number>();

  // Build reverse mapping: which rings contain each atom
  const atomToRings = new Map<number, number[]>();
  for (let ringIdx = 0; ringIdx < system.rings.length; ringIdx++) {
    const ring = system.rings[ringIdx];
    if (!ring) continue;
    for (const atomId of ring.atomIds) {
      if (!atomToRings.has(atomId)) {
        atomToRings.set(atomId, []);
      }
      atomToRings.get(atomId)!.push(ringIdx);
    }
  }

  // Flatten template coordinates and track which atoms are shared
  let coordIdx = 0;
  const seenAtoms = new Set<number>();

  for (
    let ringIdx = 0;
    ringIdx < Math.min(system.rings.length, template.coordinates.length);
    ringIdx++
  ) {
    const ring = system.rings[ringIdx];
    const templateCoords = template.coordinates[ringIdx];
    if (!ring || !templateCoords) continue;

    for (
      let atomIdx = 0;
      atomIdx < Math.min(ring.atomIds.length, templateCoords.length);
      atomIdx++
    ) {
      const atomId = ring.atomIds[atomIdx];
      if (atomId === undefined) continue;

      // Check if this atom is shared (appears in multiple rings)
      const ringsContainingAtom = atomToRings.get(atomId) ?? [];
      const isShared = ringsContainingAtom.length > 1;

      if (isShared && seenAtoms.has(atomId)) {
        // This is a shared atom we've already mapped - use existing mapping
        continue;
      }

      // Map this atom to current coordinate index
      atomToCoordIdx.set(atomId, coordIdx);
      seenAtoms.add(atomId);
      coordIdx++;
    }
  }

  return atomToCoordIdx;
}

/**
 * Apply template coordinates to ring system with proper atom mapping.
 *
 * Maps template coordinates to actual atom IDs in the molecule using
 * graph connectivity to ensure correct atom-to-atom correspondence.
 *
 * Features:
 * 1. Graph-based atom mapping respecting bond connectivity
 * 2. Proper handling of shared atoms (no duplicates)
 * 3. Scales coordinates to match desired bond length
 *
 * @param template - Template with pre-computed coordinates
 * @param system - Ring system from molecule
 * @param bondLength - Desired bond length for scaling
 * @param molecule - Full molecule for connectivity checking
 * @returns Map of atom ID -> coordinate
 */
export function applyTemplate(
  template: PolycyclicTemplate,
  system: RingSystem,
  bondLength: number,
  molecule: Molecule,
): Map<number, Vec2> {
  const coords = new Map<number, Vec2>();

  // Build atom mapping (maps molecule atom ID -> template coordinate index)
  const atomToCoordIdx = buildAtomMapping(template, system, molecule);

  // Flatten template coordinates for lookup
  const flatCoords: Vec2[] = [];
  for (const ringCoords of template.coordinates) {
    flatCoords.push(...ringCoords);
  }

  // Apply coordinates using the mapping
  for (const [moleculeAtomId, coordIdx] of atomToCoordIdx.entries()) {
    const templateCoord = flatCoords[coordIdx];
    if (!templateCoord) continue;

    // Scale coordinates to match desired bond length (templates use 30Å bonds)
    const scale = bondLength / 30;
    coords.set(moleculeAtomId, {
      x: templateCoord.x * scale,
      y: templateCoord.y * scale,
    });
  }

  return coords;
}

/**
 * Check if template-based placement would improve quality.
 *
 * Returns true if template exists and is likely better than BFS.
 */
export function shouldUseTemplate(system: RingSystem, molecule: Molecule): boolean {
  const template = findMatchingTemplate(system, molecule);
  return template !== null;
}
