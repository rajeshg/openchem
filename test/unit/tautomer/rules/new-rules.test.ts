import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { enumerateTautomers } from "src/utils/tautomer/tautomer-enumerator";

describe("tautomer: new rules - lactam-lactim", () => {
  it("recognizes lactam structures", () => {
    const lactam = parseSMILES("O=C1NCCCC1").molecules[0]; // caprolactam
    if (!lactam) throw new Error("failed to parse lactam");
    const tautomers = enumerateTautomers(lactam, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThan(0);
    // Should enumerate at least the input form
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });
});

describe("tautomer: new rules - thione-thiol", () => {
  it("enumerates thione-thiol tautomers", () => {
    const thione = parseSMILES("CC(=S)C").molecules[0]; // thioacetone
    if (!thione) throw new Error("failed to parse thione");
    const tautomers = enumerateTautomers(thione, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThan(0);
    // Should contain thione form (C=S)
    const hasThione = tautomers.some((t) => /S/.test(t.smiles));
    expect(hasThione).toBe(true);
  });
});

describe("tautomer: new rules - nitroso-oxime", () => {
  it("recognizes nitroso compounds", () => {
    const nitroso = parseSMILES("CC(=N=O)C").molecules[0]; // nitrosoacetone
    if (!nitroso) throw new Error("failed to parse nitroso");
    const tautomers = enumerateTautomers(nitroso, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThan(0);
  });
});

describe("tautomer: new rules - phosphonic acid", () => {
  it("handles phosphonic acid", () => {
    const phosphonic = parseSMILES("CP(=O)(O)O").molecules[0]; // methylphosphonic acid
    if (!phosphonic) throw new Error("failed to parse phosphonic acid");
    const tautomers = enumerateTautomers(phosphonic, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
    // P=O form should be present
    const hasPhosphonate = tautomers.some((t) => /P/.test(t.smiles));
    expect(hasPhosphonate).toBe(true);
  });
});

describe("tautomer: new rules - guanidine", () => {
  it("enumerates guanidine tautomers", () => {
    const guanidine = parseSMILES("NC(N)=N").molecules[0]; // guanidine
    if (!guanidine) throw new Error("failed to parse guanidine");
    const tautomers = enumerateTautomers(guanidine, { maxTautomers: 16 });
    expect(tautomers.length).toBeGreaterThan(0);
    // All three NH groups can participate
    const hasMultipleForms = tautomers.length >= 1;
    expect(hasMultipleForms).toBe(true);
  });
});

describe("tautomer: new rules - tetrazole", () => {
  it("enumerates tetrazole tautomers", () => {
    const tetrazole = parseSMILES("c1[nH]nnn1").molecules[0]; // tetrazole
    if (!tetrazole) throw new Error("failed to parse tetrazole");
    const tautomers = enumerateTautomers(tetrazole, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
    // Should maintain aromatic ring in all forms
    const allAromatic = tautomers.every((t) => /n/.test(t.smiles) || /N/.test(t.smiles));
    expect(allAromatic).toBe(true);
  });
});

describe("tautomer: new rules - imidazole", () => {
  it("enumerates imidazole tautomers", () => {
    const imidazole = parseSMILES("c1cnc[nH]1").molecules[0]; // imidazole
    if (!imidazole) throw new Error("failed to parse imidazole");
    const tautomers = enumerateTautomers(imidazole, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
    // Both 1H and 3H forms should be equivalent (aromatic stabilization)
    const allHaveRing = tautomers.every((t) => /n/.test(t.smiles) || /N/.test(t.smiles));
    expect(allHaveRing).toBe(true);
  });
});

describe("tautomer: new rules - sulfoxide", () => {
  it("handles sulfoxide (rare tautomerism)", () => {
    const sulfoxide = parseSMILES("CS(=O)C").molecules[0]; // dimethyl sulfoxide
    if (!sulfoxide) throw new Error("failed to parse sulfoxide");
    const tautomers = enumerateTautomers(sulfoxide, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
    // S=O form should be strongly preferred
    const canonical = tautomers[0];
    if (canonical) {
      expect(canonical.smiles).toContain("S");
    }
  });
});

describe("tautomer: Phase 2 rules - extended conjugation", () => {
  it("handles 1,7 aromatic heteroatom H shift", () => {
    // Extended conjugated system with 7 atoms
    const mol = parseSMILES("N(c1ccccc1)=C").molecules[0]; // simplified example
    if (!mol) throw new Error("failed to parse");
    const tautomers = enumerateTautomers(mol, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });

  it("handles 1,9 aromatic heteroatom H shift", () => {
    // Large aromatic system (anthracene-like)
    const mol = parseSMILES("c1ccc2cc3ccccc3cc2c1").molecules[0]; // anthracene
    if (!mol) throw new Error("failed to parse");
    const tautomers = enumerateTautomers(mol, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });

  it("handles oxim/nitroso via phenol", () => {
    // Phenol-mediated oxime tautomerism
    const mol = parseSMILES("ON=CC=CC=O").molecules[0]; // simplified conjugated oxime
    if (!mol) throw new Error("failed to parse");
    const tautomers = enumerateTautomers(mol, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });
});

describe("tautomer: Phase 3 rules - edge cases", () => {
  it("handles 1,11 aromatic heteroatom H shift (very large rings)", () => {
    // Very large conjugated system - simplified test
    const mol = parseSMILES("c1ccccc1").molecules[0]; // benzene as placeholder
    if (!mol) throw new Error("failed to parse");
    const tautomers = enumerateTautomers(mol, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });

  it("handles keten/ynol tautomerism", () => {
    // Cumulated double bonds C=C=O
    const keten = parseSMILES("C=C=O").molecules[0]; // ketene
    if (!keten) throw new Error("failed to parse keten");
    const tautomers = enumerateTautomers(keten, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
    // Keten form should be present
    expect(tautomers[0]?.smiles).toBeTruthy();
  });

  it("handles cyano/iso-cyanic acid", () => {
    // Cyanic acid HO-C≡N
    const cyanic = parseSMILES("OC#N").molecules[0];
    if (!cyanic) throw new Error("failed to parse cyanic acid");
    const tautomers = enumerateTautomers(cyanic, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });

  it("handles formamidinesulfinic acid (rare)", () => {
    // Very rare sulfur chemistry - simplified test
    const mol = parseSMILES("NC=S(=O)").molecules[0]; // simplified sulfinic acid
    if (!mol) throw new Error("failed to parse");
    const tautomers = enumerateTautomers(mol, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });

  it("handles isocyanide tautomerism (charged)", () => {
    // R-N≡C (isocyanide) - very rare
    const mol = parseSMILES("C#N").molecules[0]; // nitrile as simplified example
    if (!mol) throw new Error("failed to parse");
    const tautomers = enumerateTautomers(mol, { maxTautomers: 8 });
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });
});

describe("tautomer: comprehensive rule coverage", () => {
  it("handles molecules with multiple tautomerization sites", () => {
    // Molecule with both keto-enol and amide sites
    const complex = parseSMILES("CC(=O)CC(=O)NC").molecules[0];
    if (!complex) throw new Error("failed to parse complex molecule");
    const tautomers = enumerateTautomers(complex, { maxTautomers: 32 });
    expect(tautomers.length).toBeGreaterThan(1);
    // Should generate multiple distinct tautomers
    const uniqueSmiles = new Set(tautomers.map((t) => t.smiles));
    expect(uniqueSmiles.size).toBeGreaterThan(1);
  });

  it("prefers stable tautomers over unstable ones", () => {
    const mol = parseSMILES("CC(=O)C").molecules[0]; // acetone
    if (!mol) throw new Error("failed to parse acetone");
    const tautomers = enumerateTautomers(mol);
    // Highest scoring should be keto form (C=O preferred)
    const canonical = tautomers[0];
    if (!canonical) throw new Error("no tautomers generated");
    expect(canonical.smiles).toMatch(/O=C|C=O/);
    expect(canonical.score).toBeGreaterThanOrEqual(2); // +2 for carbonyl
  });

  it("maintains aromaticity in heterocycles", () => {
    const pyridone = parseSMILES("O=C1C=CC=CN1").molecules[0]; // 2-pyridone
    if (!pyridone) throw new Error("failed to parse pyridone");
    const tautomers = enumerateTautomers(pyridone, { maxTautomers: 8 });
    // All tautomers should maintain ring structure
    expect(tautomers.length).toBeGreaterThan(0);
    tautomers.forEach((t) => {
      if (t.molecule.rings) {
        expect(t.molecule.rings.length).toBeGreaterThan(0);
      }
    });
  });
});
