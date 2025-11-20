import type { IUPACToken } from "./iupac-types";
import { MoleculeGraphBuilder } from "../molecule-graph-builder";
import { BondType as BondTypeEnum } from "types";
import type { IUPACNestedSubstituentBuilder } from "./iupac-nested-substituent-builder";

export interface IUPACSubstituentContext {
  locantToAtomIndex(
    locant: number,
    chainAtoms: number[],
    reverseNumbering?: boolean,
  ): number | null;
  getAlkylLength(alkylName: string): number;
  buildBranchedAlkylFragment(
    builder: MoleculeGraphBuilder,
    branchType: string,
  ): { fragmentAtoms: number[]; attachmentPoint: number } | null;
  buildSilylGroup(builder: MoleculeGraphBuilder, name: string): number;
  isNSubstitutionPrefix(prefix: IUPACToken | undefined): boolean;
  nestedBuilder: IUPACNestedSubstituentBuilder;
}

export class IUPACSubstituentApplicator {
  private context: IUPACSubstituentContext;

  constructor(context: IUPACSubstituentContext) {
    this.context = context;
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
    esterAttachmentPoints: number[] = [],
  ): Set<IUPACToken> {
    // Special handling for benzoate esters: complete the ester linkage
    const hasBenzoateSuffix = suffixTokens.some((s) => s.value === "benzoate");
    if (hasBenzoateSuffix && mainChainAtoms.length === 7) {
      // Benzoate parent: benzene (6) + carboxyl C (1) = 7 atoms
      // The suffix handler already added: carboxyl C, =O, and -O-
      // Now find the ester alkyl group (substituent without locant)
      const esterAlkylSubst = substituentTokens.find((s) => {
        const val = s.value.toLowerCase();
        const hasLocant = locantTokens.some(
          (l) => l.position < s.position && l.position !== 0,
        );
        return (
          !hasLocant &&
          !s.isInParentheses &&
          (val === "methyl" ||
            val === "ethyl" ||
            val === "propyl" ||
            val === "butyl" ||
            val === "pentyl")
        );
      });

      if (esterAlkylSubst) {
        // The carboxyl carbon is mainChainAtoms[6]
        // We need to find the ester oxygen and attach the alkyl group
        // Since we just created the oxygen in the suffix handler, we know it's
        // one of the most recently added atoms. We'll look for it by checking
        // which oxygen is single-bonded to the carboxyl carbon.

        // For now, let's use a simpler approach: just add the ester oxygen here
        // and attach the alkyl group immediately.
        const carboxylC = mainChainAtoms[6];

        if (carboxylC !== undefined) {
          // The suffix handler should have added an ester oxygen
          // But we need to find it. Let's just add our own and attach the alkyl.
          // First check how many oxygens are already connected to carboxylC
          // Actually, let's take a different approach: store the oxygen index.
          // For now, let's just manually build the ester group here.

          const esterOxyIdx = builder.addAtom("O");
          builder.addBond(carboxylC, esterOxyIdx);

          // Build the alkyl group and attach to ester oxygen
          if (esterAlkylSubst.value === "methyl") {
            const methylC = builder.addCarbon();
            builder.addBond(esterOxyIdx, methylC);
            if (process.env.VERBOSE) {
              console.log("[benzoate-ester] Completed methyl ester linkage");
            }
          } else if (esterAlkylSubst.value === "ethyl") {
            const ethylAtoms = builder.createLinearChain(2);
            builder.addBond(esterOxyIdx, ethylAtoms[0]!);
            if (process.env.VERBOSE) {
              console.log("[benzoate-ester] Completed ethyl ester linkage");
            }
          }

          // Remove this substituent from further processing
          const substIdx = substituentTokens.indexOf(esterAlkylSubst);
          if (substIdx >= 0) {
            substituentTokens.splice(substIdx, 1);
          }
        }
      }
    }

    // Track substituents that have been processed by other handlers
    const processedSubstituents = new Set<IUPACToken>();

    for (const substituent of substituentTokens) {
      // Skip if already processed by another handler
      if (processedSubstituents.has(substituent)) {
        if (process.env.VERBOSE) {
          console.log(
            `[substituent] Skipping ${substituent.value} - already processed`,
          );
        }
        continue;
      }

      // Check if this is an N-substituent (defer to applyNPrefixSubstituents)
      const nPrefix = prefixTokens.find((p) =>
        this.context.isNSubstitutionPrefix(p),
      );
      if (nPrefix && substituent.position > nPrefix.position) {
        // Check if it has explicit numeric locants
        const precedingLocant = locantTokens.find(
          (l) =>
            l.position < substituent.position &&
            l.position > nPrefix.position &&
            substituent.position - l.position < 20,
        );

        if (process.env.VERBOSE) {
          console.log(
            `[applySubstituents] Checking N-subst skip for ${substituent.value}. Preceding locant: ${precedingLocant?.value}`,
          );
        }

        if (!precedingLocant || !/^\d/.test(precedingLocant.value)) {
          // Only defer if we actually have amine nitrogens to attach to (e.g. from carboxamide)
          // otherwise applySubstituents will attach it to the ring (which might be wrong but better than nothing)
          // However, applyNPrefixSubstituents checks builder.getAmineNitrogenIndices()
          // We should check if we expect applyNPrefixSubstituents to run.
          // It runs if there is an N-prefix.
          if (process.env.VERBOSE) {
            console.log(
              `[applySubstituents] Skipping N-substituent ${substituent.value} (deferring to applyNPrefixSubstituents)`,
            );
          }
          continue;
        }
      }

      let modifiedSubstValue = substituent.value.toLowerCase();

      // Check for preceding cyclo prefix
      const cycloPrefix = prefixTokens.find(
        (p) =>
          p.metadata?.isCyclic &&
          p.position < substituent.position &&
          !prefixTokens.some(
            (x) => x.position > p.position && x.position < substituent.position,
          ),
      );

      if (cycloPrefix) {
        modifiedSubstValue = `cyclo${modifiedSubstValue}`;
      }

      // Check for following idene/ylidene suffix
      const ideneSuffix = suffixTokens.find(
        (s) =>
          ["idene", "ylidene"].includes(s.value.toLowerCase()) &&
          s.position > substituent.position &&
          !substituentTokens.some(
            (x) => x.position > substituent.position && x.position < s.position,
          ),
      );

      if (ideneSuffix) {
        modifiedSubstValue = `${modifiedSubstValue}idene`;
      }

      // Check if this is a parenthetical group with nested tokens
      // BUT: Skip this for simple substituents like trifluoromethyl that happen to be in parens
      const isSimpleSubstituent = [
        "trifluoromethyl",
        "fluoromethyl",
        "chloromethyl",
        "bromomethyl",
      ].includes(modifiedSubstValue);

      if (
        substituent.isInParentheses &&
        substituent.nestedTokens &&
        !isSimpleSubstituent
      ) {
        // Get locants for where to attach this substituent
        const locants = this.getLocantsBeforeSubstituent(
          substituent,
          locantTokens,
        );

        // Check for ester attachment (complex group without explicit locant attached to carboxylate)
        if (locants.length === 0 && esterAttachmentPoints.length > 0) {
          const oIdx = esterAttachmentPoints.shift();
          if (oIdx !== undefined) {
            const nestedResult =
              this.context.nestedBuilder.buildNestedSubstituent(
                builder,
                substituent.nestedTokens,
              );
            if (nestedResult) {
              builder.addBond(oIdx, nestedResult.attachmentPoint);
              if (process.env.VERBOSE) {
                console.log(
                  `[graph-builder] Attached nested ester group to oxygen ${oIdx}`,
                );
              }
            }
            continue;
          }
        }

        const positions = locants.length > 0 ? locants : [1];

        for (const loc of positions) {
          // Handle complex substituent by building it as a sub-molecule for each position
          const nestedResult =
            this.context.nestedBuilder.buildNestedSubstituent(
              builder,
              substituent.nestedTokens,
            );

          if (nestedResult) {
            const atomIdx = this.context.locantToAtomIndex(
              loc,
              mainChainAtoms,
              reverseNumbering,
            );
            if (atomIdx !== null) {
              let attachmentAtom = nestedResult.attachmentPoint;

              // Check if there's an "oxy" suffix following this substituent
              // This handles patterns like "(tert-butylamino)oxy" where oxy should create N-O
              const followingOxySuffix = suffixTokens.find(
                (s) =>
                  s.value === "oxy" &&
                  s.position > substituent.position &&
                  !substituentTokens.some(
                    (x) =>
                      x.position > substituent.position &&
                      x.position < s.position,
                  ),
              );

              if (followingOxySuffix && nestedResult.fragmentAtoms.length > 0) {
                // The attachment point is likely a nitrogen, so add oxygen linkage
                const oxyIdx = builder.addAtom("O");
                builder.addBond(attachmentAtom, oxyIdx);
                attachmentAtom = oxyIdx;

                if (process.env.VERBOSE) {
                  console.log(
                    `[nested-substituent] Added oxygen linkage for oxy suffix`,
                  );
                }
              }

              // Attach the nested substituent at this position
              // Check if nested tokens indicate ylidene (double bond attachment)
              const hasYlideneSuffix = substituent.nestedTokens?.some(
                (t) =>
                  t.type === "SUFFIX" &&
                  (t.value === "idene" || t.value === "ylidene"),
              );

              if (hasYlideneSuffix) {
                builder.addDoubleBond(atomIdx, attachmentAtom);
                if (process.env.VERBOSE) {
                  console.log(
                    `[nested-substituent] Attached ${modifiedSubstValue} at position ${loc} via DOUBLE bond (ylidene)`,
                  );
                }
              } else {
                builder.addBond(atomIdx, attachmentAtom);

                if (process.env.VERBOSE) {
                  console.log(
                    `[nested-substituent] Attached ${modifiedSubstValue} at position ${loc}`,
                  );
                }
              }
            }
          } else {
            // Couldn't build nested substituent - skip it
            if (process.env.VERBOSE) {
              console.log(
                `[graph-builder] Could not build parenthetical substituent: ${modifiedSubstValue}`,
              );
            }
          }
        }
        // Mark nested substituent as processed
        processedSubstituents.add(substituent);
        continue;
      }

      // Get multiplier and locants for this substituent
      const multiplier = this.getMultiplierBeforeSubstituent(
        substituent,
        multiplierTokens,
      );
      let multiplierCount = multiplier
        ? (multiplier.metadata?.count as number) || 1
        : 1;
      let locants = this.getLocantsBeforeSubstituent(substituent, locantTokens);

      if (process.env.VERBOSE && substituent.value.includes("phenyl")) {
        console.log(
          `[substituent-locant-mapping] "${substituent.value}" -> locants: [${locants.join(",")}] (from ${locantTokens.length} tokens)`,
        );
      }

      // Check if we need to extract locants from an N-prefix (e.g., "N,N,3-trimethyl")
      // BUT: skip if this substituent is followed by -idene or -ylidene (it's part of "methylidene")
      const hasIdeneOrYlideneSuffix = suffixTokens.some(
        (s) =>
          (s.value === "idene" || s.value === "ylidene") &&
          s.position > substituent.position &&
          !substituentTokens.some(
            (x) => x.position > substituent.position && x.position < s.position,
          ),
      );

      if (
        locants.length === 0 &&
        substituent.value.toLowerCase() === "methyl" &&
        !hasIdeneOrYlideneSuffix
      ) {
        const nPrefix = prefixTokens.find(
          (p) =>
            this.context.isNSubstitutionPrefix(p) &&
            p.position < substituent.position &&
            !locantTokens.some(
              (l) =>
                l.position > p.position && l.position < substituent.position,
            ),
        );
        if (nPrefix) {
          // Check if there's an amine suffix - if so, handle differently
          const hasAmineSuffix = suffixTokens.some(
            (s) => s.value === "amine" || s.value === "amin",
          );

          const prefixValue = nPrefix.value.toLowerCase();
          const locantStrs = prefixValue.split(",");
          const nCount = locantStrs.filter((s) => s === "n").length;

          if (hasAmineSuffix && nCount > 0) {
            // For amine suffix on heterocycles: N-prefix parts apply to amine nitrogen
            // Extract and apply N-methyls to amine nitrogen first
            const amineNitrogens = builder.getAmineNitrogenIndices();
            if (amineNitrogens.length > 0) {
              for (let i = 0; i < nCount; i++) {
                const amineNIdx = amineNitrogens[amineNitrogens.length - 1]!; // Use last added amine
                builder.addMethyl(amineNIdx);
                if (process.env.VERBOSE) {
                  console.log(
                    `[graph-builder] Applied N-methyl to amine nitrogen ${amineNIdx}`,
                  );
                }
              }
            }
            // Now extract numeric locants for ring positions
            const extractedLocants: number[] = [];
            for (const locantStr of locantStrs) {
              const num = parseInt(locantStr, 10);
              if (!isNaN(num)) {
                // Only numeric locants apply to carbon substituents
                extractedLocants.push(num);
              }
            }

            if (extractedLocants.length > 0) {
              locants = extractedLocants;
              // When we have explicit locants, use their count instead of the multiplier
              multiplierCount = extractedLocants.length;
              if (process.env.VERBOSE) {
                console.log(
                  `[graph-builder] Extracted numeric locants from N-prefix (with amine suffix): ${locants}`,
                );
              }
            } else {
              // No numeric locants, only N parts applied to amine - skip regular substituent loop
              continue;
            }
          } else if (hasAmineSuffix) {
            // Amine suffix but no N parts - just extract numeric locants
            const extractedLocants: number[] = [];
            for (const locantStr of locantStrs) {
              const num = parseInt(locantStr, 10);
              if (!isNaN(num)) {
                extractedLocants.push(num);
              }
            }
            if (extractedLocants.length > 0) {
              locants = extractedLocants;
              multiplierCount = extractedLocants.length;
            }
          } else {
            // No amine suffix: treat as regular N-prefix (for N-substituted amines on linear chains)
            // This pattern means: 2 methyls on N (position 1), 1 methyl on position 3
            const extractedLocants: number[] = [];

            for (const locantStr of locantStrs) {
              const num = parseInt(locantStr, 10);
              if (!isNaN(num)) {
                extractedLocants.push(num);
              } else if (locantStr === "n") {
                // N refers to position 1 in ring nomenclature (Hantzsch-Widman)
                extractedLocants.push(1);
              }
            }

            if (extractedLocants.length > 0) {
              locants = extractedLocants;
              // When we have explicit locants, use their count instead of the multiplier
              multiplierCount = locants.length;
              if (process.env.VERBOSE) {
                console.log(
                  `[graph-builder] Extracted locants from N-prefix: ${locants}`,
                );
              }
            }
          }
        }
      }

      // For tail substituents (sulfanyl, etc.) that precede an alkyl-yl pattern,
      // we need to use the earlier locant (for the whole group), not the nested alkyl's locant
      // E.g., "3-propan-2-ylsulfanyl": locant 3 for the group, locant 2 for alkyl internal structure
      // Note: The nested alkyl is added to the end of substituentTokens, so sulfanyl comes before it
      if (modifiedSubstValue === "sulfanyl" || modifiedSubstValue === "thio") {
        if (process.env.VERBOSE) {
          console.log(
            `[sulfanyl-fix] Checking sulfanyl/thio, currentLocants=${locants}, substituentTokens.length=${substituentTokens.length}`,
          );
        }
        const currentIdx = substituentTokens.indexOf(substituent);
        if (process.env.VERBOSE) {
          console.log(`[sulfanyl-fix] currentIdx=${currentIdx}`);
        }
        if (currentIdx >= 0 && currentIdx < substituentTokens.length - 1) {
          const nextSubst = substituentTokens[currentIdx + 1];
          if (nextSubst) {
            const nextValue = nextSubst.value.toLowerCase();
            if (process.env.VERBOSE) {
              console.log(
                `[sulfanyl-fix] nextValue=${nextValue}, endsWith("-yl")=${nextValue.endsWith("-yl")}`,
              );
            }
            // Check if next substituent is an alkyl chain that comes from nested extraction
            if (nextValue.endsWith("-yl") || nextValue.endsWith("yl")) {
              if (process.env.VERBOSE) {
                console.log(
                  `[sulfanyl-fix] Found alkyl after sulfanyl, looking for earlier locants`,
                );
              }
              // Look for locants before the alkyl group (earlier ones)
              const earlierLocants = locantTokens.filter(
                (l) => l.position < nextSubst.position,
              );
              if (process.env.VERBOSE) {
                console.log(
                  `[sulfanyl-fix] earlierLocants.length=${earlierLocants.length}`,
                );
              }
              if (earlierLocants.length > 0) {
                // Use the last (closest) locant before the alkyl group
                const lastEarlierLocant =
                  earlierLocants[earlierLocants.length - 1]!;
                const earlyLocants =
                  (lastEarlierLocant.metadata?.positions as number[]) || [];
                if (process.env.VERBOSE) {
                  console.log(`[sulfanyl-fix] earlyLocants=${earlyLocants}`);
                }
                if (earlyLocants.length > 0) {
                  locants = earlyLocants;
                  // When we have explicit locants, use their count instead of the multiplier
                  multiplierCount = locants.length;
                  if (process.env.VERBOSE) {
                    console.log(
                      `[graph-builder] Replaced sulfanyl locants with earlier group locants: ${locants}`,
                    );
                  }
                }
              }
            }
          }
        }
      }

      if (process.env.VERBOSE) {
        console.log(
          `[graph-builder] Applying substituent: ${modifiedSubstValue}, locants:`,
          locants,
          "count:",
          multiplierCount,
        );
      }

      // Determine positions to add substituent
      // Locants can have duplicates (e.g., [2, 2, 3] means 2 at position 2, 1 at position 3)
      let positions: number[];
      if (locants.length > 0) {
        positions = locants;
      } else {
        // No explicit locants: use multiplier to replicate the default position
        // e.g., "dichloromethane" → positions=[1, 1], "trichloromethane" → positions=[1, 1, 1]
        positions = Array(multiplierCount).fill(1);
      }

      for (let i = 0; i < positions.length; i++) {
        const loc = positions[i];
        if (loc === undefined) continue;

        // Check for ester attachment (alkyl/group without explicit locant attached to carboxylate)
        let isEsterAttachment = false;
        if (locants.length === 0 && esterAttachmentPoints.length > 0) {
          // Allow any group (simple or nested) if there are pending ester oxygens
          isEsterAttachment = true;
        }

        if (isEsterAttachment) {
          const oIdx = esterAttachmentPoints.shift();
          if (oIdx !== undefined) {
            if (substituent.isInParentheses && substituent.nestedTokens) {
              const nestedRes =
                this.context.nestedBuilder.buildNestedSubstituent(
                  builder,
                  substituent.nestedTokens,
                );
              if (nestedRes) {
                builder.addBond(oIdx, nestedRes.attachmentPoint);
                if (process.env.VERBOSE) {
                  console.log(
                    `[graph-builder] Attached nested ester group to oxygen ${oIdx}`,
                  );
                }
              }
            } else {
              if (modifiedSubstValue === "methyl") builder.addMethyl(oIdx);
              else if (modifiedSubstValue === "ethyl") builder.addEthyl(oIdx);
              else if (modifiedSubstValue === "propyl")
                builder.addAlkylSubstituent(oIdx, 3);
              else if (modifiedSubstValue === "butyl")
                builder.addAlkylSubstituent(oIdx, 4);
              else if (modifiedSubstValue === "pentyl")
                builder.addAlkylSubstituent(oIdx, 5);
              else if (modifiedSubstValue === "hexyl")
                builder.addAlkylSubstituent(oIdx, 6);
              else if (modifiedSubstValue === "isopropyl")
                builder.addIsopropyl(oIdx);
              else if (modifiedSubstValue === "tert-butyl")
                builder.addTertButyl(oIdx);
              else if (modifiedSubstValue === "phenyl") {
                const ph = builder.createBenzeneRing();
                builder.addBond(oIdx, ph[0]!);
              }

              if (process.env.VERBOSE) {
                console.log(
                  `[graph-builder] Attached ester alkyl ${modifiedSubstValue} to oxygen ${oIdx}`,
                );
              }
            }
            continue;
          }
        }

        const atomIdx = this.context.locantToAtomIndex(
          loc,
          mainChainAtoms,
          reverseNumbering,
        );
        if (atomIdx === null) continue;

        // Allow substituents on C, N, S, P, Si atoms (heterocyclic rings can have substituents on heteroatoms)
        const atom = builder.getAtom(atomIdx);
        if (
          atom &&
          atom.symbol !== "C" &&
          atom.symbol !== "N" &&
          atom.symbol !== "S" &&
          atom.symbol !== "P" &&
          atom.symbol !== "Si"
        ) {
          if (process.env.VERBOSE) {
            console.log(
              `[substituent] Skipping non-carbon/nitrogen/sulfur/phosphorus atom at position ${loc} (${atom.symbol})`,
            );
          }
          continue;
        }

        // Add substituent based on type
        if (modifiedSubstValue === "methyl") {
          builder.addMethyl(atomIdx);
        } else if (modifiedSubstValue === "ethyl") {
          builder.addEthyl(atomIdx);
        } else if (modifiedSubstValue === "propyl") {
          builder.addAlkylSubstituent(atomIdx, 3);
        } else if (modifiedSubstValue === "butyl") {
          builder.addAlkylSubstituent(atomIdx, 4);
        } else if (modifiedSubstValue === "pentyl") {
          builder.addAlkylSubstituent(atomIdx, 5);
        } else if (modifiedSubstValue === "hexyl") {
          builder.addAlkylSubstituent(atomIdx, 6);
        } else if (modifiedSubstValue === "heptyl") {
          builder.addAlkylSubstituent(atomIdx, 7);
        } else if (modifiedSubstValue === "octyl") {
          builder.addAlkylSubstituent(atomIdx, 8);
        } else if (modifiedSubstValue === "nonyl") {
          builder.addAlkylSubstituent(atomIdx, 9);
        } else if (modifiedSubstValue === "decyl") {
          builder.addAlkylSubstituent(atomIdx, 10);
        } else if (modifiedSubstValue === "undecyl") {
          builder.addAlkylSubstituent(atomIdx, 11);
        } else if (modifiedSubstValue === "dodecyl") {
          builder.addAlkylSubstituent(atomIdx, 12);
        } else if (
          modifiedSubstValue === "isopropyl" ||
          modifiedSubstValue === "propan-2-yl"
        ) {
          builder.addIsopropyl(atomIdx);
        } else if (modifiedSubstValue === "isobutyl") {
          builder.addIsobutyl(atomIdx);
        } else if (
          modifiedSubstValue === "sec-butyl" ||
          modifiedSubstValue === "secbutyl" ||
          modifiedSubstValue === "butan-2-yl"
        ) {
          builder.addSecButyl(atomIdx);
        } else if (
          modifiedSubstValue === "tert-butyl" ||
          modifiedSubstValue === "tertbutyl" ||
          modifiedSubstValue === "butan-2,2-dimethyl"
        ) {
          builder.addTertButyl(atomIdx);
        } else if (modifiedSubstValue === "methoxy") {
          builder.addMethoxy(atomIdx);
        } else if (modifiedSubstValue === "ethoxy") {
          builder.addEthoxy(atomIdx);
        } else if (modifiedSubstValue === "propoxy") {
          builder.addPropoxy(atomIdx);
        } else if (modifiedSubstValue === "butoxy") {
          builder.addButoxy(atomIdx);
        } else if (modifiedSubstValue === "pentoxy") {
          const oxygenIdx = builder.addAtom("O");
          builder.addBond(atomIdx, oxygenIdx);
          builder.addAlkylSubstituent(oxygenIdx, 5);
        } else if (modifiedSubstValue === "hexoxy") {
          const oxygenIdx = builder.addAtom("O");
          builder.addBond(atomIdx, oxygenIdx);
          builder.addAlkylSubstituent(oxygenIdx, 6);
        } else if (modifiedSubstValue === "heptoxy") {
          const oxygenIdx = builder.addAtom("O");
          builder.addBond(atomIdx, oxygenIdx);
          builder.addAlkylSubstituent(oxygenIdx, 7);
        } else if (modifiedSubstValue === "octoxy") {
          const oxygenIdx = builder.addAtom("O");
          builder.addBond(atomIdx, oxygenIdx);
          builder.addAlkylSubstituent(oxygenIdx, 8);
        } else if (
          modifiedSubstValue === "hydroxy" ||
          modifiedSubstValue === "hydroxyl"
        ) {
          builder.addHydroxyl(atomIdx);
        } else if (modifiedSubstValue === "oxo") {
          // Oxo = carbonyl =O on this carbon
          builder.addCarbonyl(atomIdx);
        } else if (modifiedSubstValue === "amino") {
          builder.addAmino(atomIdx);
        } else if (modifiedSubstValue === "acetyl") {
          builder.addAcetyl(atomIdx);
        } else if (modifiedSubstValue === "propanoyl") {
          builder.addPropanoyl(atomIdx);
        } else if (modifiedSubstValue === "butanoyl") {
          builder.addButanoyl(atomIdx);
        } else if (modifiedSubstValue === "pentanoyl") {
          builder.addPentanoyl(atomIdx);
        } else if (modifiedSubstValue === "hexanoyl") {
          builder.addHexanoyl(atomIdx);
        } else if (modifiedSubstValue === "phenyl") {
          // Add benzene ring as substituent
          const benzeneAtoms = builder.createBenzeneRing();
          if (benzeneAtoms[0] !== undefined) {
            builder.addBond(atomIdx, benzeneAtoms[0]);
          }
        } else if (
          modifiedSubstValue.endsWith("phenyl") &&
          modifiedSubstValue !== "phenyl"
        ) {
          // Handle complex phenyl with locants and substituents (e.g., "3-chloro-4-hydroxyphenyl")
          const benzeneAtoms = builder.createBenzeneRing();
          if (benzeneAtoms[0] !== undefined) {
            builder.addBond(atomIdx, benzeneAtoms[0]);

            // Extract all locant-substituent pairs from the substituent name
            // Pattern: digits-word pairs, e.g., "3-chloro-4-hydroxy" → [{3, "chloro"}, {4, "hydroxy"}]
            const locantsAndSubsts: Array<{
              locant: number;
              substName: string;
            }> = [];
            const complexPattern = /(\d+)-(\w+)/g;
            let match;

            while ((match = complexPattern.exec(modifiedSubstValue)) !== null) {
              const locantStr = match[1];
              const substNameStr = match[2];
              if (locantStr && substNameStr) {
                const locant = parseInt(locantStr, 10);
                locantsAndSubsts.push({ locant, substName: substNameStr });
              }
            }

            // Apply each substituent to the benzene ring at its specified locant
            for (const { locant, substName } of locantsAndSubsts) {
              const benzeneAtomIdx = this.context.locantToAtomIndex(
                locant,
                benzeneAtoms,
                false,
              );
              if (benzeneAtomIdx !== null) {
                // Apply the substituent based on its type
                if (substName === "chloro") {
                  const clIdx = builder.addAtom("Cl");
                  builder.addBond(benzeneAtomIdx, clIdx);
                } else if (substName === "bromo") {
                  const brIdx = builder.addAtom("Br");
                  builder.addBond(benzeneAtomIdx, brIdx);
                } else if (substName === "iodo" || substName === "iod") {
                  const iIdx = builder.addAtom("I");
                  builder.addBond(benzeneAtomIdx, iIdx);
                } else if (substName === "fluoro" || substName === "fluo") {
                  const fIdx = builder.addAtom("F");
                  builder.addBond(benzeneAtomIdx, fIdx);
                } else if (
                  substName === "hydroxy" ||
                  substName === "hydroxyl"
                ) {
                  builder.addHydroxyl(benzeneAtomIdx);
                } else if (substName === "methyl") {
                  builder.addMethyl(benzeneAtomIdx);
                } else if (substName === "methoxy") {
                  builder.addMethoxy(benzeneAtomIdx);
                } else if (substName === "amino") {
                  const nIdx = builder.addAtom("N");
                  builder.addBond(benzeneAtomIdx, nIdx);
                } else if (substName === "nitro") {
                  // Nitro group: [N+](=O)[O-]
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
        } else if (modifiedSubstValue === "benzyl") {
          builder.addBenzyl(atomIdx);
        } else if (modifiedSubstValue === "phenethyl") {
          builder.addPhenethyl(atomIdx);
        } else if (modifiedSubstValue === "oxolan-2-yl") {
          // Add tetrahydrofuranyl (oxolan-2-yl): 5-membered ring with O, attached at C2
          const c1 = builder.addCarbon();
          const c2 = builder.addCarbon();
          const c3 = builder.addCarbon();
          const c4 = builder.addCarbon();
          const o = builder.addAtom("O");

          // Create ring: O-C1-C2-C3-C4, with attachment at C2
          builder.addBond(o, c1);
          builder.addBond(c1, c2);
          builder.addBond(c2, c3);
          builder.addBond(c3, c4);
          builder.addBond(c4, o);

          // Attach to main chain at C2
          builder.addBond(atomIdx, c2);
        } else if (modifiedSubstValue === "trimethylsilyl") {
          // Add trimethylsilyl: -Si(CH3)3
          const siIdx = builder.addAtom("Si");
          builder.addBond(atomIdx, siIdx);
          // Add three methyl groups
          for (let i = 0; i < 3; i++) {
            builder.addMethyl(siIdx);
          }
        } else if (modifiedSubstValue === "trimethylsilyloxy") {
          // Add trimethylsilyloxy: -O-Si(CH3)3
          const oIdx = builder.addAtom("O");
          const siIdx = builder.addAtom("Si");
          builder.addBond(atomIdx, oIdx);
          builder.addBond(oIdx, siIdx);
          // Add three methyl groups
          for (let i = 0; i < 3; i++) {
            builder.addMethyl(siIdx);
          }
        } else if (modifiedSubstValue === "diphenylphosphanyl") {
          // Add diphenylphosphanyl: -P(C6H5)2
          const pIdx = builder.addAtom("P");
          builder.addBond(atomIdx, pIdx);
          // Add two phenyl groups
          for (let i = 0; i < 2; i++) {
            const benzeneAtoms = builder.createBenzeneRing();
            if (benzeneAtoms[0] !== undefined) {
              builder.addBond(pIdx, benzeneAtoms[0]);
            }
          }
        } else if (modifiedSubstValue === "diphenylphosphanyloxy") {
          // Add diphenylphosphanyloxy: -O-P(C6H5)2
          const oIdx = builder.addAtom("O");
          const pIdx = builder.addAtom("P");
          builder.addBond(atomIdx, oIdx);
          builder.addBond(oIdx, pIdx);
          // Add two phenyl groups
          for (let i = 0; i < 2; i++) {
            const benzeneAtoms = builder.createBenzeneRing();
            if (benzeneAtoms[0] !== undefined) {
              builder.addBond(pIdx, benzeneAtoms[0]);
            }
          }
        } else if (modifiedSubstValue === "phenylsulfanyl") {
          // Add phenylsulfanyl: -S-C6H5
          const sIdx = builder.addAtom("S");
          builder.addBond(atomIdx, sIdx);
          const benzeneAtoms = builder.createBenzeneRing();
          if (benzeneAtoms[0] !== undefined) {
            builder.addBond(sIdx, benzeneAtoms[0]);
          }
        } else if (modifiedSubstValue === "cyclopropyl") {
          builder.addCyclopropyl(atomIdx);
        } else if (modifiedSubstValue === "cyclopropylidene") {
          builder.addCyclopropylidene(atomIdx);
        } else if (modifiedSubstValue === "cyclobutyl") {
          builder.addCyclobutyl(atomIdx);
        } else if (modifiedSubstValue === "cyclobutylidene") {
          builder.addCyclobutylidene(atomIdx);
        } else if (modifiedSubstValue === "cyclopentyl") {
          builder.addCyclopentyl(atomIdx);
        } else if (modifiedSubstValue === "cyclopentylidene") {
          builder.addCyclopentylidene(atomIdx);
        } else if (modifiedSubstValue === "cyclohexyl") {
          builder.addCyclohexyl(atomIdx);
        } else if (modifiedSubstValue === "cyclohexylidene") {
          builder.addCyclohexylidene(atomIdx);
        } else if (
          modifiedSubstValue === "chloro" ||
          modifiedSubstValue === "chlor"
        ) {
          const clIdx = builder.addAtom("Cl");
          builder.addBond(atomIdx, clIdx);
        } else if (
          modifiedSubstValue === "bromo" ||
          modifiedSubstValue === "brom"
        ) {
          const brIdx = builder.addAtom("Br");
          builder.addBond(atomIdx, brIdx);
        } else if (
          modifiedSubstValue === "fluoro" ||
          modifiedSubstValue === "fluor"
        ) {
          const fIdx = builder.addAtom("F");
          builder.addBond(atomIdx, fIdx);
        } else if (modifiedSubstValue === "trifluoromethyl") {
          builder.addTrifluoromethyl(atomIdx);
        } else if (
          modifiedSubstValue === "iodo" ||
          modifiedSubstValue === "iod"
        ) {
          const iIdx = builder.addAtom("I");
          builder.addBond(atomIdx, iIdx);
        } else if (modifiedSubstValue === "nitro") {
          // Nitro group: -NO2 in charged resonance form [N+](=O)[O-]
          const nIdx = builder.addAtom("N");
          const o1 = builder.addAtom("O");
          const o2 = builder.addAtom("O");
          builder.addBond(atomIdx, nIdx);
          builder.addBond(nIdx, o1, BondTypeEnum.DOUBLE);
          builder.addBond(nIdx, o2, BondTypeEnum.SINGLE);
          // Set charges: N+ and O-
          builder.setCharge(nIdx, 1);
          builder.setCharge(o2, -1);
        } else if (
          modifiedSubstValue === "sulfinyl" ||
          modifiedSubstValue === "sulfoxide"
        ) {
          // Sulfinyl group: -SO-
          const sIdx = builder.addAtom("S");
          const oIdx = builder.addAtom("O");
          builder.addBond(atomIdx, sIdx);
          builder.addBond(sIdx, oIdx, BondTypeEnum.DOUBLE);
        } else if (
          modifiedSubstValue === "sulfonyl" ||
          modifiedSubstValue === "sulfone"
        ) {
          // Sulfonyl group: -SO2-
          const sIdx = builder.addAtom("S");
          const o1 = builder.addAtom("O");
          const o2 = builder.addAtom("O");
          builder.addBond(atomIdx, sIdx);
          builder.addBond(sIdx, o1, BondTypeEnum.DOUBLE);
          builder.addBond(sIdx, o2, BondTypeEnum.DOUBLE);
        } else if (
          modifiedSubstValue === "sulfanyl" ||
          modifiedSubstValue === "thio"
        ) {
          // Sulfanyl group: -S-
          // Check if next substituent is an alkyl group (e.g., "propan-2-ylsulfanyl")
          const currentIdx = substituentTokens.indexOf(substituent);
          const nextSubst =
            currentIdx >= 0 && currentIdx < substituentTokens.length - 1
              ? substituentTokens[currentIdx + 1]
              : null;
          const nextValue = nextSubst?.value.toLowerCase() || "";
          const isNextAlkyl =
            nextValue.endsWith("-yl") || nextValue.endsWith("yl");

          const sIdx = builder.addAtom("S");
          builder.addBond(atomIdx, sIdx);

          // If next substituent is an alkyl group at the same position, attach it to sulfur
          if (isNextAlkyl && nextSubst) {
            const nextLocants = this.getLocantsBeforeSubstituent(
              nextSubst,
              locantTokens,
            );
            const nextPositions = nextLocants.length > 0 ? nextLocants : [1];

            // Check if this alkyl is at the same position as sulfanyl
            if (nextPositions.includes(loc!)) {
              // Build and attach the alkyl group to sulfur
              if (nextValue === "propan-2-yl" || nextValue === "isopropyl") {
                builder.addIsopropyl(sIdx);
              } else if (nextValue === "methyl") {
                builder.addMethyl(sIdx);
              } else if (nextValue === "ethyl") {
                builder.addEthyl(sIdx);
              } else if (nextValue === "propyl") {
                builder.addAlkylSubstituent(sIdx, 3);
              } else if (nextValue === "butyl") {
                builder.addAlkylSubstituent(sIdx, 4);
              } else if (
                nextValue === "tert-butyl" ||
                nextValue === "tertbutyl"
              ) {
                builder.addTertButyl(sIdx);
              }

              // Mark this substituent as processed so it doesn't get added again
              processedSubstituents.add(nextSubst);

              if (process.env.VERBOSE) {
                console.log(
                  `[sulfanyl] Attached ${nextValue} to sulfur at position ${loc}`,
                );
              }
            }
          }
        } else if (substituent.metadata?.isComplexSubstituent) {
          // Handle complex substituents identified by tokenizer
          const substituentType = substituent.metadata
            .substituentType as string;

          if (substituentType === "anilino") {
            // X-anilino where X is a substituted phenyl group
            // Add NH connector
            const nIdx = builder.addAtom("N");
            builder.addBond(atomIdx, nIdx);

            // Create phenyl ring
            const benzeneAtoms = builder.createBenzeneRing();
            if (benzeneAtoms[0] !== undefined) {
              builder.addBond(nIdx, benzeneAtoms[0]);
            }
          } else if (substituentType === "methoxyphenyl") {
            // X-methoxyphenyl where X is methoxy count and position
            const locant = substituent.metadata.locant as string;
            const methoxyCount = substituent.metadata.methoxyCount as string;
            const additionalSubstituents = substituent.metadata
              .additionalSubstituents as string;

            // Add oxygen connector
            const oIdx = builder.addAtom("O");
            builder.addBond(atomIdx, oIdx);

            // Create phenyl ring
            const benzeneAtoms = builder.createBenzeneRing();
            if (benzeneAtoms[0] !== undefined) {
              builder.addBond(oIdx, benzeneAtoms[0]);

              // Add methoxy groups to phenyl ring
              this.addMethoxyGroupsToPhenyl(
                builder,
                benzeneAtoms,
                methoxyCount,
                locant,
              );

              // Add additional substituents if any
              if (additionalSubstituents) {
                this.applyPhenylSubstituents(
                  builder,
                  benzeneAtoms,
                  additionalSubstituents,
                );
              }
            }
          } else if (substituentType === "ylidene") {
            // X-ylidene where X is substituted alkyl group
            const alkylSubstituents = substituent.metadata
              .alkylSubstituents as string;

            // Create alkyl chain
            const alkylLength =
              this.context.getAlkylLength(alkylSubstituents) + 2; // +2 for =CH2
            const alkylAtoms = builder.createLinearChain(alkylLength);

            // Connect via double bond to create ylidene
            if (alkylAtoms[0] !== undefined) {
              builder.addDoubleBond(atomIdx, alkylAtoms[0]);
            }
          } else {
            // Default to methyl for unknown complex substituents
            builder.addMethyl(atomIdx);
          }
        } else if (substituent.metadata?.isCompoundSubstituent) {
          // Compound substituent like "methylsulfinyl", "ethylsulfonyl", etc.
          const alkylPart = substituent.metadata.alkylPart as string;
          const sulfurPart = substituent.metadata.sulfurPart as string;

          // Add sulfur atom with oxygen(s)
          const sIdx = builder.addAtom("S");
          builder.addBond(atomIdx, sIdx);

          if (sulfurPart === "sulfinyl") {
            const oIdx = builder.addAtom("O");
            builder.addBond(sIdx, oIdx, BondTypeEnum.DOUBLE);
          } else if (sulfurPart === "sulfonyl") {
            const o1 = builder.addAtom("O");
            const o2 = builder.addAtom("O");
            builder.addBond(sIdx, o1, BondTypeEnum.DOUBLE);
            builder.addBond(sIdx, o2, BondTypeEnum.DOUBLE);
          }
          // sulfanyl/thio has no oxygen

          // Add alkyl/aryl group to sulfur
          if (alkylPart === "methyl") {
            builder.addMethyl(sIdx);
          } else if (alkylPart === "ethyl") {
            builder.addEthyl(sIdx);
          } else if (alkylPart === "propyl") {
            builder.addAlkylSubstituent(sIdx, 3);
          } else if (alkylPart === "butyl") {
            builder.addAlkylSubstituent(sIdx, 4);
          } else if (alkylPart === "phenyl") {
            // Add benzene ring as substituent
            const benzeneAtoms = builder.createBenzeneRing();
            const firstBenzeneAtom = benzeneAtoms[0];
            if (firstBenzeneAtom !== undefined) {
              builder.addBond(sIdx, firstBenzeneAtom);
            }
          } else {
            // Default to methyl if unknown
            builder.addMethyl(sIdx);
          }
        } else if (modifiedSubstValue === "anilino") {
          // Add anilino: -NH-C6H5 (aniline-derived amino group)
          const nIdx = builder.addAtom("N");
          builder.addBond(atomIdx, nIdx);
          const benzeneAtoms = builder.createBenzeneRing();
          if (benzeneAtoms[0] !== undefined) {
            builder.addBond(nIdx, benzeneAtoms[0]);
          }
        } else if (modifiedSubstValue === "dimethoxyanilino") {
          // Add dimethoxyanilino: -NH-C6H3(OCH3)2 (2,4-dimethoxyanilino)
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
        } else if (modifiedSubstValue === "methoxyanilino") {
          // Add methoxyanilino: -NH-C6H4(OCH3)
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
        } else if (modifiedSubstValue === "chloroanilino") {
          // Add chloroanilino: -NH-C6H4Cl
          const nIdx = builder.addAtom("N");
          builder.addBond(atomIdx, nIdx);
          const benzeneAtoms = builder.createBenzeneRing();
          if (benzeneAtoms[0] !== undefined) {
            builder.addBond(nIdx, benzeneAtoms[0]);
            // Add chlorine at position 4 (para to attachment)
            if (benzeneAtoms[3] !== undefined) {
              const clIdx = builder.addAtom("Cl");
              builder.addBond(benzeneAtoms[3], clIdx);
            }
          }
        } else if (modifiedSubstValue === "fluoroanilino") {
          // Add fluoroanilino: -NH-C6H4F
          const nIdx = builder.addAtom("N");
          builder.addBond(atomIdx, nIdx);
          const benzeneAtoms = builder.createBenzeneRing();
          if (benzeneAtoms[0] !== undefined) {
            builder.addBond(nIdx, benzeneAtoms[0]);
            // Add fluorine at position 4 (para to attachment)
            if (benzeneAtoms[3] !== undefined) {
              const fIdx = builder.addAtom("F");
              builder.addBond(benzeneAtoms[3], fIdx);
            }
          }
        } else if (modifiedSubstValue === "methylidene") {
          // Add methylidene: =CH2 (exocyclic double bond with CH2)
          const cIdx = builder.addAtom("C");
          builder.addBond(atomIdx, cIdx, BondTypeEnum.DOUBLE);
          // Add 2 hydrogens to the methylidene carbon
          // (implicit hydrogens will be added automatically)
        } else if (modifiedSubstValue === "ethylidene") {
          // Add ethylidene: =CH-CH3
          const c1 = builder.addAtom("C");
          const c2 = builder.addAtom("C");
          builder.addBond(atomIdx, c1, BondTypeEnum.DOUBLE);
          builder.addBond(c1, c2);
          builder.addMethyl(c2);
        } else {
          // Generic alkyl - try to determine length
          // For now, default to methyl
          builder.addMethyl(atomIdx);
        }
        // Mark as processed (if not already)
        processedSubstituents.add(substituent);
      }
    }
    return processedSubstituents;
  }

  /**
   * Apply substituents to a phenyl ring based on substituent pattern
   * Pattern: "4-nitro-3-(trifluoromethyl)" etc.
   */
  private applyPhenylSubstituents(
    builder: MoleculeGraphBuilder,
    benzeneAtoms: number[],
    substituents: string,
  ): void {
    // Parse complex substituent pattern like "4-nitro-3-(trifluoromethyl)"
    const parts = substituents.split("-").filter((p) => p.length > 0);

    for (const part of parts) {
      if (part.includes("nitro")) {
        // Add nitro at position specified (e.g., "4-nitro")
        const nitroMatch = part.match(/([0-9]+)nitro/);
        if (nitroMatch && nitroMatch[1]) {
          const pos = parseInt(nitroMatch[1]) - 1; // Convert to 0-indexed
          if (pos >= 0 && pos < benzeneAtoms.length) {
            const atomIdx = benzeneAtoms[pos];
            if (atomIdx !== undefined) {
              // Add NO2 group in charged resonance form [N+](=O)[O-]
              const nIdx = builder.addAtom("N");
              const o1 = builder.addAtom("O");
              const o2 = builder.addAtom("O");
              builder.addBond(atomIdx, nIdx);
              builder.addBond(nIdx, o1, BondTypeEnum.DOUBLE);
              builder.addBond(nIdx, o2, BondTypeEnum.SINGLE);
              builder.setCharge(nIdx, 1);
              builder.setCharge(o2, -1);
            }
          }
        }
      } else if (part.includes("trifluoromethyl")) {
        // Add CF3CH2 group at position specified
        const cf3Match = part.match(/([0-9]+)\(?trifluoromethyl\)?/);
        if (cf3Match && cf3Match[1]) {
          const pos = parseInt(cf3Match[1]) - 1; // Convert to 0-indexed
          if (pos >= 0 && pos < benzeneAtoms.length) {
            const atomIdx = benzeneAtoms[pos];
            if (atomIdx !== undefined) {
              // Add CF3CH2 group
              const cIdx = builder.addAtom("C");
              const f1 = builder.addAtom("F");
              const f2 = builder.addAtom("F");
              const f3 = builder.addAtom("F");
              builder.addBond(atomIdx, cIdx);
              builder.addBond(cIdx, f1);
              builder.addBond(cIdx, f2);
              builder.addBond(cIdx, f3);
            }
          }
        }
      }
    }
  }

  /**
   * Add methoxy groups to phenyl ring
   */
  private addMethoxyGroupsToPhenyl(
    builder: MoleculeGraphBuilder,
    benzeneAtoms: number[],
    methoxyCount: string,
    locant: string,
  ): void {
    const count = methoxyCount === "di" ? 2 : methoxyCount === "tri" ? 3 : 1;
    const basePos = locant ? parseInt(locant) - 1 : 0; // Convert to 0-indexed

    // Add methoxy groups at standard positions (2,4 for di; 2,3,4 for tri)
    const positions =
      methoxyCount === "di"
        ? [1, 3]
        : methoxyCount === "tri"
          ? [1, 2, 3]
          : [basePos];

    for (let i = 0; i < Math.min(count, positions.length); i++) {
      const pos = (positions[i] ?? 0) % benzeneAtoms.length;
      if (pos >= 0 && pos < benzeneAtoms.length) {
        const atomIdx = benzeneAtoms[pos];
        if (atomIdx !== undefined) {
          // Add -OCH3 group
          const oIdx = builder.addAtom("O");
          const cIdx = builder.addAtom("C");
          builder.addBond(atomIdx, oIdx);
          builder.addBond(oIdx, cIdx);
          builder.addMethyl(cIdx);
        }
      }
    }
  }

  /**
   * Convert IUPAC locant (1-indexed) to atom array index (0-indexed)
   * @param reverseNumbering If true, number from end (for carboxylic acids)
   */
  public getLocantsBeforeSubstituent(
    substituent: IUPACToken,
    locantTokens: IUPACToken[],
  ): number[] {
    let closestLocant: IUPACToken | null = null;
    let closestDistance = Infinity;

    for (const locant of locantTokens) {
      if (locant.position < substituent.position) {
        const distance = substituent.position - locant.position;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestLocant = locant;
        }
      }
    }

    if (closestLocant) {
      return (closestLocant.metadata?.positions as number[]) || [];
    }

    return [];
  }

  /**
   * Find multiplier before a substituent token
   */
  public getMultiplierBeforeSubstituent(
    substituent: IUPACToken,
    multiplierTokens: IUPACToken[],
  ): IUPACToken | null {
    let closestMultiplier: IUPACToken | null = null;
    let closestDistance = Infinity;

    for (const multiplier of multiplierTokens) {
      if (multiplier.position < substituent.position) {
        const distance = substituent.position - multiplier.position;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestMultiplier = multiplier;
        }
      }
    }

    return closestMultiplier;
  }

  /**
   * Build N-substituted amide (e.g., "N,N-dimethylethanamide")
   * Pattern: N-substituents + parent + amide suffix
   */
}
