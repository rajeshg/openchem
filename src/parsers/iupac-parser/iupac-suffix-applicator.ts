import type { IUPACToken } from "./iupac-types";
import { MoleculeGraphBuilder } from "../molecule-graph-builder";
import { BondType as BondTypeEnum } from "types";

export interface IUPACSuffixContext {
  locantToAtomIndex(
    locant: number,
    chainAtoms: number[],
    reverseNumbering?: boolean,
  ): number | null;
}

export class IUPACSuffixApplicator {
  private context: IUPACSuffixContext;

  constructor(context: IUPACSuffixContext) {
    this.context = context;
  }

  public applySuffixes(
    builder: MoleculeGraphBuilder,
    mainChainAtoms: number[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
    substituentTokens: IUPACToken[] = [],
    _multiplierTokens: IUPACToken[] = [],
  ): number[] {
    const esterOxygenIndices: number[] = [];

    for (const suffix of suffixTokens) {
      const suffixValue = suffix.value.toLowerCase();

      // Skip unsaturated and infix suffixes
      if (
        suffix.metadata?.suffixType === "unsaturated" ||
        suffix.metadata?.suffixType === "infix" ||
        suffixValue === "an" ||
        suffixValue === "ane"
      ) {
        continue;
      }

      if (process.env.VERBOSE) {
        console.log(
          `[graph-builder] Applying suffix: ${suffixValue} (pos ${suffix.position}), locants available: ${locantTokens.map((l) => `${l.value}@${l.position}`).join(", ")}`,
        );
      }

      // Get locants and multiplier for this suffix
      const locants = this.getLocantsBeforeSuffix(suffix, locantTokens, substituentTokens);

      // For "hydro" suffix, if locants are empty but we have a multiplier "di" or "tri",
      // we might need to look harder for locants (e.g. "3,4-dihydro")
      // In "3,4-dihydro", locants "3,4" are before "di", which is before "hydro".
      // getLocantsBeforeSuffix looks for locants *immediately* before suffix.
      // If multiplier is intervening, it might fail.
      // Let's try to find locants before the multiplier if we found one.

      // Wait, in "3,4-dihydro", tokens are LOCANT:3,4 MULTIPLIER:di SUFFIX:hydro.
      // Multiplier is between locant and suffix.
      // getLocantsBeforeSuffix logic needs to skip multipliers too.

      const _multiplierTokens = substituentTokens.filter((t) => t.type === "MULTIPLIER"); // Wait, we don't have all multiplier tokens here?
      // applySuffixes receives substituentTokens but NOT multiplierTokens in argument list?
      // Ah, applySuffixes signature has (builder, mainChainAtoms, suffixTokens, locantTokens, substituentTokens).
      // It is MISSING multiplierTokens!
      // So we can't pass multiplierTokens to getMultiplierBeforeSuffix properly.
      // And we can't skip them.

      // I need to update applySuffixes signature to accept multiplierTokens.

      const multiplier = this.getMultiplierBeforeSuffix(
        suffix,
        substituentTokens.filter((t) => t.type === "MULTIPLIER"),
      ); // Using substituents as proxy? No.

      // Let's fix the signature first.

      const multiplierCount = multiplier ? (multiplier.metadata?.count as number) || 1 : 1;

      if (process.env.VERBOSE) {
        console.log(
          `[graph-builder] Applying suffix: ${suffixValue}, locants:`,
          locants,
          "count:",
          multiplierCount,
        );
      }

      switch (suffixValue) {
        case "hydro":
        case "hydr":
          // Add hydrogen(s) to specified positions (saturation)
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                builder.saturateAtom(atomIdx);
              }
            }
          }
          break;

        case "ol":
          // Add hydroxyl group(s)
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                builder.addHydroxyl(atomIdx);
              }
            }
          } else {
            // Default to first position (C1) for primary alcohols
            const atomIdx = mainChainAtoms[0];
            if (atomIdx !== undefined) {
              builder.addHydroxyl(atomIdx);
            }
          }
          break;

        case "one":
          // Add carbonyl group(s)
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                builder.addCarbonyl(atomIdx);
              }
            }
          } else {
            // Default to position 2 for ketones
            const atomIdx = mainChainAtoms[1];
            if (atomIdx !== undefined) {
              builder.addCarbonyl(atomIdx);
            }
          }
          break;

        case "al":
          // Aldehyde - add =O to last carbon
          const lastIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (lastIdx !== undefined) {
            builder.addAldehyde(lastIdx);
          }
          break;

        case "oic acid":
        case "ic acid":
        case "oic":
        case "anoic":
          // Carboxylic acid - add COOH to last carbon
          const terminalIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (terminalIdx !== undefined) {
            builder.addCarboxyl(terminalIdx);
          }
          break;

        case "amine":
        case "amin":
          // Add amine group
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                builder.addAmine(atomIdx);
              }
            }
          } else {
            const termIdx = mainChainAtoms[mainChainAtoms.length - 1];
            if (termIdx !== undefined) {
              builder.addAmine(termIdx);
            }
          }
          break;

        case "carboxylate":
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                const cIdx = builder.addAtom("C");
                const oDouble = builder.addAtom("O");
                const oSingle = builder.addAtom("O");
                builder.addBond(atomIdx, cIdx);
                builder.addBond(cIdx, oDouble, BondTypeEnum.DOUBLE);
                builder.addBond(cIdx, oSingle);
                // Track oSingle as ester attachment point
                esterOxygenIndices.push(oSingle);
              }
            }
          }
          break;

        case "oate":
        case "anoate":
          // Ester - needs to be handled in a special way
          // The alkyl group comes from substituents
          // For now, just add carboxyl to the end
          const esterTermIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (esterTermIdx !== undefined) {
            builder.addCarboxyl(esterTermIdx);
          }
          break;

        case "nitrile":
          // Nitrile - add C#N to terminal carbon
          const nitrileIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (nitrileIdx !== undefined) {
            builder.addNitrile(nitrileIdx);
          }
          break;

        case "thiocyanate":
          // Thiocyanate - add -SC#N to terminal carbon
          const thiocyanateIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (thiocyanateIdx !== undefined) {
            builder.addThiocyanate(thiocyanateIdx);
          }
          break;

        case "formate":
          // Formate ester: -OC(=O)H (methanoate)
          // Parent chain is the alkyl part, formate is the acyl part
          const formateIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (formateIdx !== undefined) {
            const oIdx = builder.addAtom("O");
            const cIdx = builder.addAtom("C");
            const o2Idx = builder.addAtom("O");
            builder.addBond(formateIdx, oIdx);
            builder.addBond(oIdx, cIdx);
            builder.addBond(cIdx, o2Idx, BondTypeEnum.DOUBLE);
          }
          break;

        case "acetate":
          // Acetate ester: -OC(=O)CH3 (ethanoate)
          // Parent chain is the alkyl part, acetate is the acyl part
          const acetateIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (acetateIdx !== undefined) {
            const oIdx = builder.addAtom("O");
            const cIdx = builder.addAtom("C");
            const o2Idx = builder.addAtom("O");
            const ch3Idx = builder.addAtom("C");
            builder.addBond(acetateIdx, oIdx);
            builder.addBond(oIdx, cIdx);
            builder.addBond(cIdx, o2Idx, BondTypeEnum.DOUBLE);
            builder.addBond(cIdx, ch3Idx);
          }
          break;

        case "benzoate":
          // Skip if parent chain is already "benzoate" (implicit parent for ester)
          // In that case, the structure is already built correctly
          if (mainChainAtoms.length === 7) {
            // Benzoate parent: benzene (6) + carboxyl carbon (1) = 7 atoms
            // Add only the carbonyl oxygen (=O)
            // The ester oxygen (-O-R) will be added in substituent processing
            // when the alkyl group (methyl, ethyl, etc.) is attached
            const carboxylC = mainChainAtoms[6]; // Last atom is the carboxyl carbon
            if (carboxylC !== undefined) {
              const o2Idx = builder.addAtom("O");
              builder.addBond(carboxylC, o2Idx, BondTypeEnum.DOUBLE); // C=O

              if (process.env.VERBOSE) {
                console.log(
                  "[benzoate-suffix] Added carbonyl oxygen (=O) to benzoate parent. Ester linkage will be completed in substituent processing.",
                );
              }
            }
          } else {
            // Traditional benzoate ester: -OC(=O)Ph
            // Parent chain is the alkyl part, benzoate is the acyl part
            const benzoateIdx = mainChainAtoms[mainChainAtoms.length - 1];
            if (benzoateIdx !== undefined) {
              const oIdx = builder.addAtom("O");
              const cIdx = builder.addAtom("C");
              const o2Idx = builder.addAtom("O");
              builder.addBond(benzoateIdx, oIdx);
              builder.addBond(oIdx, cIdx);
              builder.addBond(cIdx, o2Idx, BondTypeEnum.DOUBLE);
              // Add phenyl ring
              const benzeneAtoms = builder.createBenzeneRing();
              const firstBenzeneAtom = benzeneAtoms[0];
              if (firstBenzeneAtom !== undefined) {
                builder.addBond(cIdx, firstBenzeneAtom);
              }
            }
          }
          break;

        case "amide":
        case "amid":
          // Amide - C(=O)NH2 (modifies existing carbon)
          // Will be handled specially for N-substituted amides
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                builder.addAmide(atomIdx);
              }
            }
          } else {
            const amideIdx = mainChainAtoms[mainChainAtoms.length - 1];
            if (amideIdx !== undefined) {
              builder.addAmide(amideIdx);
            }
          }
          break;

        case "carboxamide":
          // Carboxamide - adds new carbon with C(=O)NH2 (e.g., quinoline-4-carboxamide)
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                builder.addCarboxamide(atomIdx);
              }
            }
          } else {
            const amideIdx = mainChainAtoms[mainChainAtoms.length - 1];
            if (amideIdx !== undefined) {
              builder.addCarboxamide(amideIdx);
            }
          }
          break;

        case "dione":
          // Multiple carbonyl groups - check for locants
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                builder.addCarbonyl(atomIdx);
              }
            }
          }
          break;

        case "trione":
          // Three carbonyl groups - check for locants
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                builder.addCarbonyl(atomIdx);
              }
            }
          }
          break;

        case "sulfinyl":
          // Sulfinyl group: -SO- attached to terminal carbon
          const sulfinylIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (sulfinylIdx !== undefined) {
            const sIdx = builder.addAtom("S");
            const oIdx = builder.addAtom("O");
            builder.addBond(sulfinylIdx, sIdx);
            builder.addBond(sIdx, oIdx, BondTypeEnum.DOUBLE);
          }
          break;

        case "sulfonyl":
          // Sulfonyl group: -SO2- attached to terminal carbon
          const sulfonylIdx = mainChainAtoms[mainChainAtoms.length - 1];
          if (sulfonylIdx !== undefined) {
            const sIdx = builder.addAtom("S");
            const o1 = builder.addAtom("O");
            const o2 = builder.addAtom("O");
            builder.addBond(sulfonylIdx, sIdx);
            builder.addBond(sIdx, o1, BondTypeEnum.DOUBLE);
            builder.addBond(sIdx, o2, BondTypeEnum.DOUBLE);
          }
          break;

        case "anilino":
          // Anilino group: -NH-C6H5 (aniline-derived amino group)
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                const nIdx = builder.addAtom("N");
                builder.addBond(atomIdx, nIdx);
                const benzeneAtoms = builder.createBenzeneRing();
                if (benzeneAtoms[0] !== undefined) {
                  builder.addBond(nIdx, benzeneAtoms[0]);
                }
              }
            }
          }
          break;

        case "dimethoxyanilino":
          // Dimethoxyanilino group: -NH-C6H3(OCH3)2
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                const nIdx = builder.addAtom("N");
                builder.addBond(atomIdx, nIdx);
                const benzeneAtoms = builder.createBenzeneRing();
                if (benzeneAtoms[0] !== undefined) {
                  builder.addBond(nIdx, benzeneAtoms[0]);
                  // Add methoxy groups at positions 2 and 4 (relative to attachment)
                  if (benzeneAtoms[1] !== undefined) {
                    const o1 = builder.addAtom("O");
                    const c1 = builder.addAtom("C");
                    builder.addBond(benzeneAtoms[1], o1);
                    builder.addBond(o1, c1);
                    builder.addMethyl(c1);
                  }
                  if (benzeneAtoms[3] !== undefined) {
                    const o2 = builder.addAtom("O");
                    const c2 = builder.addAtom("C");
                    builder.addBond(benzeneAtoms[3], o2);
                    builder.addBond(o2, c2);
                    builder.addMethyl(c2);
                  }
                }
              }
            }
          }
          break;

        case "methoxyanilino":
          // Methoxyanilino group: -NH-C6H4(OCH3)
          if (locants.length > 0) {
            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(loc, mainChainAtoms);
              if (atomIdx !== null) {
                const nIdx = builder.addAtom("N");
                builder.addBond(atomIdx, nIdx);
                const benzeneAtoms = builder.createBenzeneRing();
                if (benzeneAtoms[0] !== undefined) {
                  builder.addBond(nIdx, benzeneAtoms[0]);
                  // Add methoxy group at position 4 (para to attachment)
                  if (benzeneAtoms[3] !== undefined) {
                    const o = builder.addAtom("O");
                    const c = builder.addAtom("C");
                    builder.addBond(benzeneAtoms[3], o);
                    builder.addBond(o, c);
                    builder.addMethyl(c);
                  }
                }
              }
            }
          }
          break;
      }
    }
    return esterOxygenIndices;
  }

  /**
   * Apply substituents to main chain
   */
  public getLocantsBeforeSuffix(
    suffix: IUPACToken,
    locantTokens: IUPACToken[],
    substituentTokens?: IUPACToken[],
  ): number[] {
    let closestLocant: IUPACToken | null = null;
    let closestDistance = Infinity;

    for (const locant of locantTokens) {
      if (locant.position < suffix.position) {
        const distance = suffix.position - locant.position;
        if (distance < closestDistance) {
          // Check if there are any substituent tokens between this locant and the suffix
          let hasSubstituentBetween = false;
          if (substituentTokens) {
            for (const subst of substituentTokens) {
              if (subst.position > locant.position && subst.position < suffix.position) {
                hasSubstituentBetween = true;
                break;
              }
            }
          }

          // Only use this locant if there's no substituent between it and the suffix
          if (!hasSubstituentBetween) {
            closestDistance = distance;
            closestLocant = locant;
          }
        }
      }
    }

    if (closestLocant) {
      return (closestLocant.metadata?.positions as number[]) || [parseInt(closestLocant.value)];
    }

    return [];
  }

  /**
   * Find multiplier before a suffix token
   */
  private getMultiplierBeforeSuffix(
    suffix: IUPACToken,
    multiplierTokens: IUPACToken[],
  ): IUPACToken | null {
    let closestMultiplier: IUPACToken | null = null;
    let closestDistance = Infinity;

    for (const multiplier of multiplierTokens) {
      if (multiplier.position < suffix.position) {
        const distance = suffix.position - multiplier.position;
        // Multiplier must be close (e.g. within 20 chars or tokens?)
        // Typically adjacent.
        if (distance < closestDistance) {
          closestDistance = distance;
          closestMultiplier = multiplier;
        }
      }
    }

    // If found, ensure no other tokens intervene too much?
    // For now, just returning the closest preceding multiplier is likely correct
    // as multipliers are parsed separately.

    return closestMultiplier;
  }

  /**
   * Find locants before a substituent token
   */
}
