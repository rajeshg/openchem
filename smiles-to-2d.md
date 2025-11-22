Below is a pragmatic, implementation-ready strategy you can take into TypeScript to convert SMILES → clean 2D SVG with minimal overlaps. It mixes chemistry heuristics, geometric templates for rigid pieces (especially rings), and a constrained force-layout to tidy substituents. I include algorithm steps, data structures, heuristics, and small TypeScript-style pseudocode / snippets you can drop into a real implementation.
---
# SMILES → 2D SVG (Implementation guide)

A pragmatic, implementation-ready strategy (TypeScript-first) for converting SMILES → clean 2D SVG with minimal overlaps.

This mixes chemistry heuristics, geometric templates for rigid pieces (especially rings), and a constrained force-layout step to tidy up substituents and reduce collisions. The document includes step-by-step stages, useful heuristics, compact TypeScript-ready interfaces and small code snippets you can drop into a renderer.

---

## Quick summary — one sentence

Parse SMILES → construct graph → detect rings/fused systems → place rigid templates → attach substituents deterministically → constrained relaxation (freeze rings) → produce crisp SVG.
## Key ideas & trade-offs ✅

- Treat rings and fused-ring systems as (mostly) rigid backbones — they anchor the layout and give chemically-intuitive shapes.
- Use precomputed templates for common fragments (benzene, pyridine, small fused motifs) to reduce arbitrary deformation and overlap.
- Use deterministic rules for attaching substituents (hybridization-aware angles) and then run a short constrained relaxation to remove collisions.
- Keep rigid groups frozen for deformation — allow them to translate/rotate only. If impossible overlaps occur (edge-case), temporarily allow a small rotation and re-relax.
- Render consistently: standard bond length, scale strokes and font-size relative to viewBox, and hide carbon labels by default.
---

## Pipeline (concrete stages)

The following pipeline is deliberately modular — implement in small incremental steps.

### 1) Parse SMILES → graph

Use a SMILES parser (internal or a library) to produce:

- atoms: element, charge, isotope, stereo info, implicit H count
- bonds: atom ids, order, stereo
- (optional) ring membership (SSSR or similar)

Then build adjacency lists and canonical atom indexing.
### 2) Graph analysis

- Detect cycles / rings (SSSR or another cycle basis).
- Group rings into ring-systems (connected fused/bridged rings) — we will treat these as rigid units.
- Annotate atoms with hybridization (sp/sp2/sp3) and aromaticity when available.
- Identify substituent trees and branch points.
### 3) Select backbones / rigid pieces

- Mark rings and fused ring-systems as rigid groups.
- Optionally mark rigid functional groups (e.g., planar C=O, aromatic systems) as semi-rigid.
### 4) Embed rigid templates

- Place each ring or fused-system using a geometric template (regular polygons for simple rings, fused templates for common motifs).
- Scale templates to a consistent `BOND_LEN` (35–50 px recommended).
- Place larger / more-connected ring-systems first to reduce movement after placement.

> Important: when attaching fused rings, pick the adjacent *shared bond* (two adjacent ring atoms) in the ring ordering — picking arbitrary shared atoms is a common source of bad geometry.
### 5) Attach substituents

- For each anchored atom (usually ring atoms) compute outward attachment directions that avoid interior ring bonds.
- Place substituent atoms deterministically at `BOND_LEN` distance using hybridization-aware angles.
- For branching: split the free-angle wedge into equal parts and place child branches.
- Linear chains: use canonical zig-zag geometry for sp3 chains to avoid self-overlap.
### 6) Constrained relaxation (short & focused)

- Run a constrained force-relax solver using:
  - spring/bond forces (keep bonds close to `BOND_LEN`)
  - angle bias potentials (softly push toward ideal angles)
  - short-range repulsion for collisions
- Keep rigid groups (ring systems) locked against deformation — allow them translation/rotation only.
- Project bond lengths occasionally to stabilize the system.
- Limit iterations (50–300 typical). Tune to molecule complexity.
### 7) Overlap postprocessing

- Detect remaining collisions and label overlaps.
- Apply targeted local fixes: push flexible atoms away, or selectively unlock rigid blocks and re-relax (small rotation only).
- Handle label collisions using offset along the largest free-space bisector.
### 8) Render as SVG

- Compute viewBox with margin and scale to fit geometry.
- Draw bonds: normal lines; double/triple bonds as offset parallel lines.
- Stereochemistry: filled wedges or hashed wedges for up/down stereobonds.
- Aromatic rings: optional inner circle or dotted styling.
- Labels: show non-carbon atoms by default; show carbon labels only when required.

---
Data structures (TypeScript interfaces)
type Vec2 = { x: number; y: number };

interface Atom {
  id: number;
  element: string;        // "C", "O", etc.
  charge?: number;
  implicitH?: number;
  hybridization?: 'sp'|'sp2'|'sp3'|'unknown';
  aromatic?: boolean;
  stereo?: string|null;
  coord?: Vec2;           // 2D coords will be filled
  fixed?: boolean;        // if part of rigid template entirely fixed
  rigidGroup?: number|null; // ID of rigid body (ring system)
}

interface Bond {
  id: number;
  a: number; // atom id
  b: number; // atom id
  order: 1|2|3|1.5; // 1.5 for aromatic if needed
  stereo?: 'up'|'down'|null;
}

interface Molecule {
  atoms: Atom[];
  bonds: Bond[];
  rings?: Ring[];        // computed
}

interface Ring {
  id: number;
  atomIds: number[];     // cycle in order
  type?: 'aromatic'|'aliphatic'|'unknown';
  rigidGroupId?: number;
}
---

## Important heuristics (practical) ⚖️

- BOND_LEN: default 36 px (tune to taste).
- Angle biases: sp2 ≈ 120°, sp ≈ 180°, sp3 ≈ 109.5° projected (~109° in 2D).
- Place larger/fused rings first.
- Hide carbon labels unless needed.
- Collision cutoff: minDist ≈ 0.7 × (BOND_LEN / 2).
- Rigid-group flexibility: allow ±5°–15° rotation for very tight fused conflicts (prefer rigid, minor rotation only).
Algorithms: ring detection & embedding (pseudocode)
### Ring embedding notes

