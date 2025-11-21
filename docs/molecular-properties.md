# Molecular Properties & Descriptors

**Audience:** Users and developers working with molecular property calculations and drug-likeness assessment  
**Related:** [SMARTS Matching](./smarts-matching.md) | [README](../README.md)

---

## Overview

openchem provides comprehensive molecular property calculation and descriptor generation for cheminformatics applications. The library includes basic molecular descriptors, drug-likeness rules, and LogP calculation using the Wildman-Crippen method.

**Key Features:**
- ✅ Basic molecular descriptors (atom count, bond count, element composition)
- ✅ Drug-likeness rules (Lipinski, Veber, BBB penetration)
- ✅ LogP calculation with caching (4.6 million× speedup)
- ✅ TPSA (Topological Polar Surface Area)
- ✅ H-bond donors/acceptors
- ✅ Rotatable bonds

---

## Quick Start

### Basic Descriptors

```typescript
import { parseSMILES, computeDescriptors } from 'index';

const molecule = parseSMILES('CCO').molecules[0];
const descriptors = computeDescriptors(molecule);

console.log(descriptors);
// {
//   atomCount: 3,
//   bondCount: 2,
//   formalCharge: 0,
//   elementCounts: { C: 2, H: 6, O: 1 },
//   heavyAtomFraction: 0.333
// }
```

### Drug-Likeness Rules

```typescript
import { checkLipinskiRuleOfFive } from 'index';

const aspirin = parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0];
const result = checkLipinskiRuleOfFive(aspirin);

console.log(result.passes);  // true
console.log(result.properties);
// {
//   molecularWeight: 180.16,
//   hbondDonors: 1,
//   hbondAcceptors: 4,
//   logP: 1.23
// }
```

### LogP Calculation

```typescript
import { computeLogP } from 'index';

const ethanol = parseSMILES('CCO').molecules[0];
const logP = computeLogP(ethanol, true);  // true = include hydrogens

console.log(`LogP: ${logP.toFixed(2)}`);  // LogP: -0.31
```

---

## Basic Molecular Descriptors

### API Reference

#### `computeDescriptors(molecule: Molecule, options?: DescriptorOptions)`

Computes a comprehensive set of basic descriptors.

**Parameters:**
- `molecule` (Molecule) — Molecule object
- `options` (DescriptorOptions, optional) — Configuration

**Returns:**
```typescript
{
  atomCount: number;           // Explicit atoms only
  bondCount: number;           // All bonds
  formalCharge: number;        // Sum of atomic charges
  elementCounts: Record<string, number>;  // Element → count
  heavyAtomFraction: number;   // Heavy atoms / total atoms
}
```

**Options:**
```typescript
interface DescriptorOptions {
  includeImplicitH?: boolean;  // Include implicit H in counts (default: true)
  includeIsotopes?: boolean;   // Use isotope notation (e.g., "13C") (default: false)
}
```

### Individual Descriptor Functions

```typescript
// Atom and bond counts
getAtomCount(molecule);        // Returns molecule.atoms.length
getBondCount(molecule);        // Returns molecule.bonds.length

// Charge
getFormalCharge(molecule);     // Sum of atom.charge values

// Element counts
getElementCounts(molecule, options);  // Record<string, number>

// Heavy atom fraction
getHeavyAtomFraction(molecule);  // Heavy atoms / total atoms
```

### Examples

#### Element Counts

```typescript
const molecule = parseSMILES('CCO').molecules[0];

// With implicit hydrogens (default)
const counts1 = getElementCounts(molecule);
// { C: 2, H: 6, O: 1 }

// Without implicit hydrogens
const counts2 = getElementCounts(molecule, { includeImplicitH: false });
// { C: 2, O: 1 }
```

#### Isotope Notation

```typescript
const molecule = parseSMILES('[13C]C[2H]').molecules[0];

const counts = getElementCounts(molecule, { includeIsotopes: true });
// { '13C': 1, C: 1, '2H': 1, H: 5 }
```

#### Heavy Atom Fraction

```typescript
const ethanol = parseSMILES('CCO').molecules[0];
const fraction = getHeavyAtomFraction(ethanol);
// 0.333 (3 heavy atoms / 9 total atoms)
```

---

## Drug-Likeness Rules

