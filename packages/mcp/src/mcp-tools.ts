/**
 * OpenChem MCP Tools
 * Reusable tool definitions for MCP server
 * Runtime-agnostic - works in Node.js, Bun, Deno, Cloudflare Workers
 */

import * as z from "zod/v4";
import {
  parseSMILES,
  generateSMILES,
  Descriptors,
  computeMorganFingerprint,
  tanimotoSimilarity,
  matchSMARTS,
  renderSVG,
  generateIUPACNameFromSMILES,
  getMurckoScaffold,
} from "openchem";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTools(mcpServer: McpServer) {
  // Tool 1: Analyze - All-in-one molecular analysis
  mcpServer.registerTool(
    "analyze",
    {
      description:
        "Comprehensive molecular analysis: parse SMILES, compute all properties (40+ descriptors), check drug-likeness, generate IUPAC name, and optionally render 2D structure",
      inputSchema: {
        smiles: z.string().describe("SMILES string of the molecule"),
        includeRendering: z
          .boolean()
          .optional()
          .describe("Include 2D SVG rendering (default: false)"),
        renderWidth: z.number().optional().describe("SVG width in pixels"),
        renderHeight: z.number().optional().describe("SVG height in pixels"),
      },
    },
    async ({ smiles, includeRendering, renderWidth, renderHeight }) => {
      const parseResult = parseSMILES(smiles);
      if (parseResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${parseResult.errors[0]}`);
      }

      const mol = parseResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const properties = Descriptors.all(mol);
      const drugLikeness = Descriptors.drugLikeness(mol);
      const iupacResult = generateIUPACNameFromSMILES(smiles);

      let rendering = null;
      if (includeRendering) {
        const svg = renderSVG(mol, {
          width: renderWidth ?? 300,
          height: renderHeight ?? 300,
        });
        rendering = {
          svg: svg.svg,
          width: svg.width,
          height: svg.height,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                smiles,
                canonicalSmiles: generateSMILES(mol),
                iupacName: iupacResult.name,
                properties,
                drugLikeness,
                rendering,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 2: Compare - Molecular similarity and property comparison
  mcpServer.registerTool(
    "compare",
    {
      description:
        "Compare two molecules: compute Tanimoto similarity using Morgan fingerprints and compare all molecular properties side-by-side",
      inputSchema: {
        smiles1: z.string().describe("SMILES of first molecule"),
        smiles2: z.string().describe("SMILES of second molecule"),
        fingerprintRadius: z
          .number()
          .optional()
          .describe("Morgan fingerprint radius (default: 2)"),
      },
    },
    async ({ smiles1, smiles2, fingerprintRadius }) => {
      const mol1Result = parseSMILES(smiles1);
      const mol2Result = parseSMILES(smiles2);

      if (mol1Result.errors.length > 0 || mol2Result.errors.length > 0) {
        throw new Error("Invalid SMILES");
      }

      const mol1 = mol1Result.molecules[0];
      const mol2 = mol2Result.molecules[0];

      if (!mol1 || !mol2) {
        throw new Error("Failed to parse molecules");
      }

      const radius = fingerprintRadius ?? 2;
      const fp1 = computeMorganFingerprint(mol1, radius);
      const fp2 = computeMorganFingerprint(mol2, radius);
      const similarity = tanimotoSimilarity(fp1, fp2);

      const props1 = Descriptors.all(mol1);
      const props2 = Descriptors.all(mol2);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                molecule1: {
                  smiles: smiles1,
                  canonical: generateSMILES(mol1),
                  properties: props1,
                },
                molecule2: {
                  smiles: smiles2,
                  canonical: generateSMILES(mol2),
                  properties: props2,
                },
                similarity: {
                  tanimoto: similarity,
                  fingerprintRadius: radius,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 3: Search - Substructure and pattern matching
  mcpServer.registerTool(
    "search",
    {
      description:
        "Search for substructures in a molecule using SMARTS patterns. Returns all matches with atom indices and match count",
      inputSchema: {
        smiles: z.string().describe("SMILES of molecule to search in"),
        pattern: z.string().describe("SMARTS pattern to search for"),
      },
    },
    async ({ smiles, pattern }) => {
      const molResult = parseSMILES(smiles);
      if (molResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
      }

      const mol = molResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const matchResult = matchSMARTS(pattern, mol);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                smiles,
                pattern,
                matchCount: matchResult.matches.length,
                matches: matchResult.matches,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 4: Render - 2D structure visualization
  mcpServer.registerTool(
    "render",
    {
      description:
        "Generate publication-quality 2D SVG rendering of molecular structure with customizable dimensions",
      inputSchema: {
        smiles: z.string().describe("SMILES of molecule to render"),
        width: z
          .number()
          .optional()
          .describe("SVG width in pixels (default: 300)"),
        height: z
          .number()
          .optional()
          .describe("SVG height in pixels (default: 300)"),
      },
    },
    async ({ smiles, width, height }) => {
      const molResult = parseSMILES(smiles);
      if (molResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
      }

      const mol = molResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const svg = renderSVG(mol, {
        width: width ?? 300,
        height: height ?? 300,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                smiles,
                svg: svg.svg,
                width: svg.width,
                height: svg.height,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 5: Convert - Format conversion and canonicalization
  mcpServer.registerTool(
    "convert",
    {
      description:
        "Convert between molecular formats: SMILES ↔ canonical SMILES, SMILES → IUPAC name, extract Murcko scaffold",
      inputSchema: {
        smiles: z.string().describe("Input SMILES string"),
        outputFormat: z
          .enum(["canonical", "iupac", "scaffold"])
          .describe("Desired output format"),
      },
    },
    async ({ smiles, outputFormat }) => {
      const molResult = parseSMILES(smiles);
      if (molResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
      }

      const mol = molResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      let output;
      switch (outputFormat) {
        case "canonical":
          output = { canonical: generateSMILES(mol) };
          break;
        case "iupac": {
          const iupacResult = generateIUPACNameFromSMILES(smiles);
          output = {
            iupacName: iupacResult.name,
            confidence: iupacResult.confidence,
          };
          break;
        }
        case "scaffold": {
          const scaffold = getMurckoScaffold(mol);
          output = {
            scaffoldSmiles: scaffold ? generateSMILES(scaffold) : null,
          };
          break;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                input: smiles,
                outputFormat,
                ...output,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