- Use SSSR / cycle detection to find ring membership and ring-systems.
- Template placement: vertices of a regular n-gon with circumradius r satisfying edge ≈ BOND_LEN.
- For fused rings, align using the actual shared bond (adjacent shared atoms in ring order) and compute rotation+translation to connect them logically — avoid picking non-adjacent shared atoms.
---

## Minimal TypeScript snippets (examples)

Basic utility — regular polygon ring coordinates:
function polygonRingCoords(n: number, bondLen: number, center: Vec2 = {x:0,y:0}) : Vec2[] {
  // edge length s between adjacent vertices relates to radius r: s = 2*r*sin(pi/n)
  const r = bondLen / (2 * Math.sin(Math.PI / n));
  const coords: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i / n) - Math.PI/2; // start at top
    coords.push({ x: center.x + r * Math.cos(theta), y: center.y + r * Math.sin(theta) });
  }
  return coords;
}
Simple spring relaxation loop (skeleton):
function relax(mol: Molecule, options: {bondLen:number, iterations:number}) {
  const dt = 0.2;
  // initialize velocities, masses
  const vel = new Map<number, Vec2>();
  for (const atom of mol.atoms) vel.set(atom.id, {x:0,y:0});

  for (let iter = 0; iter < options.iterations; iter++) {
    // zero forces
    const forces = new Map<number, Vec2>();
    for (const a of mol.atoms) forces.set(a.id, {x:0,y:0});

    // bond springs
    for (const b of mol.bonds) {
      const A = mol.atoms[b.a];
      const B = mol.atoms[b.b];
      const pA = A.coord!, pB = B.coord!;
      let dx = pB.x - pA.x, dy = pB.y - pA.y;
      const dist = Math.hypot(dx, dy) || 1e-6;
      const target = options.bondLen;
      const k = 0.2; // spring constant
      const f = k * (dist - target);
      dx /= dist; dy /= dist;
      // apply equal and opposite unless fixed
      if (!A.fixed) {
        const fA = forces.get(A.id)!; fA.x += dx * f; fA.y += dy * f;
      }
      if (!B.fixed) {
        const fB = forces.get(B.id)!; fB.x -= dx * f; fB.y -= dy * f;
      }
    }

    // repulsion (cheap version, only nearby pairs)
    for (let i=0;i<mol.atoms.length;i++){
      for (let j=i+1;j<mol.atoms.length;j++){
        const A = mol.atoms[i], B = mol.atoms[j];
        if (/* skip bonded or same rigidGroup */) continue;
        const dx = B.coord!.x - A.coord!.x;
        const dy = B.coord!.y - A.coord!.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const minD = options.bondLen * 0.5;
        if (d < minD) {
          const mag = (minD - d) * 0.6;
          const ux = dx / d, uy = dy / d;
          if (!A.fixed) { const fA = forces.get(A.id)!; fA.x -= ux*mag; fA.y -= uy*mag; }
          if (!B.fixed) { const fB = forces.get(B.id)!; fB.x += ux*mag; fB.y += uy*mag; }
        }
      }
    }

    // integrate velocities and positions for non-fixed atoms
    for (const atom of mol.atoms) {
      if (atom.fixed) continue;
      const f = forces.get(atom.id)!;
      const v = vel.get(atom.id)!;
      v.x = (v.x + f.x * dt) * 0.9; // damping
      v.y = (v.y + f.y * dt) * 0.9;
      atom.coord!.x += v.x * dt;
      atom.coord!.y += v.y * dt;
    }

    // optional: project bonds to exact length every N iterations
    if (iter % 10 === 0) projectBondLengths(mol, options.bondLen);
  }
}

> Note: the relaxer shown in the examples is intentionally simple. For production use, replace with a robust constrained solver or fine-tune constants (spring/angle/repulsion) and use spatial hashing for performance.
## SVG rendering hints

- Use `viewBox` and `preserveAspectRatio="xMidYMid meet"`.
- Double/triple bonds: parallel offsets perpendicular to bond vector.
- Wedges/dashes: filled polygon for solid wedge; hashed short lines for dashed wedge.
- Keep strokes crisp: `stroke-linecap="round"`, `stroke-linejoin="round"`.
- Expose `showImplicitH`, `atomLabelStrategy`, `bondLengthPx` as user options.
Example: SVG line for bond with offset for double:
function bundleLinePoints(a: Vec2, b: Vec2, offset = 0) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy/len, ny = dx/len;
  return {
    p1: { x: a.x + nx*offset, y: a.y + ny*offset },
    p2: { x: b.x + nx*offset, y: b.y + ny*offset },
  };
}
## Handling tricky cases — practical notes

- Fused polyaromatics (phenanthrene, pyrene): build fused templates and mark the system rigid. Stitch rings by shared edges.
- Bridged systems / cage molecules (morphine, steroids): provide specialized templates or allow semi-rigid templates for small distortions.
- Stereobonds: compute wedge geometry based on neighboring bond vectors (or use 3D → 2D projection when available).
- Large chains: canonical zig-zag and relaxation prevents chains folding onto the core.
- Label collisions: check bounding boxes and shift labels along an outward bisector.
## Practical implementation notes & libraries

- Reuse an existing SMILES parser if you want (OpenChemLib JS, RDKit JS, SmilesDrawer). The layout pipeline above is independent of the parser.
- Implement incrementally: template placement → substituent attachment → constrained relaxation → rendering.
- Export options: `svg` or rasterize with canvas if you need PNGs.
## Performance & complexity

