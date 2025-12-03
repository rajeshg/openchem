import type { Molecule, Atom, Bond } from "types";
import type { IUPACToken } from "./iupac-types";
import { MoleculeGraphBuilder } from "../molecule-graph-builder";
import { BondType as BondTypeEnum } from "types";
import type { IUPACSubstituentApplicator } from "./iupac-substituent-applicator";

export interface IUPACSpecializedContext {
  locantToAtomIndex(
    locant: number,
    chainAtoms: number[],
    reverseNumbering?: boolean,
  ): number | null;
  getLocantsBeforeSubstituent(substituent: IUPACToken, locantTokens: IUPACToken[]): number[];
  getMultiplierBeforeSubstituent(
    substituent: IUPACToken,
    multiplierTokens: IUPACToken[],
  ): IUPACToken | null;
  getAlkylLength(alkylName: string): number;
  applySuffixes(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens?: IUPACToken[],
    multiplierTokens?: IUPACToken[],
  ): number[];
  applyUnsaturation(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    _isCyclic: boolean,
  ): void;
  substituentApplicator: IUPACSubstituentApplicator;
  nestedBuilder: {
    buildNestedSubstituent(
      builder: MoleculeGraphBuilder,
      nestedTokens: IUPACToken[],
    ): { fragmentAtoms: number[]; attachmentPoint: number } | null;
  };
}

export class IUPACSpecializedBuilders {
  private context: IUPACSpecializedContext;

  constructor(context: IUPACSpecializedContext) {
    this.context = context;
  }

  public isNSubstitutionPrefix(prefix: IUPACToken | undefined): boolean {
    if (!prefix) return false;
    // Match: n, n,n, n,n,3, n,o, etc. (starts with n and contains at least one n)
    return prefix.value.startsWith("n");
  }

  /**
   * Build molecule from organized token groups
   */
  public buildNSubstitutedAmide(
    builder: MoleculeGraphBuilder,
    parentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    prefixTokens: IUPACToken[],
  ): Molecule {
    const nPrefixToken = prefixTokens.find((p) => this.isNSubstitutionPrefix(p));
    if (!nPrefixToken) {
      throw new Error("N-prefix not found for amide");
    }

    // Build parent chain
    const parentToken = parentTokens[0]!;
    const atomCount = (parentToken.metadata?.atomCount as number) || 0;
    const mainChainAtoms = builder.createLinearChain(atomCount);

    // Add amide group to terminal carbon
    const terminalIdx = mainChainAtoms[mainChainAtoms.length - 1];
    if (terminalIdx === undefined) {
      throw new Error("No terminal carbon for amide");
    }

    const nitrogenIdx = builder.addAmide(terminalIdx);

    if (process.env.VERBOSE) {
      console.log("[n-amide] N-prefix:", nPrefixToken.value);
      console.log("[n-amide] Nitrogen index:", nitrogenIdx);
    }

    // Separate N-substituents (after N-prefix) from carbon substituents (before N-prefix)
    const nSubstituents = substituentTokens.filter((s) => s.position > nPrefixToken.position);
    const carbonSubstituents = substituentTokens.filter((s) => s.position < nPrefixToken.position);

    if (process.env.VERBOSE) {
      console.log(
        "[n-amide] N-substituents:",
        nSubstituents.map((s) => s.value),
      );
      console.log(
        "[n-amide] Carbon substituents:",
        carbonSubstituents.map((s) => s.value),
      );
    }

    // Add N-substituents to the nitrogen
    for (const nSubst of nSubstituents) {
      const substValue = nSubst.value.toLowerCase();

      // Check for multiplier before this substituent
      const multiplierBefore = multiplierTokens.find(
        (m) => m.position > nPrefixToken.position && m.position < nSubst.position,
      );
      const count = multiplierBefore ? (multiplierBefore.metadata?.count as number) || 1 : 1;

      if (process.env.VERBOSE) {
        console.log(`[n-amide] Adding ${count}x ${substValue} to nitrogen`);
      }

      // Add substituent 'count' times
      for (let i = 0; i < count; i++) {
        if (substValue === "methyl") {
          builder.addMethyl(nitrogenIdx);
        } else if (substValue === "ethyl") {
          builder.addEthyl(nitrogenIdx);
        } else if (substValue === "propyl") {
          builder.addAlkylSubstituent(nitrogenIdx, 3);
        } else if (substValue === "isopropyl" || substValue === "propan-2-yl") {
          builder.addIsopropyl(nitrogenIdx);
        } else if (substValue === "tert-butyl" || substValue === "tertbutyl") {
          builder.addTertButyl(nitrogenIdx);
        } else if (substValue === "phenyl") {
          // Add benzene ring
          const benzeneAtoms = builder.createBenzeneRing();
          if (benzeneAtoms[0] !== undefined) {
            builder.addBond(nitrogenIdx, benzeneAtoms[0]);
          }
        } else if (substValue === "formyl") {
          builder.addFormyl(nitrogenIdx);
        } else if (substValue === "hydroxymethyl") {
          builder.addHydroxymethyl(nitrogenIdx);
        }
      }
    }

    // Add carbon substituents to the main chain
    if (carbonSubstituents.length > 0) {
      const carbonLocants = locantTokens.filter((l) => l.position < nPrefixToken.position);
      const carbonMultipliers = multiplierTokens.filter((m) => m.position < nPrefixToken.position);
      this.context.substituentApplicator.applySubstituents(
        builder,
        mainChainAtoms,
        carbonSubstituents,
        carbonLocants,
        carbonMultipliers,
        true,
        suffixTokens,
        prefixTokens,
      );
    }

    return builder.build();
  }

