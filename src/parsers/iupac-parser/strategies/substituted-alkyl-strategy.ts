import { BaseSubstituentStrategy } from "./base-strategy";
import type { TokenContext, BuildResult } from "./types";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export class SubstitutedAlkylStrategy extends BaseSubstituentStrategy {
  readonly name = "substituted-alkyl";
  readonly priority = 60;

  matches(ctx: TokenContext): boolean {
    if (ctx.parentTokens.length !== 0) return false;
    if (ctx.substituentTokens.length < 2) return false;

    // Check if there's a yl suffix
    const hasYlSuffix = ctx.suffixTokens.some((s) => s.value === "yl");
    if (!hasYlSuffix) return false;

    // Look for alkyl base in substituents OR multipliers (pentyl has "pent" as MULTIPLIER token)
    const alkylBaseInSubst = ctx.substituentTokens.find((s) => {
      const val = s.value.toLowerCase();
      const base = val.endsWith("yl") ? val.slice(0, -2) : val;
      return this.isAlkylBase(base);
    });

    const alkylBaseInMult = ctx.multiplierTokens.find((m) => {
      const val = m.value.toLowerCase();
      return this.isAlkylBase(val);
    });

    return alkylBaseInSubst !== undefined || alkylBaseInMult !== undefined;
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    // Collect all potential alkyl bases
    const substBases = ctx.substituentTokens.filter((s) => {
      const val = s.value.toLowerCase();
      const base = val.endsWith("yl") ? val.slice(0, -2) : val;
      return this.isAlkylBase(base);
    });

    const multBases = ctx.multiplierTokens.filter((m) => {
      const val = m.value.toLowerCase();
      return this.isAlkylBase(val);
    });

    // Prefer multiplier bases (like "pent" in "trimethylpentyl") over substituent bases (like "methyl")
    // Because the longest chain should be the parent
    let alkylBaseToken = multBases.length > 0 ? multBases[0] : substBases[0];

    if (!alkylBaseToken) return null;

    this.log(`Building substituted alkyl based on ${alkylBaseToken.value}`);

    const chainLen = this.getChainLength(alkylBaseToken.value.toLowerCase());
    const chainAtoms = builder.createLinearChain(chainLen);

    const otherSubsts = ctx.substituentTokens.filter((s) => s !== alkylBaseToken);

    if (otherSubsts.length > 0) {
      builderContext.applySubstituents(
        builder,
        chainAtoms,
        otherSubsts,
        ctx.locantTokens,
        ctx.multiplierTokens,
        false,
        [],
        [],
      );
    }

    return {
      fragmentAtoms: chainAtoms,
      attachmentPoint: chainAtoms[0]!,
    };
  }

  private isAlkylBase(base: string): boolean {
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
  }

  private getChainLength(val: string): number {
    if (val.startsWith("eth")) return 2;
    if (val.startsWith("prop")) return 3;
    if (val.startsWith("but")) return 4;
    if (val.startsWith("pent")) return 5;
    if (val.startsWith("hex")) return 6;
    if (val.startsWith("hept")) return 7;
    if (val.startsWith("oct")) return 8;
    if (val.startsWith("non")) return 9;
    if (val.startsWith("dec")) return 10;
    return 1; // methyl
  }
}
