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

**3. Find all carboxylic acid groups (SMARTS: C(=O)O) in naproxen.**
```
SMILES: CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O
```

---

## Visualization

**4. Show me benzene and cyclohexane as images and compare their properties.**
```
Benzene: c1ccccc1
Cyclohexane: C1CCCCC1
```

**5. Render aspirin, ibuprofen, and naproxen in a grid and highlight all carboxylic acid groups in red.**
```
Aspirin: CC(=O)Oc1ccccc1C(=O)O
Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O
Naproxen: CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O
SMARTS: C(=O)O
```

**6. Render celecoxib and highlight the sulfonamide group (yellow) and trifluoromethyl group (blue).**
```
SMILES: CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F
Sulfonamide: S(=O)(=O)N
Trifluoromethyl: C(F)(F)F
```

---

## Identifiers & Conversion

**7. Generate InChI and InChIKey for aspirin.**
```
SMILES: CC(=O)Oc1ccccc1C(=O)O
```

**8. Convert benzene to MOL file format.**
```
SMILES: c1ccccc1
```

**9. Export benzene, toluene, and naphthalene to SDF format.**
```
Benzene: c1ccccc1
Toluene: Cc1ccccc1
Naphthalene: c1ccc2ccccc2c1
```

---

## Tautomers & Scaffolds

**10. What are the tautomers of guanine?**
```
SMILES: NC1=Nc2c(ncn2)C(=O)N1
```

**11. Extract the Murcko scaffold from ibuprofen.**
```
SMILES: CC(C)Cc1ccc(cc1)C(C)C(=O)O
```

---

## Complex Workflow

**12. Analyze celecoxib: drug-likeness, find sulfonamide groups, compare to aspirin, render both with highlights, and export to SDF.**
```
Celecoxib: CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F
Aspirin: CC(=O)Oc1ccccc1C(=O)O
Sulfonamide SMARTS: S(=O)(=O)N
```

---

## Tips

- **Start simple:** Try basic analysis first
- **Use highlighting:** Questions with "highlight" showcase the visual features
- **Multi-molecule grids:** Great for comparing drug analogs
- **Combine tools:** Ask complex questions that require multiple operations
- **SMARTS patterns:** Use for substructure searching and highlighting
  - Carboxylic acid: `C(=O)O`
  - Benzene ring: `c1ccccc1`
  - Sulfonamide: `S(=O)(=O)N`
  - Hydroxyl: `[OH]`
  - Amine: `N`
