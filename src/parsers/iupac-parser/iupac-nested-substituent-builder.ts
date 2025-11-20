import type { IUPACToken } from "./iupac-types";
import { BondType as BondTypeEnum } from "types";
import { MoleculeGraphBuilder } from "../molecule-graph-builder";
import type { IUPACBuilderContext } from "./iupac-builder-context";
import { createTokenContext, defaultRegistry } from "./strategies/index";

export type { IUPACBuilderContext };

/**
 * Builds complex nested substituents from parenthetical tokens
 * Handles patterns like: phenoxy, alkoxy, sulfur compounds, acyl, alkyl chains, etc.
 */
export class IUPACNestedSubstituentBuilder {
  constructor(private context: IUPACBuilderContext) {}

  /**
   * Build a complex substituent from nested tokens (e.g., "(4-chlorophenoxy)" or "(propan-2-yl)")
   * Returns the atom indices of the built fragment and the attachment point index
   */
  buildNestedSubstituent(
    builder: MoleculeGraphBuilder,
    nestedTokens: IUPACToken[],
  ): { fragmentAtoms: number[]; attachmentPoint: number } | null {
    // Try strategy-based matching first
    const ctx = createTokenContext(nestedTokens);
    const strategy = defaultRegistry.findStrategy(ctx);

    if (strategy) {
      if (process.env.VERBOSE) {
        console.log(
          `[strategy] Using strategy: ${strategy.name} (priority=${strategy.priority})`,
        );
      }
      // Create an enhanced context that includes buildNestedSubstituent for recursive building
      const enhancedContext = Object.create(
        this.context,
      ) as IUPACBuilderContext & {
        buildNestedSubstituent: (
          b: MoleculeGraphBuilder,
          tokens: IUPACToken[],
        ) => { fragmentAtoms: number[]; attachmentPoint: number } | null;
      };
      enhancedContext.buildNestedSubstituent = (
        b: MoleculeGraphBuilder,
        tokens: IUPACToken[],
      ) => this.buildNestedSubstituent(b, tokens);
      const result = strategy.build(builder, ctx, enhancedContext);
      if (result) {
        return result;
      }
    }

    // Analyze nested tokens to determine what to build
    const parentTokens = nestedTokens.filter((t) => t.type === "PARENT");
    const suffixTokens = nestedTokens.filter((t) => t.type === "SUFFIX");
    const substituentTokens = nestedTokens.filter(
      (t) => t.type === "SUBSTITUENT",
    );
    const locantTokens = nestedTokens.filter((t) => t.type === "LOCANT");
    const prefixTokens = nestedTokens.filter((t) => t.type === "PREFIX");
    const multiplierTokens = nestedTokens.filter(
      (t) => t.type === "MULTIPLIER",
    ); // Extract multipliers!
    const stereoTokens = nestedTokens.filter((t) => t.type === "STEREO");

    if (process.env.VERBOSE) {
      console.log("[nested-substituent] Building nested structure (fallback):");
      console.log(
        "  Nested tokens:",
        nestedTokens.map((t) => `${t.type}:${t.value}`),
      );
      console.log(
        "  Parents:",
        parentTokens.map((t) => t.value),
      );
      console.log(
        "  Suffixes:",
        suffixTokens.map((t) => t.value),
      );
      console.log(
        "  Substituents:",
        substituentTokens.map((t) => t.value),
      );
      console.log(
        "  Will check: branched-alkyl, oxo+anilino, ring systems, phenoxy, alkoxy, sulfur, acyl, alkyl-oxy-methoxy, alkyl",
      );
    }

    // Case: Substituted alkylidene (e.g., "(2,5-dimethoxyphenyl)methylidene")
    // Pattern: substituents (including alkyl base) + idene suffix
    if (
      parentTokens.length === 0 &&
      suffixTokens.some((s) => s.value === "idene" || s.value === "ylidene")
    ) {
      // Find the alkyl base (methyl, ethyl, etc.)
      const alkylBase = substituentTokens.find((s) => {
        const val = s.value.toLowerCase();
        return (
          val === "methyl" ||
          val === "ethyl" ||
          val === "propyl" ||
          val === "butyl" ||
          val === "pentyl" ||
          val === "hexyl"
        );
      });

      if (alkylBase) {
        if (process.env.VERBOSE) {
          console.log(
            `[case-substituted-alkylidene] Building substituted alkylidene based on ${alkylBase.value}`,
          );
        }

        // 1. Build the alkyl chain
        let chainLen = 1;
        const val = alkylBase.value.toLowerCase();
        if (val.startsWith("eth")) chainLen = 2;
        else if (val.startsWith("prop")) chainLen = 3;
        else if (val.startsWith("but")) chainLen = 4;
        else if (val.startsWith("pent")) chainLen = 5;
        else if (val.startsWith("hex")) chainLen = 6;

        const chainAtoms = builder.createLinearChain(chainLen);

        // 2. Apply other substituents to this chain
        const otherSubsts = substituentTokens.filter((s) => s !== alkylBase);

        if (otherSubsts.length > 0) {
          this.context.applySubstituents(
            builder,
            chainAtoms,
            otherSubsts,
            locantTokens,
            [], // prefix
            false, // reverse
            [], // suffix
            [], // multiplier
          );
        }

        return {
          fragmentAtoms: chainAtoms,
          attachmentPoint: chainAtoms[0]!, // Always attach at pos 1 for ylidene
        };
      }
    }

    // Case: Substituted sulfamoyl (e.g., "(phenylsulfamoyl)")
    // Pattern: substituents + sulfamoyl (either as substituent or suffix)
    const sulfamoylToken =
      substituentTokens.find((s) => s.value === "sulfamoyl") ||
      suffixTokens.find((s) => s.value === "sulfamoyl");

    if (parentTokens.length === 0 && sulfamoylToken) {
      if (process.env.VERBOSE) {
        console.log(
          `[case-substituted-sulfamoyl] Building substituted sulfamoyl`,
        );
      }

      // Build sulfamoyl group: S(=O)(=O)N
      const sIdx = builder.addAtom("S");
      const o1Idx = builder.addAtom("O");
      const o2Idx = builder.addAtom("O");
      const nIdx = builder.addAtom("N");

      builder.addBond(sIdx, o1Idx, BondTypeEnum.DOUBLE);
      builder.addBond(sIdx, o2Idx, BondTypeEnum.DOUBLE);
      builder.addBond(sIdx, nIdx);

      // Apply substituents to Nitrogen
      const otherSubsts = substituentTokens.filter((s) => s !== sulfamoylToken);
      if (otherSubsts.length > 0) {
        // Treat N as the main chain (length 1) for substituent application
        // We create a fake locant "1" for each substituent to ensure it attaches to N
        const fakeLocants = otherSubsts.map(
          () =>
            ({
              type: "LOCANT",
              value: "1",
              position: 0,
              length: 1,
              metadata: { positions: [1] },
            }) as IUPACToken,
        );

        this.context.applySubstituents(
          builder,
          [nIdx],
          otherSubsts,
          fakeLocants,
          [],
          false,
          [],
          [],
        );
      }

      return {
        fragmentAtoms: [sIdx, o1Idx, o2Idx, nIdx],
        attachmentPoint: sIdx,
      };
    }

    // Case: Substituted phenyl/aryl (e.g., "2,5-dimethoxyphenyl" or "4-chlorophenyl")
    // Pattern: substituent ending in "phenyl"
    const phenylSubstToken = substituentTokens.find((s) =>
      s.value.toLowerCase().endsWith("phenyl"),
    );

    if (parentTokens.length === 0 && phenylSubstToken) {
      if (process.env.VERBOSE) {
        console.log(
          `[case-substituted-phenyl] Building substituted phenyl from token: ${phenylSubstToken.value}`,
        );
      }

      const baseAtoms = builder.createBenzeneRing();
      const phenylVal = phenylSubstToken.value.toLowerCase();

      // If the token combines substituent+phenyl (e.g. "dimethoxyphenyl"), try to handle it
      if (phenylVal !== "phenyl") {
        const remainder = phenylVal.replace("phenyl", "");

        // Handle dimethoxy/methoxy
        if (remainder.includes("methoxy")) {
          for (const locToken of locantTokens) {
            const locs = (locToken.metadata?.positions as number[]) || [];
            for (const loc of locs) {
              const atomIdx = this.context.locantToAtomIndex(
                loc,
                baseAtoms,
                false,
              );
              if (atomIdx !== null) {
                builder.addMethoxy(atomIdx);
              }
            }
          }
        }
        // Handle dimethyl/methyl
        else if (remainder.includes("methyl")) {
          for (const locToken of locantTokens) {
            const locs = (locToken.metadata?.positions as number[]) || [];
            for (const loc of locs) {
              const atomIdx = this.context.locantToAtomIndex(
                loc,
                baseAtoms,
                false,
              );
              if (atomIdx !== null) builder.addMethyl(atomIdx);
            }
          }
        }
        // Handle chloro
        else if (remainder.includes("chloro") || remainder.includes("chlor")) {
          for (const locToken of locantTokens) {
            const locs = (locToken.metadata?.positions as number[]) || [];
            for (const loc of locs) {
              const atomIdx = this.context.locantToAtomIndex(
                loc,
                baseAtoms,
                false,
              );
              if (atomIdx !== null) {
                const idx = builder.addAtom("Cl");
                builder.addBond(atomIdx, idx);
              }
            }
          }
        }
        // Handle fluoro
        else if (remainder.includes("fluoro") || remainder.includes("fluor")) {
          for (const locToken of locantTokens) {
            const locs = (locToken.metadata?.positions as number[]) || [];
            for (const loc of locs) {
              const atomIdx = this.context.locantToAtomIndex(
                loc,
                baseAtoms,
                false,
              );
              if (atomIdx !== null) {
                const idx = builder.addAtom("F");
                builder.addBond(atomIdx, idx);
              }
            }
          }
        }
      }

      // Apply separate substituents
      const otherSubsts = substituentTokens.filter(
        (s) => s !== phenylSubstToken,
      );
      if (otherSubsts.length > 0) {
        this.context.applySubstituents(
          builder,
          baseAtoms,
          otherSubsts,
          locantTokens,
          [],
          false,
          [],
          [],
        );
      }

      return {
        fragmentAtoms: baseAtoms,
        attachmentPoint: baseAtoms[0]!, // Position 1
      };
    }

    // Case 2: sulfur compounds (e.g., "phenylsulfonyl", "methylsulfinyl", "methylsulfanyl")
    // Check if we have a single substituent that contains sulfur functionality
    if (
      substituentTokens.length === 1 &&
      parentTokens.length === 0 &&
      suffixTokens.length === 0
    ) {
      const substValue = substituentTokens[0]!.value;

      // Check for compound sulfur patterns: *sulfonyl, *sulfinyl, *sulfanyl, *sulfinylsulfanyl
      const sulfonylMatch = substValue.match(/^(.+)sulfonyl$/);
      const sulfinylMatch = substValue.match(/^(.+)sulfinyl$/);
      const sulfanylMatch = substValue.match(/^(.+)sulfanyl$/);
      const sulfinylsulfanylMatch = substValue.match(/^(.+)sulfinylsulfanyl$/);

      if (
        sulfonylMatch ||
        sulfinylMatch ||
        sulfanylMatch ||
        sulfinylsulfanylMatch
      ) {
        const match =
          sulfonylMatch ||
          sulfinylMatch ||
          sulfanylMatch ||
          sulfinylsulfanylMatch;
        const alkylPart = match![1];
        const sulfurType = sulfonylMatch
          ? "sulfonyl"
          : sulfinylMatch
            ? "sulfinyl"
            : sulfinylsulfanylMatch
              ? "sulfinylsulfanyl"
              : "sulfanyl";

        if (process.env.VERBOSE) {
          console.log(
            `[nested-substituent] Building ${sulfurType} with alkyl part: ${alkylPart}`,
          );
        }

        // Build the alkyl/aryl part
        let alkylAtoms: number[] = [];
        if (alkylPart === "phenyl") {
          alkylAtoms = builder.createBenzeneRing();
        } else if (alkylPart === "methyl") {
          alkylAtoms = [builder.addCarbon()];
        } else if (alkylPart === "ethyl") {
          alkylAtoms = builder.createLinearChain(2);
        }

        if (alkylAtoms.length > 0) {
          // Add sulfur with oxygens
          const sIdx = builder.addAtom("S");
          builder.addBond(alkylAtoms[0]!, sIdx);

          if (sulfurType === "sulfinyl") {
            const oIdx = builder.addAtom("O");
            builder.addBond(sIdx, oIdx, BondTypeEnum.DOUBLE);
          } else if (sulfurType === "sulfonyl") {
            const o1 = builder.addAtom("O");
            const o2 = builder.addAtom("O");
            builder.addBond(sIdx, o1, BondTypeEnum.DOUBLE);
            builder.addBond(sIdx, o2, BondTypeEnum.DOUBLE);
          } else if (sulfurType === "sulfinylsulfanyl") {
            // Add -S(=O)-S- structure
            const oIdx = builder.addAtom("O");
            const s2Idx = builder.addAtom("S");
            builder.addBond(sIdx, oIdx, BondTypeEnum.DOUBLE);
            builder.addBond(sIdx, s2Idx);
            return {
              fragmentAtoms: [...alkylAtoms, sIdx, oIdx, s2Idx],
              attachmentPoint: s2Idx,
            };
          }
          // sulfanyl has no oxygens

          return {
            fragmentAtoms: [...alkylAtoms, sIdx],
            attachmentPoint: sIdx,
          };
        }
      }
    }

    // Case 2b: Handle parenthetical sulfur compounds (e.g., "(methylsulfanyl)" parsed as methyl + sulfanyl)
    if (
      substituentTokens.length === 2 &&
      parentTokens.length === 0 &&
      suffixTokens.length === 0
    ) {
      const [firstSubst, secondSubst] = substituentTokens;
      if (firstSubst!.value === "methyl" && secondSubst!.value === "sulfanyl") {
        // This is methylsulfanyl: -S-CH3
        if (process.env.VERBOSE) {
          console.log(`[nested-substituent] Building methylsulfanyl`);
        }

        // Add sulfur
        const sIdx = builder.addAtom("S");
        // Add methyl group
        const methylC = builder.addCarbon();
        builder.addBond(sIdx, methylC);

        return {
          fragmentAtoms: [sIdx, methylC],
          attachmentPoint: sIdx,
        };
      }
    }

    // Case 0: Branched alkyl substituent (e.g., "3-methylbutyl")
    // Pattern: locant + smaller alkyl + larger alkyl (both ending in "yl")
    // Creates: larger chain with smaller chain as substituent at locant position
    if (
      parentTokens.length === 0 &&
      suffixTokens.length === 0 &&
      substituentTokens.length === 2 &&
      locantTokens.length > 0
    ) {
      const alkylSubsts = substituentTokens.filter((s) =>
        s.value.endsWith("yl"),
      );

      if (alkylSubsts.length === 2) {
        const [subst1, subst2] = alkylSubsts;

        // Determine chain lengths
        const getChainLen = (name: string): number => {
          const base = name.replace("yl", "");
          if (base.startsWith("meth")) return 1;
          if (base.startsWith("eth")) return 2;
          if (base.startsWith("prop")) return 3;
          if (base.startsWith("but")) return 4;
          if (base.startsWith("pent")) return 5;
          if (base.startsWith("hex")) return 6;
          return 0;
        };

        const len1 = getChainLen(subst1!.value);
        const len2 = getChainLen(subst2!.value);

        // Longer chain is the parent, shorter is the substituent
        const [parentSubst, branchSubst] =
          len1 > len2 ? [subst1!, subst2!] : [subst2!, subst1!];
        const parentLen = Math.max(len1, len2);
        const branchLen = Math.min(len1, len2);

        if (parentLen > 0 && branchLen > 0) {
          if (process.env.VERBOSE) {
            console.log(
              `[case-branched-alkyl] Building ${branchSubst.value} on ${parentSubst.value} (${parentLen} carbons with ${branchLen} carbon branch)`,
            );
          }

          // Build parent chain
          const parentAtoms = builder.createLinearChain(parentLen);

          // Get locant for branch attachment
          const branchLocants = locantTokens.filter(
            (l) => l.position < branchSubst.position,
          );
          const branchPos =
            branchLocants.length > 0
              ? ((branchLocants[0]?.metadata?.positions as number[]) || [1])[0]!
              : 1;

          const attachIdx = this.context.locantToAtomIndex(
            branchPos,
            parentAtoms,
            false,
          );

          if (attachIdx !== null) {
            // Build branch fragment without attaching it yet
            let branchAtoms: number[] = [];
            if (branchLen === 1) {
              branchAtoms = [builder.addCarbon()]; // Methyl carbon
            } else if (branchLen === 2) {
              const ch2 = builder.addCarbon();
              const ch3 = builder.addCarbon();
              builder.addBond(ch2, ch3);
              branchAtoms = [ch2, ch3]; // Ethyl chain
            } else {
              // Generic alkyl for longer chains
              branchAtoms = builder.createLinearChain(branchLen);
            }

            // Attach branch to parent chain
            builder.addBond(attachIdx, branchAtoms[0]!);

            if (process.env.VERBOSE) {
              console.log(
                `[case-branched-alkyl] Added ${branchSubst.value} at position ${branchPos}`,
              );
            }

            return {
              fragmentAtoms: [...parentAtoms, ...branchAtoms],
              attachmentPoint: parentAtoms[0]!, // Attach at first carbon of parent chain
            };
          }
        }
      }
    }

    // Special Case (HIGH PRIORITY): oxo + anilino (e.g., "1-oxo...1-anilino" = amide with aromatic group)
    // Check BEFORE ring systems to avoid conflicts
    const hasOxoSubst = substituentTokens.some((s) => s.value === "oxo");
    const hasAnilinoSubst = substituentTokens.some((s) =>
      s.value.toLowerCase().endsWith("anilino"),
    );

    if (
      parentTokens.length > 0 &&
      suffixTokens.some((s) => s.value === "yl") &&
      hasOxoSubst &&
      hasAnilinoSubst
    ) {
      if (process.env.VERBOSE) {
        console.log("[case-oxo-anilino] Building amide with anilino group");
      }

      const parentToken = parentTokens[0]!;
      const smiles = parentToken.metadata?.smiles as string;

      if (smiles) {
        const chainLength = smiles.length;

        // Find locant positions
        const ylToken = suffixTokens.find((s) => s.value === "yl");
        const attachLocants = ylToken
          ? this.context.getLocantsBeforeSuffix(ylToken, locantTokens)
          : [];
        const attachPosition = attachLocants.length > 0 ? attachLocants[0]! : 1;

        const oxoSubst = substituentTokens.find((s) => s.value === "oxo");
        const oxoLocants = oxoSubst
          ? this.context.getLocantsBeforeSubstituent(oxoSubst, locantTokens)
          : [];
        const oxoPosition = oxoLocants.length > 0 ? oxoLocants[0]! : 1;

        if (process.env.VERBOSE) {
          console.log(
            `[case-oxo-anilino] Chain length: ${chainLength}, oxo at position ${oxoPosition}, attach at position ${attachPosition}`,
          );
        }

        // Create the main chain
        const chainAtoms = builder.createLinearChain(chainLength);

        // Apply non-oxo, non-anilino substituents to chain (e.g., methyl)
        for (const subst of substituentTokens.filter(
          (s) =>
            s.value !== "oxo" && !s.value.toLowerCase().endsWith("anilino"),
        )) {
          const substLocants = this.context.getLocantsBeforeSubstituent(
            subst,
            locantTokens,
          );
          for (const loc of substLocants) {
            const atomIdx = this.context.locantToAtomIndex(
              loc,
              chainAtoms,
              false,
            );
            if (atomIdx !== null) {
              if (subst.value === "methyl") {
                builder.addMethyl(atomIdx);
              } else if (subst.value === "ethyl") {
                builder.addEthyl(atomIdx);
              }
            }
          }
        }

        // Build anilino fragment
        const anilinoSubst = substituentTokens.find((s) =>
          s.value.toLowerCase().endsWith("anilino"),
        )!;
        const anilinoNestedTokens = anilinoSubst.nestedTokens;

        if (process.env.VERBOSE) {
          console.log(
            `[case-oxo-anilino] Anilino substituent: "${anilinoSubst.value}"`,
          );
          console.log(
            `[case-oxo-anilino] Anilino nestedTokens:`,
            anilinoNestedTokens?.length || 0,
          );
          if (anilinoNestedTokens && anilinoNestedTokens.length > 0) {
            console.log(
              `[case-oxo-anilino] Nested tokens:`,
              anilinoNestedTokens.map((t) => `${t.type}:${t.value}`).join(", "),
            );
          }
        }

        if (anilinoNestedTokens && anilinoNestedTokens.length > 0) {
          const anilinoResult = this.buildNestedSubstituent(
            builder,
            anilinoNestedTokens,
          );

          if (anilinoResult) {
            // Use the chain carbon at oxo position as the carbonyl carbon
            const oxoAtomIdx = this.context.locantToAtomIndex(
              oxoPosition,
              chainAtoms,
              false,
            );
            if (oxoAtomIdx !== null) {
              // Attach oxo (double bond to oxygen)
              const carbonylO = builder.addAtom("O");
              builder.addBond(oxoAtomIdx, carbonylO, BondTypeEnum.DOUBLE);

              // Attach anilino nitrogen to the same carbonyl carbon
              builder.addBond(oxoAtomIdx, anilinoResult.attachmentPoint);

              if (process.env.VERBOSE) {
                console.log(
                  `[case-oxo-anilino] Built amide: C(=O)-NH-Ar at position ${oxoPosition}`,
                );
              }
            }
          }
        }

        // Return the attachment point (where this group connects to the main ester)
        const attachIdx = this.context.locantToAtomIndex(
          attachPosition,
          chainAtoms,
          false,
        );
        if (attachIdx !== null) {
          return {
            fragmentAtoms: chainAtoms,
            attachmentPoint: attachIdx,
          };
        }
      }
    }

    // Special Case: anilino WITHOUT parent (should create benzene ring with substituents)
    // This handles cases like "4-nitro-3-(trifluoromethyl)anilino" where anilino
    // implicitly defines a benzene parent
    const hasAnilinoSubstWithoutParent =
      hasAnilinoSubst && parentTokens.length === 0;

    if (hasAnilinoSubstWithoutParent) {
      if (process.env.VERBOSE) {
        console.log(
          "[case-anilino-implicit-benzene] Building benzene ring with implicit parent for anilino",
        );
      }

      // Create benzene ring
      const benzeneAtoms = builder.createBenzeneRing();

      // Apply all substituents to the benzene ring (excluding anilino)
      const substToApply = substituentTokens.filter(
        (s) => !s.value.toLowerCase().endsWith("anilino"),
      );

      if (process.env.VERBOSE) {
        console.log(
          `[case-anilino-implicit-benzene] Applying ${substToApply.length} substituents: ${substToApply.map((s) => s.value).join(", ")}`,
        );
        console.log(
          `[case-anilino-implicit-benzene] Locant tokens: ${locantTokens.map((l) => `${l.value}@${l.position}`).join(", ")}`,
        );
      }

      this.context.applySubstituents(
        builder,
        benzeneAtoms,
        substToApply,
        locantTokens,
        [],
        false,
        suffixTokens,
        [],
      );

      // Create NH attachment point for anilino
      // This NH will connect the benzene ring to an amide carbonyl
      const nIdx = builder.addAtom("N");
      if (benzeneAtoms[0] !== undefined) {
        builder.addBond(benzeneAtoms[0], nIdx);
      }

      // Return attachment point as the N atom (where it connects to amide)
      return {
        fragmentAtoms: benzeneAtoms,
        attachmentPoint: nIdx,
      };
    }

    // Special Case: ylideneamino (e.g., "propan-2-ylideneamino")
    // Pattern: alkyl parent + locants + ylidene + amino
    // Creates: R-C(=N-NH2)-R where the =N becomes the attachment point
    const hasYlideneSubst = substituentTokens.some(
      (s) => s.value === "ylidene",
    );
    const hasAminoSubst = substituentTokens.some((s) => s.value === "amino");

    if (
      parentTokens.length > 0 &&
      hasYlideneSubst &&
      hasAminoSubst &&
      suffixTokens.some((s) => s.value === "an")
    ) {
      if (process.env.VERBOSE) {
        console.log("[case-ylideneamino] Building ylideneamino substituent");
      }

      const parentToken = parentTokens[0]!;
      const smiles = parentToken.metadata?.smiles as string;
      const chainLength = smiles ? smiles.length : 1;

      // Create the main carbon chain
      const chainAtoms = builder.createLinearChain(chainLength);

      // Find locant for the ylidene position (where the double bond is)
      const ylideneSubst = substituentTokens.find(
        (s) => s.value === "ylidene",
      )!;
      const ylideneLocants = this.context.getLocantsBeforeSubstituent(
        ylideneSubst,
        locantTokens,
      );
      const ylidenePosition =
        ylideneLocants.length > 0 ? ylideneLocants[0]! : 1;

      const ylideneAtomIdx = this.context.locantToAtomIndex(
        ylidenePosition,
        chainAtoms,
        false,
      );
      if (ylideneAtomIdx !== null) {
        // Create N=C structure (ylidene: double bond between C and N)
        // The nitrogen will be attached to the ring with a single bond
        const nIdx = builder.addAtom("N");
        builder.addBond(ylideneAtomIdx, nIdx, BondTypeEnum.DOUBLE);

        if (process.env.VERBOSE) {
          console.log(
            `[case-ylideneamino] Created ylideneamino at position ${ylidenePosition}`,
          );
        }

        // Return: nIdx (the N with double bond) is where this attaches to the main ring
        return {
          fragmentAtoms: chainAtoms,
          attachmentPoint: nIdx,
        };
      }
    }

    // Case: Spiro system in nested substituent (e.g. "thiaspiro[4.4]non-3-en-8-yl")
    // Pattern: PREFIX "spiro[a.b]" + PARENT (usually alkane)
    const spiroPrefix = prefixTokens.find(
      (p) =>
        p.value.includes("spiro") ||
        (p.metadata?.hasBridgeNotation && p.value.includes("spiro")),
    );

    if (spiroPrefix && parentTokens.length === 1) {
      if (process.env.VERBOSE) {
        console.log(
          `[case-spiro] Building spiro system from prefix: ${spiroPrefix.value}`,
        );
      }

      const spiroRegex = /^([a-z]+)?spiro\[(\d+)\.(\d+)\]/i;
      const match = spiroPrefix.value.match(spiroRegex);

      if (match) {
        const ringA = parseInt(match[2]!);
        const ringB = parseInt(match[3]!);

        const spiroAtoms = builder.createSpiroStructure(ringA, ringB);

        // Remap spiroAtoms to match IUPAC numbering
        // IUPAC positions: 1..a (ring A), a+1 (spiro center), a+2..a+b+1 (ring B)
        // Original array: [spiro_center, ringA[0..a-1], ringB[0..b-1]]
        // locantToAtomIndex(pos) returns array[pos-1], so:
        //   position 1 → array[0] should be ringA[0]
        //   position 2 → array[1] should be ringA[1]
        //   position a+1 → array[a] should be spiro_center
        //   position a+2 → array[a+1] should be ringB[0]
        const remappedSpiroAtoms: number[] = [
          ...spiroAtoms.slice(1, ringA + 1), // ring A atoms (positions 1..a) at indices 0..a-1
          spiroAtoms[0]!, // spiro center (position a+1) at index a
          ...spiroAtoms.slice(ringA + 1), // ring B atoms (positions a+2..a+b+1) at indices a+1..a+b
        ];

        // Extract heteroatom from spiro prefix itself (e.g., "thia" from "thiaspiro[4.4]")
        const heteroMatch = spiroPrefix.value.match(/^([a-z]+)spiro/i);
        if (heteroMatch && heteroMatch[1]) {
          const heteroName = heteroMatch[1];
          // Find locants for this heteroatom
          // Look for locants that contain "lambda" notation (e.g., "2lambda6")
          const lambdaLocants = locantTokens.filter((t) =>
            t.value.includes("lambda"),
          );
          for (const locant of lambdaLocants) {
            // Extract position number from "2lambda6" → 2
            const posMatch = locant.value.match(/^(\d+)/);
            if (posMatch) {
              const pos = parseInt(posMatch[1]!);
              const atomIdx = this.context.locantToAtomIndex(
                pos,
                remappedSpiroAtoms,
                false,
              );
              if (atomIdx !== null && heteroName.includes("thia")) {
                if (process.env.VERBOSE) {
                  console.log(
                    `  Replacing atom ${atomIdx} (position ${pos}) with S (from ${spiroPrefix.value})`,
                  );
                }
                builder.replaceAtom(atomIdx, "S");
              }
            }
          }
        }

        // Process other heteroatom tokens (e.g., "oxa")
        const heteroTokens = [
          ...prefixTokens.filter(
            (t) =>
              t.value.includes("oxa") ||
              t.value.includes("thia") ||
              t.value.includes("aza") ||
              t.value.includes("phospha"),
          ),
          ...suffixTokens.filter(
            (t) =>
              t.value.includes("oxa") ||
              t.value.includes("thia") ||
              t.value.includes("aza") ||
              t.value.includes("phospha"),
          ),
        ];

        for (const token of heteroTokens) {
          let type = "";
          if (token.value.includes("oxa")) type = "O";
          else if (token.value.includes("thia")) type = "S";
          else if (token.value.includes("aza")) type = "N";

          if (type) {
            const locants = this.context.getLocantsBeforeSubstituent(
              token,
              locantTokens,
            );

            if (process.env.VERBOSE) {
              console.log(
                `[spiro-replacement] Replacing ${type} at positions:`,
                locants,
                `(from token: ${token.value})`,
              );
            }

            for (const loc of locants) {
              const atomIdx = this.context.locantToAtomIndex(
                loc,
                remappedSpiroAtoms,
                false,
              );
              if (atomIdx !== null) {
                if (process.env.VERBOSE) {
                  console.log(
                    `  Replacing atom ${atomIdx} (position ${loc}) with ${type}`,
                  );
                }
                builder.replaceAtom(atomIdx, type);
              }
            }
          }
        }

        // Apply unsaturation (e.g. "en")
        const unsaturatedSuffixes = suffixTokens.filter(
          (s) => s.metadata?.suffixType === "unsaturated",
        );
        if (unsaturatedSuffixes.length > 0) {
          for (const suffix of unsaturatedSuffixes) {
            if (suffix.value === "en" || suffix.value === "ene") {
              const locants = this.context.getLocantsBeforeSuffix(
                suffix,
                locantTokens,
              );
              for (const pos of locants) {
                const atomIdx1 = this.context.locantToAtomIndex(
                  pos,
                  remappedSpiroAtoms,
                  false,
                );
                // Double bond is typically between position N and N+1
                const atomIdx2 = this.context.locantToAtomIndex(
                  pos + 1,
                  remappedSpiroAtoms,
                  false,
                );

                if (atomIdx1 !== null && atomIdx2 !== null) {
                  if (process.env.VERBOSE) {
                    console.log(
                      `[spiro-unsaturation] Adding double bond between positions ${pos}-${pos + 1} (atoms ${atomIdx1}-${atomIdx2})`,
                    );
                  }
                  // Convert existing single bond to double bond
                  const bonds = builder.getBonds();
                  const existingBond = bonds.find(
                    (b) =>
                      (b.atom1 === atomIdx1 && b.atom2 === atomIdx2) ||
                      (b.atom1 === atomIdx2 && b.atom2 === atomIdx1),
                  );
                  if (existingBond) {
                    // Note: This is a workaround for mutating readonly bonds during construction
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (existingBond as any).type = "double";
                  }
                }
              }
            }
          }
        }

        // Apply substituents (using remapped array for correct position mapping)
        if (substituentTokens.length > 0) {
          this.context.applySubstituents(
            builder,
            remappedSpiroAtoms,
            substituentTokens,
            locantTokens,
            multiplierTokens, // Pass multipliers to handle "di" in "2,2-dioxo"
            false,
            suffixTokens,
            [],
          );
        }

        // Find attachment point (yl)
        const ylSuffix = suffixTokens.find((s) => s.value === "yl");
        let attachIdx = spiroAtoms[0]!; // Default to spiro center
        if (ylSuffix) {
          const locants = this.context.getLocantsBeforeSuffix(
            ylSuffix,
            locantTokens,
          );
          if (locants.length > 0) {
            const idx = this.context.locantToAtomIndex(
              locants[0]!,
              remappedSpiroAtoms,
              false,
            );
            if (idx !== null) attachIdx = idx;
          }
        }

        return {
          fragmentAtoms: spiroAtoms,
          attachmentPoint: attachIdx,
        };
      }
    }

    // Case 0 (Priority): Ring systems with substituents (e.g., "4-acetyl-5,5-dimethyl-2-propan-2-yloxolan-2-yl")
    // CHECK THIS FIRST before other patterns to avoid conflicts
    // Handles: ring parent + locants + substituents + "yl" suffix
    if (parentTokens.length > 0 && suffixTokens.some((s) => s.value === "yl")) {
      const ringParents = [
        "oxolan",
        "oxolane",
        "pyrrolidine",
        "piperidine",
        "morpholine",
        "pyrrole",
        "pyridine",
        "benzene",
        "oxane",
        "imidazolidin",
        "imidazolidine",
        "thiazole",
        "thiazol",
        "oxazole",
        "oxazol",
        "benzofuran",
        "indole",
        "indol",
        "isoindole",
        "isoindol",
        "naphthalene",
        "naphthalen",
        "quinoline",
        "quinolin",
        "furan",
        "thiophene",
        "pyrazole",
        "pyrazol",
      ];
      const ringParentToken = parentTokens.find((p) =>
        ringParents.some((ring) => p.value.toLowerCase().includes(ring)),
      );

      if (ringParentToken) {
        const parentValue = ringParentToken.value.toLowerCase();

        if (process.env.VERBOSE) {
          console.log(
            `[case-0-ring] Building ring system: ${parentValue} with substituents`,
          );
        }

        let ringAtoms: number[] = [];

        // Create the ring
        if (parentValue === "oxolan" || parentValue === "oxolane") {
          ringAtoms = builder.createOxolanRing();
        } else if (parentValue === "pyrrolidine") {
          ringAtoms = builder.createPyrrolidineRing();
        } else if (parentValue === "piperidine") {
          ringAtoms = builder.createPiperidineRing();
        } else if (parentValue === "benzene" || parentValue === "benz") {
          ringAtoms = builder.createBenzeneRing();
        } else if (parentValue === "oxane") {
          ringAtoms = builder.createOxaneRing();
        } else if (
          parentValue === "imidazolidin" ||
          parentValue === "imidazolidine"
        ) {
          ringAtoms = builder.createImidazolidineRing();
        } else if (parentValue === "morpholine") {
          ringAtoms = builder.createMorpholineRing();
        } else if (parentValue === "pyrrole") {
          ringAtoms = builder.createPyrroleRing();
        } else if (parentValue === "pyridine") {
          ringAtoms = builder.createPyridineRing();
        } else if (parentValue === "thiazole" || parentValue === "thiazol") {
          ringAtoms = builder.createThiazoleRing();
        } else if (parentValue === "oxazole" || parentValue === "oxazol") {
          ringAtoms = builder.createOxazoleRing();
        } else if (parentValue === "benzofuran") {
          ringAtoms = builder.createBenzofuranRing();
        } else if (parentValue === "indole" || parentValue === "indol") {
          ringAtoms = builder.createIndoleRing();
        } else if (parentValue === "isoindole" || parentValue === "isoindol") {
          ringAtoms = builder.createIsoindolRing();
        } else if (
          parentValue === "naphthalene" ||
          parentValue === "naphthalen"
        ) {
          ringAtoms = builder.createNaphthaleneRing();
        } else if (parentValue === "quinoline" || parentValue === "quinolin") {
          ringAtoms = builder.createQuinolineRing();
        } else if (parentValue === "furan") {
          ringAtoms = builder.createFuranRing();
        } else if (parentValue === "thiophene") {
          ringAtoms = builder.createThiopheneRing();
        } else if (parentValue === "pyrazole" || parentValue === "pyrazol") {
          ringAtoms = builder.createPyrazoleRing();
        }

        if (ringAtoms.length > 0) {
          // Apply substituents to the ring
          // But exclude substituents that are actually ring-modifying parents (like "prop" in "propan-2-yl")
          const ringSubstituents = substituentTokens.filter((s) => {
            // Skip alkyl parents that might be part of "alkyl-yl" pattern
            return ![
              "prop",
              "but",
              "pent",
              "hex",
              "hept",
              "oct",
              "non",
              "dec",
            ].some((prefix) => s.value.toLowerCase().startsWith(prefix));
          });

          if (ringSubstituents.length > 0) {
            this.context.applySubstituents(
              builder,
              ringAtoms,
              ringSubstituents,
              locantTokens,
              multiplierTokens, // Pass multipliers
              false,
              suffixTokens,
              [],
            );
          }

          // Apply suffixes (like dihydro, ol, one) to the ring
          if (suffixTokens.length > 0) {
            this.context.applySuffixes(
              builder,
              ringAtoms,
              suffixTokens,
              locantTokens,
              [], // No substituents passed here (already processed)
              multiplierTokens,
            );
          }

          // Apply hydrogen notation (e.g. 1H, 2H) from locants to saturate specific atoms
          const hydrogenLocants = locantTokens.filter(
            (t) => t.metadata?.isHydrogenNotation === true,
          );
          for (const hToken of hydrogenLocants) {
            const loc = parseInt(hToken.value);
            if (!isNaN(loc)) {
              const atomIdx = this.context.locantToAtomIndex(
                loc,
                ringAtoms,
                false,
              );
              if (atomIdx !== null) {
                if (process.env.VERBOSE) {
                  console.log(
                    `[nested-substituent] Applying hydrogen notation (saturation) at locant ${loc}`,
                  );
                }
                builder.saturateAtom(atomIdx);
              }
            }
          }

          // Now apply any alkyl-based substituents (which are actually other parents)
          // For "2-propan-2-yloxolan-2-yl", we need to add propan-2-yl as substituent
          const otherParents = parentTokens.filter(
            (p) => p !== ringParentToken,
          );
          for (const otherParent of otherParents) {
            const parentValue2 = otherParent.value.toLowerCase();
            // Find locants that precede this parent
            const locantsBeforeParent = locantTokens.filter(
              (l) => l.position < otherParent.position,
            );
            // Use the LAST locant before this parent (closest to it) for position mapping
            const position =
              locantsBeforeParent.length > 0
                ? (
                    locantsBeforeParent[locantsBeforeParent.length - 1]
                      ?.metadata?.positions as number[]
                  )?.[0] || 1
                : 1;
            const atomIdx = this.context.locantToAtomIndex(
              position,
              ringAtoms,
              false,
            );

            if (atomIdx !== null) {
              // Build the substituent (e.g., "propan-2-yl" = isopropyl)
              if (parentValue2 === "prop") {
                builder.addIsopropyl(atomIdx);
              } else if (parentValue2 === "but") {
                builder.addAlkylSubstituent(atomIdx, 4);
              } else {
                // Generic alkyl chain - estimate length from name
                const length = this.context.getAlkylLength(parentValue2);
                if (length > 0) {
                  builder.addAlkylSubstituent(atomIdx, length);
                }
              }

              if (process.env.VERBOSE) {
                console.log(
                  `[case-0-ring] Added ${parentValue2} substituent at position ${position}`,
                );
              }
            }
          }

          // Find the attachment point - usually position from the "yl" suffix
          const ylToken = suffixTokens.find((s) => s.value === "yl");
          const attachLocants = ylToken
            ? this.context.getLocantsBeforeSuffix(ylToken, locantTokens)
            : [];
          const attachPosition =
            attachLocants.length > 0 ? attachLocants[0]! : 1;
          const attachIdx = this.context.locantToAtomIndex(
            attachPosition,
            ringAtoms,
            false,
          );

          if (attachIdx !== null) {
            // Apply stereo descriptors (E/Z, R/S)
            this.context.applyStereo(
              builder,
              ringAtoms,
              stereoTokens,
              suffixTokens,
              locantTokens,
            );

            if (process.env.VERBOSE) {
              console.log(
                `[case-0-ring] Built ring with ${ringAtoms.length} atoms, attaching at position ${attachPosition}`,
              );
            }
            return {
              fragmentAtoms: ringAtoms,
              attachmentPoint: attachIdx,
            };
          }
        }
      }
    }

    // Case 1: phenoxy pattern (e.g., "4-chlorophenoxy") - check this FIRST
    // Check if we have "phenoxy" either directly or in nested tokens
    // BUT: only trigger this case if there's no parent (phenoxy is the main structure, not a substituent)
    // AND: exclude if there's an alkyl base (that case should be handled by substituted-alkyl)
    const hasAlkylBase = substituentTokens.some((s) => {
      const v = s.value.toLowerCase();
      const base = v.endsWith("yl") ? v.slice(0, -2) : v;
      return [
        "meth",
        "methyl",
        "eth",
        "ethyl",
        "prop",
        "propyl",
        "but",
        "butyl",
        "pent",
        "pentyl",
        "hex",
        "hexyl",
        "hept",
        "heptyl",
        "oct",
        "octyl",
        "non",
        "nonyl",
        "dec",
        "decyl",
      ].includes(base);
    });

    const hasPhenoxySubst =
      parentTokens.length === 0 &&
      !hasAlkylBase &&
      substituentTokens.some(
        (s) =>
          s.value === "phenoxy" ||
          (s.nestedTokens &&
            s.nestedTokens.some((nt) => nt.value === "phenoxy")),
      );

    if (process.env.VERBOSE) {
      console.log(
        `[case-1] hasPhenoxySubst=${hasPhenoxySubst}, hasAlkylBase=${hasAlkylBase}`,
      );
    }

    if (hasPhenoxySubst) {
      // Build benzene ring
      if (process.env.VERBOSE) {
        console.log("[nested-substituent] Building phenoxy group");
      }
      const baseAtoms = builder.createBenzeneRing();

      // Find the substituent containing phenoxy (could be direct or nested)
      const phenoxyContainingSubst = substituentTokens.find(
        (s) =>
          s.value === "phenoxy" ||
          (s.nestedTokens &&
            s.nestedTokens.some((nt) => nt.value === "phenoxy")),
      );

      // If phenoxy is nested (e.g., "2,4-bis(2-methylbutan-2-yl)phenoxy"),
      // extract the nested tokens and use them
      let effectiveSubstituentTokens = substituentTokens;
      let effectiveLocantTokens = locantTokens;
      let effectiveMultiplierTokens = multiplierTokens;

      if (
        phenoxyContainingSubst &&
        phenoxyContainingSubst.nestedTokens &&
        phenoxyContainingSubst.nestedTokens.length > 0
      ) {
        // Use the nested tokens instead
        effectiveSubstituentTokens = phenoxyContainingSubst.nestedTokens.filter(
          (t) => t.type === "SUBSTITUENT",
        );
        effectiveLocantTokens = phenoxyContainingSubst.nestedTokens.filter(
          (t) => t.type === "LOCANT",
        );
        effectiveMultiplierTokens = phenoxyContainingSubst.nestedTokens.filter(
          (t) => t.type === "MULTIPLIER",
        );

        if (process.env.VERBOSE) {
          console.log(
            "[nested-substituent] Using nested tokens for phenoxy substituents:",
            effectiveSubstituentTokens.map((t) => t.value),
          );
        }
      }

      // Apply any ring substituents (e.g., "4-chloro" on phenoxy or "2,4-bis(2-methylbutan-2-yl)")
      for (const subst of effectiveSubstituentTokens.filter(
        (s) => s.value !== "phenoxy",
      )) {
        // Check if this substituent has a multiplier
        const multiplier = this.context.getMultiplierBeforeSubstituent(
          subst,
          effectiveMultiplierTokens,
        );
        const count = multiplier
          ? (multiplier.metadata?.count as number) || 1
          : 1;

        // Get locants for this substituent
        let locants = this.context.getLocantsBeforeSubstituent(
          subst,
          effectiveLocantTokens,
        );

        // If multiplier exists and we have multiple locants, use them
        if (multiplier && locants.length < count) {
          // Find locants before multiplier
          const relevantLocants = effectiveLocantTokens
            .filter((l) => l.position < multiplier.position)
            .sort((a, b) => b.position - a.position)
            .slice(0, count);

          // Flatten locant positions
          const flattenedLocants: number[] = [];
          for (const l of relevantLocants.reverse()) {
            const positions = l.metadata?.positions as number[] | undefined;
            if (positions) {
              flattenedLocants.push(...positions);
            } else {
              flattenedLocants.push(parseInt(l.value));
            }
          }
          locants = flattenedLocants;
        }

        // Apply substituent at each locant position
        for (const loc of locants) {
          const atomIdx = this.context.locantToAtomIndex(loc, baseAtoms, false);
          if (atomIdx !== null) {
            // Check if this is a complex nested substituent
            if (subst.nestedTokens && subst.nestedTokens.length > 0) {
              // Recursively build nested substituent
              const nestedResult = this.buildNestedSubstituent(
                builder,
                subst.nestedTokens,
              );
              if (nestedResult) {
                builder.addBond(atomIdx, nestedResult.attachmentPoint);
              }
            } else {
              // Simple substituent - handle inline
              if (subst.value === "chloro" || subst.value === "chlor") {
                const clIdx = builder.addAtom("Cl");
                builder.addBond(atomIdx, clIdx);
              } else if (subst.value === "bromo" || subst.value === "brom") {
                const brIdx = builder.addAtom("Br");
                builder.addBond(atomIdx, brIdx);
              } else if (subst.value === "fluoro" || subst.value === "fluor") {
                const fIdx = builder.addAtom("F");
                builder.addBond(atomIdx, fIdx);
              } else if (subst.value === "methyl") {
                builder.addMethyl(atomIdx);
              } else if (subst.value === "methoxy") {
                builder.addMethoxy(atomIdx);
              }
            }
          }
        }
      }

      // Add oxygen at the attachment point (position 1 of benzene ring)
      const oxygenIdx = builder.addAtom("O");
      builder.addBond(baseAtoms[0]!, oxygenIdx);

      return {
        fragmentAtoms: [...baseAtoms, oxygenIdx],
        attachmentPoint: oxygenIdx,
      };
    }

    // Case 2a: Multi-level alkoxy patterns (e.g., "1-(2-methylbutoxy)ethoxy")
    // This handles nested alkoxy where one alkoxy substituent is attached to another
    // Pattern: locate all alkoxy-like substituents, find the last one (base) and attach others to it
    const alkoxySubsts = substituentTokens.filter(
      (s) =>
        s.value.endsWith("oxy") &&
        !s.value.startsWith("hydroxy") &&
        s.value !== "oxy" &&
        s.value !== "phenoxy",
    );

    if (
      alkoxySubsts.length >= 2 &&
      parentTokens.length === 0 &&
      suffixTokens.length === 0
    ) {
      if (process.env.VERBOSE) {
        console.log(
          `[case-2a] Multi-level alkoxy: ${alkoxySubsts.map((s) => s.value).join(" + ")}`,
        );
      }

      // The last alkoxy is the base structure
      const baseAlkoxyValue = alkoxySubsts[alkoxySubsts.length - 1]!.value;

      // Determine base alkyl chain length
      let baseChainLength = 1;
      if (baseAlkoxyValue.startsWith("meth")) baseChainLength = 1;
      else if (baseAlkoxyValue.startsWith("eth")) baseChainLength = 2;
      else if (baseAlkoxyValue.startsWith("prop")) baseChainLength = 3;
      else if (baseAlkoxyValue.startsWith("but")) baseChainLength = 4;

      const baseAlkylAtoms = builder.createLinearChain(baseChainLength);

      // Now attach the other alkoxy substituents to positions on this base chain
      for (let i = 0; i < alkoxySubsts.length - 1; i++) {
        const attachedAlkoxy = alkoxySubsts[i]!;
        const locants = this.context.getLocantsBeforeSubstituent(
          attachedAlkoxy,
          locantTokens,
        );
        const attachPos = locants.length > 0 ? locants[0]! : 1;

        // Get attachment atom on base chain
        const attachAtomIdx = this.context.locantToAtomIndex(
          attachPos,
          baseAlkylAtoms,
          false,
        );
        if (attachAtomIdx !== null) {
          // Parse the attached alkoxy to get its structure
          if (
            attachedAlkoxy.nestedTokens &&
            attachedAlkoxy.nestedTokens.length > 0
          ) {
            // This is a complex alkoxy with substituents (e.g., "2-methylbutoxy")
            const attachedResult = this.buildNestedSubstituent(
              builder,
              attachedAlkoxy.nestedTokens,
            );
            if (attachedResult) {
              builder.addBond(attachAtomIdx, attachedResult.attachmentPoint);
            }
          } else {
            // Simple alkoxy - build it
            let attachedChainLength = 1;
            const attachedValue = attachedAlkoxy.value;
            if (attachedValue.startsWith("meth")) attachedChainLength = 1;
            else if (attachedValue.startsWith("eth")) attachedChainLength = 2;
            else if (attachedValue.startsWith("prop")) attachedChainLength = 3;
            else if (attachedValue.startsWith("but")) attachedChainLength = 4;

            const attachedChain =
              builder.createLinearChain(attachedChainLength);
            const attachedOxy = builder.addAtom("O");
            builder.addBond(attachedChain[0]!, attachedOxy);
            builder.addBond(attachAtomIdx, attachedOxy);
          }
        }
      }

      // Add oxygen at the first carbon of the base chain (position 1)
      const baseOxyIdx = builder.addAtom("O");
      builder.addBond(baseAlkylAtoms[0]!, baseOxyIdx);

      if (process.env.VERBOSE) {
        console.log("[case-2a] Built multi-level alkoxy pattern");
      }

      return {
        fragmentAtoms: [...baseAlkylAtoms, baseOxyIdx],
        attachmentPoint: baseOxyIdx,
      };
    }

    // Case 1.5: Acyloxy + alkoxy + alkyl pattern (e.g., "2-butanoyloxy-2-ethoxyethyl")
    // Pattern: parent + acyl suffixes (an+oyl+oxy) + alkoxy substituent + alkyl substituent
    // Example tokens: parent:but, suffixes:[an,oyl,oxy], substituents:[ethoxy,ethyl]
    if (
      parentTokens.length > 0 &&
      suffixTokens.length === 3 &&
      suffixTokens[0]?.value === "an" &&
      suffixTokens[1]?.value === "oyl" &&
      suffixTokens[2]?.value === "oxy"
    ) {
      // Find alkoxy and alkyl substituents
      const alkoxySubst = substituentTokens.find((s) =>
        s.value.endsWith("oxy"),
      );
      const alkylSubst = substituentTokens.find((s) => s.value.endsWith("yl"));

      if (alkoxySubst && alkylSubst && process.env.VERBOSE) {
        console.log(
          `[case-1.5] Acyloxy pattern: parent=${parentTokens[0]?.value}, alkoxy=${alkoxySubst.value}, alkyl=${alkylSubst.value}`,
        );
      }

      if (alkoxySubst && alkylSubst) {
        // 1. Build acyl chain from parent (e.g., "but" = 4 carbons)
        const parentValue = parentTokens[0]!.value;
        let acylChainLength = 1;
        if (parentValue.startsWith("meth")) acylChainLength = 1;
        else if (parentValue.startsWith("eth")) acylChainLength = 2;
        else if (parentValue.startsWith("prop")) acylChainLength = 3;
        else if (parentValue.startsWith("but")) acylChainLength = 4;
        else if (parentValue.startsWith("pent")) acylChainLength = 5;
        else if (parentValue.startsWith("hex")) acylChainLength = 6;

        const acylAtoms = builder.createLinearChain(acylChainLength);

        // 2. Build acyloxy group: C(=O)-O-
        const carbonylC = acylAtoms[0]!;
        const carbonylO = builder.addAtom("O");
        builder.addBond(carbonylC, carbonylO, BondTypeEnum.DOUBLE); // C=O double bond

        const etherO = builder.addAtom("O");
        builder.addBond(carbonylC, etherO); // C-O single bond

        // 3. Build alkyl base chain (e.g., "ethyl" = 2 carbons)
        const alkylValue = alkylSubst.value.replace("yl", "");
        let alkylChainLength = 1;
        if (alkylValue.startsWith("meth")) alkylChainLength = 1;
        else if (alkylValue.startsWith("eth")) alkylChainLength = 2;
        else if (alkylValue.startsWith("prop")) alkylChainLength = 3;
        else if (alkylValue.startsWith("but")) alkylChainLength = 4;
        else if (alkylValue.startsWith("pent")) alkylChainLength = 5;
        else if (alkylValue.startsWith("hex")) alkylChainLength = 6;

        const alkylBaseAtoms = builder.createLinearChain(alkylChainLength);

        // Connect ether oxygen to first carbon of alkyl chain
        builder.addBond(etherO, alkylBaseAtoms[0]!);

        // 4. Apply alkoxy substituent (e.g., "ethoxy" at locant 2)
        const alkoxyLocants = this.context.getLocantsBeforeSubstituent(
          alkoxySubst,
          locantTokens,
        );
        for (const loc of alkoxyLocants) {
          const atomIdx = this.context.locantToAtomIndex(
            loc,
            alkylBaseAtoms,
            false,
          );
          if (atomIdx !== null) {
            // Build alkoxy: alkyl-O-
            const alkoxyValue = alkoxySubst.value.replace("oxy", "");
            let alkoxyChainLength = 1;
            if (alkoxyValue.startsWith("meth")) alkoxyChainLength = 1;
            else if (alkoxyValue.startsWith("eth")) alkoxyChainLength = 2;
            else if (alkoxyValue.startsWith("prop")) alkoxyChainLength = 3;
            else if (alkoxyValue.startsWith("but")) alkoxyChainLength = 4;
            else if (alkoxyValue.startsWith("pent")) alkoxyChainLength = 5;
            else if (alkoxyValue.startsWith("hex")) alkoxyChainLength = 6;

            const alkoxyAlkylAtoms =
              builder.createLinearChain(alkoxyChainLength);
            const alkoxyO = builder.addAtom("O");
            builder.addBond(alkoxyAlkylAtoms[0]!, alkoxyO);
            builder.addBond(alkoxyO, atomIdx);
          }
        }

        if (process.env.VERBOSE) {
          console.log("[case-1.5] Built acyloxy + alkoxy + alkyl structure");
        }

        // Return all atoms, attach at the base alkyl chain
        const allAtoms = [...acylAtoms, carbonylO, etherO, ...alkylBaseAtoms];
        return {
          fragmentAtoms: allAtoms,
          attachmentPoint: alkylBaseAtoms[alkylBaseAtoms.length - 1]!,
        };
      }
    }

    // Case 2: Check for alkoxy patterns with substituents (e.g., "2,2-dimethylpropoxy")
    // Look for alkoxy substituent tokens (but NOT phenoxy)
    // BUT: skip if we have oxy+yl suffixes (that's the alkyl-oxy-methoxy pattern for later)
    const hasOxyAndYlSuffixes =
      suffixTokens.some((s) => s.value === "oxy") &&
      suffixTokens.some((s) => s.value === "yl");
    const alkoxySubst = substituentTokens.find(
      (s) =>
        s.value.endsWith("oxy") &&
        !s.value.startsWith("hydroxy") &&
        s.value !== "oxy" &&
        !s.value.endsWith("phenoxy"),
    );

    if (process.env.VERBOSE) {
      console.log(
        `[case-2] alkoxySubst=${alkoxySubst?.value}, count=${substituentTokens.length}, hasOxyAndYl=${hasOxyAndYlSuffixes}`,
      );
    }

    if (alkoxySubst && substituentTokens.length > 1 && !hasOxyAndYlSuffixes) {
      // Pattern: substituents + alkoxy (e.g., "dimethyl" + "propoxy")
      const alkoxyValue = alkoxySubst.value;

      // Determine base alkyl chain from alkoxy name
      let chainLength = 1; // default methoxy
      if (alkoxyValue.startsWith("meth")) chainLength = 1;
      else if (alkoxyValue.startsWith("eth")) chainLength = 2;
      else if (alkoxyValue.startsWith("prop")) chainLength = 3;
      else if (alkoxyValue.startsWith("but")) chainLength = 4;
      else if (alkoxyValue.startsWith("pent")) chainLength = 5;
      else if (alkoxyValue.startsWith("hex")) chainLength = 6;

      // Build the alkyl chain
      const alkylAtoms = builder.createLinearChain(chainLength);

      // Apply substituents to the alkyl chain
      const otherSubsts = substituentTokens.filter((s) => s !== alkoxySubst);
      for (const subst of otherSubsts) {
        const substLocants = this.context.getLocantsBeforeSubstituent(
          subst,
          locantTokens,
        );
        for (const loc of substLocants) {
          const atomIdx = this.context.locantToAtomIndex(
            loc,
            alkylAtoms,
            false,
          );
          if (atomIdx !== null) {
            if (subst.value === "methyl") {
              builder.addMethyl(atomIdx);
            } else if (subst.value === "ethyl") {
              builder.addEthyl(atomIdx);
            }
          }
        }
      }

      // Add oxygen at the first carbon (position 1 of alkyl chain)
      const oxygenIdx = builder.addAtom("O");
      builder.addBond(alkylAtoms[0]!, oxygenIdx);

      return {
        fragmentAtoms: [...alkylAtoms, oxygenIdx],
        attachmentPoint: oxygenIdx,
      };
    }

    // Case 2: sulfur compounds (e.g., "phenylsulfonyl", "methylsulfinyl", "methylsulfanyl")

    // Case 2c: Handle amino-ending substituents (e.g., "tert-butylamino", "benzylamino")
    // Pattern: [alkyl substituent, "amino"]
    if (
      substituentTokens.length >= 2 &&
      parentTokens.length === 0 &&
      suffixTokens.length === 0
    ) {
      const lastSubst = substituentTokens[substituentTokens.length - 1]!;
      if (lastSubst.value === "amino") {
        if (process.env.VERBOSE) {
          console.log(
            `[nested-substituent] Building amino compound with prefix: ${substituentTokens
              .slice(0, -1)
              .map((s) => s.value)
              .join("-")}`,
          );
        }

        let alkylAtoms: number[] = [];

        // Handle the alkyl substituent(s) before "amino"
        for (let i = 0; i < substituentTokens.length - 1; i++) {
          const substValue = substituentTokens[i]!.value;

          if (substValue === "tert-butyl" || substValue === "tertbutyl") {
            const c = builder.addCarbon();
            builder.addMethyl(c);
            builder.addMethyl(c);
            builder.addMethyl(c);
            alkylAtoms = [c];
          } else if (substValue === "methyl") {
            alkylAtoms.push(builder.addCarbon());
          } else if (substValue === "ethyl") {
            alkylAtoms.push(...builder.createLinearChain(2));
          } else if (substValue === "phenyl") {
            alkylAtoms.push(...builder.createBenzeneRing());
          }
        }

        // Add nitrogen and connect to alkyl
        const nIdx = builder.addAtom("N");
        if (alkylAtoms.length > 0) {
          builder.addBond(alkylAtoms[alkylAtoms.length - 1]!, nIdx);
        }

        return {
          fragmentAtoms: [...alkylAtoms, nIdx],
          attachmentPoint: nIdx,
        };
      }
    }

    // Case 3: acyl pattern (e.g., "2-methylpropanoyl", "acetyl", "butanoyl")
    const hasOylSuffix = suffixTokens.some((s) => s.value === "oyl");
    if (hasOylSuffix && parentTokens.length > 0) {
      // Build acyl group: R-C(=O)- where R is the alkyl chain
      const parentToken = parentTokens[0]!;
      const smiles = parentToken.metadata?.smiles as string;

      if (smiles) {
        // For acyl groups, the parent alkane refers to the full hydrocarbon (e.g., "prop" = propane = 3 carbons)
        // But for acyl, we need the alkyl part (e.g., propanoyl = CH3-CH2-C(=O) which is 2-carbon alkyl + carbonyl)
        // So we use chainLength - 1 for the initial chain, then add the carbonyl carbon
        const acylChainLength = Math.max(1, smiles.length - 1);
        const chainAtoms = builder.createLinearChain(acylChainLength);

        // Apply any substituents to the chain (e.g., "methyl" in "2-methylpropanoyl")
        // Separate amino from other substituents as it requires special handling
        const hasAminoSubst = substituentTokens.some(
          (s) => s.value === "amino",
        );
        for (const subst of substituentTokens) {
          if (subst.value === "amino") continue; // Handle separately below

          const substLocants = this.context.getLocantsBeforeSubstituent(
            subst,
            locantTokens,
          );
          for (const loc of substLocants) {
            const atomIdx = this.context.locantToAtomIndex(
              loc,
              chainAtoms,
              false,
            );
            if (atomIdx !== null) {
              if (subst.value === "methyl") {
                builder.addMethyl(atomIdx);
              } else if (subst.value === "ethyl") {
                builder.addEthyl(atomIdx);
              }
            }
          }
        }

        // Add carbonyl at the end: -C(=O)
        const carbonylC = builder.addAtom("C");
        const carbonylO = builder.addAtom("O");
        builder.addBond(chainAtoms[chainAtoms.length - 1]!, carbonylC);
        builder.addBond(carbonylC, carbonylO, BondTypeEnum.DOUBLE);

        // Handle amide: if "amino" is present, add nitrogen bonded to carbonyl
        let attachmentPoint: number = carbonylC;
        let fragmentAtoms: number[] = [...chainAtoms, carbonylC, carbonylO];

        if (hasAminoSubst) {
          const nIdx = builder.addAtom("N");
          builder.addBond(carbonylC, nIdx);
          attachmentPoint = nIdx;
          fragmentAtoms.push(nIdx);

          if (process.env.VERBOSE) {
            console.log(
              `[nested-substituent] Built acylamino group with ${acylChainLength} carbons + carbonyl + N`,
            );
          }
        } else {
          if (process.env.VERBOSE) {
            console.log(
              `[nested-substituent] Built acyl group with ${acylChainLength} carbons + carbonyl`,
            );
          }
        }

        return {
          fragmentAtoms,
          attachmentPoint, // Attach via carbonyl carbon for acyl, or nitrogen for amide
        };
      }
    }

    // Case 4a: alkyl-oxy-methoxy pattern (e.g., "2-methylbutan-2-yloxymethoxy")
    // CHECK THIS BEFORE simple alkyl patterns since it also uses "yl" suffix
    // Pattern: alkyl-yl-oxy-methoxy - builds branched alkyl connected via oxygen to a methoxy group
    const hasOxySuffix = suffixTokens.some((s) => s.value === "oxy");
    const hasMethoxySubst = substituentTokens.some(
      (s) => s.value === "methoxy",
    );
    const hasYlSuffixTemp = suffixTokens.some((s) => s.value === "yl");

    if (process.env.VERBOSE) {
      console.log(
        `[case-4a] hasYl=${hasYlSuffixTemp}, hasOxy=${hasOxySuffix}, hasMethoxy=${hasMethoxySubst}, parents=${parentTokens.length}`,
      );
    }

    if (
      hasYlSuffixTemp &&
      hasOxySuffix &&
      hasMethoxySubst &&
      parentTokens.length > 0
    ) {
      // Build the alkyl-oxy part first
      const parentToken = parentTokens[0]!;
      const parentValue = parentToken.value.toLowerCase();
      const ylToken = suffixTokens.find((s) => s.value === "yl")!;
      const attachLocants = this.context.getLocantsBeforeSuffix(
        ylToken,
        locantTokens,
      );
      const attachPosition = attachLocants.length > 0 ? attachLocants[0]! : 1;

      if (process.env.VERBOSE) {
        console.log(
          `[nested-substituent] Checking alkyl-oxy-methoxy: parentValue=${parentValue}, attachPosition=${attachPosition}, hasMethoxySubst=${hasMethoxySubst}`,
        );
      }

      // Check if this is a known branched pattern
      let alkylFragment: {
        fragmentAtoms: number[];
        attachmentPoint: number;
      } | null = null;

      if (
        parentValue === "but" &&
        attachPosition === 2 &&
        substituentTokens.some((s) => s.value === "methyl")
      ) {
        // "2-methylbutan-2-yl": butane chain with methyl at position 2
        // C-C(CH3)-C-C, attached at position 2
        const chainLength = 4;
        const chainAtoms = builder.createLinearChain(chainLength);

        // Add methyl at position 2 (index 1)
        builder.addMethyl(chainAtoms[1]!);

        alkylFragment = {
          fragmentAtoms: chainAtoms,
          attachmentPoint: chainAtoms[1]!, // Attach at position 2
        };
      } else if (
        parentValue === "prop" &&
        attachPosition === 2 &&
        substituentTokens.length === 1
      ) {
        // "propan-2-yl" + "methoxy" - but only if methoxy is the only other substituent
        if (substituentTokens[0]?.value === "methoxy") {
          alkylFragment = this.context.buildBranchedAlkylFragment(
            builder,
            "isopropyl",
          );
        }
      }

      if (alkylFragment) {
        // Now add oxygen to connect the alkyl to methoxy
        const oxyIdx = builder.addAtom("O");
        builder.addBond(alkylFragment.attachmentPoint, oxyIdx);

        // Add methoxy chain: OCH2O
        const ch2Idx = builder.addCarbon();
        builder.addBond(oxyIdx, ch2Idx);

        const finalOxyIdx = builder.addAtom("O");
        builder.addBond(ch2Idx, finalOxyIdx);

        if (process.env.VERBOSE) {
          console.log("[nested-substituent] Built alkyl-oxy-methoxy pattern");
        }

        return {
          fragmentAtoms: [
            ...alkylFragment.fragmentAtoms,
            oxyIdx,
            ch2Idx,
            finalOxyIdx,
          ],
          attachmentPoint: finalOxyIdx, // Attach via the final oxygen
        };
      }
    }

    // Case 4b: alkyl pattern (e.g., "propan-2-yl") - checked AFTER alkyl-oxy-methoxy
    // Also handles alkynes (e.g., "prop-1-yn-1-yl" or "prop-1-ynyl")
    const hasYlSuffix = suffixTokens.some((s) => s.value === "yl");
    const hasYnSuffix = suffixTokens.some(
      (s) => s.value && (s.value.endsWith("yn") || s.value.endsWith("yne")),
    );
    const isAlkyne = hasYnSuffix && hasYlSuffix;

    if ((hasYlSuffix || isAlkyne) && parentTokens.length > 0) {
      // Build alkyl chain or alkyne chain
      const parentToken = parentTokens[0]!;
      const parentValue = parentToken.value.toLowerCase();

      // Find attachment point from locants before "yl" suffix
      const ylToken = suffixTokens.find((s) => s.value === "yl")!;
      const attachLocants = this.context.getLocantsBeforeSuffix(
        ylToken,
        locantTokens,
      );
      const attachPosition = attachLocants.length > 0 ? attachLocants[0]! : 1;

      // Handle alkyne case: find triple bond position
      let triplePos: number | null = null;
      if (isAlkyne) {
        const ynToken = suffixTokens.find(
          (s) => s.value && (s.value.endsWith("yn") || s.value.endsWith("yne")),
        )!;
        const ynLocants = this.context.getLocantsBeforeSuffix(
          ynToken,
          locantTokens,
        );
        if (ynLocants.length > 0) {
          triplePos = ynLocants[0]!;
        }
      }

      // Special case: "propan-2-yl" = isopropyl
      if (
        parentValue === "prop" &&
        attachPosition === 2 &&
        substituentTokens.length === 0 &&
        !isAlkyne
      ) {
        return this.context.buildBranchedAlkylFragment(builder, "isopropyl");
      }

      // Special case: "butan-2-yl" = sec-butyl
      if (
        parentValue === "but" &&
        attachPosition === 2 &&
        substituentTokens.length === 0 &&
        !isAlkyne
      ) {
        return this.context.buildBranchedAlkylFragment(builder, "sec-butyl");
      }

      // Special case: "2-methylpropan-2-yl" = tert-butyl
      if (
        parentValue === "prop" &&
        attachPosition === 2 &&
        substituentTokens.some((s) => s.value === "methyl") &&
        !isAlkyne
      ) {
        return this.context.buildBranchedAlkylFragment(builder, "tert-butyl");
      }

      // Special case: "2-methylbutan-2-yl"
      if (
        parentValue === "but" &&
        attachPosition === 2 &&
        substituentTokens.some((s) => s.value === "methyl") &&
        !isAlkyne
      ) {
        // Build butane chain with methyl at position 2
        const chainAtoms = builder.createLinearChain(4);
        builder.addMethyl(chainAtoms[1]!);
        return {
          fragmentAtoms: chainAtoms,
          attachmentPoint: chainAtoms[1]!,
        };
      }

      // Build linear alkyl chain (or alkyne chain)
      const smiles = parentToken.metadata?.smiles as string;
      if (smiles) {
        const chainLength = smiles.length;
        const chainAtoms = builder.createLinearChain(chainLength);

        // Add triple bond if this is an alkyne
        if (isAlkyne && triplePos !== null) {
          if (triplePos >= 1 && triplePos < chainAtoms.length) {
            const atom1 = chainAtoms[triplePos - 1]!;
            const atom2 = chainAtoms[triplePos]!;
            builder.addTripleBond(atom1, atom2);
          }
        }

        // Apply any substituents to the chain (e.g., "methyl" in "2-methylpropan-2-yl")
        for (const subst of substituentTokens) {
          const substLocants = this.context.getLocantsBeforeSubstituent(
            subst,
            locantTokens,
          );
          for (const loc of substLocants) {
            const atomIdx = this.context.locantToAtomIndex(
              loc,
              chainAtoms,
              false,
            );
            if (atomIdx !== null) {
              // Apply simple substituents
              if (subst.value === "methyl") {
                builder.addMethyl(atomIdx);
              } else if (subst.value === "ethyl") {
                builder.addEthyl(atomIdx);
              } else if (subst.value === "iodo" || subst.value === "iod") {
                const iIdx = builder.addAtom("I");
                builder.addBond(atomIdx, iIdx);
              } else if (subst.value === "bromo" || subst.value === "brom") {
                const brIdx = builder.addAtom("Br");
                builder.addBond(atomIdx, brIdx);
              } else if (subst.value === "chloro" || subst.value === "chlor") {
                const clIdx = builder.addAtom("Cl");
                builder.addBond(atomIdx, clIdx);
              } else if (subst.value === "fluoro" || subst.value === "fluor") {
                const fIdx = builder.addAtom("F");
                builder.addBond(atomIdx, fIdx);
              } else if (
                subst.value === "hydroxy" ||
                subst.value === "hydrox"
              ) {
                builder.addHydroxyl(atomIdx);
              } else if (subst.value === "amino") {
                builder.addAmino(atomIdx);
              } else if (subst.value === "oxo") {
                builder.addCarbonyl(atomIdx);
              }
            }
          }
        }

        // For terminal attachment (position 1), return the first atom
        const attachIdx = this.context.locantToAtomIndex(
          attachPosition,
          chainAtoms,
          false,
        );

        if (attachIdx !== null) {
          return {
            fragmentAtoms: chainAtoms,
            attachmentPoint: attachIdx,
          };
        }
      }
    }

    // Special Case: Alkyl chain with substituents and multiplier (e.g., "3-hydroxy-2,4,4-trimethylpentyl")
    // Pattern: MULTIPLIER + SUBSTITUENT(s) + SUFFIX:yl, but no parent token
    // The multiplier indicates the base chain length
    const hasYlSuffixForAlkyl = suffixTokens.some((s) => s.value === "yl");
    const hasMultiplier = nestedTokens.some((t) => t.type === "MULTIPLIER");

    if (
      hasYlSuffixForAlkyl &&
      hasMultiplier &&
      parentTokens.length === 0 &&
      substituentTokens.length > 0
    ) {
      if (process.env.VERBOSE) {
        console.log(
          "[case-alkyl-with-multiplier] Building alkyl chain from multiplier with substituents",
        );
      }

      // Find the LAST multiplier before the yl suffix (that's the chain length)
      // Earlier multipliers are count multipliers (like "tri" in "trimethyl")
      const ylToken = suffixTokens.find((s) => s.value === "yl");
      const multipliers = nestedTokens.filter((t) => t.type === "MULTIPLIER");
      let multiplierToken = null;

      if (ylToken && multipliers.length > 0) {
        // Get multipliers that come before the yl suffix
        const multBeforeYl = multipliers.filter(
          (m) => m.position < ylToken.position,
        );
        // The last one is likely the chain length (e.g., "pent" in "trimethylpentyl")
        multiplierToken =
          multBeforeYl.length > 0
            ? multBeforeYl[multBeforeYl.length - 1]!
            : multipliers[0]!;
      } else {
        multiplierToken = multipliers[0]!;
      }

      let baseChainLength = 0;

      if (multiplierToken) {
        const multValue = multiplierToken.value.toLowerCase();
        if (multValue === "pent" || multValue === "pentyl") baseChainLength = 5;
        else if (multValue === "but" || multValue === "butyl")
          baseChainLength = 4;
        else if (multValue === "prop" || multValue === "propyl")
          baseChainLength = 3;
        else if (multValue === "meth" || multValue === "methyl")
          baseChainLength = 1;
        else if (multValue === "eth" || multValue === "ethyl")
          baseChainLength = 2;
        else if (multValue === "hex" || multValue === "hexyl")
          baseChainLength = 6;
        else if (multValue === "hept" || multValue === "heptyl")
          baseChainLength = 7;

        if (process.env.VERBOSE) {
          console.log(
            `[case-alkyl-with-multiplier] Found multiplier: ${multiplierToken.value}, baseChainLength: ${baseChainLength}`,
          );
        }
      }

      if (baseChainLength > 0) {
        const chainAtoms = builder.createLinearChain(baseChainLength);

        // Apply substituents to the chain
        for (const subst of substituentTokens) {
          const substLocants = this.context.getLocantsBeforeSubstituent(
            subst,
            locantTokens,
          );

          for (const loc of substLocants) {
            const atomIdx = this.context.locantToAtomIndex(
              loc,
              chainAtoms,
              false,
            );
            if (atomIdx !== null) {
              if (subst.value === "hydroxy" || subst.value === "hydroxyl") {
                builder.addHydroxyl(atomIdx);
              } else if (subst.value === "methyl") {
                builder.addMethyl(atomIdx);
              } else if (subst.value === "ethyl") {
                builder.addEthyl(atomIdx);
              } else if (subst.value === "chloro") {
                const clIdx = builder.addAtom("Cl");
                builder.addBond(atomIdx, clIdx);
              } else if (subst.value === "bromo") {
                const brIdx = builder.addAtom("Br");
                builder.addBond(atomIdx, brIdx);
              } else if (subst.value === "oxo") {
                const oIdx = builder.addAtom("O");
                builder.addBond(atomIdx, oIdx, BondTypeEnum.DOUBLE);
              }
            }
          }
        }

        if (process.env.VERBOSE) {
          console.log(
            `[case-alkyl-with-multiplier] Built alkyl chain length ${baseChainLength} with substituents`,
          );
        }

        // Attachment point is the first atom of the chain (position 1)
        return {
          fragmentAtoms: chainAtoms,
          attachmentPoint: chainAtoms[0]!,
        };
      }
    }

    // Case: Silyl + oxy + alkyl (e.g., "[tert-butyl(dimethyl)silyl]oxymethyl")
    // Pattern: first substituent is silyl, has "oxy" suffix, followed by alkyl substituent
    // Must check this BEFORE "case-substituted-alkyl" which would incorrectly match "methyl" as base
    if (
      substituentTokens.length >= 2 &&
      parentTokens.length === 0 &&
      suffixTokens.length === 1 &&
      suffixTokens[0]!.value === "oxy"
    ) {
      const firstSubst = substituentTokens[0]!.value;
      if (firstSubst.includes("silyl") || firstSubst.includes("silanyl")) {
        // Build silyl group
        let silylName = firstSubst;
        if (silylName.endsWith("silyloxy")) {
          silylName = silylName.slice(0, -3);
        } else if (silylName.endsWith("silanyloxy")) {
          silylName = silylName.slice(0, -3);
        }

        const siIdx = this.context.buildSilylGroup(builder, silylName);

        if (process.env.VERBOSE) {
          console.log(`[case-silyl-oxy-alkyl] Built silyl group: ${silylName}`);
        }

        // Add oxygen linkage
        const oIdx = builder.addAtom("O");
        builder.addBond(siIdx, oIdx);

        if (process.env.VERBOSE) {
          console.log(
            `[case-silyl-oxy-alkyl] Added oxygen linkage for silyl-oxy pattern`,
          );
        }

        // Build remaining substituents (e.g., "methyl" in "oxymethyl")
        const remainingSubsts = substituentTokens.slice(1);
        const chainAtoms: number[] = [];

        for (const subst of remainingSubsts) {
          const substName = subst.value;
          // Simple alkyl groups
          if (substName === "methyl") {
            const cIdx = builder.addAtom("C");
            chainAtoms.push(cIdx);
          } else if (substName === "ethyl") {
            const c1 = builder.addAtom("C");
            const c2 = builder.addAtom("C");
            builder.addBond(c1, c2);
            chainAtoms.push(c1, c2);
          } else if (substName === "propyl") {
            const c1 = builder.addAtom("C");
            const c2 = builder.addAtom("C");
            const c3 = builder.addAtom("C");
            builder.addBond(c1, c2);
            builder.addBond(c2, c3);
            chainAtoms.push(c1, c2, c3);
          } else {
            // Try to build as nested substituent
            const nestedResult = this.buildNestedSubstituent(builder, [subst]);
            if (nestedResult) {
              chainAtoms.push(...nestedResult.fragmentAtoms);
            }
          }
        }

        if (chainAtoms.length > 0) {
          // Connect oxygen to first carbon of the chain
          builder.addBond(oIdx, chainAtoms[0]!);

          if (process.env.VERBOSE) {
            console.log(
              `[case-silyl-oxy-alkyl] Connected silyl-O to ${remainingSubsts.map((s) => s.value).join("-")} chain`,
            );
          }

          return {
            fragmentAtoms: [siIdx, oIdx, ...chainAtoms],
            attachmentPoint: chainAtoms[0]!,
          };
        }

        // If no chain atoms, just return silyl-O
        return {
          fragmentAtoms: [siIdx, oIdx],
          attachmentPoint: oIdx,
        };
      }
    }

    // Case: Substituted alkyl group (e.g., "2-oxoethyl", "2-chloroethyl")
    // Pattern: one alkyl substituent (base) + other substituents
    // And parentTokens is empty (because alkyl is tokenized as substituent)
    const alkylBaseToken = substituentTokens.find((s) => {
      const v = s.value.toLowerCase();
      // Remove any "yl" suffix for checking base
      const base = v.endsWith("yl") ? v.slice(0, -2) : v;

      return (
        base === "meth" ||
        base === "methyl" ||
        base === "eth" ||
        base === "ethyl" ||
        base === "prop" ||
        base === "propyl" ||
        base === "but" ||
        base === "butyl" ||
        base === "pent" ||
        base === "pentyl" ||
        base === "hex" ||
        base === "hexyl" ||
        base === "hept" ||
        base === "heptyl" ||
        base === "oct" ||
        base === "octyl" ||
        base === "non" ||
        base === "nonyl" ||
        base === "dec" ||
        base === "decyl"
      );
    });

    if (
      parentTokens.length === 0 &&
      alkylBaseToken &&
      substituentTokens.length > 1
    ) {
      if (process.env.VERBOSE) {
        console.log(
          `[case-substituted-alkyl] Building substituted alkyl based on ${alkylBaseToken.value}`,
        );
      }

      // 1. Build the alkyl chain
      let chainLen = 1;
      const val = alkylBaseToken.value.toLowerCase();
      if (val.startsWith("eth")) chainLen = 2;
      else if (val.startsWith("prop")) chainLen = 3;
      else if (val.startsWith("but")) chainLen = 4;
      else if (val.startsWith("pent")) chainLen = 5;
      else if (val.startsWith("hex")) chainLen = 6;
      else if (val.startsWith("hept")) chainLen = 7;
      else if (val.startsWith("oct")) chainLen = 8;
      else if (val.startsWith("non")) chainLen = 9;
      else if (val.startsWith("dec")) chainLen = 10;

      const chainAtoms = builder.createLinearChain(chainLen);

      // 2. Apply other substituents to this chain
      const otherSubsts = substituentTokens.filter((s) => s !== alkylBaseToken);

      // Collect all locants. Since there's no parent token, all locants apply to this chain.
      // (Unless some are consumed by nested substituents inside otherSubsts, which applySubstituents handles)
      const allLocants = [...locantTokens];

      if (otherSubsts.length > 0) {
        const _hasOxySuffix = suffixTokens.some((s) => s.value === "oxy");
        const remainingSubsts: IUPACToken[] = [];

        for (const subst of otherSubsts) {
          remainingSubsts.push(subst);
        }

        if (remainingSubsts.length > 0) {
          this.context.applySubstituents(
            builder,
            chainAtoms,
            remainingSubsts,
            allLocants,
            multiplierTokens, // Pass multipliers!
            false,
            [], // suffix
            [], // prefix
          );
        }
      }

      return {
        fragmentAtoms: chainAtoms,
        attachmentPoint: chainAtoms[0]!, // Standard alkyl attachment at position 1
      };
    }

    // Special Case: Alkyl chain with complex multi-position parenthetical substituents
    // Pattern: LOCANT (e.g., 2,3), MULTIPLIER (e.g., bis), PARENTHETICAL (e.g., trimethylsilyloxy), PARENT (e.g., propyl)
    // Example: "2,3-bis(trimethylsilyloxy)propyl" → chain with substituents at positions 2 and 3
    const hasParenthSubst = substituentTokens.some(
      (s) => s.isInParentheses && s.nestedTokens && s.nestedTokens.length > 0,
    );
    const simpleAlkylParent = parentTokens.find((p) => {
      const pval = p.value.toLowerCase();
      return (
        pval === "prop" ||
        pval === "but" ||
        pval === "pent" ||
        pval === "hex" ||
        pval === "hept"
      );
    });

    if (hasParenthSubst && simpleAlkylParent && locantTokens.length > 0) {
      if (process.env.VERBOSE) {
        console.log(
          "[case-alkyl-multi-parenth] Building alkyl with multi-position parenthetical substituents",
        );
      }

      // Get alkyl chain length
      const alkylValue = simpleAlkylParent.value.toLowerCase();
      let cLen = 0;
      if (alkylValue === "prop") cLen = 3;
      else if (alkylValue === "but") cLen = 4;
      else if (alkylValue === "pent") cLen = 5;
      else if (alkylValue === "hex") cLen = 6;
      else if (alkylValue === "hept") cLen = 7;

      if (cLen > 0) {
        const cAtoms = builder.createLinearChain(cLen);
        const firstPSub = substituentTokens.find(
          (s) =>
            s.isInParentheses && s.nestedTokens && s.nestedTokens.length > 0,
        );

        if (firstPSub && firstPSub.nestedTokens) {
          const sLocants = this.context.getLocantsBeforeSubstituent(
            firstPSub,
            locantTokens,
          );

          // If multiplier exists (e.g. "bis"), we need to find all relevant locants
          // "2,3-bis(...)" means locants 2 and 3.
          // getLocantsBeforeSubstituent only finds the closest one (3).

          let finalLocants: number[] = [];
          const multiplier = this.context.getMultiplierBeforeSubstituent(
            firstPSub,
            multiplierTokens,
          );

          if (multiplier) {
            const count = (multiplier.metadata?.count as number) || 1;
            // Find N locants before multiplier
            const relevantLocants = locantTokens
              .filter((l) => l.position < multiplier.position)
              .sort((a, b) => b.position - a.position) // Descending position
              .slice(0, count);

            // Reverse back to original order
            const flattenedLocants: number[] = [];
            for (const l of relevantLocants.reverse()) {
              const positions = l.metadata?.positions as number[] | undefined;
              if (positions) {
                flattenedLocants.push(...positions);
              } else {
                flattenedLocants.push(parseInt(l.value));
              }
            }
            finalLocants = flattenedLocants;
          } else {
            finalLocants = sLocants;
          }

          if (process.env.VERBOSE) {
            console.log(
              `[case-alkyl-multi-parenth] Locants: ${finalLocants.join(", ")}`,
            );
          }

          if (finalLocants.length > 0) {
            // Apply substituent at each locant position
            for (const loc of finalLocants) {
              const aIdx = this.context.locantToAtomIndex(loc, cAtoms, false);
              if (aIdx !== null) {
                const sRes = this.buildNestedSubstituent(
                  builder,
                  firstPSub.nestedTokens,
                );
                if (sRes) {
                  builder.addBond(aIdx, sRes.attachmentPoint);
                }
              }
            }

            return {
              fragmentAtoms: cAtoms,
              attachmentPoint: cAtoms[0]!,
            };
          }
        }
      }
    }

    // Special Case: Complex phenyl with substituents (e.g., "3-chloro-4-hydroxyphenyl")
    // This handles nested tokens like: LOCANT:3, SUBSTITUENT:chloro, LOCANT:4, SUBSTITUENT:hydroxy, SUBSTITUENT:phenyl
    const hasPhenySubstituent = substituentTokens.some(
      (s) => s.value === "phenyl",
    );
    const hasOtherSubstituents =
      substituentTokens.length > 1 &&
      substituentTokens.some((s) => s.value !== "phenyl");

    if (
      hasPhenySubstituent &&
      hasOtherSubstituents &&
      parentTokens.length === 0
    ) {
      if (process.env.VERBOSE) {
        console.log("[case-complex-phenyl] Building phenyl with substituents");
      }

      // Create benzene ring
      const benzeneAtoms = builder.createBenzeneRing();

      // Apply non-phenyl substituents to the benzene ring
      for (const subst of substituentTokens.filter(
        (s) => s.value !== "phenyl",
      )) {
        const substLocants = this.context.getLocantsBeforeSubstituent(
          subst,
          locantTokens,
        );

        for (const loc of substLocants) {
          const benzeneAtomIdx = this.context.locantToAtomIndex(
            loc,
            benzeneAtoms,
            false,
          );
          if (benzeneAtomIdx !== null) {
            if (subst.value === "chloro") {
              const clIdx = builder.addAtom("Cl");
              builder.addBond(benzeneAtomIdx, clIdx);
            } else if (subst.value === "bromo") {
              const brIdx = builder.addAtom("Br");
              builder.addBond(benzeneAtomIdx, brIdx);
            } else if (subst.value === "iodo" || subst.value === "iod") {
              const iIdx = builder.addAtom("I");
              builder.addBond(benzeneAtomIdx, iIdx);
            } else if (subst.value === "fluoro") {
              const fIdx = builder.addAtom("F");
              builder.addBond(benzeneAtomIdx, fIdx);
            } else if (
              subst.value === "hydroxy" ||
              subst.value === "hydroxyl"
            ) {
              builder.addHydroxyl(benzeneAtomIdx);
            } else if (subst.value === "methyl") {
              builder.addMethyl(benzeneAtomIdx);
            } else if (subst.value === "methoxy") {
              builder.addMethoxy(benzeneAtomIdx);
            } else if (subst.value === "amino") {
              const nIdx = builder.addAtom("N");
              builder.addBond(benzeneAtomIdx, nIdx);
            } else if (subst.value === "nitro") {
              const nIdx = builder.addAtom("N");
              const o1Idx = builder.addAtom("O");
              const o2Idx = builder.addAtom("O");
              builder.addBond(benzeneAtomIdx, nIdx);
              builder.addBond(nIdx, o1Idx, BondTypeEnum.DOUBLE);
              builder.addBond(nIdx, o2Idx, BondTypeEnum.SINGLE);
              builder.setCharge(nIdx, 1);
              builder.setCharge(o2Idx, -1);
            }
          }
        }
      }

      // Attach at position 1 (or first position) of benzene ring
      if (benzeneAtoms[0] !== undefined) {
        return {
          fragmentAtoms: benzeneAtoms,
          attachmentPoint: benzeneAtoms[0],
        };
      }
    }

    // Special case: Silyl groups (e.g., "trimethylsilyl", "trimethylsilyloxy", "tert-butyl(dimethyl)silyl")
    // Pattern: single substituent with "silyl" in the name
    if (
      substituentTokens.length === 1 &&
      parentTokens.length === 0 &&
      // Allow optional 'oxy' suffix
      (suffixTokens.length === 0 ||
        (suffixTokens.length === 1 && suffixTokens[0]!.value === "oxy"))
    ) {
      const substValue = substituentTokens[0]!.value;
      const hasOxySuffix =
        suffixTokens.length === 1 && suffixTokens[0]!.value === "oxy";

      if (substValue.includes("silyl") || substValue.includes("silanyl")) {
        const isSilyloxy = substValue.endsWith("oxy") || hasOxySuffix;

        // Normalize name for builder
        let silylName = substValue;
        if (silylName.endsWith("silyloxy")) {
          silylName = silylName.slice(0, -3);
        } else if (silylName.endsWith("silanyloxy")) {
          silylName = silylName.slice(0, -3);
        }

        const siIdx = this.context.buildSilylGroup(builder, silylName);

        if (process.env.VERBOSE) {
          console.log(
            `[nested-substituent] Built silyl group: ${silylName} (isSilyloxy=${isSilyloxy})`,
          );
        }

        if (isSilyloxy) {
          const oIdx = builder.addAtom("O");
          builder.addBond(oIdx, siIdx);
          return {
            fragmentAtoms: [oIdx, siIdx],
            attachmentPoint: oIdx,
          };
        } else {
          return {
            fragmentAtoms: [siIdx],
            attachmentPoint: siIdx,
          };
        }
      }
    }

    // Default: couldn't build this nested substituent
    return null;
  }
}