- Ring/template embedding: O(#rings + edges in rings).
- Relaxation: naive O(n^2); use spatial hashing / quadtree to reduce neighbor searches.
- Memory: lightweight — coordinates, arrays, and caches.
## Quick checklist ✅

- [ ] Parser → graph (atoms, bonds, aromatic flags)
- [ ] Ring detection -> ring-system grouping
- [ ] Template library for common rings & fused motifs
- [ ] Deterministic substituent placement rules
- [ ] Constrained relaxer with rigid groups
- [ ] Collision detection (spatial hashing)
- [ ] SVG generator (bonds, wedges, labels)
- [ ] Visual unit tests for representative molecules
## Suggested parameter defaults (starting point)

| param | typical | notes |
|---|---:|---|
| BOND_LEN | 36 px | base unit for rendering & layout |
| ITERATIONS | 50–300 | constrained relax passes; larger molecules need more |
| ANGLE_WEIGHT | ~0.15 | angle potential weight |
| SPRING_K | ~0.2 | bond spring strength |
| REPULSION_MAG | ~0.6 | collision repulsion magnitude |
| RING_ROTATION_TOLERANCE | 5°–15° | allow small unlock rotations in corner cases |
---

## Next steps — which direction would you like? 🚀

I can:

- implement a small POC TypeScript module (no external deps) that demonstrates this pipeline, or
- integrate these improvements into the existing renderer (`src/utils/coordinate-generator.ts` and `src/utils/force-directed-layout.ts`) and create visual tests for common fused aromatics (phenanthrene, pyrene) and complex natural products (morphine).

Tell me which you'd prefer and I’ll implement it next.
You said:
Assume parsing is take care of. https://github.com/rajeshg/openchem/blob/368eeb3884e8f625fc6a409c6a9e67effbade44d/types.ts#L60


Come up with code for how to generate svg 
ChatGPT said:

Thought for a few seconds
Nice — below is a complete, self-contained TypeScript module you can drop into your project (assumes parsing is already done and the Molecule, Atom, Bond, Ring types are available). It implements the approach we discussed:
Places ring templates as rigid groups
Attaches substituents with local geometry
Runs a constrained relaxation where rings are rigid bodies
Renders crisp SVG (single/double/triple bonds, wedges/dashes, atom labels)
I kept things pragmatic and deterministic so you can test and iterate. Copy/paste, wire to your parsed Molecule and call moleculeToSvg(mol, opts).
Notes / assumptions before code
Parsing is done: the Molecule has atoms, bonds, and an optional rings array (each ring contains ordered atomIds). If rings is missing we fall back to a simple chain embedding.
Atoms have coord?: {x,y} that we will fill.
We treat rings as rigid groups (rigidGroup numeric id).
We do not run a heavy SSSR or ring-perception here — we assume you already produced mol.rings when parsing. If not, plug your ring-detection result into mol.rings.
This is a single-file implementation focused on clarity and correctness for typical small molecules; you can optimize later (spatial hash, better solver, fuse templates).
TypeScript module
// smiles-to-svg.ts
// Dependencies: none (vanilla TypeScript).
// Assumes existence of types similar to earlier message or your repo:
type Vec2 = { x: number; y: number };

interface Atom {
  id: number;
  element: string;        // "C", "O", etc.
  charge?: number;
  implicitH?: number;
  hybridization?: 'sp'|'sp2'|'sp3'|'unknown';
  aromatic?: boolean;
  stereo?: string|null;
  coord?: Vec2;           // will be filled
  fixed?: boolean;
  rigidGroup?: number|null;
  label?: string;         // optional override label
}

interface Bond {
  id: number;
  a: number; // atom id (index)
  b: number; // atom id
  order: 1|2|3|1.5;
  stereo?: 'up'|'down'|null; // wedge/dash
}

interface Ring {
  id: number;
  atomIds: number[]; // ordered cycle
  aromatic?: boolean;
  rigidGroupId?: number;
}

interface Molecule {
  atoms: Atom[];
  bonds: Bond[];
  rings?: Ring[];
}

// Options
interface SvgOptions {
  bondLen?: number; // px
  iterations?: number; // relax iterations
  atomFontSize?: number; // px at base bondLen
  showCarbonLabels?: boolean;
  margin?: number; // px
  width?: number; // svg width attribute (px) optional (keeps aspect ratio)
}

// Public entrypoint
export function moleculeToSvg(mol: Molecule, opts?: SvgOptions): string {
  const config = {
    bondLen: 36,
    iterations: 300,
    atomFontSize: 12,
    showCarbonLabels: false,
    margin: 8,
    width: undefined as number|undefined,
    ...opts
  };

  // Step 0: initialize coords if missing (simple seeding)
  initializeCoords(mol, config.bondLen);

  // Step 1: place ring templates and mark rigid groups
  if (mol.rings && mol.rings.length > 0) {
    placeRingTemplates(mol, config.bondLen);
  }

  // Step 2: attach substituents / embed chains around rigid groups
  attachSubstituents(mol, config.bondLen);

  // Step 3: constrained relaxation (rings rigid)
  relaxPositions(mol, { bondLen: config.bondLen, iterations: config.iterations });

  // Step 4: final overlap cleanups / label placement (small nudges)
  postprocess(mol, config);

  // Step 5: render SVG
  const svg = renderSvg(mol, config);

  return svg;
}

/* -------------------------
   Utilities & layout logic
   ------------------------- */

function initializeCoords(mol: Molecule, bondLen: number) {
  // If coordinates exist, leave them. Else seed:
  // seed strategy: place atoms along a polyline to avoid all-collided startup.
  let anyCoord = mol.atoms.some(a => !!a.coord);
  if (anyCoord) return;

  // simple chain walk: pick atoms by index
  let angle = 0;
  for (let i = 0; i < mol.atoms.length; i++) {
    mol.atoms[i].coord = {
      x: (i % 10) * bondLen * 0.6,
      y: Math.floor(i / 10) * bondLen * 0.9
    };
  }
}

function placeRingTemplates(mol: Molecule, bondLen: number) {
  // For each ring, put atoms at vertices of a regular n-gon scaled so edge ~ bondLen
  // Also assign rigidGroup IDs.
  let nextRigidId = 1;
  const atomById = new Map<number, Atom>();
  for (const a of mol.atoms) atomById.set(a.id, a);

  for (const ring of (mol.rings || [])) {
    const n = ring.atomIds.length;
    if (n < 3) continue;
    const coords = polygonRingCoords(n, bondLen);
    // compute a center placement: if any atom already has coords, align to that atom
    // Prefer to anchor based on the first atom having an existing coordinate.
    let anchorIndex = -1;
    for (let i = 0; i < n; i++) {
      if (atomById.get(ring.atomIds[i])?.coord) { anchorIndex = i; break; }
    }
    let center: Vec2 = { x: 0, y: 0 };
    if (anchorIndex >= 0) {
      const existing = atomById.get(ring.atomIds[anchorIndex])!.coord!;
      const templatePoint = coords[anchorIndex];
      const dx = existing.x - templatePoint.x;
      const dy = existing.y - templatePoint.y;
      center = { x: dx, y: dy }; // shift
    } else {
      // place new ring near origin or offset by nextRigidId to avoid overlap
      center = { x: nextRigidId * bondLen * 1.2, y: 0 };
      // shift polygon coords by center
      for (let i = 0; i < coords.length; i++) {
        coords[i].x += center.x;
        coords[i].y += center.y;
      }
    }

    // Ensure coords have been shifted correctly (if anchorIndex handled above we already shifted via dx/dy)
    if (anchorIndex >= 0) {
      // we already computed shift; need to apply to coords
      const templateShifted = coords.map(p => ({ x: p.x + center.x, y: p.y + center.y }));
      for (let i = 0; i < n; i++) {
        const aid = ring.atomIds[i];
        const atom = atomById.get(aid)!;
        atom.coord = { x: templateShifted[i].x, y: templateShifted[i].y };
        atom.fixed = true;
        atom.rigidGroup = nextRigidId;
      }
    } else {
      for (let i = 0; i < n; i++) {
        const aid = ring.atomIds[i];
        const atom = atomById.get(aid)!;
        atom.coord = { x: coords[i].x, y: coords[i].y };
        atom.fixed = true;
        atom.rigidGroup = nextRigidId;
      }
    }

    ring.rigidGroupId = nextRigidId;
    nextRigidId++;
  }
}

/** regular polygon coordinates for ring of n atoms. Center at (0,0). */
function polygonRingCoords(n: number, bondLen: number): Vec2[] {
  // side length s = bondLen ; circumradius r satisfies s = 2*r*sin(pi/n)
  const r = bondLen / (2 * Math.sin(Math.PI / n));
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i / n) - Math.PI / 2; // start top
    out.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  }
  return out;
}

