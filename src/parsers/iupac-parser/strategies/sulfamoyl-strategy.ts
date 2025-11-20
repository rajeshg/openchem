import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";
import { BondType as BondTypeEnum } from "types";

export class SulfamoylStrategy extends BaseSubstituentStrategy {
  readonly name = "sulfamoyl";
  readonly priority = 87; // Between sulfonyl (85) and substituted-phenyl (90)

  matches(ctx: TokenContext): boolean {
    // Pattern: substituent containing "sulfamoyl" OR suffix "sulfamoyl"
    // Example: "phenylsulfamoyl", or parent="sulfam" + suffix="oyl"
    // Should NOT match if there's a parent (handled by monolithic)
    if (ctx.parentTokens.length > 0) {
      // Unless the parent is "sulfam" with "oyl" suffix
      const hasSulfamParent = ctx.parentTokens.some((p) =>
        p.value.toLowerCase().includes("sulfam"),
      );
      const hasOylSuffix = ctx.suffixTokens.some((s) => s.value === "oyl");
      if (!hasSulfamParent || !hasOylSuffix) {
        return false;
      }
    }

    // Check for sulfamoyl in substituents
    const hasSulfamoylSubst = ctx.substituentTokens.some(
      (s) =>
        s.value.toLowerCase().includes("sulfamoyl") ||
        s.value.toLowerCase() === "sulfam",
    );

    // Check for sulfamoyl as suffix
    const hasSulfamoylSuffix = ctx.suffixTokens.some(
      (s) => s.value === "sulfamoyl" || s.value === "oyl",
    );

    return hasSulfamoylSubst || hasSulfamoylSuffix;
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    this.log("Building sulfamoyl group");

    // Check if there's a substituent prefix (e.g., "phenyl" in "phenylsulfamoyl")
    let prefixAtoms: number[] = [];
    let prefixResult: BuildResult | null = null;

    // Look for substituent ending in "sulfamoyl"
    const sulfamoylSubst = ctx.substituentTokens.find((s) =>
      s.value.toLowerCase().includes("sulfamoyl"),
    );

    if (sulfamoylSubst) {
      const substValue = sulfamoylSubst.value.toLowerCase();
      const match = substValue.match(/^(.+)sulfamoyl$/);

      if (match) {
        const prefix = match[1];
        if (prefix === "phenyl") {
          prefixAtoms = builder.createBenzeneRing();
        } else if (prefix === "methyl") {
          prefixAtoms = [builder.addCarbon()];
        } else if (prefix === "ethyl") {
          prefixAtoms = builder.createLinearChain(2);
        }
      }
    } else {
      // Look for separate substituents (e.g., "2-methoxyphenyl" + suffix "sulfamoyl")
      // Build prefix substituents recursively
      const prefixSubsts = ctx.substituentTokens.filter(
        (s) => !s.value.toLowerCase().includes("sulfamoyl"),
      );

      if (prefixSubsts.length > 0) {
        // Recursively build the prefix using buildNestedSubstituent if available
        const enhancedContext = builderContext as IUPACBuilderContext & {
          buildNestedSubstituent?: (
            builder: MoleculeGraphBuilder,
            tokens: unknown[],
          ) => BuildResult | null;
        };

        if (enhancedContext.buildNestedSubstituent) {
          // Use nestedTokens if available, otherwise use substituent tokens
          const firstSubst = prefixSubsts[0]!;
          const tokens = firstSubst.nestedTokens || prefixSubsts;
          prefixResult = enhancedContext.buildNestedSubstituent(
            builder,
            tokens,
          );
          if (prefixResult) {
            prefixAtoms = prefixResult.fragmentAtoms;
            this.log(
              `Built prefix substituent with ${prefixAtoms.length} atoms using recursive builder`,
            );
          }
        } else {
          // Fallback: simple substituent handling
          for (const subst of prefixSubsts) {
            const val = subst.value.toLowerCase();
            if (val === "phenyl" || val.endsWith("phenyl")) {
              prefixAtoms = builder.createBenzeneRing();
            } else if (val === "methyl") {
              prefixAtoms = [builder.addCarbon()];
            } else if (val === "ethyl") {
              prefixAtoms = builder.createLinearChain(2);
            }
          }
        }
      }
    }

    // Build sulfamoyl: -S(=O)(=O)-NH2 or R-S(=O)(=O)-NH2
    const sIdx = builder.addAtom("S");
    const o1 = builder.addAtom("O");
    const o2 = builder.addAtom("O");
    const nIdx = builder.addAtom("N");

    builder.addBond(sIdx, o1, BondTypeEnum.DOUBLE);
    builder.addBond(sIdx, o2, BondTypeEnum.DOUBLE);
    builder.addBond(sIdx, nIdx);

    // If there's a prefix (e.g., phenyl), attach it to nitrogen
    if (prefixAtoms.length > 0) {
      const attachPt = prefixResult?.attachmentPoint ?? prefixAtoms[0]!;
      builder.addBond(nIdx, attachPt);
      this.log(`Built sulfamoyl with ${prefixAtoms.length}-atom prefix`);
      return {
        fragmentAtoms: [sIdx, o1, o2, nIdx, ...prefixAtoms],
        attachmentPoint: sIdx,
      };
    }

    return {
      fragmentAtoms: [sIdx, o1, o2, nIdx],
      attachmentPoint: sIdx,
    };
  }
}
