import type { TokenContext, BuildResult } from "./types";
import { BaseSubstituentStrategy } from "./base-strategy";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";
import { BondType as BondTypeEnum } from "types";

export class SulfonylStrategy extends BaseSubstituentStrategy {
  readonly name = "sulfonyl";
  readonly priority = 85; // High priority, check before acyl

  matches(ctx: TokenContext): boolean {
    // Pattern: single substituent containing sulfonyl/sulfinyl/sulfanyl
    // Example: "phenylsulfonyl", "methylsulfinyl", "methylsulfanyl"
    if (
      ctx.substituentTokens.length !== 1 ||
      ctx.parentTokens.length !== 0 ||
      ctx.suffixTokens.length !== 0
    ) {
      return false;
    }

    const substValue = ctx.substituentTokens[0]!.value;
    return (
      /^(.+)sulfonyl$/.test(substValue) ||
      /^(.+)sulfinyl$/.test(substValue) ||
      /^(.+)sulfanyl$/.test(substValue) ||
      /^(.+)sulfinylsulfanyl$/.test(substValue)
    );
  }

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    _builderContext: IUPACBuilderContext,
  ): BuildResult | null {
    const substValue = ctx.substituentTokens[0]!.value;

    // Check for compound sulfur patterns
    const sulfonylMatch = substValue.match(/^(.+)sulfonyl$/);
    const sulfinylMatch = substValue.match(/^(.+)sulfinyl$/);
    const sulfanylMatch = substValue.match(/^(.+)sulfanyl$/);
    const sulfinylsulfanylMatch = substValue.match(/^(.+)sulfinylsulfanyl$/);

    const match =
      sulfonylMatch || sulfinylMatch || sulfanylMatch || sulfinylsulfanylMatch;

    if (!match) {
      return null;
    }

    const alkylPart = match[1];
    const sulfurType = sulfonylMatch
      ? "sulfonyl"
      : sulfinylMatch
        ? "sulfinyl"
        : sulfinylsulfanylMatch
          ? "sulfinylsulfanyl"
          : "sulfanyl";

    this.log(`Building ${sulfurType} with alkyl part: ${alkylPart}`);

    // Build the alkyl/aryl part
    let alkylAtoms: number[] = [];
    if (alkylPart === "phenyl") {
      alkylAtoms = builder.createBenzeneRing();
    } else if (alkylPart === "methyl") {
      alkylAtoms = [builder.addCarbon()];
    } else if (alkylPart === "ethyl") {
      alkylAtoms = builder.createLinearChain(2);
    }

    if (alkylAtoms.length === 0) {
      return null;
    }

    // Add sulfur with oxygens
    const sIdx = builder.addAtom("S");
    builder.addBond(alkylAtoms[0]!, sIdx);

    if (sulfurType === "sulfinyl") {
      const oIdx = builder.addAtom("O");
      builder.addBond(sIdx, oIdx, BondTypeEnum.DOUBLE);
      return {
        fragmentAtoms: [...alkylAtoms, sIdx, oIdx],
        attachmentPoint: sIdx,
      };
    } else if (sulfurType === "sulfonyl") {
      const o1 = builder.addAtom("O");
      const o2 = builder.addAtom("O");
      builder.addBond(sIdx, o1, BondTypeEnum.DOUBLE);
      builder.addBond(sIdx, o2, BondTypeEnum.DOUBLE);
      return {
        fragmentAtoms: [...alkylAtoms, sIdx, o1, o2],
        attachmentPoint: sIdx,
      };
    } else if (sulfurType === "sulfinylsulfanyl") {
      // Add -S(=O)-S- structure
      const oIdx = builder.addAtom("O");
      const s2Idx = builder.addAtom("S");
      builder.addBond(sIdx, oIdx, BondTypeEnum.DOUBLE);
      builder.addBond(sIdx, s2Idx);
      return {
        fragmentAtoms: [...alkylAtoms, sIdx, oIdx, s2Idx],
        attachmentPoint: s2Idx,
      };
    }

    // sulfanyl has no oxygens
    return {
      fragmentAtoms: [...alkylAtoms, sIdx],
      attachmentPoint: sIdx,
    };
  }
}