function attachSubstituents(mol: Molecule, bondLen: number) {
  // We place flexible atoms (non-fixed) relative to their nearest fixed neighbor (usually ring atoms).
  // Strategy:
  //  - Find root nodes: atoms that are fixed (part of ring) or already have coords.
  //  - BFS outward attaching neighbors with simple angle rules.
  const atomById = new Map<number, Atom>();
  for (const a of mol.atoms) atomById.set(a.id, a);

  // adjacency
  const adj = new Map<number, Bond[]>();
  for (const b of mol.bonds) {
    if (!adj.has(b.a)) adj.set(b.a, []);
    if (!adj.has(b.b)) adj.set(b.b, []);
    adj.get(b.a)!.push(b);
    adj.get(b.b)!.push(b);
  }

  // seed queue with fixed atoms
  const q: number[] = [];
  const seen = new Set<number>();
  for (const a of mol.atoms) {
    if (a.coord) {
      q.push(a.id);
      seen.add(a.id);
    }
  }

  // angle helper: pick an outward direction that avoids existing neighbors
  while (q.length > 0) {
    const aid = q.shift()!;
    const a = atomById.get(aid)!;
    const neighbors = (adj.get(aid) || []).map(b => (b.a === aid ? b.b : b.a));
    // compute occupied directions from this atom
    const occupiedAngles: number[] = [];
    for (const nb of neighbors) {
      const atomNb = atomById.get(nb)!;
      if (atomNb.coord) {
        const v = { x: atomNb.coord.x - a.coord!.x, y: atomNb.coord.y - a.coord!.y };
        occupiedAngles.push(Math.atan2(v.y, v.x));
      }
    }

    // Visit neighbors and place those without coords
    for (const nb of neighbors) {
      if (seen.has(nb)) continue;
      const nbAtom = atomById.get(nb)!;
      // compute preferred angle: pick angle that is roughly bisector of largest free wedge
      const angle = pickFreeAngle(occupiedAngles, nbAtom.hybridization);
      // compute position at bondLen distance
      const px = a.coord!.x + Math.cos(angle) * bondLen;
      const py = a.coord!.y + Math.sin(angle) * bondLen;
      nbAtom.coord = { x: px, y: py };
      nbAtom.fixed = false;
      nbAtom.rigidGroup = null;
      seen.add(nb);
      q.push(nb);
      // mark this direction as occupied from parent for next siblings
      occupiedAngles.push(angle);
    }
  }
}

// pick angle away from occupiedAngles; hybridization influences spread preference
function pickFreeAngle(occupied: number[], hybrid?: string|null): number {
  // if no occupied, return random-ish canonical angle
  if (!occupied || occupied.length === 0) {
    return (Math.PI / 6); // arbitrary nice angle ~30deg
  }
  // find largest gap between sorted angles
  const sorted = occupied.slice().sort((a, b) => a - b);
  // duplicate with +2pi to compute wrap gap
  let bestGap = -1, bestStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[(i + 1) % sorted.length] + (i + 1 === sorted.length ? 2 * Math.PI : 0);
    const gap = b - a;
    if (gap > bestGap) { bestGap = gap; bestStart = a; }
  }
  // place at bisector of best gap
  const angle = bestStart + bestGap / 2;
  // bias angles slightly depending on hybridization to match geometry
  if (hybrid === 'sp2') return angle; // ~120 deg geometry handled by attachments
  if (hybrid === 'sp') return angle; // linear
  // sp3 might prefer offset to make zig-zag; add small jitter but deterministic
  return angle;
}

