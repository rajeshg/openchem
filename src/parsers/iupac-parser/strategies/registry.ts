import type { SubstituentBuildStrategy, TokenContext } from "./types";
import { SilylOxyAlkylStrategy } from "./silyl-oxy-alkyl-strategy";
import { SubstitutedPhenylStrategy } from "./substituted-phenyl-strategy";
import { PhenoxyStrategy } from "./phenoxy-strategy";
import { SulfamoylStrategy } from "./sulfamoyl-strategy";
import { SulfonylStrategy } from "./sulfonyl-strategy";
import { YlideneaminoStrategy } from "./ylideneamino-strategy";
import { AnilinoStrategy } from "./anilino-strategy";
import { AcylStrategy } from "./acyl-strategy";
import { AlkylideneStrategy } from "./alkylidene-strategy";
import { BranchedAlkylStrategy } from "./branched-alkyl-strategy";
import { AlkoxyStrategy } from "./alkoxy-strategy";
import { AlkylStrategy } from "./alkyl-strategy";
import { SubstitutedAlkylStrategy } from "./substituted-alkyl-strategy";

export class StrategyRegistry {
  private strategies: SubstituentBuildStrategy[] = [];

  constructor() {
    this.registerDefaultStrategies();
  }

  register(strategy: SubstituentBuildStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  findStrategy(ctx: TokenContext): SubstituentBuildStrategy | null {
    if (process.env.VERBOSE) {
      console.log(`[registry] Trying to match against ${this.strategies.length} strategies`);
      console.log(`[registry] Context:`, {
        parents: ctx.parentTokens.map((t) => t.value),
        suffixes: ctx.suffixTokens.map((t) => t.value),
        substituents: ctx.substituentTokens.map((t) => t.value),
      });
    }

    for (const strategy of this.strategies) {
      const matches = strategy.matches(ctx);
      if (process.env.VERBOSE) {
        console.log(
          `[registry]   ${strategy.name} (priority=${strategy.priority}): ${matches ? "✓ MATCH" : "✗ no match"}`,
        );
      }
      if (matches) {
        return strategy;
      }
    }
    return null;
  }

  private registerDefaultStrategies(): void {
    this.register(new SilylOxyAlkylStrategy());
    this.register(new SubstitutedPhenylStrategy());
    this.register(new PhenoxyStrategy());
    this.register(new SulfamoylStrategy());
    this.register(new SulfonylStrategy());
    this.register(new YlideneaminoStrategy());
    this.register(new AnilinoStrategy());
    this.register(new AcylStrategy());
    this.register(new AlkylideneStrategy());
    this.register(new BranchedAlkylStrategy());
    this.register(new AlkoxyStrategy());
    this.register(new AlkylStrategy());
    this.register(new SubstitutedAlkylStrategy());
  }

  getAllStrategies(): SubstituentBuildStrategy[] {
    return [...this.strategies];
  }
}

export const defaultRegistry = new StrategyRegistry();
