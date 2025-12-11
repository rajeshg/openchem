# OpenChem MCP - Missing Features Proposal

## Current Status

**Exposed (5 tools)**:

1. ✅ `analyze` - Descriptors, drug-likeness, IUPAC names
2. ✅ `compare` - Morgan fingerprints, Tanimoto similarity
3. ✅ `search` - SMARTS substructure matching
4. ✅ `render` - SVG/PNG visualization
5. ✅ `convert` - Canonical SMILES, IUPAC, Murcko scaffolds

**Coverage**: ~40% of openchem capabilities

---

## Missing Capabilities (Priority Ranked)

### 🔴 HIGH PRIORITY - User-Facing, High Impact

#### 1. **Tautomer Enumeration & Canonicalization**

**OpenChem APIs**: `enumerateTautomers()`, `canonicalTautomer()`  
**Why Critical**: Essential for drug discovery, tautomers affect docking/binding  
**Use Cases**:

- "What are the tautomers of this drug?"
- "Is this the canonical tautomer?"
- "Score tautomers for stability"

**Proposed Tool**: `tautomers`

```typescript
{
  name: "tautomers",
  description: "Enumerate and score all tautomers (keto-enol, imine-enamine, amide-imidol). Returns canonical tautomer with RDKit-compatible scoring.",
  input: {
    smiles: "CC(=O)CC(=O)C",  // β-diketone
    maxTautomers: 10,          // default: 10
    returnCanonical: true      // return highest-scored tautomer
  },
  output: {
    inputSmiles: "CC(=O)CC(=O)C",
    canonicalTautomer: "CC(O)=CC(=O)C",
    canonicalScore: 1.8,
    tautomers: [
      { smiles: "CC(O)=CC(=O)C", score: 1.8, type: "keto-enol" },
      { smiles: "CC(=O)CC(O)=C", score: 1.5, type: "keto-enol" }
    ],
    count: 2
  }
}
```

---

#### 2. **InChI & InChIKey Generation**

**OpenChem APIs**: `generateInChI()`, `generateInChIKey()`  
**Why Critical**: Standard identifiers for databases (PubChem, ChEMBL, DrugBank)  
**Use Cases**:

- "What's the InChI for this molecule?"
- "Search PubChem with this InChIKey"
- "Convert SMILES to InChI"

**Proposed Tool**: `identifiers`

```typescript
{
  name: "identifiers",
  description: "Generate standard molecular identifiers: InChI (structure layer), InChIKey (hash for database lookups), and canonical SMILES.",
  input: {
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    includeInChI: true,
    includeInChIKey: true
  },
  output: {
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    canonicalSmiles: "CC(=O)Oc1ccccc1C(=O)O",
    inchi: "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)",
    inchiKey: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
    formula: "C9H8O4",
    molecularWeight: 180.16
  }
}
```

---

#### 3. **File Format Conversion (MOL/SDF)**

**OpenChem APIs**: `generateMolfile()`, `parseMolfile()`, `parseSDF()`, `writeSDF()`  
**Why Critical**: Industry-standard formats for data exchange  
**Use Cases**:

- "Convert this SMILES to MOL format"
- "Parse this SDF file and analyze all molecules"
- "Export molecules as SDF with properties"

**Proposed Tool**: `fileConvert`

```typescript
{
  name: "fileConvert",
  description: "Convert between molecular file formats: SMILES ↔ MOL ↔ SDF. Parse multi-molecule SDF files with properties.",
  input: {
    format: "molfile",  // "molfile" | "sdf"
    smiles: "c1ccccc1",
    includeProperties: true,
    properties: { "Name": "Benzene", "CAS": "71-43-2" }
  },
  output: {
    format: "molfile",
    content: "...\n  6  6  0  0  0  0...",  // MOL file content
    molecularWeight: 78.11,
    formula: "C6H6"
  }
}
```

---

#### 4. **Bulk Operations**

**OpenChem APIs**: `bulkMatchSMARTS()`, `bulkComputeProperties()`, `bulkComputeSimilarities()`, `bulkFilterDrugLike()`  
**Why Critical**: Performance optimization for large datasets  
**Use Cases**:

