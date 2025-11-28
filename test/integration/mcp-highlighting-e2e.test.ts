import { describe, expect, it } from "bun:test";
import { parseSMILES, renderSVG, matchSMARTS } from "openchem";
import type { SubstructureHighlight } from "openchem";

/**
 * End-to-End Integration Tests
 *
 * These tests simulate the actual flow when a user makes a request via MCP:
 * 1. User provides SMILES and highlighting parameters
 * 2. System parses SMILES
 * 3. System matches SMARTS patterns
 * 4. System renders SVG with highlights
 *
 * These tests ensure that the complete workflow remains functional across releases.
 */
describe("MCP End-to-End Integration", () => {
  describe("User Request: Render celecoxib with highlights", () => {
    const userRequest = {
      smiles: "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F",
      highlights: [
        {
          smarts: "S(=O)(=O)N",
          color: "yellow",
        },
        {
          smarts: "C(F)(F)F",
          color: "blue",
        },
      ],
    };

    it("Step 1: Parse SMILES successfully", () => {
      const result = parseSMILES(userRequest.smiles);
      expect(result.errors).toHaveLength(0);
      expect(result.molecules).toHaveLength(1);
      expect(result.molecules[0]).toBeDefined();
    });

    it("Step 2: Match sulfonamide SMARTS pattern", () => {
      const result = parseSMILES(userRequest.smiles);
      const mol = result.molecules[0]!;

      const sulfonamideHighlight = userRequest.highlights.find((h) => h.smarts === "S(=O)(=O)N")!;
      const matchResult = matchSMARTS(sulfonamideHighlight.smarts, mol);

      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);
      expect(matchResult.matches[0]?.atoms).toBeDefined();
    });

    it("Step 3: Match trifluoromethyl SMARTS pattern", () => {
      const result = parseSMILES(userRequest.smiles);
      const mol = result.molecules[0]!;

      const cf3Highlight = userRequest.highlights.find((h) => h.smarts === "C(F)(F)F")!;
      const matchResult = matchSMARTS(cf3Highlight.smarts, mol);

      expect(matchResult.success).toBe(true);
      expect(matchResult.matches.length).toBeGreaterThan(0);
      expect(matchResult.matches[0]?.atoms).toBeDefined();
    });

    it("Step 4: Render SVG with both highlights", () => {
      const result = parseSMILES(userRequest.smiles);
      const mol = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = userRequest.highlights.map((h) => ({
        smarts: h.smarts,
        color: h.color,
      }));

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      expect(svg.errors).toHaveLength(0);
      expect(svg.svg).toContain("<svg");
      expect(svg.svg).toContain("</svg>");
      expect(svg.width).toBe(400);
      expect(svg.height).toBe(400);
    });

    it("Complete workflow: Parse → Match → Render", () => {
      // This simulates the exact flow in mcp-tools.ts render function

      // Parse SMILES
      const parseResult = parseSMILES(userRequest.smiles);
      if (parseResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${parseResult.errors[0]}`);
      }

      const mol = parseResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      // Prepare highlights
      const highlights: SubstructureHighlight[] = userRequest.highlights.map((h) => ({
        smarts: h.smarts,
        color: h.color,
      }));

      // Render SVG with highlights
      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights,
      });

      // Verify output
      expect(svg.errors).toHaveLength(0);
      expect(svg.svg).toContain("<svg");
      expect(svg.svg).toContain("</svg>");

      // Verify it's valid XML
      expect(svg.svg).toMatch(/<svg[^>]*>[\s\S]*<\/svg>/);
    });
  });

  describe("User Request: Multiple molecules with same highlight pattern", () => {
    const molecules = [
      { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
      { name: "Ibuprofen", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O" },
      { name: "Naproxen", smiles: "CC(C1=CC2=C(C=C1)C=C(C=C2)OC)C(=O)O" },
    ];

    const highlightPattern = {
      smarts: "C(=O)O",
      color: "red",
    };

    it("should process all molecules successfully", () => {
      for (const { name, smiles } of molecules) {
        const result = parseSMILES(smiles);
        expect(result.errors).toHaveLength(0);

        const mol = result.molecules[0]!;
        expect(mol).toBeDefined();

        // Match pattern
        const matchResult = matchSMARTS(highlightPattern.smarts, mol);
        expect(matchResult.success).toBe(true);

        // Render with highlight
        const svg = renderSVG(mol, {
          width: 400,
          height: 400,
          highlights: [highlightPattern],
        });

        expect(svg.errors).toHaveLength(0);
        expect(svg.svg).toContain("<svg");
      }
    });
  });

  describe("Error Handling in Workflow", () => {
    it("should handle invalid SMILES gracefully", () => {
      const invalidSmiles = "C1CCC((("; // Malformed SMILES with unmatched parens
      const result = parseSMILES(invalidSmiles);

      // Should report errors
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle malformed SMARTS patterns gracefully", () => {
      const validSmiles = "c1ccccc1";
      const result = parseSMILES(validSmiles);
      const mol = result.molecules[0]!;

      const malformedHighlights: SubstructureHighlight[] = [
        {
          smarts: "invalid((((pattern",
          color: "red",
        },
      ];

      // Should not crash, just render without the invalid highlight
      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights: malformedHighlights,
      });

      expect(svg.svg).toContain("<svg");
      // No errors should be reported - graceful degradation
    });

    it("should handle non-matching SMARTS patterns gracefully", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const nonMatchingHighlights: SubstructureHighlight[] = [
        {
          smarts: "C(=O)O", // Not present in benzene
          color: "red",
        },
      ];

      // Should render normally without highlights
      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights: nonMatchingHighlights,
      });

      expect(svg.errors).toHaveLength(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should handle empty highlights array", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        highlights: [],
      });

      expect(svg.errors).toHaveLength(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should handle undefined highlights", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      const svg = renderSVG(mol, {
        width: 400,
        height: 400,
        // highlights not provided
      });

      expect(svg.errors).toHaveLength(0);
      expect(svg.svg).toContain("<svg");
    });
  });

  describe("API Contract Tests", () => {
    it("matchSMARTS should maintain signature: (pattern, molecule, options?)", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      // Test all valid call patterns
      const result1 = matchSMARTS("c1ccccc1", mol);
      expect(result1).toBeDefined();
      expect(result1.success).toBeDefined();
      expect(result1.matches).toBeDefined();

      const result2 = matchSMARTS("c1ccccc1", mol, { maxMatches: 1 });
      expect(result2).toBeDefined();
      expect(result2.matches.length).toBeLessThanOrEqual(1);
    });

    it("renderSVG should accept highlights in options object", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      // Type safety check - this should compile
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
      expect(svg.svg).toBeDefined();
      expect(svg.width).toBe(300);
      expect(svg.height).toBe(300);
    });

    it("SubstructureHighlight should support all documented properties", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      // Test all properties
      const fullHighlight: SubstructureHighlight = {
        smarts: "c1ccccc1",
        atoms: [0, 1, 2],
        bonds: [
          [0, 1],
          [1, 2],
        ],
        color: "#FFFF00",
        atomColor: "#FF0000",
        bondColor: "#0000FF",
        opacity: 0.5,
        label: "Benzene ring",
      };

      const svg = renderSVG(mol, {
        width: 300,
        height: 300,
        highlights: [fullHighlight],
      });

      expect(svg.errors).toHaveLength(0);
    });

    it("should export SubstructureHighlight type from main package", () => {
      // This is a compile-time check
      // If the type is not exported, TypeScript will error
      const highlight: SubstructureHighlight = {
        smarts: "c1ccccc1",
        color: "yellow",
      };

      expect(highlight).toBeDefined();
    });
  });

  describe("Backward Compatibility", () => {
    it("should work without highlights parameter (pre-0.2.12 behavior)", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      // Old code that doesn't use highlights should still work
      const svg = renderSVG(mol, {
        width: 300,
        height: 300,
      });

      expect(svg.errors).toHaveLength(0);
      expect(svg.svg).toContain("<svg");
    });

    it("should work with minimal renderSVG options", () => {
      const benzene = "c1ccccc1";
      const result = parseSMILES(benzene);
      const mol = result.molecules[0]!;

      // Should use defaults
      const svg = renderSVG(mol, {});

      expect(svg.errors).toHaveLength(0);
      expect(svg.svg).toContain("<svg");
    });
  });
});