/* -------------------------
   Relaxation (constrained)
   ------------------------- */

interface RelaxOptions { bondLen: number; iterations: number; }

function relaxPositions(mol: Molecule, opts: RelaxOptions) {
  const bondLen = opts.bondLen;
  const iterations = Math.max(50, opts.iterations | 0);

  // build adjacency, bonds keyed by pair for fast checks
  const n = mol.atoms.length;
  const atomIndex = new Map<number, number>();
  for (let i = 0; i < n; i++) atomIndex.set(mol.atoms[i].id, i);

  // velocity map
  const vel: Vec2[] = new Array(n).fill(null).map(_ => ({ x: 0, y: 0 }));

  // helper: get atom by idx
  const atoms = mol.atoms;

  // Precompute bond list with indices
  const bondPairs = mol.bonds.map(b => ({ i: atomIndex.get(b.a)!, j: atomIndex.get(b.b)!, order: b.order }));

  // For repulsion neighbor acceleration we'll use naive O(n^2) for simplicity; optimize later.
  for (let iter = 0; iter < iterations; iter++) {
    const forces: Vec2[] = new Array(n).fill(null).map(_ => ({ x: 0, y: 0 }));

    // bond springs
    for (const bp of bondPairs) {
      const A = atoms[bp.i], B = atoms[bp.j];
      if (!A.coord || !B.coord) continue;
      let dx = B.coord.x - A.coord.x;
      let dy = B.coord.y - A.coord.y;
      const dist = Math.hypot(dx, dy) || 1e-6;
      const target = bondLen * (1.0 + (bp.order === 2 ? -0.02 : bp.order === 3 ? -0.04 : 0)); // slight shorten for multiple bonds
      const k = 0.15; // spring constant
      const f = k * (dist - target);
      dx /= dist; dy /= dist;
      if (!A.fixed) { forces[bp.i].x += dx * f; forces[bp.i].y += dy * f; }
      if (!B.fixed) { forces[bp.j].x -= dx * f; forces[bp.j].y -= dy * f; }
    }

    // angle potentials (soft) - approximate by preferring neighbors at ideal angles per hybridization
    // For each atom with two or more bonded neighbors compute angle dev penalty
    for (let ai = 0; ai < n; ai++) {
      const A = atoms[ai];
      if (!A.coord || A.fixed) continue;
      // find bonded neighbors
      const bonds = mol.bonds.filter(b => b.a === A.id || b.b === A.id);
      if (bonds.length < 2) continue;
      const neighIdx = bonds.map(b => atomIndex.get(b.a === A.id ? b.b : b.a)!);
      // compute vectors
      const vecs = neighIdx.map(idx => {
        const v = { x: atoms[idx].coord!.x - A.coord!.x, y: atoms[idx].coord!.y - A.coord!.y };
        const len = Math.hypot(v.x, v.y) || 1e-6;
        return { x: v.x / len, y: v.y / len, idx };
      });
      // target angle
      const targetAngle = A.hybridization === 'sp2' ? 2 * Math.PI / 3 : A.hybridization === 'sp' ? Math.PI : 2 * Math.PI / 3.2;
      // try to push each neighbor toward equal spacing (simple)
      const m = vecs.length;
      for (let i = 0; i < m; i++) {
        const desired = rotateVector(vecs[i].x, vecs[i].y, targetAngle / 2); // weak heuristic
        // small force toward desired orientation
        const strength = 0.02;
        forces[vecs[i].idx].x += desired.x * strength;
        forces[vecs[i].idx].y += desired.y * strength;
      }
    }

    // repulsion (prevent overlaps). Only between atoms not in same rigid group
    const minDist = bondLen * 0.5;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const A = atoms[i], B = atoms[j];
        if (!A.coord || !B.coord) continue;
        // skip bonded pairs
        if (mol.bonds.some(b => (b.a === A.id && b.b === B.id) || (b.b === A.id && b.a === B.id))) continue;
        // skip if both part of same rigid group (we don't separate rigid bodies here)
        if (A.rigidGroup && B.rigidGroup && A.rigidGroup === B.rigidGroup) continue;
        const dx = B.coord.x - A.coord.x;
        const dy = B.coord.y - A.coord.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        if (d < minDist) {
          // repulsive force magnitude
          const mag = (minDist - d) * 0.5;
          const ux = dx / d, uy = dy / d;
          if (!A.fixed) { forces[i].x -= ux * mag; forces[i].y -= uy * mag; }
          if (!B.fixed) { forces[j].x += ux * mag; forces[j].y += uy * mag; }
        }
      }
    }

    // integrate: apply forces to velocities & positions (fixed atoms ignored)
    const dt = 0.25;
    for (let i = 0; i < n; i++) {
      const a = atoms[i];
      if (!a.coord || a.fixed) continue;
      vel[i].x = (vel[i].x + forces[i].x * dt) * 0.85;
      vel[i].y = (vel[i].y + forces[i].y * dt) * 0.85;
      a.coord.x += vel[i].x * dt;
      a.coord.y += vel[i].y * dt;
    }

    // occasional projection to exact bond length to stabilize
    if (iter % 20 === 0) projectBondLengths(mol, bondLen);
  }

  // After relaxation: free rigid group's fixed flag? keep them fixed.
}

function rotateVector(x: number, y: number, ang: number): Vec2 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: x * c - y * s, y: x * s + y * c };
}

function projectBondLengths(mol: Molecule, bondLen: number) {
  // For each bond, move endpoints to satisfy exact bondLen unless both fixed
  const atomById = new Map<number, Atom>();
  for (const a of mol.atoms) atomById.set(a.id, a);

  for (const b of mol.bonds) {
    const A = atomById.get(b.a)!, B = atomById.get(b.b)!;
    if (!A.coord || !B.coord) continue;
    const dx = B.coord.x - A.coord.x;
    const dy = B.coord.y - A.coord.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const target = bondLen * (1.0 + (b.order === 2 ? -0.02 : b.order === 3 ? -0.04 : 0));
    const diff = (d - target);
    if (Math.abs(diff) < 1e-3) continue;
    const ux = dx / d, uy = dy / d;
    const move = diff / 2;
    if (!A.fixed && !B.fixed) {
      A.coord.x += ux * move;
      A.coord.y += uy * move;
      B.coord.x -= ux * move;
      B.coord.y -= uy * move;
    } else if (!A.fixed) {
      A.coord.x += ux * diff;
      A.coord.y += uy * diff;
    } else if (!B.fixed) {
      B.coord.x -= ux * diff;
      B.coord.y -= uy * diff;
    }
  }
}

