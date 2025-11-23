import { describe, it, expect } from "bun:test";
import {
  parseSMILES,
  generateSMILES,
  checkLipinskiRuleOfFive,
  getRingInfo,
  matchSMARTS,
  parseSMARTS,
  generateMolfile,
  parseMolfile,
  computeMorganFingerprint,
  computeLogP,
  getMolecularFormula,
  getMolecularMass,
  getHBondDonorCount,
  getHBondAcceptorCount,
  getRotatableBondCount,
  getTPSA,
  getHeavyAtomCount,
  getRingCount,
} from "index";
import { PackedMolecule } from "src/utils/packed-molecule";

describe("Backward Compatibility", () => {
  const testSmiles = [
    "CC(=O)Oc1ccccc1C(=O)O", // aspirin
    "CCO", // ethanol
    "c1ccccc1", // benzene
    "CC(C)CC1=CC=C(C=C1)C(C)C", // ibuprofen-like
    "C1CCCCC1", // cyclohexane
  ];

  it("should parse SMILES using existing API", () => {
    for (const smiles of testSmiles) {
      const result = parseSMILES(smiles);
      expect(result.molecules.length).toBeGreaterThan(0);
      const mol = result.molecules[0];
      expect(mol).toBeDefined();
      if (!mol) continue;

      expect(mol.atoms).toBeDefined();
      expect(mol.bonds).toBeDefined();
      expect(mol.atoms.length).toBeGreaterThan(0);
    }
  });

  it("should generate SMILES using existing API", () => {
    for (const smiles of testSmiles) {
      const result = parseSMILES(smiles);
      const mol = result.molecules[0];
      if (!mol) continue;

      const generated = generateSMILES(mol);

      expect(typeof generated).toBe("string");
      expect(generated.length).toBeGreaterThan(0);

      // Generated SMILES should parse correctly
      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules.length).toBeGreaterThan(0);
    }
  });

  it("should get molecular properties using existing API", () => {
    const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0];
    if (!mol) return;

    // These should not throw and should return valid values
    expect(getMolecularFormula(mol)).toBeDefined();
    expect(getMolecularMass(mol)).toBeGreaterThan(0);
    expect(getHBondDonorCount(mol)).toBeGreaterThanOrEqual(0);
    expect(getHBondAcceptorCount(mol)).toBeGreaterThanOrEqual(0);
    expect(getRotatableBondCount(mol)).toBeGreaterThanOrEqual(0);
    expect(getTPSA(mol)).toBeGreaterThanOrEqual(0);
    expect(getHeavyAtomCount(mol)).toBeGreaterThan(0);
    expect(getRingCount(mol)).toBeGreaterThanOrEqual(0);
    expect(computeLogP(mol)).toBeDefined();
  });

  it("should check Lipinski's Rule of Five using existing API", () => {
    const aspirin = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0];
    if (!aspirin) return;

    const result = checkLipinskiRuleOfFive(aspirin);

    expect(result).toBeDefined();
    expect(typeof result.passes).toBe("boolean");
    expect(typeof result.violations).toBe("object");
    expect(typeof result.properties).toBe("object");
  });

  it("should get ring info using existing API", () => {
    const benzene = parseSMILES("c1ccccc1").molecules[0];
    if (!benzene) return;

    const ringInfo = getRingInfo(benzene);

    expect(ringInfo).toBeDefined();
    expect(ringInfo.numRings()).toBeGreaterThan(0);
    expect(Array.isArray(ringInfo.rings())).toBe(true);
  });

  it("should compute Morgan fingerprints using existing API", () => {
    const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0];
    if (!mol) return;

    const fp = computeMorganFingerprint(mol);

    expect(fp).toBeDefined();
    // Morgan fingerprint returns Uint8Array
    expect(fp instanceof Uint8Array).toBe(true);
    expect(fp.length).toBeGreaterThan(0);
  });

  it("should generate and parse MOL files using existing API", () => {
    for (const smiles of testSmiles) {
      const mol = parseSMILES(smiles).molecules[0];
      if (!mol) continue;

      const molfile = generateMolfile(mol);

      expect(typeof molfile).toBe("string");
      expect(molfile.length).toBeGreaterThan(0);

      const parsed = parseMolfile(molfile);
      expect(parsed.molecule).toBeDefined();
      if (parsed.molecule) {
        expect(parsed.molecule.atoms.length).toBe(mol.atoms.length);
        expect(parsed.molecule.bonds.length).toBe(mol.bonds.length);
      }
    }
  });

  it("should match SMARTS patterns using existing API", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0];
    if (!mol) return;

    const smartsResult = parseSMARTS("c1ccccc1");
    expect(smartsResult.pattern).toBeDefined();

    const pattern = smartsResult.pattern;
    if (pattern) {
      const matches = matchSMARTS(pattern, mol);
      expect(matches).toBeDefined();
      expect(typeof matches === "object").toBe(true);
    }
  });

  it("should handle new PackedMolecule API without breaking existing code", () => {
    const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0];
    if (!mol) return;

    // Existing code should work
    const smiles1 = generateSMILES(mol);
    expect(typeof smiles1).toBe("string");

    // New API should not interfere
    const packed = new PackedMolecule(mol);
    expect(packed).toBeDefined();

    // Existing code should still work after using new API
    const smiles2 = generateSMILES(mol);
    expect(smiles1).toBe(smiles2);
  });

  it("should maintain atom/bond integrity across operations", () => {
    const smiles = "CC(=O)Oc1ccccc1C(=O)O";
    const mol = parseSMILES(smiles).molecules[0];
    if (!mol) return;

    // Store original properties
    const originalAtomCount = mol.atoms.length;
    const originalBondCount = mol.bonds.length;

    // Perform various operations
    generateSMILES(mol);
    generateMolfile(mol);
    checkLipinskiRuleOfFive(mol);
    getRingInfo(mol);
    computeMorganFingerprint(mol);
    new PackedMolecule(mol);

    // Verify nothing changed
    expect(mol.atoms.length).toBe(originalAtomCount);
    expect(mol.bonds.length).toBe(originalBondCount);
  });

  it("should handle edge cases consistently", () => {
    // Single atom
    const h2 = parseSMILES("[H][H]");
    expect(h2.molecules.length).toBeGreaterThan(0);

    // Charged molecule
    const charged = parseSMILES("[NH4+]");
    expect(charged.molecules.length).toBeGreaterThan(0);

    // Radical
    const radical = parseSMILES("[CH3]");
    expect(radical.molecules.length).toBeGreaterThan(0);
  });

  it("should maintain fingerprint consistency", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0];
    if (!mol) return;

    const fp1 = computeMorganFingerprint(mol);
    const fp2 = computeMorganFingerprint(mol);

    // Same molecule should produce same fingerprint
    expect(Buffer.from(fp1)).toEqual(Buffer.from(fp2));
  });

  it("should maintain round-trip consistency", () => {
    for (const smiles of testSmiles) {
      const mol1 = parseSMILES(smiles).molecules[0];
      if (!mol1) continue;

      const generated = generateSMILES(mol1);
      const mol2 = parseSMILES(generated).molecules[0];
      if (!mol2) continue;

      // Properties should match
      expect(mol2.atoms.length).toBe(mol1.atoms.length);
      expect(mol2.bonds.length).toBe(mol1.bonds.length);

      // Fingerprints should match
      const fp1 = computeMorganFingerprint(mol1);
      const fp2 = computeMorganFingerprint(mol2);
      expect(Buffer.from(fp1)).toEqual(Buffer.from(fp2));
    }
  });
});
