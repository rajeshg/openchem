import { BaseSubstituentStrategy } from "./base-strategy";
import type { TokenContext, BuildResult } from "./types";
import type { MoleculeGraphBuilder } from "../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";
import type { IUPACToken } from "../iupac-types";

export class PhenoxyStrategy extends BaseSubstituentStrategy {
  readonly name = "phenoxy";
  readonly priority = 95;

  matches(ctx: TokenContext): boolean {
    return ctx.substituentTokens.some((s) => s.value === "phenoxy");
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    this.log("Building phenoxy group");

    if (process.env.VERBOSE) {
      console.log(
        "[phenoxy] Context locants:",
        ctx.locantTokens.map((t) => t.value),
      );
      console.log(
        "[phenoxy] Context multipliers:",
        ctx.multiplierTokens.map((t) => t.value),
      );
      console.log(
        "[phenoxy] Context substituents:",
        ctx.substituentTokens.map((t) => t.value),
      );
    }

    const baseAtoms = builder.createBenzeneRing();

    for (const subst of ctx.substituentTokens.filter(
      (s) => s.value !== "phenoxy",
    )) {
      const multiplier = builderContext.getMultiplierBeforeSubstituent(
        subst,
        ctx.multiplierTokens,
      );
      const count = multiplier
        ? (multiplier.metadata?.count as number) || 1
        : 1;

      if (process.env.VERBOSE) {
        console.log(
          `[phenoxy] Processing substituent "${subst.value}", multiplier: ${multiplier?.value}, count: ${count}`,
        );
      }

      let locants = builderContext.getLocantsBeforeSubstituent(
        subst,
        ctx.locantTokens,
      );

      if (process.env.VERBOSE) {
        console.log(`[phenoxy] Initial locants for "${subst.value}":`, locants);
      }

      if (multiplier && locants.length < count) {
        const relevantLocants = ctx.locantTokens
          .filter((l) => l.position < multiplier.position)
          .sort((a, b) => b.position - a.position)
          .slice(0, count);

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

      for (const loc of locants) {
        const atomIdx = builderContext.locantToAtomIndex(loc, baseAtoms, false);
        if (atomIdx !== null) {
          this.applySubstituent(builder, builderContext, atomIdx, subst);
        }
      }
    }

    const oxygenIdx = builder.addAtom("O");
    builder.addBond(baseAtoms[0]!, oxygenIdx);

    return {
      fragmentAtoms: [...baseAtoms, oxygenIdx],
      attachmentPoint: oxygenIdx,
    };
  }

  private applySubstituent(
    builder: MoleculeGraphBuilder,
    builderContext: IUPACBuilderContext,
    atomIdx: number,
    subst: { value: string; nestedTokens?: IUPACToken[] },
  ): void {
    if (subst.nestedTokens && subst.nestedTokens.length > 0) {
      const nestedResult = this.buildNestedSubstituentRecursive(
        builder,
        builderContext,
        subst.nestedTokens,
      );
      if (nestedResult) {
        builder.addBond(atomIdx, nestedResult.attachmentPoint);
      }
    } else {
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

  private buildNestedSubstituentRecursive(
    builder: MoleculeGraphBuilder,
    builderContext: IUPACBuilderContext,
    tokens: IUPACToken[],
  ): BuildResult | null {
    // Type-safe access to buildNestedSubstituent method
    interface BuilderContextWithNested extends IUPACBuilderContext {
      buildNestedSubstituent?: (
        builder: MoleculeGraphBuilder,
        tokens: IUPACToken[],
      ) => BuildResult | null;
    }
    const ctx = builderContext as BuilderContextWithNested;
    return ctx.buildNestedSubstituent?.(builder, tokens) || null;
  }
}
