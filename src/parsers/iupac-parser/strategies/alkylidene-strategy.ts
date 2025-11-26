import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export class AlkylideneStrategy extends BaseSubstituentStrategy {
  readonly name = "alkylidene";
  readonly priority = 78; // Between acyl (80) and branched-alkyl (75)

  matches(ctx: TokenContext): boolean {
    // Pattern: alkyl substituent + idene/ylidene suffix WITHOUT parent
    // Example: "methylidene", "(2,5-dimethoxyphenyl)methylidene"
    // Should NOT match if there's a parent (e.g., "propan-2-ylideneamino" has parent)
    if (ctx.parentTokens.length > 0) {
      return false;
    }

    const hasIdeneSuffix = ctx.suffixTokens.some(
      (s) => s.value === "idene" || s.value === "ylidene",
    );

    if (!hasIdeneSuffix) {
      return false;
    }

    // Must have an alkyl base (methyl, ethyl, propyl, etc.)
    const hasAlkylBase = ctx.substituentTokens.some((s) => {
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

    return hasAlkylBase;
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    // Find the alkyl base
    const alkylBase = ctx.substituentTokens.find((s) => {
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

    if (!alkylBase) {
      return null;
    }

    // Determine chain length
    let chainLen = 1;
    const val = alkylBase.value.toLowerCase();
    if (val.startsWith("eth")) chainLen = 2;
    else if (val.startsWith("prop")) chainLen = 3;
    else if (val.startsWith("but")) chainLen = 4;
    else if (val.startsWith("pent")) chainLen = 5;
    else if (val.startsWith("hex")) chainLen = 6;

    this.log(`Building alkylidene with ${chainLen}-carbon chain from ${alkylBase.value}`);

    // Build the alkyl chain
    const chainAtoms = builder.createLinearChain(chainLen);

    // Apply other substituents (e.g., phenyl in "(phenyl)methylidene")
    const otherSubsts = ctx.substituentTokens.filter((s) => s !== alkylBase);

    for (const subst of otherSubsts) {
      if (subst.value.toLowerCase().endsWith("phenyl")) {
        // Build phenyl and attach to first carbon of chain
        const phenylAtoms = builder.createBenzeneRing();
        builder.addBond(chainAtoms[0]!, phenylAtoms[0]!);

        // Handle substituted phenyl (e.g., "2,5-dimethoxyphenyl")
        const phenylVal = subst.value.toLowerCase();
        if (phenylVal !== "phenyl") {
          const prefix = phenylVal.replace("phenyl", "");
          if (prefix.includes("methoxy")) {
            for (const locToken of ctx.locantTokens) {
              const locs = (locToken.metadata?.positions as number[]) || [];
              for (const loc of locs) {
                const atomIdx = builderContext.locantToAtomIndex(loc, phenylAtoms, false);
                if (atomIdx !== null) {
                  const oIdx = builder.addAtom("O");
                  builder.addBond(atomIdx, oIdx);
                  builder.addMethyl(oIdx);
                }
              }
            }
          }
        }
      } else {
        // Apply other substituents to chain
        const substLocants = builderContext.getLocantsBeforeSubstituent(subst, ctx.locantTokens);
        for (const loc of substLocants) {
          const atomIdx = builderContext.locantToAtomIndex(loc, chainAtoms, false);
          if (atomIdx !== null) {
            if (subst.value === "methyl") {
              builder.addMethyl(atomIdx);
            } else if (subst.value === "ethyl") {
              builder.addEthyl(atomIdx);
            }
          }
        }
      }
    }

    // Add double bond at the first carbon for "idene/ylidene"
    // The attachment point is the first carbon which has a double bond
    // (This will be =CH2 for methylidene, =CH-R for ethylidene, etc.)

    return {
      fragmentAtoms: chainAtoms,
      attachmentPoint: chainAtoms[0]!, // Attach at first carbon (has =C)
    };
  }
}