/* -------------------------
   Postprocess & rendering
   ------------------------- */

function postprocess(mol: Molecule, opts: SvgOptions) {
  // small nudges to separate overlapping labels or atoms
  // For now: ensure atoms are at least 0.45*bondLen apart, push flexible atoms outward.
  const atoms = mol.atoms;
  const n = atoms.length;
  const minDist = (opts.bondLen || 36) * 0.45;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const A = atoms[i], B = atoms[j];
        if (!A.coord || !B.coord) continue;
        if (mol.bonds.some(b => (b.a === A.id && b.b === B.id) || (b.b === A.id && b.a === B.id))) continue;
        const dx = B.coord.x - A.coord.x, dy = B.coord.y - A.coord.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        if (d < minDist) {
          const ux = dx / d, uy = dy / d;
          const push = (minDist - d) * 0.5;
          if (!A.fixed) { A.coord.x -= ux * push; A.coord.y -= uy * push; }
          if (!B.fixed) { B.coord.x += ux * push; B.coord.y += uy * push; }
        }
      }
    }
  }
}

function renderSvg(mol: Molecule, opts: SvgOptions): string {
  const bondLen = opts.bondLen || 36;
  const margin = opts.margin || 8;
  const atomFontBase = opts.atomFontSize || 12;
  // compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of mol.atoms) {
    if (!a.coord) continue;
    minX = Math.min(minX, a.coord.x);
    minY = Math.min(minY, a.coord.y);
    maxX = Math.max(maxX, a.coord.x);
    maxY = Math.max(maxY, a.coord.y);
  }
  if (!isFinite(minX)) {
    // nothing; return empty svg
    return `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
  }
  const w = maxX - minX + margin * 2;
  const h = maxY - minY + margin * 2;
  const vbX = minX - margin;
  const vbY = minY - margin;

  // helper to map coords to SVG space (no flip)
  const transformPoint = (p: Vec2) => ({ x: p.x, y: p.y });

  // Build SVG content: bonds first then atoms
  const lines: string[] = [];
  const atomLabels: string[] = [];
  const atomRadius = bondLen * 0.14; // for selection/hit testing if needed

  // draw bonds (handle single/double/triple)
  for (const b of mol.bonds) {
    const A = mol.atoms.find(a => a.id === b.a)!;
    const B = mol.atoms.find(a => a.id === b.b)!;
    if (!A.coord || !B.coord) continue;
    const p1 = transformPoint(A.coord), p2 = transformPoint(B.coord);
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / len, ny = dx / len; // normal (perp) unit
    const doubleGap = bondLen * 0.12; // offset for double/triple

    if (b.order === 1 || b.order === 1.5) {
      // single (for aromatic 1.5 we draw single; optionally aromatic circle exists)
      lines.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="black" stroke-width="${Math.max(1.0, bondLen*0.06)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else if (b.order === 2) {
      // double: two parallel lines
      const o = doubleGap / 2;
      const p1a = { x: p1.x + nx * o, y: p1.y + ny * o };
      const p1b = { x: p1.x - nx * o, y: p1.y - ny * o };
      const p2a = { x: p2.x + nx * o, y: p2.y + ny * o };
      const p2b = { x: p2.x - nx * o, y: p2.y - ny * o };
      lines.push(`<line x1="${p1a.x}" y1="${p1a.y}" x2="${p2a.x}" y2="${p2a.y}" stroke="black" stroke-width="${Math.max(1.0, bondLen*0.05)}" stroke-linecap="round"/>`);
      lines.push(`<line x1="${p1b.x}" y1="${p1b.y}" x2="${p2b.x}" y2="${p2b.y}" stroke="black" stroke-width="${Math.max(1.0, bondLen*0.05)}" stroke-linecap="round"/>`);
    } else if (b.order === 3) {
      // triple: three parallel lines
      const o = doubleGap;
      const p1a = { x: p1.x + nx * o, y: p1.y + ny * o };
      const p1b = { x: p1.x, y: p1.y };
      const p1c = { x: p1.x - nx * o, y: p1.y - ny * o };
      const p2a = { x: p2.x + nx * o, y: p2.y + ny * o };
      const p2b = { x: p2.x, y: p2.y };
      const p2c = { x: p2.x - nx * o, y: p2.y - ny * o };
      lines.push(`<line x1="${p1a.x}" y1="${p1a.y}" x2="${p2a.x}" y2="${p2a.y}" stroke="black" stroke-width="${Math.max(1.0, bondLen*0.05)}" stroke-linecap="round"/>`);
      lines.push(`<line x1="${p1b.x}" y1="${p1b.y}" x2="${p2b.x}" y2="${p2b.y}" stroke="black" stroke-width="${Math.max(1.0, bondLen*0.05)}" stroke-linecap="round"/>`);
      lines.push(`<line x1="${p1c.x}" y1="${p1c.y}" x2="${p2c.x}" y2="${p2c.y}" stroke="black" stroke-width="${Math.max(1.0, bondLen*0.05)}" stroke-linecap="round"/>`);
    }
    // STEREO: wedge/dash not implemented in full generality here. If bond.stereo present, draw a wedge/dash:
    if (b.stereo === 'up' || b.stereo === 'down') {
      // draw a simple wedge: triangle filled for 'up', hashed lines for 'down'
      const wedgeWidth = bondLen * 0.5;
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const base1 = { x: mid.x + nx * (wedgeWidth / 2), y: mid.y + ny * (wedgeWidth / 2) };
      const base2 = { x: mid.x - nx * (wedgeWidth / 2), y: mid.y - ny * (wedgeWidth / 2) };
      if (b.stereo === 'up') {
        // filled triangle from p1 -> base1 -> base2
        lines.push(`<polygon points="${p1.x},${p1.y} ${base1.x},${base1.y} ${base2.x},${base2.y}" fill="black" opacity="0.95"/>`);
      } else {
        // hashed wedge (down): draw several short lines between p1 and base segment
        const steps = 6;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const sx = p1.x + (base1.x - p1.x) * t;
          const sy = p1.y + (base1.y - p1.y) * t;
          const tx = p1.x + (base2.x - p1.x) * t;
          const ty = p1.y + (base2.y - p1.y) * t;
          lines.push(`<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="black" stroke-width="${Math.max(0.5, bondLen*0.01)}" stroke-linecap="butt"/>`);
        }
      }
    }
  }

  // draw atoms: labels (default: hide carbon unless explicit)
  for (const a of mol.atoms) {
    if (!a.coord) continue;
    const p = transformPoint(a.coord);
    const isCarbon = (a.element === 'C' || a.element === 'c');
    const showLabel = !isCarbon || (isCarbon && opts.showCarbonLabels) || (a.label && a.label.length > 0) || (a.implicitH && a.implicitH > 0) || (a.charge);
    if (showLabel) {
      const label = a.label ?? a.element + (a.charge ? (a.charge > 0 ? `+${a.charge}` : `${a.charge}`) : '');
      const fontSize = Math.max(8, atomFontBase * (opts.bondLen! / 36));
      // place text centered on atom position, offset slightly outward (so bond lines don't overlap text)
      // We'll offset by half font size along a small outward vector: try compute average neighbor vector
      const neighbors = mol.bonds.filter(b => b.a === a.id || b.b === a.id)
        .map(b => (b.a === a.id ? b.b : b.a))
        .map(id => mol.atoms.find(x => x.id === id)!)
        .filter(Boolean)
        .map(at => ({ x: at.coord!.x - p.x, y: at.coord!.y - p.y }));
      let offset = { x: 0, y: 0 };
      if (neighbors.length > 0) {
        // compute average incoming vector then negate to place label on outside
        let sx = 0, sy = 0;
        for (const v of neighbors) { const len = Math.hypot(v.x, v.y)||1; sx += v.x/len; sy += v.y/len; }
        const ax = -sx, ay = -sy;
        const alen = Math.hypot(ax, ay) || 1;
        offset = { x: (ax/alen) * fontSize * 0.6, y: (ay/alen) * fontSize * 0.6 };
      } else {
        offset = { x: 0, y: 0 };
      }
      atomLabels.push(`<text x="${p.x + offset.x}" y="${p.y + offset.y + fontSize*0.33}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" text-anchor="middle" fill="black">${escapeXml(label)}</text>`);
    } else {
      // optionally draw small invisible circle for selection/hit
      // lines.push(`<circle cx="${p.x}" cy="${p.y}" r="${atomRadius}" fill="transparent"/>`);
    }
  }

  // combine svg
  const strokeWidth = Math.max(1, (bondLen * 0.06));
  const svgParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${w} ${h}" ${opts.width ? `width="${opts.width}"` : ''} height="${Math.round(h)}" preserveAspectRatio="xMidYMid meet">`,
    `<g stroke="none" stroke-width="0" fill="none">`,
    // bonds & wedges
    ...lines,
    // atom labels (on top)
    ...atomLabels,
    `</g>`,
    `</svg>`
  ];
  return svgParts.join('\n');
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' } as any)[c]);
}
Example usage
import { moleculeToSvg } from './smiles-to-svg';

