import type {
  SubstituentBuildStrategy,
  TokenContext,
  BuildResult,
} from "./types";
import type { MoleculeGraphBuilder } from "../../molecule-graph-builder";
import type { IUPACBuilderContext } from "../iupac-builder-context";

export abstract class BaseSubstituentStrategy
  implements SubstituentBuildStrategy
{
  abstract readonly name: string;
  abstract readonly priority: number;

  abstract matches(ctx: TokenContext): boolean;

  abstract build(
    builder: MoleculeGraphBuilder,
    ctx: TokenContext,
    builderContext: IUPACBuilderContext,
  ): BuildResult | null;

  protected log(message: string): void {
    if (process.env.VERBOSE) {
      console.log(`[${this.name}] ${message}`);
    }
  }

  protected hasToken(tokens: string[], value: string): boolean {
    return tokens.some((t) => t.toLowerCase() === value.toLowerCase());
  }

  protected findToken(tokens: { value: string }[], value: string): boolean {
    return tokens.some((t) => t.value.toLowerCase() === value.toLowerCase());
  }

  protected getAlkylLength(name: string): number {
    const alkylLengths: Record<string, number> = {
      meth: 1,
      methyl: 1,
      eth: 2,
      ethyl: 2,
      prop: 3,
      propyl: 3,
      but: 4,
      butyl: 4,
      pent: 5,
      pentyl: 5,
      hex: 6,
      hexyl: 6,
      hept: 7,
      heptyl: 7,
      oct: 8,
      octyl: 8,
      non: 9,
      nonyl: 9,
      dec: 10,
      decyl: 10,
    };
    return alkylLengths[name.toLowerCase()] || 0;
  }
}
