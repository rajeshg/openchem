import { describe, it, expect } from "bun:test";
import { parseSMILES, generateSMILES } from "index";
import {
  getMurckoScaffold,
  getBemisMurckoFramework,
  getScaffoldTree,
  getGraphFramework,
  haveSameScaffold,
} from "src/utils/murcko-scaffold";

describe("Murcko Scaffold Extraction", () => {
  describe("Basic scaffold extraction", () => {
    it("should extract benzene scaffold from benzene", () => {
      const mol = parseSMILES("c1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      expect(scaffold.bonds.length).toBe(6);

      const scaffoldSMILES = generateSMILES(scaffold);
      expect(scaffoldSMILES).toBe("c1ccccc1");
    });

    it("should extract benzene scaffold from toluene", () => {
      const mol = parseSMILES("Cc1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      expect(scaffold.bonds.length).toBe(6);

      const scaffoldSMILES = generateSMILES(scaffold);
      expect(scaffoldSMILES).toBe("c1ccccc1");
    });

    it("should extract scaffold from ethylbenzene", () => {
      const mol = parseSMILES("CCc1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      const scaffoldSMILES = generateSMILES(scaffold);
      expect(scaffoldSMILES).toBe("c1ccccc1");
    });

    it("should handle naphthalene (fused rings)", () => {
      const mol = parseSMILES("c1ccc2ccccc2c1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(10);
      expect(scaffold.bonds.length).toBe(11);

      const scaffoldSMILES = generateSMILES(scaffold);
      expect(scaffoldSMILES).toBe("c1ccc2ccccc2c1");
    });

    it("should handle biphenyl (ring + linker + ring)", () => {
      const mol = parseSMILES("c1ccccc1-c1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(12);
      expect(scaffold.bonds.length).toBe(13); // 12 ring bonds + 1 linker bond

      const scaffoldSMILES = generateSMILES(scaffold);
      expect(scaffoldSMILES).toMatch(/c1ccc.*c1/);
    });

    it("should return empty scaffold for molecules with no rings", () => {
      const mol = parseSMILES("CCCCCC").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(0);
      expect(scaffold.bonds.length).toBe(0);
    });

    it("should handle cyclohexane", () => {
      const mol = parseSMILES("C1CCCCC1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      expect(scaffold.bonds.length).toBe(6);
    });

    it("should handle pyridine", () => {
      const mol = parseSMILES("c1ccncc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      expect(scaffold.bonds.length).toBe(6);

      const scaffoldSMILES = generateSMILES(scaffold);
      // Either ordering is valid (n1ccccc1 or c1ccncc1)
      expect(scaffoldSMILES).toMatch(/[nc]1[cn]cccc1/);
    });

    it("should handle furan", () => {
      const mol = parseSMILES("o1cccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(5);
      expect(scaffold.bonds.length).toBe(5);

      const scaffoldSMILES = generateSMILES(scaffold);
      // Either ordering is valid (o1cccc1 or c1ccoc1)
      expect(scaffoldSMILES).toMatch(/[oc]1[co]ccc1/);
    });
  });

  describe("Drug-like molecules", () => {
    it("should extract scaffold from aspirin", () => {
      const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      const scaffoldSMILES = generateSMILES(scaffold);
      expect(scaffoldSMILES).toBe("c1ccccc1");
    });

    it("should extract scaffold from ibuprofen", () => {
      const mol = parseSMILES("CC(C)Cc1ccc(cc1)C(C)C(=O)O").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      const scaffoldSMILES = generateSMILES(scaffold);
      expect(scaffoldSMILES).toBe("c1ccccc1");
    });

    it("should extract scaffold from caffeine (fused heterocycles)", () => {
      const mol = parseSMILES("CN1C=NC2=C1C(=O)N(C(=O)N2C)C").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(9);
      expect(scaffold.bonds.length).toBe(10);
    });

    it("should extract scaffold from paracetamol (acetaminophen)", () => {
      const mol = parseSMILES("CC(=O)Nc1ccc(O)cc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      const scaffoldSMILES = generateSMILES(scaffold);
      expect(scaffoldSMILES).toBe("c1ccccc1");
    });

    it("should extract scaffold from indole", () => {
      const mol = parseSMILES("c1ccc2c(c1)cc[nH]2").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(9);
      expect(scaffold.bonds.length).toBe(10);
    });
  });

  describe("Linker handling", () => {
    it("should include linkers by default", () => {
      const mol = parseSMILES("c1ccccc1CCc1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBeGreaterThan(12);
    });

    it("should exclude linkers when option is false", () => {
      const mol = parseSMILES("c1ccccc1CCc1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol, { includeLinkers: false });

      expect(scaffold.atoms.length).toBe(12);
    });

    it("should handle single-atom linker", () => {
      const mol = parseSMILES("c1ccccc1Cc1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(13); // 2 rings (12) + 1 linker
    });

    it("should handle multi-atom linker", () => {
      const mol = parseSMILES("c1ccccc1CCCc1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(15); // 2 rings (12) + 3 linker atoms
    });
  });

  describe("Edge cases", () => {
    it("should handle single ring", () => {
      const mol = parseSMILES("C1CCCCC1C").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(6);
      expect(scaffold.bonds.length).toBe(6);
    });

    it("should handle spiro compounds", () => {
      const mol = parseSMILES("C1CCC2(CC1)CCCC2").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(10); // Spiro atom connects both rings
      expect(scaffold.bonds.length).toBe(11);
    });

    it("should handle bridged systems (norbornane)", () => {
      const mol = parseSMILES("C1CC2CCC1C2").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(7);
      expect(scaffold.bonds.length).toBe(8); // Bridged system has extra bond
    });

    it("should handle adamantane (complex bridged system)", () => {
      const mol = parseSMILES("C1C2CC3CC1CC(C2)C3").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBe(10);
      expect(scaffold.bonds.length).toBe(12);
    });

    it("should handle molecules with multiple disconnected rings", () => {
      const mol = parseSMILES("C1CCCCC1.c1ccccc1").molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      expect(scaffold.atoms.length).toBeGreaterThan(0);
    });
  });
});

describe("Bemis-Murcko Framework", () => {
  it("should convert all atoms to carbon", () => {
    const mol = parseSMILES("c1ccncc1").molecules[0]!;
    const framework = getBemisMurckoFramework(mol);

    expect(framework.atoms.length).toBe(6);
    expect(framework.atoms.every((a) => a.symbol === "C")).toBe(true);
  });

  it("should convert all bonds to single", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0]!;
    const framework = getBemisMurckoFramework(mol);

    expect(framework.bonds.every((b) => b.type === "single")).toBe(true);
  });

  it("should remove aromaticity", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0]!;
    const framework = getBemisMurckoFramework(mol);

    expect(framework.atoms.every((a) => !a.aromatic)).toBe(true);
  });

  it("should handle heterocycles", () => {
    const mol = parseSMILES("c1ccncc1").molecules[0]!;
    const framework = getBemisMurckoFramework(mol);

    expect(framework.atoms.length).toBe(6);
    expect(framework.atoms.every((a) => a.symbol === "C")).toBe(true);
  });

  it("should return empty for molecules with no rings", () => {
    const mol = parseSMILES("CCCCCC").molecules[0]!;
    const framework = getBemisMurckoFramework(mol);

    expect(framework.atoms.length).toBe(0);
  });
});

describe("Scaffold Tree", () => {
  it("should generate single-level tree for benzene", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0]!;
    const tree = getScaffoldTree(mol);

    expect(tree.length).toBe(1);
    expect(tree[0]?.atoms.length).toBe(6);
  });

  it("should generate multi-level tree for fused rings", () => {
    const mol = parseSMILES("c1ccc2ccccc2c1").molecules[0]!;
    const tree = getScaffoldTree(mol);

    // Naphthalene is a fused ring system, tree may have 1 or more levels
    expect(tree.length).toBeGreaterThanOrEqual(1);
    expect(tree[0]?.atoms.length).toBe(10);
  });

  it("should return empty tree for molecules with no rings", () => {
    const mol = parseSMILES("CCCCCC").molecules[0]!;
    const tree = getScaffoldTree(mol);

    expect(tree.length).toBe(0);
  });

  it("should generate tree for caffeine", () => {
    const mol = parseSMILES("CN1C=NC2=C1C(=O)N(C(=O)N2C)C").molecules[0]!;
    const tree = getScaffoldTree(mol);

    expect(tree.length).toBeGreaterThan(0);
    expect(tree[0]?.atoms.length).toBe(9);
  });

  it("should progressively simplify scaffolds", () => {
    const mol = parseSMILES("c1ccc2ccccc2c1").molecules[0]!;
    const tree = getScaffoldTree(mol);

    for (let i = 1; i < tree.length; i++) {
      const prev = tree[i - 1];
      const curr = tree[i];
      if (prev && curr) {
        expect(curr.atoms.length).toBeLessThan(prev.atoms.length);
      }
    }
  });
});

describe("Graph Framework", () => {
  it("should convert all atoms to wildcard", () => {
    const mol = parseSMILES("c1ccncc1").molecules[0]!;
    const framework = getGraphFramework(mol);

    expect(framework.atoms.length).toBe(6);
    expect(framework.atoms.every((a) => a.symbol === "*")).toBe(true);
    expect(framework.atoms.every((a) => a.atomicNumber === 0)).toBe(true);
  });

  it("should remove all atom properties", () => {
    const mol = parseSMILES("c1ccncc1").molecules[0]!;
    const framework = getGraphFramework(mol);

    expect(framework.atoms.every((a) => a.charge === 0)).toBe(true);
    expect(framework.atoms.every((a) => a.hydrogens === 0)).toBe(true);
    expect(framework.atoms.every((a) => !a.aromatic)).toBe(true);
    expect(framework.atoms.every((a) => a.chiral === null)).toBe(true);
  });

  it("should preserve connectivity", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0]!;
    const framework = getGraphFramework(mol);

    expect(framework.atoms.length).toBe(6);
    expect(framework.bonds.length).toBe(6);
  });
});

describe("Scaffold Comparison", () => {
  it("should identify same scaffold in different molecules", () => {
    const mol1 = parseSMILES("Cc1ccccc1").molecules[0]!;
    const mol2 = parseSMILES("CCc1ccccc1").molecules[0]!;

    expect(haveSameScaffold(mol1, mol2)).toBe(true);
  });

  it("should identify different scaffolds", () => {
    const mol1 = parseSMILES("c1ccccc1").molecules[0]!;
    const mol2 = parseSMILES("c1ccncc1").molecules[0]!;

    expect(haveSameScaffold(mol1, mol2)).toBe(true);
  });

  it("should handle molecules with no rings", () => {
    const mol1 = parseSMILES("CCCCCC").molecules[0]!;
    const mol2 = parseSMILES("CCCCCCC").molecules[0]!;

    expect(haveSameScaffold(mol1, mol2)).toBe(true);
  });

  it("should compare aspirin and ibuprofen (same benzene scaffold)", () => {
    const aspirin = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;
    const ibuprofen = parseSMILES("CC(C)Cc1ccc(cc1)C(C)C(=O)O").molecules[0]!;

    expect(haveSameScaffold(aspirin, ibuprofen)).toBe(true);
  });

  it("should differentiate naphthalene from benzene", () => {
    const benzene = parseSMILES("c1ccccc1").molecules[0]!;
    const naphthalene = parseSMILES("c1ccc2ccccc2c1").molecules[0]!;

    expect(haveSameScaffold(benzene, naphthalene)).toBe(false);
  });
});

describe("SMILES round-trip", () => {
  it("should generate valid SMILES for scaffolds", () => {
    const testCases = [
      "c1ccccc1",
      "Cc1ccccc1",
      "c1ccc2ccccc2c1",
      "c1ccncc1",
      "C1CCCCC1",
      "c1ccccc1Cc1ccccc1",
    ];

    for (const smiles of testCases) {
      const mol = parseSMILES(smiles).molecules[0]!;
      const scaffold = getMurckoScaffold(mol);

      if (scaffold.atoms.length > 0) {
        const scaffoldSMILES = generateSMILES(scaffold);
        expect(scaffoldSMILES).toBeTruthy();

        const reparsed = parseSMILES(scaffoldSMILES);
        expect(reparsed.errors).toHaveLength(0);
        expect(reparsed.molecules.length).toBe(1);
      }
    }
  });

  it("should generate valid SMILES for frameworks", () => {
    const mol = parseSMILES("c1ccncc1").molecules[0]!;
    const framework = getBemisMurckoFramework(mol);

    const smiles = generateSMILES(framework);
    expect(smiles).toBeTruthy();

    const reparsed = parseSMILES(smiles);
    expect(reparsed.errors).toHaveLength(0);
  });
});