  /**
   * Build N-substituted amine (e.g., "N,N-dimethylethanamine")
   * Pattern: N-substituents + parent + amine suffix
   */
  public buildNSubstitutedAmine(
    builder: MoleculeGraphBuilder,
    parentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    prefixTokens: IUPACToken[],
    isSaturatedForm: boolean = false,
  ): Molecule {
    const nPrefixToken = prefixTokens.find((p) => this.isNSubstitutionPrefix(p));
    if (!nPrefixToken) {
      throw new Error("N-prefix not found for amine");
    }

    // Build parent chain - handle both linear and ring systems
    const parentToken = parentTokens[0]!;
    const parentValue = parentToken.value.toLowerCase();
    const atomCount = (parentToken.metadata?.atomCount as number) || 0;
    const parentSmiles = (parentToken.metadata?.smiles as string) || "";

    let mainChainAtoms: number[] = [];

    // Check for ring systems first
    if (
      parentValue === "thiazole" ||
      parentValue === "thiazol" ||
      parentSmiles === "c1cscn1" ||
      parentSmiles === "c1scnc1"
    ) {
      // Use saturated form when indicated (e.g., "4H-1,3-thiazole")
      if (isSaturatedForm) {
        mainChainAtoms = builder.createThiazoleSaturated();
        if (process.env.VERBOSE) {
          console.log("[n-amine] Creating SATURATED thiazole ring");
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
          console.log("[n-amine] Creating SATURATED oxazole ring");
        }
      } else {
        mainChainAtoms = builder.createOxazoleRing();
      }
    } else if (
      parentValue === "imidazole" ||
      parentValue === "imidazol" ||
      parentSmiles === "c1c[nH]cn1" ||
      parentSmiles === "c1cncc[nH]1"
    ) {
      if (isSaturatedForm) {
        mainChainAtoms = builder.createImidazoleSaturated();
        if (process.env.VERBOSE) {
          console.log("[n-amine] Creating SATURATED imidazole ring");
        }
      } else {
        mainChainAtoms = builder.createImidazoleRing();
      }
    } else if (
      parentValue === "pyrrole" ||
      parentValue === "pyrrol" ||
      parentSmiles === "c1cc[nH]c1" ||
      parentSmiles === "[nH]1cccc1"
    ) {
      mainChainAtoms = builder.createPyrroleRing();
    } else if (parentValue === "pyridine" || parentSmiles === "c1ccncc1") {
      mainChainAtoms = builder.createPyridineRing();
    } else if (parentValue === "benzene" || parentValue === "benz" || parentSmiles === "c1ccccc1") {
      mainChainAtoms = builder.createBenzeneRing();
    } else {
      // Linear alkane chain (default case)
      mainChainAtoms = builder.createLinearChain(atomCount);
    }

    if (process.env.VERBOSE) {
      console.log("[n-amine] Created main chain:", mainChainAtoms);
    }

    // Determine where to add the amine group(s)
    // For terminal amines, default is position 1 (index 0)
    // For diamines/triamines, extract all locants
    const amineSuffix = suffixTokens.find((s) => s.value === "amine" || s.value === "amin");

    // Extract all amine positions (for diamines, triamines, etc.)
    const amineSiteIndices: number[] = [];

    // Default: add single amine at position 1 (index 0)
    amineSiteIndices.push(0);

    if (amineSuffix && locantTokens.length > 0) {
      // First check for locants BEFORE the amine suffix (for locant structures like "ethane-1,2-diamine")
      // These locants typically come after the parent but before/around the amine suffix
      const beforeAmineSuffixLocants = locantTokens.filter(
        (l) => l.position < amineSuffix.position,
      );

      // Also check for locants AFTER the amine suffix in case of alternate tokenizations
      const afterAmineSuffixLocants = locantTokens.filter((l) => l.position > amineSuffix.position);

      const allAmineSuffixLocants = [...beforeAmineSuffixLocants, ...afterAmineSuffixLocants];

      // Filter to get locants that are not substituent-related
      // (i.e., not locants associated with carbon substituents before the N-prefix)
      const relevantLocants = allAmineSuffixLocants.filter((l) => {
        // Skip locants that come before all substituents (likely for carbon chain)
        if (substituentTokens.length > 0) {
          const firstSubstituent = substituentTokens[0]!;
          return l.position > firstSubstituent.position;
        }
        return true;
      });

      if (relevantLocants.length > 0) {
        // Parse the locant value(s)
        // Could be single "1" or multiple "1,2" or "1,2,3"
        const lastRelevantLocant = relevantLocants[relevantLocants.length - 1]!;
        const locantValue = lastRelevantLocant.value.toLowerCase();

        // Split comma-separated locants
        const locantParts = locantValue.split(",");
        const parsedLocants: number[] = [];

        for (const part of locantParts) {
          const locantNum = parseInt(part.trim(), 10);
          if (!isNaN(locantNum)) {
            parsedLocants.push(locantNum);
          }
        }

        if (parsedLocants.length > 0) {
          // Replace default with actual locants
          amineSiteIndices.length = 0;

          for (const locantNum of parsedLocants) {
            const idx = this.context.locantToAtomIndex(locantNum, mainChainAtoms);
            if (idx !== null) {
              amineSiteIndices.push(idx);
              if (process.env.VERBOSE) {
                console.log(`[n-amine] Added amine site at locant ${locantNum} (index ${idx})`);
              }
            }
          }
        }
      }
    }

    if (amineSiteIndices.length === 0) {
      throw new Error("No sites for amine");
    }

    if (process.env.VERBOSE) {
      console.log("[n-amine] Amine sites:", amineSiteIndices);
    }

    // Add amines at all positions
    const nitrogenIndices: number[] = [];
    for (const siteIdx of amineSiteIndices) {
      const nIdx = builder.addAmine(siteIdx);
      nitrogenIndices.push(nIdx);
      if (process.env.VERBOSE) {
        console.log(`[n-amine] Added nitrogen at site ${siteIdx} -> N-index ${nIdx}`);
      }
    }

    if (process.env.VERBOSE) {
      console.log("[n-amine] N-prefix:", nPrefixToken.value);
      console.log("[n-amine] Nitrogen indices:", nitrogenIndices);
    }

    // Separate N-substituents (in parentheses after N-prefix) from carbon substituents
    // N-substituents are those in the N-(...) pattern
    // The key: if a substituent is in parentheses AND comes after N-prefix, it's an N-substituent
    const nSubstituents = substituentTokens.filter((s) => {
      // N-substituents must come after the N-prefix
      if (s.position <= nPrefixToken.position) {
        return false;
      }
      // Check if this substituent is part of the N-(...) parenthetical group
      // A substituent is an N-substituent if:
      // 1. It's in parentheses after N-, OR
      // 2. It comes before any locant that comes after N- (meaning it's part of the N-group)
      if (s.isInParentheses) {
        if (process.env.VERBOSE) {
          console.log(`[n-amine] ${s.value} is in parentheses -> N-substituent`);
        }
        return true;
      }
      // Check if this substituent is followed by an -idene or -ylidene suffix
      // If so, it's a carbon substituent at a specific ring position (e.g., "methylidene" at pos 5)
      const ideneOrYlideneSuffix = suffixTokens.find(
        (suffix) =>
          (suffix.value === "idene" || suffix.value === "ylidene") &&
          suffix.position > s.position &&
          !substituentTokens.some((x) => x.position > s.position && x.position < suffix.position),
      );
      if (ideneOrYlideneSuffix) {
        if (process.env.VERBOSE) {
          console.log(
            `[n-amine] ${s.value} has ${ideneOrYlideneSuffix.value} suffix -> carbon substituent`,
          );
        }
        return false;
      }

      // Check if there's a locant between N-prefix and this substituent
      const locantsAfterNPrefix = locantTokens.filter((l) => l.position > nPrefixToken.position);
      if (locantsAfterNPrefix.length === 0) {
        // No locants after N-prefix, so all substituents after N are N-substituents
        if (process.env.VERBOSE) {
          console.log(`[n-amine] ${s.value} has no locant after N-prefix -> N-substituent`);
        }
        return true;
      }
      // There are locants after N-prefix. Check if this substituent comes before the first one.
      const firstLocantAfterN = locantsAfterNPrefix[0]!;
      const isBeforeLocant = s.position < firstLocantAfterN.position;
      if (process.env.VERBOSE) {
        console.log(
          `[n-amine] ${s.value} position=${s.position}, firstLocant=${firstLocantAfterN.value} position=${firstLocantAfterN.position}, isBeforeLocant=${isBeforeLocant}`,
        );
      }
      return isBeforeLocant;
    });

    const carbonSubstituents = substituentTokens.filter((s) => !nSubstituents.includes(s));

    if (process.env.VERBOSE) {
      console.log(
        "[n-amine] N-substituents:",
        nSubstituents.map((s) => s.value),
      );
      console.log(
        "[n-amine] Carbon substituents:",
        carbonSubstituents.map((s) => s.value),
      );
    }

    // Add N-substituents to each nitrogen
    // For N,N'-disub pattern: "di" means ONE substituent per N (2 total)
    // For N-di-sub pattern: "di" means TWO substituents on ONE N
    // We need to check if this is N,N' (multiple nitrogens) or N-sub (single nitrogen)
    const hasMultipleNitrogens = nitrogenIndices.length > 1;

    if (hasMultipleNitrogens) {
      // For diamines/polyamines: each substituent with "di"/"bis" means one per nitrogen
      for (const nitrogenIdx of nitrogenIndices) {
        for (const nSubst of nSubstituents) {
          const substValue = nSubst.value.toLowerCase();

          if (process.env.VERBOSE) {
            console.log(`[n-amine] Adding 1x ${substValue} to nitrogen ${nitrogenIdx}`);
          }

          // Add substituent ONCE per nitrogen (multiplier is already accounted for by having multiple N's)
          if (substValue === "methyl") {
            builder.addMethyl(nitrogenIdx);
          } else if (substValue === "ethyl") {
            builder.addEthyl(nitrogenIdx);
          } else if (substValue === "propyl") {
            builder.addAlkylSubstituent(nitrogenIdx, 3);
          } else if (substValue === "isopropyl" || substValue === "propan-2-yl") {
            builder.addIsopropyl(nitrogenIdx);
          } else if (substValue === "tert-butyl" || substValue === "tertbutyl") {
            builder.addTertButyl(nitrogenIdx);
          } else if (substValue === "phenyl") {
            // Add benzene ring
            const benzeneAtoms = builder.createBenzeneRing();
            if (benzeneAtoms[0] !== undefined) {
              builder.addBond(nitrogenIdx, benzeneAtoms[0]);
            }
          } else if (substValue === "formyl") {
            builder.addFormyl(nitrogenIdx);
          } else if (substValue === "hydroxymethyl") {
            builder.addHydroxymethyl(nitrogenIdx);
          }
        }
      }
    } else {
      // Single nitrogen: respect multiplier counts for multiple substituents
      const nitrogenIdx = nitrogenIndices[0]!;
      for (const nSubst of nSubstituents) {
        const substValue = nSubst.value.toLowerCase();

        // Check for multiplier before this substituent
        const multiplierBefore = multiplierTokens.find(
          (m) => m.position > nPrefixToken.position && m.position < nSubst.position,
        );
        const count = multiplierBefore ? (multiplierBefore.metadata?.count as number) || 1 : 1;

        if (process.env.VERBOSE) {
          console.log(`[n-amine] Adding ${count}x ${substValue} to nitrogen ${nitrogenIdx}`);
        }

        // Add substituent 'count' times
        for (let i = 0; i < count; i++) {
          // Check if this is a nested/complex substituent (e.g., "3-chloro-4-fluorophenyl")
          if (nSubst.nestedTokens && nSubst.nestedTokens.length > 0) {
            // Build the nested substituent and attach it
            const nestedResult = this.context.nestedBuilder.buildNestedSubstituent(
              builder,
              nSubst.nestedTokens,
            );

            if (nestedResult) {
              const attachmentPoint = nestedResult.attachmentPoint;
              builder.addBond(nitrogenIdx, attachmentPoint);

              if (process.env.VERBOSE) {
                console.log(`[n-amine] Attached nested substituent: ${substValue}`);
              }
            }
          } else if (substValue === "methyl") {
            builder.addMethyl(nitrogenIdx);
          } else if (substValue === "ethyl") {
            builder.addEthyl(nitrogenIdx);
          } else if (substValue === "propyl") {
            builder.addAlkylSubstituent(nitrogenIdx, 3);
          } else if (substValue === "isopropyl" || substValue === "propan-2-yl") {
            builder.addIsopropyl(nitrogenIdx);
          } else if (substValue === "tert-butyl" || substValue === "tertbutyl") {
            builder.addTertButyl(nitrogenIdx);
          } else if (substValue === "phenyl") {
            // Add benzene ring
            const benzeneAtoms = builder.createBenzeneRing();
            if (benzeneAtoms[0] !== undefined) {
              builder.addBond(nitrogenIdx, benzeneAtoms[0]);
            }
          } else if (substValue === "formyl") {
            builder.addFormyl(nitrogenIdx);
          } else if (substValue === "hydroxymethyl") {
            builder.addHydroxymethyl(nitrogenIdx);
          }
        }
      }
    }

    // Add carbon substituents to the main chain
    if (carbonSubstituents.length > 0) {
      // Carbon substituents can have locants before OR after N-prefix
      // Those before N- apply directly, those after N- apply to the ring
      const carbonLocants = locantTokens.filter((l) => {
        // Include locants before N-prefix (regular carbon locants)
        if (l.position < nPrefixToken.position) {
          return true;
        }
        // Include locants after N-prefix that are for substituents (not for amine positions)
        if (l.position > nPrefixToken.position) {
          // Check if there's a substituent IMMEDIATELY after this locant
          // If so, this locant is for that substituent, not for amine position
          const followingSubstituent = carbonSubstituents.find(
            (s) =>
              s.position > l.position &&
              !carbonSubstituents.some((x) => x.position > l.position && x.position < s.position),
          );
          if (followingSubstituent) {
            // This locant is for a substituent
            return true;
          }

          // Otherwise, check if there's an amine suffix after this locant
          // If so, this locant is likely for the amine position
          const amineSuffix = suffixTokens.find(
            (s) => (s.value === "amine" || s.value === "amin") && s.position > l.position,
          );
          // If there's an amine suffix after this locant, this locant is for the amine, not for carbon substituents
          return !amineSuffix;
        }
        return false;
      });
      const carbonMultipliers = multiplierTokens.filter(
        (m) => m.position !== nPrefixToken.position,
      );
      this.context.substituentApplicator.applySubstituents(
        builder,
        mainChainAtoms,
        carbonSubstituents,
        carbonLocants,
        carbonMultipliers,
        false,
        suffixTokens,
        prefixTokens,
      );
    }

    return builder.build();
  }

