import { describe, it, expect } from "bun:test";
import { parseIUPACName, generateSMILES, parseSMILES } from "index";

describe("Spiro Compound Parsing", () => {
  it("should parse spiro[4.5]decane and generate the correct SMILES", () => {
    const iupacName = "spiro[4.5]decane";
    const result = parseIUPACName(iupacName);

    expect(result.errors?.length ?? 0).toBe(0);
    expect(result.molecule).toBeDefined();

    if (result.molecule) {
      const smiles = generateSMILES(result.molecule, true);
      const reference = parseSMILES("C1CCC2(C1)CCCCC2").molecules[0]!;
      const canonicalReference = generateSMILES(reference, true);

      // Both should canonicalize to the same SMILES
      const smilesCanonical = generateSMILES(
        parseSMILES(smiles).molecules[0]!,
        true,
      );
      expect(smilesCanonical).toBe(canonicalReference);
      expect(result.molecule.atoms.length).toBe(10);
    }
  });

  it("should parse spiro[3.3]heptane", () => {
    const iupacName = "spiro[3.3]heptane";
    const result = parseIUPACName(iupacName);

    expect(result.errors?.length ?? 0).toBe(0);
    expect(result.molecule).toBeDefined();

    if (result.molecule) {
      // spiro[3.3]heptane has 3+3+1=7 carbons total (3 in first ring, 3 in second ring, 1 shared)
      expect(result.molecule.atoms.length).toBe(7);

      // Generate SMILES and verify it can be re-parsed
      const smiles = generateSMILES(result.molecule, true);
      const reparsed = parseSMILES(smiles).molecules[0];
      expect(reparsed).toBeDefined();
    }
  });

  it("should parse spiro[5.5]undecane", () => {
    const iupacName = "spiro[5.5]undecane";
    const result = parseIUPACName(iupacName);

    expect(result.errors?.length ?? 0).toBe(0);
    expect(result.molecule).toBeDefined();

    if (result.molecule) {
      // spiro[5.5]undecane has 5+5+1=11 carbons total
      expect(result.molecule.atoms.length).toBe(11);

      // Generate SMILES and verify it can be re-parsed
      const smiles = generateSMILES(result.molecule, true);
      const reparsed = parseSMILES(smiles).molecules[0];
      expect(reparsed).toBeDefined();
    }
  });

  it("should parse spiro[4.4]nonane", () => {
    const iupacName = "spiro[4.4]nonane";
    const result = parseIUPACName(iupacName);

    expect(result.errors?.length ?? 0).toBe(0);
    expect(result.molecule).toBeDefined();

    if (result.molecule) {
      // spiro[4.4]nonane has 4+4+1=9 carbons total
      expect(result.molecule.atoms.length).toBe(9);

      const smiles = generateSMILES(result.molecule, true);
      const reparsed = parseSMILES(smiles).molecules[0];
      expect(reparsed).toBeDefined();
    }
  });
});
