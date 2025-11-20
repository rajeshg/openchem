import type { IUPACToken } from "../iupac-types";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export interface TokenContext {
  allTokens: IUPACToken[];
  parentTokens: IUPACToken[];
  suffixTokens: IUPACToken[];
  substituentTokens: IUPACToken[];
  locantTokens: IUPACToken[];
  prefixTokens: IUPACToken[];
  multiplierTokens: IUPACToken[];
  stereoTokens: IUPACToken[];
}

export interface BuildResult {
  fragmentAtoms: number[];
  attachmentPoint: number;
}

export interface SubstituentBuildStrategy {
  readonly name: string;
  readonly priority: number;

  matches(ctx: TokenContext): boolean;

  build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null;
}

export function createTokenContext(tokens: IUPACToken[]): TokenContext {
  return {
    allTokens: tokens,
    parentTokens: tokens.filter((t) => t.type === "PARENT"),
    suffixTokens: tokens.filter((t) => t.type === "SUFFIX"),
    substituentTokens: tokens.filter((t) => t.type === "SUBSTITUENT"),
    locantTokens: tokens.filter((t) => t.type === "LOCANT"),
    prefixTokens: tokens.filter((t) => t.type === "PREFIX"),
    multiplierTokens: tokens.filter((t) => t.type === "MULTIPLIER"),
    stereoTokens: tokens.filter((t) => t.type === "STEREO"),
  };
}
