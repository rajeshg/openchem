# SVG Rendering Guide

**Audience:** Users and developers working with 2D molecular structure visualization  
**Related:** [README](../README.md)

---

## Overview

openchem provides a complete 2D molecular structure rendering system that generates clean, chemically accurate SVG diagrams from SMILES strings or Molecule objects. The renderer automatically computes 2D coordinates and produces ChemDraw-style visualizations.

**Key Features:**
- ✅ Automatic 2D coordinate generation
- ✅ Multiple bond types (single, double, triple, aromatic)
- ✅ Stereochemistry support (wedge/hash bonds)
- ✅ Smart atom label visibility
- ✅ Scalable SVG output
- ✅ Element-based coloring or monochrome

---

## Quick Start

### Basic Usage

```typescript
import { parseSMILES, renderSVG } from 'index';

// Parse SMILES and render to SVG
const result = parseSMILES('c1ccccc1');
const molecule = result.molecules[0];

const svg = renderSVG(molecule);
// Returns SVG string ready for display or saving
```

### With Options

```typescript
import { renderSVG } from 'index';

const svg = renderSVG(molecule, {
  width: 400,
  height: 300,
  bondLength: 50,
  showAtomLabels: true,
  colorScheme: 'default', // or 'monochrome'
  fontSize: 14,
  strokeWidth: 1.5,
});
```

### Usage in Web Applications

```typescript
// React/JSX
<div dangerouslySetInnerHTML={{ __html: svg }} />

// Save to file
import fs from 'fs';
fs.writeFileSync('molecule.svg', svg);
```

---

## API Reference

### `renderSVG(molecule: Molecule, options?: SVGRenderOptions)`

**Parameters:**
- `molecule` (Molecule) — Molecule object to render
- `options` (SVGRenderOptions, optional) — Rendering configuration

**Returns:** `string` — SVG markup

**Options:**
```typescript
interface SVGRenderOptions {
  width?: number;              // SVG width (default: 400)
  height?: number;             // SVG height (default: 300)
  bondLength?: number;         // Bond length in pixels (default: 40)
  showAtomLabels?: boolean;    // Show all atom labels (default: false)
  colorScheme?: 'default' | 'monochrome';  // Color scheme (default: 'default')
  fontSize?: number;           // Font size for labels (default: 12)
  strokeWidth?: number;        // Bond thickness (default: 1.5)
  atomRadius?: number;         // Atom circle radius (default: 6)
}
```

---

## 2D Layout Algorithm

### Pipeline Overview

The coordinate generation follows a multi-stage pipeline:

```
1. Ring Detection
   ↓
2. Ring Placement (regular polygons)
   ↓
3. Inter-Ring Connections
   ↓
4. Chain/Branch Expansion
   ↓
5. Geometric Optimization
   ↓
6. Annotation (labels, stereo)
```

### Stage 1: Ring Detection

- Identify all rings using SSSR (Smallest Set of Smallest Rings)
- Group fused rings into composite systems
- Detect aromatic rings for special handling

**Implementation:** `src/utils/ring-finder.ts`, `src/utils/ring-analysis.ts`

### Stage 2: Ring Placement

**Regular polygon templates:**
- 3-membered: equilateral triangle
- 4-membered: square
- 5-membered: regular pentagon
- 6-membered: regular hexagon (default for aromatics)

**Fused rings:**
- Align shared bonds perfectly between polygons
- Merge adjacent ring coordinates into single geometry
- Maintain planarity across fused clusters

### Stage 3: Inter-Ring Connections

- Identify bonds connecting distinct ring systems
- Arrange to minimize edge crossings
- Maintain equal distances between ring clusters
- Prefer 30°, 45°, 60°, 90°, 120° bond angles

### Stage 4: Chain/Branch Expansion

**Chain placement:**
- Traverse outwards from ring cores
- Use idealized geometry:
  - sp³ centers: ~109.5° (simplified to 90°/120° in 2D)
  - sp² centers: 120° planar separation
- Grow branches recursively to terminal atoms

**Branch spacing:**
- Avoid collisions with rings and other branches
- Prefer outward/diagonal orientation from core
- Rotate branches (±15°) to prevent overlap

### Stage 5: Geometric Optimization

**Force relaxation:**
- Equalize bond lengths
- Minimize atom-atom overlap
- Preserve ring planarity
- Treat fused rings as rigid units

**Angle regularization:**
- Snap bond angles to preferred values: 30°, 45°, 60°, 90°, 120°, 150°, 180°
- Recheck ring closure accuracy

