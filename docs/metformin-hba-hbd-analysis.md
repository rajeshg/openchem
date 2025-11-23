# Metformin HBA/HBD Analysis

## Chemical Structure

**SMILES:** `CN(C)C(=N)NC(=N)N`  
**IUPAC Name:** N,N-dimethylimidodicarbonimidic diamide  
**Common Name:** Metformin (biguanide antidiabetic drug)

**Structure:**
```
     NH2
      |
  N=C-NH-C=N
 /          \
CH3         NH2
|
CH3
```

**Functional Groups:**
- N,N-Dimethyl tertiary amine: N(CH3)2
- Two guanidine/imine groups: C(=NH)-NH-C(=NH)-NH2
- Terminal primary amine: -NH2

---

## Hydrogen Bond Donor/Acceptor Counting

### openchem/RDKit Values

| Property | openchem | RDKit | Match? |
|----------|----------|-------|--------|
| **HBA** | 2 | 2 | ✅ |
| **HBD** | 4 | 4 | ✅ |
| **MW** | 129.17 | 129.17 | ✅ |
| **LogP** | -1.03 | -1.03 | ✅ |

### Literature/PubChem Values

| Property | PubChem | Difference |
|----------|---------|------------|
| **HBA** | 1 | Δ = 1 |
| **HBD** | 3 | Δ = 1 |
| **MW** | 129.16 | Δ = 0.01 |
| **LogP** | -1.43 | Δ = 0.40 |

---

## Atom-by-Atom Analysis

### Nitrogen Atoms in Metformin

| Atom | Structure | H Count | Valence | openchem HBA | openchem HBD | RDKit HBA | RDKit HBD |
|------|-----------|---------|---------|--------------|--------------|-----------|-----------|
| N#1 | N(CH3)2 | 0 | 3 | ❌ (tertiary) | ❌ (no H) | ❌ | ❌ |
| N#4 | C=NH | 1 | 3 | ✅ (imine) | ✅ (1 site) | ✅ | ✅ |
| N#5 | C-NH-C | 1 | 3 | ❌ (excluded*) | ✅ (1 site) | ❌ | ✅ |
| N#7 | C=NH | 1 | 3 | ✅ (imine) | ✅ (1 site) | ✅ | ✅ |
| N#8 | C-NH2 | 2 | 3 | ❌ (excluded*) | ✅ (1 site) | ❌ | ✅ |

**Total:** HBA = 2, HBD = 4

*\*Excluded from HBA because bonded to carbon with C=N double bond (amide/guanidine resonance)*

---

## Key Insights

### 1. HBA Counting (Acceptors)

**Why only 2 HBA, not all 5 nitrogens?**

RDKit's HBA SMARTS: `$([N;v3;!$(N-*=!@[O,N,P,S])])`

Translation: "N with valence 3, where N is NOT **single-bonded** to something with a double bond to O/N/P/S"

- **N#1 (tertiary amine)**: Excluded — tertiary amines have no lone pair available for H-bonding (3 bonds, no space)
- **N#4 (imine C=NH)**: ✅ INCLUDED — The N=C bond is a double bond, not a single bond, so the exclusion rule doesn't apply
- **N#5 (secondary amine)**: ❌ EXCLUDED — Single-bonded to C#3 which has C=N double bond (amide resonance reduces lone pair availability)
- **N#7 (imine C=NH)**: ✅ INCLUDED — Same as N#4
- **N#8 (primary amine)**: ❌ EXCLUDED — Single-bonded to C#6 which has C=N double bond (guanidine resonance)

**Chemical Intuition:** In biguanides/guanidines, the lone pairs on amine nitrogens participate in resonance with the adjacent C=N groups, making them poor H-bond acceptors. Only the imine nitrogens (C=N) retain their lone pair availability.

### 2. HBD Counting (Donors)

**Why HBD=4, not 5 total N-H bonds?**

RDKit counts **donor SITES** (atoms with H), not individual H atoms!

- **N#4 (C=NH)**: 1 HBD site (has 1 H)
- **N#5 (C-NH-C)**: 1 HBD site (has 1 H)
- **N#7 (C=NH)**: 1 HBD site (has 1 H)  
- **N#8 (C-NH2)**: 1 HBD site (has 2 H, but counts as 1 **site**)

**Total:** 4 HBD sites (not 5 H atoms)

**Note:** RDKit does NOT count water (OH2) or ammonia (NH3) as HBD because the SMARTS requires **exactly 1 H** (`O&H1`, not `O&!H0`). This is intentional — molecules with 2+ H atoms on a single heteroatom are excluded.

### 3. Why PubChem/Literature Values Differ

**PubChem HBA = 1 (vs openchem/RDKit = 2):**
- Likely counts only the "strongest" acceptor (e.g., central secondary amine N#5)
- May exclude imine nitrogens due to different definition of "acceptor"

**PubChem HBD = 3 (vs openchem/RDKit = 4):**
- Likely counts **functional groups** (3: one -NH- and two -NH2 groups)
- OR counts only "strong" donors, excluding one of the imines

**Root Cause:**
Different tools use different definitions:
- **RDKit/openchem**: SMARTS-based pattern matching (structural)
- **PubChem**: May use accessibility-based methods (consider steric/electronic effects)
- **Literature**: Hand-counted using chemical intuition

---

## Implementation Details (openchem)

### Bug Found and Fixed

**Issue:** Initial implementation was excluding imine nitrogens (C=NH) from HBA count.

**Root Cause:** Code was checking ALL bonds from N, not just single bonds. The SMARTS pattern `N-*=` specifically requires a **single bond** (`-`) from N before checking for double bonds.

**Fix Applied:**
```typescript
// Only check single bonds from N (SMARTS: N-*)
if (bond.type !== "single") continue;
```

After fix:
- Imine nitrogens (N#4, N#7) with double bonds to carbon are now correctly included as HBA
- Secondary/primary amines (N#5, N#8) bonded to carbons with C=N are correctly excluded

---

## Conclusion

**openchem now matches RDKit exactly for Metformin:**
- ✅ HBA = 2 (imine nitrogens)
- ✅ HBD = 4 (all N-H containing nitrogens, counted as sites)
- ✅ Molecular weight = 129.17 Da
- ✅ LogP = -1.03

**Difference from literature values is expected and documented.** Different tools define HBA/HBD differently based on:
1. Structural patterns (SMARTS-based)
2. Chemical accessibility (steric/electronic)
3. Functional group classification

openchem prioritizes **RDKit compatibility** for consistency with the most widely-used open-source cheminformatics toolkit.

---

**References:**
- RDKit SMARTS patterns: `rdkit/Code/GraphMol/Descriptors/Lipinski.cpp`
- Lipinski, C. A. et al. *Adv. Drug Deliv. Rev.* 1997, 23, 3-25.
- PubChem CID 4091 (Metformin)

**Date:** November 22, 2025
