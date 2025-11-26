import { describe, it, expect } from "bun:test";
import { parseIUPACName, generateSMILES } from "index";
import { BondType } from "types";

describe("New Heterocycle Parsing (IUPAC → SMILES)", () => {
  describe("5-membered aromatic rings with multiple nitrogens", () => {
    it("tetrazole - 4N + 1C ring", () => {
      const result = parseIUPACName("tetrazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(5);

      const smiles = generateSMILES(result.molecule!);
      expect(smiles).toMatch(/n.*n.*n.*n/); // Contains 4 nitrogens
    });

    it("tetrazol (shortened form)", () => {
      const result = parseIUPACName("tetrazol");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(5);
    });

    it("1-methyltetrazole - substituted tetrazole", () => {
      const result = parseIUPACName("1-methyltetrazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBeGreaterThan(5);

      const smiles = generateSMILES(result.molecule!);
      expect(smiles).toContain("C"); // Has methyl group
    });
  });

  describe("5-membered aromatic rings with O and N (isoxazoles)", () => {
    it("isoxazole - O at position 2, N at position 3", () => {
      const result = parseIUPACName("isoxazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(5);

      const smiles = generateSMILES(result.molecule!);
      expect(smiles).toContain("o"); // Contains oxygen
      expect(smiles).toContain("n"); // Contains nitrogen
    });

    it("isoxazol (shortened form)", () => {
      const result = parseIUPACName("isoxazol");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(5);
    });

    it("3-methylisoxazole - substituted isoxazole", () => {
      const result = parseIUPACName("3-methylisoxazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBeGreaterThan(5);
    });
  });

  describe("5-membered aromatic rings with S and N (isothiazoles)", () => {
    it("isothiazole - S at position 2, N at position 3", () => {
      const result = parseIUPACName("isothiazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(5);

      const smiles = generateSMILES(result.molecule!);
      expect(smiles).toContain("s"); // Contains sulfur
      expect(smiles).toContain("n"); // Contains nitrogen
    });

    it("isothiazol (shortened form)", () => {
      const result = parseIUPACName("isothiazol");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(5);
    });

    it("5-methylisothiazole - substituted isothiazole", () => {
      const result = parseIUPACName("5-methylisothiazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBeGreaterThan(5);
    });
  });

  describe("6-membered aromatic rings - diazines", () => {
    it("pyrimidine - N at positions 1,3", () => {
      const result = parseIUPACName("pyrimidine");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(6);

      const smiles = generateSMILES(result.molecule!);
      const nitrogenCount = (smiles.match(/n/g) || []).length;
      expect(nitrogenCount).toBe(2); // Exactly 2 nitrogens
    });

    it("pyrimidin (shortened form)", () => {
      const result = parseIUPACName("pyrimidin");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(6);
    });

    it("2-methylpyrimidine - substituted pyrimidine", () => {
      const result = parseIUPACName("2-methylpyrimidine");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBeGreaterThan(6);
    });

    it("pyrazine - N at positions 1,4", () => {
      const result = parseIUPACName("pyrazine");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(6);

      const smiles = generateSMILES(result.molecule!);
      const nitrogenCount = (smiles.match(/n/g) || []).length;
      expect(nitrogenCount).toBe(2); // Exactly 2 nitrogens
    });

    it("pyrazin (shortened form)", () => {
      const result = parseIUPACName("pyrazin");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(6);
    });

    it("2-methylpyrazine - substituted pyrazine", () => {
      const result = parseIUPACName("2-methylpyrazine");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBeGreaterThan(6);
    });

    it("pyridazine - N at positions 1,2", () => {
      const result = parseIUPACName("pyridazine");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(6);

      const smiles = generateSMILES(result.molecule!);
      const nitrogenCount = (smiles.match(/n/g) || []).length;
      expect(nitrogenCount).toBe(2); // Exactly 2 nitrogens
    });

    it("pyridazin (shortened form)", () => {
      const result = parseIUPACName("pyridazin");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBe(6);
    });

    it("3-methylpyridazine - substituted pyridazine", () => {
      const result = parseIUPACName("3-methylpyridazine");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
      expect(result.molecule!.atoms.length).toBeGreaterThan(6);
    });
  });

  describe("Complex substituted heterocycles", () => {
    it("2,4-dimethyltetrazole", () => {
      const result = parseIUPACName("2,4-dimethyltetrazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
    });

    it("3,5-dimethylisoxazole", () => {
      const result = parseIUPACName("3,5-dimethylisoxazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
    });

    it("2,4,6-trimethylpyrimidine", () => {
      const result = parseIUPACName("2,4,6-trimethylpyrimidine");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
    });

    it("2-chloro-5-methylisothiazole", () => {
      const result = parseIUPACName("2-chloro-5-methylisothiazole");
      expect(result.errors).toEqual([]);
      expect(result.molecule).toBeDefined();
    });
  });

  describe("Heterocycle structure validation", () => {
    it("tetrazole has correct aromatic bonds", () => {
      const result = parseIUPACName("tetrazole");
      const molecule = result.molecule!;

      const aromaticBonds = molecule.bonds.filter((b) => b.type === BondType.AROMATIC);
      expect(aromaticBonds.length).toBe(5); // 5-membered aromatic ring
    });

    it("pyrimidine has correct aromatic bonds", () => {
      const result = parseIUPACName("pyrimidine");
      const molecule = result.molecule!;

      const aromaticBonds = molecule.bonds.filter((b) => b.type === BondType.AROMATIC);
      expect(aromaticBonds.length).toBe(6); // 6-membered aromatic ring
    });

    it("isoxazole has O and N heteroatoms", () => {
      const result = parseIUPACName("isoxazole");
      const molecule = result.molecule!;

      const oxygenCount = molecule.atoms.filter((a) => a.symbol === "O").length;
      const nitrogenCount = molecule.atoms.filter((a) => a.symbol === "N").length;
      const carbonCount = molecule.atoms.filter((a) => a.symbol === "C").length;

      expect(oxygenCount).toBe(1);
      expect(nitrogenCount).toBe(1);
      expect(carbonCount).toBe(3);
    });

    it("isothiazole has S and N heteroatoms", () => {
      const result = parseIUPACName("isothiazole");
      const molecule = result.molecule!;

      const sulfurCount = molecule.atoms.filter((a) => a.symbol === "S").length;
      const nitrogenCount = molecule.atoms.filter((a) => a.symbol === "N").length;
      const carbonCount = molecule.atoms.filter((a) => a.symbol === "C").length;

      expect(sulfurCount).toBe(1);
      expect(nitrogenCount).toBe(1);
      expect(carbonCount).toBe(3);
    });

    it("tetrazole has 4 nitrogens and 1 carbon", () => {
      const result = parseIUPACName("tetrazole");
      const molecule = result.molecule!;

      const nitrogenCount = molecule.atoms.filter((a) => a.symbol === "N").length;
      const carbonCount = molecule.atoms.filter((a) => a.symbol === "C").length;

      expect(nitrogenCount).toBe(4);
      expect(carbonCount).toBe(1);
    });
  });
});
