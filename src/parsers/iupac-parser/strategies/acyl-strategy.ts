import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";
import { BondType as BondTypeEnum } from "types";

export class AcylStrategy extends BaseSubstituentStrategy {
  readonly name = "acyl";
  readonly priority = 80; // High priority, check before branched alkyl

  matches(ctx: TokenContext): boolean {
    // Pattern: parent + "oyl" suffix (e.g., "acetyl", "propanoyl", "2-methylpropanoyl")
    const hasOylSuffix = ctx.suffixTokens.some((s) => s.value === "oyl");
    return hasOylSuffix && ctx.parentTokens.length > 0;
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    const parentToken = ctx.parentTokens[0]!;
    const smiles = parentToken.metadata?.smiles as string;

    if (!smiles) {
      return null;
    }

    // For acyl groups, the parent alkane refers to the full hydrocarbon (e.g., "prop" = propane = 3 carbons)
    // But for acyl, we need the alkyl part (e.g., propanoyl = CH3-CH2-C(=O) which is 2-carbon alkyl + carbonyl)
    // So we use chainLength - 1 for the initial chain, then add the carbonyl carbon
    const acylChainLength = Math.max(1, smiles.length - 1);
    const chainAtoms = builder.createLinearChain(acylChainLength);

    // Apply any substituents to the chain (e.g., "methyl" in "2-methylpropanoyl")
    // Separate amino from other substituents as it requires special handling
    const hasAminoSubst = ctx.substituentTokens.some((s) => s.value === "amino");

    for (const subst of ctx.substituentTokens) {
      if (subst.value === "amino") continue; // Handle separately below

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

      this.log(`Built acylamino group with ${acylChainLength} carbons + carbonyl + N`);
    } else {
      this.log(`Built acyl group with ${acylChainLength} carbons + carbonyl`);
    }

    return {
      fragmentAtoms,
      attachmentPoint, // Attach via carbonyl carbon for acyl, or nitrogen for amide
    };
  }
}
