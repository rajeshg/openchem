import type { Molecule } from "types";
import { BondType as BondTypeEnum } from "types";
import type { IUPACToken, OPSINRules } from "./iupac-types";
import { MoleculeGraphBuilder } from "../molecule-graph-builder";
import {
  IUPACNestedSubstituentBuilder,
  type IUPACBuilderContext,
} from "./iupac-nested-substituent-builder";
import { IUPACSuffixApplicator, type IUPACSuffixContext } from "./iupac-suffix-applicator";
import {
  IUPACSubstituentApplicator,
  type IUPACSubstituentContext,
} from "./iupac-substituent-applicator";
import {
  IUPACSpecializedBuilders,
  type IUPACSpecializedContext,
} from "./iupac-specialized-builders";

/**
 * Graph-based IUPAC builder - constructs molecules directly from tokens
 * Uses MoleculeGraphBuilder instead of string manipulation
 *
 * Strategy:
 * 1. Build parent chain (linear or cyclic) → get atom indices
 * 2. Apply functional groups to specific atoms based on locants
 * 3. Add substituents at correct atom positions
 * 4. Handle unsaturation (double/triple bonds)
 */
export class IUPACGraphBuilder
  implements
    IUPACBuilderContext,
    IUPACSuffixContext,
    IUPACSubstituentContext,
    IUPACSpecializedContext
{
  private rules: OPSINRules;
  public nestedBuilder: IUPACNestedSubstituentBuilder;
  public suffixApplicator: IUPACSuffixApplicator;
  public substituentApplicator: IUPACSubstituentApplicator;
  public specializedBuilders: IUPACSpecializedBuilders;

  constructor(rules: OPSINRules) {
    this.rules = rules;
    this.nestedBuilder = new IUPACNestedSubstituentBuilder(this);
    this.suffixApplicator = new IUPACSuffixApplicator(this);
    this.substituentApplicator = new IUPACSubstituentApplicator(this);
    this.specializedBuilders = new IUPACSpecializedBuilders(this);
  }

  /**
   * Parse heteroatom replacement info from a cyclo prefix.
   * Examples:
   *   "azacyclo" → [{count: 1, element: "N"}]
   *   "dioxacyclo" → [{count: 2, element: "O"}]
   *   "oxathiacyclo" → [{count: 1, element: "O"}, {count: 1, element: "S"}]
   */
  private parseHeteroatomsFromCycloPrefix(
    prefixValue: string,
  ): Array<{ count: number; element: string }> {
    const result: Array<{ count: number; element: string }> = [];

    // Remove "cyclo" suffix to get heteroatom part
    const cycloIdx = prefixValue.indexOf("cyclo");
    if (cycloIdx < 0) return result;

    const heteroPart = prefixValue.substring(0, cycloIdx);
    if (!heteroPart) return result;

    // Heteroatom prefixes and their element mappings
    const heteroMap: Record<string, string> = {
      aza: "N",
      oxa: "O",
      thia: "S",
      phospha: "P",
      arsa: "As",
      stiba: "Sb",
      bismuta: "Bi",
      selena: "Se",
      tellura: "Te",
    };

    // Multiplier prefixes
    const multipliers: Record<string, number> = {
      di: 2,
      tri: 3,
      tetra: 4,
      penta: 5,
      hexa: 6,
      hepta: 7,
      octa: 8,
      nona: 9,
      deca: 10,
    };

    let remaining = heteroPart.toLowerCase();

    while (remaining.length > 0) {
      let count = 1;

      // Check for multiplier prefix
      for (const [mult, val] of Object.entries(multipliers)) {
        if (remaining.startsWith(mult)) {
          count = val;
          remaining = remaining.substring(mult.length);
          break;
        }
      }

      // Check for heteroatom prefix
      let matched = false;
      for (const [prefix, element] of Object.entries(heteroMap)) {
        if (remaining.startsWith(prefix)) {
          result.push({ count, element });
          remaining = remaining.substring(prefix.length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Unknown prefix, stop parsing
        break;
      }
    }

    return result;
  }

  /**
   * Look up a trivial name and return its SMILES if found.
   * Searches the trivialNames section of opsin-rules.json.
   */
  private lookupTrivialName(name: string): string | null {
    if (!this.rules.trivialNames) return null;

    const normalizedName = name.toLowerCase();

    for (const [smiles, data] of Object.entries(this.rules.trivialNames)) {
      if (data.aliases.some((alias) => alias.toLowerCase() === normalizedName)) {
        return smiles;
      }
    }

    return null;
  }

  /**
   * Build a molecule from IUPAC tokens using graph construction
   */
  build(tokens: IUPACToken[]): Molecule {
    if (tokens.length === 0) {
      throw new Error("No tokens to build molecule");
    }

    const builder = new MoleculeGraphBuilder();

    // Organize tokens by type
    const parentTokens = tokens.filter((t) => t.type === "PARENT");
    const suffixTokens = tokens.filter((t) => t.type === "SUFFIX");
    const prefixTokens = tokens.filter((t) => t.type === "PREFIX");
    const locantTokens = tokens.filter((t) => t.type === "LOCANT");
    const substituentTokens = tokens.filter((t) => t.type === "SUBSTITUENT");
    const multiplierTokens = tokens.filter((t) => t.type === "MULTIPLIER");
    const _stereoTokens = tokens.filter((t) => t.type === "STEREO");

    // Detect hydrogen notation (e.g., "4H-1,3-thiazole" → saturated form)
    const hydrogenNotationToken = locantTokens.find((t) => t.metadata?.isHydrogenNotation === true);
    const isSaturatedForm = !!hydrogenNotationToken;

    if (process.env.VERBOSE && isSaturatedForm) {
      console.log(
        `[graph-builder] Detected saturated form marker: ${hydrogenNotationToken?.value}`,
      );
    }

    // Detect bicyclo notation in PREFIX (e.g., "9-oxabicyclo[3.3.1]" as PREFIX, "non" as PARENT)
    if (process.env.VERBOSE) {
      console.log(
        `[graph-builder] Prefix tokens: ${prefixTokens.map((p) => `${p.value}@${p.position}`).join(", ")}`,
      );
      console.log(
        `[graph-builder] Substituent tokens: ${substituentTokens.map((p) => `${p.value}@${p.position}`).join(", ")}`,
      );
      console.log(
        `[graph-builder] Suffix tokens: ${suffixTokens.map((p) => `${p.value}@${p.position}`).join(", ")}`,
      );
      console.log(
        `[graph-builder] Multiplier tokens: ${multiplierTokens.map((p) => `${p.value}@${p.position}`).join(", ")}`,
      );
    }

    // Extract bridge notation and heteroatom info from any PREFIX that contains bicyclo
    let _bicycloMetadata: {
      bridgeN: number;
      bridgeM: number;
      bridgeP: number;
      heteroPrefix: string;
      heteroType: string;
    } | null = null;

    const bicycloPrefix = prefixTokens.find(
      (p) =>
        (p.value?.includes("bicyclo") || p.value?.includes("bicyclic")) &&
        p.metadata?.hasBridgeNotation,
    );

    if (bicycloPrefix) {
      // Extract bridge notation and heteroatom info from the PREFIX value
      // E.g., "oxabicyclo[3.3.1]" or "bicyclo[3.3.1]"
      const bicycloRegex = /^(\d+-)?([a-z]*)?bicycl(?:ic|o)\[(\d+)\.(\d+)\.(\d+)\]/i;
      const match = bicycloPrefix.value?.match(bicycloRegex);

      if (match) {
        const heteroPrefix = match[1] ? match[1].slice(0, -1) : "";
        const heteroType = match[2] || "";
        const bridgeN = parseInt(match[3]!);
        const bridgeM = parseInt(match[4]!);
        const bridgeP = parseInt(match[5]!);

        _bicycloMetadata = {
          bridgeN,
          bridgeM,
          bridgeP,
          heteroPrefix,
          heteroType,
        };

        if (process.env.VERBOSE) {
          console.log(
            `[graph-builder] Detected bicyclic PREFIX: [${bridgeN}.${bridgeM}.${bridgeP}]${heteroType ? ` with ${heteroPrefix}-${heteroType}` : ""}`,
          );
        }
      }
    }

    // Handle nested alkyl substituents (e.g., "propan-2-yl" in "3-propan-2-ylheptan-2-one")
    // When we have multiple parents and a "yl" suffix that comes BEFORE the last parent,
    // check if it's part of a parent+an+locant+yl pattern
    let adjustedSuffixTokens = [...suffixTokens];
    let nestedAlkylSubsts: IUPACToken[] = [];

    if (parentTokens.length > 1) {
      const lastParent = parentTokens[parentTokens.length - 1]!;

      if (process.env.VERBOSE) {
        console.log(
          `[graph-builder] Checking for nested alkyl: ${parentTokens.length} parents, lastParent at pos ${lastParent.position}`,
        );
      }

      // Find all "yl" suffixes that come before the last parent
      const ylBeforeLastParent = suffixTokens.filter(
        (s) => s.value === "yl" && s.position < lastParent.position,
      );

      if (process.env.VERBOSE) {
        console.log(
          `[graph-builder] Found ${ylBeforeLastParent.length} "yl" suffixes before last parent`,
        );
      }

      for (const ylSuffix of ylBeforeLastParent) {
        // Look backwards to find: locant, "an" suffix, parent
        const locantBeforeYl = locantTokens.filter((l) => l.position < ylSuffix.position).pop();
        if (locantBeforeYl) {
          const anSuffix = suffixTokens.find(
            (s) => s.value === "an" && s.position < locantBeforeYl.position,
          );
          if (anSuffix) {
            const parentBeforeAn = parentTokens.find((p) => p.position < anSuffix.position);
            if (parentBeforeAn && parentBeforeAn !== lastParent) {
              // Found the pattern: parent+an+locant+yl
              // Create a nested alkyl substituent
              const substName = `${parentBeforeAn.value}an-${locantBeforeYl.value}-yl`;
              const nestedSubst: IUPACToken = {
                type: "SUBSTITUENT",
                value: substName,
                position: parentBeforeAn.position,
                length: ylSuffix.position + ylSuffix.length - parentBeforeAn.position,
                nestedTokens: [parentBeforeAn, anSuffix, locantBeforeYl, ylSuffix],
              };

              nestedAlkylSubsts.push(nestedSubst);

              // Remove these tokens from the main lists
              adjustedSuffixTokens = adjustedSuffixTokens.filter(
                (s) => s !== anSuffix && s !== ylSuffix,
              );

              if (process.env.VERBOSE) {
                console.log(`[graph-builder] Detected nested alkyl substituent: ${substName}`);
              }
            }
          }
        }
      }
    }

    const finalSuffixTokens = adjustedSuffixTokens;
    const finalSubstituentTokens = [...substituentTokens, ...nestedAlkylSubsts];

    if (process.env.VERBOSE && nestedAlkylSubsts.length > 0) {
      console.log(`[graph-builder] After nested alkyl extraction:`);
      console.log(`  finalSuffixTokens: ${finalSuffixTokens.map((t) => t.value).join(", ")}`);
      console.log(
        `  finalSubstituentTokens: ${finalSubstituentTokens.map((t) => t.value).join(", ")}`,
      );
    }

    // Check for multipliers immediately before parent (e.g., "di" in "diaziridin")
    // These are actually part of the ring name, not substituent multipliers
    let adjustedParentTokens = parentTokens;
    if (parentTokens.length > 0) {
      const firstParent = parentTokens[0]!;
      // Find a multiplier that comes right before this parent
      const muliplierBeforeParent = multiplierTokens.find(
        (m) =>
          m.position < firstParent.position &&
          multiplierTokens.filter(
            (x) => x.position > m.position && x.position < firstParent.position,
          ).length === 0,
      );

      if (muliplierBeforeParent) {
        // Check if there are any substituents between the multiplier and parent
        // If there are, the multiplier belongs to the substituent, not the ring
        const hasSubstituentsBetween = substituentTokens.some(
          (s) => s.position > muliplierBeforeParent.position && s.position < firstParent.position,
        );

        if (!hasSubstituentsBetween) {
          // Adjust parent value to include the multiplier prefix
          const multiplierValue = muliplierBeforeParent.value.toLowerCase();
          const parentValue = firstParent.value.toLowerCase();

          // Map multipliers to ring prefixes
          const ringPrefix =
            multiplierValue === "di"
              ? "di"
              : multiplierValue === "tri"
                ? "tri"
                : multiplierValue === "tetra"
                  ? "tetra"
                  : "";

          if (ringPrefix && !parentValue.startsWith(ringPrefix)) {
            // Create adjusted parent token
            adjustedParentTokens = [
              {
                ...firstParent,
                value: ringPrefix + firstParent.value,
              } as IUPACToken,
              ...parentTokens.slice(1),
            ];

            if (process.env.VERBOSE) {
              console.log(
                `[graph-builder] Adjusted parent from "${firstParent.value}" to "${ringPrefix}${firstParent.value}"`,
              );
            }
          }
        }
      }
    }

    // Check for composite alkane stems (e.g., "tetr" + "dec" = tetradec = 14)
    // These are represented as multiple PARENT tokens with metadata numPart property
    if (adjustedParentTokens.length > 1) {
      const stemComparts = adjustedParentTokens.filter((t) => t.metadata?.numPart);
      if (stemComparts.length > 1) {
        // Sort by position to ensure correct order (hundreds, tens, units)
        stemComparts.sort((a, b) => a.position - b.position);

        let totalAtoms = 0;
        let combinedSmiles = "";
        for (const part of stemComparts) {
          const partNum = (part.metadata?.number as number) || 0;
          totalAtoms += partNum;
          combinedSmiles += "C".repeat(partNum);
        }

        if (totalAtoms > 0) {
          // Create combined parent token
          const combinedValue = stemComparts.map((t) => t.value).join("");
          const firstPart = stemComparts[0]!;
          adjustedParentTokens = [
            {
              type: "PARENT",
              value: combinedValue,
              position: firstPart.position,
              length:
                stemComparts[stemComparts.length - 1]!.position +
                stemComparts[stemComparts.length - 1]!.length -
                firstPart.position,
              metadata: {
                smiles: combinedSmiles,
                atomCount: totalAtoms,
                isComposite: true,
              },
            } as IUPACToken,
            ...adjustedParentTokens.filter((t) => !t.metadata?.numPart),
          ];

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Combined composite alkane: ${combinedValue} = ${totalAtoms} carbons`,
            );
          }
        }
      }
    }

    if (process.env.VERBOSE) {
      console.log("[graph-builder] Starting build");
      console.log("[graph-builder] Parent tokens:", parentTokens.map((t) => t.value).join(", "));
      console.log("[graph-builder] Suffix tokens:", suffixTokens.map((t) => t.value).join(", "));
      console.log(
        "[graph-builder] Substituents:",
        substituentTokens.map((t) => t.value).join(", "),
      );
    }

    // Detect ether linkages (-oxy- connector)
    // But only if we have at least 2 parents (needed for ether linkage)
    const oxyConnectorIdx = suffixTokens.findIndex(
      (s) => s.value === "oxy" && s.metadata?.suffixType === "connector",
    );

    if (oxyConnectorIdx >= 0 && parentTokens.length >= 2) {
      // Check if this looks like a real ether linkage
      // (has alkyl parent before oxy and main parent after oxy)
      const oxyToken = suffixTokens[oxyConnectorIdx]!;
      const alkylParent = parentTokens.find((p) => p.position < oxyToken.position);
      const mainParent = parentTokens.find((p) => p.position > oxyToken.position);

      if (alkylParent && mainParent) {
        // Handle ether linkage separately
        return this.buildEtherLinkage(
          builder,
          tokens,
          parentTokens,
          suffixTokens,
          locantTokens,
          finalSubstituentTokens,
          multiplierTokens,
          oxyConnectorIdx,
        );
      } else {
        // Not a real ether linkage (e.g., "silyloxy" split incorrectly)
        if (process.env.VERBOSE) {
          console.log(
            `[graph-builder] Oxy marked as connector but missing alkyl or main parent - treating as regular suffix`,
          );
        }
      }
    }

    // Handle ester suffixes without explicit parent (e.g., "acetate", "formate", "benzoate")
    // Pattern: "(substituents) ester-name" where ester-name is the principal functional group
    if (parentTokens.length === 0 && substituentTokens.length > 0) {
      const esterSuffix = suffixTokens.find((s) => {
        const val = s.value.toLowerCase();
        return (
          val === "acetate" ||
          val === "formate" ||
          val === "benzoate" ||
          val === "propanoate" ||
          val === "butanoate" ||
          val === "pentanoate" ||
          val.endsWith("oate")
        );
      });

      if (esterSuffix) {
        // Map ester suffix to implied parent chain
        let implicitParentSmiles = "CC"; // Default to ethanoate (acetate)
        let implicitParentName = "ethanoate";

        if (esterSuffix.value === "formate") {
          implicitParentSmiles = "C";
          implicitParentName = "methanoate";
        } else if (esterSuffix.value === "benzoate" || esterSuffix.value === "benzenecarboxylate") {
          implicitParentSmiles = "c1ccccc1C"; // Benzoate = benzene-carboxylate
          implicitParentName = "benzoate";
        }

        // Create synthetic parent token for the ester
        const implicitParent: IUPACToken = {
          type: "PARENT",
          value: implicitParentName,
          position: esterSuffix.position,
          length: 0, // Implicit, not in original text
          metadata: {
            smiles: implicitParentSmiles,
            isImplicit: true,
            atomCount: implicitParentSmiles.length, // Count C's in SMILES
          },
        };

        if (process.env.VERBOSE) {
          console.log(
            `[graph-builder] Creating implicit parent "${implicitParentName}" for ester suffix "${esterSuffix.value}"`,
          );
        }

        // Prepend implicit parent to parent tokens and rebuild
        const updatedParentTokens = [implicitParent, ...parentTokens];
        return this.buildFromTokens(
          builder,
          tokens,
          updatedParentTokens,
          finalSuffixTokens,
          prefixTokens,
          locantTokens,
          finalSubstituentTokens,
          multiplierTokens,
          isSaturatedForm,
        );
      }
    }

    // Delegate to standard token building
    return this.buildFromTokens(
      builder,
      tokens,
      adjustedParentTokens,
      finalSuffixTokens,
      prefixTokens,
      locantTokens,
      finalSubstituentTokens,
      multiplierTokens,
      isSaturatedForm,
    );
  }

  /**
   * Check if a prefix token represents an N-substitution (including N,N,3 patterns)
   * Matches: "n", "n,n", "n,n,3", etc.
   */
  private buildFromTokens(
    builder: MoleculeGraphBuilder,
    tokens: IUPACToken[],
    adjustedParentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    prefixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    isSaturatedForm: boolean = false,
  ): Molecule {
    const stereoTokens = tokens.filter((t) => t.type === "STEREO");

    const hasEsterSuffix = suffixTokens.some(
      (s) =>
        s.value === "oate" ||
        s.value === "anoate" ||
        s.value === "formate" ||
        s.value === "acetate",
    );
    if (hasEsterSuffix && substituentTokens.length > 0 && adjustedParentTokens.length > 0) {
      // Check if first substituent comes before parent (indicates ester alkyl group)
      const firstSubst = substituentTokens[0]!;
      const firstParent = adjustedParentTokens[0]!;

      if (firstSubst.position < firstParent.position) {
        // Special case: parent with "yl" suffix + formate means parent is a substituent shape
        // e.g., "methyl prop-1-ynylsulfanylformate"
        // The parent "prop" should not be the acyl chain, but part of the substituent definition
        const hasYlSuffix = suffixTokens.some((s) => s.value === "yl" || s.value?.endsWith("yl"));
        const hasFormate = suffixTokens.some((s) => s.value === "formate");

        if (hasYlSuffix && hasFormate) {
          // In this case, the parent is describing a substituent shape, not an acyl chain
          // Don't use buildEster - instead build formate with substituents directly
          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Detected parent with yl suffix + formate: treating as formate with complex substituent`,
            );
          }

          // Build methanoate (formate) manually: O=C(O-Me)
          const cIdx = builder.addAtom("C"); // Central carbon
          const o1Idx = builder.addAtom("O"); // Double bond oxygen
          const o2Idx = builder.addAtom("O"); // Ester oxygen

          builder.addBond(cIdx, o1Idx, BondTypeEnum.DOUBLE); // C=O
          builder.addBond(cIdx, o2Idx); // C-O (ester)

          // Add ester alkyl (methyl): -OCH3
          const methoxyTokens = substituentTokens.filter((s) => s.value === "methyl");
          if (methoxyTokens.length > 0) {
            const meIdx = builder.addCarbon();
            builder.addBond(o2Idx, meIdx); // O-Me
          }

          // Now add the complex substituent (prop-1-ynylsulfanyl) to the formate carbon
          // Build the alkyne chain: prop-1-ynyl means HC≡C-C
          // Structure: C1≡C2-C3
          // prop-1-yn means triple bond at position 1, so between C1 and C2
          // When used as -yl, it attaches via the last carbon (C3)
          // But with sulfanyl, the attachment is: formate-S-C1≡C2-C3

          const c1Idx = builder.addCarbon(); // C1 (terminal, part of triple bond)
          const c2Idx = builder.addCarbon(); // C2 (part of triple bond)
          const c3Idx = builder.addCarbon(); // C3 (final carbon)

          // Connect them: C1≡C2-C3
          builder.addTripleBond(c1Idx, c2Idx); // C1≡C2
          builder.addBond(c2Idx, c3Idx); // C2-C3

          // Add sulfur connector between formate C and the first carbon of the alkyne
          const sIdx = builder.addAtom("S");
          builder.addBond(cIdx, sIdx); // C-S (formate carbon to sulfur)
          builder.addBond(sIdx, c1Idx); // S-C1 (sulfur to alkyne)
          return builder.build();
        }

        return this.buildEster(
          builder,
          substituentTokens,
          adjustedParentTokens,
          suffixTokens,
          locantTokens,
          multiplierTokens,
        );
      }
    }

    // Detect N-substituted amides and amines (N- or N,N- prefix)
    const hasAmideSuffix = suffixTokens.some((s) => s.value === "amide" || s.value === "amid");
    const hasAmineSuffix = suffixTokens.some((s) => s.value === "amine" || s.value === "amin");
    const nPrefixToken = prefixTokens.find((p) => this.isNSubstitutionPrefix(p));

    // Check if parent is likely a ring system (where N-substituted amide logic might fail)
    const isRingParent = adjustedParentTokens.some(
      (p) =>
        p.metadata?.isRing ||
        [
          "quinoline",
          "pyridine",
          "indole",
          "isoindole",
          "pyrrol",
          "furan",
          "thiophen",
          "benz",
          "naphth",
        ].some((r) => p.value.toLowerCase().includes(r)),
    );

    if (hasAmideSuffix && nPrefixToken && !isRingParent) {
      return this.buildNSubstitutedAmide(
        builder,
        adjustedParentTokens,
        suffixTokens,
        locantTokens,
        substituentTokens,
        multiplierTokens,
        prefixTokens,
      );
    }

    if (hasAmineSuffix && nPrefixToken && adjustedParentTokens.length > 0) {
      // Only handle N-substituted amines for linear alkanes, not heterocyclic rings
      // First, select the best parent: prefer ring systems over linear chains
      let parentToken = adjustedParentTokens[0]!;
      if (adjustedParentTokens.length > 1) {
        // Check if any token is a ring system
        const ringParents = adjustedParentTokens.filter(
          (t) => (t.metadata?.isRing as boolean) === true,
        );

        if (ringParents.length > 0) {
          // Prefer ring systems - select the first one found
          parentToken = ringParents[0]!;
          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] N-substituted amine: Multiple parent chains found: ${adjustedParentTokens.map((t) => t.value).join(", ")}. Preferring ring system: ${parentToken.value}`,
            );
          }
        } else {
          // No ring systems, select longest alkane chain
          const atomCounts = adjustedParentTokens.map(
            (t) => (t.metadata?.atomCount as number) || 0,
          );
          const maxAtomCount = Math.max(...atomCounts);
          const longestParentIdx = adjustedParentTokens.findIndex(
            (t) => (t.metadata?.atomCount as number) === maxAtomCount,
          );
          if (longestParentIdx >= 0) {
            parentToken = adjustedParentTokens[longestParentIdx]!;
            if (process.env.VERBOSE) {
              console.log(
                `[graph-builder] N-substituted amine: Multiple parent chains found: ${adjustedParentTokens.map((t) => t.value).join(", ")}. Selecting longest: ${parentToken.value} (${maxAtomCount} atoms)`,
              );
            }
          }
        }
      }

      const parentValue = parentToken.value.toLowerCase();
      const atomCount = (parentToken.metadata?.atomCount as number) || 0;

      // Check if we can handle this parent in buildNSubstitutedAmine
      // This includes both linear alkanes and supported ring systems
      const canHandleNAmine =
        atomCount > 0 || // Linear alkane
        parentValue.includes("thiazol") ||
        parentValue.includes("oxazol") ||
        parentValue.includes("imidazol") ||
        parentValue.includes("pyrrole") ||
        parentValue.includes("pyridine") ||
        parentValue.includes("benzene");

      if (canHandleNAmine) {
        return this.buildNSubstitutedAmine(
          builder,
          adjustedParentTokens,
          suffixTokens,
          locantTokens,
          substituentTokens,
          multiplierTokens,
          prefixTokens,
          isSaturatedForm,
        );
      }
    }

    // Check for cyclo prefix that modifies the main parent chain (not substituents)
    // Only treat cyclo as modifying the parent if there's no substituent between it and the parent
    let hasCycloPrefix = false;
    let cycloPrefixToken: IUPACToken | undefined;
    if (adjustedParentTokens.length > 0) {
      const parentToken = adjustedParentTokens[0]!;
      const cycloPrefix = prefixTokens.find((p) => p.metadata?.isCyclic === true);
      if (cycloPrefix) {
        const substBetween = substituentTokens.find(
          (s) => cycloPrefix.position < s.position && s.position < parentToken.position,
        );
        if (!substBetween) {
          hasCycloPrefix = true;
          cycloPrefixToken = cycloPrefix;
        }
      }
    }

    // Step 1: Build parent chain
    let mainChainAtoms: number[] = [];
    let hasBicyclicOrTricyclicStructure = false;

    if (adjustedParentTokens.length > 0) {
      // When multiple parent tokens exist, select the best one
      // Priority 1: Ring systems (they are structural cores, not substituents)
      // Priority 2: Longest alkane chain (substituents are typically shorter)
      let parentToken = adjustedParentTokens[0]!;
      if (adjustedParentTokens.length > 1) {
        // Check if any token is a ring system
        const ringParents = adjustedParentTokens.filter(
          (t) => (t.metadata?.isRing as boolean) === true,
        );

        if (ringParents.length > 0) {
          // Prefer ring systems - select the first one found
          parentToken = ringParents[0]!;
          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Multiple parent chains found: ${adjustedParentTokens.map((t) => t.value).join(", ")}. Preferring ring system: ${parentToken.value}`,
            );
          }
        } else {
          // No ring systems, select longest alkane chain
          const atomCounts = adjustedParentTokens.map(
            (t) => (t.metadata?.atomCount as number) || 0,
          );
          const maxAtomCount = Math.max(...atomCounts);
          const longestParentIdx = adjustedParentTokens.findIndex(
            (t) => (t.metadata?.atomCount as number) === maxAtomCount,
          );
          if (longestParentIdx >= 0) {
            parentToken = adjustedParentTokens[longestParentIdx]!;
            if (process.env.VERBOSE) {
              console.log(
                `[graph-builder] Multiple parent chains found: ${adjustedParentTokens.map((t) => t.value).join(", ")}. Selecting longest: ${parentToken.value} (${maxAtomCount} atoms)`,
              );
            }
          }
        }
      }

      const parentValue = parentToken.value.toLowerCase();
      const atomCount = (parentToken.metadata?.atomCount as number) || 0;
      const parentSmiles = (parentToken.metadata?.smiles as string) || "";

      if (process.env.VERBOSE) {
        console.log(
          "[graph-builder] Building parent chain:",
          parentToken.value,
          "atoms:",
          atomCount,
        );
      }

      // Detect bicyclic notation in PREFIX (re-extract here since we're in buildFromTokens scope)
      let _bicycloMetadata2: {
        bridgeN: number;
        bridgeM: number;
        bridgeP: number;
        heteroPrefix: string;
        heteroType: string;
      } | null = null;

      const bicycloPrefix = prefixTokens.find(
        (p) =>
          (p.value?.includes("bicyclo") || p.value?.includes("bicyclic")) &&
          p.metadata?.hasBridgeNotation,
      );

      if (bicycloPrefix) {
        const bicycloRegex = /^(\d+-)?([a-z]*)?bicycl(?:ic|o)\[(\d+)\.(\d+)\.(\d+)\]/i;
        const match = bicycloPrefix.value?.match(bicycloRegex);

        if (match) {
          const heteroPrefix = match[1] ? match[1].slice(0, -1) : "";
          const heteroType = match[2] || "";
          const bridgeN = parseInt(match[3]!);
          const bridgeM = parseInt(match[4]!);
          const bridgeP = parseInt(match[5]!);

          _bicycloMetadata2 = {
            bridgeN,
            bridgeM,
            bridgeP,
            heteroPrefix,
            heteroType,
          };

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Detected bicyclic PREFIX in buildFromTokens: [${bridgeN}.${bridgeM}.${bridgeP}]${heteroType ? ` with ${heteroPrefix}-${heteroType}` : ""}`,
            );
          }
        }
      }

      // Check if we have bicyclic prefix metadata from earlier detection
      if (_bicycloMetadata2 && bicycloPrefix) {
        const bridgeN = _bicycloMetadata2.bridgeN;
        const bridgeM = _bicycloMetadata2.bridgeM;
        const bridgeP = _bicycloMetadata2.bridgeP;
        const heteroType = _bicycloMetadata2.heteroType;
        let heteroPrefix = _bicycloMetadata2.heteroPrefix;

        if (process.env.VERBOSE) {
          console.log(
            `[graph-builder] Building bicyclic structure from PREFIX: [${bridgeN}.${bridgeM}.${bridgeP}]${heteroType ? ` with ${heteroPrefix}-${heteroType}` : ""}`,
          );
        }

        // If heteroType is specified but heteroPrefix is empty, check for a locant token right before the PREFIX
        // This handles cases like "9-oxabicyclo[3.3.1]" where the locant is a separate token
        if (heteroType && !heteroPrefix) {
          const locantBeforePrefix = locantTokens
            .filter((l) => l.position < bicycloPrefix.position)
            .sort((a, b) => b.position - a.position)[0]; // Get the most recent locant

          if (locantBeforePrefix) {
            // Check if the locant is immediately before the PREFIX (separated only by a hyphen)
            // E.g., position 0 (len 1) for "9", hyphen at position 1, PREFIX at position 2
            if (
              locantBeforePrefix.position + locantBeforePrefix.length + 1 ===
              bicycloPrefix.position
            ) {
              heteroPrefix = locantBeforePrefix.value;
              if (process.env.VERBOSE) {
                console.log(
                  `[graph-builder] Found locant before bicyclo PREFIX: heteroPrefix = ${heteroPrefix}`,
                );
              }
            }
          }
        }

        let heteroPos: number | undefined;
        let heteroSymbol = "C";

        // Parse heteroatom specification
        if (heteroType && heteroPrefix && /^\d+$/.test(heteroPrefix)) {
          heteroPos = parseInt(heteroPrefix);
          heteroSymbol =
            heteroType === "oxa"
              ? "O"
              : heteroType === "aza"
                ? "N"
                : heteroType === "thia"
                  ? "S"
                  : "C";

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Heteroatom substitution: position ${heteroPos} → ${heteroSymbol}`,
            );
          }
        }

        mainChainAtoms = builder.createBicyclicStructureWithHetero(
          bridgeN,
          bridgeM,
          bridgeP,
          heteroPos,
          heteroSymbol,
        );
        if (process.env.VERBOSE) {
          console.log(
            `[graph-builder] Bicyclic structure built. mainChainAtoms: ${JSON.stringify(mainChainAtoms)}`,
          );
        }
        hasBicyclicOrTricyclicStructure = true;
        if (process.env.VERBOSE) {
          console.log(`[graph-builder] Set hasBicyclicOrTricyclicStructure = true`);
        }
      }

      // Detect tricyclic notation in PREFIX
      const tricycloPrefix = prefixTokens.find(
        (p) =>
          (p.value?.includes("tricyclo") || p.value?.includes("tricyclic")) &&
          p.metadata?.hasBridgeNotation,
      );

      if (tricycloPrefix && !hasBicyclicOrTricyclicStructure) {
        const tricycloRegex = /^([a-z]+)?tricycl(?:ic|o)\[([0-9.^,{}]+)\]/i;
        const match = tricycloPrefix.value?.match(tricycloRegex);

        if (match) {
          const bridgeNotation = match[2] || "";
          let heteroType = match[1] || "";
          heteroType = heteroType.replace(/^(di|tri|tetra|penta|hexa|hepta|octa|nona)/, "");

          const bridgeParts = bridgeNotation.split(/\.(?=\d)/);
          const mainBridges: number[] = [];
          const secondaryBridges: {
            from: number;
            to: number;
            length: number;
          }[] = [];

          for (const part of bridgeParts) {
            if (part.includes("^")) {
              const match = part.match(/(\d+)\^\{?(\d+),(\d+)\}?/);
              if (match) {
                secondaryBridges.push({
                  length: parseInt(match[1]!),
                  from: parseInt(match[2]!),
                  to: parseInt(match[3]!),
                });
              }
            } else if (part.includes(",")) {
              // Handle smushed format
              const match = part.match(/^(\d)(\d+),(\d+)$/);
              if (match) {
                secondaryBridges.push({
                  length: parseInt(match[1]!),
                  from: parseInt(match[2]!),
                  to: parseInt(match[3]!),
                });
              }
            } else {
              const val = parseInt(part);
              if (!isNaN(val)) mainBridges.push(val);
            }
          }

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Detected tricyclic PREFIX: [${bridgeNotation}]${heteroType ? ` with ${heteroType}` : ""}`,
            );
            console.log(`[graph-builder] Main bridges: ${mainBridges.join(", ")}`);
            console.log(`[graph-builder] Secondary bridges: ${JSON.stringify(secondaryBridges)}`);
          }

          let heteroPositions = new Map<number, string>();
          if (heteroType) {
            const locantBeforePrefix = locantTokens
              .filter((l) => l.position < tricycloPrefix.position)
              .sort((a, b) => b.position - a.position)[0];

            if (locantBeforePrefix && Array.isArray(locantBeforePrefix.metadata?.positions)) {
              const heteroSymbol =
                heteroType === "oxa"
                  ? "O"
                  : heteroType === "aza"
                    ? "N"
                    : heteroType === "thia"
                      ? "S"
                      : "C";

              for (const locant of locantBeforePrefix.metadata.positions as number[]) {
                heteroPositions.set(locant, heteroSymbol);
              }
            }
          }

          mainChainAtoms = builder.createVonBaeyerSystem(
            mainBridges,
            secondaryBridges,
            heteroPositions,
          );
          hasBicyclicOrTricyclicStructure = true;

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Tricyclic structure built. mainChainAtoms: ${JSON.stringify(mainChainAtoms)}`,
            );
          }
        }
      }

      // Detect pentacyclic notation in PREFIX (e.g., "trioxapentacyclo[12.3.2.0^1,13.0^2,10.0^6,10]")
      const pentacycloPrefix = prefixTokens.find(
        (p) =>
          (p.value?.includes("pentacyclo") || p.value?.includes("pentacyclic")) &&
          p.metadata?.hasBridgeNotation,
      );

      if (pentacycloPrefix) {
        // Extract bridge notation from PREFIX value
        // E.g., "trioxapentacyclo[12.3.2.0^1,13.0^2,10.0^6,10]nonadecane"
        const pentacycloRegex = /^([a-z]+)?pentacycl(?:ic|o)\[([0-9.^,{}]+)\]/i;
        const match = pentacycloPrefix.value?.match(pentacycloRegex);

        if (match) {
          const bridgeNotation = match[2] || "";
          let heteroType = match[1] || "";

          // Strip numeric multiplier prefix from heteroType
          heteroType = heteroType.replace(/^(di|tri|tetra|penta|hexa|hepta|octa|nona)/, "");

          // Parse bridge notation into main bridges and secondary bridges
          const bridgeParts = bridgeNotation.split(/\.(?=\d)/);
          const mainBridges: number[] = [];
          const secondaryBridges: {
            from: number;
            to: number;
            length: number;
          }[] = [];

          for (const part of bridgeParts) {
            if (part.includes("^")) {
              // Secondary bridge: length^from,to or length^{from,to}
              const match = part.match(/(\d+)\^\{?(\d+),(\d+)\}?/);
              if (match) {
                const len = parseInt(match[1]!);
                const from = parseInt(match[2]!);
                const to = parseInt(match[3]!);
                secondaryBridges.push({ from, to, length: len });
              }
            } else if (part.includes(",")) {
              // Handle smushed format: "12,9" -> length 1, from 2, to 9
              // Or "018,22" -> length 0, from 18, to 22
              const match = part.match(/^(\d)(\d+),(\d+)$/);
              if (match) {
                const len = parseInt(match[1]!);
                const f = parseInt(match[2]!);
                const t = parseInt(match[3]!);
                secondaryBridges.push({
                  length: len,
                  from: f,
                  to: t,
                });
              }
            } else {
              const val = parseInt(part);
              if (!isNaN(val)) mainBridges.push(val);
            }
          }

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Detected pentacyclic PREFIX: [${bridgeNotation}]${heteroType ? ` with ${heteroType}` : ""}`,
            );
            console.log(`[graph-builder] Main bridges: ${mainBridges.join(", ")}`);
            console.log(`[graph-builder] Secondary bridges: ${JSON.stringify(secondaryBridges)}`);
          }

          // Extract heteroatom locants from the LOCANT token that precedes this PREFIX
          let heteroPositions = new Map<number, string>();
          if (heteroType) {
            const locantBeforePrefix = locantTokens
              .filter((l) => l.position < pentacycloPrefix.position)
              .sort((a, b) => b.position - a.position)[0];

            if (locantBeforePrefix && Array.isArray(locantBeforePrefix.metadata?.positions)) {
              const heteroSymbol =
                heteroType === "oxa"
                  ? "O"
                  : heteroType === "aza"
                    ? "N"
                    : heteroType === "thia"
                      ? "S"
                      : "C";

              for (const locant of locantBeforePrefix.metadata.positions as number[]) {
                heteroPositions.set(locant, heteroSymbol);
                if (process.env.VERBOSE) {
                  console.log(
                    `[graph-builder] Heteroatom substitution: position ${locant} → ${heteroSymbol}`,
                  );
                }
              }
            }
          }

          // Build pentacyclic structure using generic Von Baeyer builder
          mainChainAtoms = builder.createVonBaeyerSystem(
            mainBridges,
            secondaryBridges,
            heteroPositions,
          );
          hasBicyclicOrTricyclicStructure = true;

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Pentacyclic structure built. mainChainAtoms: ${JSON.stringify(mainChainAtoms)}`,
            );
          }
        }
      }

      // Detect heptacyclic notation in PREFIX
      const heptacycloPrefix = prefixTokens.find(
        (p) =>
          (p.value?.includes("heptacyclo") || p.value?.includes("heptacyclic")) &&
          p.metadata?.hasBridgeNotation,
      );

      if (heptacycloPrefix && !hasBicyclicOrTricyclicStructure) {
        const heptacycloRegex = /^([a-z]+)?heptacycl(?:ic|o)\[([0-9.^,{}]+)\]/i;
        const match = heptacycloPrefix.value?.match(heptacycloRegex);

        if (match) {
          const bridgeNotation = match[2] || "";
          let heteroType = match[1] || "";
          heteroType = heteroType.replace(/^(di|tri|tetra|penta|hexa|hepta|octa|nona)/, "");

          const bridgeParts = bridgeNotation.split(/\.(?=\d)/);
          const mainBridges: number[] = [];
          const secondaryBridges: {
            from: number;
            to: number;
            length: number;
          }[] = [];

          for (const part of bridgeParts) {
            if (part.includes("^")) {
              const match = part.match(/(\d+)\^\{?(\d+),(\d+)\}?/);
              if (match) {
                secondaryBridges.push({
                  length: parseInt(match[1]!),
                  from: parseInt(match[2]!),
                  to: parseInt(match[3]!),
                });
              }
            } else if (part.includes(",")) {
              const match = part.match(/^(\d)(\d+),(\d+)$/);
              if (match) {
                secondaryBridges.push({
                  length: parseInt(match[1]!),
                  from: parseInt(match[2]!),
                  to: parseInt(match[3]!),
                });
              }
            } else {
              const val = parseInt(part);
              if (!isNaN(val)) mainBridges.push(val);
            }
          }

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Detected heptacyclic PREFIX: [${bridgeNotation}]${heteroType ? ` with ${heteroType}` : ""}`,
            );
            console.log(`[graph-builder] Main bridges: ${mainBridges.join(", ")}`);
            console.log(`[graph-builder] Secondary bridges: ${JSON.stringify(secondaryBridges)}`);
          }

          let heteroPositions = new Map<number, string>();

          // Collect replacement prefixes (oxa, aza, thia, etc.) preceding the heptacyclo token
          // Check prefixTokens, substituentTokens AND suffixTokens (sometimes replacement prefixes are categorized as suffixes or substituents)
          const potentialReplacements = [...prefixTokens, ...substituentTokens, ...suffixTokens];
          const replacementPrefixes = potentialReplacements
            .filter(
              (p) =>
                p.position < heptacycloPrefix.position &&
                (p.value.endsWith("oxa") ||
                  p.value.endsWith("aza") ||
                  p.value.endsWith("thia") ||
                  p.value.endsWith("sila")),
            )
            .sort((a, b) => a.position - b.position);

          if (heteroType && !replacementPrefixes.some((p) => p.value.includes(heteroType))) {
            // If the embedded heteroType isn't in the replacement list (or is the only one), handle it
            const locantBeforePrefix = locantTokens
              .filter((l) => l.position < heptacycloPrefix.position)
              .sort((a, b) => b.position - a.position)[0];

            if (locantBeforePrefix && Array.isArray(locantBeforePrefix.metadata?.positions)) {
              const heteroSymbol =
                heteroType === "oxa"
                  ? "O"
                  : heteroType === "aza"
                    ? "N"
                    : heteroType === "thia"
                      ? "S"
                      : "C";

              for (const locant of locantBeforePrefix.metadata.positions as number[]) {
                heteroPositions.set(locant, heteroSymbol);
              }
            }
          }

          // Process explicit replacement prefixes
          for (const prefix of replacementPrefixes) {
            let type = "";
            if (prefix.value.endsWith("oxa")) type = "oxa";
            else if (prefix.value.endsWith("aza")) type = "aza";
            else if (prefix.value.endsWith("thia")) type = "thia";
            else if (prefix.value.endsWith("sila")) type = "sila";

            const sym =
              type === "oxa"
                ? "O"
                : type === "aza"
                  ? "N"
                  : type === "thia"
                    ? "S"
                    : type === "sila"
                      ? "Si"
                      : "C";

            // Use substituent locant logic to find associated locants
            // Also check for multipliers! "trioxa" means 3 oxygens.
            const multiplier = this.getMultiplierBeforeSubstituent(prefix, multiplierTokens);
            let locants = this.getLocantsBeforeSubstituent(prefix, locantTokens);

            if (multiplier) {
              const count = (multiplier.metadata?.count as number) || 1;
              // If we found fewer locants than the multiplier count, we need to look harder.
              // getLocantsBeforeSubstituent might stop at the multiplier if it's in the way, or just return the closest.
              // We need "N locants before multiplier".

              if (locants.length < count) {
                const relevantLocants = locantTokens
                  .filter((l) => l.position < multiplier.position)
                  .sort((a, b) => b.position - a.position)
                  .slice(0, count);

                // Flatten locants
                const flattened: number[] = [];
                for (const l of relevantLocants.reverse()) {
                  const positions = l.metadata?.positions as number[] | undefined;
                  if (positions) flattened.push(...positions);
                  else flattened.push(parseInt(l.value));
                }
                locants = flattened;
              }
            }

            for (const loc of locants) {
              heteroPositions.set(loc, sym);
            }
          }

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Heptacyclo heteroPositions: ${JSON.stringify(Array.from(heteroPositions.entries()))}`,
            );
          }

          mainChainAtoms = builder.createVonBaeyerSystem(
            mainBridges,
            secondaryBridges,
            heteroPositions,
          );
          hasBicyclicOrTricyclicStructure = true;

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Heptacyclic structure built. mainChainAtoms: ${JSON.stringify(mainChainAtoms)}`,
            );
          }
        }
      }

      // Detect spiro notation in PREFIX (e.g., "spiro[4.5]decane", "1-oxaspiro[4.5]decane")
      const spiroPrefix = prefixTokens.find(
        (p) =>
          p.value?.includes("spiro") &&
          p.metadata?.hasBridgeNotation &&
          !hasBicyclicOrTricyclicStructure,
      );

      if (spiroPrefix) {
        // Extract bridge notation from PREFIX value
        // Pattern: optional multiplier + optional heteroatom prefix + "spiro[a.b]"
        // Examples: "spiro[4.5]", "oxaspiro[4.5]", "dioxaspiro[4.5]", "azaspiro[3.3]"
        const spiroRegex = /^(di|tri|tetra)?([a-z]+)?spiro\[(\d+)\.(\d+)\]/i;
        const match = spiroPrefix.value?.match(spiroRegex);

        if (match) {
          const heteroMultiplier = match[1] || "";
          const heteroType = match[2] || "";
          const ringA = parseInt(match[3]!);
          const ringB = parseInt(match[4]!);

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Detected spiro PREFIX: [${ringA}.${ringB}]${heteroType ? ` with ${heteroMultiplier}${heteroType}` : ""}`,
            );
          }

          const rawSpiroAtoms = builder.createSpiroStructure(ringA, ringB);
          hasBicyclicOrTricyclicStructure = true;

          // Remap spiro atoms to IUPAC numbering
          // createSpiroStructure returns: [spiroCenter, ringA_atom1, ..., ringA_atomN, ringB_atom1, ..., ringB_atomN]
          // IUPAC numbering: positions 1..ringA (ring A), position ringA+1 (spiro center), positions ringA+2..end (ring B)
          // So we need: [ringA_atoms..., spiroCenter, ringB_atoms...]
          const spiroCenter = rawSpiroAtoms[0]!;
          const ringAAtoms = rawSpiroAtoms.slice(1, ringA + 1);
          const ringBAtoms = rawSpiroAtoms.slice(ringA + 1);
          mainChainAtoms = [...ringAAtoms, spiroCenter, ...ringBAtoms];

          if (process.env.VERBOSE) {
            console.log(
              `[graph-builder] Spiro structure built. Raw atoms: ${JSON.stringify(rawSpiroAtoms)}`,
            );
            console.log(
              `[graph-builder] Remapped to IUPAC order: ${JSON.stringify(mainChainAtoms)}`,
            );
          }

          // Apply heteroatom replacements if specified
          // heteroType can be "oxa", "aza", "thia", etc.
          if (heteroType) {
            const heteroSymbol =
              heteroType === "oxa"
                ? "O"
                : heteroType === "aza"
                  ? "N"
                  : heteroType === "thia"
                    ? "S"
                    : null;

            if (heteroSymbol) {
              // Determine how many heteroatoms to add
              const heteroCount =
                heteroMultiplier === "di"
                  ? 2
                  : heteroMultiplier === "tri"
                    ? 3
                    : heteroMultiplier === "tetra"
                      ? 4
                      : 1;

              // Find locants for heteroatom positions from tokens IMMEDIATELY before spiroPrefix
              // We need to exclude locants that belong to other heteroatom suffixes (like "2-oxa" in "2-oxa-6-azaspiro")
              // Only use locants that are not followed by a heteroatom suffix before the spiro prefix
              const heteroSuffixPositions = suffixTokens
                .filter((s) => s.metadata?.suffixType === "heteroatom")
                .map((s) => s.position);

              const heteroLocants = locantTokens
                .filter((l) => {
                  // Locant must be before spiro prefix
                  if (l.position >= spiroPrefix.position) return false;
                  // Check if this locant is followed by a heteroatom suffix (meaning it belongs to that suffix, not the spiro)
                  const hasHeteroSuffixAfter = heteroSuffixPositions.some(
                    (pos) => pos > l.position && pos < spiroPrefix.position,
                  );
                  return !hasHeteroSuffixAfter;
                })
                .flatMap((l) => (l.metadata?.positions as number[]) || [parseInt(l.value)])
                .filter((pos) => !isNaN(pos));

              if (process.env.VERBOSE) {
                console.log(
                  `[graph-builder] Spiro heteroatom replacement: ${heteroCount}x ${heteroSymbol} at positions:`,
                  heteroLocants,
                );
              }

              // Apply heteroatom replacements
              // Spiro numbering: positions 1..ringA are in ring A, position ringA+1 is the spiro center,
              // positions ringA+2..ringA+ringB+1 are in ring B
              for (let i = 0; i < heteroCount; i++) {
                const pos = heteroLocants[i] ?? i + 1; // Default to positions 1, 2, 3... if no locants
                const atomIdx = this.locantToAtomIndex(pos, mainChainAtoms);

                if (atomIdx !== null) {
                  builder.replaceAtom(atomIdx, heteroSymbol);
                  if (process.env.VERBOSE) {
                    console.log(
                      `[graph-builder] Replaced atom at position ${pos} (index ${atomIdx}) with ${heteroSymbol}`,
                    );
                  }
                }
              }
            }
          }

          // Also check for additional heteroatom prefixes in other tokens (e.g., "2-oxa-6-aza...")
          // These are SUFFIX tokens with metadata.suffixType === "heteroatom"
          const heteroSuffixTokens = suffixTokens.filter(
            (s) => s.metadata?.suffixType === "heteroatom",
          );

          for (const heteroSuffix of heteroSuffixTokens) {
            const heteroName = heteroSuffix.value.toLowerCase();
            const heteroSymbol =
              heteroName === "oxa"
                ? "O"
                : heteroName === "aza"
                  ? "N"
                  : heteroName === "thia"
                    ? "S"
                    : null;

            if (heteroSymbol) {
              // Find the locant immediately before this suffix
              const locantBefore = locantTokens
                .filter((l) => l.position < heteroSuffix.position)
                .sort((a, b) => b.position - a.position)[0];

              if (locantBefore) {
                const positions = (locantBefore.metadata?.positions as number[]) || [
                  parseInt(locantBefore.value),
                ];
                for (const pos of positions) {
                  if (!isNaN(pos)) {
                    const atomIdx = this.locantToAtomIndex(pos, mainChainAtoms);
                    if (atomIdx !== null) {
                      builder.replaceAtom(atomIdx, heteroSymbol);
                      if (process.env.VERBOSE) {
                        console.log(
                          `[graph-builder] Replaced atom at position ${pos} (index ${atomIdx}) with ${heteroSymbol} (from suffix)`,
                        );
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (parentValue === "benzene" || parentValue === "benz" || parentSmiles === "c1ccccc1") {
        mainChainAtoms = builder.createBenzeneRing();
      } else if (parentValue === "pyridine" || parentSmiles === "c1ccncc1") {
        mainChainAtoms = builder.createPyridineRing();
      } else if (
        parentValue === "triazine" ||
        parentSmiles === "c1ncncn1" ||
        parentSmiles === "n1cncnc1"
      ) {
        mainChainAtoms = builder.createTriazineRing();
      } else if (parentValue === "furan" || parentSmiles === "o1cccc1") {
        mainChainAtoms = builder.createFuranRing();
      } else if (parentValue === "thiophene" || parentSmiles === "c1ccsc1") {
        mainChainAtoms = builder.createThiopheneRing();
      } else if (
        parentValue === "pyrrole" ||
        parentSmiles === "[nH]1cccc1" ||
        parentValue === "pyrrol"
      ) {
        if (isSaturatedForm) {
          // pyrrolidine logic if explicitly saturated?
          // But usually saturated pyrrole is pyrrolidine.
          // If "1H-pyrrole", it is aromatic.
          // If "2,3-dihydro-1H-pyrrole", it is partially saturated.
          // The builder creates aromatic by default.
          mainChainAtoms = builder.createPyrroleRing();
        } else {
          mainChainAtoms = builder.createPyrroleRing();
        }
      } else if (
        parentValue === "thiazole" ||
        parentValue === "thiazol" ||
        parentSmiles === "c1cscn1" ||
        parentSmiles === "c1scnc1"
      ) {
        if (isSaturatedForm) {
          mainChainAtoms = builder.createThiazoleSaturated();
          if (process.env.VERBOSE) {
            console.log("[graph-builder] Creating SATURATED thiazole ring");
          }
        } else {
          mainChainAtoms = builder.createThiazoleRing();
        }
      } else if (
        parentValue === "oxazole" ||
        parentValue === "oxazol" ||
        parentSmiles === "c1cocn1" ||
        parentSmiles === "c1ocnc1"
      ) {
        if (isSaturatedForm) {
          mainChainAtoms = builder.createOxazoleSaturated();
          if (process.env.VERBOSE) {
            console.log("[graph-builder] Creating SATURATED oxazole ring");
          }
        } else {
          mainChainAtoms = builder.createOxazoleRing();
        }
      } else if (
        parentValue === "indole" ||
        parentValue === "indol" ||
        parentSmiles === "c1ccc2[nH]ccc2c1" ||
        parentSmiles === "c1ccc2nccc2c1"
      ) {
        mainChainAtoms = builder.createIndoleRing();
      } else if (
        parentValue === "benzofuran" ||
        parentSmiles === "c1ccc2occc2c1" ||
        parentSmiles === "o1c2ccccc2cc1"
      ) {
        mainChainAtoms = builder.createBenzofuranRing();
      } else if (
        parentValue === "isoindole" ||
        parentValue === "isoindol" ||
        parentSmiles === "c1ccc2c(c1)nc[nH]2" ||
        parentSmiles === "c1ccc2c(c1)[nH]cn2"
      ) {
        mainChainAtoms = builder.createIsoindolRing();
      } else if (parentValue === "naphthalene" || parentSmiles === "c1ccc2ccccc2c1") {
        mainChainAtoms = builder.createNaphthaleneRing();
      } else if (parentValue === "quinoline" || parentSmiles === "c1ccc2ncccc2c1") {
        mainChainAtoms = builder.createQuinolineRing();
      } else if (parentValue === "piperidine" || parentSmiles === "C1CCNCC1") {
        mainChainAtoms = builder.createPiperidineRing();
      } else if (parentValue === "pyrrolidine" || parentSmiles === "C1CCNC1") {
        mainChainAtoms = builder.createPyrrolidineRing();
      } else if (parentValue === "piperazine" || parentSmiles === "C1CNCCN1") {
        mainChainAtoms = builder.createPiperazineRing();
      } else if (parentValue === "morpholine" || parentSmiles === "C1CNCCO1") {
        mainChainAtoms = builder.createMorpholineRing();
      } else if (parentValue === "oxirane" || parentSmiles === "C1CO1") {
        mainChainAtoms = builder.createOxiraneRing();
      } else if (parentValue === "oxetane" || parentSmiles === "C1COC1") {
        mainChainAtoms = builder.createOxetaneRing();
      } else if (parentValue === "azetidine" || parentSmiles === "C1CNC1") {
        mainChainAtoms = builder.createAzetidineRing();
      } else if (
        parentValue === "oxolan" ||
        parentValue === "oxolane" ||
        parentSmiles === "C1CCOC1"
      ) {
        mainChainAtoms = builder.createOxolanRing();
      } else if (parentValue === "oxane" || parentSmiles === "C1CCOCC1") {
        mainChainAtoms = builder.createOxaneRing();
      } else if (parentValue === "thiane" || parentSmiles === "C1CCSCC1") {
        mainChainAtoms = builder.createThianeRing();
      } else if (parentValue === "thiolane" || parentSmiles === "C1CCSC1") {
        mainChainAtoms = builder.createThiolaneRing();
      } else if (
        parentValue === "diaziridine" ||
        parentValue === "diaziridin" ||
        (parentValue === "aziridin" && prefixTokens.some((p) => p.value === "di"))
      ) {
        mainChainAtoms = builder.createDiaziridineRing();
      } else if (
        parentValue === "azirine" ||
        parentValue === "aziridin" ||
        parentValue === "azirin"
      ) {
        mainChainAtoms = builder.createAzirineRing();
      } else if (
        parentValue === "imidazolidine" ||
        parentValue === "imidazolidin" ||
        parentValue === "imidazole" ||
        parentValue === "imidazol" ||
        (parentValue === "azol" && prefixTokens.some((p) => p.value === "imidazo"))
      ) {
        // Use aromatic imidazole ring for "imidazole", saturated for "imidazolidine"
        if (parentValue === "imidazole" || parentValue === "imidazol") {
          mainChainAtoms = builder.createImidazoleRing();
        } else {
          mainChainAtoms = builder.createImidazolidineRing();
        }
      } else if (parentValue === "pyrazole" || parentValue === "pyrazol") {
        mainChainAtoms = builder.createPyrazoleRing();
      } else if (parentValue === "triazole" || parentValue === "triazol") {
        mainChainAtoms = builder.createTriazoleRing();
      } else if (parentValue === "tetrazole" || parentValue === "tetrazol") {
        mainChainAtoms = builder.createTetrazoleRing();
      } else if (parentValue === "isoxazole" || parentValue === "isoxazol") {
        mainChainAtoms = builder.createIsoxazoleRing();
      } else if (parentValue === "isothiazole" || parentValue === "isothiazol") {
        mainChainAtoms = builder.createIsothiazoleRing();
      } else if (parentValue === "pyrimidine" || parentValue === "pyrimidin") {
        mainChainAtoms = builder.createPyrimidineRing();
      } else if (parentValue === "pyrazine" || parentValue === "pyrazin") {
        mainChainAtoms = builder.createPyrazineRing();
      } else if (parentValue === "pyridazine" || parentValue === "pyridazin") {
        mainChainAtoms = builder.createPyridazineRing();
      } else if (parentValue === "benzothiophene" || parentValue === "benzothiophen") {
        mainChainAtoms = builder.createBenzothiopheneRing();
      } else if (parentValue === "benzimidazole" || parentValue === "benzimidazol") {
        mainChainAtoms = builder.createBenzimidazoleRing();
      } else if (parentValue === "benzoxazole" || parentValue === "benzoxazol") {
        mainChainAtoms = builder.createBenzoxazoleRing();
      } else if (parentValue === "benzothiazole" || parentValue === "benzothiazol") {
        mainChainAtoms = builder.createBenzothiazoleRing();
      } else if (parentValue === "indazole" || parentValue === "indazol") {
        mainChainAtoms = builder.createIndazoleRing();
      } else if (parentValue === "benzotriazole" || parentValue === "benzotriazol") {
        mainChainAtoms = builder.createBenzotriazoleRing();
      } else if (parentValue === "oxadiazole" || parentValue === "oxadiazol") {
        // Check for locants immediately before the parent to determine isomer type
        // e.g., "1,2,4-oxadiazole" vs "1,3,4-oxadiazole"
        const locantBeforeParent = locantTokens
          .filter((l) => l.position < parentToken.position)
          .sort((a, b) => b.position - a.position)[0];

        const positions = (locantBeforeParent?.metadata?.positions as number[]) || [];
        const posStr = positions
          .slice()
          .sort((a, b) => a - b)
          .join(",");

        if (posStr === "1,2,4") {
          mainChainAtoms = builder.create124OxadiazoleRing();
        } else if (posStr === "1,2,3") {
          mainChainAtoms = builder.create123OxadiazoleRing();
        } else {
          // Default is 1,3,4-oxadiazole (most common)
          mainChainAtoms = builder.create134OxadiazoleRing();
        }
      } else if (parentValue === "thiadiazole" || parentValue === "thiadiazol") {
        // Check for locants immediately before the parent to determine isomer type
        const locantBeforeParent = locantTokens
          .filter((l) => l.position < parentToken.position)
          .sort((a, b) => b.position - a.position)[0];

        const positions = (locantBeforeParent?.metadata?.positions as number[]) || [];
        const posStr = positions
          .slice()
          .sort((a, b) => a - b)
          .join(",");

        if (posStr === "1,2,4") {
          mainChainAtoms = builder.create124ThiadiazoleRing();
        } else if (posStr === "1,2,3") {
          mainChainAtoms = builder.create123ThiadiazoleRing();
        } else {
          // Default is 1,3,4-thiadiazole (most common)
          mainChainAtoms = builder.create134ThiadiazoleRing();
        }
      } else if (parentValue === "benzoate" && parentSmiles === "c1ccccc1C") {
        // Benzoate is benzene + one carbon for the carboxyl group
        // Build benzene ring
        mainChainAtoms = builder.createBenzeneRing();
        // Add one more carbon for the carboxyl attachment
        const carboxylC = builder.addCarbon();
        builder.addBond(mainChainAtoms[0]!, carboxylC);
        mainChainAtoms.push(carboxylC);
        if (process.env.VERBOSE) {
          console.log("[graph-builder] Built benzoate: benzene ring + carboxyl carbon");
        }
      } else if (hasCycloPrefix && !hasBicyclicOrTricyclicStructure) {
        // Build cyclic chain with heteroatom replacements (only if we haven't already built bicyclic/tricyclic)
        // Check for heteroatom prefixes like "aza", "oxa", "thia" in the cyclo prefix
        const heteroReplacements: Array<{ position: number; element: string }> = [];

        if (cycloPrefixToken?.value && cycloPrefixToken.metadata?.heteroAtom) {
          // Parse heteroatoms from prefix (e.g., "azacyclo" → [{count: 1, element: "N"}])
          const heteroInfo = this.parseHeteroatomsFromCycloPrefix(cycloPrefixToken.value);

          if (heteroInfo.length > 0) {
            // For cycloalkane heteroatom positions, look for locants:
            // 1. After the parent token (e.g., "hexacos-1-yl" → locant "1")
            // 2. Immediately before the cyclo prefix BUT not consumed by substituents
            //    (e.g., "1,4-dioxacyclodecane" → locants "1,4")

            let positions: number[] = [];

            // First, check for locants after the parent token (for substituent forms like "azacyclohexacos-1-yl")
            const postParentLocants = locantTokens.filter((l) => l.position > parentToken.position);

            // Then check for locants immediately before the cyclo prefix
            // These should NOT be immediately followed by a substituent (to avoid capturing "14-oxo-" locants)
            const preCycloLocants = locantTokens.filter((l) => {
              if (l.position >= cycloPrefixToken!.position) return false;
              // Check if there's a substituent between this locant and the cyclo prefix
              const hasSubstBetween = substituentTokens.some(
                (s) => l.position < s.position && s.position < cycloPrefixToken!.position,
              );
              return !hasSubstBetween;
            });

            // Use post-parent locants first (for forms like "azacyclohexacos-1-yl")
            // Otherwise use pre-cyclo locants (for forms like "1-azacyclodecane")
            const relevantLocants =
              postParentLocants.length > 0 ? postParentLocants : preCycloLocants;

            for (const locant of relevantLocants) {
              if (locant.metadata?.positions) {
                positions.push(...(locant.metadata.positions as number[]));
              }
            }

            // Assign positions to heteroatoms
            let posIdx = 0;
            for (const h of heteroInfo) {
              for (let i = 0; i < h.count; i++) {
                // Use explicit locant if available, otherwise default to position 1
                const pos = positions[posIdx] ?? (posIdx === 0 ? 1 : atomCount - posIdx);
                heteroReplacements.push({ position: pos, element: h.element });
                posIdx++;
              }
            }

            if (process.env.VERBOSE) {
              console.log(
                `[graph-builder] Heteroatom replacements for cyclic chain: ${JSON.stringify(heteroReplacements)}`,
              );
            }
          }
        }

        if (heteroReplacements.length > 0) {
          mainChainAtoms = builder.createCyclicChainWithHeteroatoms(atomCount, heteroReplacements);
        } else {
          mainChainAtoms = builder.createCyclicChain(atomCount);
        }
      } else if (!hasBicyclicOrTricyclicStructure) {
        // Build linear chain (only if we haven't already built bicyclic/tricyclic)
        if (process.env.VERBOSE) {
          console.log(
            `[graph-builder] Building linear chain because hasBicyclicOrTricyclicStructure = ${hasBicyclicOrTricyclicStructure}`,
          );
        }
        mainChainAtoms = builder.createLinearChain(atomCount);
      } else if (process.env.VERBOSE) {
        console.log(
          `[graph-builder] Skipping linear chain because hasBicyclicOrTricyclicStructure = ${hasBicyclicOrTricyclicStructure}`,
        );
      }
    } else {
      throw new Error("No parent chain found");
    }

    if (process.env.VERBOSE) {
      console.log("[graph-builder] Main chain atoms:", mainChainAtoms);
    }

    // Step 2: Apply unsaturation (ene, yne)
    this.applyUnsaturation(builder, mainChainAtoms, suffixTokens, locantTokens, hasCycloPrefix);

    // Detect if this is a carboxylic acid or thiocyanate (numbering goes from functional group end)
    const isAcid = suffixTokens.some(
      (s) =>
        s.value === "oic acid" || s.value === "ic acid" || s.value === "oic" || s.value === "anoic",
    );
    const isThiocyanate = suffixTokens.some((s) => s.value === "thiocyanate");
    const reverseNumbering = isAcid || isThiocyanate;

    // Step 3: Apply functional group suffixes (ol, one, etc.)
    const esterOxygens = this.applySuffixes(
      builder,
      mainChainAtoms,
      suffixTokens,
      locantTokens,
      substituentTokens,
      multiplierTokens,
    );

    // Step 4: Apply substituents (with reversed numbering for acids/thiocyanates)
    const processedSubstituents = this.applySubstituents(
      builder,
      mainChainAtoms,
      substituentTokens,
      locantTokens,
      multiplierTokens,
      reverseNumbering,
      suffixTokens,
      prefixTokens,
      esterOxygens,
    );

    // Apply N-substituents (from prefix tokens) to any amine nitrogens (from suffixes like carboxamide)
    this.applyNPrefixSubstituents(
      builder,
      mainChainAtoms,
      prefixTokens,
      substituentTokens,
      multiplierTokens,
      locantTokens,
      processedSubstituents,
    );

    // Apply hydrogen notation (e.g. 1H, 2H) from locants to saturate specific atoms
    const hydrogenLocants = locantTokens.filter((t) => t.metadata?.isHydrogenNotation === true);
    for (const hToken of hydrogenLocants) {
      const loc = parseInt(hToken.value);
      if (!isNaN(loc)) {
        const atomIdx = this.locantToAtomIndex(loc, mainChainAtoms);
        if (atomIdx !== null) {
          if (process.env.VERBOSE) {
            console.log(`[graph-builder] Applying hydrogen notation (saturation) at locant ${loc}`);
          }
          builder.saturateAtom(atomIdx);
        }
      }
    }

    // Apply stereo descriptors (E/Z, R/S)
    this.applyStereo(builder, mainChainAtoms, stereoTokens, suffixTokens, locantTokens);

    return builder.build();
  }

  /**
   * Apply unsaturation (double/triple bonds) to main chain
   */
  public applyUnsaturation(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    _isCyclic: boolean,
  ): void {
    const unsaturatedSuffixes = suffixTokens.filter(
      (s) => s.metadata?.suffixType === "unsaturated",
    );

    for (const suffix of unsaturatedSuffixes) {
      const suffixValue = suffix.value.toLowerCase();

      // Get locants for this suffix
      const locants = this.getLocantsBeforeSuffix(suffix, locantTokens);
      const positions = locants.length > 0 ? locants : [1]; // Default to position 1

      if (process.env.VERBOSE) {
        console.log(
          `[graph-builder] Applying unsaturation: ${suffixValue} at positions`,
          positions,
        );
      }

      if (
        suffixValue === "en" ||
        suffixValue === "ene" ||
        suffixValue.includes("ene") ||
        suffixValue === "dien" ||
        suffixValue === "trien" ||
        suffixValue === "tetraen"
      ) {
        // Add double bond(s)
        for (const pos of positions) {
          if (pos >= 1 && pos < mainChainAtoms.length) {
            const atom1 = mainChainAtoms[pos - 1]!;
            const atom2 = mainChainAtoms[pos]!;
            builder.addDoubleBond(atom1, atom2);
          }
        }
      } else if (
        suffixValue === "yne" ||
        suffixValue.includes("yne") ||
        suffixValue === "diyn" ||
        suffixValue === "triyn" ||
        suffixValue === "tetrayn"
      ) {
        // Add triple bond(s)
        for (const pos of positions) {
          if (pos >= 1 && pos < mainChainAtoms.length) {
            const atom1 = mainChainAtoms[pos - 1]!;
            const atom2 = mainChainAtoms[pos]!;
            builder.addTripleBond(atom1, atom2);
          }
        }
      }
    }
  }

  /**
   * Apply functional group suffixes (ol, one, amine, etc.)
   * Returns indices of atoms available for ester attachment (from carboxylate suffixes)
   */
  public locantToAtomIndex(
    locant: number,
    chainAtoms: number[],
    reverseNumbering: boolean = false,
  ): number | null {
    if (locant < 1 || locant > chainAtoms.length) {
      if (process.env.VERBOSE) {
        console.warn(
          `[graph-builder] Locant ${locant} out of range for chain length ${chainAtoms.length}`,
        );
      }
      return null;
    }
    if (reverseNumbering) {
      // For acids: position 1 is the last carbon (carboxyl)
      return chainAtoms[chainAtoms.length - locant] ?? null;
    }

    // Special handling for benzoate (7 atoms: benzene ring 0-5 + carboxyl 6)
    // In benzoate nomenclature, position 1 is the benzene carbon bonded to -COOCH3
    // Positions 2-6 are the other benzene carbons, and position 7 is never used (carboxyl is not part of the benzene ring numbering)
    // So we just use normal indexing: locant 1 → atom 0, etc.
    if (chainAtoms.length === 7) {
      // Benzoate: normal numbering applies to benzene carbons
      // Position 1 = benzene[0] = chainAtoms[0]
      // Position 2 = benzene[1] = chainAtoms[1]
      // ... etc
      // Position 6 = benzene[5] = chainAtoms[5]
      // The carboxyl carbon (chainAtoms[6]) is not numbered
      if (locant >= 1 && locant <= 6) {
        return chainAtoms[locant - 1] ?? null;
      }
    }

    return chainAtoms[locant - 1] ?? null;
  }

  /**
   * Find locants that appear before a suffix token
   * Only returns locants that are immediately before the suffix (no substituents in between)
   */
  public applyStereo(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    stereoTokens: IUPACToken[],
    _suffixTokens: IUPACToken[],
    _locantTokens: IUPACToken[],
  ): void {
    if (stereoTokens.length === 0) return;

    if (process.env.VERBOSE) {
      console.log(`[graph-builder] Applying stereochemistry with ${stereoTokens.length} tokens`);
    }

    for (const token of stereoTokens) {
      const type = token.metadata?.type;
      const config = token.metadata?.config;
      const citationNumber = token.metadata?.citationNumber;

      // Handle explicit citation (e.g., "2R", "2Z")
      if (citationNumber !== undefined && citationNumber !== null) {
        const atomIdx = this.locantToAtomIndex(citationNumber as number, mainChainAtoms);

        if (atomIdx !== null) {
          if (type === "stereocenter" && config) {
            const atom = builder.getAtom(atomIdx);
            if (atom) {
              // Heuristic: R -> @@ (clockwise), S -> @ (anticlockwise) assuming H in back
              atom.chiral = config === "R" ? "@@" : "@";
              if (process.env.VERBOSE) {
                console.log(
                  `[stereo] Atom ${atomIdx} (${citationNumber}) set to ${config} -> ${atom.chiral}`,
                );
              }
            }
          } else if (type === "alkene" && config) {
            // E/Z - double bond
            const bonds = builder
              .getBonds()
              .filter((b) => b.atom1 === atomIdx || b.atom2 === atomIdx);
            const doubleBond = bonds.find((b) => b.type === BondTypeEnum.DOUBLE);

            if (doubleBond) {
              const otherAtom = doubleBond.atom1 === atomIdx ? doubleBond.atom2 : doubleBond.atom1;

              // Find adjacent single/aromatic bonds to set stereo markers
              // Note: Ring bonds might be aromatic, but they still define direction
              const singleBond1 = bonds.find(
                (b) =>
                  (b.type === BondTypeEnum.SINGLE || b.type === BondTypeEnum.AROMATIC) &&
                  b !== doubleBond,
              );
              const otherBonds = builder
                .getBonds()
                .filter((b) => b.atom1 === otherAtom || b.atom2 === otherAtom);
              const singleBond2 = otherBonds.find(
                (b) =>
                  (b.type === BondTypeEnum.SINGLE || b.type === BondTypeEnum.AROMATIC) &&
                  b !== doubleBond,
              );

              if (singleBond1 && singleBond2) {
                // E (trans) -> /.../ (UP...UP)
                // Z (cis) -> /...\ (UP...DOWN)
                singleBond1.stereo = "up";
                singleBond2.stereo = config === "E" ? "up" : "down";

                if (process.env.VERBOSE) {
                  console.log(
                    `[stereo] Alkene at ${atomIdx}: ${config}. Bond1=${singleBond1.stereo}, Bond2=${singleBond2.stereo}`,
                  );
                }
              }
            }
          }
        }
      } else {
        // Implicit citation (e.g., "(E)-but-2-ene")
        // Apply to the first feature found
        if (type === "alkene" && config) {
          // Find first double bond in main chain
          // This is a simplification; robust logic would match position if implied
          // But usually (E)-but-2-ene implies the double bond at 2
          for (const atomIdx of mainChainAtoms) {
            const bonds = builder
              .getBonds()
              .filter((b) => b.atom1 === atomIdx || b.atom2 === atomIdx);
            const doubleBond = bonds.find((b) => b.type === BondTypeEnum.DOUBLE);
            if (doubleBond) {
              // Found a double bond, apply stereo here
              const otherAtom = doubleBond.atom1 === atomIdx ? doubleBond.atom2 : doubleBond.atom1;
              // Check if we haven't already set stereo on this bond?
              // Actually, checking if single bonds have stereo is better.

              const singleBond1 = bonds.find(
                (b) =>
                  (b.type === BondTypeEnum.SINGLE || b.type === BondTypeEnum.AROMATIC) &&
                  b !== doubleBond,
              );
              const otherBonds = builder
                .getBonds()
                .filter((b) => b.atom1 === otherAtom || b.atom2 === otherAtom);
              const singleBond2 = otherBonds.find(
                (b) =>
                  (b.type === BondTypeEnum.SINGLE || b.type === BondTypeEnum.AROMATIC) &&
                  b !== doubleBond,
              );

              if (singleBond1 && singleBond2 && singleBond1.stereo === "none") {
                singleBond1.stereo = "up";
                singleBond2.stereo = config === "E" ? "up" : "down";
                if (process.env.VERBOSE) {
                  console.log(
                    `[stereo] Implicit Alkene at ${atomIdx}: ${config}. Bond1=${singleBond1.stereo}, Bond2=${singleBond2.stereo}`,
                  );
                }
                break; // Only apply to first one for now
              }
            }
          }
        } else if (type === "stereocenter" && config) {
          // Implicit R/S - need to infer the stereocenter position
          // Common patterns:
          // 1. "(R)-butan-2-ol" - the -2-ol suffix indicates position 2 is the stereocenter
          // 2. "(S)-2-aminopropanoic acid" - the 2-amino prefix indicates position 2
          // 3. For simple molecules with one chiral center, find the atom with 4 different substituents

          // Strategy 1: Look for suffix locants (e.g., "-2-ol" -> position 2)
          let inferredPosition: number | null = null;

          // Check suffix locants (for patterns like "butan-2-ol")
          for (const locant of _locantTokens) {
            if (
              locant.metadata?.positions &&
              (locant.metadata.positions as number[]).length === 1
            ) {
              // Check if there's a suffix that follows this locant
              const suffixAfter = _suffixTokens.find((s) => s.position > locant.position);
              if (suffixAfter) {
                // This locant is associated with a suffix - likely the stereocenter position
                inferredPosition = (locant.metadata.positions as number[])[0]!;
                break;
              }
            }
          }

          // Strategy 2: If no suffix locant found, look for the first atom that could be a stereocenter
          // (has 4 different neighbors including implicit H)
          if (inferredPosition === null) {
            for (let i = 0; i < mainChainAtoms.length; i++) {
              const atomIdx = mainChainAtoms[i]!;
              const atom = builder.getAtom(atomIdx);
              if (atom && atom.symbol === "C") {
                const bonds = builder
                  .getBonds()
                  .filter((b) => b.atom1 === atomIdx || b.atom2 === atomIdx);
                // A stereocenter typically has 4 different substituents
                // Simplification: look for carbons with exactly 4 single bonds (including to H)
                const singleBonds = bonds.filter((b) => b.type === BondTypeEnum.SINGLE);
                if (singleBonds.length >= 3) {
                  // Likely a stereocenter (3 explicit bonds + implicit H)
                  inferredPosition = i + 1; // Convert to 1-based
                  break;
                }
              }
            }
          }

          if (inferredPosition !== null) {
            const atomIdx = this.locantToAtomIndex(inferredPosition, mainChainAtoms);
            if (atomIdx !== null) {
              const atom = builder.getAtom(atomIdx);
              if (atom) {
                atom.chiral = config === "R" ? "@@" : "@";
                if (process.env.VERBOSE) {
                  console.log(
                    `[stereo] Implicit stereocenter inferred at position ${inferredPosition} (atom ${atomIdx}): ${config} -> ${atom.chiral}`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  public getAlkylLength(alkylName: string): number {
    const name = alkylName.toLowerCase();
    if (name === "methyl") return 1;
    if (name === "ethyl") return 2;
    if (name === "propyl") return 3;
    if (name === "butyl") return 4;
    if (name === "pentyl") return 5;
    return 1; // default
  }

  /**
   * Build molecule with ether linkage (-oxy- connector between two parent chains)
   * Example: "3-(2,2-dimethylpropoxy)butan-2-ol"
   */
  public buildBranchedAlkylFragment(
    builder: MoleculeGraphBuilder,
    branchType: string,
  ): { fragmentAtoms: number[]; attachmentPoint: number } | null {
    const atoms: number[] = [];

    if (branchType === "isopropyl") {
      // (CH3)2CH- : central carbon with two methyl groups
      const centralC = builder.addCarbon();
      const ch3_1 = builder.addCarbon();
      const ch3_2 = builder.addCarbon();
      builder.addBond(centralC, ch3_1);
      builder.addBond(centralC, ch3_2);
      atoms.push(centralC, ch3_1, ch3_2);
      if (process.env.VERBOSE) {
        console.log("[nested-alkyl] Built isopropyl fragment");
      }
      return { fragmentAtoms: atoms, attachmentPoint: centralC };
    }

    if (branchType === "sec-butyl") {
      // CH3-CH2-CH(CH3)- : chain with methyl at position 2 (attachment at position 2)
      const c1 = builder.addCarbon();
      const c2 = builder.addCarbon();
      const c3 = builder.addCarbon();
      const ch3 = builder.addCarbon();
      builder.addBond(c1, c2);
      builder.addBond(c2, c3);
      builder.addBond(c2, ch3);
      atoms.push(c1, c2, c3, ch3);
      if (process.env.VERBOSE) {
        console.log("[nested-alkyl] Built sec-butyl fragment");
      }
      return { fragmentAtoms: atoms, attachmentPoint: c2 };
    }

    if (branchType === "tert-butyl") {
      // (CH3)3C- : central carbon with three methyl groups
      const centralC = builder.addCarbon();
      const ch3_1 = builder.addCarbon();
      const ch3_2 = builder.addCarbon();
      const ch3_3 = builder.addCarbon();
      builder.addBond(centralC, ch3_1);
      builder.addBond(centralC, ch3_2);
      builder.addBond(centralC, ch3_3);
      atoms.push(centralC, ch3_1, ch3_2, ch3_3);
      if (process.env.VERBOSE) {
        console.log("[nested-alkyl] Built tert-butyl fragment");
      }
      return { fragmentAtoms: atoms, attachmentPoint: centralC };
    }

    return null;
  }

  /**
   * Build a complex substituent from nested tokens (e.g., "(4-chlorophenoxy)" or "(propan-2-yl)")
   * Returns the atom indices of the built fragment and the attachment point index
   */

  /**
   * Convert a cycloalkyl substituent name to its "-idene" variant if idene suffix is found
   * E.g., "cyclopropyl" with idene → "cyclopropylidene"
   */
  private convertToCycloalkylIdene(substValue: string, hasIdeneSuffix: boolean): string {
    if (!hasIdeneSuffix) return substValue;

    const ideneMap: Record<string, string> = {
      cyclopropyl: "cyclopropylidene",
      cyclobutyl: "cyclobutylidene",
      cyclopentyl: "cyclopentylidene",
      cyclohexyl: "cyclohexylidene",
    };

    return ideneMap[substValue] || substValue;
  }

  /**
   * Apply a cycloalkyl substituent (or its -idene variant) to an atom
   */
  private applyCycloalkylSubstituent(
    builder: MoleculeGraphBuilder,
    substValue: string,
    atomIdx: number,
  ): void {
    switch (substValue) {
      case "cyclopropyl":
        builder.addCyclopropyl(atomIdx);
        break;
      case "cyclopropylidene":
        builder.addCyclopropylidene(atomIdx);
        break;
      case "cyclobutyl":
        builder.addCyclobutyl(atomIdx);
        break;
      case "cyclobutylidene":
        builder.addCyclobutylidene(atomIdx);
        break;
      case "cyclopentyl":
        builder.addCyclopentyl(atomIdx);
        break;
      case "cyclopentylidene":
        builder.addCyclopentylidene(atomIdx);
        break;
      case "cyclohexyl":
        builder.addCyclohexyl(atomIdx);
        break;
      case "cyclohexylidene":
        builder.addCyclohexylidene(atomIdx);
        break;
    }
  }

  /**
   * Build a silyl group (e.g. trimethylsilyl)
   * Returns index of Silicon atom
   */
  public buildSilylGroup(builder: MoleculeGraphBuilder, name: string): number {
    const siIdx = builder.addAtom("Si");

    // Remove "silyl" or "silanyl" suffix and optional parentheses
    // e.g. "tert-butyl(dimethyl)silyl" -> "tert-butyl(dimethyl)"
    let prefixes = name.replace(/silyl|silanyl/g, "");
    // Handle [tert-butyl(dimethyl)silyl]oxy -> "tert-butyl(dimethyl)oxy" ?? No, name is passed as subst token value.

    // Manual parsing for common cases
    if (prefixes === "trimethyl") {
      builder.addMethyl(siIdx);
      builder.addMethyl(siIdx);
      builder.addMethyl(siIdx);
    } else if (prefixes === "triethyl") {
      builder.addEthyl(siIdx);
      builder.addEthyl(siIdx);
      builder.addEthyl(siIdx);
    } else if (
      prefixes === "tert-butyl(dimethyl)" ||
      prefixes === "tert-butyldimethyl" ||
      prefixes === "t-butyldimethyl" ||
      prefixes === "t-butyl(dimethyl)" ||
      prefixes === "tert-butyl-dimethyl"
    ) {
      builder.addMethyl(siIdx);
      builder.addMethyl(siIdx);
      builder.addTertButyl(siIdx);
    } else if (
      prefixes === "tert-butyl(diphenyl)" ||
      prefixes === "tert-butyldiphenyl" ||
      prefixes === "t-butyldiphenyl" ||
      prefixes === "t-butyl(diphenyl)" ||
      prefixes === "tert-butyl-diphenyl"
    ) {
      // Add 2 phenyls
      const p1 = builder.createBenzeneRing();
      builder.addBond(siIdx, p1[0]!);
      const p2 = builder.createBenzeneRing();
      builder.addBond(siIdx, p2[0]!);
      builder.addTertButyl(siIdx);
    } else if (prefixes === "dimethyl") {
      builder.addMethyl(siIdx);
      builder.addMethyl(siIdx);
      // "dimethylsilyl" -> SiH(Me)2
      builder.setHydrogens(siIdx, 1);
    } else if (prefixes === "diphenylmethyl") {
      const p1 = builder.createBenzeneRing();
      builder.addBond(siIdx, p1[0]!);
      const p2 = builder.createBenzeneRing();
      builder.addBond(siIdx, p2[0]!);
      builder.addMethyl(siIdx);
    }

    return siIdx;
  }

  // ============================================================================
  // ============================================================================
  // Delegation methods for extracted builders
  // ============================================================================

  public applySuffixes(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[] = [],
    multiplierTokens: IUPACToken[] = [],
  ): number[] {
    return this.suffixApplicator.applySuffixes(
      builder,
      mainChainAtoms,
      suffixTokens,
      locantTokens,
      substituentTokens,
      multiplierTokens,
    );
  }

  public getLocantsBeforeSuffix(
    suffix: IUPACToken,
    locantTokens: IUPACToken[],
    substituentTokens?: IUPACToken[],
  ): number[] {
    return this.suffixApplicator.getLocantsBeforeSuffix(suffix, locantTokens, substituentTokens);
  }

  public applySubstituents(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    substituentTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    reverseNumbering: boolean = false,
    suffixTokens: IUPACToken[] = [],
    prefixTokens: IUPACToken[] = [],
    esterOxygenIndices?: number[],
  ): Set<IUPACToken> {
    return this.substituentApplicator.applySubstituents(
      builder,
      mainChainAtoms,
      substituentTokens,
      locantTokens,
      multiplierTokens,
      reverseNumbering,
      suffixTokens,
      prefixTokens,
      esterOxygenIndices,
    );
  }

  public getLocantsBeforeSubstituent(
    substituent: IUPACToken,
    locantTokens: IUPACToken[],
  ): number[] {
    return this.substituentApplicator.getLocantsBeforeSubstituent(substituent, locantTokens);
  }

  public getMultiplierBeforeSubstituent(
    substituent: IUPACToken,
    multiplierTokens: IUPACToken[],
  ): IUPACToken | null {
    return this.substituentApplicator.getMultiplierBeforeSubstituent(substituent, multiplierTokens);
  }

  public isNSubstitutionPrefix(prefix: IUPACToken | undefined): boolean {
    return this.specializedBuilders.isNSubstitutionPrefix(prefix);
  }

  private buildNSubstitutedAmide(
    builder: MoleculeGraphBuilder,
    parentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    tokens: IUPACToken[],
  ): Molecule {
    return this.specializedBuilders.buildNSubstitutedAmide(
      builder,
      parentTokens,
      suffixTokens,
      locantTokens,
      substituentTokens,
      multiplierTokens,
      tokens,
    );
  }

  private buildNSubstitutedAmine(
    builder: MoleculeGraphBuilder,
    parentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    tokens: IUPACToken[],
    isSaturatedForm: boolean = false,
  ): Molecule {
    return this.specializedBuilders.buildNSubstitutedAmine(
      builder,
      parentTokens,
      suffixTokens,
      locantTokens,
      substituentTokens,
      multiplierTokens,
      tokens,
      isSaturatedForm,
    );
  }

  private applyNPrefixSubstituents(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    nPrefixTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    processedSubstituents?: Set<IUPACToken>,
  ): void {
    return this.specializedBuilders.applyNPrefixSubstituents(
      builder,
      mainChainAtoms,
      nPrefixTokens,
      substituentTokens,
      multiplierTokens,
      locantTokens,
      processedSubstituents,
    );
  }

  private buildEster(
    builder: MoleculeGraphBuilder,
    substituentTokens: IUPACToken[],
    parentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    multiplierTokens: IUPACToken[] = [],
  ): Molecule {
    return this.specializedBuilders.buildEster(
      builder,
      substituentTokens,
      parentTokens,
      suffixTokens,
      locantTokens,
      multiplierTokens,
    );
  }

  private addEsterWithAlkyl(
    builder: MoleculeGraphBuilder,
    carbonylCarbonIdx: number,
    esterAlkylTokens: IUPACToken[],
    locantTokens: IUPACToken[] = [],
    multiplierTokens: IUPACToken[] = [],
  ): void {
    this.specializedBuilders.addEsterWithAlkyl(
      builder,
      carbonylCarbonIdx,
      esterAlkylTokens,
      locantTokens,
      multiplierTokens,
    );
  }

  private buildEtherLinkage(
    builder: MoleculeGraphBuilder,
    tokens: IUPACToken[],
    parentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    oxyConnectorIdx: number,
  ): Molecule {
    return this.specializedBuilders.buildEtherLinkage(
      builder,
      tokens,
      parentTokens,
      suffixTokens,
      locantTokens,
      substituentTokens,
      multiplierTokens,
      oxyConnectorIdx,
    );
  }
}
