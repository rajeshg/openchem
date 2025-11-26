import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export class AnilinoStrategy extends BaseSubstituentStrategy {
  readonly name = "anilino";
  readonly priority = 82; // Between sulfonyl (85) and acyl (80)

  matches(ctx: TokenContext): boolean {
    // Pattern: anilino WITHOUT parent (implicitly defines a benzene ring)
    // Example: "4-nitroanilino", "4-nitro-3-(trifluoromethyl)anilino", "2,4-dimethoxyanilino"
    // Note: When anilino appears as a substituent on a parent ring (e.g., quinoline),
    // it should be handled by the monolithic fallback code, not this strategy
    const hasAnilinoSubst = ctx.substituentTokens.some((s) =>
      s.value.toLowerCase().endsWith("anilino"),
    );
    return hasAnilinoSubst && ctx.parentTokens.length === 0;
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    this.log("Building benzene ring with implicit parent for anilino");

    // Create benzene ring
    const benzeneAtoms = builder.createBenzeneRing();

    // Find the anilino token to check for nested substituents
    const anilinoToken = ctx.substituentTokens.find((s) =>
      s.value.toLowerCase().endsWith("anilino"),
    );

    if (process.env.VERBOSE && anilinoToken) {
      console.log(
        `[strategy:anilino] Anilino token: "${anilinoToken.value}", nestedTokens:`,
        anilinoToken.nestedTokens?.length || 0,
      );
      if (anilinoToken.nestedTokens) {
        console.log(
          `[strategy:anilino] Nested token details:`,
          anilinoToken.nestedTokens.map((t) => `${t.type}:${t.value}`).join(", "),
        );
      }
    }

    // Apply ONLY substituents from the anilino token's nested tokens OR from the context
    // (depending on whether tokens are nested or flattened)
    let substToApply: typeof ctx.substituentTokens = [];
    let locantsToUse: typeof ctx.locantTokens = [];
    let multipliersToUse: typeof ctx.multiplierTokens = [];

    // Case 1: anilino token has nestedTokens (e.g., "2,4-dimethoxyanilino" as compound token)
    if (anilinoToken?.nestedTokens && anilinoToken.nestedTokens.length > 0) {
      const nestedSubsts = anilinoToken.nestedTokens.filter(
        (t) => t.type === "SUBSTITUENT" && !t.value.toLowerCase().endsWith("anilino"),
      );
      const nestedLocants = anilinoToken.nestedTokens.filter((t) => t.type === "LOCANT");
      const nestedMultipliers = anilinoToken.nestedTokens.filter((t) => t.type === "MULTIPLIER");

      substToApply = nestedSubsts;
      locantsToUse = nestedLocants;
      multipliersToUse = nestedMultipliers;

      if (process.env.VERBOSE) {
        console.log(
          `[strategy:anilino] Found ${nestedSubsts.length} nested substituents in anilino: ${nestedSubsts.map((s) => s.value).join(", ")}`,
        );
        if (nestedLocants.length > 0) {
          console.log(
            `[strategy:anilino] Nested locants: ${nestedLocants.map((l) => l.value).join(", ")}`,
          );
        }
        if (nestedMultipliers.length > 0) {
          console.log(
            `[strategy:anilino] Nested multipliers: ${nestedMultipliers.map((m) => m.value).join(", ")}`,
          );
        }
      }
    } else {
      // Case 2: tokens are already flattened in context (e.g., ["nitro", "trifluoromethyl", "anilino"])
      // Apply all substituents EXCEPT anilino itself
      substToApply = ctx.substituentTokens.filter(
        (s) => !s.value.toLowerCase().endsWith("anilino"),
      );
      locantsToUse = ctx.locantTokens;
      multipliersToUse = ctx.multiplierTokens;

      if (process.env.VERBOSE) {
        console.log(
          `[strategy:anilino] Using flattened context substituents: ${substToApply.map((s) => s.value).join(", ")}`,
        );
      }
    }

    if (process.env.VERBOSE) {
      console.log(
        `[strategy:anilino] Applying ${substToApply.length} substituents to benzene ring: ${substToApply.map((s) => s.value).join(", ")}`,
      );
      console.log(
        `[strategy:anilino] Locant tokens: ${locantsToUse.map((l) => `${l.value}@${l.position}`).join(", ")}`,
      );
    }

    builderContext.applySubstituents(
      builder,
      benzeneAtoms,
      substToApply,
      locantsToUse,
      multipliersToUse,
      false,
      [],
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
}
