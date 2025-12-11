# **PackedMol Specification**

**Version 1.0**
**Status:** Draft
**Last Updated:** 2025-11-14

---

# **1. Overview**

**PackedMol** is a compact, zero-copy, binary representation of molecular structures, optimized for:

- High-performance cheminformatics
- Deterministic canonicalization
- Cross-thread transfer (Web Workers, WASM, GPU buffers)
- Minimal memory footprint
- Fast graph traversal (CSR adjacency)

PackedMol is the **internal molecular representation** for OpenChem. It is designed to store all structural information required for:

- SMILES generation
- IUPAC naming
- Substructure search
- Fingerprints (ECFP, topological)
- Stereochemistry determination
- Aromaticity perception

PackedMol is **lossless**: all information in a classical molfile or typical RDKit `ROMol` can be encoded.

It is **not** a human-readable format.

---

# **2. Design Principles**

1. **Zero-copy**
   All data is stored in flat typed arrays that can be transferred without serialization.

2. **Compact**
   Atom and bond properties use minimal integer widths (mostly `Uint8` / `Uint16`).

3. **Deterministic**
   The layout is canonical; identical molecules yield identical PackedMol.

4. **Extensible**
   Fields are block-offset based; new fields can be added without breaking old decoders.

5. **Graph-first**
   Connectivity is stored using **CSR (Compressed Sparse Row)** adjacency structure.

6. **Stereochemically complete**
   Supports R/S, E/Z, and all common tetrahedral and alkene stereodescriptors.

---

# **3. Data Model Overview**

PackedMol consists of 3 logical sections:

```
[ Header ]
[ Atom Block ]
[ Bond Block ]
[ Graph Block (CSR adjacency) ]
[ Stereo Block ]
```

These sections are stored consecutively in a single binary buffer.

---

# **4. Typed Array Layout**

### **4.1 Header (Uint32Array)**

| Field               | Type   | Description                          |
| ------------------- | ------ | ------------------------------------ |
| `version`           | Uint32 | PackedMol format version             |
| `atomCount`         | Uint32 | Number of atoms                      |
| `bondCount`         | Uint32 | Number of bonds                      |
| `offsetAtomBlock`   | Uint32 | Byte offset to atom fields           |
| `offsetBondBlock`   | Uint32 | Byte offset to bond fields           |
| `offsetAdjacency`   | Uint32 | Byte offset to CSR adjacency         |
| `offsetStereoBlock` | Uint32 | Byte offset to stereochemistry block |

---

# **5. Atom Block**

Atom block consists of fixed-width per-atom typed arrays.

| Field          | Type        | Length | Meaning                                     |
| -------------- | ----------- | ------ | ------------------------------------------- |
| `atomicNumber` | Uint8Array  | N      | Element (1–118)                             |
| `formalCharge` | Int8Array   | N      | Integer charge                              |
| `hydrogens`    | Uint8Array  | N      | Explicit hydrogen count                     |
| `degree`       | Uint8Array  | N      | Number of bonds (bond count)                |
| `isotope`      | Uint16Array | N      | Isotope mass number (0 = natural abundance) |
| `atomFlags`    | Uint16Array | N      | Bitfield (aromatic, chiral, query flags)    |

### **Atom Flags Bitfield**

| Bit  | Meaning               |
| ---- | --------------------- |
| 0    | Aromatic atom         |
| 1    | Chiral center present |
| 2    | Radical center        |
| 3    | Dummy atom (`*`)      |
| 4–15 | reserved              |

---

# **6. Bond Block**

| Field       | Type        | Length | Meaning                                          |
| ----------- | ----------- | ------ | ------------------------------------------------ |
| `bondAtomA` | Uint32Array | M      | First atom index                                 |
| `bondAtomB` | Uint32Array | M      | Second atom index                                |
| `bondOrder` | Uint8Array  | M      | 1 = single, 2 = double, 3 = triple, 4 = aromatic |
| `bondFlags` | Uint8Array  | M      | Bitfield                                         |

### **Bond Flags Bitfield**