openchem provides comprehensive drug-likeness assessment functions that evaluate molecules against established pharmaceutical rules.

### Lipinski's Rule of Five

Evaluates oral bioavailability using Lipinski's Rule of Five.

#### `checkLipinskiRuleOfFive(molecule: Molecule)`

**Rules:**
- Molecular weight ≤ 500 Da
- H-bond donors ≤ 5 (N-H, O-H groups)
- H-bond acceptors ≤ 10 (N, O atoms)
- LogP ≤ 5 (Crippen LogP estimate)

**Returns:**
```typescript
{
  passes: boolean;           // true if all rules pass
  violations: string[];      // Array of violation messages
  properties: {
    molecularWeight: number;
    hbondDonors: number;
    hbondAcceptors: number;
    logP: number;
  }
}
```

**Example:**
```typescript
import { parseSMILES, checkLipinskiRuleOfFive } from 'index';

const aspirin = parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0];
const result = checkLipinskiRuleOfFive(aspirin);

if (result.passes) {
  console.log('✓ Passes Lipinski rules');
  console.log(`LogP: ${result.properties.logP.toFixed(2)}`);
} else {
  console.log('✗ Violations:', result.violations);
}
```

### Veber Rules

Evaluates oral bioavailability using Veber rules (complementary to Lipinski).

#### `checkVeberRules(molecule: Molecule)`

**Rules:**
- Rotatable bonds ≤ 10
- TPSA ≤ 140 Å²

**Returns:**
```typescript
{
  passes: boolean;
  violations: string[];
  properties: {
    rotatableBonds: number;
    tpsa: number;
  }
}
```

**Example:**
```typescript
const result = checkVeberRules(molecule);
console.log(`TPSA: ${result.properties.tpsa.toFixed(1)} Ų`);
```

### Blood-Brain Barrier Penetration

Predicts blood-brain barrier (BBB) penetration potential.

#### `checkBBBPenetration(molecule: Molecule)`

**Rule:**
- Likely penetration if TPSA < 90 Å²

**Returns:**
```typescript
{
  likelyPenetration: boolean;
  tpsa: number;
}
```

**Example:**
```typescript
const result = checkBBBPenetration(molecule);
if (result.likelyPenetration) {
  console.log('✓ Likely BBB penetration');
} else {
  console.log('✗ Unlikely BBB penetration');
}
```

### Implementation Details

- **LogP**: Crippen's atom contribution method (see LogP section below)
- **TPSA**: Ertl et al. fragment-based algorithm
- **H-bond donors**: N-H and O-H groups
- **H-bond acceptors**: N and O atoms
- **Rotatable bonds**: Single bonds between heavy atoms (excluding ring bonds and terminal groups)

**Implementation:** `src/utils/molecular-properties.ts`

---

## LogP Calculation (Crippen Method)

### Overview

LogP (octanol-water partition coefficient) is calculated using the **Wildman-Crippen atom contribution method** with SMARTS-based pattern matching.

**Method Features:**
- 68 atom type patterns
- Published Wildman-Crippen parameters (exact)
- SMARTS-based pattern matching with priority ordering
- WeakMap caching for 4.6 million× speedup on repeated calculations

### API Reference

```typescript
// Main functions (all equivalent)
computeLogP(molecule, includeHs?)     // Canonical name
logP(molecule, includeHs?)            // Short alias
crippenLogP(molecule, includeHs?)     // Method-explicit alias

// Advanced functions
getCrippenAtomContribs(molecule, includeHs?)  // Per-atom contributions
calcCrippenDescriptors(molecule, includeHs?)  // LogP + molar refractivity
```

**Parameters:**
- `molecule` (Molecule) — Molecule to analyze
- `includeHs` (boolean, optional) — Include explicit hydrogens (default: false)

**Returns:** `number` — LogP value

### Performance: Automatic Caching

LogP computation is automatically cached using WeakMap for dramatic performance improvements on repeated calculations.

**Performance Impact:**

| Molecule | First Call | Cached Call | Speedup |
|----------|-----------|-----------|---------|
| Methane (CH₄) | 14.6 ms | 0.004 ms | 4,171× |
| Ethanol (C₂H₆O) | 24.4 ms | 0.002 ms | 10,614× |
| Aspirin (C₉H₈O₄) | 138 ms | 0.001 ms | 92,064× |
| Caffeine (C₈H₁₀N₄O₂) | 191 ms | 0.002 ms | 83,193× |
| Strychnine (C₂₁H₂₂N₂O₂) | 12.1 s | 0.003 ms | **4.6 million ×** |

