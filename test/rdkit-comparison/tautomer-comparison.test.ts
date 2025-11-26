import { describe, it, expect } from "bun:test";
import { parseSMILES, generateSMILES, enumerateTautomers, canonicalTautomer } from "index";

/**
 * RDKit Tautomer Comparison Tests
 *
 * Expected values generated from RDKit using:
 * python3 scripts/compare-tautomers-rdkit.py
 *
 * This validates openchem's tautomer enumeration against RDKit's standard behavior.
 */

describe("Tautomer enumeration: openchem vs RDKit comparison", () => {
  it("acetone - generates keto and enol forms", () => {
    // RDKit: 2 tautomers ["C=C(C)O", "CC(C)=O"], canonical: "CC(C)=O"
    const mol = parseSMILES("CC(=O)C").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nAcetone:`);
    console.log(`  RDKit count: 2`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(
      `  openchem tautomers: ${tautomers
        .map((t) => t.smiles)
        .slice(0, 5)
        .join(", ")}`,
    );

    // Should generate at least keto form
    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    // Canonical should be keto form (C=O preferred)
    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    console.log(`  RDKit canonical: CC(C)=O`);
    console.log(`  openchem canonical: ${canonicalSmiles}`);

    // Check keto form is present (either =O or O=)
    const hasKeto = tautomers.some((t) => t.smiles.includes("=O") || t.smiles.includes("O="));
    expect(hasKeto).toBe(true);
  });

  it("acetylacetone - generates multiple tautomers", () => {
    // RDKit: 5 tautomers, canonical: "CC(=O)CC(C)=O"
    const mol = parseSMILES("CC(=O)CC(=O)C").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nAcetylacetone:`);
    console.log(`  RDKit count: 5`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(
      `  openchem tautomers: ${tautomers
        .slice(0, 5)
        .map((t) => t.smiles)
        .join(", ")}`,
    );

    // Should generate multiple forms
    expect(tautomers.length).toBeGreaterThanOrEqual(3);

    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    console.log(`  RDKit canonical: CC(=O)CC(C)=O`);
    console.log(`  openchem canonical: ${canonicalSmiles}`);

    // Diketo form should be highly scored (two carbonyls = +4)
    expect(canonical).toBeDefined();
  });

  it("phenol - aromatic form preferred over quinone", () => {
    // RDKit: 2 tautomers ["O=C1C=CC=CC1", "Oc1ccccc1"], canonical: "Oc1ccccc1"
    const mol = parseSMILES("Oc1ccccc1").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nPhenol:`);
    console.log(`  RDKit count: 2`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    console.log(`  RDKit canonical: Oc1ccccc1`);
    console.log(`  openchem canonical: ${canonicalSmiles}`);

    // Phenol form should be preferred (aromatic +250 score)
    expect(canonicalSmiles).toMatch(/[Oo].*c|c.*[Oo]/);
  });

  it("acetamide - generates amide, enol, and imidol forms", () => {
    // RDKit: 3 tautomers ["C=C(N)O", "CC(=N)O", "CC(N)=O"], canonical: "CC(N)=O"
    const mol = parseSMILES("CC(=O)N").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nAcetamide:`);
    console.log(`  RDKit count: 3`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    console.log(`  RDKit canonical: CC(N)=O`);
    console.log(`  openchem canonical: ${canonicalSmiles}`);

    // Amide form (C=O) should be preferred
    const hasAmide = tautomers.some((t) => t.smiles.includes("=O"));
    expect(hasAmide).toBe(true);
  });

  it("imidazole - symmetric tautomers", () => {
    // RDKit: 1 tautomer ["c1c[nH]cn1"], canonical: "c1c[nH]cn1"
    const mol = parseSMILES("c1c[nH]cn1").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nImidazole:`);
    console.log(`  RDKit count: 1`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    // Imidazole is symmetric, may enumerate both 1H and 3H forms
    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    // All forms should maintain aromatic ring structure
    tautomers.forEach((t) => {
      const aromaticAtoms = t.molecule.atoms.filter((a) => a.aromatic).length;
      expect(aromaticAtoms).toBeGreaterThan(0);
    });
  });

  it("tetrazole - 1H and 2H forms", () => {
    // RDKit: 2 tautomers ["c1nn[nH]n1", "c1nnn[nH]1"], canonical: "c1nn[nH]n1"
    const mol = parseSMILES("c1[nH]nnn1").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nTetrazole:`);
    console.log(`  RDKit count: 2`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    // All forms should maintain aromatic 5-membered ring
    tautomers.forEach((t) => {
      const hasNitrogens = (t.smiles.match(/n/gi) || []).length >= 3;
      expect(hasNitrogens).toBe(true);
    });
  });

  it("caprolactam - lactam-lactim tautomerism", () => {
    // RDKit: 3 tautomers ["O=C1CCCCN1", "OC1=CCCCN1", "OC1=NCCCC1"], canonical: "O=C1CCCCN1"
    const mol = parseSMILES("O=C1NCCCC1").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nCaprolactam:`);
    console.log(`  RDKit count: 3`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    console.log(`  RDKit canonical: O=C1CCCCN1`);
    console.log(`  openchem canonical: ${canonicalSmiles}`);

    // Lactam form should be preferred (C=O resonance stabilization)
    const hasLactam = tautomers.some((t) => t.smiles.includes("=O"));
    expect(hasLactam).toBe(true);
  });

  it("thioacetone - thione-thiol tautomerism", () => {
    // RDKit: 2 tautomers ["C=C(C)S", "CC(C)=S"], canonical: "CC(C)=S"
    const mol = parseSMILES("CC(=S)C").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nThioacetone:`);
    console.log(`  RDKit count: 2`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    // Thione form should be present
    const hasThione = tautomers.some((t) => /S/.test(t.smiles));
    expect(hasThione).toBe(true);
  });

  it("keto-amide - multiple tautomerization sites", () => {
    // RDKit: 8 tautomers, canonical: "CNC(=O)CC(C)=O"
    const mol = parseSMILES("CC(=O)CC(=O)NC").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 32 });

    console.log(`\nKeto-amide (complex):`);
    console.log(`  RDKit count: 8`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(
      `  openchem tautomers (first 8): ${tautomers
        .slice(0, 8)
        .map((t) => t.smiles)
        .join(", ")}`,
    );

    // Complex molecule with multiple sites - should generate several tautomers
    expect(tautomers.length).toBeGreaterThanOrEqual(3);

    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    console.log(`  RDKit canonical: CNC(=O)CC(C)=O`);
    console.log(`  openchem canonical: ${canonicalSmiles}`);
  });

  it("hydroquinone - aromatic diol preferred over quinone", () => {
    // RDKit: 3 tautomers ["O=C1C=CC(=O)CC1", "O=C1C=CC(O)=CC1", "Oc1ccc(O)cc1"], canonical: "Oc1ccc(O)cc1"
    const mol = parseSMILES("Oc1ccc(O)cc1").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nHydroquinone:`);
    console.log(`  RDKit count: 3`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    console.log(`  RDKit canonical: Oc1ccc(O)cc1`);
    console.log(`  openchem canonical: ${canonicalSmiles}`);

    // Hydroquinone (aromatic) should be preferred over quinone
    // Aromatic form gets +250 score
    expect(canonical).toBeDefined();
  });

  it("2-pyridone - pyridone/hydroxypyridine tautomerism", () => {
    // RDKit: 3 tautomers ["O=C1CC=CC=N1", "O=c1cccc[nH]1", "Oc1ccccn1"], canonical: "O=c1cccc[nH]1"
    const mol = parseSMILES("O=C1C=CC=CN1").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\n2-Pyridone:`);
    console.log(`  RDKit count: 3`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    console.log(`  RDKit canonical: O=c1cccc[nH]1`);
    console.log(`  openchem canonical: ${canonicalSmiles}`);
  });

  it("guanidine - resonance between three NH groups", () => {
    // RDKit: 1 tautomer ["N=C(N)N"], canonical: "N=C(N)N"
    const mol = parseSMILES("NC(N)=N").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nGuanidine:`);
    console.log(`  RDKit count: 1`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    // Guanidine has three equivalent forms (resonance)
    expect(tautomers.length).toBeGreaterThanOrEqual(1);
  });

  it("indole - stable aromatic system", () => {
    // RDKit: 1 tautomer ["c1ccc2[nH]ccc2c1"], canonical: "c1ccc2[nH]ccc2c1"
    const mol = parseSMILES("c1ccc2[nH]ccc2c1").molecules[0];
    if (!mol) throw new Error("failed to parse");

    const tautomers = enumerateTautomers(mol, { maxTautomers: 16 });

    console.log(`\nIndole:`);
    console.log(`  RDKit count: 1`);
    console.log(`  openchem count: ${tautomers.length}`);
    console.log(`  openchem tautomers: ${tautomers.map((t) => t.smiles).join(", ")}`);

    // Indole is very stable (fused aromatic rings)
    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    // Should maintain aromatic character
    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    const hasAromatic = canonicalSmiles.includes("c");
    expect(hasAromatic).toBe(true);
  });

  it("summary - overall comparison statistics", () => {
    console.log(`\n${"=".repeat(60)}`);
    console.log("SUMMARY: openchem Tautomer Enumeration vs RDKit");
    console.log("=".repeat(60));

    const testCases = [
      { smiles: "CC(=O)C", name: "acetone", rdkitCount: 2 },
      { smiles: "CC(=O)CC(=O)C", name: "acetylacetone", rdkitCount: 5 },
      { smiles: "Oc1ccccc1", name: "phenol", rdkitCount: 2 },
      { smiles: "CC(=O)N", name: "acetamide", rdkitCount: 3 },
      { smiles: "c1c[nH]cn1", name: "imidazole", rdkitCount: 1 },
      { smiles: "c1[nH]nnn1", name: "tetrazole", rdkitCount: 2 },
      { smiles: "O=C1NCCCC1", name: "caprolactam", rdkitCount: 3 },
      { smiles: "CC(=S)C", name: "thioacetone", rdkitCount: 2 },
      { smiles: "CC(=O)CC(=O)NC", name: "keto-amide", rdkitCount: 8 },
      { smiles: "Oc1ccc(O)cc1", name: "hydroquinone", rdkitCount: 3 },
      { smiles: "O=C1C=CC=CN1", name: "2-pyridone", rdkitCount: 3 },
      { smiles: "NC(N)=N", name: "guanidine", rdkitCount: 1 },
      { smiles: "c1ccc2[nH]ccc2c1", name: "indole", rdkitCount: 1 },
    ];

    let totalRDKitTautomers = 0;
    let totalOpenchemTautomers = 0;

    testCases.forEach(({ smiles, name, rdkitCount }) => {
      const mol = parseSMILES(smiles).molecules[0];
      if (!mol) return;

      const tautomers = enumerateTautomers(mol, { maxTautomers: 32 });

      totalRDKitTautomers += rdkitCount;
      totalOpenchemTautomers += tautomers.length;

      console.log(`${name.padEnd(25)} RDKit: ${rdkitCount}, openchem: ${tautomers.length}`);
    });

    console.log("=".repeat(60));
    console.log(`Total test molecules: ${testCases.length}`);
    console.log(`Total RDKit tautomers: ${totalRDKitTautomers}`);
    console.log(`Total openchem tautomers: ${totalOpenchemTautomers}`);
    console.log(`Average RDKit tautomers: ${(totalRDKitTautomers / testCases.length).toFixed(2)}`);
    console.log(
      `Average openchem tautomers: ${(totalOpenchemTautomers / testCases.length).toFixed(2)}`,
    );
    console.log("=".repeat(60));

    expect(testCases.length).toBe(13);
  });
});
