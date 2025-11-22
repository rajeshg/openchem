# Plan: Remove Webcola & Implement Superior 2D Coordinate Generation

**Status**: Planning  
**Created**: 2025-11-22  
**Goal**: Remove webcola dependency and implement a chemistry-aware, template-based 2D coordinate generation system that handles rings and fused ring systems correctly.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Quick Reference: Key Innovation](#quick-reference-key-innovation)
3. [Current State Analysis](#current-state-analysis)
4. [Problems with Current Approach](#problems-with-current-approach)
5. [Design Philosophy](#design-philosophy)
6. [Canonicalization Challenge & Solution](#canonicalization-challenge--solution)
7. [Implementation Plan](#implementation-plan)
8. [Phase 1: Core System Implementation](#phase-1-core-system-implementation)
9. [Phase 2: Integration & Migration](#phase-2-integration--migration)
10. [Phase 3: Testing & Validation](#phase-3-testing--validation)
11. [Phase 4: Documentation & Cleanup](#phase-4-documentation--cleanup)
12. [Edge Cases & Handling](#edge-cases--handling)
13. [Key Design Decisions](#key-design-decisions)
14. [Expected Outcomes](#expected-outcomes)
15. [Risk Mitigation](#risk-mitigation)
16. [Timeline Estimate](#timeline-estimate)
17. [Summary: Canonicalization-Independent Design](#summary-canonicalization-independent-design)

---

## Executive Summary

**Objective**: Replace webcola-based force-directed layout with a chemistry-aware, template-based coordinate generation system.

**Why**:
- ✅ Webcola is heavyweight (only 2 functions used from entire library)
- ✅ Current approach treats rings like flexible chains (causes distortion)
- ✅ Complex fused rings (phenanthrene, pyrene, morphine) need special handling
- ✅ We want deterministic, predictable, chemically-intuitive layouts

**Approach**:
1. **Template-based ring placement**: Use pre-computed geometric templates for rings
2. **Rigid body constraints**: Treat fused ring systems as rigid units
3. **Deterministic substituent placement**: Hybridization-aware angle selection
4. **Short constrained relaxation**: Only fix local overlaps, preserve ring geometry
5. **No external dependencies**: Pure TypeScript, ~1000-1500 lines

**Outcome**:
- Better visual quality (rings look like chemists draw them)
- Faster performance (deterministic placement + short relaxation)
- Smaller bundle size (~100KB saved)
- Handles complex molecules correctly (morphine, steroids, polycyclic aromatics)

**Validation**: ✅ **Plan tested against 27 diverse molecules**
- Coverage: 26/27 fully handled (96%)
- Critical gaps: **None**
- See `coordinate-generation-gap-analysis.md` for detailed analysis

---

## Quick Reference: Key Innovation

| Challenge | Current Approach | New Approach |
|-----------|------------------|--------------|
| Ring layout | Webcola force-directed | Pre-computed templates (regular polygons) |
| Fused rings | Hope webcola aligns them | BFS + explicit edge alignment |
| Canonicalization | ❌ Breaks on different SMILES | ✅ Structural invariants (order-independent) |
| Determinism | ❌ Random (webcola) | ✅ Fully deterministic |
| Performance | ~100ms (100 iterations) | ~40ms (deterministic placement + short relax) |
| Bundle size | +100KB (webcola) | +15KB (pure TypeScript) |
| Complex molecules | ❌ Distorted rings | ✅ Perfect geometry (rigid templates) |

### Critical Insight: Canonicalization Independence

**Problem**: Same molecule → different SMILES → different atom ordering → template lookup fails

**Solution**: 
1. **Don't use templates** (Phase 1) - generic BFS+alignment works for all cases
2. **Use structural matching** (Phase 2 optional) - match by topology, not atom IDs

---

## Current State Analysis

### Files Using Webcola

```
src/utils/coordinate-generator-webcola.ts (197 lines)
src/utils/coordinate-generator.ts (1071 lines)
package.json (webcola dependency)
```

### Current Pipeline

```
1. Parse SMILES → Molecule graph
2. Detect rings (SSSR)
3. Layout rings as regular polygons
4. Attach substituents with BFS
5. ❌ Call webcola for force-directed refinement
6. Render SVG
```

### Webcola Usage

**Only 2 main functions used**:
- `nodes(nodes)` - set node positions
- `links(links)` - set edge constraints

**What webcola does**:
- Force-directed layout with spring forces
- Node overlap avoidance
- Link distance constraints

**Problems**:
- Doesn't understand ring chemistry
- Can distort ring geometry
- Heavyweight dependency (~100KB)
- Non-deterministic (random initial conditions)

---

## Problems with Current Approach

### 1. Ring Distortion
Webcola treats ring atoms as independent nodes connected by springs. This causes:
- Hexagons become ellipses
- Fused rings misalign
- Bond angles drift from ideal values

### 2. Fused Ring Issues
When placing naphthalene, phenanthrene, pyrene:
- Each ring placed independently
- Alignment relies on force minimization
- No guarantee of correct shared-edge geometry
- Can create "broken" or "twisted" fused systems

### 3. Complex Polycyclics
Molecules like morphine, steroids, alkaloids:
- Multiple fused rings + bridges
- Needs understanding of 3D cage structure projected to 2D
- Current approach: random + pray webcola fixes it

### 4. Performance
Force-directed layout is O(n²) per iteration:
- 100 iterations × n² = slow for large molecules
- Most time spent on already-good layouts

### 5. Determinism
Webcola has random components:
- Same molecule can render differently each time
- Hard to test, hard to debug
- User confusion

---

## Design Philosophy

### Core Principles

#### 1. **Chemistry First**
Rings and fused ring systems are fundamental structural units in chemistry. They should be treated as **rigid geometric templates**, not flexible chains.

#### 2. **Template-Based Placement**
- Pre-compute ideal geometries for common fragments
- Place templates first, attach substituents second
- Minimal relaxation needed if initial placement is good

#### 3. **Hierarchical Structure**
```
Molecule
  ├─ Fused Ring Systems (rigid templates)
  │   ├─ Ring 1
  │   ├─ Ring 2 (aligned to Ring 1 via shared edge)
  │   └─ Ring 3 (aligned to Ring 2)
  ├─ Isolated Rings (regular polygons)
  └─ Substituent Trees (flexible, hybridization-aware)
```

#### 4. **Constrained Relaxation**
- Ring atoms: **fixed** or **rigid group** (move together)
- Substituents: **flexible** (can adjust to avoid overlaps)
- Short iteration count (50-300 iterations)

#### 5. **Deterministic & Predictable**
- Same molecule → same layout (every time)
- Clear, testable algorithm
- No randomness

---

## Implementation Plan

### Directory Structure

```
src/utils/coordinate-generator-v2/
├── index.ts                      # Main entry point & pipeline
├── types.ts                      # Vec2, RigidGroup, RingSystem types
├── geometry-utils.ts             # Vector math, transforms, polygons
├── ring-system-detector.ts       # Group rings into fused systems
├── ring-templates.ts             # Template library (polygon, fused patterns)
├── fused-ring-placer.ts          # BFS placement with edge alignment
├── substituent-placer.ts         # Attach chains/branches to rings
├── constrained-relaxer.ts        # Spring/angle/repulsion with rigid groups
└── overlap-resolver.ts           # Post-process collisions
```

---

## Canonicalization Challenge & Solution

### The Problem

The same ring or fused system can be represented by multiple SMILES strings:
- Benzene: `c1ccccc1` vs `C1=CC=CC=C1` vs `c1cc(ccc1)`
- Naphthalene: `c1ccc2ccccc2c1` vs `c1ccc2c(c1)cccc2` vs `C1=CC=C2C=CC=CC2=C1`

**Issue**: If we index templates by atom ordering, we'll miss most matches because:
- SMILES parser may start from different atoms
- Canonicalization algorithms differ between tools
- User input may use arbitrary atom numbering

### The Solution: Structural Invariants

Instead of matching atom sequences, match **structural features** that are independent of atom ordering:

#### 1. Ring Size Distribution
```typescript
// Invariant: sorted ring sizes
naphthalene: [6, 6]
anthracene: [6, 6, 6]
phenanthrene: [6, 6, 6]  // same as anthracene!
```
❌ Not unique enough - need more features.

#### 2. Fusion Topology Graph
```typescript
// Each ring is a node, edges represent fusions
naphthalene:   A—B           (linear, 2 rings)
anthracene:    A—B—C         (linear, 3 rings)
phenanthrene:  A—B           (angular, 3 rings)
               └─C
pyrene:        A—B           (diamond, 4 rings)
               │ │
               C─D
```

**Graph Invariant**: Compute canonical form of fusion graph
- Degree sequence: [deg(A), deg(B), deg(C), ...] sorted
- Canonical adjacency matrix
- Graph hash (Weisfeiler-Lehman)

#### 3. Combined Invariant Hash

```typescript
interface RingSystemInvariant {
  ringCount: number;
  ringSizes: number[];           // sorted
  fusionDegrees: number[];       // degree of each ring in fusion graph, sorted
  fusionGraphHash: string;       // canonical graph hash
  aromaticCount: number;
  bridgeheadCount: number;       // atoms in 3+ rings (e.g., adamantane)
}

function computeInvariant(system: RingSystem): string {
  const inv = {
    ringCount: system.rings.length,
    ringSizes: system.rings.map(r => r.size).sort(),
    fusionDegrees: computeFusionDegrees(system).sort(),
    fusionGraphHash: computeGraphHash(system),
    aromaticCount: system.rings.filter(r => r.aromatic).length,
    bridgeheadCount: countBridgeheads(system),
  };
  return JSON.stringify(inv); // or better: hash to fixed-length string
}
```

#### 4. Template Matching Algorithm

```typescript
/**
 * Match fused ring system to template library.
 * Uses structural invariants, not atom ordering.
 */
function matchFusedTemplate(system: RingSystem): FusedTemplate | null {
  const invariant = computeInvariant(system);
  
  // Lookup in template library by invariant
  const template = FUSED_TEMPLATE_LIBRARY.get(invariant);
  if (template) return template;
  
  // Fallback: find closest match
  const candidates = findSimilarInvariants(invariant, FUSED_TEMPLATE_LIBRARY);
  if (candidates.length > 0) {
    return selectBestMatch(candidates, system);
  }
  
  return null; // no match, use generic polygon placement
}
```

#### 5. Template Application (Atom Mapping)

Even if we match the pattern, we still need to map template atoms to molecule atoms:

```typescript
/**
 * Apply template to actual molecule atoms.
 * Need to find correspondence between template and molecule.
 */
function applyTemplate(
  template: FusedTemplate,
  system: RingSystem,
  molecule: Molecule
): Map<number, Vec2> {
  // Step 1: Compute local invariants for each atom
  const templateInvariants = new Map<number, string>();
  for (const atomId of template.atomIds) {
    const inv = computeAtomInvariant(atomId, template);
    templateInvariants.set(atomId, inv);
  }
  
  const moleculeInvariants = new Map<number, string>();
  for (const atomId of system.atomIds) {
    const inv = computeAtomInvariant(atomId, system);
    moleculeInvariants.set(atomId, inv);
  }
  
  // Step 2: Match atoms by invariant
  const mapping = new Map<number, number>(); // molecule atomId -> template atomId
  
  for (const [molAtomId, molInv] of moleculeInvariants) {
    for (const [tmpAtomId, tmpInv] of templateInvariants) {
      if (molInv === tmpInv && !mapping.has(molAtomId)) {
        mapping.set(molAtomId, tmpAtomId);
        break;
      }
    }
  }
  
  // Step 3: Apply template coordinates using mapping
  const coords = new Map<number, Vec2>();
  for (const [molAtomId, tmpAtomId] of mapping) {
    coords.set(molAtomId, template.coordinates.get(tmpAtomId)!);
  }
  
  return coords;
}

/**
 * Compute atom-level invariant for matching.
 */
function computeAtomInvariant(atomId: number, context: any): string {
  return JSON.stringify({
    degree: getDegree(atomId),
    ringMembership: getRingIds(atomId).length,
    neighbors: getNeighbors(atomId).map(n => n.symbol).sort(),
    isAromatic: isAromatic(atomId),
    isBridgehead: isBridgehead(atomId),
  });
}
```

### Practical Strategy: Avoid Templates Initially

**Phase 1**: Don't use fused templates at all
- Use only regular polygon templates (size-based)
- Use BFS + edge alignment for fused systems
- This works for **any** canonicalization

**Phase 2** (later): Add template matching
- Build template library with invariant indexing
- Match by structural features, not atom order
- Only use templates for common patterns (naphthalene, anthracene, etc.)

### Implementation Priority

```typescript
// Priority 1: Generic algorithm (works for any molecule, any canonicalization)
function placeFusedSystemGeneric(system: RingSystem): Map<number, Vec2> {
  // Use regular polygons + BFS alignment (Step 4 in plan)
  // No template lookup needed
}

// Priority 2: Template optimization (faster, prettier for common patterns)
function placeFusedSystemWithTemplate(system: RingSystem): Map<number, Vec2> {
  const template = matchFusedTemplate(system); // uses invariants
  if (template) {
    return applyTemplate(template, system);
  }
  return placeFusedSystemGeneric(system); // fallback
}
```

### Testing Strategy for Canonicalization

```typescript
describe('canonicalization independence', () => {
  test('benzene renders identically regardless of SMILES', () => {
    const smiles = [
      'c1ccccc1',
      'C1=CC=CC=C1',
      'c1cc(ccc1)',
      'c1c(cccc1)',
    ];
    
    const layouts = smiles.map(s => generateCoordinates2D(parseSMILES(s).molecules[0]));
    
    // All layouts should have same ring geometry (up to rotation/reflection)
    for (let i = 1; i < layouts.length; i++) {
      expect(geometryEquivalent(layouts[0], layouts[i])).toBe(true);
    }
  });
  
  test('naphthalene fusion detected regardless of SMILES', () => {
    const smiles = [
      'c1ccc2ccccc2c1',
      'c1ccc2c(c1)cccc2',
      'C1=CC=C2C=CC=CC2=C1',
    ];
    
    for (const s of smiles) {
      const mol = parseSMILES(s).molecules[0];
      const systems = detectFusedRingSystems(mol.rings, mol);
      expect(systems).toHaveLength(1);
      expect(systems[0].rings).toHaveLength(2);
    }
  });
});
```

---

## Phase 1: Core System Implementation

### Step 1: Core Data Structures & Utilities

**File**: `src/utils/coordinate-generator-v2/types.ts`

```typescript
export interface Vec2 {
  x: number;
  y: number;
}

export interface RigidGroup {
  id: number;
  atomIds: number[];
  type: 'ring' | 'fused-system' | 'bridge';
}

export interface RingSystem {
  id: number;
  rings: Ring[];
  atomIds: Set<number>;
  bondIds: Set<string>;
  type: 'isolated' | 'fused' | 'spiro' | 'bridged';
}

export interface Ring {
  id: number;
  atomIds: number[];
  size: number;
  aromatic: boolean;
  rigidGroupId?: number;
}

export interface CoordinateOptions {
  bondLength: number;
  iterations: number;
  springConstant: number;
  repulsionMagnitude: number;
  angleWeight: number;
  rigidGroupRotationTolerance: number;
}
```

**File**: `src/utils/coordinate-generator-v2/geometry-utils.ts`

```typescript
// Vector operations
export function add(a: Vec2, b: Vec2): Vec2
export function sub(a: Vec2, b: Vec2): Vec2
export function scale(v: Vec2, s: number): Vec2
export function dot(a: Vec2, b: Vec2): number
export function length(v: Vec2): number
export function normalize(v: Vec2): Vec2
export function rotate(v: Vec2, angle: number): Vec2

// Polygon generation
export function regularPolygon(n: number, radius: number, center: Vec2): Vec2[]

// Transform computation
export function computeAlignmentTransform(
  localP1: Vec2, localP2: Vec2,
  targetP1: Vec2, targetP2: Vec2
): Transform

export interface Transform {
  rotation: number;
  translation: Vec2;
  scale: number;
}

export function applyTransform(point: Vec2, transform: Transform): Vec2
```

---

### Step 2: Ring Detection & Fused System Analysis

**File**: `src/utils/coordinate-generator-v2/ring-system-detector.ts`

```typescript
/**
 * Group rings into fused systems.
 * Two rings are in the same system if they share ≥2 atoms (shared edge).
 */
export function detectFusedRingSystems(
  rings: Ring[],
  molecule: Molecule
): RingSystem[]

/**
 * Build adjacency graph of rings within a system.
 */
export function buildRingAdjacency(system: RingSystem): Map<number, number[]>

/**
 * Classify system type: isolated, fused (linear/angular), spiro, bridged.
 */
export function classifyRingSystem(system: RingSystem): SystemType

/**
 * Prioritize placement order (largest/most connected first).
 */
export function orderRingsForPlacement(system: RingSystem): Ring[]
```

**Algorithm**:
```
1. Build graph: nodes = rings, edges = shared bonds
2. Connected components = fused systems
3. For each system:
   - Count shared atoms between rings
   - If shared = 1 → spiro
   - If shared ≥ 2 → fused
   - Check for bridges (atom in >2 rings but not adjacent)
```

---

### Step 3: Template-Based Ring Layout

**File**: `src/utils/coordinate-generator-v2/ring-templates.ts`

```typescript
/**
 * Library of pre-computed ring templates.
 */
export const RING_TEMPLATES: Record<number, Vec2[]> = {
  3: [...], // Triangle
  4: [...], // Square
  5: [...], // Pentagon
  6: [...], // Hexagon (preferred flat-top orientation)
  7: [...], // Heptagon
  8: [...], // Octagon
}

/**
 * Generate regular polygon template for ring size n.
 */
export function getRingTemplate(size: number, bondLength: number): Vec2[]

/**
 * Get ideal template for a specific ring (may customize based on context).
 */
export function selectTemplate(ring: Ring, context: PlacementContext): Vec2[]
```

**Fused Templates** (advanced) - **NOTE: Must use structural matching**:
```typescript
/**
 * Structural descriptor for fused ring patterns (canonicalization-independent).
 */
interface FusedPattern {
  /** Number of rings in system */
  ringCount: number;
  /** Ring sizes (sorted) */
  ringSizes: number[];
  /** Fusion topology: adjacency graph invariant (e.g., degree sequence) */
  topology: string;
  /** Pre-computed coordinates */
  template: Map<string, Vec2>; // keyed by invariant atom identifier
}

/**
 * Compute structural invariant for fused ring system.
 * Returns canonicalization-independent descriptor.
 */
export function computeFusedPatternInvariant(system: RingSystem): string

/**
 * Library of common fused patterns indexed by structural invariant.
 */
export const FUSED_PATTERN_LIBRARY: Map<string, FusedPattern>

/**
 * Match fused system to template library using structural features.
 * Returns template if match found, null otherwise.
 */
export function matchFusedTemplate(system: RingSystem): FusedPattern | null
```

---

### Step 4: Fused Ring Placement Algorithm (Canonicalization-Independent)

**File**: `src/utils/coordinate-generator-v2/fused-ring-placer.ts`

```typescript
/**
 * Place entire fused ring system using BFS + edge alignment.
 * IMPORTANT: This algorithm is canonicalization-independent.
 * It works by aligning rings via shared edges, not by atom ordering.
 */
export function placeFusedRingSystem(
  system: RingSystem,
  molecule: Molecule,
  bondLength: number
): Map<number, Vec2>
```

**Key Insight**: We don't care about atom ordering. We only care about:
1. Which atoms are shared between rings (set intersection)
2. Which shared atoms form an edge (bond connectivity)
3. Aligning template edges to existing edges

**Algorithm**:
```
function placeFusedRingSystem(system):
  coords = new Map<atomId, Vec2>()
  
  // Step 1: Pick seed ring (most connected or largest)
  seedRing = selectSeedRing(system)
  
  // Step 2: Place seed ring at origin using template
  template = getRingTemplate(seedRing.size, bondLength)
  for i in 0..seedRing.size:
    coords.set(seedRing.atomIds[i], template[i])
  
  // Step 3: BFS outward to place adjacent rings
  queue = [seedRing]
  placed = new Set([seedRing.id])
  
  while queue.notEmpty():
    currentRing = queue.dequeue()
    
    for neighborRing in getAdjacentRings(currentRing, system):
      if placed.has(neighborRing.id): continue
      
      // Find shared edge (2 adjacent shared atoms)
      // CRITICAL: Must find atoms that are (a) in both rings and (b) bonded
      sharedAtoms = intersection(currentRing.atomIds, neighborRing.atomIds)
      sharedEdge = findBondedPair(sharedAtoms, molecule.bonds)
      [atom1, atom2] = sharedEdge
      
      // Validation: must have exactly 2 shared atoms that are bonded
      assert(sharedAtoms.length >= 2, 'Fused rings must share at least 2 atoms')
      assert(sharedEdge !== null, 'Shared atoms must be bonded')
      
      // Existing coordinates of shared atoms
      p1 = coords.get(atom1)
      p2 = coords.get(atom2)
      
      // Generate fresh template for neighbor ring
      localTemplate = getRingTemplate(neighborRing.size, bondLength)
      
      // Find positions of shared atoms in local template
      [localP1, localP2] = findAtomsInTemplate(atom1, atom2, localTemplate, neighborRing)
      
      // Compute transform: rotate + translate so localP1→p1, localP2→p2
      transform = computeAlignmentTransform(localP1, localP2, p1, p2)
      
      // Apply transform to all atoms in neighbor ring
      for atomId in neighborRing.atomIds:
        if not coords.has(atomId):
          localCoord = localTemplate[indexOf(atomId, neighborRing)]
          coords.set(atomId, applyTransform(localCoord, transform))
      
      placed.add(neighborRing.id)
      queue.enqueue(neighborRing)
  
  return coords
```

**Key**: Align rings by **shared edge** (2 adjacent atoms), not arbitrary shared atoms. This ensures correct geometry.

**Critical Helper Functions**:

```typescript
/**
 * Find shared atoms between two rings (set intersection).
 * This is canonicalization-independent.
 */
function findSharedAtoms(ring1: Ring, ring2: Ring): number[] {
  const set1 = new Set(ring1.atomIds);
  const set2 = new Set(ring2.atomIds);
  return Array.from(set1).filter(id => set2.has(id));
}

/**
 * Find bonded pair among shared atoms.
 * This identifies the shared edge.
 */
function findBondedPair(atomIds: number[], bonds: Bond[]): [number, number] | null {
  for (let i = 0; i < atomIds.length; i++) {
    for (let j = i + 1; j < atomIds.length; j++) {
      const a1 = atomIds[i]!;
      const a2 = atomIds[j]!;
      if (bonds.some(b => (b.atom1 === a1 && b.atom2 === a2) || 
                          (b.atom1 === a2 && b.atom2 === a1))) {
        return [a1, a2];
      }
    }
  }
  return null;
}

/**
 * Find positions of two atoms in a ring template.
 * Returns their indices in the ring's atomIds array.
 */
function findAtomsInRing(atom1: number, atom2: number, ring: Ring): [number, number] {
  const idx1 = ring.atomIds.indexOf(atom1);
  const idx2 = ring.atomIds.indexOf(atom2);
  return [idx1, idx2];
}

/**
 * Check if two atoms are adjacent in ring (next to each other in cycle).
 * Handles wraparound.
 */
function areAdjacent(idx1: number, idx2: number, ringSize: number): boolean {
  return Math.abs(idx1 - idx2) === 1 || 
         Math.abs(idx1 - idx2) === ringSize - 1;
}

/**
 * Get template coordinates for specific atom indices.
 */
function getTemplateCoords(
  ring: Ring, 
  atomIdx: number, 
  template: Vec2[]
): Vec2 {
  // Handle wraparound and ensure atomIdx corresponds to template index
  return template[atomIdx % template.length]!;
}
```

**Why This Works Regardless of Canonicalization**:
1. **Set intersection** finds shared atoms by ID (doesn't care about ordering)
2. **Bond connectivity** identifies shared edge (topology, not sequence)
3. **Template alignment** uses geometric transform (rotation + translation)
4. **No assumptions** about which atom is "first" in the ring

---

### Step 5: Substituent Attachment

**File**: `src/utils/coordinate-generator-v2/substituent-placer.ts`

```typescript
/**
 * Attach substituents (chains, branches) to placed ring atoms.
 */
export function attachSubstituents(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  ringAtoms: Set<number>,
  bondLength: number
): void
```

**Algorithm**:
```
function attachSubstituents():
  visited = new Set(ringAtoms)
  queue = []
  
  // Seed queue with ring atoms that have unplaced neighbors
  for atomId in ringAtoms:
    neighbors = getNeighbors(atomId)
    for neighbor in neighbors:
      if not visited.has(neighbor):
        queue.push({id: neighbor, parentId: atomId})
  
  // BFS outward
  while queue.notEmpty():
    {id, parentId} = queue.dequeue()
    if visited.has(id): continue
    visited.add(id)
    
    // Get parent coordinate
    parentCoord = coords.get(parentId)
    
    // Compute occupied angles (bonds to already-placed atoms)
    occupiedAngles = []
    for neighbor in getNeighbors(parentId):
      if visited.has(neighbor):
        neighborCoord = coords.get(neighbor)
        angle = atan2(neighborCoord.y - parentCoord.y, neighborCoord.x - parentCoord.x)
        occupiedAngles.push(angle)
    
    // Pick free angle (largest gap between occupied angles)
    freeAngle = pickFreeAngle(occupiedAngles, atom.hybridization)
    
    // Place atom at bondLength distance
    coords.set(id, {
      x: parentCoord.x + cos(freeAngle) * bondLength,
      y: parentCoord.y + sin(freeAngle) * bondLength
    })
    
    // Enqueue children
    for neighbor in getNeighbors(id):
      if not visited.has(neighbor):
        queue.push({id: neighbor, parentId: id})
```

**Hybridization-aware angles**:
- `sp`: prefer 180° (linear)
- `sp2`: prefer 120° spacing (trigonal planar)
- `sp3`: prefer 109.5° → ~120° in 2D (tetrahedral projection)

**Deterministic zigzag for chains**:
```
For linear chains (degree-2 atoms not in rings):
  Alternate angles: parent_angle + 60°, parent_angle - 60°
```

---

### Step 6: Constrained Force-Directed Relaxation

**File**: `src/utils/coordinate-generator-v2/constrained-relaxer.ts`

```typescript
/**
 * Refine coordinates with constrained relaxation.
 * Rings stay rigid; substituents flex to avoid overlaps.
 */
export function relaxCoordinates(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  rigidGroups: RigidGroup[],
  options: CoordinateOptions
): void
```

**Algorithm**:
```
function relaxCoordinates():
  velocities = initializeVelocities(molecule.atoms)
  
  for iter in 0..options.iterations:
    forces = computeForces(coords, molecule, options)
    
    // Integrate (Velocity Verlet with damping)
    for atom in molecule.atoms:
      if atom.isInRigidGroup: continue  // Skip fixed atoms
      
      v = velocities[atom.id]
      f = forces[atom.id]
      
      // Update velocity
      v = (v + f * dt) * damping
      
      // Update position
      coords[atom.id] += v * dt
    
    // Occasional bond length projection for stability
    if iter % 10 == 0:
      projectBondLengths(coords, molecule, bondLength)
```

**Force computation**:
```
function computeForces():
  forces = initializeZero()
  
  // 1. Spring forces (bond length constraints)
  for bond in molecule.bonds:
    [a1, a2] = [bond.atom1, bond.atom2]
    p1 = coords[a1]
    p2 = coords[a2]
    
    vec = p2 - p1
    dist = length(vec)
    target = bondLength
    
    force = springConstant * (dist - target) * normalize(vec)
    
    if not rigidGroup[a1]: forces[a1] += force
    if not rigidGroup[a2]: forces[a2] -= force
  
  // 2. Angle forces (soft bias toward ideal angles)
  for atom in molecule.atoms:
    neighbors = getNeighbors(atom)
    if neighbors.length < 2: continue
    
    targetAngle = getIdealAngle(atom.hybridization, neighbors.length)
    
    for [n1, n2] in pairs(neighbors):
      vec1 = coords[n1] - coords[atom]
      vec2 = coords[n2] - coords[atom]
      
      angle = angleBetween(vec1, vec2)
      angleDiff = angle - targetAngle
      
      torque = angleWeight * angleDiff
      
      // Apply perpendicular forces to neighbors
      forces[n1] += perpendicular(vec1) * torque
      forces[n2] -= perpendicular(vec2) * torque
  
  // 3. Repulsion forces (prevent overlaps)
  for [i, j] in atomPairs:
    if areBonded(i, j): continue
    if sameRigidGroup(i, j): continue
    
    vec = coords[j] - coords[i]
    dist = length(vec)
    minDist = bondLength * 0.5
    
    if dist < minDist:
      force = repulsionMagnitude * (minDist - dist) / dist
      
      if not rigidGroup[i]: forces[i] -= normalize(vec) * force
      if not rigidGroup[j]: forces[j] += normalize(vec) * force
  
  return forces
```

**Rigid group handling**:
```
Option A: Fixed atoms
  - Mark all ring atoms as fixed (don't move)
  - Only substituents flex

Option B: Rigid body dynamics (advanced)
  - Allow entire rigid group to translate/rotate as unit
  - Compute center of mass, angular momentum
  - Apply group-level forces
```

**Recommend**: Start with Option A (simpler), upgrade to Option B if needed.

---

### Step 7: Overlap Post-Processing

**File**: `src/utils/coordinate-generator-v2/overlap-resolver.ts`

```typescript
/**
 * Detect and resolve remaining overlaps after relaxation.
 */
export function resolveOverlaps(
  molecule: Molecule,
  coords: Map<number, Vec2>,
  options: CoordinateOptions
): void
```

**Algorithm**:
```
function resolveOverlaps():
  // Detect atom-atom collisions
  collisions = detectAtomCollisions(coords, minDistance)
  
  for [atom1, atom2] in collisions:
    if bothInRigidGroups(atom1, atom2): continue
    
    // Push flexible atom away
    vec = coords[atom2] - coords[atom1]
    pushDistance = (minDistance - length(vec)) / 2
    
    if not rigidGroup[atom1]:
      coords[atom1] -= normalize(vec) * pushDistance
    if not rigidGroup[atom2]:
      coords[atom2] += normalize(vec) * pushDistance
  
  // Detect label collisions (for visible atoms)
  labelCollisions = detectLabelCollisions(coords, molecule, fontSize)
  
  for [atom1, atom2] in labelCollisions:
    // Offset label along free-space bisector
    offsetLabel(atom1, coords, fontSize)
```

**Advanced**: Temporarily unlock rigid groups for small rotation (±5-15°) if collision is unavoidable.

---

### Step 8: Main Entry Point

**File**: `src/utils/coordinate-generator-v2/index.ts`

```typescript
import type { Molecule } from 'types';
import type { MoleculeCoordinates } from '../coordinate-generator';
import type { CoordinateOptions } from './types';

/**
 * Generate 2D coordinates for a molecule using template-based approach.
 * 
 * Pipeline:
 * 1. Detect rings → group into fused systems
 * 2. Place ring templates (mark as rigid groups)
 * 3. Attach substituents with hybridization-aware angles
 * 4. Constrained relaxation (rings fixed, substituents flex)
 * 5. Post-process overlaps
 * 
 * @returns Coordinate array aligned with molecule.atoms indices
 */
export function generateCoordinates2D(
  molecule: Molecule,
  options?: Partial<CoordinateOptions>
): MoleculeCoordinates {
  const opts: CoordinateOptions = {
    bondLength: 35,
    iterations: 200,
    springConstant: 0.2,
    repulsionMagnitude: 0.6,
    angleWeight: 0.15,
    rigidGroupRotationTolerance: 10,
    ...options
  };
  
  // Step 1: Detect and group ring systems
  const rings = detectRings(molecule);
  const systems = detectFusedRingSystems(rings, molecule);
  const rigidGroups: RigidGroup[] = [];
  
  // Step 2: Initialize coordinates
  const coords = new Map<number, Vec2>();
  
  // Step 3: Place ring systems using templates
  for (const system of systems) {
    const systemCoords = placeFusedRingSystem(system, molecule, opts.bondLength);
    for (const [atomId, coord] of systemCoords) {
      coords.set(atomId, coord);
    }
    
    // Mark system as rigid group
    rigidGroups.push({
      id: rigidGroups.length,
      atomIds: Array.from(system.atomIds),
      type: 'fused-system'
    });
  }
  
  // Step 4: Attach substituents
  const ringAtoms = new Set<number>();
  for (const system of systems) {
    for (const atomId of system.atomIds) {
      ringAtoms.add(atomId);
    }
  }
  attachSubstituents(molecule, coords, ringAtoms, opts.bondLength);
  
  // Step 5: Constrained relaxation
  relaxCoordinates(molecule, coords, rigidGroups, opts);
  
  // Step 6: Overlap resolution
  resolveOverlaps(molecule, coords, opts);
  
  // Convert to array format
  const result: MoleculeCoordinates = Array(molecule.atoms.length);
  for (let i = 0; i < molecule.atoms.length; i++) {
    const atomId = molecule.atoms[i]!.id;
    const coord = coords.get(atomId) ?? { x: 0, y: 0 };
    result[i] = coord;
  }
  
  return result;
}
```

---

## Phase 2: Integration & Migration

### Step 9: Update SVG Renderer

**File**: `src/generators/svg-renderer/types.ts`

```typescript
export interface SVGRendererOptions {
  // ... existing options ...
  
  /**
   * Coordinate generation engine.
   * - 'legacy': Use existing coordinate-generator.ts (with webcola)
   * - 'v2': Use new template-based system (no webcola)
   * @default 'v2'
   */
  coordinateEngine?: 'legacy' | 'v2';
}
```

**File**: `src/generators/svg-renderer.ts`

```typescript
import { generateCoordinates } from 'src/utils/coordinate-generator';
import { generateCoordinates2D } from 'src/utils/coordinate-generator-v2';

function renderSingleMolecule(molecule: Molecule, options: SVGRendererOptions) {
  // ... existing code ...
  
  const rawCoords = options.atomCoordinates ?? (
    options.coordinateEngine === 'legacy' 
      ? generateCoordinates(molecule, options)
      : generateCoordinates2D(molecule, options)
  );
  
  // ... rest of rendering ...
}
```

### Step 10: Update Main Coordinate Generator

**File**: `src/utils/coordinate-generator.ts`

Add at top:
```typescript
import { generateCoordinates2D } from './coordinate-generator-v2';
```

Modify `generateCoordinates`:
```typescript
export function generateCoordinates(
  molecule: Molecule,
  options: SVGRendererOptions = {},
): MoleculeCoordinates {
  // Use new engine by default
  if (options.coordinateEngine !== 'legacy') {
    return generateCoordinates2D(molecule, {
      bondLength: options.bondLength,
      iterations: options.webcolaIterations,
    });
  }
  
  // Legacy path (keep for now)
  const bondLength = options.bondLength ?? 35;
  let coords = generateCoordinatesDefault(molecule, options);
  
  // ... existing webcola code ...
}
```

### Step 11: Remove Webcola Dependency

**After v2 is tested and working**:

1. Delete `src/utils/coordinate-generator-webcola.ts`
2. Remove webcola code from `coordinate-generator.ts`
3. Update `package.json`:
   ```diff
   - "dependencies": {
   -   "webcola": "^3.4.0"
   - }
   ```
4. Run `bun install` to update lockfile

---

## Phase 3: Testing & Validation

### Step 12: Unit Tests for Each Module

**File**: `test/unit/coordinate-generator-v2/geometry-utils.test.ts`
```typescript
describe('geometry-utils', () => {
  test('regularPolygon generates correct hexagon', () => {
    const hex = regularPolygon(6, 35);
    expect(hex).toHaveLength(6);
    // Verify bond lengths
    for (let i = 0; i < 6; i++) {
      const dist = distance(hex[i], hex[(i+1)%6]);
      expect(dist).toBeCloseTo(35, 0.1);
    }
  });
  
  test('computeAlignmentTransform aligns edges correctly', () => {
    // Test edge alignment
  });
});
```

**File**: `test/unit/coordinate-generator-v2/ring-system-detector.test.ts`
```typescript
describe('ring-system-detector', () => {
  test('detects fused system in naphthalene', () => {
    const mol = parseSMILES('c1ccc2ccccc2c1').molecules[0];
    const systems = detectFusedRingSystems(mol.rings, mol);
    expect(systems).toHaveLength(1);
    expect(systems[0].rings).toHaveLength(2);
  });
  
  test('detects isolated rings in biphenyl', () => {
    const mol = parseSMILES('c1ccccc1-c2ccccc2').molecules[0];
    const systems = detectFusedRingSystems(mol.rings, mol);
    expect(systems).toHaveLength(2);
    expect(systems[0].type).toBe('isolated');
  });
});
```

### Step 13: Visual Regression Tests

**File**: `test/svg/coordinate-generator-v2.test.ts`

```typescript
describe('coordinate-generator-v2 visual tests', () => {
  // 27 diverse molecules from gap analysis (see coordinate-generation-gap-analysis.md)
  const testMolecules = {
    // SIMPLE
    benzene: 'c1ccccc1',
    ethanol: 'CCO',
    glucose: 'C(C1C(C(C(C(O1)O)O)O)O)O',
    
    // DRUGS
    aspirin: 'CC(=O)Oc1ccccc1C(=O)O',
    caffeine: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
    ibuprofen: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
    
    // AROMATICS
    naphthalene: 'c1ccc2ccccc2c1',
    anthracene: 'c1ccc2cc3ccccc3cc2c1',
    phenanthrene: 'c1ccc2c(c1)ccc3ccccc23',
    pyrene: 'c1ccc2c(c1)ccc3c2ccc4c3cccc4',
    
    // HETEROCYCLES
    quinoline: 'c1ccc2ncccc2c1',
    indole: 'c1ccc2c(c1)cc[nH]2',
    purine: 'c1[nH]cnc2c1ncn2',
    pyridine: 'c1ccncc1',
    furan: 'c1ccoc1',
    thiophene: 'c1ccsc1',
    
    // COMPLEX
    morphine: 'CN1CCC23C4C1CC5=C2C(=C(C=C5)O)OC3C(C=C4)O',
    codeine: 'CN1CC[C@]23[C@@H]4Oc5c3c(ccc5OC)[C@@H]1C[C@@H]2C=C[C@@H]4O',
    testosterone: 'C[C@]12CC[C@H]3[C@@H](C1)CC[C@@H]4[C@@H]3CCC4=O',
    camphor: 'CC1(C)C2CCC1(C)C(=O)C2',
    
    // UNUSUAL
    adamantane: 'C1C2CC3CC1CC(C2)C3',
    cubane: 'C12C3C4C1C5C4C3C25',
    norbornane: 'C1CC2CCC1C2',
    strychnine: 'C1CN2CC3=CCO[C@H]4CC(=O)N5[C@H]6[C@H]4[C@H]3C[C@H]2[C@@]61C7=CC=CC=C75',
  };
  
  for (const [name, smiles] of Object.entries(testMolecules)) {
    test(`renders ${name} without overlaps`, () => {
      const mol = parseSMILES(smiles).molecules[0];
      const coords = generateCoordinates2D(mol);
      
      // 1. Check no atom overlaps
      const overlaps = detectAtomOverlaps(coords, mol, 15);
      expect(overlaps).toHaveLength(0);
      
      // 2. Check bond lengths within tolerance
      for (const bond of mol.bonds) {
        const c1 = coords[bond.atom1];
        const c2 = coords[bond.atom2];
        const dist = distance(c1, c2);
        expect(dist).toBeGreaterThan(30);
        expect(dist).toBeLessThan(40);
      }
      
      // 3. Check ring planarity (variance in angles should be small)
      if (mol.rings && mol.rings.length > 0) {
        for (const ring of mol.rings) {
          const angles = computeInteriorAngles(ring, coords);
          const variance = computeVariance(angles);
          expect(variance).toBeLessThan(200); // degrees²
        }
      }
      
      // 4. Save SVG for manual inspection
      const svg = renderSVG(mol, { coordinateEngine: 'v2' });
      fs.writeFileSync(`test-output/${name}-v2.svg`, svg.svg);
    });
  }
});
```

### Step 14: Performance Benchmarks

**File**: `test/performance/coordinate-layout-benchmark.test.ts`

```typescript
describe('coordinate generation performance', () => {
  test('benchmark legacy vs v2 on 100 molecules', () => {
    const molecules = loadTestSet('pubchem-100.txt');
    
    // Benchmark legacy
    const startLegacy = performance.now();
    for (const mol of molecules) {
      generateCoordinates(mol, { coordinateEngine: 'legacy' });
    }
    const timeLegacy = performance.now() - startLegacy;
    
    // Benchmark v2
    const startV2 = performance.now();
    for (const mol of molecules) {
      generateCoordinates2D(mol);
    }
    const timeV2 = performance.now() - startV2;
    
    console.log(`Legacy: ${timeLegacy}ms (${timeLegacy/molecules.length}ms/mol)`);
    console.log(`V2: ${timeV2}ms (${timeV2/molecules.length}ms/mol)`);
    console.log(`Speedup: ${(timeLegacy/timeV2).toFixed(2)}x`);
    
    // Assert: v2 should be comparable or faster
    expect(timeV2).toBeLessThan(timeLegacy * 1.2);
  });
});
```

### Step 15: Integration Tests

```bash
# Run all tests with new engine
bun test

# Run specific test suites
bun test test/svg/
bun test test/unit/coordinate-generator-v2/

# Visual comparison
bun test test/svg/coordinate-generator-v2.test.ts
open test-output/*.svg
```

---

## Phase 4: Documentation & Cleanup

### Step 16: Update Documentation

**File**: `docs/coordinate-generation-v2.md` (new)
- Architecture overview
- Algorithm explanations
- API reference
- Examples

**File**: `README.md`
- Add note about improved 2D layout system
- Mention removal of webcola dependency

**File**: `CHANGELOG.md`
```markdown
## [0.3.0] - 2025-XX-XX

### Added
- New template-based 2D coordinate generation system
- Better handling of fused ring systems (phenanthrene, pyrene, morphine)
- Deterministic layout algorithm (same molecule → same coordinates)

### Removed
- **BREAKING**: Removed webcola dependency
- Old force-directed layout (use `coordinateEngine: 'legacy'` for compatibility)

### Improved
- Faster coordinate generation (2-3x speedup on average)
- Smaller bundle size (~100KB reduction)
- Better visual quality for complex polycyclic molecules

### Migration Guide
If you need the old behavior temporarily, use:
```typescript
renderSVG(molecule, { coordinateEngine: 'legacy' })
```
This will be removed in v1.0.0.
```

### Step 17: Code Cleanup

1. **Mark legacy code as deprecated**:
   ```typescript
   /**
    * @deprecated Use generateCoordinates2D instead. Will be removed in v1.0.0.
    */
   export function refineCoordinatesWithWebcola(...) { ... }
   ```

2. **Add migration period**:
   - Keep legacy code for 2-3 versions
   - Add console warning when `coordinateEngine: 'legacy'` is used
   - Remove in next major version

3. **Clean up unused code**:
   - Remove unused force calculation functions
   - Consolidate coordinate type definitions
   - Remove temporary debugging code

---

## Key Design Decisions

### 1. Rigid Groups vs Fixed Atoms

**Decision**: Use **fixed atoms** initially, upgrade to rigid body dynamics if needed.

**Rationale**:
- Simpler implementation
- Sufficient for most cases
- Can add rigid body dynamics later without breaking API

### 2. Template Library Scope

**Decision**: Start with **regular polygons only**, add fused templates incrementally.

**Rationale**:
- Regular polygons + alignment algorithm covers 95% of cases
- Fused templates are optimization, not requirement
- Can add naphthalene, phenanthrene templates later based on usage

**Canonicalization Challenge**: Templates must match **structural patterns**, not specific atom orderings, since the same ring can have multiple SMILES representations.

### 3. Relaxation Algorithm

**Decision**: Use **Velocity Verlet** with damping, not Euler integration.

**Rationale**:
- Better stability (energy-conserving)
- Fewer iterations needed
- Standard in molecular dynamics

### 4. Performance: Spatial Hashing

**Decision**: Implement **spatial hashing** for repulsion force calculation.

**Rationale**:
- O(n²) is too slow for molecules >100 atoms
- Spatial hashing reduces to O(n log n)
- Simple grid-based approach sufficient

### 5. Determinism

**Decision**: Make algorithm **fully deterministic** (no randomness).

**Rationale**:
- Easier testing (same input → same output)
- Reproducible bug reports
- Predictable behavior for users

### 6. Canonicalization Independence

**Decision**: Algorithm must work correctly **regardless of atom ordering** in input SMILES.

**Rationale**:
- Same molecule can have many SMILES representations
- User input is unpredictable
- Different parsers may order atoms differently
- Template matching must use structural invariants, not atom sequences

**Implementation**:
- Use set operations for atom/ring comparisons
- Identify shared edges by bond connectivity, not position
- Match patterns by topology (graph invariants), not atom IDs
- Never assume specific atom ordering in rings

---

## Edge Cases & Handling

**Validation**: ✅ Plan tested against 27 diverse molecules (see `coordinate-generation-gap-analysis.md`)
- Coverage: 26/27 fully handled (96%)
- Critical gaps: None
- Minor enhancements: Heteroatom bond lengths (cosmetic)

### 1. Multiple Shared Edges (Bridged Systems)

**Example**: Adamantane has atoms in 3+ rings
```
Shared atoms may form multiple edges
Need to pick one canonical edge for alignment
```

**Solution**:
```typescript
function selectCanonicalSharedEdge(sharedAtoms: number[], bonds: Bond[]): [number, number] {
  // Find all bonded pairs among shared atoms
  const bondedPairs = findAllBondedPairs(sharedAtoms, bonds);
  
  // Pick lowest-ID pair for determinism
  bondedPairs.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  return bondedPairs[0]!;
}
```

### 2. Spiro Systems (Single Shared Atom)

**Example**: Spiro[4.5]decane
```
Two rings share exactly 1 atom
No shared edge to align
```

**Solution**:
```typescript
function placeSpiroRing(
  placedRing: Ring,
  spiroRing: Ring,
  spiroAtom: number,
  coords: Map<number, Vec2>
): void {
  // Generate template for spiro ring
  const template = getRingTemplate(spiroRing.size, bondLength);
  
  // Find spiro atom position in template
  const spiroIdx = spiroRing.atomIds.indexOf(spiroAtom);
  const templateSpiro = template[spiroIdx]!;
  
  // Compute translation to align spiro atoms
  const targetPos = coords.get(spiroAtom)!;
  const translation = sub(targetPos, templateSpiro);
  
  // Apply translation to all atoms
  for (let i = 0; i < spiroRing.atomIds.length; i++) {
    const atomId = spiroRing.atomIds[i]!;
    if (atomId !== spiroAtom) {
      coords.set(atomId, add(template[i]!, translation));
    }
  }
  
  // Optional: rotate ring to minimize overlap with existing structure
  optimizeSpiroOrientation(spiroRing, coords);
}
```

### 3. Macrocycles (Large Rings)

**Example**: Crown ethers, porphyrins
```
Rings with >8 atoms don't fit regular polygon well
May need distortion or special templates
```

**Solution**:
```typescript
function getRingTemplate(size: number, bondLength: number): Vec2[] {
  if (size <= 8) {
    return regularPolygon(size, bondLength);
  }
  
  // For large rings, use relaxed geometry
  const template = regularPolygon(size, bondLength);
  
  // Optional: pre-relax large ring to reduce strain
  if (size > 12) {
    return relaxLargeRing(template, size);
  }
  
  return template;
}
```

### 4. Non-Adjacent Shared Atoms

**Example**: Bridged rings where shared atoms are not neighbors in ring ordering
```
Ring A: [1, 2, 3, 4, 5]
Ring B: [3, 6, 7, 8, 1]
Shared: {1, 3} but not adjacent in either ring
```

**Solution**:
```typescript
function findSharedEdge(ring1: Ring, ring2: Ring, bonds: Bond[]): [number, number] | null {
  const shared = findSharedAtoms(ring1, ring2);
  
  // Try to find bonded pair
  const edge = findBondedPair(shared, bonds);
  if (edge) return edge;
  
  // Fallback: bridged system, pick atoms that are closest in ring A ordering
  const ring1Indices = shared.map(id => ring1.atomIds.indexOf(id));
  ring1Indices.sort((a, b) => a - b);
  
  // Pick first two atoms in ring1's ordering
  return [
    ring1.atomIds[ring1Indices[0]!]!,
    ring1.atomIds[ring1Indices[1]!]!
  ];
}
```

### 5. Different SMILES for Same Molecule

**Example**: Benzene
```
c1ccccc1        → atoms [0,1,2,3,4,5]
C1=CC=CC=C1     → atoms [0,1,2,3,4,5] (different aromaticity)
c1cc(ccc1)      → atoms [0,1,2,3,4,5] (different ordering)
```

**Testing**:
```typescript
test('same molecule, different SMILES → equivalent geometry', () => {
  const smiles = ['c1ccccc1', 'C1=CC=CC=C1', 'c1cc(ccc1)'];
  const geometries = smiles.map(s => {
    const mol = parseSMILES(s).molecules[0]!;
    return generateCoordinates2D(mol);
  });
  
  // Check all geometries are congruent (same up to rotation/reflection/translation)
  for (let i = 1; i < geometries.length; i++) {
    expect(isCongruent(geometries[0], geometries[i], mol)).toBe(true);
  }
});

function isCongruent(
  coords1: MoleculeCoordinates,
  coords2: MoleculeCoordinates,
  molecule: Molecule
): boolean {
  // Compute ring centers and radii
  const ring = molecule.rings![0]!;
  const center1 = computeCenter(ring, coords1);
  const center2 = computeCenter(ring, coords2);
  
  const radius1 = computeRadius(ring, coords1, center1);
  const radius2 = computeRadius(ring, coords2, center2);
  
  // Radii should match (geometry is same size)
  return Math.abs(radius1 - radius2) < 1.0;
}
```

### 6. Four-Membered Rings (Cubane)

**Example**: Cubane (C₈H₈) has 5 fused 4-membered rings in cubic cage
```
4-membered rings: 90° interior angles (highly strained)
Normal tetrahedral: 109.5° angles
```

**Solution**: Regular square polygon (no special handling needed)
```typescript
function getRingTemplate(size: number, bondLength: number): Vec2[] {
  // Works for all ring sizes including 4-membered
  return regularPolygon(size, bondLength);
}

// For size=4: creates square with 90° angles
// This correctly represents chemical strain
```

**Testing**:
```typescript
test('cubane geometry', () => {
  const cubane = parseSMILES('C12C3C4C1C5C4C3C25').molecules[0]!;
  const coords = generateCoordinates2D(cubane);
  
  // Verify all rings are squares (±2% tolerance)
  for (const ring of cubane.rings!) {
    if (ring.size === 4) {
      expect(isRegularPolygon(ring, coords, 4, 0.02)).toBe(true);
    }
  }
});
```

### 7. Large Rings in Fused Systems (7-8 membered)

**Example**: Codeine has 6+7 and 7+8 fused rings
```
When ring size differs by ≥2:
  - Standard edge alignment may cause overlap
  - Need rotation optimization
```

**Solution**: Optimize rotation angle for large size mismatches
```typescript
function placeFusedRing(
  placedRing: Ring,
  newRing: Ring,
  sharedEdge: [number, number],
  coords: Map<number, Vec2>
): void {
  // ... standard edge alignment ...
  
  // For large size mismatch, optimize rotation
  const sizeDiff = Math.abs(placedRing.size - newRing.size);
  if (sizeDiff >= 2) {
    const optimalAngle = optimizeRotationForSizeMismatch(
      placedRing,
      newRing,
      sharedEdge,
      coords
    );
    rotateRing(newRing, coords, sharedEdge, optimalAngle);
  }
}

function optimizeRotationForSizeMismatch(
  ring1: Ring,
  ring2: Ring,
  pivot: [number, number],
  coords: Map<number, Vec2>
): number {
  // Try rotations in 15° increments
  // Pick angle that minimizes overlap with existing structure
  let bestAngle = 0;
  let minOverlap = Infinity;
  
  for (let angle = 0; angle < 360; angle += 15) {
    const overlap = computeOverlap(ring2, coords, angle);
    if (overlap < minOverlap) {
      minOverlap = overlap;
      bestAngle = angle;
    }
  }
  
  return bestAngle;
}
```

**Testing**:
```typescript
test('codeine large fused rings', () => {
  const codeine = parseSMILES('CN1CC[C@]23[C@@H]4Oc5c3c(ccc5OC)[C@@H]1C[C@@H]2C=C[C@@H]4O').molecules[0]!;
  const coords = generateCoordinates2D(codeine);
  
  // Verify no severe overlaps
  const minDist = computeMinNonBondedDistance(coords, codeine);
  expect(minDist).toBeGreaterThan(0.6 * bondLength);
});
```

---

## Expected Outcomes

### ✅ Visual Quality Improvements

**Before** (webcola):
- Rings can become ellipses
- Fused rings misalign
- Bond angles vary widely
- Unpredictable layouts

**After** (v2):
- Rings are perfect polygons
- Fused rings align correctly on shared edges
- Bond angles consistent (±5°)
- Deterministic, predictable layouts

### ✅ Performance Improvements

| Metric | Legacy (webcola) | V2 (template-based) | Improvement |
|--------|------------------|---------------------|-------------|
| Small molecules (<20 atoms) | ~15ms | ~5ms | **3x faster** |
| Medium molecules (20-50 atoms) | ~50ms | ~20ms | **2.5x faster** |
| Large molecules (50-100 atoms) | ~200ms | ~80ms | **2.5x faster** |
| Complex fused (pyrene, morphine) | ~100ms | ~40ms | **2.5x faster** |

### ✅ Bundle Size Reduction

- Remove webcola: **~100KB** (minified)
- Add v2 code: **~15KB** (minified)
- **Net savings**: ~85KB

### ✅ Code Quality

- **Before**: 1 file (197 lines) + webcola black box
- **After**: 8 modular files (~1200 lines total)
- Clear separation of concerns
- Testable components
- Well-documented algorithms

---

## Risk Mitigation

### Risk 1: Breaking Changes

**Mitigation**:
- Keep legacy code path with feature flag
- Add migration period (2-3 versions)
- Provide clear migration guide
- Add console warnings

### Risk 2: Visual Regressions

**Mitigation**:
- Comprehensive visual tests (50+ molecules)
- Side-by-side comparison tool
- Gradual rollout (opt-in initially)
- Collect user feedback

### Risk 3: Performance Regressions

**Mitigation**:
- Benchmark on 1000+ molecules
- Profile hot paths
- Add performance tests to CI
- Spatial hashing for large molecules

### Risk 4: Edge Cases

**Mitigation**:
- Test on diverse molecule set
- Include pathological cases (cages, macro-cycles)
- Add defensive error handling
- Fallback to simpler algorithm if needed

### Risk 5: Missing Features

**Mitigation**:
- Feature parity checklist
- Compare outputs on known molecules
- User acceptance testing
- Iterative improvements

---

## Timeline Estimate

### Week 1: Core Implementation
- **Days 1-2**: Types, geometry utils, ring detection
- **Days 3-4**: Ring templates, fused ring placer
- **Day 5**: Substituent placer

### Week 2: Relaxation & Integration
- **Days 1-2**: Constrained relaxer, overlap resolver
- **Day 3**: Main pipeline integration
- **Days 4-5**: SVG renderer integration, testing

### Week 3: Testing & Polish
- **Days 1-2**: Unit tests, visual regression tests
- **Day 3**: Performance benchmarks
- **Days 4-5**: Bug fixes, edge cases

### Week 4: Documentation & Release
- **Days 1-2**: Documentation, examples
- **Day 3**: Migration guide, CHANGELOG
- **Day 4**: Remove webcola, final testing
- **Day 5**: Release, monitor feedback

**Total**: ~4 weeks of focused work

---

## Success Criteria

### Must Have ✅
- [ ] All existing SVG tests pass with new engine
- [ ] No visual regressions on 100+ test molecules
- [ ] Performance equal or better than legacy
- [ ] Webcola dependency removed
- [ ] Documentation complete

### Should Have 🎯
- [ ] Fused rings (naphthalene, phenanthrene) render perfectly
- [ ] Complex polycyclics (pyrene, morphine) render correctly
- [ ] Deterministic layouts (same SMILES → same coords)
- [ ] 2x+ speedup on average
- [ ] Bundle size reduced by 80KB+

### Nice to Have 🌟
- [ ] Fused template library (common patterns)
- [ ] Rigid body dynamics (not just fixed atoms)
- [ ] 3D → 2D projection for stereo molecules
- [ ] Interactive layout tuning UI

---

## Next Steps

1. **Review this plan** with team
2. **Create GitHub issues** for each phase
3. **Set up project board** (Kanban)
4. **Allocate resources** (developer time)
5. **Start implementation** (Phase 1, Step 1)

---

## References

### Academic Papers
- Helson, H. E. "Structure Diagram Generation" (1999)
- Clark, A. M. "2D Depiction of Chemical Structures" (2006)
- Fricker, P. C. "Automated Layout of Small Molecules" (2004)

### Existing Tools
- RDKit: Uses Schrodinger's 2D coordinate generation
- CDK: Template-based + force-directed refinement
- OpenChemLib: Fast heuristic placement
- Indigo: Commercial-quality depiction

### Code References
- `smiles-to-2d.md`: Original design document
- `src/utils/coordinate-generator.ts`: Current implementation
- `src/utils/ring-analysis.ts`: Ring detection utilities

---

---

## Summary: Canonicalization-Independent Design

### The Core Challenge
The same molecule can be represented by multiple SMILES strings with different atom orderings. Our algorithm must produce **geometrically equivalent** layouts regardless of input representation.

### Our Solution Strategy

#### ✅ **Use Structural Features, Not Atom Order**
- Identify shared atoms via set intersection (order-independent)
- Find shared edges via bond connectivity (topology-based)
- Match rings by size, aromaticity, fusion pattern (not atom IDs)

#### ✅ **BFS Placement with Edge Alignment**
- Place rings one-by-one using BFS traversal
- Align each new ring to existing rings via shared edge
- Geometric transform (rotation + translation) preserves correctness

#### ✅ **No Template Dependencies** (Phase 1)
- Use generic regular polygons only
- Template matching is optional optimization (Phase 2)
- Algorithm works for **any** molecule, **any** canonicalization

#### ✅ **Comprehensive Testing**
- Test same molecule with 5+ different SMILES representations
- Assert geometric equivalence (congruent layouts)
- Validate on 100+ molecules with varied inputs

### Example: Naphthalene
```typescript
// All these produce geometrically equivalent layouts:
const smiles = [
  'c1ccc2ccccc2c1',      // start from ring 1
  'c1ccc2c(c1)cccc2',    // start from ring 1, different branch
  'c1cccc2ccccc12',      // start from ring 2
  'C1=CC=C2C=CC=CC2=C1', // explicit bonds
];

// After layout: all have two aligned hexagons (naphthalene geometry)
// Coordinates may differ (rotation/translation), but shape is identical
```

### Why This Works
1. **Set operations** don't care about order
2. **Bond connectivity** is topological (not sequential)
3. **Geometric transforms** are coordinate-based (not ID-based)
4. **BFS traversal** follows molecular structure (not input order)

### When to Use Templates (Optional, Phase 2)
If we add template matching:
- Index templates by **structural invariants** (ring sizes, fusion topology hash, degree sequence)
- Match patterns, not atom sequences
- Use templates as **optimization**, not requirement
- Always have fallback to generic algorithm

---

## Getting Started: Implementation Checklist

Ready to implement? Follow this checklist:

### Prerequisites
- [ ] Read entire plan document (this file)
- [ ] Review `smiles-to-2d.md` design document
- [ ] Understand current `coordinate-generator.ts` code
- [ ] Set up test environment (`bun test`)

### Phase 1: Core (Week 1-2)
- [ ] Create `src/utils/coordinate-generator-v2/` directory
- [ ] Implement `types.ts` (Vec2, RigidGroup, Ring, RingSystem interfaces)
- [ ] Implement `geometry-utils.ts` (vector math, polygon generation)
- [ ] Implement `ring-system-detector.ts` (group rings into fused systems)
- [ ] Implement `fused-ring-placer.ts` (BFS + edge alignment - **KEY ALGORITHM**)
- [ ] Write unit tests for each module
- [ ] Test on benzene, naphthalene, anthracene

### Phase 2: Relaxation (Week 2-3)
- [ ] Implement `substituent-placer.ts` (BFS attachment with angle selection)
- [ ] Implement `constrained-relaxer.ts` (spring/angle/repulsion forces)
- [ ] Implement `overlap-resolver.ts` (collision detection & fixes)
- [ ] Implement `index.ts` (pipeline orchestrator)
- [ ] Test on complex molecules (pyrene, morphine, steroids)

### Phase 3: Integration (Week 3)
- [ ] Add `coordinateEngine` option to `SVGRendererOptions`
- [ ] Update `svg-renderer.ts` to use new engine
- [ ] Keep legacy path with feature flag
- [ ] Run full test suite (`bun test`)
- [ ] Fix any regressions

### Phase 4: Cleanup (Week 4)
- [ ] Visual regression tests (50+ molecules)
- [ ] Performance benchmarks
- [ ] Remove webcola dependency
- [ ] Update documentation
- [ ] Create PR with examples

### Critical Success Factors
1. **Test canonicalization independence**: Same molecule with 5 different SMILES must produce equivalent geometry
2. **Validate edge alignment**: Fused rings must share edges correctly (no gaps, no overlaps)
3. **Measure performance**: New system must be equal or faster than webcola
4. **Visual quality**: Rings must look like perfect polygons, not distorted

### Visual Algorithm Flow

```
INPUT: Molecule (atoms, bonds, rings)
   ↓
┌─────────────────────────────────────┐
│ 1. Detect & Group Ring Systems     │
│    - Find SSSR rings                │
│    - Group by shared atoms (≥2)     │
│    - Classify: isolated/fused/spiro │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 2. Place Ring Systems (BFS)        │
│                                     │
│   Place Ring A (seed)               │
│   ┌─────┐                           │
│   │  A  │  regular hexagon          │
│   └─────┘                           │
│                                     │
│   Find shared edge [atom1, atom2]   │
│   ┌─────┬─────┐                     │
│   │  A  │  B  │  align Ring B       │
│   └─────┴─────┘  via edge           │
│                                     │
│   Find next shared edge             │
│   ┌─────┐                           │
│   │  A  │─────┐                     │
│   └─────┴──┐  │  align Ring C       │
│      │  B  │  │  to Ring B          │
│      └─────┴──┘                     │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 3. Attach Substituents (BFS)       │
│    - Start from ring atoms          │
│    - Compute free angles            │
│    - Place at bondLength distance   │
│                                     │
│   ┌─────┐                           │
│   │Ring │─CH₃  substituents         │
│   └─────┘                           │
│      │                              │
│     CH₂                             │
│      │                              │
│     CH₃                             │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 4. Constrained Relaxation          │
│    - Ring atoms: FIXED              │
│    - Substituents: FLEXIBLE         │
│    - Apply spring/angle/repulsion   │
│    - 50-300 iterations              │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 5. Post-process Overlaps           │
│    - Detect atom collisions         │
│    - Push flexible atoms apart      │
│    - Offset labels                  │
└─────────────────────────────────────┘
   ↓
OUTPUT: Coordinates (x, y) for each atom
```

### Questions? Stuck?
- Review "Canonicalization Challenge & Solution" section
- Check "Edge Cases & Handling" section
- Look at existing `layoutFusedRings()` function for inspiration
- Test with multiple SMILES for same molecule
- Ping maintainer: @rajeshg

---

**Document Version**: 1.1  
**Last Updated**: 2025-11-22  
**Status**: Ready for Implementation  
**Key Update**: Added comprehensive canonicalization handling strategy
