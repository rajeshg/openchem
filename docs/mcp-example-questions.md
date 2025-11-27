# OpenChem MCP Server - Example Questions

This document provides 7 interesting questions to ask the OpenChem MCP server, showcasing its capabilities from simple single-tool queries to complex multi-tool workflows.

## 1. Simple Molecular Analysis (Single Tool: `analyze`)

**Question:**
> "What are the drug-likeness properties of caffeine? Use SMILES: CN1C=NC2=C1C(=O)N(C(=O)N2C)C"

**What it demonstrates:**
- Basic molecular analysis
- Drug-likeness assessment (Lipinski, Veber rules)
- Molecular descriptors (MW, LogP, H-bond donors/acceptors)
- IUPAC name generation
- BBB penetration prediction

**Expected results:**
- Molecular weight: 194.19 g/mol
- LogP: ~0.1
- Lipinski violations: 0 (passes all rules)
- IUPAC: 1,3,7-trimethylpurine-2,6-dione
- Drug-likeness: ✅ Good oral bioavailability

**Tools used:** `analyze`

---

## 2. Similarity Comparison (Multiple Tools: `analyze` + `compare`)

**Question:**
> "Compare aspirin (CC(=O)Oc1ccccc1C(=O)O) and ibuprofen (CC(C)Cc1ccc(cc1)C(C)C(=O)O). Which one is more drug-like and how similar are they structurally?"

**What it demonstrates:**
- Parallel analysis of two molecules
- Morgan fingerprint similarity (Tanimoto coefficient)
- Side-by-side drug-likeness comparison
- Property comparison (MW, LogP, TPSA)

**Expected results:**
- Tanimoto similarity: ~0.15-0.25 (low structural similarity)
- Both pass Lipinski's rules
- Aspirin: MW=180.16, LogP=1.2, TPSA=63.6
- Ibuprofen: MW=206.28, LogP=3.5, TPSA=37.3
- Ibuprofen is more lipophilic (better membrane penetration)

**Tools used:** `compare`, potentially `analyze` for detailed breakdown

---

## 3. Substructure Search + Analysis (Multiple Tools: `search` + `analyze`)

**Question:**
> "Find all carboxylic acid groups in naproxen (CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O). Then analyze its properties and tell me if it would make a good oral drug."

**What it demonstrates:**
- SMARTS pattern matching (`C(=O)O` for carboxylic acid)
- Match indices and atom locations
- Drug-likeness rules for oral bioavailability
- BBB penetration prediction
- Integration of search results with analysis

**Expected results:**
- 1 carboxylic acid group found at specific atoms
- Molecular weight: 230.26 g/mol
- LogP: ~3.2
- Passes Lipinski's Rule of Five
- Good oral bioavailability
- IUPAC: 2-(6-methoxynaphthalen-2-yl)propanoic acid

**Tools used:** `search`, `analyze`

---

## 4. Visual Structure Comparison (Multiple Tools: `render` + `compare` + `convert`)

**Question:**
> "I have two molecules: benzene (c1ccccc1) and cyclohexane (C1CCCCC1). Show me their 2D structures as PNG images, compare their properties, and tell me their systematic IUPAC names. What's their Murcko scaffold?"

**What it demonstrates:**
- PNG rendering for visual comparison
- Aromatic vs aliphatic ring systems
- IUPAC name generation (benzene vs cyclohexane)
- Scaffold extraction (both reduce to same 6-membered ring)
- Aromaticity perception differences
- Property comparison

**Expected results:**
- Benzene: Aromatic, planar, IUPAC = benzene
- Cyclohexane: Aliphatic, chair conformation, IUPAC = cyclohexane
- Murcko scaffold: Both reduce to C1CCCCC1 (6-membered ring)
- Very different properties despite similar structure
- PNG images show aromatic vs single bonds

**Tools used:** `render` (×2, with format="png"), `compare`, `convert` (scaffold)

---

## 5. Drug Discovery Workflow (All Tools: `analyze` + `search` + `compare` + `render` + `convert`)

**Question:**
> "I'm designing a COX-2 inhibitor similar to celecoxib (CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F). First, analyze celecoxib's drug-likeness properties. Then find all sulfonamide groups using SMARTS pattern S(=O)(=O)N. Compare it to aspirin (CC(=O)Oc1ccccc1C(=O)O) for structural similarity. Generate its IUPAC name and show me both molecules side-by-side as PNG images. Would celecoxib pass Lipinski's Rule of Five?"

**What it demonstrates:**
- Complete drug discovery workflow
- Complex SMARTS matching (sulfonamide: key pharmacophore)
- Multi-molecule comparison
- Dual PNG rendering
- IUPAC name for complex heterocycle
- Drug-likeness assessment
- Scaffold analysis for lead optimization

**Expected workflow:**
1. **Analyze celecoxib** → MW=381.4, LogP=3.5, 2 H-bond donors, 4 acceptors
2. **Search sulfonamide** → Find SO₂NH₂ group at specific atoms
3. **Compare to aspirin** → Low Tanimoto similarity (~0.15, different scaffolds)
4. **Render both** → Visual comparison of structures (PNG format)
5. **Convert** → IUPAC: 4-[5-(4-methylphenyl)-3-(trifluoromethyl)pyrazol-1-yl]benzenesulfonamide
6. **Drug-likeness** → ✅ Passes Lipinski (MW<500, LogP<5, HBD<5, HBA<10)

