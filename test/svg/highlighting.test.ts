import { describe, expect, it } from "bun:test";
import { parseSMILES } from "index";
import { renderSVG } from "src/generators/svg-renderer";
import type {
  SubstructureHighlight,
  AtomHighlight,
  BondHighlight,
} from "src/generators/svg-renderer";

describe("SVG Highlighting", () => {
  describe("Atom Highlighting", () => {
    it("should highlight specific atoms by index", () => {
      const result = parseSMILES("c1ccccc1");
      const molecule = result.molecules[0]!;

      const atomHighlight: AtomHighlight = {
        atoms: [0, 1, 2],
        color: "#FF0000",
        opacity: 0.5,
      };

      const svg = renderSVG(molecule, {
        width: 400,
        height: 400,
        atomHighlights: [atomHighlight],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<circle");
      expect(svg.svg).toContain("#FF0000");
      expect(svg.svg).toContain('opacity="0.5"');
    });

    it("should use default yellow color for atom highlights", () => {
      const result = parseSMILES("CCO");
      const molecule = result.molecules[0]!;

      const atomHighlight: AtomHighlight = {
        atoms: [2],
      };

      const svg = renderSVG(molecule, {
        atomHighlights: [atomHighlight],
      });

      expect(svg.svg).toContain("#FFFF00");
      expect(svg.svg).toContain('opacity="0.3"');
    });

    it("should support custom radius for atom highlights", () => {
      const result = parseSMILES("C");
      const molecule = result.molecules[0]!;

      const atomHighlight: AtomHighlight = {
        atoms: [0],
        radius: 2.5,
      };

      const svg = renderSVG(molecule, {
        atomHighlights: [atomHighlight],
      });

      const radiusMatch = svg.svg.match(/r="(\d+\.?\d*)"/);
      expect(radiusMatch).toBeTruthy();
      if (radiusMatch) {
        const radius = parseFloat(radiusMatch[1]!);
        expect(radius).toBe(8 * 2.5);
      }
    });
  });

  describe("Bond Highlighting", () => {
    it("should highlight specific bonds by atom pairs", () => {
      const result = parseSMILES("CCC");
      const molecule = result.molecules[0]!;

      const bondHighlight: BondHighlight = {
        bonds: [[0, 1]],
        color: "#0000FF",
        opacity: 0.7,
      };

      const svg = renderSVG(molecule, {
        bondHighlights: [bondHighlight],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<line");
      expect(svg.svg).toContain("#0000FF");
      expect(svg.svg).toContain('opacity="0.7"');
    });

    it("should use default red color for bond highlights", () => {
      const result = parseSMILES("CC");
      const molecule = result.molecules[0]!;

      const bondHighlight: BondHighlight = {
        bonds: [[0, 1]],
      };

      const svg = renderSVG(molecule, {
        bondHighlights: [bondHighlight],
      });

      expect(svg.svg).toContain("#FF0000");
      expect(svg.svg).toContain('opacity="0.8"');
    });

    it("should support custom width for bond highlights", () => {
      const result = parseSMILES("CC");
      const molecule = result.molecules[0]!;

      const bondHighlight: BondHighlight = {
        bonds: [[0, 1]],
        width: 3.0,
      };

      const svg = renderSVG(molecule, {
        bondHighlights: [bondHighlight],
      });

      expect(svg.svg).toContain('stroke-width="6"');
    });
  });

  describe("SMARTS-based Highlighting", () => {
    it("should highlight benzene ring using SMARTS", () => {
      const result = parseSMILES("CC(=O)Oc1ccccc1C(=O)O");
      const molecule = result.molecules[0]!;

      const highlight: SubstructureHighlight = {
        smarts: "c1ccccc1",
        color: "#FFFF00",
        opacity: 0.4,
      };

      const svg = renderSVG(molecule, {
        highlights: [highlight],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<circle");
      expect(svg.svg).toContain("#FFFF00");
    });

    it("should highlight carboxylic acid group", () => {
      const result = parseSMILES("CC(=O)O");
      const molecule = result.molecules[0]!;

      const highlight: SubstructureHighlight = {
        smarts: "C(=O)O",
        color: "#FF0000",
      };

      const svg = renderSVG(molecule, {
        highlights: [highlight],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<circle");
    });

    it("should highlight hydroxyl group", () => {
      const result = parseSMILES("CCO");
      const molecule = result.molecules[0]!;

      const highlight: SubstructureHighlight = {
        smarts: "CO",
        color: "#00FF00",
      };

      const svg = renderSVG(molecule, {
        highlights: [highlight],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("#00FF00");
    });

    it("should handle no matches gracefully", () => {
      const result = parseSMILES("CCCC");
      const molecule = result.molecules[0]!;

      const highlight: SubstructureHighlight = {
        smarts: "c1ccccc1",
        color: "#FF0000",
      };

      const svg = renderSVG(molecule, {
        highlights: [highlight],
      });

      expect(svg.errors.length).toBe(0);
    });
  });

  describe("Multiple Highlights", () => {
    it("should render multiple atom highlights with different colors", () => {
      const result = parseSMILES("c1ccccc1");
      const molecule = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        { atoms: [0, 1], color: "#FF0000" },
        { atoms: [3, 4], color: "#00FF00" },
      ];

      const svg = renderSVG(molecule, {
        highlights,
      });

      expect(svg.svg).toContain("#FF0000");
      expect(svg.svg).toContain("#00FF00");
    });

    it("should highlight both atoms and bonds", () => {
      const result = parseSMILES("CCC");
      const molecule = result.molecules[0]!;

      const highlight: SubstructureHighlight = {
        atoms: [0, 1, 2],
        bonds: [
          [0, 1],
          [1, 2],
        ],
        color: "#0000FF",
      };

      const svg = renderSVG(molecule, {
        highlights: [highlight],
      });

      expect(svg.svg).toContain("<circle");
      expect(svg.svg).toContain("<line");
      expect(svg.svg).toContain("#0000FF");
    });

    it("should support separate atom and bond colors", () => {
      const result = parseSMILES("CC");
      const molecule = result.molecules[0]!;

      const highlight: SubstructureHighlight = {
        atoms: [0, 1],
        bonds: [[0, 1]],
        atomColor: "#FF0000",
        bondColor: "#0000FF",
      };

      const svg = renderSVG(molecule, {
        highlights: [highlight],
      });

      expect(svg.svg).toContain("#FF0000");
      expect(svg.svg).toContain("#0000FF");
    });
  });

  describe("Complex Molecules", () => {
    it("should highlight aspirin with multiple functional groups", () => {
      const result = parseSMILES("CC(=O)Oc1ccccc1C(=O)O");
      const molecule = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        { smarts: "C(=O)O", color: "#FF0000", label: "Carboxylic acid" },
        { smarts: "OC(=O)C", color: "#00FF00", label: "Ester" },
      ];

      const svg = renderSVG(molecule, {
        highlights,
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("<circle");
    });

    it("should highlight ibuprofen aromatic ring", () => {
      const result = parseSMILES("CC(C)Cc1ccc(cc1)C(C)C(=O)O");
      const molecule = result.molecules[0]!;

      const highlight: SubstructureHighlight = {
        smarts: "c1ccccc1",
        color: "#FFFF00",
        opacity: 0.3,
      };

      const svg = renderSVG(molecule, {
        highlights: [highlight],
      });

      expect(svg.errors.length).toBe(0);
    });

    it("should highlight caffeine heterocyclic rings", () => {
      const result = parseSMILES("CN1C=NC2=C1C(=O)N(C(=O)N2C)C");
      const molecule = result.molecules[0]!;

      const highlight: SubstructureHighlight = {
        smarts: "n1cnc2n(c1)c(=O)n(c2=O)",
        color: "#FF00FF",
      };

      const svg = renderSVG(molecule, {
        highlights: [highlight],
      });

      expect(svg.errors.length).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty highlights array", () => {
      const result = parseSMILES("C");
      const molecule = result.molecules[0]!;

      const svg = renderSVG(molecule, {
        highlights: [],
      });

      expect(svg.errors.length).toBe(0);
    });

    it("should handle invalid atom indices gracefully", () => {
      const result = parseSMILES("CC");
      const molecule = result.molecules[0]!;

      const atomHighlight: AtomHighlight = {
        atoms: [999],
      };

      const svg = renderSVG(molecule, {
        atomHighlights: [atomHighlight],
      });

      expect(svg.errors.length).toBe(0);
    });

    it("should handle invalid bond indices gracefully", () => {
      const result = parseSMILES("CC");
      const molecule = result.molecules[0]!;

      const bondHighlight: BondHighlight = {
        bonds: [[999, 1000]],
      };

      const svg = renderSVG(molecule, {
        bondHighlights: [bondHighlight],
      });

      expect(svg.errors.length).toBe(0);
    });

    it("should render highlights without options object", () => {
      const result = parseSMILES("C");
      const molecule = result.molecules[0]!;

      const svg = renderSVG(molecule);

      expect(svg.errors.length).toBe(0);
    });

    it("should handle SMARTS with no matches", () => {
      const result = parseSMILES("CCCC");
      const molecule = result.molecules[0]!;

      const svg = renderSVG(molecule, {
        highlights: [{ smarts: "c1ccccc1", color: "#FF0000" }],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).not.toContain('fill="#FF0000"');
    });

    it("should handle malformed SMARTS gracefully", () => {
      const result = parseSMILES("c1ccccc1");
      const molecule = result.molecules[0]!;

      const svg = renderSVG(molecule, {
        highlights: [{ smarts: "c1ccccc", color: "#FF0000" }],
      });

      expect(svg.errors.length).toBe(0);
    });
  });

  describe("Multi-Molecule Highlighting", () => {
    it("should highlight same pattern in multiple molecules", () => {
      const mol1 = parseSMILES("c1ccccc1").molecules[0]!;
      const mol2 = parseSMILES("c1ccccc1C").molecules[0]!;

      const svg1 = renderSVG(mol1, {
        highlights: [{ smarts: "c1ccccc1", color: "#FFFF00" }],
      });

      const svg2 = renderSVG(mol2, {
        highlights: [{ smarts: "c1ccccc1", color: "#FFFF00" }],
      });

      expect(svg1.errors.length).toBe(0);
      expect(svg2.errors.length).toBe(0);
      expect(svg1.svg).toContain('fill="#FFFF00"');
      expect(svg2.svg).toContain('fill="#FFFF00"');
    });

    it("should handle grid rendering with highlights", () => {
      const molecules = [
        parseSMILES("c1ccccc1").molecules[0]!,
        parseSMILES("CC(=O)O").molecules[0]!,
        parseSMILES("CCO").molecules[0]!,
      ];

      const svg = renderSVG(molecules, {
        highlights: [{ smarts: "c1ccccc1", color: "#00FF00" }],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('fill="#00FF00"');
    });

    it("should highlight different patterns in different molecules", () => {
      const mol1 = parseSMILES("c1ccccc1CC").molecules[0]!;
      const mol2 = parseSMILES("CCCCCC").molecules[0]!;

      const svg1 = renderSVG([mol1, mol2], {
        highlights: [{ smarts: "c1ccccc1", color: "#FF0000" }],
      });

      expect(svg1.errors.length).toBe(0);
      expect(svg1.svg).toContain('fill="#FF0000"');
    });

    it("should apply multiple highlights to multiple molecules", () => {
      const molecules = [
        parseSMILES("c1ccccc1C(=O)O").molecules[0]!,
        parseSMILES("c1ccccc1CCO").molecules[0]!,
        parseSMILES("CC(=O)O").molecules[0]!,
      ];

      const svg = renderSVG(molecules, {
        highlights: [
          { smarts: "c1ccccc1", color: "#FFFF00" },
          { smarts: "C(=O)O", color: "#FF0000" },
        ],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('fill="#FFFF00"');
      expect(svg.svg).toContain('fill="#FF0000"');
    });
  });

  describe("Stress Tests", () => {
    it("should handle many highlights on same molecule", () => {
      const result = parseSMILES("c1ccccc1c2ccccc2c3ccccc3");
      const molecule = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        { smarts: "c1ccccc1", color: "#FF0000" },
        { smarts: "c1ccccc1", color: "#00FF00" },
        { smarts: "c1ccccc1", color: "#0000FF" },
      ];

      const svg = renderSVG(molecule, { highlights });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('fill="#FF0000"');
    });

    it("should handle overlapping atom highlights", () => {
      const result = parseSMILES("CCCCCC");
      const molecule = result.molecules[0]!;

      const atomHighlights: AtomHighlight[] = [
        { atoms: [0, 1, 2], color: "#FF0000", opacity: 0.3 },
        { atoms: [2, 3, 4], color: "#00FF00", opacity: 0.3 },
        { atoms: [4, 5], color: "#0000FF", opacity: 0.3 },
      ];

      const svg = renderSVG(molecule, { atomHighlights });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('fill="#FF0000"');
      expect(svg.svg).toContain('fill="#00FF00"');
      expect(svg.svg).toContain('fill="#0000FF"');
    });

    it("should handle large molecule with many highlights", () => {
      const result = parseSMILES("CC(C)Cc1ccc(cc1)C(C)C(=O)O");
      const molecule = result.molecules[0]!;

      const highlights: SubstructureHighlight[] = [
        { smarts: "c1ccccc1", color: "#FF0000" },
        { smarts: "C(=O)O", color: "#00FF00" },
        { smarts: "CC", color: "#0000FF" },
        { smarts: "C(C)C", color: "#FFFF00" },
      ];

      const svg = renderSVG(molecule, { highlights });

      expect(svg.errors.length).toBe(0);
    });

    it("should handle all atoms highlighted", () => {
      const result = parseSMILES("CCCC");
      const molecule = result.molecules[0]!;

      const atomHighlight: AtomHighlight = {
        atoms: [0, 1, 2, 3],
        color: "#FF00FF",
      };

      const svg = renderSVG(molecule, { atomHighlights: [atomHighlight] });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('fill="#FF00FF"');
    });

    it("should handle all bonds highlighted", () => {
      const result = parseSMILES("CCCC");
      const molecule = result.molecules[0]!;

      const bondHighlight: BondHighlight = {
        bonds: [
          [0, 1],
          [1, 2],
          [2, 3],
        ],
        color: "#00FFFF",
      };

      const svg = renderSVG(molecule, { bondHighlights: [bondHighlight] });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('stroke="#00FFFF"');
    });
  });

  describe("Color and Opacity Validation", () => {
    it("should handle hex colors with varying lengths", () => {
      const result = parseSMILES("c1ccccc1");
      const molecule = result.molecules[0]!;

      const svg1 = renderSVG(molecule, {
        highlights: [{ smarts: "c1ccccc1", color: "#F00" }],
      });

      const svg2 = renderSVG(molecule, {
        highlights: [{ smarts: "c1ccccc1", color: "#FF0000" }],
      });

      expect(svg1.errors.length).toBe(0);
      expect(svg2.errors.length).toBe(0);
    });

    it("should handle opacity edge cases", () => {
      const result = parseSMILES("CC");
      const molecule = result.molecules[0]!;

      const svg1 = renderSVG(molecule, {
        atomHighlights: [{ atoms: [0], opacity: 0 }],
      });

      const svg2 = renderSVG(molecule, {
        atomHighlights: [{ atoms: [0], opacity: 1 }],
      });

      const svg3 = renderSVG(molecule, {
        atomHighlights: [{ atoms: [0], opacity: 0.5 }],
      });

      expect(svg1.errors.length).toBe(0);
      expect(svg2.errors.length).toBe(0);
      expect(svg3.errors.length).toBe(0);
    });

    it("should handle missing color defaults", () => {
      const result = parseSMILES("c1ccccc1");
      const molecule = result.molecules[0]!;

      const svg = renderSVG(molecule, {
        highlights: [{ smarts: "c1ccccc1" }],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain("fill=");
    });
  });

  describe("Complex Highlighting Scenarios", () => {
    it("should highlight multiple different functional groups", () => {
      const aspirin = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!;

      const svg = renderSVG(aspirin, {
        highlights: [
          { smarts: "c1ccccc1", color: "#FFFF00", label: "benzene" },
          { smarts: "C(=O)O", color: "#FF0000", label: "carboxyl" },
          { smarts: "C(=O)O", color: "#00FF00", label: "ester" },
        ],
      });

      expect(svg.errors.length).toBe(0);
    });

    it("should combine SMARTS and explicit highlights", () => {
      const result = parseSMILES("c1ccccc1CC");
      const molecule = result.molecules[0]!;

      const svg = renderSVG(molecule, {
        highlights: [{ smarts: "c1ccccc1", color: "#FFFF00" }],
        atomHighlights: [{ atoms: [6, 7], color: "#FF0000" }],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('fill="#FFFF00"');
      expect(svg.svg).toContain('fill="#FF0000"');
    });

    it("should handle heterocyclic aromatic rings", () => {
      const pyridine = parseSMILES("c1ccncc1").molecules[0]!;

      const svg = renderSVG(pyridine, {
        highlights: [{ smarts: "c1ccncc1", color: "#00FFFF" }],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('fill="#00FFFF"');
    });

    it("should highlight fused ring systems", () => {
      const naphthalene = parseSMILES("c1ccc2ccccc2c1").molecules[0]!;

      const svg = renderSVG(naphthalene, {
        highlights: [{ smarts: "c1ccc2ccccc2c1", color: "#FF00FF" }],
      });

      expect(svg.errors.length).toBe(0);
      expect(svg.svg).toContain('fill="#FF00FF"');
    });
  });
});
