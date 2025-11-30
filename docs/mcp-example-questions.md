# OpenChem MCP Server - Example Questions

Simple questions to demonstrate OpenChem MCP capabilities. Copy and paste these into your AI assistant (Claude, ChatGPT, etc.).

---

## Basic Analysis

**1. What are the drug-likeness properties of caffeine?**
```
SMILES: CN1C=NC2=C1C(=O)N(C(=O)N2C)C
```

**2. Compare aspirin and ibuprofen. Which is more drug-like?**
```
Aspirin: CC(=O)Oc1ccccc1C(=O)O
Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O
```

**3. What are all the molecular descriptors for morphine?**
```
SMILES: CN1CC[C@]23[C@@H]4[C@H]1CC5=C2C(=C(C=C5)O)O[C@H]3[C@H](C=C4)O
```

---

## Parsing & Format Conversion

**4. Parse this IUPAC name and convert to SMILES: 2-methylpropan-1-ol**

**5. Parse this IUPAC name: N-[(2S)-1-[[(2S,3R)-1-[[(2S)-1-[[(2S)-1-amino-3-methyl-1-oxobutan-2-yl]amino]-3-methyl-1-oxobutan-2-yl]amino]-3-hydroxy-1-oxobutan-2-yl]amino]-3-methyl-1-oxobutan-2-yl]-1-phenylmethanamine**

**6. Convert benzene to MOL file format.**
```
SMILES: c1ccccc1
```

**7. Parse this MOL file and convert to canonical SMILES.**
```
[paste MOL file content]
```

---

## Substructure Search

**8. Find all benzene rings in celecoxib.**
```
SMILES: CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F
SMARTS: c1ccccc1
```

**9. Does morphine contain a tertiary amine? Use SMARTS: [N;X3]([C,H])([C,H])[C,H]**
```
SMILES: CN1CC[C@]23[C@@H]4[C@H]1CC5=C2C(=C(C=C5)O)O[C@H]3[C@H](C=C4)O
```

**10. Count how many carboxylic acid groups in aspirin.**
```
SMILES: CC(=O)Oc1ccccc1C(=O)O
SMARTS: C(=O)O
```

---

## Visualization & Highlighting

**11. Show me benzene and cyclohexane as images.**
```
Benzene: c1ccccc1
Cyclohexane: C1CCCCC1
```

**12. Render celecoxib and highlight the sulfonamide group (yellow) and trifluoromethyl group (blue).**
```
SMILES: CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F
Sulfonamide: S(=O)(=O)N
Trifluoromethyl: C(F)(F)F
```

**13. Render morphine with all hydroxyl groups highlighted in red.**
```
SMILES: CN1CC[C@]23[C@@H]4[C@H]1CC5=C2C(=C(C=C5)O)O[C@H]3[C@H](C=C4)O
SMARTS: [OH]
```

---

## Identifiers & Database Lookup

**14. Generate InChI and InChIKey for aspirin.**
```
SMILES: CC(=O)Oc1ccccc1C(=O)O
```

**15. Generate all identifiers (InChI, InChIKey, IUPAC, formula) for caffeine.**
```
SMILES: CN1C=NC2=C1C(=O)N(C(=O)N2C)C
```

**16. What's the molecular formula and IUPAC name of benzene?**
```
SMILES: c1ccccc1
```

---

## Molecular Similarity

**17. How similar is ibuprofen to naproxen using Morgan fingerprints?**
```
Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O
Naproxen: CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O
```

**18. Compare aspirin, ibuprofen, and naproxen. Which two are most similar?**
```
Aspirin: CC(=O)Oc1ccccc1C(=O)O
Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O
Naproxen: CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O
```

---

## Tautomers & Scaffolds

**19. What are the tautomers of guanine? Which is most stable?**
```
SMILES: NC1=Nc2c(ncn2)C(=O)N1
```

**20. Extract the Murcko scaffold from ibuprofen.**
```
SMILES: CC(C)Cc1ccc(cc1)C(C)C(=O)O
```

