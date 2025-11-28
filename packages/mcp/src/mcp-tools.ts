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
  enumerateTautomers,
  canonicalTautomer,
  generateInChI,
  generateInChIKey,
  generateMolfile,
  parseMolfile,
  parseSDF,
  writeSDF,
} from "openchem";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Resvg } from "@resvg/resvg-js";

/**
 * Convert SVG string to PNG buffer using resvg-js
 */
function convertSvgToPng(svgString: string): Buffer {
  const resvg = new Resvg(svgString);
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  return Buffer.from(pngBuffer);
}

export function registerTools(mcpServer: McpServer) {
  // Tool 1: Analyze - All-in-one molecular analysis
  mcpServer.registerTool(
    "analyze",
    {
      description:
        "Comprehensive molecular analysis: parse SMILES, compute 40+ descriptors, check drug-likeness (Lipinski/Veber rules), generate IUPAC name, and optionally render 2D structure as SVG. Note: For displaying molecular images in chat, use the 'render' tool with format='png' instead.",
      inputSchema: {
        smiles: z.string().describe("SMILES string of the molecule to analyze"),
        includeRendering: z
          .boolean()
          .optional()
          .describe(
            "Include 2D SVG rendering as text (default: false). For image display in chat, use 'render' tool with format='png'.",
          ),
        renderWidth: z.number().optional().describe("SVG width in pixels (default: 300)"),
        renderHeight: z.number().optional().describe("SVG height in pixels (default: 300)"),
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
              2,
            ),
          },
        ],
      };
    },
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
        fingerprintRadius: z.number().optional().describe("Morgan fingerprint radius (default: 2)"),
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
              2,
            ),
          },
        ],
      };
    },
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
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 4: Render - 2D structure visualization
  mcpServer.registerTool(
    "render",
    {
      description:
        "Generate 2D molecular structure visualization. Use format='png' to display images inline in chat (recommended for visual display). Use format='svg' for lightweight vector graphics. Optionally save to disk with outputPath parameter. Supports highlighting of substructures using SMARTS patterns or explicit atom indices.",
      inputSchema: {
        smiles: z.string().describe("SMILES string of the molecule to render"),
        format: z
          .enum(["svg", "png"])
          .optional()
          .default("png")
          .describe(
            "Output format: 'png' (displays image inline in chat - RECOMMENDED), 'svg' (lightweight vector XML). Default: png",
          ),
        width: z
          .number()
          .optional()
          .describe(
            "Image width in pixels (default: 300). Recommended: 400-600 for better visibility",
          ),
        height: z
          .number()
          .optional()
          .describe(
            "Image height in pixels (default: 300). Recommended: 400-600 for better visibility",
          ),
        outputPath: z
          .string()
          .optional()
          .describe(
            "Optional: file path to save the image (e.g., '/tmp/molecule.png'). If omitted, image displays inline in chat.",
          ),
        highlights: z
          .array(
            z.object({
              smarts: z
                .string()
                .optional()
                .describe("SMARTS pattern to highlight (e.g., 'c1ccccc1' for benzene ring)"),
              atoms: z.array(z.number()).optional().describe("Explicit atom indices to highlight"),
              bonds: z
                .array(z.tuple([z.number(), z.number()]))
                .optional()
                .describe("Explicit bonds to highlight as [atom1, atom2] pairs"),
              color: z
                .string()
                .optional()
                .describe(
                  "Highlight color (hex or CSS name, e.g., '#FFFF00', 'yellow'). Default: yellow for atoms, red for bonds",
                ),
              atomColor: z.string().optional().describe("Override color for atom highlights"),
              bondColor: z.string().optional().describe("Override color for bond highlights"),
              opacity: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .describe("Highlight opacity (0-1). Default: 0.3 for atoms, 0.8 for bonds"),
              label: z
                .string()
                .optional()
                .describe("Optional label for legend (not yet implemented)"),
            }),
          )
          .optional()
          .describe(
            "Array of substructure highlights. Use SMARTS patterns for automatic matching or explicit atom/bond indices.",
          ),
      },
    },
    async ({ smiles, format, width, height, outputPath, highlights }) => {
      const molResult = parseSMILES(smiles);
      if (molResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
      }

      const mol = molResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const outputFormat = format ?? "png";
      const svg = renderSVG(mol, {
        width: width ?? 300,
        height: height ?? 300,
        highlights,
      });

      if (outputFormat === "svg") {
        // Save to file if path provided
        if (outputPath) {
          const fs = await import("node:fs/promises");
          await fs.writeFile(outputPath, svg.svg, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    smiles,
                    format: "svg",
                    width: svg.width,
                    height: svg.height,
                    saved: true,
                    path: outputPath,
                    message: `SVG saved to ${outputPath}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  smiles,
                  format: "svg",
                  svg: svg.svg,
                  width: svg.width,
                  height: svg.height,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Convert to PNG
      const imageBuffer = convertSvgToPng(svg.svg);

      // Save to file if path provided
      if (outputPath) {
        const fs = await import("node:fs/promises");
        await fs.writeFile(outputPath, imageBuffer);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  smiles,
                  format: "png",
                  width: svg.width,
                  height: svg.height,
                  mimeType: "image/png",
                  saved: true,
                  path: outputPath,
                  size: imageBuffer.length,
                  message: `PNG saved to ${outputPath} (${imageBuffer.length} bytes)`,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Return as embedded image (MCP protocol supports image content type)
      const base64Image = imageBuffer.toString("base64");
      return {
        content: [
          {
            type: "image",
            data: base64Image,
            mimeType: "image/png",
          },
          {
            type: "text",
            text: JSON.stringify(
              {
                smiles,
                format: "png",
                width: svg.width,
                height: svg.height,
                size: imageBuffer.length,
                note: "Image embedded above as PNG. To save to file, provide outputPath parameter.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 5: Convert - Format conversion and canonicalization
  mcpServer.registerTool(
    "convert",
    {
      description:
        "Convert between molecular formats: SMILES ↔ canonical SMILES, SMILES → IUPAC name, extract Murcko scaffold",
      inputSchema: {
        smiles: z.string().describe("Input SMILES string"),
        outputFormat: z.enum(["canonical", "iupac", "scaffold"]).describe("Desired output format"),
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
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 6: Identifiers - InChI and InChIKey generation
  mcpServer.registerTool(
    "identifiers",
    {
      description:
        "Generate standard molecular identifiers for database lookups and structure representation: InChI (International Chemical Identifier with structure layers), InChIKey (hash for exact matching in PubChem/ChEMBL/DrugBank), canonical SMILES, and molecular formula.",
      inputSchema: {
        smiles: z.string().describe("SMILES string to convert to identifiers"),
        includeInChI: z
          .boolean()
          .optional()
          .default(true)
          .describe("Generate InChI structure identifier (default: true)"),
        includeInChIKey: z
          .boolean()
          .optional()
          .default(true)
          .describe("Generate InChIKey hash for database lookups (default: true)"),
      },
    },
    async ({ smiles, includeInChI, includeInChIKey }) => {
      const molResult = parseSMILES(smiles);
      if (molResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
      }

      const mol = molResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const canonicalSmiles = generateSMILES(mol);
      const properties = Descriptors.basic(mol);

      let inchi: string | undefined;
      let inchiKey: string | undefined;

      try {
        if (includeInChI ?? true) {
          inchi = await generateInChI(mol);
        }

        if (includeInChIKey ?? true) {
          if (!inchi) {
            inchi = await generateInChI(mol);
          }
          inchiKey = await generateInChIKey(inchi);
        }
      } catch (_error) {
        // InChI generation failed - continue without it
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                inputSmiles: smiles,
                canonicalSmiles,
                inchi,
                inchiKey,
                formula: properties.formula,
                molecularWeight: properties.exactMass,
                note: "Use InChIKey for exact database matching (PubChem, ChEMBL). InChI provides detailed structure layers.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 7: Tautomers - Enumerate and score tautomers
  mcpServer.registerTool(
    "tautomers",
    {
      description:
        "Enumerate and score molecular tautomers (keto-enol, imine-enamine, amide-imidol, etc.). Returns canonical tautomer with highest stability score using tautomer scoring. Essential for drug discovery and docking studies where tautomeric form affects binding.",
      inputSchema: {
        smiles: z.string().describe("SMILES string to enumerate tautomers for"),
        maxTautomers: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of tautomers to return (default: 10)"),
        returnCanonical: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include canonical (highest-scored) tautomer (default: true)"),
      },
    },
    async ({ smiles, maxTautomers, returnCanonical }) => {
      const molResult = parseSMILES(smiles);
      if (molResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
      }

      const mol = molResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const tautomers = enumerateTautomers(mol, { maxTautomers: maxTautomers ?? 10 });
      const canonicalMol = returnCanonical ? canonicalTautomer(mol) : null;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                inputSmiles: smiles,
                canonicalTautomer: canonicalMol ? generateSMILES(canonicalMol) : null,
                tautomerCount: tautomers.length,
                tautomers: tautomers.map((t) => ({
                  smiles: t.smiles,
                  score: t.score,
                })),
                note: "Canonical tautomer is the most stable form. Scores based on tautomer scoring rules (higher = more stable).",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 8: FileConvert - MOL and SDF file format conversion
  mcpServer.registerTool(
    "fileConvert",
    {
      description:
        "Convert between molecular file formats: SMILES ↔ MOL (V2000/V3000), SMILES ↔ SDF (multi-molecule files with properties). Industry-standard formats for data exchange with ChemDraw, PyMOL, molecular dynamics software, and chemical databases.",
      inputSchema: {
        operation: z
          .enum(["smilesToMol", "molToSmiles", "smilesToSDF", "sdfToSmiles"])
          .describe("Conversion operation to perform"),
        input: z.string().describe("Input data: SMILES string or MOL/SDF file content"),
        properties: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe("Properties to include in SDF output (key-value pairs)"),
        moleculeName: z
          .string()
          .optional()
          .describe("Name for the molecule (used in MOL/SDF header)"),
      },
    },
    async ({ operation, input, properties, moleculeName }) => {
      let result: {
        format: string;
        content?: string;
        smiles?: string | string[];
        moleculeCount?: number;
      };

      switch (operation) {
        case "smilesToMol": {
          const molResult = parseSMILES(input);
          if (molResult.errors.length > 0) {
            throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
          }
          const mol = molResult.molecules[0];
          if (!mol) {
            throw new Error("No molecule parsed");
          }
          const molfile = generateMolfile(mol, { title: moleculeName || "" });
          result = {
            format: "molfile",
            content: molfile,
          };
          break;
        }

        case "molToSmiles": {
          const molResult = parseMolfile(input);
          if (!molResult.molecule) {
            throw new Error("Failed to parse MOL file");
          }
          const smiles = generateSMILES(molResult.molecule);
          result = {
            format: "smiles",
            smiles,
          };
          break;
        }

        case "smilesToSDF": {
          const molResult = parseSMILES(input);
          if (molResult.errors.length > 0) {
            throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
          }
          const mol = molResult.molecules[0];
          if (!mol) {
            throw new Error("No molecule parsed");
          }
          const record = {
            molecule: mol,
            properties: properties as Record<string, string | number | boolean> | undefined,
          };
          const sdfResult = writeSDF(record);
          if (sdfResult.errors.length > 0) {
            throw new Error(`SDF generation failed: ${sdfResult.errors.join(", ")}`);
          }
          result = {
            format: "sdf",
            content: sdfResult.sdf,
            moleculeCount: 1,
          };
          break;
        }

        case "sdfToSmiles": {
          const sdfResult = parseSDF(input);
          if (sdfResult.errors.length > 0) {
            throw new Error(`SDF parsing errors: ${sdfResult.errors.join(", ")}`);
          }
          const smilesList = sdfResult.records
            .filter((r) => r.molecule !== null)
            .map((r) => generateSMILES(r.molecule!));
          result = {
            format: "smiles",
            smiles: smilesList,
            moleculeCount: smilesList.length,
          };
          break;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
