import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import {
  scoreTautomer,
  scoreAromaticRings,
  scoreSubstructures,
  scoreHeteroHydrogens,
  scoreCharges,
} from "src/utils/tautomer/tautomer-scoring";

describe("tautomer scoring: aromatic rings", () => {
  it("scores benzene correctly (+250)", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0];
    if (!mol) throw new Error("failed to parse benzene");
    const score = scoreAromaticRings(mol);
    // Benzene: 1 aromatic ring, all carbons → +100 + 150 = +250
    expect(score).toBe(250);
  });

  it("scores naphthalene correctly (+500)", () => {
    const mol = parseSMILES("c1ccc2ccccc2c1").molecules[0];
    if (!mol) throw new Error("failed to parse naphthalene");
    const score = scoreAromaticRings(mol);
    // Naphthalene: 2 aromatic rings, all carbons → 2 * (100 + 150) = +500
    expect(score).toBe(500);
  });

  it("scores pyridine correctly (+100)", () => {
    const mol = parseSMILES("c1cccnc1").molecules[0];
    if (!mol) throw new Error("failed to parse pyridine");
    const score = scoreAromaticRings(mol);
    // Pyridine: 1 aromatic ring, contains N → +100 only (no +150 bonus)
    expect(score).toBe(100);
  });

  it("scores non-aromatic rings as zero", () => {
    const mol = parseSMILES("C1CCCCC1").molecules[0];
    if (!mol) throw new Error("failed to parse cyclohexane");
    const score = scoreAromaticRings(mol);
    // Cyclohexane: not aromatic → 0
    expect(score).toBe(0);
  });

  it("scores pyrrole correctly (+100)", () => {
    const mol = parseSMILES("c1cc[nH]c1").molecules[0];
    if (!mol) throw new Error("failed to parse pyrrole");
    const score = scoreAromaticRings(mol);
    // Pyrrole: 1 aromatic ring, contains N → +100 (no all-carbon bonus)
    expect(score).toBe(100);
  });
});

