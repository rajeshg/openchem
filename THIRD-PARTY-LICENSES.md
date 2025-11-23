# Third-Party Licenses

openchem uses code and data from several open-source projects. This file provides attribution and license information for all third-party dependencies.

---

## RDKit-Derived Code (BSD-3-Clause)

Several modules in openchem are derived from or inspired by RDKit's C++ implementation:

### Affected Files

1. **Molecular Descriptors:**
   - `src/utils/surface-descriptors.ts` — LabuteASA (from `MolSurf.cpp`)
   - `src/utils/gasteiger-charges.ts` — Gasteiger partial charges (from `GasteigerCharges.cpp`)
   - `src/utils/chi-indices.ts` — Chi connectivity indices (from `Lipinski.cpp`)
   - `src/utils/topology-descriptors.ts` — Kappa indices, Bertz CT (from `Lipinski.cpp`)
   - `src/utils/molecular-properties.ts` (Phase 1 + TPSA) — Various descriptors (from `Lipinski.cpp`)

2. **Fingerprints:**
   - `src/utils/morgan-fingerprint.ts` — Morgan/ECFP fingerprints (from `MorganFingerprints.cpp`)

3. **LogP Calculation:**
   - `src/utils/logp.ts` — Wildman-Crippen LogP (from `Crippen.cpp`)

### License

```
Copyright (c) 2006-2015, Rational Discovery LLC, Greg Landrum, and others
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

**Source:** https://github.com/rdkit/rdkit

**Scientific References:**
- Morgan Fingerprints: Rogers & Hahn, *J. Chem. Inf. Model.* **50**:742-754 (2010)
- Wildman-Crippen LogP: Wildman & Crippen, *J. Chem. Inf. Comput. Sci.* **39**:868-873 (1999)
- TPSA: Ertl et al., *J. Med. Chem.* **43**:3714-3717 (2000)

---

## OPSIN Data (MIT License)

openchem uses nomenclature data from the OPSIN (Open Source IUPAC Nomenclature) project for parsing and generating IUPAC chemical names.

### Affected Files & Data

1. **IUPAC Nomenclature Data:**
   - `opsin-iupac-data/*.xml` (38 XML files) — IUPAC naming lexicon
   - `opsin-iupac-data/LOOKUP.json` — Structured index of nomenclature rules
   - `opsin-rules.json` — Compiled rules for IUPAC parsing/generation

2. **Code Using OPSIN Data:**
   - `src/parsers/iupac-parser/` — IUPAC name → SMILES conversion
   - `src/iupac-engine/` — SMILES → IUPAC name generation
   - `scripts/extract-opsin-rules.ts` — Script to extract rules from XML

### License

```
Copyright 2017 Daniel Lowe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Source:** https://github.com/dan2097/opsin

**Usage:** openchem uses OPSIN's nomenclature data but implements its own parsing and generation algorithms. The XML data files were extracted on 2025-10-25 and compiled into `opsin-rules.json` for efficient lookup.

---

## InChI WASM (Apache-2.0 / IUPAC-InChI Trust License)

openchem includes a WebAssembly build of the InChI library for generating International Chemical Identifiers.

### Affected Files

- `src/third-party/inchi-wasm/` — WebAssembly InChI implementation
- Files using InChI: `src/generators/inchi-generator.ts`

### License

The InChI library is dual-licensed:
1. **IUPAC-InChI Trust License** for the core InChI algorithm
2. **Apache-2.0** for the WASM wrapper implementation

**Source:** https://www.inchi-trust.org/

---

## License Compatibility

All third-party licenses are compatible with openchem's MIT license:

| Component | License | Compatible |
|-----------|---------|------------|
| RDKit-derived code | BSD-3-Clause | ✅ Yes |
| OPSIN data | MIT | ✅ Yes |
| InChI WASM | Apache-2.0 / InChI Trust | ✅ Yes |

---

## Attribution Requirements

When using openchem, the following attributions are recommended:

1. **For RDKit-derived algorithms:**
   > "This software uses algorithms derived from RDKit (https://github.com/rdkit/rdkit)"

2. **For IUPAC name parsing/generation:**
   > "IUPAC nomenclature data from OPSIN by Daniel Lowe (https://github.com/dan2097/opsin)"

3. **For InChI generation:**
   > "InChI identifiers generated using the InChI Trust library (https://www.inchi-trust.org/)"

---

## Full License Texts

For complete license texts, see:
- **openchem**: `LICENSE` (MIT)
- **RDKit**: https://github.com/rdkit/rdkit/blob/master/license.txt
- **OPSIN**: https://github.com/dan2097/opsin/blob/master/LICENSE.txt
- **InChI**: https://www.inchi-trust.org/download/

---

*Last updated: 2025-11-23*
