import { BaseSubstituentStrategy } from "./base-strategy";
import type { TokenContext, BuildResult } from "./types";
import type { MoleculeGraphBuilder } from "../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export class AlkylStrategy extends BaseSubstituentStrategy {
  readonly name = "alkyl";
  readonly priority = 70;

  matches(ctx: TokenContext): boolean {
    const hasYlSuffix = ctx.suffixTokens.some((s) => s.value === "yl");
    const hasYnSuffix = ctx.suffixTokens.some(
      (s) => s.value && (s.value.endsWith("yn") || s.value.endsWith("yne")),
    );
    const isAlkyne = hasYnSuffix && hasYlSuffix;

    const isSimpleAlkyl =
      (hasYlSuffix || isAlkyne) && ctx.parentTokens.length > 0;
    const hasComplexPrefix = ctx.prefixTokens.some(
      (p) => p.value.includes("spiro") || p.value.includes("bicyclo"),
    );
    const hasComplexSuffix = ctx.suffixTokens.some(
      (s) => s.value === "oxa" || s.value === "en" || s.value === "ene",
    );

    return isSimpleAlkyl && !hasComplexPrefix && !hasComplexSuffix;
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    const parentToken = ctx.parentTokens[0]!;
    const parentValue = parentToken.value.toLowerCase();

    const ylToken = ctx.suffixTokens.find((s) => s.value === "yl")!;
    const attachLocants = builderContext.getLocantsBeforeSuffix(
      ylToken,
      ctx.locantTokens,
    );
    const attachPosition = attachLocants.length > 0 ? attachLocants[0]! : 1;

    const hasYnSuffix = ctx.suffixTokens.some(
      (s) => s.value && (s.value.endsWith("yn") || s.value.endsWith("yne")),
    );
    const isAlkyne = hasYnSuffix && ylToken !== undefined;

    let triplePos: number | null = null;
    if (isAlkyne) {
      const ynToken = ctx.suffixTokens.find(
        (s) => s.value && (s.value.endsWith("yn") || s.value.endsWith("yne")),
      )!;
      const ynLocants = builderContext.getLocantsBeforeSuffix(
        ynToken,
        ctx.locantTokens,
      );
      if (ynLocants.length > 0) {
        triplePos = ynLocants[0]!;
      }
    }

    if (
      parentValue === "prop" &&
      attachPosition === 2 &&
      ctx.substituentTokens.length === 0 &&
      !isAlkyne
    ) {
      return builderContext.buildBranchedAlkylFragment(builder, "isopropyl");
    }

    if (
      parentValue === "but" &&
      attachPosition === 2 &&
      ctx.substituentTokens.length === 0 &&
      !isAlkyne
    ) {
      return builderContext.buildBranchedAlkylFragment(builder, "sec-butyl");
    }

    if (
      parentValue === "prop" &&
      attachPosition === 2 &&
      ctx.substituentTokens.some((s) => s.value === "methyl") &&
      !isAlkyne
    ) {
      return builderContext.buildBranchedAlkylFragment(builder, "tert-butyl");
    }

    if (
      parentValue === "but" &&
      attachPosition === 2 &&
      ctx.substituentTokens.some((s) => s.value === "methyl") &&
      !isAlkyne
    ) {
      const chainAtoms = builder.createLinearChain(4);
      builder.addMethyl(chainAtoms[1]!);
      return {
        fragmentAtoms: chainAtoms,
        attachmentPoint: chainAtoms[1]!,
      };
    }

    const smiles = parentToken.metadata?.smiles as string;
    if (smiles) {
      const chainLength = smiles.length;
      const chainAtoms = builder.createLinearChain(chainLength);

      if (isAlkyne && triplePos !== null) {
        if (triplePos >= 1 && triplePos < chainAtoms.length) {
          const atom1 = chainAtoms[triplePos - 1]!;
          const atom2 = chainAtoms[triplePos]!;
          builder.addTripleBond(atom1, atom2);
        }
      }

      for (const subst of ctx.substituentTokens) {
        const substLocants = builderContext.getLocantsBeforeSubstituent(
          subst,
          ctx.locantTokens,
        );
        for (const loc of substLocants) {
          const atomIdx = builderContext.locantToAtomIndex(
            loc,
            chainAtoms,
            false,
          );
          if (atomIdx !== null) {
            this.applySubstituent(builder, atomIdx, subst.value);
          }
        }
      }

      builderContext.applyStereo(
        builder,
        chainAtoms,
        ctx.stereoTokens,
        ctx.suffixTokens,
        ctx.locantTokens,
      );

      const attachIdx = builderContext.locantToAtomIndex(
        attachPosition,
        chainAtoms,
        false,
      );
      if (attachIdx !== null) {
        this.log(
          `Built alkyl chain ${parentValue} with ${chainAtoms.length} carbons`,
        );
        return {
          fragmentAtoms: chainAtoms,
          attachmentPoint: attachIdx,
        };
      }
    }

    return null;
  }

  private applySubstituent(
    builder: MoleculeGraphBuilder,
    atomIdx: number,
    value: string,
  ): void {
    if (value === "hydroxy" || value === "hydroxyl") {
      builder.addHydroxyl(atomIdx);
    } else if (value === "methyl") {
      builder.addMethyl(atomIdx);
    } else if (value === "ethyl") {
      builder.addEthyl(atomIdx);
    } else if (value === "chloro") {
      const clIdx = builder.addAtom("Cl");
      builder.addBond(atomIdx, clIdx);
    } else if (value === "bromo") {
      const brIdx = builder.addAtom("Br");
      builder.addBond(atomIdx, brIdx);
    }
  }
}
