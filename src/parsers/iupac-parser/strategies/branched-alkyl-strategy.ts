import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export class BranchedAlkylStrategy extends BaseSubstituentStrategy {
  readonly name = "branched-alkyl";
  readonly priority = 75; // Higher than simple alkyl (70), checks before unbranched

  matches(ctx: TokenContext): boolean {
    // Pattern: locant + smaller alkyl + larger alkyl (both ending in "yl")
    // Example: "3-methylbutyl" → locant=3, substituents=[methyl, butyl]
    return (
      ctx.parentTokens.length === 0 &&
      ctx.suffixTokens.length === 0 &&
      ctx.substituentTokens.length === 2 &&
      ctx.locantTokens.length > 0 &&
      ctx.substituentTokens.every((s) => s.value.endsWith("yl"))
    );
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    const [subst1, subst2] = ctx.substituentTokens;

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

    if (parentLen === 0 || branchLen === 0) {
      return null;
    }

    this.log(
      `Building ${branchSubst.value} on ${parentSubst.value} (${parentLen} carbons with ${branchLen} carbon branch)`,
    );

    // Build parent chain
    const parentAtoms = builder.createLinearChain(parentLen);

    // Get locant for branch attachment
    const branchLocants = ctx.locantTokens.filter(
      (l) => l.position < branchSubst.position,
    );
    const branchPos =
      branchLocants.length > 0
        ? ((branchLocants[0]?.metadata?.positions as number[]) || [1])[0]!
        : 1;

    const attachIdx = builderContext.locantToAtomIndex(
      branchPos,
      parentAtoms,
      false,
    );

    if (attachIdx === null) {
      return null;
    }

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

    this.log(`Added ${branchSubst.value} at position ${branchPos}`);

    return {
      fragmentAtoms: [...parentAtoms, ...branchAtoms],
      attachmentPoint: parentAtoms[0]!, // Attach at first carbon of parent chain
    };
  }
}