**Aesthetic rotation:**
- Compute principal moment of inertia
- Rotate molecule so long axis is horizontal
- Center molecule in coordinate system

### Stage 6: Annotation

- Add atom labels after geometry is finalized
- Position labels to avoid crossing bonds
- Orient wedge/hash bonds consistently

**Implementation:** `src/utils/coordinate-generator-webcola.ts`

---

## Visual Rendering Rules

### Bond Types

**Single bonds:**
- Solid straight lines
- Uniform thickness (default 1.5px)

**Double bonds:**
- Two parallel lines with slight spacing
- Centered on bond axis

**Triple bonds:**
- Three parallel lines with closer spacing
- Centered on bond axis

**Aromatic bonds:**
- Alternating single/double representation
- Optional: circle inside ring (not currently implemented)

**Stereo bonds:**
- **Wedge (solid)**: Bond toward viewer (filled triangle)
- **Hash (dashed)**: Bond away from viewer (parallel dashed lines)

**Implementation:** `src/generators/svg-renderer/`

### Atom Labels

**Show labels for:**
- Heteroatoms (N, O, S, P, halogens, etc.)
- Charged atoms (NH₄⁺, O⁻, etc.)
- Isotopes (¹³C, ²H, etc.)
- Radicals (C•)

**Hide labels for:**
- Normal carbons (chemical convention)
- Implicit hydrogens on carbons

