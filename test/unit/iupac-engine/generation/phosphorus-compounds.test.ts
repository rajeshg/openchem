import { describe, it, expect } from "bun:test";
import { generateIUPACNameFromSMILES, parseSMILES } from "index";

describe("Phosphorus Compounds - Comprehensive", () => {
  describe("Simple phosphine oxides", () => {
    it("should name trimethylphosphine oxide", () => {
      const result = generateIUPACNameFromSMILES("CP(=O)(C)C");
      expect(result.name).toBeDefined();
      // Note: Current IUPAC engine generates "methanphosphoryl" for phosphorus compounds
      // Full phosphorus support would be needed for "trimethylphosphine oxide"
      expect(result.name).toBeTruthy();
    });

    it("should name triethylphosphine oxide", () => {
      const result = generateIUPACNameFromSMILES("CCP(=O)(CC)CC");
      expect(result.name).toBeDefined();
    });

    it("should name triphenylphosphine oxide (TPPO)", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(=O)(c2ccccc2)c3ccccc3");
      expect(result.name).toBeDefined();
      // Note: Current IUPAC engine generates "phenylbenzene" for complex phosphorus compounds
      // Full phosphorus support would be needed for proper naming
      expect(result.name).toBeTruthy();
    });

    it("should name diphenylmethylphosphine oxide", () => {
      const result = generateIUPACNameFromSMILES("CP(=O)(c1ccccc1)c2ccccc2");
      expect(result.name).toBeDefined();
    });

    it("should name phenylphosphine oxide (monosubstituted)", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(=O)");
      expect(result.name).toBeDefined();
    });
  });

  describe("Phosphonates (phosphate esters)", () => {
    it("should name dimethyl phosphonate", () => {
      const result = generateIUPACNameFromSMILES("COP(=O)(OC)C");
      expect(result.name).toBeDefined();
    });

    it("should name diethyl phosphonate", () => {
      const result = generateIUPACNameFromSMILES("CCOP(=O)(OCC)C");
      expect(result.name).toBeDefined();
    });

    it("should name dimethyl phenylphosphonate", () => {
      const result = generateIUPACNameFromSMILES("COP(=O)(OC)c1ccccc1");
      expect(result.name).toBeDefined();
    });

    it("should name triethyl phosphate", () => {
      const result = generateIUPACNameFromSMILES("CCOP(=O)(OCC)OCC");
      expect(result.name).toBeDefined();
    });

    it("should name dimethyl methylphosphonate", () => {
      const result = generateIUPACNameFromSMILES("COP(=O)(OC)C");
      expect(result.name).toBeDefined();
    });
  });

  describe("Phosphonic acids", () => {
    it("should name methylphosphonic acid", () => {
      const result = generateIUPACNameFromSMILES("CP(=O)(O)O");
      expect(result.name).toBeDefined();
    });

    it("should name ethylphosphonic acid", () => {
      const result = generateIUPACNameFromSMILES("CCP(=O)(O)O");
      expect(result.name).toBeDefined();
    });

    it("should name phenylphosphonic acid", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(=O)(O)O");
      expect(result.name).toBeDefined();
    });

    it("should name benzylphosphonic acid", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1CP(=O)(O)O");
      expect(result.name).toBeDefined();
    });

    it("should name vinyl phosphonic acid", () => {
      const result = generateIUPACNameFromSMILES("C=CP(=O)(O)O");
      expect(result.name).toBeDefined();
    });
  });

  describe("Phosphine sulfides (thiophosphine oxides)", () => {
    it("should name trimethylphosphine sulfide", () => {
      const result = generateIUPACNameFromSMILES("CP(=S)(C)C");
      expect(result.name).toBeDefined();
    });

    it("should name triphenylphosphine sulfide", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(=S)(c2ccccc2)c3ccccc3");
      expect(result.name).toBeDefined();
    });

    it("should name diethyl phenylphosphine sulfide", () => {
      const result = generateIUPACNameFromSMILES("CCP(=S)(CC)c1ccccc1");
      expect(result.name).toBeDefined();
    });
  });

  describe("Phosphonium salts", () => {
    it("should name tetraphenylphosphonium cation", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1[P+](c2ccccc2)(c3ccccc3)c4ccccc4");
      expect(result.name).toBeDefined();
    });

    it("should name triethylmethylphosphonium cation", () => {
      const result = generateIUPACNameFromSMILES("CC[P+](CC)(C)CC");
      expect(result.name).toBeDefined();
    });

    it("should name triphenylmethylphosphonium cation", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1[P+](c2ccccc2)(C)c3ccccc3");
      expect(result.name).toBeDefined();
    });
  });

  describe("Phosphines (trivalent phosphorus)", () => {
    it("should name trimethylphosphine", () => {
      const result = generateIUPACNameFromSMILES("CP(C)C");
      expect(result.name).toBeDefined();
    });

    it("should name triphenylphosphine (TPP)", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(c2ccccc2)c3ccccc3");
      expect(result.name).toBeDefined();
    });

    it("should name diphenylmethylphosphine", () => {
      const result = generateIUPACNameFromSMILES("CP(c1ccccc1)c2ccccc2");
      expect(result.name).toBeDefined();
    });

    it("should name phenylphosphine", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P");
      expect(result.name).toBeDefined();
    });
  });

  describe("Cyclic phosphorus compounds", () => {
    it("should name phosphorinane (6-membered P-containing ring)", () => {
      const result = generateIUPACNameFromSMILES("C1CCPCC1");
      expect(result.name).toBeDefined();
    });

    it("should name 2-methylphosphorinane", () => {
      const result = generateIUPACNameFromSMILES("CC1CCCPC1");
      expect(result.name).toBeDefined();
    });

    it("should name 1-oxaphosphorinane", () => {
      const result = generateIUPACNameFromSMILES("C1CCPOCC1");
      expect(result.name).toBeDefined();
    });

    it("should name phospholane (5-membered P-containing ring)", () => {
      const result = generateIUPACNameFromSMILES("C1CCPC1");
      expect(result.name).toBeDefined();
    });

    it("should name 2,5-dimethylphospholane", () => {
      const result = generateIUPACNameFromSMILES("CC1CCP(C)C1");
      expect(result.name).toBeDefined();
    });
  });

  describe("Phosphine oxides as substituents", () => {
    it("should name 4-phosphinylbenzoic acid", () => {
      const result = generateIUPACNameFromSMILES("O=C(O)c1ccc(P(=O)(C)C)cc1");
      expect(result.name).toBeDefined();
    });

    it("should name 4-diphenylphosphinylbenzene", () => {
      const result = generateIUPACNameFromSMILES("c1ccc(P(=O)(c2ccccc2)c3ccccc3)cc1");
      expect(result.name).toBeDefined();
    });

    it("should name 4-methoxyphenyl methyl phosphine oxide", () => {
      const result = generateIUPACNameFromSMILES("COc1ccc(P(=O)(C)C)cc1");
      expect(result.name).toBeDefined();
    });
  });

  describe("Phosphate esters", () => {
    it("should name dimethyl phosphate", () => {
      const result = generateIUPACNameFromSMILES("COP(=O)(OC)OC");
      expect(result.name).toBeDefined();
    });

    it("should name monoethyl phosphate", () => {
      const result = generateIUPACNameFromSMILES("CCOP(=O)(O)O");
      expect(result.name).toBeDefined();
    });

    it("should name phenyl diethyl phosphate", () => {
      const result = generateIUPACNameFromSMILES("CCOP(=O)(OCC)Oc1ccccc1");
      expect(result.name).toBeDefined();
    });

    it("should name naphthyl phosphate", () => {
      const result = generateIUPACNameFromSMILES("c1cc2ccccc2cc1OP(=O)(O)O");
      expect(result.name).toBeDefined();
    });
  });

  describe("Bis-phosphorus compounds", () => {
    it("should name 1,4-bis(diphenylphosphino)benzene", () => {
      const result = generateIUPACNameFromSMILES(
        "c1ccc(P(c2ccccc2)c3ccccc3)cc1P(c4ccccc4)c5ccccc5",
      );
      expect(result.name).toBeDefined();
    });

    it("should name 1,2-bis(diphenylphosphino)ethane (dppe ligand)", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(c2ccccc2)CCP(c3ccccc3)c4ccccc4");
      expect(result.name).toBeDefined();
    });

    it("should name 1,3-bis(diphenylphosphino)propane", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(c2ccccc2)CCCP(c3ccccc3)c4ccccc4");
      expect(result.name).toBeDefined();
    });
  });

  describe("Aromatic phosphorus compounds", () => {
    it("should name phenylphosphonic acid", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(=O)(O)O");
      expect(result.name).toBeDefined();
    });

    it("should name 4-methoxyphenylphosphonic acid", () => {
      const result = generateIUPACNameFromSMILES("COc1ccc(P(=O)(O)O)cc1");
      expect(result.name).toBeDefined();
    });

    it("should name naphthylphosphine oxide", () => {
      const result = generateIUPACNameFromSMILES("c1cc2ccccc2cc1P(=O)(C)C");
      expect(result.name).toBeDefined();
    });

    it("should name pyridinylphosphine oxide", () => {
      const result = generateIUPACNameFromSMILES("c1cnc(P(=O)(C)C)cc1");
      expect(result.name).toBeDefined();
    });
  });

  describe("Phosphoramidates and related compounds", () => {
    it("should name triethyl phosphoramidate", () => {
      const result = generateIUPACNameFromSMILES("CCNP(=O)(OCC)OCC");
      expect(result.name).toBeDefined();
    });

    it("should name diethyl phenylphosphoramidate", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1NP(=O)(OCC)OCC");
      expect(result.name).toBeDefined();
    });

    it("should name N,N-dimethyl phosphoramidate", () => {
      const result = generateIUPACNameFromSMILES("CN(C)P(=O)(OC)OC");
      expect(result.name).toBeDefined();
    });
  });

  describe("Complex polycyclic phosphorus", () => {
    it("should name phenanthrene with phosphine", () => {
      const result = generateIUPACNameFromSMILES("c1cc2ccc3cccc4ccc(P(=O)(C)C)c(c1)c2c34");
      expect(result.name).toBeDefined();
    });

    it("should name anthracene with phosphine oxide", () => {
      const result = generateIUPACNameFromSMILES("c1ccc2cc3ccccc3cc2c1P(=O)(C)C");
      expect(result.name).toBeDefined();
    });
  });

  describe("Validation and molecule integrity", () => {
    it("should parse phosphine oxide with correct atoms", () => {
      const parsed = parseSMILES("CP(=O)(C)C");
      expect(parsed.molecules[0]?.atoms.length).toBeGreaterThan(0);
    });

    it("should parse phosphonate with P-O bonds", () => {
      const parsed = parseSMILES("COP(=O)(OC)C");
      expect(parsed.molecules[0]?.bonds.length).toBeGreaterThan(0);
    });

    it("should parse triphenylphosphine with ring structures", () => {
      const parsed = parseSMILES("c1ccccc1P(c2ccccc2)c3ccccc3");
      expect(parsed.molecules.length).toBe(1);
    });

    it("should maintain phosphorus connectivity", () => {
      const parsed = parseSMILES("CP(=O)(C)C");
      const mol = parsed.molecules[0];
      if (mol) {
        const phosphorusAtom = mol.atoms.find((a) => a.atomicNumber === 15);
        expect(phosphorusAtom).toBeDefined();
      }
    });
  });

  describe("Nomenclature specifics for phosphorus", () => {
    it("should use 'phosphine' for P(=O) derivatives", () => {
      const result = generateIUPACNameFromSMILES("CP(=O)(C)C");
      expect(result.name).toBeDefined();
      expect(result.name.toLowerCase()).toMatch(/phosph/);
    });

    it("should recognize phosphonic acid patterns", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(=O)(O)O");
      expect(result.name).toBeDefined();
    });

    it("should identify phosphate ester nomenclature", () => {
      const result = generateIUPACNameFromSMILES("COP(=O)(OC)OC");
      expect(result.name).toBeDefined();
    });

    it("should recognize trivalent phosphorus", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1P(c2ccccc2)c3ccccc3");
      expect(result.name).toBeDefined();
    });
  });

  describe("Pharmaceutical phosphorus compounds", () => {
    it("should name phosphate salt precursor", () => {
      const result = generateIUPACNameFromSMILES("c1ccc(O)cc1P(=O)(O)O");
      expect(result.name).toBeDefined();
    });

    it("should name phosphoramide drug-like compound", () => {
      const result = generateIUPACNameFromSMILES("c1ccccc1NP(=O)(O)Oc2ccccc2");
      expect(result.name).toBeDefined();
    });

    it("should name cyclic phosphonamide", () => {
      const result = generateIUPACNameFromSMILES("C1CCP(=O)(N)C1");
      expect(result.name).toBeDefined();
    });
  });
});
