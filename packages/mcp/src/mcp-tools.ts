/**
 * OpenChem MCP Tools - v1.0 Redesign
 * 8 specific, single-purpose tools following Unix philosophy
 * Each tool does one thing well, with clear boundaries and minimal parameters
 */

import * as z from "zod/v4";
import {
  parseSMILES,
  parseIUPACName,
  parseMolfile,
  parseSDF,
  generateSMILES,
  generateMolfile,
  writeSDF,
  Descriptors,
  computeMorganFingerprint,
  tanimotoSimilarity,
  matchSMARTS,
  renderSVG,
  generateIUPACNameFromSMILES,
  getMurckoScaffold,
  getBemisMurckoFramework,
  getScaffoldTree,
  enumerateTautomers,
  canonicalTautomer,
  generateInChI,
  generateInChIKey,
  bulkMatchSMARTS,
  bulkFindSimilar,
  bulkFilterDrugLike,
} from "openchem";
import type { Molecule } from "openchem";
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
  // ============================================================================
  // Tool 1: parse - Parse molecular structures from any format
  // ============================================================================
  mcpServer.registerTool(
    "parse",
    {
      description:
        "Parse molecular structures from any format (SMILES, IUPAC name, MOL file, SDF file) to internal representation. Returns canonical SMILES and optionally converts to other formats.",
      inputSchema: {
        input: z.string().describe("Input string: SMILES, IUPAC name, MOL file content, or SDF content"),
        format: z
          .enum(["smiles", "iupac", "mol", "sdf", "auto"])
          .optional()
          .default("auto")
          .describe(
            "Input format (auto-detects if omitted): 'smiles', 'iupac' (e.g., '2-methylpropan-1-ol'), 'mol' (V2000/V3000), 'sdf', or 'auto'",
          ),
        outputFormat: z
          .enum(["smiles", "canonical", "mol", "sdf"])
          .optional()
          .describe("Convert to this format after parsing: 'smiles', 'canonical', 'mol', or 'sdf'"),
      },
    },
    async ({ input, format, outputFormat }) => {
      let molecule: Molecule | null = null;
      let parsedFormat = format ?? "auto";

      // Auto-detect format if needed
      if (parsedFormat === "auto") {
        if (input.includes("\n") && input.includes("M  END")) {
          parsedFormat = "mol";
        } else if (input.includes("\n") && input.includes("$$$$")) {
          parsedFormat = "sdf";
        } else if (/^[A-Za-z0-9\-\(\)]+$/.test(input)) {
          parsedFormat = "iupac";
        } else {
          parsedFormat = "smiles";
        }
      }

      // Parse based on format
      try {
        switch (parsedFormat) {
          case "smiles": {
            const result = parseSMILES(input);
            if (result.errors.length > 0) {
              throw new Error(`SMILES parsing failed: ${result.errors[0]}`);
            }
            molecule = result.molecules[0] ?? null;
            break;
          }
          case "iupac": {
            const result = parseIUPACName(input);
            if (result.errors.length > 0 || !result.molecule) {
              throw new Error(`IUPAC parsing failed: ${result.errors[0] || "Unknown error"}`);
            }
            molecule = result.molecule;
            break;
          }
          case "mol": {
            const result = parseMolfile(input);
            if (!result.molecule) {
              throw new Error("MOL file parsing failed");
            }
            molecule = result.molecule;
            break;
          }
          case "sdf": {
            const result = parseSDF(input);
            if (result.errors.length > 0 || result.records.length === 0) {
              throw new Error(`SDF parsing failed: ${result.errors[0] || "No molecules found"}`);
            }
            molecule = result.records[0]?.molecule ?? null;
            break;
          }
        }

        if (!molecule) {
          throw new Error("Failed to parse molecule");
        }

        // Generate output in requested format
        let output: string;
        let outputFormatUsed = outputFormat ?? "canonical";

        switch (outputFormatUsed) {
          case "smiles":
          case "canonical":
            output = generateSMILES(molecule);
            break;
          case "mol":
            output = generateMolfile(molecule);
            break;
          case "sdf": {
            const sdfResult = writeSDF({ molecule, properties: {} });
            if (sdfResult.errors.length > 0) {
              throw new Error(`SDF generation failed: ${sdfResult.errors[0]}`);
            }
            output = sdfResult.sdf;
            break;
          }
          default:
            output = generateSMILES(molecule);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  inputFormat: parsedFormat,
                  outputFormat: outputFormatUsed,
                  canonicalSmiles: generateSMILES(molecule),
                  output,
                  atomCount: molecule.atoms.length,
                  bondCount: molecule.bonds.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: error instanceof Error ? error.message : "Unknown error",
                  inputFormat: parsedFormat,
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );

  // ============================================================================
  // Tool 2: analyze - Compute comprehensive molecular properties
  // ============================================================================
  mcpServer.registerTool(
    "analyze",
    {
      description:
        "Compute comprehensive molecular properties and descriptors: basic properties (formula, mass), structural descriptors (TPSA, rotatable bonds), drug-likeness (Lipinski, Veber, BBB), topological indices, and chi indices. Returns 40+ molecular descriptors.",
      inputSchema: {
        smiles: z.string().describe("SMILES string of the molecule to analyze"),
        include: z
          .array(
            z.enum([
              "basic",
              "structural",
              "drugLikeness",
              "topology",
              "chi",
              "surface",
              "all",
            ]),
          )
          .optional()
          .default(["all"])
          .describe(
            "Property categories to include: 'basic' (formula, mass, atoms), 'structural' (TPSA, rotatable bonds), 'drugLikeness' (Lipinski, Veber), 'topology' (Zagreb, Balaban), 'chi' (connectivity indices), 'surface' (molecular surface), 'all' (everything)",
          ),
      },
    },
    async ({ smiles, include }) => {
      const parseResult = parseSMILES(smiles);
      if (parseResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${parseResult.errors[0]}`);
      }

      const mol = parseResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const categories = include ?? ["all"];
      const includeAll = categories.includes("all");

      const result: Record<string, unknown> = {
        smiles,
        canonicalSmiles: generateSMILES(mol),
      };

      if (includeAll || categories.includes("basic")) {
        result.basic = Descriptors.basic(mol);
      }

      if (includeAll || categories.includes("structural")) {
        result.structural = Descriptors.structural(mol);
      }

      if (includeAll || categories.includes("drugLikeness")) {
        result.drugLikeness = Descriptors.drugLikeness(mol);
      }

      if (includeAll || categories.includes("topology")) {
        result.topology = Descriptors.topology(mol);
      }

      if (includeAll || categories.includes("chi")) {
        result.chi = Descriptors.chi(mol);
      }

      // Note: surface descriptors not currently exported in Descriptors API

      // If "all" was requested, add complete summary
      if (includeAll) {
        result.summary = {
          formula: Descriptors.formula(mol),
          molecularWeight: Descriptors.basic(mol).exactMass,
          atomCount: mol.atoms.length,
          bondCount: mol.bonds.length,
          drugLike: Descriptors.drugLikeness(mol).lipinski.passes,
        };
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

  // ============================================================================
  // Tool 3: compare - Compare two molecules
  // ============================================================================
  mcpServer.registerTool(
    "compare",
    {
      description:
        "Compare two molecules using Morgan fingerprints and Tanimoto similarity. Also compares key molecular properties side-by-side (molecular weight, LogP, TPSA, drug-likeness).",
      inputSchema: {
        smiles1: z.string().describe("SMILES of first molecule"),
        smiles2: z.string().describe("SMILES of second molecule"),
        fingerprintRadius: z
          .number()
          .optional()
          .default(2)
          .describe("Morgan fingerprint radius (default: 2, equivalent to ECFP4)"),
        fpSize: z
          .number()
          .optional()
          .default(2048)
          .describe("Fingerprint bit length (default: 2048)"),
      },
    },
    async ({ smiles1, smiles2, fingerprintRadius, fpSize }) => {
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
      const size = fpSize ?? 2048;
      const fp1 = computeMorganFingerprint(mol1, radius, size);
      const fp2 = computeMorganFingerprint(mol2, radius, size);
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
                  formula: props1.formula,
                  molecularWeight: props1.exactMass,
                  logP: props1.logP,
                  tpsa: props1.tpsa,
                  drugLike: props1.lipinskiPass,
                },
                molecule2: {
                  smiles: smiles2,
                  canonical: generateSMILES(mol2),
                  formula: props2.formula,
                  molecularWeight: props2.exactMass,
                  logP: props2.logP,
                  tpsa: props2.tpsa,
                  drugLike: props2.lipinskiPass,
                },
                similarity: {
                  tanimoto: similarity,
                  fingerprintRadius: radius,
                  fpSize: size,
                  interpretation:
                    similarity > 0.85
                      ? "Very similar"
                      : similarity > 0.7
                        ? "Similar"
                        : similarity > 0.5
                          ? "Moderately similar"
                          : "Dissimilar",
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

  // ============================================================================
  // Tool 4: search - Substructure search with SMARTS
  // ============================================================================
  mcpServer.registerTool(
    "search",
    {
      description:
        "Search for substructures in a molecule using SMARTS patterns. Returns all matches with atom indices and match count. Useful for finding functional groups, pharmacophores, and structural motifs.",
      inputSchema: {
        smiles: z.string().describe("SMILES of molecule to search in"),
        pattern: z
          .string()
          .describe(
            "SMARTS pattern to search for (e.g., 'c1ccccc1' for benzene, 'C(=O)O' for carboxylic acid, '[OH]' for hydroxyl)",
          ),
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
                canonicalSmiles: generateSMILES(mol),
                pattern,
                matchCount: matchResult.matches.length,
                matches: matchResult.matches,
                found: matchResult.matches.length > 0,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ============================================================================
  // Tool 5: identifiers - Generate molecular identifiers
  // ============================================================================
  mcpServer.registerTool(
    "identifiers",
    {
      description:
        "Generate standard molecular identifiers for database lookups: InChI (International Chemical Identifier), InChIKey (hash for exact matching in PubChem/ChEMBL/DrugBank), IUPAC name, canonical SMILES, and molecular formula. Essential for cross-referencing with chemical databases.",
      inputSchema: {
        smiles: z.string().describe("SMILES string to convert to identifiers"),
        include: z
          .array(z.enum(["inchi", "inchikey", "iupac", "canonical", "formula", "all"]))
          .optional()
          .default(["all"])
          .describe(
            "Identifiers to generate: 'inchi', 'inchikey', 'iupac', 'canonical', 'formula', or 'all'",
          ),
      },
    },
    async ({ smiles, include }) => {
      const molResult = parseSMILES(smiles);
      if (molResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
      }

      const mol = molResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const categories = include ?? ["all"];
      const includeAll = categories.includes("all");

      const result: Record<string, unknown> = {
        inputSmiles: smiles,
      };

      if (includeAll || categories.includes("canonical")) {
        result.canonicalSmiles = generateSMILES(mol);
      }

      if (includeAll || categories.includes("formula")) {
        result.formula = Descriptors.formula(mol);
      }

      if (includeAll || categories.includes("iupac")) {
        const iupacResult = generateIUPACNameFromSMILES(smiles);
        result.iupacName = iupacResult.name;
        result.iupacConfidence = iupacResult.confidence;
      }

      if (includeAll || categories.includes("inchi") || categories.includes("inchikey")) {
        try {
          const inchi = await generateInChI(mol);
          if (includeAll || categories.includes("inchi")) {
            result.inchi = inchi;
          }
          if (includeAll || categories.includes("inchikey")) {
            result.inchiKey = await generateInChIKey(inchi);
          }
        } catch (_error) {
          result.inchi = null;
          result.inchiKey = null;
          result.inchiError = "InChI generation not available (requires WASM module)";
        }
      }

      result.note =
        "Use InChIKey for exact database matching (PubChem, ChEMBL). InChI provides detailed structure layers.";

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

  // ============================================================================
  // Tool 6: tautomers - Enumerate and score tautomers
  // ============================================================================
  mcpServer.registerTool(
    "tautomers",
    {
      description:
        "Enumerate and score molecular tautomers (keto-enol, imine-enamine, amide-imidol, lactam-lactim, etc.). Returns canonical tautomer with highest stability score. Essential for drug discovery and docking studies where tautomeric form affects binding affinity. Supports 25 tautomerization rules with RDKit-compatible scoring.",
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
                note: "Canonical tautomer is the most stable form. Scores based on aromaticity, conjugation, and heteroatom preferences (higher = more stable).",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ============================================================================
  // Tool 7: scaffold - Extract molecular scaffolds
  // ============================================================================
  mcpServer.registerTool(
    "scaffold",
    {
      description:
        "Extract Murcko scaffold (core structure after removing side chains) and related frameworks: Bemis-Murcko generic framework (all atoms → carbon), scaffold tree (hierarchical decomposition). Essential for scaffold hopping, lead optimization, and analyzing structure-activity relationships in drug discovery.",
      inputSchema: {
        smiles: z.string().describe("SMILES string to extract scaffold from"),
        includeGeneric: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Include Bemis-Murcko generic framework (all atoms replaced by carbon, bonds normalized)",
          ),
        includeTree: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include scaffold tree (hierarchical decomposition of scaffold)"),
      },
    },
    async ({ smiles, includeGeneric, includeTree }) => {
      const molResult = parseSMILES(smiles);
      if (molResult.errors.length > 0) {
        throw new Error(`Invalid SMILES: ${molResult.errors[0]}`);
      }

      const mol = molResult.molecules[0];
      if (!mol) {
        throw new Error("No molecule parsed");
      }

      const scaffold = getMurckoScaffold(mol);
      const result: Record<string, unknown> = {
        inputSmiles: smiles,
        canonicalSmiles: generateSMILES(mol),
        scaffold: scaffold ? generateSMILES(scaffold) : null,
      };

      if (includeGeneric && scaffold) {
        const genericFramework = getBemisMurckoFramework(mol);
        result.genericFramework = genericFramework ? generateSMILES(genericFramework) : null;
      }

      if (includeTree && scaffold) {
        const scaffoldTree = getScaffoldTree(mol);
        result.scaffoldTree = scaffoldTree.map((s) => generateSMILES(s));
        result.scaffoldLevels = scaffoldTree.length;
      }

      result.note =
        "Murcko scaffold = core after removing side chains. Generic framework = all atoms → carbon. Scaffold tree = hierarchical decomposition.";

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

  // ============================================================================
  // Tool 8: render - 2D structure visualization
  // ============================================================================
  mcpServer.registerTool(
    "render",
    {
      description:
        "Generate publication-quality 2D molecular structure visualization in SVG or PNG format. Features automatic orientation optimization (linear molecules → horizontal, rings → flat-top), substructure highlighting via SMARTS patterns, stereochemistry display (wedge/hash bonds), and customizable appearance. Use format='png' to display images inline in chat.",
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
          .default(400)
          .describe("Image width in pixels (default: 400). Recommended: 400-600 for better visibility"),
        height: z
          .number()
          .optional()
          .default(400)
          .describe("Image height in pixels (default: 400). Recommended: 400-600 for better visibility"),
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
                .describe(
                  "SMARTS pattern to highlight (e.g., 'c1ccccc1' for benzene ring, 'C(=O)O' for carboxylic acid)",
                ),
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
        width: width ?? 400,
        height: height ?? 400,
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

  // ============================================================================
  // Tool 9: bulk - Batch operations for virtual screening
  // ============================================================================
  mcpServer.registerTool(
    "bulk",
    {
      description:
        "Perform batch operations on molecular libraries for virtual screening and compound analysis: bulk SMARTS matching (find compounds with specific substructures), bulk similarity search (find similar molecules using fingerprints), bulk drug-likeness filtering (Lipinski, Veber rules). Essential for high-throughput screening, compound library curation, and lead discovery.",
      inputSchema: {
        operation: z
          .enum(["match", "similar", "filter"])
          .describe(
            "Batch operation: 'match' (SMARTS substructure matching), 'similar' (fingerprint similarity), 'filter' (drug-likeness filtering)",
          ),
        library: z
          .array(z.string())
          .describe("Array of SMILES strings representing the compound library to process"),
        query: z
          .string()
          .optional()
          .describe("Query SMILES (for 'similar') or SMARTS pattern (for 'match')"),
        threshold: z
          .number()
          .optional()
          .default(0.7)
          .describe("Similarity threshold for 'similar' operation (0-1, default: 0.7)"),
        fingerprintRadius: z
          .number()
          .optional()
          .default(2)
          .describe("Morgan fingerprint radius for similarity (default: 2)"),
      },
    },
    async ({ operation, library, query, threshold, fingerprintRadius }) => {
      try {
        // Parse all SMILES in library to molecules
        const molecules: Molecule[] = [];
        const parseErrors: string[] = [];
        
        for (let i = 0; i < library.length; i++) {
          const parseResult = parseSMILES(library[i]!);
          if (parseResult.errors.length > 0 || !parseResult.molecules[0]) {
            parseErrors.push(`Index ${i}: ${parseResult.errors[0] || "Failed to parse"}`);
          } else {
            molecules.push(parseResult.molecules[0]);
          }
        }

        if (parseErrors.length > 0 && molecules.length === 0) {
          throw new Error(`All molecules failed to parse. Errors: ${parseErrors.slice(0, 3).join("; ")}`);
        }

        switch (operation) {
          case "match": {
            if (!query) {
              throw new Error("Query SMARTS pattern required for 'match' operation");
            }
            const matchResults = bulkMatchSMARTS(query, molecules);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      operation: "match",
                      query,
                      librarySize: library.length,
                      parsedCount: molecules.length,
                      parseErrors: parseErrors.length,
                      matchCount: matchResults.moleculeMatches.filter((m) => m.matches.length > 0).length,
                      results: matchResults.moleculeMatches.map((m) => ({
                        smiles: library[m.moleculeIndex],
                        matchCount: m.matches.length,
                        matches: m.matches,
                      })),
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          case "similar": {
            if (!query) {
              throw new Error("Query SMILES required for 'similar' operation");
            }
            const queryResult = parseSMILES(query);
            if (queryResult.errors.length > 0 || !queryResult.molecules[0]) {
              throw new Error(`Invalid query SMILES: ${queryResult.errors[0]}`);
            }
            const queryMol = queryResult.molecules[0];
            const similarityResults = bulkFindSimilar(
              queryMol,
              molecules,
              threshold ?? 0.7,
              fingerprintRadius ?? 2,
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      operation: "similar",
                      query,
                      threshold: threshold ?? 0.7,
                      librarySize: library.length,
                      parsedCount: molecules.length,
                      parseErrors: parseErrors.length,
                      similarCount: similarityResults.length,
                      results: similarityResults.map((r: { targetIndex: number; similarity: number }) => ({
                        smiles: library[r.targetIndex],
                        similarity: r.similarity,
                        index: r.targetIndex,
                      })),
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          case "filter": {
            const filterResults = bulkFilterDrugLike(molecules);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      operation: "filter",
                      librarySize: library.length,
                      parsedCount: molecules.length,
                      parseErrors: parseErrors.length,
                      lipinskiPassers: filterResults.lipinskiPassers.length,
                      veberPassers: filterResults.veberPassers.length,
                      bbbPassers: filterResults.bbbPassers.length,
                      allPassers: filterResults.allPassers.length,
                      results: {
                        lipinski: filterResults.lipinskiPassers.map((r) => ({
                          smiles: library[r.index],
                          index: r.index,
                        })),
                        veber: filterResults.veberPassers.map((r) => ({
                          smiles: library[r.index],
                          index: r.index,
                        })),
                        bbb: filterResults.bbbPassers.map((r) => ({
                          smiles: library[r.index],
                          index: r.index,
                        })),
                        all: filterResults.allPassers.map((r) => ({
                          smiles: library[r.index],
                          index: r.index,
                        })),
                      },
                      statistics: {
                        lipinskiPercentage:
                          ((filterResults.lipinskiPassers.length / molecules.length) * 100).toFixed(1) + "%",
                        veberPercentage:
                          ((filterResults.veberPassers.length / molecules.length) * 100).toFixed(1) + "%",
                        bbbPercentage:
                          ((filterResults.bbbPassers.length / molecules.length) * 100).toFixed(1) + "%",
                        allPassingPercentage:
                          ((filterResults.allPassers.length / molecules.length) * 100).toFixed(1) + "%",
                      },
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  operation,
                  error: error instanceof Error ? error.message : "Unknown error",
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );
}