// Suppose `mol` is produced by your parser and contains atoms/bonds/rings.
const svg = moleculeToSvg(mol, { bondLen: 36, iterations: 250, showCarbonLabels: false, atomFontSize: 12 });
document.getElementById('canvas').innerHTML = svg;
Where to improve (next steps)
Better ring-fusion templates (align fused rings by matching shared bond orientation rather than naive shifts).
Replace naive repulsion with spatial hashing or quadtree for speed on big molecules.
Implement exact stereochemistry wedge orientation using 3D->2D projection if you have stereobonds.
Add aromatic rendering (circle inside ring) as option, and better Kekulé double placement.
SVG polishing: anti-aliasing hints, CSS classes for interactive highlighting, and hit-testing wrappers.
If you want, I can:
Turn the module into a thin library with unit tests for benzene, naphthalene, menthol, and a t-butyl example.
Add a better wedge/dash stereochemistry implementation or fused-ring placement improvements.
Which improvement should I show next?
You said:
How does this handle cases like morphine, phenanthrene, Pyrene etc 
ChatGPT said:
Below is exactly how to handle morphine, phenanthrene, pyrene, steroids, and any deeply fused ring system, using the same clean 2D-SVG pipeline — but extended with fused-ring–aware rigid templates and multi-ring alignment logic.
This is the part that most simple SMILES→SVG generators get wrong.
I’ll give you:

The core algorithm for fused-ring layout
Why phenanthrene/pyrene/morphine work cleanly
The TypeScript-ready steps & functions to drop into your renderer
SVG generation remains unchanged — it uses the final coordinates.
✔ Why simple “regular polygon per ring” fails
Compounds like phenanthrene, anthracene, pyrene, and morphine have:
Shared edges between rings
Fused rings that are not regular polygons
Ring systems that must be treated as one rigid body, not independent rings
Shared atoms in non-linear geometry
Some rings are distorted relative to standalone rings
If you place each ring as a regular hexagon independently → fusing them creates distorted geometry or overlaps.
Solution:

