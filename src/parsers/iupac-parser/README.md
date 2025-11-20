# IUPAC Parser

This directory contains all code for parsing IUPAC chemical names into SMILES molecular structures.

## Architecture

### Core Files

- **iupac-parser.ts** - Main entry point: `parseIUPACName(name: string)`
- **iupac-tokenizer.ts** - Tokenizes IUPAC names into structured tokens
- **iupac-types.ts** - Type definitions for tokens and parse results
- **iupac-graph-builder.ts** - Main orchestrator that builds molecular graphs from tokens
- **iupac-builder-context.ts** - Interface for builder methods (shared across files)

### Specialized Builders

- **iupac-nested-substituent-builder.ts** - Handles complex nested substituents (e.g., phenoxy, alkyl chains)
- **iupac-specialized-builders.ts** - Specialized logic for specific functional groups
- **iupac-substituent-applicator.ts** - Applies substituents to parent chains/rings
- **iupac-suffix-applicator.ts** - Applies suffixes (functional groups) to structures

### Strategies Pattern

The `strategies/` directory contains a strategy pattern implementation for handling nested substituent patterns:

#### Strategy Architecture
- **types.ts** - Core interfaces: `SubstituentBuildStrategy`, `TokenContext`, `BuildResult`
- **base-strategy.ts** - Abstract base class with helper methods
- **registry.ts** - Strategy registry with priority-based matching
- **constants.ts** - Magic string constants for pattern matching

#### Implemented Strategies (Priority Order)
1. **SilylOxyAlkylStrategy** (100) - Handles `[tert-butyl(dimethyl)silyl]oxymethyl` patterns
2. **PhenoxyStrategy** (95) - Handles phenoxy groups with substituents
3. **AlkylStrategy** (70) - Handles simple alkyl chains (excludes complex spiro/bicyclo)
4. **SubstitutedAlkylStrategy** (60) - Handles substituted alkyl groups (e.g., "2-oxoethyl")

#### Hybrid Approach
The implementation uses a **hybrid strategy-fallback pattern**:
1. Try strategy-based matching first (explicit priorities, testable)
2. Fall back to original monolithic code for complex cases
3. Provides gradual migration path without breaking existing functionality

#### Adding New Strategies
```typescript
export class NewPatternStrategy extends BaseSubstituentStrategy {
  readonly name = "new-pattern";
  readonly priority = 85; // Higher = checked first
  
  matches(ctx: TokenContext): boolean {
    // Return true if this strategy can handle the pattern
  }
  
  build(builder, ctx, builderContext): BuildResult | null {
    // Build the molecular fragment
    this.log("Building new pattern");
    // ... implementation
    return { fragmentAtoms, attachmentPoint };
  }
}
```

Then register in `registry.ts`:
```typescript
this.register(new NewPatternStrategy());
```

## Usage

```typescript
import { parseIUPACName } from "src/parsers/iupac-parser/iupac-parser";

const result = parseIUPACName("2-methylpropan-2-ol");
// result.molecule contains the molecular graph
// result.smiles contains the canonical SMILES
```

## Testing

- Main tests: `test/unit/iupac-engine/`
- 720+ passing tests
- 93.5% accuracy on realistic molecules

## Known Limitations

See `docs/iupac-capabilities.md` for detailed capabilities and roadmap.