**Element colors (default scheme):**
- Carbon: black (#000000)
- Nitrogen: blue (#0000FF)
- Oxygen: red (#FF0000)
- Sulfur: yellow (#CCCC00)
- Phosphorus: orange (#FF8000)
- Halogens: dark green (#006400)

**Monochrome scheme:**
- All elements: black (#000000)

### Geometry Guidelines

**Bond angles:**
- sp² centers: 120°
- sp³ centers: 109.5° (simplified to 90°/120° in 2D)
- Avoid acute angles (< 60°) except in small rings
- Maintain balanced symmetry

**Bond lengths:**
- Uniform across molecule (default: 40px)
- Recommended range: 30-60px
- Avoid stretched or compressed bonds

**Ring geometry:**
- Draw as regular polygons
- Fused rings share exact edge geometry
- No distortion at fusion points

**Spacing:**
- Maintain uniform spacing between atoms
- No overlaps between bonds, labels, or hydrogens
- Keep molecule centered and planar

**Implementation:** Rules defined in coordinate generation and SVG rendering modules

---

## Visual Quality Metrics

### Quality Score Calculation

Each rule has an associated weight. Overall quality can be computed as:

```
quality_score = Σ(rule_score × weight) / Σ(weight)
```

**High priority rules (weight > 0.9):**
- Bond angles (0.9)
- Stereochemistry consistency (1.0)
- Layout optimization (1.0)
- Geometric optimization (1.0)

**Medium priority rules (weight 0.7-0.9):**
- Bond lengths (0.8)
- Ring geometry (0.85)
- Spacing (0.8)
- Bond types (0.9)
- Global consistency (0.9)

**Lower priority rules (weight < 0.7):**
- Aromatic representation (0.7)
- Label alignment (0.6)
- Color/contrast (0.6)

---

## Advanced Usage

### Custom Coordinate Generation

```typescript
import { generateCoordinates, renderSVG } from 'index';

// Generate coordinates separately
const molecule = parseSMILES('CC(C)C').molecules[0];
const withCoords = generateCoordinates(molecule, { bondLength: 50 });

// Render with custom options
const svg = renderSVG(withCoords, {
  colorScheme: 'monochrome',
  strokeWidth: 2.0,
});
```

### Batch Rendering

```typescript
import { parseSMILES, renderSVG } from 'index';

const smilesList = ['c1ccccc1', 'CCO', 'CC(=O)O'];

const svgs = smilesList.map(smiles => {
  const molecule = parseSMILES(smiles).molecules[0];
  return renderSVG(molecule, { width: 300, height: 200 });
});

// Save all SVGs
svgs.forEach((svg, i) => {
  fs.writeFileSync(`molecule_${i}.svg`, svg);
});
```

### Embedding in HTML

```html
<!DOCTYPE html>
<html>
<body>
  <div id="molecule-container"></div>
  
  <script type="module">
    import { parseSMILES, renderSVG } from 'openchem';
    
    const molecule = parseSMILES('c1ccccc1').molecules[0];
    const svg = renderSVG(molecule);
    
    document.getElementById('molecule-container').innerHTML = svg;
  </script>
</body>
</html>
```

---

## Performance Considerations

### Coordinate Generation Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Ring finding (SSSR) | O(N²) | Bottleneck for large molecules |
| Ring placement | O(R) | R = number of rings |
| Chain expansion | O(N) | N = number of atoms |
| Force relaxation | O(N²) | Can be expensive for 100+ atoms |
| SVG generation | O(N + B) | N = atoms, B = bonds |

### Performance Guidelines

- **< 30 atoms**: Instant (< 10ms)
- **30-60 atoms**: Fast (10-50ms)
- **60-100 atoms**: Acceptable (50-200ms)
- **> 100 atoms**: May be slow (200ms-1s)

### Optimization Tips

1. **Cache rendered SVGs** for repeated use
2. **Generate coordinates once**, render multiple times with different styles
3. **Use simpler layout** for very large molecules (disable force relaxation)
4. **Consider static images** for molecules > 200 atoms

---

## Examples

### Basic Molecules

```typescript
// Benzene
renderSVG(parseSMILES('c1ccccc1').molecules[0]);

// Ethanol
renderSVG(parseSMILES('CCO').molecules[0]);

// Acetic acid
renderSVG(parseSMILES('CC(=O)O').molecules[0]);
```

### Complex Molecules

```typescript
// Aspirin
renderSVG(parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0]);

// Caffeine
renderSVG(parseSMILES('CN1C=NC2=C1C(=O)N(C(=O)N2C)C').molecules[0]);

// Ibuprofen
renderSVG(parseSMILES('CC(C)Cc1ccc(cc1)C(C)C(=O)O').molecules[0]);
```

### Stereochemistry

```typescript
// (E)-but-2-ene
renderSVG(parseSMILES('C/C=C/C').molecules[0]);

// L-alanine
renderSVG(parseSMILES('C[C@@H](N)C(=O)O').molecules[0]);
```

---

## Implementation Files

### Core Renderer
- **Entry point:** `src/generators/svg-renderer.ts`
- **Main function:** `renderSVG(molecule, options)`

### Coordinate Generation
- **WebCoLa layout:** `src/utils/coordinate-generator-webcola.ts`
- **Ring analysis:** `src/utils/ring-analysis.ts`
- **Ring finding:** `src/utils/ring-finder.ts`

### Rendering Support
- **Coordinate utils:** `src/generators/svg-renderer/coordinate-utils.ts`
- **Stereo bonds:** `src/generators/svg-renderer/stereo-bonds.ts`
- **Double bonds:** `src/generators/svg-renderer/double-bond-renderer.ts`
- **Atom labels:** `src/generators/svg-renderer/atom-labels.ts`

---

## Testing

### Run Rendering Tests

```bash
# SVG rendering tests
bun test test/svg/

# Specific tests
bun test test/svg/svg-basic.test.ts
bun test test/svg/tetrahedral-geometry.test.ts
bun test test/svg/biphenyl.test.ts
```

### Visual Validation

```bash
# Generate SVG files for visual inspection
bun run scripts/save-rendered-svgs.mjs
```

---

## Known Limitations

### 1. Large Molecules (> 100 atoms)
**Issue:** Coordinate generation can be slow
**Workaround:** Use simpler layout algorithm or pre-compute coordinates

### 2. Complex Polycyclic Systems
**Issue:** Fused ring layout may not be optimal for very complex systems
**Status:** Works well for common cases (naphthalene, anthracene, steroids)

### 3. 3D Stereochemistry Display
**Issue:** Only basic wedge/hash support, no 3D perspective
**Status:** Sufficient for most 2D chemical drawings

---

## Contributing

### Adding New Bond Types

1. Define bond type in `types.ts`
2. Add rendering logic in `src/generators/svg-renderer/`
3. Update bond rendering dispatch
4. Add test cases in `test/svg/`

### Improving Layout Algorithm

1. Modify coordinate generation in `coordinate-generator-webcola.ts`
2. Update force relaxation parameters
3. Test with diverse molecule set
4. Validate visual quality

### Custom Element Colors

1. Update color scheme mapping in `svg-renderer.ts`
2. Add new color scheme option
3. Test with heteroatom-rich molecules

---

## Related Documentation

- **[README](../README.md)** — Library overview
- **[Molecular Properties](./molecular-properties.md)** — Descriptors and calculations
- **[SMILES → IUPAC Generation](./iupac-generation.md)** — Name generation

---

**Last Updated:** 2025-11-20  
**Maintainer:** openchem team
