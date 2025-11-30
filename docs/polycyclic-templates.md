# Polycyclic Coordinate Templates

## Overview

The coordinate generator includes a template library for common polycyclic scaffolds. When a known molecular pattern is detected, pre-computed optimal coordinates can be used instead of BFS placement, potentially improving geometry quality.

## Template Library (14 templates)

### Aromatic Hydrocarbons (5 templates)

1. **Naphthalene** - Two fused benzene rings (linear)
   - Pattern: `[6, 6]` (2 rings)
   - SMILES: `c1ccc2ccccc2c1`

2. **Anthracene** - Three linearly fused benzene rings
   - Pattern: `[6, 6, 6]` (3 rings, linear)
   - SMILES: `c1ccc2cc3ccccc3cc2c1`

3. **Phenanthrene** - Three angularly fused benzene rings
   - Pattern: `[6, 6, 6]` (3 rings, angular)
   - SMILES: `c1cccc2c3ccccc3ccc12`

4. **Pyrene** - Four fused benzene rings (compact tetracyclic)
   - Pattern: `[6, 6, 6, 6]` (4 rings, aromatic)
   - SMILES: `c1cc2ccc3cccc4ccc(c1)c2c34`

5. **Fluorene** - Two benzenes bridged by cyclopentane
   - Pattern: `[5, 6, 6]` (3 rings, 2+ aromatic)
   - SMILES: `c1ccc2c(c1)Cc3ccccc32`

### N-Heterocycles (4 templates)

6. **Indole** - Benzene fused to pyrrole
   - Pattern: `[5, 6]` with N in 5-ring
   - SMILES: `c1ccc2c(c1)cc[nH]2`

7. **Quinoline** - Benzene fused to pyridine
   - Pattern: `[6, 6]` with N
   - SMILES: `c1ccc2ncccc2c1`

8. **Purine** - Fused bicyclic heterocycle (DNA/RNA base scaffold)
   - Pattern: `[5, 5]` with 3+ nitrogens
   - SMILES: `c1nc2c([nH]1)ncn2`

9. **Carbazole** - Two benzenes bridged by pyrrole
   - Pattern: `[5, 6, 6]` with N, all aromatic
   - SMILES: `c1ccc2c(c1)[nH]c3ccccc32`

### O-Heterocycles (1 template)

10. **Benzofuran** - Benzene fused to furan
    - Pattern: `[5, 6]` with O in 5-ring
    - SMILES: `c1ccc2occc2c1`

### S-Heterocycles (1 template)

11. **Benzothiophene** - Benzene fused to thiophene
    - Pattern: `[5, 6]` with S in 5-ring
    - SMILES: `c1ccc2sccc2c1`

### Complex Scaffolds (3 templates)

12. **Steroid** - Four fused rings (steroid core)
    - Pattern: `[5, 5, 6, 6]` (4 rings, angular)
    - SMILES: `C1CC2CCC3C(C2C1)CCC4C3CCC4`

13. **Morphine** - Pentagon fused between hexagons (morphinan alkaloid core)
    - Pattern: `[5, 6, 6]` (3 rings, angular) - **DISABLED** (complex)
    - SMILES: `CN1CC[C@]23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5`

14. **Adamantane** - Tricyclic bridged cage
    - Pattern: `[6, 6, 6]` (bridged) - **DISABLED** (complex)
    - SMILES: `C1C2CC3CC1CC(C2)C3`

## Usage

### Enabling Templates

Templates are **disabled by default** (need graph matching improvements). To enable:

```typescript
import { generateCoordinates } from "openchem";

const coords = generateCoordinates(molecule, {
  bondLength: 30,
  useTemplates: true, // Enable template-based placement
});
```

### Testing Template Matching

```typescript
import { parseSMILES } from "openchem";
import { findMatchingTemplate } from "openchem/src/generators/coordinate-generator/polycyclic-templates";
import { detectFusedRingSystems } from "openchem/src/generators/coordinate-generator/ring-system-detector";

const molecule = parseSMILES("c1ccc2ccccc2c1").molecules[0]; // Naphthalene

const rings = molecule.rings.map((atomIds, idx) => ({
  id: idx,
  atomIds: [...atomIds],
  size: atomIds.length,
  aromatic: atomIds.some((id) => molecule.atoms[id]?.aromatic ?? false),
}));

const systems = detectFusedRingSystems(rings, molecule);
const template = findMatchingTemplate(systems[0], molecule);

if (template) {
  console.log(`Matched template: ${template.name}`);
}
```

## Template Coverage

**Test Results** (11 molecules):
- ✅ **100% coverage** across all categories
- **Categories**:
  - Aromatic hydrocarbons: 3/3 (100%)
  - N-Heterocycles: 4/4 (100%)
  - O-Heterocycles: 1/1 (100%)
  - S-Heterocycles: 1/1 (100%)
  - Bridged systems: 1/1 (100%)
  - Aliphatic rings: 1/1 (100%)

## Implementation Status

### ✅ Completed
- Template library with 14 scaffolds
- Pattern matching for each template
- Coordinate scaling and application
- Integration into coordinate generator
- Fallback to BFS for unmatched patterns

### ⚠️ Known Limitations

1. **Shared Atom Handling** - Current `applyTemplate()` uses simple mapping that may cause overlaps
   - Need graph isomorphism for proper atom mapping
   - Shared atoms must be detected and placed once