- "Analyze 1000 molecules from this dataset"
- "Filter drug-like compounds from library"
- "Find similar molecules in batch"

**Proposed Tool**: `batch`

```typescript
{
  name: "batch",
  description: "Process multiple molecules efficiently: compute properties, filter by drug-likeness, match patterns, compute similarities. Optimized for 100-10,000 molecules.",
  input: {
    operation: "filterDrugLike",  // "properties" | "filterDrugLike" | "similarity" | "smarts"
    smiles: ["CC(=O)Oc1ccccc1C(=O)O", "CC(C)Cc1ccc(cc1)C(C)C(=O)O", ...],
    filters: {
      lipinski: true,
      veber: true,
      logP: { min: -0.5, max: 5.0 }
    }
  },
  output: {
    processed: 1000,
    matched: 823,
    molecules: [
      { smiles: "...", properties: {...}, passes: true },
      ...
    ],
    summary: {
      passLipinski: 823,
      passVeber: 891,
      averageLogP: 2.3
    }
  }
}
```

---

### 🟡 MEDIUM PRIORITY - Specialized Chemistry

#### 5. **Advanced Scaffold Analysis**

**OpenChem APIs**: `getScaffoldTree()`, `getBemisMurckoFramework()`, `getGraphFramework()`, `haveSameScaffold()`  
**Why Useful**: Drug discovery, series analysis  
**Use Cases**:

- "Build scaffold tree for this compound series"
- "Do these drugs share the same scaffold?"
- "Extract generic framework"

**Proposed Tool**: `scaffolds` (enhancement to existing `convert`)

```typescript
{
  name: "scaffolds",
  description: "Advanced scaffold analysis: Murcko scaffold, Bemis-Murcko framework, generic framework, scaffold tree. Compare scaffold similarity.",
  input: {
    smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
    includeTree: true,
    compareWith: "CC(=O)Oc1ccccc1C(=O)O"
  },
  output: {
    murcko: "c1ccc(cc1)C",
    bemisMurcko: "C1CCC(CC1)C",
    graphFramework: "*C1CCC(CC1)*",
    scaffoldTree: [...],
    sharedScaffold: false
  }
}
```

---

#### 6. **IUPAC Name Parsing**

**OpenChem APIs**: `parseIUPACName()`, `IUPACTokenizer`  
**Why Useful**: Reverse lookup (name → structure)  
**Use Cases**:

- "Parse 'aspirin' to SMILES"
- "What structure is 'N,N-dimethylaniline'?"
- "Convert IUPAC name to molecular formula"

**Proposed Tool**: `parseIUPAC`

```typescript
{
  name: "parseIUPAC",
  description: "Parse IUPAC chemical names to SMILES structure. Supports systematic names, common names, and functional groups.",
  input: {
    name: "2-acetoxybenzoic acid",
    includeTokenization: false
  },
  output: {
    name: "2-acetoxybenzoic acid",
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    confidence: 0.95,
    tokens: [...],
    errors: []
  }
}
```

---

#### 7. **Ring Information & Analysis**

**OpenChem APIs**: `getRingInfo()`, `analyzeRings()`, specialized ring properties  
**Why Useful**: Ring systems are critical in drug design  
**Use Cases**:

- "Analyze ring systems in this molecule"
- "How many aromatic rings?"
- "Identify fused/spiro/bridged systems"

**Proposed Tool**: `rings`

```typescript
{
  name: "rings",
  description: "Comprehensive ring analysis: SSSR, aromatic rings, ring types (fused/spiro/bridged), ring atoms/bonds, heteroatoms in rings.",
  input: {
    smiles: "C1C2CC3CC1CC(C2)C3"  // Adamantane
  },
  output: {
    ringCount: 3,
    sssrRings: [...],
    aromaticRings: [],
    ringTypes: {
      isolated: 0,
      fused: 0,
      spiro: 0,
      bridged: 3
    },
    largestRing: 6,
    heterocycles: 0
  }
}
```

---