  /**
   * Apply N-substituents (from prefix tokens) to tracked amine nitrogens
   * This handles cases like "N-methylquinoline-4-carboxamide" where the N-substituent
   * applies to the suffix group (carboxamide) rather than the ring.
   */
  public applyNPrefixSubstituents(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    prefixTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    processedSubstituents: Set<IUPACToken> = new Set(),
  ): void {
    const amineNitrogens = builder.getAmineNitrogenIndices();

    if (process.env.VERBOSE) {
      console.log(
        `[applyNPrefixSubstituents] Called with ${amineNitrogens.length} amine nitrogens, ${prefixTokens.length} prefix tokens`,
      );
    }

    if (amineNitrogens.length === 0) return;

    const nPrefixToken = prefixTokens.find((p) => this.isNSubstitutionPrefix(p));

    if (process.env.VERBOSE) {
      console.log(`[applyNPrefixSubstituents] N-prefix token:`, nPrefixToken?.value || "none");
    }

    if (!nPrefixToken) return;

    // Find substituents that are associated with the N-prefix
    const nSubstituents = substituentTokens.filter((s) => {
      // Must be after N-prefix
      if (s.position <= nPrefixToken.position) return false;
      // Skip if already processed by applySubstituents (e.g. sulfanyl groups with their own locants)
      if (processedSubstituents.has(s)) return false;
      return true;
    });

    if (process.env.VERBOSE) {
      console.log(
        `[applyNPrefixSubstituents] Found ${nSubstituents.length} N-substituents:`,
        nSubstituents.map((s) => s.value).join(", "),
      );
    }

    if (nSubstituents.length === 0) return;

    // Apply to the last added amine nitrogen (usually the principal group)
    const targetN = amineNitrogens[amineNitrogens.length - 1]!;

    if (process.env.VERBOSE) {
      console.log(
        `[applyNPrefixSubstituents] Applying ${nSubstituents.length} substituents to Nitrogen ${targetN}`,
      );
    }

    for (const nSubst of nSubstituents) {
      // Check if this substituent has a numeric locant (meaning it belongs to the ring)
      // Exception: if the "locant" is N (which might be parsed as locant), it belongs to N
      const _locants = this.context.getLocantsBeforeSubstituent(nSubst, locantTokens);

      // Filter out N locants (if any)
      // Note: locantTokens usually contain numeric values or "N".
      // But getLocantsBeforeSubstituent returns resolved numbers.
      // If "N" resolves to 1 (or N-index), we need to be careful.
      // However, usually ring locants are explicit numbers (2, 3, 4...).
      // If we see explicit numeric locants, it's likely a ring substituent.

      // Hack: Check if the locant token string is a number
      // We need to access the actual tokens, not just resolved numbers.
      // So we'll look at locantTokens directly again.
      const precedingLocant = locantTokens.find(
        (l) =>
          l.position < nSubst.position &&
          l.position > nPrefixToken.position &&
          // Check distance to ensure it's "immediately" before (allowing for multiplier)
          nSubst.position - l.position < 20, // heuristic
      );

      const substValue = nSubst.value.toLowerCase();

      if (process.env.VERBOSE) {
        console.log(
          `[applyNPrefixSubstituents] Processing ${substValue}, precedingLocant:`,
          precedingLocant?.value,
        );
      }

      // Check multiplier
      const multiplier = this.context.getMultiplierBeforeSubstituent(nSubst, multiplierTokens);
      let count = multiplier ? (multiplier.metadata?.count as number) || 1 : 1;

      if (precedingLocant && /^\d/.test(precedingLocant.value)) {
        // Found numeric locant (starts with digit) -> Ring substituent
        // BUT, if nPrefix is present, it might be a "Combined" substituent (e.g. N,N,3-trimethyl)
        // We need to apply the N-part here, because applySubstituents only applied the ring part.

        // Calculate number of Ns in the prefix
        const nPrefixValue = nPrefixToken.value.toLowerCase();
        // Split by comma or hyphen (standard delimiters)
        const nParts = nPrefixValue.split(/[,-]/).filter((p) => p.trim() === "n");
        const nCount = nParts.length;

        if (nCount > 0) {
          // Use the N-count instead of the multiplier count
          // (The multiplier covers both Ring and N parts)
          if (process.env.VERBOSE) {
            console.log(
              `[applyNPrefixSubstituents] Combined locant detected: using N-count ${nCount} instead of multiplier ${count}`,
            );
          }
          count = nCount;
        } else {
          // No Ns? Then maybe it's purely ring. Skip.
          if (process.env.VERBOSE) {
            console.log(
              `[applyNPrefixSubstituents] Skipping ${nSubst.value} (has numeric locant ${precedingLocant.value} and no N parts in prefix)`,
            );
          }
          continue;
        }
      }

      // Handle numeric locants embedded in the N-prefix (e.g. "N,N,3-trimethyl")
      // If this prefix was NOT processed by applySubstituents (because it was skipped due to "N"),
      // then we need to apply the numeric parts here.
      // We can assume that if `precedingLocant` is undefined, then the numeric part (if any) was not handled.
      if (!precedingLocant) {
        const nPrefixValue = nPrefixToken.value.toLowerCase();

        // Update count based on number of Ns
        const nParts = nPrefixValue.split(/[,-]/).filter((p) => p.trim() === "n");
        const nCount = nParts.length;
        if (nCount > 0) {
          count = nCount;
          if (process.env.VERBOSE) {
            console.log(
              `[applyNPrefixSubstituents] Correcting count to ${nCount} based on N-parts`,
            );
          }
        }

        const numericLocants = nPrefixValue
          .split(/[,-]/)
          .map((p) => p.trim())
          .filter((p) => /^\d+$/.test(p))
          .map((p) => parseInt(p, 10));

        if (numericLocants.length > 0) {
          if (process.env.VERBOSE) {
            console.log(
              `[applyNPrefixSubstituents] Found numeric locants in prefix: ${numericLocants.join(",")}`,
            );
          }

          for (const loc of numericLocants) {
            const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
            if (atomIdx !== null) {
              // Apply the same substituent to this ring position
              if (nSubst.nestedTokens && nSubst.nestedTokens.length > 0) {
                const nestedResult = this.context.nestedBuilder.buildNestedSubstituent(
                  builder,
                  nSubst.nestedTokens,
                );
                if (nestedResult) {
                  builder.addBond(atomIdx, nestedResult.attachmentPoint);
                }
              } else {
                const simpleVal = nSubst.value.toLowerCase();
                if (simpleVal === "methyl") builder.addMethyl(atomIdx);
                else if (simpleVal === "ethyl") builder.addEthyl(atomIdx);
                else if (simpleVal === "propyl") builder.addAlkylSubstituent(atomIdx, 3);
                else if (simpleVal === "isopropyl") builder.addIsopropyl(atomIdx);
                else if (simpleVal === "butyl") builder.addAlkylSubstituent(atomIdx, 4);
                else if (simpleVal === "tert-butyl") builder.addTertButyl(atomIdx);
              }
              if (process.env.VERBOSE) {
                console.log(
                  `[applyNPrefixSubstituents] Applied numeric locant substituent to atom ${atomIdx}`,
                );
              }
            }
          }
        }
      }

      for (let i = 0; i < count; i++) {
        if (nSubst.nestedTokens && nSubst.nestedTokens.length > 0) {
          const nestedResult = this.context.nestedBuilder.buildNestedSubstituent(
            builder,
            nSubst.nestedTokens,
          );
          if (nestedResult) {
            builder.addBond(targetN, nestedResult.attachmentPoint);
            if (process.env.VERBOSE) {
              console.log(`[applyNPrefixSubstituents] Attached nested substituent ${substValue}`);
            }
          }
        } else {
          // Simple substituents
          if (substValue === "methyl") builder.addMethyl(targetN);
          else if (substValue === "ethyl") builder.addEthyl(targetN);
          else if (substValue === "propyl") builder.addAlkylSubstituent(targetN, 3);
          else if (substValue === "isopropyl") builder.addIsopropyl(targetN);
          else if (substValue === "butyl") builder.addAlkylSubstituent(targetN, 4);
          else if (substValue === "tert-butyl") builder.addTertButyl(targetN);
          else if (substValue === "phenyl") {
            const ph = builder.createBenzeneRing();
            builder.addBond(targetN, ph[0]!);
          }
        }
      }
    }
  }

