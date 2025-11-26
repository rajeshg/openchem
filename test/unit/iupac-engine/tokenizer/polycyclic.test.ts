import { describe, it, expect } from "bun:test";
import { parseSMILES, generateSMILES } from "index";
import { IUPACTokenizer } from "src/parsers/iupac-parser/iupac-tokenizer";
import type { OPSINRules } from "src/parsers/iupac-parser/iupac-types";
import opsinRulesData from "opsin-rules.json";

describe("Polycyclic Compound IUPAC Parsing", () => {
  const rules = (opsinRulesData as unknown as OPSINRules) || ({} as OPSINRules);
  const tokenizer = new IUPACTokenizer(rules);

  describe("Bicyclic Systems - Tokenization", () => {
    it("should tokenize bicyclo[3.3.1]nonane correctly", () => {
      const iupacName = "bicyclo[3.3.1]nonane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);
      expect(result.tokens.length).toBeGreaterThan(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens.length).toBe(1);
      expect(prefixTokens[0]?.value).toBe("bicyclo[3.3.1]");
      expect(prefixTokens[0]?.metadata?.hasBridgeNotation).toBe(true);
    });

    it("should tokenize 9-oxabicyclo[3.3.1]nonane correctly", () => {
      const iupacName = "9-oxabicyclo[3.3.1]nonane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens.length).toBe(1);
      expect(prefixTokens[0]?.value).toContain("bicyclo");
      expect(prefixTokens[0]?.metadata?.hasBridgeNotation).toBe(true);
    });

    it("should tokenize bicyclo[4.4.0]decane correctly", () => {
      const iupacName = "bicyclo[4.4.0]decane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens[0]?.value).toBe("bicyclo[4.4.0]");
    });
  });

  describe("Tricyclic Systems - Tokenization", () => {
    it("should tokenize tricyclo[2.2.1.0^2,6]heptane correctly", () => {
      const iupacName = "tricyclo[2.2.1.0^2,6]heptane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens.length).toBeGreaterThan(0);
      expect(prefixTokens[0]?.value).toContain("tricyclo");
      expect(prefixTokens[0]?.metadata?.hasBridgeNotation).toBe(true);
    });

    it("should tokenize 3,12-dioxatricyclo[6.4.0.0^2,7]dodecane correctly", () => {
      const iupacName = "3,12-dioxatricyclo[6.4.0.0^2,7]dodecane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens.length).toBeGreaterThan(0);
      expect(prefixTokens[0]?.value).toContain("tricyclo");
      expect(prefixTokens[0]?.value).toContain("oxa");
    });

    it("should tokenize tricyclo[6.4.0.0^2,7]dodecane correctly", () => {
      const iupacName = "tricyclo[6.4.0.0^2,7]dodecane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens[0]?.value).toContain("tricyclo");
    });
  });

  describe("Pentacyclic Systems - Tokenization", () => {
    it("should tokenize pentacyclo[12.3.2.0^1,13.0^2,10.0^6,10]nonadecane correctly", () => {
      const iupacName = "pentacyclo[12.3.2.0^1,13.0^2,10.0^6,10]nonadecane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens.length).toBeGreaterThan(0);
      expect(prefixTokens[0]?.value).toContain("pentacyclo");
      expect(prefixTokens[0]?.metadata?.hasBridgeNotation).toBe(true);
    });

    it("should tokenize 8,15,19-trioxapentacyclo[12.3.2.0^1,13.0^2,10.0^6,10]nonadec-5-en-7-one correctly", () => {
      const iupacName = "8,15,19-trioxapentacyclo[12.3.2.0^1,13.0^2,10.0^6,10]nonadec-5-en-7-one";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens[0]?.value).toContain("pentacyclo");
      expect(prefixTokens[0]?.value).toContain("oxa");
    });
  });

  describe("Hexacyclic Systems - Tokenization", () => {
    it("should tokenize hexacyclo[...] patterns", () => {
      const iupacName = "hexacyclo[15.3.2.2^3,7.1^2,12.0^13,21.0^11,25]pentacosane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens[0]?.value).toContain("hexacyclo");
    });
  });

  describe("Heptacyclic Systems - Tokenization", () => {
    it("should tokenize heptacyclo[...] patterns", () => {
      const iupacName = "heptacyclo[12.7.1.1^2,9.1^3,6.0^2,13.0^3,7.0^18,22]docosane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens[0]?.value).toContain("heptacyclo");
    });
  });

  describe("Spiro Compounds - Tokenization", () => {
    it("should tokenize spiro[4.5]decane correctly", () => {
      const iupacName = "spiro[4.5]decane";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens[0]?.value).toBe("spiro[4.5]");
      expect(prefixTokens[0]?.metadata?.hasBridgeNotation).toBe(true);
    });

    it("should tokenize 1-bromo-3-chlorospiro[4.5]decan-7-ol correctly", () => {
      const iupacName = "1-bromo-3-chlorospiro[4.5]decan-7-ol";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens[0]?.value).toBe("spiro[4.5]");
    });

    it("should tokenize 6,6-dimethylspiro[4.5]decan-7-one correctly", () => {
      const iupacName = "6,6-dimethylspiro[4.5]decan-7-one";
      const result = tokenizer.tokenize(iupacName);

      expect(result.errors.length).toBe(0);

      const prefixTokens = result.tokens.filter((t) => t.type === "PREFIX");
      expect(prefixTokens[0]?.value).toBe("spiro[4.5]");
    });
  });

  describe("Bicyclic SMILES Parsing and Generation", () => {
    it("should parse bicyclo[3.3.1]nonane SMILES correctly", () => {
      const smiles = "C1CCC2CCCC1C2";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBe(9);
      expect(mol.bonds.length).toBeGreaterThan(0);
      expect(mol.rings?.length).toBe(2);
    });

    it("should generate valid SMILES from bicyclic structure", () => {
      const smiles = "C1CCC2CCCC1C2";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();
      expect(generated.length).toBeGreaterThan(0);

      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
      expect(reparsed.molecules[0]?.bonds.length).toBe(mol.bonds.length);
    });

    it("should handle oxabicyclic compounds", () => {
      const smiles = "C1CCC2CCCC1OC2";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;

      const oxygenAtoms = mol.atoms.filter((a) => a.atomicNumber === 8);
      expect(oxygenAtoms.length).toBe(1);
    });
  });

  describe("Tricyclic SMILES Parsing and Generation", () => {
    it("should parse norbornane-like tricyclic structure", () => {
      const smiles = "C1CC2C3CCC(C3)C2C1";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBeGreaterThan(0);
      expect((mol.rings?.length ?? 0) >= 2).toBe(true);
    });

    it("should generate valid SMILES from tricyclic structure", () => {
      const smiles = "C1CC2C3CCC(C3)C2C1";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();

      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });
  });

  describe("Spiro Compound SMILES Parsing and Generation", () => {
    it("should parse spiro[4.5]decane SMILES correctly", () => {
      const smiles = "C1CCC2(C1)CCCCC2";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBe(10);
      expect(mol.rings?.length).toBe(2);
    });

    it("should verify spiro junction (single atom)", () => {
      const smiles = "C1CCC2(C1)CCCCC2";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      let sharedAtomCount = 0;
      if (mol.rings && mol.rings.length >= 2) {
        const ring1Set = new Set(mol.rings[0]);
        const ring2Set = new Set(mol.rings[1]);

        for (const atom of ring1Set) {
          if (ring2Set.has(atom)) {
            sharedAtomCount++;
          }
        }
      }

      expect(sharedAtomCount).toBe(1);
    });

    it("should generate valid SMILES from spiro structure", () => {
      const smiles = "C1CCC2(C1)CCCCC2";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      const generated = generateSMILES(mol, true);
      expect(generated).toBeDefined();

      const reparsed = parseSMILES(generated);
      expect(reparsed.molecules[0]?.atoms.length).toBe(mol.atoms.length);
    });

    it("should handle spiro compounds with substituents", () => {
      const smiles = "CC1CCC2(C1)CCCCC2";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBe(11);

      const carbons = mol.atoms.filter((a) => a.atomicNumber === 6);
      expect(carbons.length).toBe(11);
    });
  });

  describe("No Fragment Generation for Bicyclic/Tricyclic", () => {
    it("bicyclo[3.3.1]nonane should NOT generate fragments", () => {
      const smiles = "C1CCC2CCCC1C2";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      expect(parsed.molecules[0]?.atoms.length).toBe(9);

      const mol = parsed.molecules[0]!;
      expect(mol.bonds.length).toBeGreaterThan(0);
    });

    it("tricyclic structure should NOT generate fragments", () => {
      const smiles = "C1CC2C3CCC(C3)C2C1";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
    });

    it("spiro compound should NOT generate fragments", () => {
      const smiles = "C1CCC2(C1)CCCCC2";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      expect(parsed.molecules[0]?.atoms.length).toBe(10);
    });
  });

  describe("Edge Cases and Complex Structures", () => {
    it("should handle bicyclic with oxygen heteroatom and substituent", () => {
      const smiles = "CC1(C)CC2CCC(O)C1C2";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;

      const oxygens = mol.atoms.filter((a) => a.atomicNumber === 8);
      expect(oxygens.length).toBe(1);

      expect(mol.bonds.length).toBeGreaterThan(0);
    });

    it("should handle complex tricyclic with heteroatom", () => {
      const smiles = "C1CC2C3(C1)CCOC3CC2";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;

      const oxygens = mol.atoms.filter((a) => a.atomicNumber === 8);
      expect(oxygens.length).toBe(1);
    });

    it("should handle decalin (bicyclo[4.4.0]decane) correctly", () => {
      const smiles = "C1CCC2CCCCC2C1";
      const parsed = parseSMILES(smiles);

      expect(parsed.molecules.length).toBe(1);
      const mol = parsed.molecules[0]!;
      expect(mol.atoms.length).toBe(10);
      expect(mol.rings?.length).toBe(2);
    });
  });

  describe("Ring Count Verification", () => {
    it("bicyclo[3.3.1]nonane should have exactly 2 rings", () => {
      const smiles = "C1CC2CCC1C2";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      expect(mol.rings?.length).toBe(2);
    });

    it("tricyclic structure should have at least 2 rings", () => {
      const smiles = "C1CC2C3CCC(C3)C2C1";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      expect((mol.rings?.length ?? 0) >= 2).toBe(true);
    });

    it("spiro[4.5]decane should have exactly 2 rings", () => {
      const smiles = "C1CCC2(C1)CCCCC2";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      expect(mol.rings?.length).toBe(2);
    });
  });

  describe("Bridge Notation Correctness", () => {
    it("bicyclo[3.3.1] notation represents 3+3+1+2 atoms", () => {
      const smiles = "C1CCC2CCCC1C2";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      expect(mol.atoms.length).toBe(9);
    });

    it("bicyclo[4.4.0] notation represents 4+4+0+2 atoms", () => {
      const smiles = "C1CCC2CCCCC2C1";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      expect(mol.atoms.length).toBe(10);
    });

    it("spiro[4.5] notation represents 4+5+1 atoms", () => {
      const smiles = "C1CCC2(C1)CCCCC2";
      const parsed = parseSMILES(smiles);
      const mol = parsed.molecules[0]!;

      expect(mol.atoms.length).toBe(10);
    });
  });
});
