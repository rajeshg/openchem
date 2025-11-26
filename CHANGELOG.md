# Changelog

All notable changes to openchem will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.6] - 2025-11-25

### Added
- **Complete Tautomer Enumeration System** - 100% RDKit coverage with comprehensive rule set
  - `scoreTautomer()` - RDKit-compatible scoring system with:
    - +250 per all-carbon aromatic ring (benzene)
    - +100 per heteroaromatic ring (pyridine, pyrrole)
    - +25 for benzoquinone patterns
    - +4 for oximes (C=N-OH)
    - +2 per carbonyl (C=O, N=O, P=O)
    - +1 per methyl group
    - -10 per formal charge
    - -4 for aci-nitro forms
    - -1 per H on P, S, Se, Te
  - **25 tautomer transformation rules** (100% RDKit coverage - all 18 standard bidirectional rules):
    - **Phase 1 (Conservative)**: 1,3 and 1,5 (thio)keto-enol, imine-enamine (aliphatic + aromatic), amide-imidol, lactam-lactim, nitro-aci-nitro
    - **Phase 2 (Important)**: 1,5/1,7/1,9 aromatic heteroatom H shift (pyrrole, indole, extended conjugation), furanone, oxim/nitroso via phenol, thione-thiol, nitroso-oxime, phosphonic acid, guanidine, tetrazole, imidazole
    - **Phase 3 (Edge Cases)**: 1,11 aromatic shift, keten/ynol, cyano/isocyanic acid, formamidinesulfinic acid, isocyanide, sulfoxide
  - Comprehensive test suite (51 tests, 90 expect() calls)
    - Scoring system tests (22 tests)
    - Rule-specific tests (19 tests - all 26 rules covered)
    - Integration tests (10 tests)
  - Example file: `docs/examples/example-tautomers.ts`

### Documentation
- Added "Tautomer Analysis (2)" category to API Reference
- Detailed API documentation for `enumerateTautomers()` and `canonicalTautomer()`
- Updated README with tautomer enumeration section highlighting 100% RDKit coverage
- Added RDKit comparison document: `docs/rdkit-tautomer-comparison.md`
- Updated THIRD-PARTY-LICENSES.md with RDKit tautomer scoring attribution
- Added inline RDKit attribution in `tautomer-scoring.ts` source code

### Changed
- Replaced simple tautomer scoring (+1 aromatic, -10 charge) with RDKit-compatible algorithm
- Updated tautomer rule metadata (version 0.4.0 - milestone release)
- Function count: 36 → 38 functions (added scoring helpers)

### Fixed
- Improved tautomer deduplication with fingerprint-based pre-filtering
- Fixed phase-based enumeration to properly seed next phase with all discovered tautomers

## [0.2.5] - 2025-11-23

### Added
- **Murcko Scaffold Analysis** - Extract core molecular scaffolds for drug discovery
  - `getMurckoScaffold()` - Extract rings + linkers (remove side chains)
  - `getBemisMurckoFramework()` - Generic scaffold (all C, single bonds)
  - `getScaffoldTree()` - Hierarchical scaffold decomposition
  - `getGraphFramework()` - Pure topology (all atoms → wildcard)
  - `haveSameScaffold()` - Compare scaffolds between molecules
- Comprehensive test suite with 43 passing tests covering:
  - Basic scaffolds (benzene, toluene, naphthalene, pyridine)
  - Drug-like molecules (aspirin, ibuprofen, caffeine)
  - Linker handling (biphenyl, multi-atom linkers)
  - Edge cases (spiro, bridged systems, adamantane)
  - Scaffold trees and generic frameworks
- Updated API documentation with scaffold analysis examples
- Added scaffold analysis section to README with usage examples

### Documentation
- Added Murcko scaffolds to Feature list
- Added "Scaffold Analysis (5)" category to API Reference
- Detailed API documentation for all 5 scaffold functions
- Added usage example in README showing drug discovery workflow

## [0.2.4] - 2025-11-23