### 🟢 LOW PRIORITY - Niche/Advanced

#### 8. **PackedMolecule Query System**

**OpenChem APIs**: `PackedMolecule`, `PackedMoleculeQuery`  
**Why Niche**: Advanced performance optimization  
**Use Cases**: Very large-scale similarity searches (millions of molecules)

**Status**: ⏸️ **Defer** - Most users won't need this via MCP

---

#### 9. **Kekulization**

**OpenChem APIs**: `kekulize()`  
**Why Niche**: Low-level aromaticity manipulation  
**Use Cases**: Rare - mostly internal to rendering

**Status**: ⏸️ **Defer** - Internal utility, not user-facing

---

#### 10. **Advanced Stereochemistry Queries**

**OpenChem APIs**: Various stereo validators/analyzers  
**Why Niche**: Specialized stereochemistry workflow  
**Use Cases**: Detailed chirality analysis beyond basic descriptors

**Status**: ⏸️ **Defer** - Can add later if requested

---

## Implementation Roadmap

### Phase 1: Critical User-Facing (v0.2.0)

**Target**: 2-3 weeks  
**Priority**: Maximize user value

1. ✅ Tool 6: `tautomers` - Tautomer enumeration
2. ✅ Tool 7: `identifiers` - InChI/InChIKey generation
3. ✅ Tool 8: `fileConvert` - MOL/SDF conversion

**Impact**: +60% capability coverage (5 → 8 tools)

---

### Phase 2: Performance & Scale (v0.3.0)

**Target**: 1 month after Phase 1  
**Priority**: Handle real-world datasets

4. ✅ Tool 9: `batch` - Bulk operations
5. ✅ Enhancement: `scaffolds` - Advanced scaffold analysis

**Impact**: Enable production-scale workflows

---

### Phase 3: Specialized Chemistry (v0.4.0)

**Target**: 2 months after Phase 2  
**Priority**: Power users

6. ✅ Tool 10: `parseIUPAC` - IUPAC name parsing
7. ✅ Tool 11: `rings` - Ring analysis

**Impact**: Complete coverage for medicinal chemists

---

## Tool Count Projection

| Version              | Tools | Coverage | Target Users            |
| -------------------- | ----- | -------- | ----------------------- |
| **v0.1.5 (current)** | 5     | 40%      | General users           |
| **v0.2.0 (Phase 1)** | 8     | 65%      | Professional chemists   |
| **v0.3.0 (Phase 2)** | 10    | 80%      | Computational chemistry |
| **v0.4.0 (Phase 3)** | 12    | 95%      | Expert users            |

---

## Decision Framework

### Add Now If:

- ✅ User requests it explicitly
- ✅ Enables new use case (not just variation)
- ✅ 3+ line use case description
- ✅ Can be tested in < 1 minute

### Defer If:

- ❌ Internal/low-level utility
- ❌ < 10% of users would need it
- ❌ Requires extensive domain knowledge
- ❌ Better suited for direct API usage

---

## Metrics to Track

1. **Tool usage frequency** (via logs)
2. **Error rate per tool** (validation issues)
3. **Average tool call latency**
4. **User requests for missing features**

---

## Next Steps

1. ✅ Review this proposal
2. ⏸️ Prioritize Phase 1 tools (tautomers, identifiers, fileConvert)
3. ⏸️ Implement one tool at a time with tests
4. ⏸️ Publish incremental releases (0.1.6, 0.1.7, etc.)
5. ⏸️ Gather user feedback before Phase 2

---

## Questions for Review

1. **Phase 1 priority correct?** (tautomers, identifiers, fileConvert)
2. **Should `batch` be Phase 1 instead of Phase 2?** (performance critical)
3. **Is InChI generation more important than tautomers?**
4. **Should we combine `identifiers` + `convert` into one tool?**
5. **Do we need a separate `rings` tool or enhance `analyze`?**

---

**Total Missing High-Value Features**: 7 tools  
**Estimated Implementation Time**: 6-8 weeks (all phases)  
**Recommended Immediate Focus**: Phase 1 (3 tools, 2-3 weeks)