  /**
   * Build ester molecule (alkyl acyl-oate pattern)
   * Example: "methyl butanoate" → CH3-O-CO-C3H7
   */
  public buildEster(
    builder: MoleculeGraphBuilder,
    substituentTokens: IUPACToken[],
    parentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    multiplierTokens: IUPACToken[] = [],
  ): Molecule {
    // For esters, find the parent with the "oate" suffix (the acyl chain)
    // Other parents are part of the ester alkyl group name
    const oateToken = suffixTokens.find((s) => s.value === "oate" || s.value === "anoate");
    let acylParentIdx = 0; // default to first
    if (oateToken && parentTokens.length > 1) {
      // Find the parent token that's closest to the oate suffix
      const parentsBeforeOate = parentTokens.filter((p) => p.position < oateToken.position);
      if (parentsBeforeOate.length > 0) {
        // Use the last parent before oate (should be the acyl chain)
        const lastParentBeforeOate = parentsBeforeOate[parentsBeforeOate.length - 1]!;
        acylParentIdx = parentTokens.indexOf(lastParentBeforeOate);
      }
    }

    const parentToken = parentTokens[acylParentIdx]!;
    const parentValue = parentToken.value.toLowerCase();
    const acylAtomCount = (parentToken.metadata?.atomCount as number) || 0;
    const parentSmiles = parentToken.metadata?.smiles as string | undefined;

    if (process.env.VERBOSE) {
      console.log(
        "[ester] Building ester with parent:",
        parentValue,
        "atoms:",
        acylAtomCount,
        "smiles:",
        parentSmiles,
      );
      console.log(
        "[ester] Substituents:",
        substituentTokens.map((s) => s.value),
      );
      console.log(
        "[ester] Locants:",
        locantTokens.map((l) => l.value),
      );
    }

    // Build the acyl chain
    // For aromatic parents like benzoate, use the SMILES string instead of linear chain
    let acylChainAtoms: number[] = [];
    if (parentSmiles && parentSmiles.includes("c")) {
      // Aromatic SMILES - parse it to get the structure
      if (process.env.VERBOSE) {
        console.log("[ester] Parsing aromatic parent SMILES:", parentSmiles);
      }
      const { parseSMILES } = require("index");
      const result = parseSMILES(parentSmiles);
      if (result.molecules[0]) {
        // Copy atoms from parsed molecule into current builder
        const parsedMol = result.molecules[0];
        const atomMapping: Map<number, number> = new Map();

        parsedMol.atoms.forEach((atom: Atom, idx: number) => {
          const newIdx = builder.addAtom(atom.symbol);
          atomMapping.set(idx, newIdx);
          acylChainAtoms.push(newIdx);
        });

        // Copy bonds
        parsedMol.bonds.forEach((bond: Bond) => {
          const newAtom1 = atomMapping.get(bond.atom1);
          const newAtom2 = atomMapping.get(bond.atom2);
          if (newAtom1 !== undefined && newAtom2 !== undefined) {
            builder.addBond(newAtom1, newAtom2, bond.type);
          }
        });

        if (process.env.VERBOSE) {
          console.log("[ester] Parsed aromatic parent:", acylChainAtoms.length, "atoms");
        }
      }
    } else {
      // Simple alkyl chain
      acylChainAtoms = builder.createLinearChain(acylAtomCount);
    }

    // Check if this is a diester (has "di" multiplier before oate)
    const isDiester =
      oateToken &&
      multiplierTokens.some((m) => m.value === "di" && m.position < oateToken.position);

    // Separate substituents with locants (acyl chain substituents) from those without (ester alkyl groups)
    const acylSubstituents: IUPACToken[] = [];
    const acylLocants: IUPACToken[] = [];
    const esterAlkylTokens: IUPACToken[] = [];

    // Track which locants are already "consumed" by parenthetical groups
    const consumedLocants = new Set<IUPACToken>();
    substituentTokens.forEach((subst) => {
      if (subst.isInParentheses) {
        // Parenthetical groups consume all locants immediately before them
        const locantsBeforeThis = locantTokens.filter(
          (l) =>
            l.position < subst.position &&
            !locantTokens.some((x) => x.position > l.position && x.position < subst.position),
        );
        if (process.env.VERBOSE) {
          console.log(
            `[ester] Parenthetical ${subst.value} consumes locants: ${locantsBeforeThis.map((l) => l.metadata?.positions).join(",")}`,
          );
        }
        locantsBeforeThis.forEach((l) => consumedLocants.add(l));
      }
    });

    substituentTokens.forEach((subst, idx) => {
      // Skip substituents that are inside parentheses (they're handled as nested groups)
      const isInsideParentheses = substituentTokens.some((s, sidx) => {
        if (!s.isInParentheses) return false;
        return (
          sidx < idx &&
          subst.position >= s.position &&
          subst.position < s.position + (s.length || 0)
        );
      });

      if (subst.isInParentheses || isInsideParentheses) {
        esterAlkylTokens.push(subst);
        return;
      }
      const substValue = subst.value.toLowerCase();
      if (
        substValue === "methyl" ||
        substValue === "ethyl" ||
        substValue === "propyl" ||
        substValue === "butyl" ||
        substValue === "pentyl"
      ) {
        // Check if this alkyl substituent has a locant (meaning it's on the acyl chain)
        // BUT: if there's a parenthetical substituent BEFORE this alkyl, then the alkyl
        // is part of the ester alcohol specification, not an acyl chain substituent
        const hasParentheticalBefore = substituentTokens.some(
          (s, sidx) => sidx < idx && s.isInParentheses,
        );

        // Get locants that apply to this specific substituent (not consumed by parenthetical groups)
        const relevantLocants = locantTokens.filter(
          (l) =>
            l.position < subst.position &&
            !locantTokens.some((x) => x.position > l.position && x.position < subst.position) &&
            !consumedLocants.has(l),
        );
        const hasLocant = relevantLocants.length > 0;

        if (process.env.VERBOSE) {
          console.log(
            `[ester-alkyl-check] ${subst.value}: hasParenthBefore=${hasParentheticalBefore}, hasLocant=${hasLocant}, relevantLocants=${relevantLocants.length}`,
          );
        }

        // If this alkyl has a non-consumed locant, it applies to the acyl chain
        if (hasLocant) {
          acylSubstituents.push(subst);
        } else {
          // If there's a parenthetical before OR no locant, treat as ester alkyl
          esterAlkylTokens.push(subst);
        }
      } else if (substValue !== "di" && substValue !== "tri") {
        // Other substituents (like alkoxy) are on the acyl chain
        acylSubstituents.push(subst);
      }
    });

    // Collect locants for acyl substituents (excluding consumed ones)
    acylSubstituents.forEach((subst) => {
      const substLocants = locantTokens.filter(
        (l) => l.position < subst.position && !consumedLocants.has(l),
      );
      acylLocants.push(...substLocants);
    });

    if (process.env.VERBOSE) {
      console.log("[ester] Is diester:", isDiester);
      console.log(
        "[ester] Ester alkyl groups:",
        esterAlkylTokens.map((s) => s.value),
      );
      console.log(
        "[ester] Acyl substituents:",
        acylSubstituents.map((s) => s.value),
      );
    }

    // Apply substituents to acyl chain first
    if (acylSubstituents.length > 0) {
      this.context.substituentApplicator.applySubstituents(
        builder,
        acylChainAtoms,
        acylSubstituents,
        acylLocants,
        [],
        false,
      );
    }

    // Add ester groups
    if (isDiester) {
      // Diester: add ester groups to both ends
      const startIdx = acylChainAtoms[0];
      const endIdx = acylChainAtoms[acylChainAtoms.length - 1];

      if (startIdx !== undefined) {
        this.addEsterWithAlkyl(builder, startIdx, esterAlkylTokens, locantTokens, multiplierTokens);
      }
      if (endIdx !== undefined) {
        this.addEsterWithAlkyl(builder, endIdx, esterAlkylTokens, locantTokens, multiplierTokens);
      }
    } else {
      // Simple ester: add to terminal carbon
      const terminalIdx = acylChainAtoms[acylChainAtoms.length - 1];
      if (terminalIdx !== undefined) {
        this.addEsterWithAlkyl(
          builder,
          terminalIdx,
          esterAlkylTokens,
          locantTokens,
          multiplierTokens,
        );
      }
    }

    return builder.build();
  }