**21. Get the Bemis-Murcko framework and scaffold tree for morphine.**
```
SMILES: CN1CC[C@]23[C@@H]4[C@H]1CC5=C2C(=C(C=C5)O)O[C@H]3[C@H](C=C4)O
```

---

## Batch Operations (Virtual Screening)

**22. Which of these molecules are drug-like (Lipinski's Rule of Five)?**
```
Caffeine: CN1C=NC2=C1C(=O)N(C(=O)N2C)C
Aspirin: CC(=O)Oc1ccccc1C(=O)O
Morphine: CN1CC[C@]23[C@@H]4[C@H]1CC5=C2C(=C(C=C5)O)O[C@H]3[C@H](C=C4)O
Benzene: c1ccccc1
```

**23. Find all molecules in this library that contain a sulfonamide group.**
```
Library:
- Celecoxib: CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F
- Aspirin: CC(=O)Oc1ccccc1C(=O)O
- Sulfanilamide: NC1=CC=C(C=C1)S(=O)(=O)N
- Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O

SMARTS: S(=O)(=O)N
```

**24. Find molecules similar to aspirin (similarity > 0.5) in this library.**
```
Query: CC(=O)Oc1ccccc1C(=O)O (aspirin)

Library:
- Salicylic acid: OC(=O)c1ccccc1O
- Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O
- Paracetamol: CC(=O)Nc1ccc(O)cc1
- Benzoic acid: OC(=O)c1ccccc1
```

---

## Complex Workflows

**25. Complete drug analysis for celecoxib:**
- Parse IUPAC name (if provided) or SMILES
- Generate all identifiers (InChI, InChIKey, IUPAC, formula)
- Compute drug-likeness (Lipinski, Veber, BBB)
- Find all functional groups (sulfonamide, trifluoromethyl, aromatic rings)
- Extract Murcko scaffold
- Render with highlighted functional groups
- Export to SDF format

```
SMILES: CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F
```

**26. Compare three NSAIDs side-by-side:**
- Compute and compare all properties
- Calculate pairwise similarity
- Render all three with carboxylic acid groups highlighted
- Identify common Murcko scaffold

```
Aspirin: CC(=O)Oc1ccccc1C(=O)O
Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O
Naproxen: CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O
```

---

## Available Tools (9 total)

- **parse** - Universal parser (SMILES, IUPAC, MOL, SDF) with auto-detection
- **analyze** - Comprehensive properties (40+ descriptors across 6 categories)
- **compare** - Side-by-side comparison (fingerprints, Tanimoto similarity)
- **search** - Substructure matching (SMARTS patterns with match reporting)
- **identifiers** - Standard identifiers (InChI, InChIKey, IUPAC, canonical SMILES)
- **tautomers** - Tautomer enumeration and scoring (25 rules, RDKit-compatible)
- **scaffold** - Murcko scaffolds and frameworks (scaffold trees, generic frameworks)
- **render** - 2D visualization (SVG/PNG, substructure highlighting)
- **bulk** - Batch operations (SMARTS matching, similarity, drug-likeness)

---

## Tips

- **Start simple:** Try basic analysis first (Questions 1-3)
- **Use IUPAC names:** The parser now supports IUPAC → SMILES conversion (Questions 4-5)
- **Highlighting:** Use SMARTS patterns to highlight functional groups (Questions 12-13)
- **Batch operations:** Process multiple molecules efficiently (Questions 22-24)
- **Complex workflows:** Combine multiple tools for comprehensive analysis (Questions 25-26)

**Common SMARTS Patterns:**
- Carboxylic acid: `C(=O)O` or `C(=O)[OH]`
- Benzene ring: `c1ccccc1`
- Sulfonamide: `S(=O)(=O)N`
- Hydroxyl: `[OH]`
- Primary amine: `[NH2]`
- Tertiary amine: `[N;X3]([C,H])([C,H])[C,H]`
- Carbonyl: `C=O`
- Ester: `C(=O)O[C,H]`