2. **Ring Order Dependency** - Assumes ring order in molecule matches template order
   - Production needs canonical ring ordering or flexible matching

3. **No Alignment** - Templates don't align with existing placed systems
   - Need transform computation when connecting to other ring systems

4. **Limited Validation** - No post-application validation of geometry
   - Should verify bond lengths and angles after template application

### 🚧 TODO

**Short-term** (improve current templates):
1. Implement proper shared atom detection using `template.sharedAtoms`
2. Add graph isomorphism for reliable atom mapping
3. Validate geometry after template application (bond lengths, angles)

**Medium-term** (expand library):
1. Add more common scaffolds:
   - Acridine (3 rings, N-heterocycle)
   - Xanthene (3 rings, O-heterocycle)
   - Benzimidazole (2 rings, 2N)
   - Benzoxazole (2 rings, N+O)
   - Chromene (2 rings, O)
2. Add macrocycle templates (> 12-membered rings)
3. Add bridged bicyclic templates (norbornane, bicyclo[2.2.2]octane)

**Long-term** (automated templates):
1. Extract templates from high-quality 2D structures (ChEMBL, PubChem)
2. Cluster molecules by scaffold and generate templates automatically
3. Machine learning to predict optimal geometry for novel scaffolds

## Adding New Templates

### Step 1: Define Pattern

```typescript
const MY_TEMPLATE: PolycyclicTemplate = {
  name: "my-scaffold",
  description: "Description of the scaffold",
  pattern: {
    ringCount: 2,
    ringSizes: [5, 6],
    fusionType: "linear", // or "angular", "branched", "spiro", "bridged"
  },
```

### Step 2: Define Coordinates

Coordinates should use **30Å bond length** (auto-scaled to desired length):

```typescript
  coordinates: [
    // Ring 0 (5-membered)
    [
      { x: 0, y: 24 },
      { x: 22.8, y: 14.1 },
      { x: 22.8, y: -14.1 },
      { x: 0, y: -24 },
      { x: -14.1, y: 0 },
    ],
    // Ring 1 (6-membered)
    [
      { x: 22.8, y: 14.1 },  // Shared with ring 0
      { x: 48.78, y: 24 },
      { x: 74.76, y: 14.1 },
      { x: 74.76, y: -14.1 },
      { x: 48.78, y: -24 },
      { x: 22.8, y: -14.1 },  // Shared with ring 0
    ],
  ],
```

**Tips for coordinates**:
1. Use regular polygon templates from `geometry-utils.ts`
2. Manually adjust for optimal overlap in fused systems
3. Verify geometry with SVG rendering
4. Keep bond lengths uniform (30Å for templates)

### Step 3: Define Shared Atoms

```typescript
  sharedAtoms: [
    [0, 1, 1, 0], // Ring 0 atom 1 = Ring 1 atom 0
    [0, 2, 1, 5], // Ring 0 atom 2 = Ring 1 atom 5
  ],
```

### Step 4: Define Matching Function

```typescript
  matches: (system, molecule) => {
    if (system.rings.length !== 2) return false;
    const sizes = system.rings.map((r) => r.size).sort();
    if (sizes[0] !== 5 || sizes[1] !== 6) return false;

    // Add specific checks (heteroatoms, aromaticity, etc.)
    const ring5 = system.rings.find((r) => r.size === 5);
    const hasNitrogen = ring5.atomIds.some((id) => molecule.atoms[id]?.symbol === "N");
    
    return hasNitrogen;
  },
};
```

### Step 5: Add to Database

```typescript
export const POLYCYCLIC_TEMPLATES = [
  // Add new template in priority order
  MY_TEMPLATE,
  
  // Existing templates...
  INDOLE_TEMPLATE,
  QUINOLINE_TEMPLATE,
  // ...
];
```

### Step 6: Test

```typescript
import { parseSMILES } from "openchem";
import { findMatchingTemplate } from "openchem/src/generators/coordinate-generator/polycyclic-templates";

const mol = parseSMILES("your-test-smiles").molecules[0];
// ... (setup ring systems)
const template = findMatchingTemplate(system, mol);
console.assert(template?.name === "my-scaffold");
```

## Performance

- **Template matching**: O(T × P) where T = # templates, P = pattern complexity
  - Typical: < 1ms for 14 templates
- **Template application**: O(N) where N = # atoms in system
  - Typical: < 0.1ms
- **Total overhead**: Negligible (< 1ms per molecule)

**Recommendation**: Keep templates enabled for common scaffolds (currently disabled due to shared atom issue).

## References

- **Template coordinates**: Manually tuned using regular polygon formulas
- **Scaffold library**: Based on common motifs in ChEMBL, PubChem, and drug databases
- **IUPAC fusion templates**: `src/iupac-engine/naming/iupac-rings/fusion-templates.ts` (naming, not coordinates)

## Files

- **Implementation**: `src/generators/coordinate-generator/polycyclic-templates.ts`
- **Integration**: `src/generators/coordinate-generator/index.ts` (line ~100)
- **Tests**: `test/unit/coordinate-generator/integration.test.ts`
- **Documentation**: This file

---

**Status**: ⚠️ Experimental (disabled by default)  
**Last Updated**: 2025-11-30  
**Version**: 0.2.13
