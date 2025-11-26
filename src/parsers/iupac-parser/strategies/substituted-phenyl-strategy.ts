import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export class SubstitutedPhenylStrategy extends BaseSubstituentStrategy {
  readonly name = "substituted-phenyl";
  readonly priority = 90; // High priority - check before other phenyl-related patterns

  matches(ctx: TokenContext): boolean {
    // Pattern: substituentTokens contains one ending in "phenyl"
    // Example: "4-chlorophenyl", "2,5-dimethoxyphenyl", "phenyl"
    // Should NOT match if there's a parent (handled by monolithic)
    if (ctx.parentTokens.length > 0) {
      return false;
    }

    // Should NOT match if there's a suffix (e.g., sulfamoyl, sulfonyl, etc.)
    // In that case, the substituent-phenyl is part of the suffix, not standalone
    if (ctx.suffixTokens.length > 0) {
      return false;
    }

    const hasPhenylSubst = ctx.substituentTokens.some((s) =>
      s.value.toLowerCase().endsWith("phenyl"),
    );

    return hasPhenylSubst;
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    const phenylToken = ctx.substituentTokens.find((s) =>
      s.value.toLowerCase().endsWith("phenyl"),
    )!;

    this.log(`Building substituted phenyl: ${phenylToken.value}`);

    // Create benzene ring
    const benzeneAtoms = builder.createBenzeneRing();
    const phenylVal = phenylToken.value.toLowerCase();

    // Check if there are other substituents in the context (besides phenyl itself)
    const otherSubsts = ctx.substituentTokens.filter((s) => s !== phenylToken);

    // If it's just "phenyl" with NO other substituents, return the unsubstituted ring
    if (phenylVal === "phenyl" && otherSubsts.length === 0) {
      return {
        fragmentAtoms: benzeneAtoms,
        attachmentPoint: benzeneAtoms[0]!,
      };
    }

    // Extract substituent prefix (e.g., "dimethoxy" from "dimethoxyphenyl")
    const prefix = phenylVal.replace("phenyl", "");

    // Handle common patterns: dimethoxy, methoxy, chloro, fluoro, etc.
    if (prefix.includes("methoxy")) {
      // Apply methoxy groups at locant positions
      for (const locToken of ctx.locantTokens) {
        const locs = (locToken.metadata?.positions as number[]) || [];
        for (const loc of locs) {
          const atomIdx = builderContext.locantToAtomIndex(loc, benzeneAtoms, false);
          if (atomIdx !== null) {
            const oIdx = builder.addAtom("O");
            builder.addBond(atomIdx, oIdx);
            builder.addMethyl(oIdx);
          }
        }
      }
    }

    // Apply other substituents (chloro, fluoro, bromo, hydroxy, etc.)

    if (process.env.VERBOSE) {
      console.log(
        `[substituted-phenyl] Other substituents: ${otherSubsts.map((s) => s.value).join(", ")}`,
      );
      console.log(
        `[substituted-phenyl] Locant tokens: ${ctx.locantTokens.map((l) => `${l.value}@${l.position}`).join(", ")}`,
      );
    }

    for (const subst of otherSubsts) {
      const substLocants = builderContext.getLocantsBeforeSubstituent(subst, ctx.locantTokens);

      if (process.env.VERBOSE) {
        console.log(
          `[substituted-phenyl] Substituent "${subst.value}" locants: [${substLocants.join(", ")}]`,
        );
      }

      for (const loc of substLocants) {
        const atomIdx = builderContext.locantToAtomIndex(loc, benzeneAtoms, false);
        if (atomIdx !== null) {
          // Handle nested complex substituents (e.g., "(2-methoxyphenyl)sulfamoyl")
          if (subst.nestedTokens && subst.nestedTokens.length > 0) {
            this.applyNestedSubstituent(builder, builderContext, subst, atomIdx);
          } else if (subst.value === "methoxy") {
            const oIdx = builder.addAtom("O");
            builder.addBond(atomIdx, oIdx);
            builder.addMethyl(oIdx);
          } else if (subst.value === "chloro") {
            const clIdx = builder.addAtom("Cl");
            builder.addBond(atomIdx, clIdx);
          } else if (subst.value === "fluoro") {
            const fIdx = builder.addAtom("F");
            builder.addBond(atomIdx, fIdx);
          } else if (subst.value === "bromo") {
            const brIdx = builder.addAtom("Br");
            builder.addBond(atomIdx, brIdx);
          } else if (subst.value === "iodo") {
            const iIdx = builder.addAtom("I");
            builder.addBond(atomIdx, iIdx);
          } else if (subst.value === "hydroxy" || subst.value === "hydroxyl") {
            const oIdx = builder.addAtom("O");
            builder.addBond(atomIdx, oIdx);
          } else if (subst.value === "methyl") {
            builder.addMethyl(atomIdx);
          } else if (subst.value === "ethyl") {
            builder.addEthyl(atomIdx);
          }
        }
      }
    }

    return {
      fragmentAtoms: benzeneAtoms,
      attachmentPoint: benzeneAtoms[0]!,
    };
  }

  private applyNestedSubstituent(
    builder: MoleculeGraphBuilder,
    builderContext: IUPACBuilderContext & {
      buildNestedSubstituent?: (
        builder: MoleculeGraphBuilder,
        tokens: unknown[],
      ) => BuildResult | null;
    },
    subst: { nestedTokens?: unknown[] },
    attachAtomIdx: number,
  ): void {
    if (subst.nestedTokens && subst.nestedTokens.length > 0) {
      const nestedResult = this.buildNestedSubstituentRecursive(
        builder,
        builderContext,
        subst.nestedTokens,
      );
      if (nestedResult) {
        builder.addBond(attachAtomIdx, nestedResult.attachmentPoint);
        this.log(`Applied nested substituent with ${nestedResult.fragmentAtoms.length} atoms`);
      }
    }
  }

  private buildNestedSubstituentRecursive(
    builder: MoleculeGraphBuilder,
    builderContext: IUPACBuilderContext & {
      buildNestedSubstituent?: (
        builder: MoleculeGraphBuilder,
        tokens: unknown[],
      ) => BuildResult | null;
    },
    tokens: unknown[],
  ): BuildResult | null {
    return builderContext.buildNestedSubstituent?.(builder, tokens) || null;
  }
}
