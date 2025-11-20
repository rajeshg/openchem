import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";
import { BondType as BondTypeEnum } from "types";

export class YlideneaminoStrategy extends BaseSubstituentStrategy {
  readonly name = "ylideneamino";
  readonly priority = 83; // Between anilino (82) and acyl (80)

  matches(ctx: TokenContext): boolean {
    // Pattern: parent alkane + locants + "ylidene" + "amino" + "an" suffix
    // Example: "propan-2-ylideneamino"
    // Must HAVE a parent (unlike alkylidene which requires no parent)
    if (ctx.parentTokens.length === 0) {
      return false;
    }

    const hasYlideneSubst = ctx.substituentTokens.some(
      (s) => s.value === "ylidene",
    );
    const hasAminoSubst = ctx.substituentTokens.some(
      (s) => s.value === "amino",
    );
    const hasAnSuffix = ctx.suffixTokens.some((s) => s.value === "an");

    return hasYlideneSubst && hasAminoSubst && hasAnSuffix;
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    const parentToken = ctx.parentTokens[0]!;
    const smiles = parentToken.metadata?.smiles as string;
    const chainLength = smiles ? smiles.length : 1;

    this.log(
      `Building ylideneamino with ${chainLength}-carbon chain from ${parentToken.value}`,
    );

    // Create the main carbon chain
    const chainAtoms = builder.createLinearChain(chainLength);

    // Find locant for the ylidene position (where the double bond is)
    const ylideneSubst = ctx.substituentTokens.find(
      (s) => s.value === "ylidene",
    )!;
    const ylideneLocants = builderContext.getLocantsBeforeSubstituent(
      ylideneSubst,
      ctx.locantTokens,
    );
    const ylidenePosition = ylideneLocants.length > 0 ? ylideneLocants[0]! : 1;

    const ylideneAtomIdx = builderContext.locantToAtomIndex(
      ylidenePosition,
      chainAtoms,
      false,
    );

    if (ylideneAtomIdx === null) {
      return null;
    }

    // Create N=C structure (ylidene: double bond between C and N)
    // The nitrogen will be attached to the ring with a single bond
    const nIdx = builder.addAtom("N");
    builder.addBond(ylideneAtomIdx, nIdx, BondTypeEnum.DOUBLE);

    // Add NH2 group to nitrogen
    const nh2Idx = builder.addAtom("N");
    builder.addBond(nIdx, nh2Idx);

    this.log(
      `Created ylideneamino at position ${ylidenePosition}: C=${nIdx}-NH2`,
    );

    // Return: nh2Idx (the NH2 group) is where this attaches to the main ring
    return {
      fragmentAtoms: [...chainAtoms, nIdx, nh2Idx],
      attachmentPoint: nh2Idx,
    };
  }
}