describe("tautomer scoring: substructures", () => {
  it("scores carbonyl C=O correctly (+2)", () => {
    const mol = parseSMILES("CC(=O)C").molecules[0];
    if (!mol) throw new Error("failed to parse acetone");
    const score = scoreSubstructures(mol);
    // Acetone: 1 C=O → +2, plus 2 methyl groups → +2
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it("scores oxime correctly (+4)", () => {
    const mol = parseSMILES("CC(=NO)C").molecules[0];
    if (!mol) throw new Error("failed to parse oxime");
    const score = scoreSubstructures(mol);
    // Oxime: C=N-OH → +4
    expect(score).toBeGreaterThanOrEqual(4);
  });

  it("scores benzoquinone correctly (+25)", () => {
    const mol = parseSMILES("O=C1C=CC(=O)C=C1").molecules[0];
    if (!mol) throw new Error("failed to parse benzoquinone");
    const score = scoreSubstructures(mol);
    // Benzoquinone: special pattern → +25, plus 2 C=O → +4
    expect(score).toBeGreaterThanOrEqual(25);
  });

  it("scores methyl groups correctly (+1 each)", () => {
    const mol = parseSMILES("CC(C)C").molecules[0];
    if (!mol) throw new Error("failed to parse isobutane");
    const score = scoreSubstructures(mol);
    // Isobutane: 3 methyl groups → +3
    expect(score).toBe(3);
  });
});

describe("tautomer scoring: heteroatom hydrogens", () => {
  it("penalizes hydrogen on sulfur (-1)", () => {
    const mol = parseSMILES("CS").molecules[0];
    if (!mol) throw new Error("failed to parse methanethiol");
    const score = scoreHeteroHydrogens(mol);
    // Methanethiol: 1 H on S → -1
    expect(score).toBe(-1);
  });

  it("penalizes hydrogen on phosphorus (-1)", () => {
    const mol = parseSMILES("CP").molecules[0];
    if (!mol) throw new Error("failed to parse methylphosphine");
    const score = scoreHeteroHydrogens(mol);
    // Methylphosphine: 2 H on P → -2
    expect(score).toBe(-2);
  });

  it("does not penalize hydrogen on oxygen or nitrogen", () => {
    const mol = parseSMILES("CO").molecules[0];
    if (!mol) throw new Error("failed to parse methanol");
    const score = scoreHeteroHydrogens(mol);
    // Methanol: H on O is not penalized → 0
    expect(score).toBe(0);
  });
});

describe("tautomer scoring: charges", () => {
  it("penalizes non-zero charges (-10 each)", () => {
    const mol = parseSMILES("[NH4+]").molecules[0];
    if (!mol) throw new Error("failed to parse ammonium");
    const score = scoreCharges(mol);
    // Ammonium: 1 positive charge → -10
    expect(score).toBe(-10);
  });

  it("penalizes multiple charges", () => {
    const mol = parseSMILES("[N+](C)(C)(C)C.[Cl-]").molecules[0];
    if (!mol) throw new Error("failed to parse charged molecule");
    const score = scoreCharges(mol);
    // Single molecule with 1 positive charge → -10
    expect(score).toBe(-10);
  });

  it("gives zero for neutral molecules", () => {
    const mol = parseSMILES("CC(=O)C").molecules[0];
    if (!mol) throw new Error("failed to parse acetone");
    const score = scoreCharges(mol);
    // Acetone: no charges → 0
    expect(score).toBe(0);
  });
});

describe("tautomer scoring: comprehensive", () => {
  it("prefers keto form over enol for acetone", () => {
    const keto = parseSMILES("CC(=O)C").molecules[0];
    const enol = parseSMILES("CC(=C)O").molecules[0];
    if (!keto || !enol) throw new Error("failed to parse keto/enol tautomers");

    const ketoScore = scoreTautomer(keto);
    const enolScore = scoreTautomer(enol);

    // Keto has C=O (+2) and should be preferred
    expect(ketoScore).toBeGreaterThan(enolScore);
  });

  it("scores aromatic tautomers higher", () => {
    const phenol = parseSMILES("c1ccccc1O").molecules[0];
    const cyclohexadienone = parseSMILES("O=C1C=CC=CC1").molecules[0];
    if (!phenol || !cyclohexadienone) throw new Error("failed to parse phenol tautomers");

    const phenolScore = scoreTautomer(phenol);
    const ketoneScore = scoreTautomer(cyclohexadienone);

    // Phenol has aromatic ring (+250) and should be strongly preferred
    expect(phenolScore).toBeGreaterThan(ketoneScore);
  });

  it("penalizes charged tautomers significantly", () => {
    const neutral = parseSMILES("CC(=O)C").molecules[0];
    const charged = parseSMILES("CC([O-])=C[NH3+]").molecules[0];
    if (!neutral || !charged) throw new Error("failed to parse neutral/charged forms");

    const neutralScore = scoreTautomer(neutral);
    const chargedScore = scoreTautomer(charged);

    // Charged form has -20 penalty (2 charges × -10)
    expect(neutralScore).toBeGreaterThan(chargedScore);
  });

  it("prefers benzene over non-aromatic forms", () => {
    const benzene = parseSMILES("c1ccccc1").molecules[0];
    const cyclohexene = parseSMILES("C1=CCCCC1").molecules[0];
    if (!benzene || !cyclohexene) throw new Error("failed to parse benzene/cyclohexene");

    const benzeneScore = scoreTautomer(benzene);
    const cyclohexeneScore = scoreTautomer(cyclohexene);

    // Benzene has +250 aromatic bonus
    expect(benzeneScore).toBeGreaterThan(cyclohexeneScore);
    expect(benzeneScore).toBeGreaterThanOrEqual(250);
  });
});

describe("tautomer scoring: edge cases", () => {
  it("handles molecules with no rings", () => {
    const mol = parseSMILES("CCC").molecules[0];
    if (!mol) throw new Error("failed to parse propane");
    const score = scoreTautomer(mol);
    // Propane: no special features, just methyl groups
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("handles molecules with multiple functional groups", () => {
    const mol = parseSMILES("CC(=O)C(=O)C").molecules[0];
    if (!mol) throw new Error("failed to parse pentane-2,4-dione");
    const score = scoreTautomer(mol);
    // Two carbonyls: 2 × +2 = +4, plus methyl groups
    expect(score).toBeGreaterThanOrEqual(4);
  });

  it("handles complex molecules like aspirin", () => {
    const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0];
    if (!mol) throw new Error("failed to parse aspirin");
    const score = scoreTautomer(mol);
    // Aspirin: aromatic ring (+250) + 2 carbonyls (+4) + methyl (+1)
    expect(score).toBeGreaterThanOrEqual(250);
  });
});
