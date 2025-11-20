import type { SubstituentBuildStrategy, TokenContext } from "./types";
import { SilylOxyAlkylStrategy } from "./silyl-oxy-alkyl-strategy";
import { PhenoxyStrategy } from "./phenoxy-strategy";
import { AlkylStrategy } from "./alkyl-strategy";

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
      console.log(
        `[registry] Trying to match against ${this.strategies.length} strategies`,
      );
      console.log(`[registry] Context:`, {
        parents: ctx.parentTokens.map((t) => t.value),
        suffixes: ctx.suffixTokens.map((t) => t.value),
        substituents: ctx.substituentTokens.map((t) => t.value),
        locants: ctx.locantTokens.map((t) => t.value),
        multipliers: ctx.multiplierTokens.map((t) => t.value),
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
    this.register(new PhenoxyStrategy());
    this.register(new AlkylStrategy());
  }

  getAllStrategies(): SubstituentBuildStrategy[] {
    return [...this.strategies];
  }
}

export const defaultRegistry = new StrategyRegistry();
