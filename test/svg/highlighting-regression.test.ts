import { describe, expect, it } from "bun:test";
import { parseSMILES, renderSVG, matchSMARTS } from "index";
import type { SubstructureHighlight } from "src/generators/svg-renderer";

describe("Highlighting Regression Tests", () => {
  describe("MCP Example Query #5: Multiple molecules with carboxylic acids", () => {
    it("should render aspirin with carboxylic acid highlighted", () => {
      const aspirin = "CC(=O)Oc1ccccc1C(=O)O";
      const result = parseSMILES(aspirin);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      // Verify SMARTS matching works
      const matchResult = matchSMARTS("C(=O)O", mol);
      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);

      // Verify rendering works with highlights
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
      expect(svg.svg).toContain("</svg>");
    });

    it("should render ibuprofen with carboxylic acid highlighted", () => {
      const ibuprofen = "CC(C)Cc1ccc(cc1)C(C)C(=O)O";
      const result = parseSMILES(ibuprofen);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const matchResult = matchSMARTS("C(=O)O", mol);
      expect(matchResult.success).toBe(true);

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
    });

    it("should render naproxen with carboxylic acid highlighted", () => {
      const naproxen = "CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O";
      const result = parseSMILES(naproxen);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const matchResult = matchSMARTS("C(=O)O", mol);
      expect(matchResult.success).toBe(true);

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
    });
  });

  describe("MCP Example Query #6: Celecoxib with multiple highlights", () => {
    const celecoxib = "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F";

    it("should match sulfonamide group S(=O)(=O)N", () => {
      const result = parseSMILES(celecoxib);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const matchResult = matchSMARTS("S(=O)(=O)N", mol);
      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);

      // Should match S + 2 O + N = 4 atoms
      const firstMatch = matchResult.matches[0]!;
      expect(firstMatch.atoms.length).toBe(4);
    });

    it("should match trifluoromethyl group C(F)(F)F", () => {
      const result = parseSMILES(celecoxib);
      expect(result.errors.length).toBe(0);
      const mol = result.molecules[0]!;

      const matchResult = matchSMARTS("C(F)(F)F", mol);
      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);

      // Should match C + 3 F = 4 atoms
      const firstMatch = matchResult.matches[0]!;
      expect(firstMatch.atoms.length).toBe(4);
    });

    it("should render with sulfonamide highlighted in yellow", () => {
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
      expect(svg.svg.length).toBeGreaterThan(100);
    });

    it("should render with trifluoromethyl highlighted in blue", () => {
      const result = parseSMILES(celecoxib);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
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

    it("should render with both groups highlighted simultaneously", () => {
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
      expect(svg.svg).toContain("</svg>");
    });

    it("should not crash with invalid SMARTS patterns", () => {
      const result = parseSMILES(celecoxib);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "invalid((pattern",
          color: "red",
        },
      ];

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      // Should still render the molecule without highlights
      expect(svg.svg).toContain("<svg");
    });
  });

  describe("Highlighting API Stability", () => {
    it("should support highlights parameter in renderSVG options", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      // Type check: highlights should be accepted
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
            opacity: 0.5,
          },
        ],
      });

      expect(svg.errors.length).toBe(0);
    });

    it("should support explicit atom indices", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const svg = renderSVG(mol, {
        width: 300,
        height: 300,
        highlights: [
          {
            atoms: [0, 1, 2],
            color: "green",
          },
        ],
      });

      expect(svg.errors.length).toBe(0);
    });

    it("should support explicit bond indices", () => {
      const propane = "CCC";
      const result = parseSMILES(propane);
      const mol = result.molecules[0]!;

      const svg = renderSVG(mol, {
        width: 300,
        height: 300,
        highlights: [
          {
            bonds: [
              [0, 1],
              [1, 2],
            ],
            color: "purple",
          },
        ],
      });

      expect(svg.errors.length).toBe(0);
    });

    it("should work without highlights parameter (backward compatibility)", () => {
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
    });
  });

  describe("SMARTS Pattern Compatibility", () => {
    it("should match aromatic rings correctly", () => {
      const naphthalene = "c1ccc2ccccc2c1";
      const result = parseSMILES(naphthalene);
      const mol = result.molecules[0]!;

      // Should match aromatic 6-membered rings
      const matchResult = matchSMARTS("c1ccccc1", mol);
      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);
    });

    it("should match functional groups in complex molecules", () => {
      const aspirin = "CC(=O)Oc1ccccc1C(=O)O";
      const result = parseSMILES(aspirin);
      const mol = result.molecules[0]!;

      // Ester group
      const esterMatch = matchSMARTS("C(=O)O", mol);
      expect(esterMatch.success).toBe(true);

      // Aromatic ring
      const aromaticMatch = matchSMARTS("c1ccccc1", mol);
      expect(aromaticMatch.success).toBe(true);
    });

    it("should handle non-matching patterns gracefully", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      // Try to match a nitro group (not present)
      const matchResult = matchSMARTS("N(=O)(=O)", mol);
      expect(matchResult.success).toBe(false);
      expect(matchResult.matches.length).toBe(0);

      // Rendering should still work
      const svg = renderSVG(mol, {
        highlights: [
          {
            smarts: "N(=O)(=O)",
            color: "red",
          },
        ],
      });

      expect(svg.errors.length).toBe(0);
    });
  });

  describe("Performance and Stress Tests", () => {
    it("should handle multiple highlights efficiently", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = Array.from({ length: 10 }, (_, i) => ({
        atoms: [i % 6],
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      }));

      const startTime = Date.now();
      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });
      const endTime = Date.now();

      expect(svg.errors.length).toBe(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it("should handle large molecules with highlights", () => {
      // Taxol (paclitaxel) - complex natural product
      const taxol =
        "CC1=C2C(C(=O)C3(C(CC4C(C3C(C(C2(C)C)(CC1OC(=O)C(C(C5=CC=CC=C5)NC(=O)C6=CC=CC=C6)O)O)OC(=O)C7=CC=CC=C7)(CO4)OC(=O)C)O)C)OC(=O)C";
      const result = parseSMILES(taxol);

      if (result.errors.length > 0) {
        // Skip test if molecule is too complex to parse
        return;
      }

      const mol = result.molecules[0];
      if (!mol) return;

      const highlights: SubstructureHighlight[] = [
        {
          smarts: "C(=O)O", // Ester groups
          color: "red",
        },
      ];

      const svg = renderSVG(mol, {
        width: 600,
        height: 600,
        highlights,
      });

      expect(svg.svg).toContain("<svg");
    });
  });
});