➜ Detect ring systems, not rings.
➜ Layout each ring system using fused templates, not naive polygons.
➜ Treat the entire fused system as one rigid block during relaxation.
This is exactly how RDKit, OCL, and CDK get beautiful fused layouts.
✔ Strategy: “Rigid Fused Ring System Templates”
1. Detect rings
Use your SMILES parser + any cycle detection (SSSR or improved cycle basis).
2. Group rings into fused systems
A fused system = rings sharing ≥ 1 bond.
function buildFusedSystems(rings: Ring[]): RingSystem[] {
  // Build graph of rings; edges if they share ≥2 atoms (shared bond).
}
3. For each fused system:
Instead of generating separate regular hexagons:
➜ Build a fused coordinate template by stitching rings together.
Examples:
✔ Example: Phenanthrene
SMILES: c1ccc2c(c1)ccc3ccccc23
Ring connectivity:

    Ring A — shares edge with Ring B
    Ring B — shares edge with Ring C
Phenanthrene’s fused pattern:
   A
  / \
 B - C
Algorithm:
Generate Ring A as a hexagon.
Attach Ring B by identifying shared atoms (A’s 2 vertices).
Compute transform to align B’s template to A’s.
Attach Ring C to B’s template using the same mechanism.
When positioning each new ring:
Use a predefined fused gap distance (0 or very small)
Use fixed angles: rings distort slightly (120°/120°/120° fused angles)
Net effect:
The 3 rings form the correct bent polyaromatic shape.
✔ Example: Pyrene (4-ring system with 2 centrally fused rings)
Pyrene: c1ccc2c(c1)ccc3c2ccc4c3cccc4
Ring system is not linear. Fusions form a diamond:

   A
  / \
 C - B
  \ /
   D
Algorithm:
Pick ring with highest degree (# of fused neighbors) to place first → e.g. central ring B.
Attach A and C on two sides.
Attach D at bottom.
Maintain “no lateral drift” by anchoring ring centroids and projecting alignment.
✔ Example: Morphine (multi-ring, hetero atoms, sp3 bridges)
Morphine SMILES contains:
Aromatic ring
Fused non-aromatic rings (6–6–5)
A 5-membered oxygen-containing ring
A bridging carbon creating a cage-like system
Several sp3 chains that must attach orthogonally
Approach:
Detect fused ring system (three rings).
Build fused template:
Aromatic ring = regular-ish polygon
Aliphatic rings = slightly distorted polygons (use angle presets)
Use explicit 5-ring templates for morphine-like ring systems (common for natural products).
After template placement:
Attach substituent trees using hybridization angles.
Use minor force relaxation with rigid-group pinning so the fused system stays intact.
✔ The Core Algorithm for Fused Ring Embedding
Below is the actual TypeScript-style code outline that cleanly places fused rings.
Step 1 — Build fused systems
interface RingSystem {
  id: number;
  rings: Ring[];
  atomIds: number[];    // all atoms in system
  bondIds: number[];
}
Group rings:
function findFusedRingSystems(rings: Ring[]): RingSystem[] {
  // Build adjacency graph of rings based on shared edges.
  // BFS/DFS to group connected rings.
}
Step 2 — Generate rigid fused template
function embedFusedSystem(system: RingSystem, mol: Mol2D) {
  // Choose a root ring (largest or most connected)
  const root = pickSeedRing(system.rings);

  // Place root as polygon
  placeRingTemplate(root, mol);

  const placed = new Set([root.id]);

  // BFS outward
  const queue = [root];

  while (queue.length > 0) {
    const r = queue.shift()!;
    for (const neighbor of getAdjacentRings(r, system)) {
      if (placed.has(neighbor.id)) continue;

      placeFusedRing(r, neighbor, mol); // <-- core function

      placed.add(neighbor.id);
      queue.push(neighbor);
    }
  }

  // After stitch: entire fused system is a rigid block.
  markAsRigidGroup(system.atomIds, mol);
}
Step 3 — Place a fused ring next to an already placed ring
function placeFusedRing(
  placedRing: Ring,
  newRing: Ring,
  mol: Mol2D
) {
  const shared = findSharedBond(placedRing, newRing);
  if (!shared) throw new Error("Fused rings must share bond");

  const [a1, a2] = shared; // atom ids

  // Coordinates of shared atoms in existing placed ring
  const p1 = mol.atoms[a1].coord!;
  const p2 = mol.atoms[a2].coord!;

  // Generate a fresh polygon for new ring (local coords)
  const localCoords = polygonTemplate(newRing.size); // centered at origin

  // In the local template, find positions of shared atoms
  const [l1, l2] = findTemplatePositions(newRing, a1, a2, localCoords);

  // Compute transform:
  // 1) rotation so (l1->l2) aligns to (p1->p2)
  // 2) translation moving l1 onto p1
  const transform = computeAlignmentTransform(l1, l2, p1, p2);

  // Apply transform to all atoms of new ring
  for (const atomId of newRing.atomIds) {
    const lc = localCoords[atomId];
    mol.atoms[atomId].coord = applyTransform(lc, transform);
  }
}
Step 4 — Attach substituents
After full fused system is placed:
function attachSubstituents(mol: Mol2D) {
  for (const atom of mol.atoms) {
    if (atom.partOfRingSystem) continue;
    if (!atom.coord) placeTree(atom.id, mol); // BFS outward
  }
}
Step 5 — Constrained relaxation
relaxWithRigidGroups(mol, {
  rigidGroups: detectedRingSystems,
  bondLength: 36,
  iterations: 200,
});
Rigid groups prevent phenanthrene / pyrene ring blocks from distorting.
✔ Why this works for phenanthrene/pyrene/morphine
Phenanthrene
Three hexagons fused sequentially
This algorithm places hexagon A
Aligns hexagon B by rotating/translated so its shared edge lies exactly on A’s shared edge
Ring C stitched to B the same way
Composite is rigid → relaxation doesn’t bend them
Pyrene
Algorithm handles non-linear fusion graphs (diamond-like) because BFS stitching allows branching
Each new ring aligned at its shared edge
Results in correct cruciform 4-ring system
Morphine
Fused 6-6-5 system placed as a fused block
5-ring geometry uses custom template (not regular pentagon)
Bridged carbons are handled as normal atoms with fixed coordinates
Remaining substituents placed using hybridization angles
Rigid group prevents warping during relaxation