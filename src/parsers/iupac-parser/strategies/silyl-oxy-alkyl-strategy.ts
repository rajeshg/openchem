import { BaseSubstituentStrategy } from "./base-strategy";
import type { TokenContext, BuildResult } from "./types";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export class SilylOxyAlkylStrategy extends BaseSubstituentStrategy {
  readonly name = "silyl-oxy-alkyl";
  readonly priority = 100;

  matches(ctx: TokenContext): boolean {
    return (
      ctx.substituentTokens.length >= 2 &&
      ctx.parentTokens.length === 0 &&
      ctx.suffixTokens.length === 1 &&
      ctx.suffixTokens[0]!.value === "oxy" &&
      this.isSilylSubstituent(ctx.substituentTokens[0]!.value)
    );
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    const firstSubst = ctx.substituentTokens[0]!.value;

    let silylName = firstSubst;
    if (silylName.endsWith("silyloxy")) {
      silylName = silylName.slice(0, -3);
    } else if (silylName.endsWith("silanyloxy")) {
      silylName = silylName.slice(0, -3);
    }

    const siIdx = builderContext.buildSilylGroup(builder, silylName);
    this.log(`Built silyl group: ${silylName}`);

    const oIdx = builder.addAtom("O");
    builder.addBond(siIdx, oIdx);
    this.log("Added oxygen linkage for silyl-oxy pattern");

    const remainingSubsts = ctx.substituentTokens.slice(1);
    const chainAtoms: number[] = [];

    for (const subst of remainingSubsts) {
      const substName = subst.value;

      if (substName === "methyl") {
        const cIdx = builder.addAtom("C");
        chainAtoms.push(cIdx);
      } else if (substName === "ethyl") {
        const c1 = builder.addAtom("C");
        const c2 = builder.addAtom("C");
        builder.addBond(c1, c2);
        chainAtoms.push(c1, c2);
      } else if (substName === "propyl") {
        const c1 = builder.addAtom("C");
        const c2 = builder.addAtom("C");
        const c3 = builder.addAtom("C");
        builder.addBond(c1, c2);
        builder.addBond(c2, c3);
        chainAtoms.push(c1, c2, c3);
      } else {
        const alkylLength = this.getAlkylLength(substName);
        if (alkylLength > 0) {
          const atoms = builder.createLinearChain(alkylLength);
          chainAtoms.push(...atoms);
        }
      }
    }

    if (chainAtoms.length > 0) {
      builder.addBond(oIdx, chainAtoms[0]!);
      this.log(
        `Connected silyl-O to ${remainingSubsts.map((s) => s.value).join("-")} chain`,
      );

      return {
        fragmentAtoms: [siIdx, oIdx, ...chainAtoms],
        attachmentPoint: chainAtoms[0]!,
      };
    }

    return {
      fragmentAtoms: [siIdx, oIdx],
      attachmentPoint: oIdx,
    };
  }

  private isSilylSubstituent(value: string): boolean {
    return value.includes("silyl") || value.includes("silanyl");
  }
}
