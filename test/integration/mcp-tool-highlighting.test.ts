import { describe, expect, it } from "bun:test";
import { parseSMILES, renderSVG, matchSMARTS, type SubstructureHighlight } from "openchem";

describe("MCP Highlighting Integration", () => {
  describe("SMARTS Pattern Matching for Highlights", () => {
    it("should match sulfonamide group in celecoxib", () => {
      const celecoxib = "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F";
      const result = parseSMILES(celecoxib);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const sulfonamide = "S(=O)(=O)N";
      const matchResult = matchSMARTS(sulfonamide, mol);

      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);
      expect(matchResult.matches[0]?.atoms.length).toBeGreaterThan(0);
    });

    it("should match trifluoromethyl group in celecoxib", () => {
      const celecoxib = "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F";
      const result = parseSMILES(celecoxib);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const trifluoromethyl = "C(F)(F)F";
      const matchResult = matchSMARTS(trifluoromethyl, mol);

      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);
      expect(matchResult.matches[0]?.atoms.length).toBe(4); // C + 3F
    });

    it("should match carboxylic acid group", () => {
      const aspirin = "CC(=O)Oc1ccccc1C(=O)O";
      const result = parseSMILES(aspirin);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const carboxylicAcid = "C(=O)O";
      const matchResult = matchSMARTS(carboxylicAcid, mol);

      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);
    });

    it("should match benzene ring", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const benzenePattern = "c1ccccc1";
      const matchResult = matchSMARTS(benzenePattern, mol);

      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);
      expect(matchResult.matches[0]?.atoms.length).toBe(6);
    });
  });

  describe("SVG Rendering with Highlights", () => {
    it("should render celecoxib with sulfonamide highlighted", () => {
      const celecoxib = "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F";
      const result = parseSMILES(celecoxib);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "S(=O)(=O)N",
          color: "yellow",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
      expect(svg.svg).toContain("</svg>");
      expect(svg.svg.length).toBeGreaterThan(100);
    });

    it("should render celecoxib with multiple highlighted groups", () => {
      const celecoxib = "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F";
      const result = parseSMILES(celecoxib);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "S(=O)(=O)N",
          color: "yellow",
        },
        {
          smarts: "C(F)(F)F",
          color: "blue",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should render aspirin with carboxylic acid highlighted in red", () => {
      const aspirin = "CC(=O)Oc1ccccc1C(=O)O";
      const result = parseSMILES(aspirin);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "C(=O)O",
          color: "#FF0000",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should handle malformed SMARTS gracefully", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "invalid((((smarts",
          color: "red",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      // Should not crash, just skip the invalid highlight
      expect(svg.svg).toContain("<svg");
    });

    it("should render with explicit atom indices", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          atoms: [0, 1, 2],
          color: "#00FF00",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should render with explicit bond indices", () => {
      const propane = "CCC";
      const result = parseSMILES(propane);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          bonds: [[0, 1]],
          color: "#FF00FF",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should support custom colors with names", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "c1ccccc1",
          color: "yellow",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should support custom opacity", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "c1ccccc1",
          color: "red",
          opacity: 0.5,
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });
  });

  describe("MCP Example Queries", () => {
    it("should handle 'Render aspirin, ibuprofen, and naproxen with carboxylic acids highlighted'", () => {
      const molecules = [
        "CC(=O)Oc1ccccc1C(=O)O", // Aspirin
        "CC(C)Cc1ccc(cc1)C(C)C(=O)O", // Ibuprofen
        "CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O", // Naproxen
      ];

      for (const smiles of molecules) {
        const result = parseSMILES(smiles);
        expect(result.errors.length).toBe(0);
        const mol = result.molecules[0]!;

        const highlights: SubstructureHighlight[] = [
          {
            smarts: "C(=O)O",
            color: "red",
          },
        ];

        const svg = renderSVG(mol, {
          width: 400,
          height: 400,
          highlights,
        });

        expect(svg.errors.length).toBe(0);
        expect(svg.svg).toContain("<svg");
      }
    });

    it("should handle 'Render celecoxib with sulfonamide (yellow) and trifluoromethyl (blue) highlighted'", () => {
      const celecoxib = "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F";
      const result = parseSMILES(celecoxib);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "S(=O)(=O)N",
          color: "yellow",
        },
        {
          smarts: "C(F)(F)F",
          color: "blue",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });
  });

  describe("Highlighting API Consistency", () => {
    it("should accept highlights parameter in renderSVG", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      // This should compile and run without errors
      const svg = renderSVG(mol, {
        width: 300,
        height: 300,
        highlights: [
          {
            smarts: "c1ccccc1",
            color: "yellow",
            opacity: 0.3,
          },
        ],
      });

      expect(svg).toBeDefined();
      expect(svg.svg).toContain("<svg");
    });

    it("should accept empty highlights array", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const svg = renderSVG(mol, {
        width: 300,
        height: 300,
        highlights: [],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should work without highlights parameter", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const svg = renderSVG(mol, {
        width: 300,
        height: 300,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should support atomColor and bondColor overrides", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const svg = renderSVG(mol, {
        width: 300,
        height: 300,
        highlights: [
          {
            smarts: "c1ccccc1",
            atomColor: "#FF0000",
            bondColor: "#0000FF",
          },
        ],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle non-matching SMARTS patterns", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "C(=O)O", // Carboxylic acid - not in benzene
          color: "red",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should handle invalid atom indices gracefully", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          atoms: [0, 1, 999], // 999 is out of bounds
          color: "red",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.svg).toContain("<svg");
    });

    it("should handle invalid bond indices gracefully", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          bonds: [[0, 999]], // Invalid bond
          color: "red",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.svg).toContain("<svg");
    });

    it("should handle overlapping highlights", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          atoms: [0, 1, 2],
          color: "red",
        },
        {
          atoms: [1, 2, 3],
          color: "blue",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<svg");
    });
  });
});