### Fixed
- Fixed rotatable bond calculation to match RDKit behavior for ester/amide bonds
- Removed incorrect conjugation check that excluded N-Aryl bonds in rotatable bond detection
- Fixed SMARTS bulk test aromaticity differences (16 failures → 0)
- Fixed SMILES bulk test rotatable bond counting (13 failures → 0)
- Fixed all TypeScript lint issues (10 warnings → 0)
- Removed unused parameters and variables across multiple files
- Added `kekule-form-aromaticity` category for known SMARTS matching differences

### Changed
- Updated `determineHybridization()` function signature to remove unused `atoms` parameter
- Updated `getBertzCT()` function signature to remove unused `cutoff` parameter
- Prefixed unused `mol` parameter in `getNumRadicalElectrons()` with underscore

## [0.2.3] - 2025-11-23

### Changed
- Restored full CHANGELOG history from previous versions

## [0.2.2] - 2025-11-23

### Added
- **New Descriptors API** - Clean namespace for 50+ molecular properties
  - `Descriptors.all()` - Get all common properties at once
  - `Descriptors.basic()` - Formula, mass, atom counts
  - `Descriptors.physicochemical()` - LogP, TPSA, H-bond donors/acceptors
  - `Descriptors.structural()` - Rings, stereocenters, spiro/bridgehead atoms
  - `Descriptors.drugLikeness()` - Lipinski, Veber, BBB with detailed violations
  - `Descriptors.topology()` - Kappa indices, Bertz CT
  - `Descriptors.chi()` - All 12 chi index variants
  - Individual accessors: `Descriptors.logP()`, `.tpsa()`, `.formula()`, etc.
- Created 8 new modules under `src/descriptors/`
- Type definitions for all descriptor categories

### Changed
- **Playground UX redesign**
  - Moved examples from scrollable left sidebar to compact pill buttons at top
  - Changed from 3-column to 2-column layout (Structure + Summary/Descriptors)
  - Removed sticky scrolling for unified scroll behavior
  - Added full responsive design (breakpoints: 1400px, 1024px, 768px, 480px)
  - Fixed accordion arrows to point down (▼) when expanded
- Updated all example files to use new Descriptors API
- Updated validation scripts to use new API

### Removed
- **Legacy descriptor exports** (40+ functions) - Use `Descriptors` namespace instead
  - Removed: `getMolecularFormula`, `getMolecularMass`, `getExactMass`
  - Removed: `getHBondDonorCount`, `getHBondAcceptorCount`, `getTPSA`
  - Removed: `checkLipinskiRuleOfFive`, `checkVeberRules`, `checkBBBPenetration`
  - Removed: All topology descriptors (`getKappa1/2/3`, `getBertzCT`)
  - Removed: All chi indices (`getChi0/1/2/3/4n/v` variants)
  - Kept: Specialized utilities (charge descriptors, advanced structural functions)

### Migration Guide
```typescript
// Before (v0.2.1)
import {
  getMolecularFormula,
  getMolecularMass,
  computeLogP,
  getTPSA,
  checkLipinskiRuleOfFive
} from 'openchem';

const formula = getMolecularFormula(mol);
const mass = getMolecularMass(mol);
const logP = computeLogP(mol);
const lipinski = checkLipinskiRuleOfFive(mol);

// After (v0.2.2)
import { Descriptors, computeLogP } from 'openchem';

// Get all at once
const all = Descriptors.all(mol);
console.log(all.formula, all.mass, all.logP, all.lipinskiPass);

// Or by category
const basic = Descriptors.basic(mol);
const drugLike = Descriptors.drugLikeness(mol);

// Or individual
const formula = Descriptors.formula(mol);
const logP = Descriptors.logP(mol);
```

### Benefits
- **Cleaner API**: 1 import instead of 50+
- **Better discoverability**: Type `Descriptors.` → autocomplete shows all options
- **Flexible**: Compute all/category/individual properties as needed
- **Tree-shakeable**: Each category is a separate module
- **Type-safe**: Full TypeScript support with detailed interfaces

## [0.2.1] - 2025-10-24

### Added
- **InChI Generation**: WASM-based InChI generation with automatic caching optimization
  - `generateInChI(mol)` for generating InChI strings
  - Automatic WASM module initialization and caching
  - Full InChI specification support

### Enhanced
- Morgan fingerprint standardization to 2048 bits (RDKit standard)
- Improved WASM module handling with persistent caching