| Bit | Meaning                 |
| --- | ----------------------- |
| 0   | Direction up (`/`)      |
| 1   | Direction down (`\`)    |
| 2   | Stereogenic double bond |
| 3   | Aromatic bond override  |
| 4–7 | reserved                |

---

# **7. Graph Block (CSR Adjacency)**

Graph is stored using **Compressed Sparse Row (CSR)** format.

### **7.1 `degreeOffset`: Uint32Array (N+1)**

For each atom `i`:

```
neighbors for atom i are stored in:
    bondTargets[ degreeOffset[i] ... degreeOffset[i+1]-1 ]
```

### **7.2 `bondTargets`: Uint32Array (2M)**

For every bond A–B, store:

```
A → B
B → A
```

### **7.3 `bondAdj`: Uint16Array (2M)**

Parallel to `bondTargets`, stores the bond index (0…M-1).

---

# **8. Stereo Block**

PackedMol supports atom and bond stereochemistry.

---

## **8.1 Atom Stereochemistry (R/S)**

| Field              | Type       | Length | Meaning                        |
| ------------------ | ---------- | ------ | ------------------------------ |
| `stereoAtomType`   | Uint8Array | N      | 0 = none, 1 = tetrahedral      |
| `stereoAtomParity` | Int8Array  | N      | +1 (CW), -1 (CCW), 0 (unknown) |

Parity refers to the neighbor ordering given by adjacency listing with a well-defined canonical sort.

---

## **8.2 Bond Stereochemistry (E/Z)**

| Field              | Type       | Length | Meaning                          |
| ------------------ | ---------- | ------ | -------------------------------- |
| `stereoBondType`   | Uint8Array | M      | 0 = none, 1 = double-bond stereo |
| `stereoBondConfig` | Int8Array  | M      | +1 = Z, -1 = E, 0 = unspecified  |

---

# **9. Aromaticity**

Aromatic systems are represented by:

- `atomFlags & 1`
- `bondOrder == 4`
- `bondFlags & 3` optional Kekulé hints

This enables:

- aromatic ring identification
- kekulization / de-kekulization
- SMILES aromatic form generation

---

# **10. Rings & SSSR**

PackedMol **does not store rings explicitly**, but the CSR adjacency makes:

- SSSR
- Cycle basis detection
- Ring perception
- Aromatic ring detection

fast and deterministic.

All ring information is computed on-demand from adjacency.

---

# **11. Extensibility**

PackedMol uses offset-based sections.
New arrays can be added after the stereo block without breaking old decoders.

Examples of future extensions:

- 3D coordinates (`Float32Array`)
- Query SMARTS flags
- Partial charges
- Electron donation metadata
- Fragment/group indexing
- Advanced stereochemistry (atropisomers, helicenes)

---

# **12. Serialization & Transport**

### **Allowed:**

- `ArrayBuffer`
- `SharedArrayBuffer`
- Transferable objects
- WASM linear memory views
- GPU buffers (WebGPU `GPUBuffer`)

PackedMol is ideal for:

- Worker → Worker transfers
- GPU fingerprint computation
- WASM chemical kernels
- C++ → JS interop via raw pointer offsets

---

# **13. Size Characteristics**

For typical organic molecules:

- **Atom block:** 8–10 bytes/atom (includes degree field)
- **Bond block:** ~7–10 bytes/bond
- **CSR adjacency:** 8 bytes/bond
- **Stereochemistry:** 1–2 bytes per stereo element

Real-world examples:

| Molecule  | Atoms | Bonds | Size (PackedMol) | RDKit ROMol | Savings         |
| --------- | ----- | ----- | ---------------- | ----------- | --------------- |
| Ethanol   | 9     | 8     | ~80 bytes        | ~2–4 KB     | 40–60× smaller  |
| Ibuprofen | 33    | 34    | ~400–500 bytes   | ~8–15 KB    | ~20–40× smaller |
| Caffeine  | 24    | 25    | ~280–350 bytes   | ~6–10 KB    | ~20–40× smaller |

---

# **14. Determinism**

PackedMol encoding is **100% deterministic**:

- Atoms sorted by canonical ordering
- Neighbors sorted by atom index
- Bond ordering fixed
- No nullable fields or variable-length structures

Identical molecules → identical PackedMol.

This makes PackedMol ideal for:

- hashing (OpenChemKey)
- caching
- fingerprint generation
- graph isomorphism testing

---

# **15. Canonical Hashing (OpenChemKey)**

OpenChemKey is a canonical fingerprint/hash derived directly from PackedMol.

Properties:

- canonicalized
- collision-resistant
- fast (linear time)
- independent of input SMILES
- smaller than InChIKey
- closer to graph-isomorphism invariant

PackedMol is the underlying canonical graph structure.

---

# **16. Differences vs InChI / SMILES / Molfile**

| Feature             | SMILES  | InChI   | Molfile  | **PackedMol** |
| ------------------- | ------- | ------- | -------- | ------------- |
| Human readable      | ✔       | ✖       | ✔        | ✖             |
| Lossless            | ✔       | ✔       | ✔        | ✔             |
| Canonical           | ✖       | ✔       | ✖        | ✔             |
| Graph adjacency     | implied | encoded | explicit | CSR compact   |
| Stereochem complete | ✔       | ✔       | ✔        | ✔             |
| Extensible          | no      | limited | yes      | **yes**       |
| Zero-copy           | no      | no      | no       | **yes**       |
| Machine performance | low     | medium  | low      | **very high** |

---

# **17. Example PackedMol Diagram (conceptual)**

```
+----------------------+
| Header               |
+----------------------+
| atomicNumber[]       |
| formalCharge[]       |
| hydrogens[]          |
| degree[]             |
| isotope[]            |
| atomFlags[]          |
+----------------------+
| bondAtomA[]          |
| bondAtomB[]          |
| bondOrder[]          |
| bondFlags[]          |
+----------------------+
| degreeOffset[]       |
| bondTargets[]        |
| bondAdj[]            |
+----------------------+
| stereoAtomType[]     |
| stereoAtomParity[]   |
| stereoBondType[]     |
| stereoBondConfig[]   |
+----------------------+
```

---

# **18. Reference Implementation**

A complete TypeScript implementation and encoder/decoder are provided in:

**[https://github.com/rajeshg/openchem](https://github.com/rajeshg/openchem)**

---

# **19. License**

PackedMol is released under the **MIT License**.

---

# **20. Appendix**

## **20.1 CSR Example**

For adjacency:

```
Atom 0 -> [1, 2]
Atom 1 -> [0, 3]
Atom 2 -> [0]
Atom 3 -> [1]
```

The CSR encoding:

```
degreeOffset = [0, 2, 4, 5, 6]
bondTargets  = [1,2, 0,3, 0, 1]
bondAdj      = [0,1, 0,2, 3, 3] (bond indices)
```
