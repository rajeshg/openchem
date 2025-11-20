import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export class AlkoxyStrategy extends BaseSubstituentStrategy {
  readonly name = "alkoxy";
  readonly priority = 72; // Between branched alkyl (75) and simple alkyl (70)

  matches(ctx: TokenContext): boolean {
    // Pattern: substituents + alkoxy (e.g., "dimethyl" + "propoxy")
    // BUT: skip if we have oxy+yl suffixes (that's the alkyl-oxy-methoxy pattern)
    // ALSO: skip if "phenyl" is present (that's a substituted phenyl pattern, not alkoxy)
    // ALSO: skip if there's a parent (e.g., quinolin) - those should use monolithic fallback
    const hasOxyAndYlSuffixes =
      ctx.suffixTokens.some((s) => s.value === "oxy") &&
      ctx.suffixTokens.some((s) => s.value === "yl");

    // Don't match if phenyl is one of the substituents (e.g., "methoxy" + "phenyl")
    const hasPhenyl = ctx.substituentTokens.some((s) =>
      s.value.toLowerCase().endsWith("phenyl"),
    );

    // Don't match if there's a parent ring system
    const hasParent = ctx.parentTokens.length > 0;

    const alkoxySubst = ctx.substituentTokens.find(
      (s) =>
        s.value.endsWith("oxy") &&
        !s.value.startsWith("hydroxy") &&
        s.value !== "oxy" &&
        !s.value.endsWith("phenoxy"),
    );

    return (
      alkoxySubst !== undefined &&
      ctx.substituentTokens.length > 1 &&
      !hasOxyAndYlSuffixes &&
      !hasPhenyl &&
      !hasParent
    );
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    const alkoxySubst = ctx.substituentTokens.find(
      (s) =>
        s.value.endsWith("oxy") &&
        !s.value.startsWith("hydroxy") &&
        s.value !== "oxy" &&
        !s.value.endsWith("phenoxy"),
    );

    if (!alkoxySubst) {
      return null;
    }

    const alkoxyValue = alkoxySubst.value;

    // Determine base alkyl chain from alkoxy name
    let chainLength = 1; // default methoxy
    if (alkoxyValue.startsWith("meth")) chainLength = 1;
    else if (alkoxyValue.startsWith("eth")) chainLength = 2;
    else if (alkoxyValue.startsWith("prop")) chainLength = 3;
    else if (alkoxyValue.startsWith("but")) chainLength = 4;
    else if (alkoxyValue.startsWith("pent")) chainLength = 5;
    else if (alkoxyValue.startsWith("hex")) chainLength = 6;

    this.log(
      `Building alkoxy substituent: ${alkoxyValue} (${chainLength} carbons)`,
    );

    // Build the alkyl chain
    const alkylAtoms = builder.createLinearChain(chainLength);

    // Apply substituents to the alkyl chain
    const otherSubsts = ctx.substituentTokens.filter((s) => s !== alkoxySubst);
    for (const subst of otherSubsts) {
      const substLocants = builderContext.getLocantsBeforeSubstituent(
        subst,
        ctx.locantTokens,
      );
      for (const loc of substLocants) {
        const atomIdx = builderContext.locantToAtomIndex(
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
}