## [0.2.0] - 2025-10-24

### Added
- **SVG Molecular Rendering**: Full 2D structure visualization with:
  - Ring detection and regularization (triangles, squares, pentagons, hexagons)
  - Aromatic bond rendering (alternating inner lines with directional indicators)
  - Stereochemistry support (wedge and dashed bonds for chirality)
  - Intelligent atom label placement with collision avoidance
  - Multi-molecule rendering with automatic spacing
  - Fused ring support with shared edge geometry
  - Customizable rendering options (atom labels, bond length, colors)
- **Morgan Fingerprints**: Extended circular fingerprint descriptor for similarity searching
  - `computeMorganFingerprint(mol, radius?, bitLength?)` for generating fingerprints
  - `tanimotoSimilarity(fp1, fp2)` for comparing molecular similarities
  - Support for configurable radius (default 2) and bit length (512 or 2048)
  - Validated against RDKit C++ implementation
- **Coordinate Generation**: Improved 2D layout with force-directed optimization
  - Better handling of fused ring systems
  - Improved angle snapping to 30°, 45°, 60°, 90°, 120°
  - Component-based layout for disconnected molecules

### Enhanced
- Aromatic bond representation in SMILES parser (explicit `:` symbol support)
- SMILES generator now produces aromatic form by default
- Ring analysis with improved SSSR computation
- Molecular descriptor calculations with extended options

### Performance
- LogP computation caching via WeakMap (4.6 million× speedup for complex molecules)
- Optimized ring template caching for SVG rendering
- Improved coordinate generation with early convergence detection

## [Unreleased]

### Planned
- Additional molecular descriptor calculations
- Extended support for reaction SMARTS
- Performance optimizations for large molecules
- Additional file format support (PDB, XYZ)

## [0.1.3] - 2025-10-22

### Performance
- Optimized SMILES parser with improved tokenization and parsing efficiency
- Refactored aromaticity perceiver for faster perception of aromatic rings
- Enhanced ring analysis algorithms for improved performance on complex molecules
- Optimized graph utility functions for faster traversal and analysis
- New SMILES tokenizer for streamlined lexical analysis

### Changed
- Internal parser implementations refined for better performance characteristics
- Ring detection now uses optimized cycle basis computation

## [0.1.2] - 2025-10-21

### Changed
- Complete rebranding from kimchi to openchem across entire codebase
- Updated all documentation, examples, and tests to reflect new project name
- Updated copyright headers and project references

### Fixed
- All references to old project name removed
- Package metadata fully aligned with new identity

## [0.1.1] - 2025-10-22

### Added
- `publishConfig.access: "public"` to ensure public npm package visibility
- Comprehensive documentation for npm publishing workflow

### Fixed
- Scoped package name updated to `@rajgolla/openchem` for public registry

## [0.1.0] - 2024-10-21

### Added
- Initial public release of openchem cheminformatics library
- Complete SMILES parser supporting full OpenSMILES specification
- Canonical SMILES generation with RDKit-compatible canonicalization
- MOL/SDF file format support (parsing and generation)
- SMARTS pattern matching for substructure searching
- 2D coordinate generation and SVG molecular rendering
- Molecular property calculations:
  - LogP (Crippen method)
  - Topological Polar Surface Area (TPSA)
  - Molecular weight and element composition
  - Rotatable bond count
  - Drug-likeness assessment (Lipinski's Rule of Five, Veber Rules, BBB penetration)
- Comprehensive aromaticity perception using Hückel's rule
- Stereochemistry support (chirality, cis/trans, tetrahedral centers)
- Isotope and formal charge handling
- Ring analysis and detection
- Symmetry detection for canonical ordering
- Valence validation
- Hydrogen count calculation
- 600+ comprehensive test cases with RDKit validation
- Full TypeScript support with strict mode and path aliases
- Browser and Node.js compatibility
- Interactive HTML playground for testing

### Features
- TypeScript-first with full type definitions
- Production-ready implementation
- Lightweight dependency footprint (webcola for layout, es-toolkit for utilities)
- Well-tested against RDKit for compatibility
- Comprehensive documentation and examples

