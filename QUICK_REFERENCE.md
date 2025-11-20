# Quick Reference: Failure Pattern Analysis

## TL;DR - What To Do First

**Pattern to Fix:** POLYETHER STRUCTURES (12 failures)  
**Why:** 27% of all failures + includes blocking parsing errors  
**Impact:** +12 tests = 16% absolute improvement  
**Effort:** HIGH but systematic  
**Status:** 🔴 CRITICAL - Start here

---

## The Numbers

| Metric | Value |
|--------|-------|
| Current Success Rate | 72.2% (114/158) |
| Total Failures | 44 |
| Parsing Errors | 3 (6.8%) |
| Generation Errors | 4 (9.1%) |
| Structural Mismatches | 37 (84.1%) |

---

## The 5 Patterns

| # | Pattern | Count | % | Impact | Priority |
|---|---------|-------|---|--------|----------|
| 1 | Polyethers | 12 | 27% | +12 tests | 🔴 FIRST |
| 2 | Amines | 11 | 25% | +11 tests | 🟡 SECOND |
| 3 | Sulfur | 8 | 18% | +8 tests | 🟡 THIRD |
| 4 | Bicyclics | 7 | 16% | +7 tests | 4th |
| 5 | Esters | 7 | 16% | +7 tests | 5th |

---

## Polyether Pattern (Focus Here First)

**Problem:** 
- "Ether linkage requires two parent chains" error
- "No parent chain found" when attached via ether
- Wrong ether-oxy branch placement

**Error Types:**
- 1 Parsing Error (blocks everything)
- 1 Generation Error (no SMILES output)
- 10 Structural Mismatches (wrong structure)

**Examples:**
- `4,4,11,11-tetramethyl-3,12-dioxatricyclo[6.4.0.0²,⁷]dodecane-6,9-dione`
- `(4-acetyl-5,5-dimethyl-2-propan-2-yloxolan-2-yl) acetate`
- `2-methyl-2-(2-methylbutan-2-yloxymethoxy)butane`

**Root Causes:**
1. Ether bridge parsing fails in spiro systems
2. Oxolane ring attachment breaks chain detection
3. Polyether substituent placement wrong

**Solution Path:**
1. Fix ether linkage error for spiro ethers
2. Improve oxolane/dioxane ring detection
3. Handle polyether substituent placement

---

## Amine Pattern (Priority 2)

**Problem:**
- N-heterocycle aromatic state wrong
- N,N-dimethyl structures incomplete
- Aryl amines lose aromaticity

**Error Types:**
- 1 Parsing Error
- 0 Generation Errors
- 10 Structural Mismatches

**Examples:**
- `methyl 3-(2,2-dimethylbutanoylamino)-5-(3-methylbutyl)benzoate`
- `2-methyl-1-[1-(2-methylbutoxy)ethoxy]butane`
- `2-(tert-butylamino)oxy-3,3-dimethyl-N-phenylbutanamide`

**Root Cause:**
- Imidazole, triazole aromatic perception wrong
- N-substituted aromatic not detected

---

## Sulfur Pattern (Priority 3)

**Problem:**
- Sulfinyl (S=O) vs sulfanyl (-S-) vs sulfonyl (SO₂) confusion
- Missing or wrong sulfur bonds
- Disulfide vs disulfone wrong

**Error Types:**
- All 8 are Structural Mismatches

**Examples:**
- `bis(2,2,3,3,4,4,5,5,6,6,6-undecafluorohexyl) 9H-fluorene-2,7-disulfonate`
- `7-methyl-5-(2-methylpropanoyl)octane-2,6-dione`
- `1-(2,2-dimethylpropylsulfonylsulfinyl)-2,2-dimethylpropane`

**Root Cause:**
- S valence calculation wrong
- Sulfone bond interpretation off

---

## Implementation Timeline

### This Week (Polyethers)
- [ ] Fix "Ether linkage requires two parent chains" error
- [ ] Improve oxolane/dioxane detection
- [ ] Handle polyether substituent placement
- **Target:** 72.2% → 88.6% (114 → 126 passing)

### Next Week (Amines)
- [ ] Rewrite N-heterocycle aromatic perception
- [ ] Fix N,N-dimethyl structure generation
- **Target:** 88.6% → 93.8% (126 → 137 passing)

### Following Week (Sulfur)
- [ ] Fix sulfur valence calculation
- [ ] Handle S=O vs -S- vs SO₂
- **Target:** 93.8% → 97.1% (137 → 145 passing)

---

## Test Files to Use

**For Polyethers:**
```
iupac-to-smiles-detailed-report.csv lines:
- Line 2: Oxolane attachment
- Line 4: Ether linkage spiro system  
- Line 5: Dioxatricyclo system
- Line 9: Simple ether-oxy linkage
```

**For Amines:**
```
Lines:
- Line 3: Aromatic + amino
- Line 6: Imidazole + imine
- Line 14: N-dimethyl ether
- Line 15: Tertiary amide
```

**For Sulfur:**
```
Lines:
- Line 8: Disulfonate
- Line 16: Ketone/sulfinyl confusion
- Line 23-24: Disulfide/disulfone
```

---

## Success Metrics

### Target Improvements
- Phase 1 (Polyethers): +12 tests → 79.7% success
- Phase 2 (Amines): +11 tests → 86.7% success
- Phase 3 (Sulfur): +8 tests → 89.2% success
- Phase 4 (Bicyclics/Esters): +14 tests → 91.6% success

### Acceptance Criteria
- All 3 parsing errors resolved
- All 4 generation errors fixed
- 80%+ structural matches correct
- No regressions in existing passing tests

---

## Key Files

| File | Purpose |
|------|---------|
| EXECUTIVE_SUMMARY.md | Read first - high level overview |
| FAILURE_PATTERN_ANALYSIS.md | Technical deep dive - all details |
| TEST_CASES_BY_PATTERN.md | Specific IUPAC names to test against |
| iupac-to-smiles-detailed-report.csv | Source data |

---

## Quick Commands

```bash
# Run all IUPAC tests
bun test test/unit/iupac-engine/

# Run specific test
bun test test/unit/iupac-engine/iupac-to-smiles-detailed-report.csv

# Check specific pattern
grep -n "dioxa" test/unit/iupac-engine/iupac-to-smiles-detailed-report.csv

# Count current passing
bun test test/unit/iupac-engine/ 2>&1 | grep -E "passed|failed"
```

---

**Created:** 2025-11-14  
**Analysis Type:** Failure Pattern Categorization  
**Data Source:** 158 IUPAC test cases  
**Status:** Ready for implementation