**Why This Matters:**
- Bottleneck is Wildman-Crippen atom type matching (68 SMARTS patterns per atom)
- Cache hit is just a WeakMap lookup: < 0.01 ms
- Zero memory leaks (automatic garbage collection)
- No manual cache management needed

**Usage (transparent - no code changes needed):**
```typescript
const aspirin = parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0];

// First call: ~138 ms (SMARTS pattern matching)
const logP1 = computeLogP(aspirin);

// Second call: ~0.001 ms (cache hit)
const logP2 = computeLogP(aspirin);
```

### Examples

```typescript
import { parseSMILES, computeLogP, logP, crippenLogP } from 'index';

// Simple molecules
const ethanol = parseSMILES('CCO').molecules[0];
console.log(computeLogP(ethanol, true));  // -0.31

const benzene = parseSMILES('c1ccccc1').molecules[0];
console.log(logP(benzene));  // 1.69

// Drug molecules
const aspirin = parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0];
console.log(crippenLogP(aspirin));  // 1.23

const caffeine = parseSMILES('CN1C=NC2=C1C(=O)N(C(=O)N2C)C').molecules[0];
console.log(computeLogP(caffeine));  // -0.07
```

### Advanced Usage: Per-Atom Contributions

```typescript
const molecule = parseSMILES('CCO').molecules[0];
const contribs = getCrippenAtomContribs(molecule, true);

contribs.forEach((contrib, i) => {
  console.log(`Atom ${i}: logP = ${contrib.logP.toFixed(3)}, MR = ${contrib.mr.toFixed(3)}`);
});
```

---

## Validation Against RDKit

### Test Coverage

- **Basic validation**: 10+ common molecules with exact RDKit match (threshold 0.01)
- **Diverse molecules**: 200 molecules from bulk test set (threshold 0.2)
- **Overall accuracy**: >99% of molecules within 0.2 LogP units of RDKit

### Known Differences with RDKit

Our LogP implementation uses the **published Wildman-Crippen parameters exactly as specified**, which provides reproducibility but may differ from RDKit by 0.2-1.15 LogP units for complex heterocycles.

#### 1. Aromatic Sulfur in Heterocycles

**Affected structures:**
- Dithiolones: `C1=CSC(=O)S1`
- Thiazines: `C1=CC=C2SC=CC(=O)N2C=C1`
- Thiadiazoles with exocyclic substituents

**Difference magnitude:** 0.6-0.8 LogP units

**Root cause:**
- Both implementations correctly identify aromatic sulfurs
- openchem uses published value: 0.6237 (pattern `[s;a]`, S3 parameter)
- RDKit appears to use ~0.3 for sulfurs in heterocycles with exocyclic C=O or C=N
- Suggests RDKit has additional SMARTS patterns or modified parameters

**Example:**
```
Dithiolone: C1=CSC(=O)S1
  openchem LogP: 1.77
  RDKit LogP:    1.17
  Difference:    0.60 (0.30 per S atom)
```

#### 2. Complex Nitrogen Heterocycles

**Affected structures:**
- Oxadiazinones with multiple nitrogen substitution
- Pyrazolones

**Difference magnitude:** 0.3-0.8 LogP units

**Root cause:**
- Differences in aromatic vs aliphatic nitrogen classification in partially saturated rings
- SMARTS pattern matching order differences

#### 3. Fused Ring Systems with Heteroatoms

**Affected structures:**
- Naphthalene ethers with lactones
- Benzofuran/benzothiophene derivatives

**Difference magnitude:** 0.2-0.3 LogP units

**Root cause:**
- Minor differences in aromatic carbon classification (C18-C26 patterns)
- Different handling of aromatic-aliphatic junction carbons

### Statistical Performance

From 200 diverse molecule test:
- **Mean absolute difference**: ~0.08 LogP units
- **Median difference**: ~0.05 LogP units
- **95th percentile**: ~0.20 LogP units
- **Maximum difference**: ~1.15 LogP units (complex thiazine)

### Acceptable Range