  public addEsterWithAlkyl(
    builder: MoleculeGraphBuilder,
    carbonylCarbonIdx: number,
    esterAlkylTokens: IUPACToken[],
    locantTokens: IUPACToken[] = [],
    multiplierTokens: IUPACToken[] = [],
  ): void {
    // Add =O
    const carbonylOxygenIdx = builder.addAtom("O");
    builder.addBond(carbonylCarbonIdx, carbonylOxygenIdx, BondTypeEnum.DOUBLE);

    // Add -O-
    const etherOxygenIdx = builder.addAtom("O");
    builder.addBond(carbonylCarbonIdx, etherOxygenIdx);

    if (esterAlkylTokens.length > 0) {
      // Handle multiple esterAlkylTokens:
      // If we have both parenthetical (ring) and non-parenthetical (alkyl) tokens,
      // build the alkyl as the base and attach the parenthetical as substituents
      const parentheticalTokens = esterAlkylTokens.filter((t) => t.isInParentheses);
      const nonParentheticalTokens = esterAlkylTokens.filter((t) => !t.isInParentheses);

      let baseAlkylLength = 0;
      let baseCarbonIdx: number | null = null;

      // If we have non-parenthetical alkyl (e.g., "ethyl"), use it as the base
      const baseAlkylAtoms: number[] = [];
      if (nonParentheticalTokens.length > 0) {
        const baseToken = nonParentheticalTokens[0]!;
        baseAlkylLength = this.context.getAlkylLength(baseToken.value);
        if (baseAlkylLength > 0) {
          baseCarbonIdx = builder.addCarbon();
          builder.addBond(etherOxygenIdx, baseCarbonIdx);
          baseAlkylAtoms.push(baseCarbonIdx);

          let prevCarbon = baseCarbonIdx;
          for (let i = 1; i < baseAlkylLength; i++) {
            const nextCarbon = builder.addCarbon();
            builder.addBond(prevCarbon, nextCarbon);
            baseAlkylAtoms.push(nextCarbon);
            prevCarbon = nextCarbon;
          }
        }

        if (process.env.VERBOSE) {
          console.log(`[ester] Built base alkyl: ${baseToken.value} (length=${baseAlkylLength})`);
        }
      }

      // Now attach parenthetical tokens as substituents on the base alkyl
      // Or directly to the ester oxygen if there is no base alkyl (e.g., aryl ester)
      if (parentheticalTokens.length > 0) {
        // If no base alkyl (baseCarbonIdx is null), we attach directly to etherOxygenIdx
        const attachToIdx = baseCarbonIdx !== null ? baseCarbonIdx : etherOxygenIdx;

        for (const parentToken of parentheticalTokens) {
          if (parentToken.nestedTokens) {
            // Find multiplier before this parenthetical token
            const multiplier = multiplierTokens.find(
              (m) =>
                m.position < parentToken.position &&
                !multiplierTokens.some(
                  (x) => x.position > m.position && x.position < parentToken.position,
                ),
            );

            // Find locants before this parenthetical token
            const relevantLocants = locantTokens.filter(
              (l) =>
                l.position < parentToken.position &&
                !locantTokens.some(
                  (x) => x.position > l.position && x.position < parentToken.position,
                ),
            );

            let positions: number[] = [];
            if (relevantLocants.length > 0 && relevantLocants[0]?.metadata?.positions) {
              positions = relevantLocants[0].metadata.positions as number[];
            }

            if (process.env.VERBOSE) {
              console.log(`[ester] Parenthetical token: ${parentToken.value}`);
              console.log(`[ester] Multiplier: ${multiplier?.value || "none"}`);
              console.log(`[ester] Locants: ${positions.join(",") || "none"}`);
            }

            // If we have locants, use them; otherwise attach once
            // If attaching directly to oxygen (no base alkyl), ignore numeric locants meant for alkyl chain
            if (positions.length === 0 || baseCarbonIdx === null) {
              positions = [1];
            }

            // Build and attach the substituent at each position
            for (const pos of positions) {
              const alkylResult = this.context.nestedBuilder.buildNestedSubstituent(
                builder,
                parentToken.nestedTokens,
              );
              if (alkylResult) {
                // If attaching to base alkyl, map position. If attaching to oxygen, use it directly.
                let targetIdx = attachToIdx;

                if (baseCarbonIdx !== null && baseAlkylAtoms.length > 0) {
                  // Map position to atom index (1-based to 0-based) on the alkyl chain
                  // Position 1 = first carbon (baseAlkylAtoms[0]), position 2 = baseAlkylAtoms[1], etc.
                  const atomIndex = pos - 1;
                  if (atomIndex >= 0 && atomIndex < baseAlkylAtoms.length) {
                    targetIdx = baseAlkylAtoms[atomIndex]!;
                  } else {
                    targetIdx = baseCarbonIdx; // Fallback to first carbon
                  }
                }

                builder.addBond(targetIdx, alkylResult.attachmentPoint);

                if (process.env.VERBOSE) {
                  console.log(
                    `[ester] Attached nested substituent to atom ${targetIdx} (position ${pos})`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Apply stereochemistry to atoms and bonds
   */
  public buildEtherLinkage(
    builder: MoleculeGraphBuilder,
    tokens: IUPACToken[],
    parentTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[],
    multiplierTokens: IUPACToken[],
    oxyConnectorIdx: number,
  ): Molecule {
    const oxyToken = suffixTokens[oxyConnectorIdx]!;

    // Find parent chains before and after "oxy"
    const alkylParent = parentTokens.find((p) => p.position < oxyToken.position);
    const mainParent = parentTokens.find((p) => p.position > oxyToken.position);

    if (!alkylParent || !mainParent) {
      throw new Error("Ether linkage requires two parent chains");
    }

    if (process.env.VERBOSE) {
      console.log("[ether] Alkyl parent:", alkylParent.value);
      console.log("[ether] Main parent:", mainParent.value);
    }

    // Find locant for attachment position (before alkyl parent)
    const attachLocant = locantTokens.find((l) => l.position < alkylParent.position);
    const attachPosition = attachLocant
      ? ((attachLocant.metadata?.positions as number[])?.[0] ?? 1)
      : 1;

    // Build alkyl chain with its substituents
    const alkylAtomCount = (alkylParent.metadata?.atomCount as number) || 0;
    const alkylChainAtoms = builder.createLinearChain(alkylAtomCount);

    // Apply substituents to alkyl chain
    const alkylSubstituents = substituentTokens.filter((s) => s.position < oxyToken.position);
    const alkylLocants = locantTokens.filter(
      (l) => l.position > (attachLocant?.position ?? -1) && l.position < oxyToken.position,
    );
    const alkylMultipliers = multiplierTokens.filter(
      (m) => m.position > (attachLocant?.position ?? -1) && m.position < oxyToken.position,
    );

    if (alkylSubstituents.length > 0) {
      this.context.substituentApplicator.applySubstituents(
        builder,
        alkylChainAtoms,
        alkylSubstituents,
        alkylLocants,
        alkylMultipliers,
      );
    }

    // Build main chain
    const mainAtomCount = (mainParent.metadata?.atomCount as number) || 0;
    const mainChainAtoms = builder.createLinearChain(mainAtomCount);

    // Apply functional groups to main chain
    const mainSuffixes = suffixTokens.filter((s) => s.position > oxyToken.position);
    const mainLocants = locantTokens.filter((l) => l.position > oxyToken.position);

    // Apply unsaturation
    this.context.applyUnsaturation(builder, mainChainAtoms, mainSuffixes, mainLocants, false);

    // Apply other functional groups
    const mainSubstituents = substituentTokens.filter((s) => s.position > oxyToken.position);
    this.context.applySuffixes(
      builder,
      mainChainAtoms,
      mainSuffixes,
      mainLocants,
      mainSubstituents,
    );

    // Connect alkyl chain to main chain via oxygen (ether linkage)
    const mainAttachAtomIdx = this.context.locantToAtomIndex(attachPosition, mainChainAtoms);
    if (mainAttachAtomIdx !== null) {
      builder.addAlkoxyGroup(mainAttachAtomIdx, alkylChainAtoms);
    }

    if (process.env.VERBOSE) {
      console.log("[ether] Attached alkoxy at position", attachPosition);
    }

    return builder.build();
  }

  /**
   * Build a branched alkyl fragment (e.g., isopropyl, sec-butyl, tert-butyl)
   * Returns fragment atom indices and the attachment point (central carbon)
   */
}