**Expected results:**
- Celecoxib passes Lipinski's Rule of Five
- Contains 1 sulfonamide group (essential for COX-2 selectivity)
- Very different from aspirin (different mechanism)
- MW=381.37, LogP=3.5, TPSA=92.6
- Good oral bioavailability predicted

**Tools used:** `analyze`, `search`, `compare`, `render` (×2, format="png"), `convert`

---

## 6. Multi-Drug Comparison Matrix (Multiple Tools: `compare` + `analyze` + `render`)

**Question:**
> "I have three pain relievers: aspirin (CC(=O)Oc1ccccc1C(=O)O), acetaminophen (CC(=O)Nc1ccc(cc1)O), and naproxen (CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O). Which pair is most similar to each other? Which would be best for oral administration based on Lipinski and Veber rules? Show me their structures as PNG images."

**What it demonstrates:**
- 3-way similarity matrix (compare each pair)
- Parallel drug-likeness analysis
- Triple PNG rendering
- Decision-making based on multiple criteria
- Ranking by Tanimoto similarity
- Property-based drug selection

**Expected results:**
- Similarity matrix:
  - Aspirin ↔ Naproxen: ~0.25 (highest, both NSAIDs with COOH)
  - Aspirin ↔ Acetaminophen: ~0.15 (low)
  - Naproxen ↔ Acetaminophen: ~0.12 (lowest)
- Most similar pair: Aspirin & Naproxen (both NSAIDs)
- All pass Lipinski's rules
- Best oral drug: Aspirin (smallest MW, best absorption)
- PNG images show structural differences

**Tools used:** `compare` (×3 pairs), `analyze` (×3 molecules), `render` (×3, format="png")

---

## 7. Functional Group Analysis + Scaffold Extraction (Multiple Tools: `search` + `convert` + `analyze` + `render`)

**Question:**
> "Analyze the antibiotic amoxicillin (CC1(C(N2C(S1)C(C2=O)NC(=O)C(C3=CC=C(C=C3)O)N)C(=O)O)C). Find all amide groups (SMARTS: C(=O)N). Extract its Murcko scaffold. Then compare the scaffold's properties to the full molecule. Show me both structures (full molecule and scaffold) as PNG images side-by-side."

**What it demonstrates:**
- Complex SMARTS pattern matching (amide groups)
- Scaffold extraction for drug design
- Comparison of drug vs scaffold properties
- Understanding core structure vs substituents
- Dual PNG rendering (molecule + scaffold)
- Medicinal chemistry workflow

**Expected workflow:**
1. **Parse amoxicillin** → Complex β-lactam antibiotic
2. **Search amide groups** → Find multiple amide bonds
3. **Extract scaffold** → Get core β-lactam ring system
4. **Analyze both** → Compare full drug vs scaffold
5. **Render both** → Visual comparison (PNG format)

**Expected results:**
- Amoxicillin contains 3 amide/amide-like groups:
  - β-lactam ring (cyclic amide)
  - Side chain amide
  - Carboxylic acid (not amide but similar)
- Scaffold: Simplified bicyclic core (thiazolidine-β-lactam)
- Full molecule: MW=365.4, multiple polar groups
- Scaffold: MW~180, hydrophobic core
- PNG images show how substituents add drug-like properties

**Tools used:** `search`, `convert` (scaffold), `analyze` (×2), `render` (×2, format="png")

---

## Tips for Using These Questions

### For Testing
- Start with Question 1 (simplest, single tool)
- Progress to Questions 2-4 (2-3 tools)
- Try Questions 5-7 (complex, multi-step workflows)

### For Demos
- **Quick demo**: Use Questions 1, 2, 4
- **Full demo**: Use Questions 1, 5, 6 (showcases all tools)
- **Visual demo**: Use Questions 4, 6, 7 (PNG rendering)

### For Documentation
- Include example questions in integration guides
- Use as test cases for CI/CD
- Demonstrate MCP server capabilities

### For Development
- Validate that multi-tool orchestration works
- Test PNG export with Questions 4, 5, 6, 7
- Benchmark performance with Question 6 (multiple parallel calls)

---

## Expected AI Assistant Behavior

When asking these questions, a good AI assistant (Claude, ChatGPT, etc.) should:

1. **Parse the question** and identify which tools are needed
2. **Call tools in sequence** or parallel as appropriate
3. **Synthesize results** from multiple tool calls
4. **Provide clear answers** in natural language
5. **Show visual results** when PNG format is requested
6. **Make recommendations** based on drug-likeness data

## Technical Notes

### PNG Output
- PNG images are returned as base64-encoded strings
- Decode base64 to get raw PNG bytes
- Typical size: 6-10 KB for 300×300px molecular structures

### Performance
- Single tool calls: < 100ms
- Multi-tool workflows: 200-500ms (depending on complexity)
- PNG conversion adds ~50ms overhead per image

### Accuracy
- SMARTS matching: 100% accurate for valid patterns
- Drug-likeness: Validated against RDKit
- IUPAC names: 100% on realistic molecules dataset
- Morgan fingerprints: Exact match with RDKit C++

---

## Contributing

Have interesting questions to add? Submit a PR with:
- The question text
- Expected tools used
- Expected results
- Scientific/practical context

Examples should be:
- Chemically valid
- Scientifically relevant
- Demonstrate 2+ tools when possible
- Include real-world drug molecules when applicable