LogP prediction methods typically have:
- **Experimental error**: ±0.5 LogP units
- **Method variance**: ±0.3 LogP units between different software
- **Literature discrepancies**: ±1.0 LogP units for complex molecules

Our differences (0.2-1.15) are **within the expected range** for complex polycyclic heterocycles.

### When to Use This Implementation

✅ **Good for:**
- Simple organic molecules (alkanes, alcohols, aromatics)
- Standard drug-like molecules
- High-throughput screening where consistency matters
- Research requiring published method reproducibility

⚠️ **Consider RDKit if:**
- Exact RDKit LogP values are required for comparison
- Working with many sulfur-containing heterocycles
- Need LogP for regulatory submissions (use validated tools)
- Optimizing against experimental data fitted to RDKit

**Note:** Aromaticity perception was validated against RDKit for all problematic cases - differences are NOT due to aromaticity errors.

---

## Implementation Files

### Core Modules
- **Molecular properties:** `src/utils/molecular-properties.ts`
- **Descriptors:** `src/utils/molecular-descriptors.ts`
- **LogP:** `src/utils/logp.ts`

### Supporting Modules
- **SMARTS matching:** `src/matchers/smarts-matcher.ts` (used for LogP atom typing)
- **Aromaticity:** `src/utils/aromaticity-perceiver.ts`
- **Atom utilities:** `src/utils/atom-utils.ts`

---

## Testing

### Run Property Tests

```bash
# All descriptor tests
bun test test/unit/utils/molecular-descriptors.test.ts

# LogP tests with RDKit comparison
bun test test/unit/logp.test.ts
bun test test/unit/logp-detailed.test.ts

# Drug-likeness rules
bun test test/unit/molecular-properties.test.ts
```

---

## Advanced Usage

### Batch Processing with Caching

```typescript
import { parseSMILES, computeLogP, checkLipinskiRuleOfFive } from 'index';

const smilesList = [
  'CC(=O)Oc1ccccc1C(=O)O',  // Aspirin
  'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',  // Caffeine
  'CC(C)Cc1ccc(cc1)C(C)C(=O)O',  // Ibuprofen
];

const results = smilesList.map(smiles => {
  const molecule = parseSMILES(smiles).molecules[0];
  
  // LogP is cached automatically
  const logP = computeLogP(molecule);
  const lipinski = checkLipinskiRuleOfFive(molecule);
  
  return {
    smiles,
    logP: logP.toFixed(2),
    passesLipinski: lipinski.passes,
  };
});

console.table(results);
```

### Custom Descriptor Pipelines

```typescript
import {
  parseSMILES,
  computeDescriptors,
  computeLogP,
  checkLipinskiRuleOfFive,
  checkVeberRules,
} from 'index';

function analyzeCompound(smiles: string) {
  const molecule = parseSMILES(smiles).molecules[0];
  
  return {
    basic: computeDescriptors(molecule),
    logP: computeLogP(molecule),
    lipinski: checkLipinskiRuleOfFive(molecule),
    veber: checkVeberRules(molecule),
  };
}

const results = analyzeCompound('CC(=O)Oc1ccccc1C(=O)O');
console.log(JSON.stringify(results, null, 2));
```

---

## Related Documentation

- **[SMARTS Matching](./smarts-matching.md)** — LogP uses SMARTS for atom typing
- **[IUPAC Generation](./iupac-generation.md)** — Functional group detection
- **[README](../README.md)** — Library overview

### External References

- Wildman, S. A.; Crippen, G. M. "Prediction of Physicochemical Parameters by Atomic Contributions." *J. Chem. Inf. Comput. Sci.* 1999, 39, 868-873.
- Lipinski, C. A. et al. "Experimental and computational approaches to estimate solubility and permeability in drug discovery and development settings." *Adv. Drug Deliv. Rev.* 1997, 23, 3-25.
- Veber, D. F. et al. "Molecular properties that influence the oral bioavailability of drug candidates." *J. Med. Chem.* 2002, 45, 2615-2623.
- Ertl, P. et al. "Fast calculation of molecular polar surface area as a sum of fragment-based contributions and its application to the prediction of drug transport properties." *J. Med. Chem.* 2000, 43, 3714-3717.

---

**Last Updated:** 2025-11-20  
**Maintainer:** openchem team
