import type { IUPACToken, IUPACTokenizationResult, OPSINRules } from "./iupac-types";

/**
 * IUPAC tokenizer - converts IUPAC name strings into semantic tokens
 * Uses greedy longest-match algorithm with priority ordering
 */
export class IUPACTokenizer {
  private rules: OPSINRules;
  private locantRegex: RegExp;
  private stereoRegex: RegExp;

  constructor(rules: OPSINRules) {
    this.rules = rules;
    // Updated regex to handle:
    // - Simple: 1, 1,2,3
    // - With citations: 14(22), 1,2(33), etc.
    this.locantRegex = /^\d+(?:\(\d+\))?(?:,\d+(?:\(\d+\))?)*/;
    // Updated stereo regex to handle citation numbers before stereo markers
    // E.g., "2Z", "14R", "6S" or just "Z", "R", "S", "@", "@@"
    this.stereoRegex = /^\d*(?:@{1,2}|E|Z|R|S)/i;
  }

  /**
   * Tokenize an IUPAC name into semantic units
   */
  tokenize(name: string): IUPACTokenizationResult {
    const normalized = name.toLowerCase().trim();
    const tokens: IUPACToken[] = [];
    const errors: string[] = [];
    let pos = 0;

    while (pos < normalized.length) {
      const remaining = normalized.substring(pos);

      // Skip hyphens and other punctuation between tokens
      if (remaining[0] === "-" || remaining[0] === "," || remaining[0] === " ") {
        pos++;
        continue;
      }

      // Check for parenthetical groups
      if (remaining[0] === "(") {
        const closeIdx = this.findMatchingParen(normalized, pos);
        if (closeIdx !== -1) {
          // Extract content within parentheses
          const parenContent = normalized.substring(pos + 1, closeIdx);

          // Check if this is a stereochemistry marker (E, Z, R, S, @, @@, or locant combos like 1R,2S)
          // Stereo markers are typically short (1-10 chars) and contain only letters, numbers, commas, @
          const isStereoMarker = /^[\d,@ezrs]+$/i.test(parenContent) && parenContent.length <= 10;

          if (isStereoMarker) {
            // Skip the opening paren, let the stereo regex match the content, skip closing paren
            pos++; // Skip '('
            continue;
          }

          // This is a compound substituent group - tokenize recursively
          const nestedResult = this.tokenize(parenContent);

          // Create a compound substituent token with nested structure
          tokens.push({
            type: "SUBSTITUENT",
            value: parenContent,
            position: pos,
            length: closeIdx - pos + 1,
            nestedTokens: nestedResult.tokens,
            isInParentheses: true,
            metadata: {
              isParentheticalGroup: true,
            },
          });

          pos = closeIdx + 1;
          continue;
        }
      }

      // Skip closing parenthesis (shouldn't normally reach here)
      if (remaining[0] === ")") {
        pos++;
        continue;
      }

      // Check for square bracket groups (e.g., [1-(2-methylbutoxy)ethoxy])
      if (remaining[0] === "[") {
        // Find matching closing bracket, accounting for nested brackets
        let closeBracketIdx = -1;
        let bracketDepth = 1;
        for (let i = 1; i < remaining.length; i++) {
          if (remaining[i] === "[") {
            bracketDepth++;
          } else if (remaining[i] === "]") {
            bracketDepth--;
            if (bracketDepth === 0) {
              closeBracketIdx = i;
              break;
            }
          }
        }

        if (closeBracketIdx !== -1) {
          // Extract content within square brackets
          const bracketContent = remaining.substring(1, closeBracketIdx);

          if (process.env.VERBOSE) {
            console.log(`[tokenizer] Tokenizing bracket content: "${bracketContent}"`);
          }

          // Tokenize the bracket content recursively
          const nestedResult = this.tokenize(bracketContent);

          if (process.env.VERBOSE) {
            console.log(
              `[tokenizer] Nested tokens:`,
              nestedResult.tokens.map((t) => `${t.type}:${t.value}`),
            );
          }

          // Create a compound substituent token with nested structure
          tokens.push({
            type: "SUBSTITUENT",
            value: bracketContent,
            position: pos,
            length: closeBracketIdx + 1,
            nestedTokens: nestedResult.tokens,
            isInParentheses: true, // Treat brackets like parentheses for nesting
            metadata: {
              isBracketedGroup: true,
            },
          });

          pos += closeBracketIdx + 1;
          continue;
        }
      }

      // Skip closing bracket (shouldn't normally reach here)
      if (remaining[0] === "]") {
        pos++;
        continue;
      }

      // Use longest-match strategy to handle ambiguous cases like "oxo" vs "oxolan"
      // Priority order (checked in sequence, but longest match wins for ambiguous cases):
      // 1. Stereo markers (E/Z/R/S/@) - highest priority, no ambiguity
      // 2. Prefixes (N-, O-) - must have hyphen, no ambiguity
      // 3. Locants (position numbers) - no ambiguity
      // 4. Multipliers, Substituents, Parents, Suffixes - use longest match

      const stereo = this.tryStereo(remaining, pos);
      if (stereo) {
        tokens.push(stereo);
        pos += stereo.length;
        continue;
      }

      const prefix = this.tryPrefix(remaining, pos);
      if (prefix) {
        tokens.push(prefix);
        pos += prefix.length;
        continue;
      }

      const locant = this.tryLocant(remaining, pos);
      if (locant) {
        tokens.push(locant);
        pos += locant.length;
        continue;
      }

      // Check for alkyl term followed by major functional group (e.g., "butyl thiocyanate")
      // Handle this before processing as substituent
      const alkylTerms: Record<string, string> = {
        methyl: "C",
        ethyl: "CC",
        propyl: "CCC",
        butyl: "CCCC",
        pentyl: "CCCCC",
        hexyl: "CCCCCC",
        heptyl: "CCCCCCC",
        octyl: "CCCCCCCC",
        nonyl: "CCCCCCCCC",
        decyl: "CCCCCCCCCC",
      };

      let alkylTermMatched = false;
      for (const [alkylName, smiles] of Object.entries(alkylTerms)) {
        if (remaining.startsWith(alkylName)) {
          const afterAlkyl = remaining.substring(alkylName.length);
          const isMajorFunctionalGroup =
            /^[\s-]*(thiocyanate|formate|acetate|benzoate|oate|anoate|oic|nitrile|amine|amide)/i.test(
              afterAlkyl,
            );
          if (isMajorFunctionalGroup) {
            // Tokenize as PARENT, not SUBSTITUENT
            tokens.push({
              type: "PARENT",
              value: alkylName,
              position: pos,
              length: alkylName.length,
              metadata: {
                smiles,
                atomCount: smiles.length,
                isRing: false,
              },
            });
            pos += alkylName.length;
            alkylTermMatched = true;
            break;
          }
        }
      }

      if (alkylTermMatched) {
        continue;
      }

      // For potentially ambiguous matches, collect all candidates and pick longest
      const candidates: IUPACToken[] = [];

      const multiplier = this.tryMultiplier(remaining, pos);
      if (multiplier) candidates.push(multiplier);

      const substituent = this.trySubstituent(remaining, pos);
      if (substituent) candidates.push(substituent);

      const alkoxy = this.tryAlkoxySubstituent(remaining, pos);
      if (alkoxy) candidates.push(alkoxy);

      const parent = this.tryParent(remaining, pos);
      if (parent) candidates.push(parent);

      const suffix = this.trySuffix(remaining, pos);
      if (suffix) candidates.push(suffix);

      // Choose longest match
      if (candidates.length > 0) {
        let selectedToken = candidates.reduce((prev, curr) =>
          curr.length > prev.length ? curr : prev,
        );

        // Special handling: combine parent + suffix for alkoxy substituents
        if (
          selectedToken.type === "PARENT" &&
          candidates.some((c) => c.type === "SUFFIX" && c.value === "oxy")
        ) {
          const suffixToken = candidates.find((c) => c.type === "SUFFIX" && c.value === "oxy");
          if (
            suffixToken &&
            selectedToken.position + selectedToken.length === suffixToken.position
          ) {
            // Combine into alkoxy substituent
            const alkoxyValue = selectedToken.value + "oxy";
            const parentSmiles =
              (selectedToken.metadata as { smiles?: string })?.smiles ||
              selectedToken.value.toUpperCase();
            selectedToken = {
              type: "SUBSTITUENT",
              value: alkoxyValue,
              position: selectedToken.position,
              length: selectedToken.length + suffixToken.length,
              metadata: {
                smiles: `O${parentSmiles.substring(1)}`,
                fullAliases: [alkoxyValue],
              },
            };
          }
        }

        // Special handling: check if previous token was substituent and current is sulfur-related suffix
        // This handles cases like "methylsulfinyl" → should be compound substituent, not separate tokens
        let tokenLengthToAdvance = selectedToken.length;
        if (
          tokens.length > 0 &&
          selectedToken.type === "SUFFIX" &&
          (selectedToken.value === "sulfinyl" ||
            selectedToken.value === "sulfonyl" ||
            selectedToken.value === "sulfanyl" ||
            selectedToken.value === "thio")
        ) {
          const prevToken = tokens[tokens.length - 1];
          if (
            prevToken &&
            prevToken.type === "SUBSTITUENT" &&
            prevToken.position + prevToken.length === selectedToken.position
          ) {
            // Combine into compound sulfur substituent
            tokens.pop(); // Remove the substituent token
            const compoundValue = prevToken.value + selectedToken.value;
            const originalSuffixLength = selectedToken.length; // Remember original length before combining
            selectedToken = {
              type: "SUBSTITUENT",
              value: compoundValue,
              position: prevToken.position,
              length: prevToken.length + selectedToken.length,
              metadata: {
                isCompoundSubstituent: true,
                alkylPart: prevToken.value,
                sulfurPart: selectedToken.value,
              },
            };
            // Only advance by the suffix length since we already advanced past the alkyl part
            tokenLengthToAdvance = originalSuffixLength;
          }
        }

        tokens.push(selectedToken);
        pos += tokenLengthToAdvance;
      } else {
        // Skip whitespace, hyphens, and special characters (parentheses, brackets, commas)
        const nextChar = remaining[0];
        if (nextChar && /[\s\-()[],]/.test(nextChar)) {
          pos++;
          continue;
        }
        // Only report errors for non-whitespace characters that couldn't be tokenized
        errors.push(`Cannot tokenize at position ${pos}: ${nextChar || "EOF"}`);
        pos++;
      }
    }

    return { tokens, errors };
  }

  /**
   * Try to match a prefix (N-, O-, S-, etc.)
   * Also handles compound prefixes like "N,N-", "N,O-"
   */
  private tryPrefix(str: string, pos: number): IUPACToken | null {
    // Check for compound atom locant prefixes (e.g., "N,N-", "N,O-", "O,O-", "N,N'-", "N,N,N'-", "N,N,3-")
    // Supports apostrophes for primed notation and numeric locants after atom locants
    // Pattern: [atom](?:,[atom])* optionally followed by (?:,[digit]+)* then -
    const compoundMatch = /^([nNosOS])(?:')?(?:,([nNosOS])(?:')?)*(?:,\d+)*-/.exec(str);
    if (compoundMatch) {
      const prefixValue = compoundMatch[0].slice(0, -1); // Remove trailing hyphen
      const nextChar = str[compoundMatch[0].length];
      // Must be followed by alphabetic characters or opening paren (for substituents like "(3-chloro...)")
      if (nextChar && /[a-z([]/.test(nextChar)) {
        return {
          type: "PREFIX",
          value: prefixValue.toLowerCase(),
          position: pos,
          length: compoundMatch[0].length,
          metadata: {
            isCompound: true,
          },
        };
      }
    }

    // Check for cyclo/bicyclo/tricyclo/spiro prefixes with optional heteroatom prefix
    // Heteroatom replacements: oxa (O), aza (N), thia (S), phospha (P), etc.
    // Also handle bridge notation: [n.m.p] for bicyclic or [n.m.p.q.r.s] for tricyclic
    // Spiro systems use bracket notation like spiro[4.4]
    // Can include numeric multipliers: di-oxa, tri-oxa, etc.
    const heteroAtomPrefixes = [
      "oxa",
      "aza",
      "thia",
      "phospha",
      "arsa",
      "stiba",
      "bismuta",
      "selena",
      "tellura",
    ];
    const cycloPatterns = [
      "octacyclo",
      "heptacyclo",
      "hexacyclo",
      "pentacyclo",
      "tetracyclo",
      "tricyclo",
      "bicyclo",
      "spiro",
      "cyclo",
    ];

    // First try patterns with numeric multipliers (di-oxa-tricyclo, tri-oxa-pentacyclo, etc.)
    const numericMultipliers: Record<string, string> = {
      di: "di",
      tri: "tri",
      tetra: "tetra",
      penta: "penta",
      hexa: "hexa",
      hepta: "hepta",
      octa: "octa",
      nona: "nona",
    };

    for (const [_multName, mult] of Object.entries(numericMultipliers)) {
      for (const heteroPrefix of heteroAtomPrefixes) {
        for (const pattern of cycloPatterns) {
          const compound = mult + heteroPrefix + pattern;
          if (str.startsWith(compound)) {
            let matchLength = compound.length;
            // Check for bridge notation [n.m.p] or [n.m.p.q.r.s]
            if (str[matchLength] === "[") {
              const closeIdx = str.indexOf("]", matchLength);
              if (closeIdx > matchLength) {
                matchLength = closeIdx + 1;
              }
            }
            const nextChar = str[matchLength];
            if (!nextChar || /[a-z\s[]/.test(nextChar)) {
              return {
                type: "PREFIX",
                value: str.substring(0, matchLength).toLowerCase(),
                position: pos,
                length: matchLength,
                metadata: {
                  isCyclic: true,
                  heteroAtom: true,
                  hasMultiplier: true,
                  hasBridgeNotation: str[compound.length] === "[",
                },
              };
            }
          }
        }
      }
    }

    for (const heteroPrefix of heteroAtomPrefixes) {
      for (const pattern of cycloPatterns) {
        const compound = heteroPrefix + pattern;
        if (str.startsWith(compound)) {
          let matchLength = compound.length;
          // Check for bridge notation [n.m.p] or [n.m.p.q.r.s]
          if (str[matchLength] === "[") {
            const closeIdx = str.indexOf("]", matchLength);
            if (closeIdx > matchLength) {
              matchLength = closeIdx + 1;
            }
          }
          const nextChar = str[matchLength];
          if (!nextChar || /[a-z\s]/.test(nextChar)) {
            return {
              type: "PREFIX",
              value: str.substring(0, matchLength).toLowerCase(),
              position: pos,
              length: matchLength,
              metadata: {
                isCyclic: true,
                heteroAtom: true,
                hasBridgeNotation: str[compound.length] === "[",
              },
            };
          }
        }
      }
    }

    for (const pattern of cycloPatterns) {
      if (str.startsWith(pattern)) {
        let matchLength = pattern.length;
        // Check for bridge notation [n.m.p] or [n.m.p.q.r.s]
        if (str[matchLength] === "[") {
          const closeIdx = str.indexOf("]", matchLength);
          if (closeIdx > matchLength) {
            matchLength = closeIdx + 1;
          }
        }
        const nextChar = str[matchLength];
        // Must be followed by alphabetic character or whitespace (end of prefix)
        if (!nextChar || /[a-z\s]/.test(nextChar)) {
          return {
            type: "PREFIX",
            value: str.substring(0, matchLength).toLowerCase(),
            position: pos,
            length: matchLength,
            metadata: {
              isCyclic: true,
              hasBridgeNotation: str[pattern.length] === "[",
            },
          };
        }
      }
    }

    // Common prefixes for substitution on heteroatoms
    const prefixes = ["n-", "o-", "s-", "c-", "x-"];

    for (const prefix of prefixes) {
      if (str.startsWith(prefix)) {
        // Must be followed by alphabetic characters (start of substituent name)
        const nextChar = str[prefix.length];
        if (nextChar && /[a-z]/.test(nextChar)) {
          return {
            type: "PREFIX",
            value: prefix.substring(0, prefix.length - 1), // Remove hyphen
            position: pos,
            length: prefix.length,
          };
        }
      }
    }

    return null;
  }

  /**
   * Try to match a locant (position number like "1", "2,3", "1,2,4")
   * Also handles hydrogen notation like "1H-", "2H-"
   */
  private tryLocant(str: string, pos: number): IUPACToken | null {
    // Check for hydrogen count notation (e.g., "1H-", "2H-")
    const hydrogenMatch = /^(\d+)[hH]-/.exec(str);
    if (hydrogenMatch && hydrogenMatch[1]) {
      return {
        type: "LOCANT",
        value: hydrogenMatch[0].slice(0, -1), // Remove trailing hyphen
        position: pos,
        length: hydrogenMatch[0].length,
        metadata: {
          hydrogenCount: parseInt(hydrogenMatch[1]),
          isHydrogenNotation: true,
        },
      };
    }

    // Check for lambda notation (e.g., "2lambda6-", "1lambda4-")
    // Format: digit + "lambda" + digit + hyphen
    const lambdaMatch = /^(\d+)lambda(\d+)-/.exec(str);
    if (lambdaMatch) {
      return {
        type: "LOCANT",
        value: lambdaMatch[0].slice(0, -1), // Remove trailing hyphen
        position: pos,
        length: lambdaMatch[0].length,
        metadata: {
          positions: [parseInt(lambdaMatch[1]!)],
          lambdaValue: parseInt(lambdaMatch[2]!),
          isLambdaNotation: true,
        },
      };
    }

    const match = this.locantRegex.exec(str);
    if (!match) return null;

    // Must be followed by a hyphen or dash
    const nextChar = str[match[0].length];
    if (!nextChar || !nextChar.match(/[-]/)) {
      return null;
    }

    const positions = match[0].split(",").map((p) => {
      // Handle parenthesized locants like "14(22)" -> return 14
      // The part in parentheses usually indicates the other end of a double bond in bridged systems
      const parenIndex = p.indexOf("(");
      if (parenIndex !== -1) {
        const val = parseInt(p.substring(0, parenIndex));
        // Store the secondary locant if needed (for future use)
        // const secondary = parseInt(p.substring(parenIndex + 1, p.indexOf(")")));
        return val;
      }
      return Number(p);
    });
    return {
      type: "LOCANT",
      value: match[0],
      position: pos,
      length: match[0].length,
      metadata: {
        positions,
      },
    };
  }

  /**
   * Try to match stereochemistry marker (@, @@, E, Z, R, S)
   * Context-aware: Only matches in valid positions
   * - E/Z: Before lowercase letters (not preceded by 'th' from 'ethene')
   * - R/S: Before lowercase letters
   * - @/@@ : In bridged nomenclature contexts
   */
  private tryStereo(str: string, pos: number): IUPACToken | null {
    // Check for @ or @@ (von Baeyer bridged bicyclic stereochemistry)
    if (str.startsWith("@@")) {
      // Must be followed by a digit, hyphen, space, or letter
      const nextChar = str.charAt(2);
      if (!nextChar || /[\s\d\-a-z]/.test(nextChar)) {
        return {
          type: "STEREO",
          value: "@@",
          position: pos,
          length: 2,
          metadata: { type: "von-baeyer" },
        };
      }
    } else if (str.startsWith("@")) {
      const nextChar = str.charAt(1);
      if (!nextChar || /[\s\d\-a-z@]/.test(nextChar)) {
        return {
          type: "STEREO",
          value: "@",
          position: pos,
          length: 1,
          metadata: { type: "von-baeyer" },
        };
      }
    }

    // Check for E/Z stereochemistry with optional citation number
    // E.g., "(E)-", "(Z)-", "2Z-", "14E)-" patterns
    const ezMatch = /^(\d*)([ez])(?=[-)])/i.exec(str);
    if (ezMatch) {
      const citationNum = ezMatch[1] || null;
      const stereoChar = ezMatch[2]!.toLowerCase();
      return {
        type: "STEREO",
        value: stereoChar,
        position: pos,
        length: ezMatch[0].length,
        metadata: {
          type: "alkene",
          config: stereoChar === "e" ? "E" : "Z",
          citationNumber: citationNum ? parseInt(citationNum) : undefined,
        },
      };
    }

    // Check for R/S stereochemistry with optional citation number
    // E.g., "(R)-", "(S)-", "6R,8R-", "14S)-" patterns
    const rsMatch = /^(\d*)([rs])(?=[-),])/i.exec(str);
    if (rsMatch) {
      const citationNum = rsMatch[1] || null;
      const stereoChar = rsMatch[2]!.toLowerCase();
      return {
        type: "STEREO",
        value: stereoChar,
        position: pos,
        length: rsMatch[0].length,
        metadata: {
          type: "stereocenter",
          config: stereoChar === "r" ? "R" : "S",
          citationNumber: citationNum ? parseInt(citationNum) : undefined,
        },
      };
    }

    return null;
  }

  /**
   * Try to match a multiplier (di, tri, tetra, etc.)
   * Includes both basic (di, tri) and group multipliers (bis, tris)
   * Multipliers must be followed by substituents or functional groups, NOT by alkane suffixes
   */
  private tryMultiplier(str: string, pos: number): IUPACToken | null {
    // Check group multipliers first (bis, tris, etc.) - used for complex substituents
    if (this.rules.multipliers.group) {
      for (const [num, name] of Object.entries(this.rules.multipliers.group)) {
        if (str.startsWith(name)) {
          const nextPos = name.length;
          if (nextPos >= str.length) return null;

          const nextChar = str[nextPos];
          // Group multipliers typically followed by opening paren or letter
          if (nextChar && /[a-z(]/.test(nextChar)) {
            return {
              type: "MULTIPLIER",
              value: name,
              position: pos,
              length: name.length,
              metadata: { count: parseInt(num), isGroup: true },
            };
          }
        }
      }
    }

    // Check basic multipliers - collect all valid matches and return longest
    const validMultipliers: IUPACToken[] = [];

    for (const [num, name] of Object.entries(this.rules.multipliers.basic)) {
      if (str.startsWith(name)) {
        // Validate it's followed by a valid continuation
        const nextPos = name.length;
        if (nextPos >= str.length) continue;

        const nextChar = str[nextPos];
        if (!nextChar || !nextChar.match(/[a-z]/)) continue;

        // Don't match if followed by alkane/alkene suffixes (these indicate parent chain)
        // "ane", "ene", "yne" are definite alkane suffixes
        // "an" followed by suffix (ol, oic, al, etc.) also indicates parent chain
        const remainder = str.substring(nextPos);
        if (
          remainder.startsWith("ane") ||
          remainder.startsWith("ene") ||
          remainder.startsWith("yne") ||
          remainder.startsWith("ano") ||
          remainder.startsWith("anoic") ||
          remainder.startsWith("anoate")
        ) {
          // alkane/alkene/alkyne suffixes or carboxylic acid patterns
          continue;
        }

        // Don't match if this stem appears in alkanes (it's likely a parent chain stem)
        // Check if the name exists as an alkane stem
        const isAlkaneStem = Object.values(this.rules.alkanes).includes(name);
        if (isAlkaneStem) {
          // Only allow as multiplier if followed by word boundaries that indicate
          // it's actually functioning as a multiplier (e.g., "octylamine", "heptylbenzene")
          // NOT followed by locants or typical suffix patterns
          if (/^-|^\(|\d|^[aeiou]/.test(nextChar)) {
            // Followed by hyphen, paren, digit, or vowel - likely parent chain context
            continue;
          }
        }

        validMultipliers.push({
          type: "MULTIPLIER",
          value: name,
          position: pos,
          length: name.length,
          metadata: { count: parseInt(num) },
        });
      }
    }

    // Return longest valid multiplier
    if (validMultipliers.length > 0) {
      return validMultipliers.reduce((prev, curr) => (curr.length > prev.length ? curr : prev));
    }

    return null;
  }

  /**
   * Try to match a suffix (ol, one, al, amine, acid, etc.)
   */
  private trySuffix(str: string, pos: number): IUPACToken | null {
    // Try longest matches first
    const suffixEntries = Object.entries(this.rules.suffixes).sort(
      (a, b) => b[0].length - a[0].length,
    );

    for (const [suffix, suffixData] of suffixEntries) {
      if (str.startsWith(suffix)) {
        // Verify it's at a suffix boundary (end of string or after letter)
        const nextPos = suffix.length;
        const nextChar = str[nextPos];
        if (nextChar && nextChar.match(/[0-9]/)) {
          // Could be continuation with locant
          continue;
        }

        return {
          type: "SUFFIX",
          value: suffix,
          position: pos,
          length: suffix.length,
          metadata: {
            suffixType: suffixData.type,
          },
        };
      }
    }

    return null;
  }

  /**
   * Try to match alkoxy substituents (methoxy, ethoxy, propoxy, etc.)
   */
  private tryAlkoxySubstituent(str: string, pos: number): IUPACToken | null {
    // Check for alkyl + oxy pattern
    const alkylMappings = [
      { name: "prop", smiles: "CCC" },
      { name: "but", smiles: "CCCC" },
      { name: "pent", smiles: "CCCCC" },
      { name: "hex", smiles: "CCCCCC" },
      { name: "hept", smiles: "CCCCCCC" },
      { name: "oct", smiles: "CCCCCCCC" },
      { name: "non", smiles: "CCCCCCCCC" },
      { name: "dec", smiles: "CCCCCCCCCC" },
    ];

    for (const { name, smiles } of alkylMappings) {
      if (str.startsWith(name + "oxy")) {
        return {
          type: "SUBSTITUENT",
          value: name + "oxy",
          position: pos,
          length: (name + "oxy").length,
          metadata: {
            smiles: `O${smiles.substring(1)}`, // Remove first C, add O
            fullAliases: [name + "oxy"],
          },
        };
      }
    }
    return null;
  }

  /**
   * Try to match complex substituent patterns (e.g., "4-nitro-3-(trifluoromethyl)anilino")
   */
  private tryComplexSubstituent(str: string, pos: number): IUPACToken | null {
    // Pattern: X-anilino where X is a substituted phenyl group
    const anilinoMatch = str.match(/^([0-9]+-[^-]+-[^-]+-)?anilino/);
    if (anilinoMatch) {
      const prefix = anilinoMatch[1] || ""; // e.g., "4-nitro-3-(trifluoromethyl)"
      return {
        type: "SUBSTITUENT",
        value: str.substring(0, anilinoMatch[0].length),
        position: pos,
        length: anilinoMatch[0].length,
        metadata: {
          isComplexSubstituent: true,
          substituentType: "anilino",
          phenylSubstituents: prefix,
        },
      };
    }

    // Pattern: X-ylidene where X is a substituted alkyl group
    const ylideneMatch = str.match(/^([0-9]+-[^-]+-)?ylidene/);
    if (ylideneMatch) {
      const prefix = ylideneMatch[1] || "";
      return {
        type: "SUBSTITUENT",
        value: str.substring(0, ylideneMatch[0].length),
        position: pos,
        length: ylideneMatch[0].length,
        metadata: {
          isComplexSubstituent: true,
          substituentType: "ylidene",
          alkylSubstituents: prefix,
        },
      };
    }

    // Pattern: dimethoxy, trimethoxy, etc. on phenyl
    const methoxyPhenylMatch = str.match(/^([0-9]+-)?(di|tri|tetra)methoxy[^-]*(-.*)?phenyl/);
    if (methoxyPhenylMatch) {
      const locant = methoxyPhenylMatch[1] || "";
      const methoxyCount = methoxyPhenylMatch[2];
      const remaining = methoxyPhenylMatch[3] || "";
      return {
        type: "SUBSTITUENT",
        value: str.substring(0, methoxyPhenylMatch[0].length),
        position: pos,
        length: methoxyPhenylMatch[0].length,
        metadata: {
          isComplexSubstituent: true,
          substituentType: "methoxyphenyl",
          locant,
          methoxyCount,
          additionalSubstituents: remaining,
        },
      };
    }

    return null;
  }

  /**
   * Try to match a substituent (methyl, ethyl, chloro, bromo, etc.)
   */
  private trySubstituent(str: string, pos: number): IUPACToken | null {
    // Handle complex substituent patterns before standard matching
    const complexSubst = this.tryComplexSubstituent(str, pos);
    if (complexSubst) {
      return complexSubst;
    }

    // Try longest SMILES values first (usually longer names)
    const substEntries = Object.entries(this.rules.substituents).sort((a, b) => {
      const aLen = Math.max(...a[1].aliases.map((x) => x.length));
      const bLen = Math.max(...b[1].aliases.map((x) => x.length));
      return bLen - aLen;
    });

    for (const [smiles, data] of substEntries) {
      for (const alias of data.aliases) {
        if (str.startsWith(alias)) {
          return {
            type: "SUBSTITUENT",
            value: alias,
            position: pos,
            length: alias.length,
            metadata: {
              smiles,
              fullAliases: data.aliases,
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * Try to match a parent chain (alkane or ring system)
   * Uses longest-match strategy to handle overlapping aliases
   */
  private tryParent(str: string, pos: number): IUPACToken | null {
    let bestMatch: IUPACToken | null = null;

    // Check for bicyclo notation first (e.g., "bicyclo[3.3.1]nonan" or "9-oxabicyclo[3.3.1]nonan")
    // Pattern: optional locant prefix (e.g., "9-"), optional HETEROATOM prefix (oxa, aza, thia, etc.),
    // then bicyclo[n.m.p]
    // CRITICAL: heteroType should ONLY match known heteroatom prefixes, NOT arbitrary substituents like "hydroxy"
    const heteroAtomPrefixes = [
      "oxa",
      "aza",
      "thia",
      "phospha",
      "arsa",
      "stiba",
      "bismuta",
      "selena",
      "tellura",
    ];

    // Try to match bicyclo with known heteroatom prefixes
    for (const heteroType of heteroAtomPrefixes) {
      const heteroMatch = str.match(
        new RegExp(`^(\\d+-)?${heteroType}bicycl(?:ic|o)\\[(\\d+)\\.(\\d+)\\.(\\d+)\\]`, "i"),
      );
      if (heteroMatch) {
        const heteroPrefix = heteroMatch[1] ? heteroMatch[1].slice(0, -1) : "";
        const bridgeN = heteroMatch[2]!;
        const bridgeM = heteroMatch[3]!;
        const bridgeP = heteroMatch[4]!;
        const totalAtoms = parseInt(bridgeN) + parseInt(bridgeM) + parseInt(bridgeP) + 2;

        return {
          type: "PARENT",
          value: heteroMatch[0],
          position: pos,
          length: heteroMatch[0].length,
          metadata: {
            isBicyclic: true,
            heteroPrefix,
            heteroType,
            bridgeN: parseInt(bridgeN),
            bridgeM: parseInt(bridgeM),
            bridgeP: parseInt(bridgeP),
            totalAtoms,
          },
        };
      }
    }

    // Try to match bicyclo WITHOUT heteroatom prefix
    const bicycloMatch = str.match(/^(\d+-)?bicycl(?:ic|o)\[(\d+)\.(\d+)\.(\d+)\]/i);
    if (bicycloMatch) {
      const heteroPrefix = bicycloMatch[1] ? bicycloMatch[1].slice(0, -1) : "";
      const bridgeN = bicycloMatch[2]!;
      const bridgeM = bicycloMatch[3]!;
      const bridgeP = bicycloMatch[4]!;
      const totalAtoms = parseInt(bridgeN) + parseInt(bridgeM) + parseInt(bridgeP) + 2;

      return {
        type: "PARENT",
        value: bicycloMatch[0],
        position: pos,
        length: bicycloMatch[0].length,
        metadata: {
          isBicyclic: true,
          heteroPrefix,
          heteroType: "",
          bridgeN: parseInt(bridgeN),
          bridgeM: parseInt(bridgeM),
          bridgeP: parseInt(bridgeP),
          totalAtoms,
        },
      };
    }

    // Try to match tricyclo WITH heteroatom prefix (e.g., "3,12-dioxatricyclo[6.4.0.0^{2,7}]")
    for (const heteroAtom of heteroAtomPrefixes) {
      const tricycloWithHeteroMatch = str.match(
        new RegExp(
          `^(\\d+(?:,\\d+)*)-(${heteroAtom})tricycl(?:ic|o)\\[(\\d+)\\.(\\d+)\\.(\\d+)(?:\\.\\d+(?:\\^\\{?\\d+,\\d+\\}?)?)*\\]`,
          "i",
        ),
      );
      if (tricycloWithHeteroMatch) {
        const locants = tricycloWithHeteroMatch[1]!;
        const heteroType = tricycloWithHeteroMatch[2]!;
        const bridgeA = tricycloWithHeteroMatch[3]!;
        const bridgeB = tricycloWithHeteroMatch[4]!;
        const bridgeC = tricycloWithHeteroMatch[5]!;
        const totalAtoms = parseInt(bridgeA) + parseInt(bridgeB) + parseInt(bridgeC) + 3; // 3 bridgeheads for tricyclic

        return {
          type: "PARENT",
          value: tricycloWithHeteroMatch[0],
          position: pos,
          length: tricycloWithHeteroMatch[0].length,
          metadata: {
            isTricyclic: true,
            heteroPrefix: locants,
            heteroType,
            bridgeA: parseInt(bridgeA),
            bridgeB: parseInt(bridgeB),
            bridgeC: parseInt(bridgeC),
            totalAtoms,
          },
        };
      }
    }

    // Try to match tricyclo WITHOUT heteroatom prefix
    const tricycloMatch = str.match(
      /^(\d+-)?tricycl(?:ic|o)\[(\d+)\.(\d+)\.(\d+)(?:\.(\d+)(?:\^\{?(\d+),(\d+)\}?)?)?/i,
    );
    if (tricycloMatch) {
      const heteroPrefix = tricycloMatch[1] ? tricycloMatch[1].slice(0, -1) : "";
      const bridgeA = tricycloMatch[2]!;
      const bridgeB = tricycloMatch[3]!;
      const bridgeC = tricycloMatch[4]!;
      const bridgeD = tricycloMatch[5] ?? "0";
      const sharedPos1 = tricycloMatch[6] ? parseInt(tricycloMatch[6]) : undefined;
      const sharedPos2 = tricycloMatch[7] ? parseInt(tricycloMatch[7]) : undefined;
      const totalAtoms = parseInt(bridgeA) + parseInt(bridgeB) + parseInt(bridgeC) + 3; // 3 bridgeheads for tricyclic

      return {
        type: "PARENT",
        value: tricycloMatch[0],
        position: pos,
        length: tricycloMatch[0].length,
        metadata: {
          isTricyclic: true,
          heteroPrefix,
          heteroType: "",
          bridgeA: parseInt(bridgeA),
          bridgeB: parseInt(bridgeB),
          bridgeC: parseInt(bridgeC),
          bridgeD: parseInt(bridgeD),
          sharedPos1,
          sharedPos2,
          totalAtoms,
        },
      };
    }

    // Try to match spiro compounds (e.g., "spiro[4.5]decane")
    // Pattern: optional heteroatom prefix, "spiro[a.b]"
    for (const heteroType of heteroAtomPrefixes) {
      const spiroWithHeteroMatch = str.match(
        new RegExp(`^(\\d+-)?${heteroType}spiro\\[(\\d+)\\.(\\d+)\\]`, "i"),
      );
      if (spiroWithHeteroMatch) {
        const heteroPrefix = spiroWithHeteroMatch[1] ? spiroWithHeteroMatch[1].slice(0, -1) : "";
        const ringA = parseInt(spiroWithHeteroMatch[2]!);
        const ringB = parseInt(spiroWithHeteroMatch[3]!);
        const totalAtoms = ringA + ringB + 1; // +1 for the spiro atom

        return {
          type: "PARENT",
          value: spiroWithHeteroMatch[0],
          position: pos,
          length: spiroWithHeteroMatch[0].length,
          metadata: {
            isSpiro: true,
            heteroPrefix,
            heteroType,
            ringA,
            ringB,
            totalAtoms,
          },
        };
      }
    }

    // Try to match spiro WITHOUT heteroatom prefix
    const spiroMatch = str.match(/^spiro\[(\d+)\.(\d+)\]/i);
    if (spiroMatch) {
      const ringA = parseInt(spiroMatch[1]!);
      const ringB = parseInt(spiroMatch[2]!);
      const totalAtoms = ringA + ringB + 1; // +1 for the spiro atom

      return {
        type: "PARENT",
        value: spiroMatch[0],
        position: pos,
        length: spiroMatch[0].length,
        metadata: {
          isSpiro: true,
          heteroPrefix: "",
          heteroType: "",
          ringA,
          ringB,
          totalAtoms,
        },
      };
    }

    // Try ring systems first - collect ALL matches and choose longest
    for (const [smiles, data] of Object.entries(this.rules.ringSystems)) {
      for (const alias of data.aliases) {
        if (str.startsWith(alias)) {
          if (!bestMatch || alias.length > bestMatch.length) {
            bestMatch = {
              type: "PARENT",
              value: alias,
              position: pos,
              length: alias.length,
              metadata: {
                smiles,
                labels: data.labels,
                isRing: true,
              },
            };
          }
        }
      }
    }

    // If we found a ring system match, return it
    if (bestMatch) return bestMatch;

    // Try to match complete alkane names using multiplier stems + suffix
    // This handles cases like "nonadecane" (19 carbons) that should NOT be split into "non" + "dec"
    // Priority: Try longest multiplier names first (nonadec, octadec, etc.) before short stems
    if (this.rules.multipliers && this.rules.multipliers.basic) {
      const multiplierEntries = Object.entries(this.rules.multipliers.basic).sort((a, b) => {
        // Sort by multiplier name length (longest first)
        const aName = String(a[1]);
        const bName = String(b[1]);
        const aLen = aName.includes("|")
          ? Math.max(...aName.split("|").map((x: string) => x.length))
          : aName.length;
        const bLen = bName.includes("|")
          ? Math.max(...bName.split("|").map((x: string) => x.length))
          : bName.length;
        return bLen - aLen;
      });

      for (const [atomCount, nameOrNames] of multiplierEntries) {
        const nameStr = String(nameOrNames);
        const names = nameStr.includes("|") ? nameStr.split("|") : [nameStr];

        for (const multiplierName of names) {
          // Check if string starts with this multiplier followed by alkane suffix
          // E.g., "nonadec" + "ane" = "nonadecane" (19 carbons)
          if (str.startsWith(multiplierName)) {
            const remainder = str.substring(multiplierName.length);

            // Must be followed by alkane suffix
            // Use more specific patterns:
            // - "ane" for complete alkanes (e.g., "nonadecane")
            // - "ana" + word boundary (for carboxylic acids like "hexanoic")
            // But NOT "ene" or "yne" when multiplier is small (di, tri, tetra)
            // These are unsaturation suffixes (diene, triene), not parent chains
            const suffixMatch = remainder.match(/^(ane|ana(?=[^a-z]|$)|ano(?=[^a-z]|$))/);

            // Special case: "ene" and "yne" should only be matched for long chains (C11+)
            // For short chains, "diene", "triene", "diyne", etc. are SUFFIXES, not parents
            const carbonCount = parseInt(atomCount);
            if (!suffixMatch && carbonCount >= 11) {
              // Allow "ene" and "yne" only for undecene (C11), dodecene (C12), etc.
              const altSuffixMatch = remainder.match(/^(ene|yne)/);
              if (altSuffixMatch) {
                const fullName = multiplierName + altSuffixMatch[0];
                const smiles = "C".repeat(carbonCount);

                if (bestMatch === null || fullName.length > bestMatch.length) {
                  bestMatch = {
                    type: "PARENT",
                    value: fullName,
                    position: pos,
                    length: fullName.length,
                    metadata: {
                      smiles,
                      atomCount: carbonCount,
                      isRing: false,
                      fromMultiplier: true,
                    },
                  };
                }
              }
            } else if (suffixMatch) {
              const fullName = multiplierName + suffixMatch[0];
              const smiles = "C".repeat(carbonCount);

              if (bestMatch === null || fullName.length > bestMatch.length) {
                bestMatch = {
                  type: "PARENT",
                  value: fullName,
                  position: pos,
                  length: fullName.length,
                  metadata: {
                    smiles,
                    atomCount: carbonCount,
                    isRing: false,
                    fromMultiplier: true,
                  },
                };
              }
            }
          }
        }
      }
    }

    // If we found a multiplier-based match, return it (it's longer and more specific than stem components)
    if (bestMatch) return bestMatch;

    // Try to match bare multiplier stems followed by hyphen (for cycloalkane substituents)
    // E.g., "hexacos-1-yl" where "hexacos" is the 26-carbon stem
    // This is needed after "cyclo" prefix where we get "hexacos-1-yl" not "hexacosane"
    if (this.rules.multipliers && this.rules.multipliers.basic) {
      const multiplierEntries = Object.entries(this.rules.multipliers.basic).sort((a, b) => {
        // Sort by multiplier name length (longest first)
        const aName = String(a[1]);
        const bName = String(b[1]);
        const aLen = aName.includes("|")
          ? Math.max(...aName.split("|").map((x: string) => x.length))
          : aName.length;
        const bLen = bName.includes("|")
          ? Math.max(...bName.split("|").map((x: string) => x.length))
          : bName.length;
        return bLen - aLen;
      });

      for (const [atomCount, nameOrNames] of multiplierEntries) {
        const nameStr = String(nameOrNames);
        const names = nameStr.includes("|") ? nameStr.split("|") : [nameStr];

        for (const multiplierName of names) {
          if (str.startsWith(multiplierName)) {
            const remainder = str.substring(multiplierName.length);
            // Check if followed by hyphen (for substituent forms like "hexacos-1-yl")
            if (remainder.startsWith("-")) {
              const carbonCount = parseInt(atomCount);
              const smiles = "C".repeat(carbonCount);

              if (bestMatch === null || multiplierName.length > bestMatch.length) {
                bestMatch = {
                  type: "PARENT",
                  value: multiplierName,
                  position: pos,
                  length: multiplierName.length,
                  metadata: {
                    smiles,
                    atomCount: carbonCount,
                    isRing: false,
                    fromMultiplier: true,
                    isBareMultiplier: true, // Flag to indicate this is just the stem
                  },
                };
              }
            }
          }
        }
      }
    }

    // If we found a bare multiplier match, return it
    if (bestMatch) return bestMatch;

    // Try alkanes from rules.alkanes dictionary
    for (const [smiles, name] of Object.entries(this.rules.alkanes)) {
      if (str.startsWith(name)) {
        const remainder = str.substring(name.length);

        // Special case: reject alkane stems followed by "amethyl" / "aethyl" / etc.
        // These should be parsed as multiplier + substituent (e.g., "penta" + "methyl")
        // Pattern: alkane stem + "a" + substituent name
        if (
          remainder.startsWith("amethyl") ||
          remainder.startsWith("aethyl") ||
          remainder.startsWith("apropyl") ||
          remainder.startsWith("abutyl") ||
          remainder.startsWith("aphenyl")
        ) {
          continue;
        }

        if (bestMatch === null || name.length > bestMatch.length) {
          // Check for continuation with "a" (e.g., "hexan" → "hexana")
          // This allows matching "hexanamide" → "hexan" + "amide"
          // BUT: only if the alkane name already ends in "n" (like "hexan", "pentan")
          // This prevents matching "meth" + "a" from "methane" or "methanoic"
          if (remainder.startsWith("a") && name.endsWith("n")) {
            // Check what follows the "a"
            const afterA = remainder.substring(1);

            // Only match "a" if it's followed by a functional group suffix
            // "mide" (amide), "l" (aldehyde), "mine" (amine)
            // NOT "noic", "noate", "te" - these should be parsed as separate suffix tokens
            const isFunctionalGroupSuffix = /^(mide|l\b|mine)/.test(afterA);

            if (isFunctionalGroupSuffix) {
              bestMatch = {
                type: "PARENT",
                value: name + "a",
                position: pos,
                length: name.length + 1,
                metadata: {
                  smiles,
                  atomCount: smiles.length,
                  isRing: false,
                },
              };
              continue;
            }
          }

          bestMatch = {
            type: "PARENT",
            value: name,
            position: pos,
            length: name.length,
            metadata: {
              smiles,
              atomCount: smiles.length,
              isRing: false,
            },
          };
        }
      }
    }

    if (bestMatch) return bestMatch;

    // Try alkane stem components (for longer chains)
    for (const [num, names] of Object.entries(this.rules.alkaneStemComponents.hundreds)) {
      const nameList = names.split("|");
      for (const nm of nameList) {
        if (str.startsWith(nm)) {
          // Validate that stem component is followed by valid continuation
          const nextPos = nm.length;
          const remainder = str.substring(nextPos);

          // Must be followed by: alkane suffix (ane/ene/yne/an), another stem, or end/hyphen
          if (remainder.length === 0 || remainder[0] === "-") {
            // OK: end of string or hyphen
          } else if (/^(ane|ene|yne|an[eo])/.test(remainder)) {
            // OK: alkane suffix
          } else {
            // Check if followed by another stem component (tens or units)
            let isValidStem = false;
            for (const stemNames of [
              ...Object.values(this.rules.alkaneStemComponents.tens),
              ...Object.values(this.rules.alkaneStemComponents.units),
            ]) {
              const stemList = stemNames.split("|");
              for (const s of stemList) {
                if (remainder.startsWith(s)) {
                  isValidStem = true;
                  break;
                }
              }
              if (isValidStem) break;
            }
            if (!isValidStem) {
              // Not a valid alkane stem continuation - skip this match
              continue;
            }
          }

          return {
            type: "PARENT",
            value: nm,
            position: pos,
            length: nm.length,
            metadata: {
              numPart: "hundreds",
              number: parseInt(num),
            },
          };
        }
      }
    }

    for (const [num, names] of Object.entries(this.rules.alkaneStemComponents.tens)) {
      const nameList = names.split("|");
      for (const nm of nameList) {
        if (str.startsWith(nm)) {
          // Validate that stem component is followed by valid continuation
          const nextPos = nm.length;
          const remainder = str.substring(nextPos);

          // Must be followed by: alkane suffix (ane/ene/yne/an), another stem, or end/hyphen
          if (remainder.length === 0 || remainder[0] === "-") {
            // OK: end of string or hyphen
          } else if (/^(ane|ene|yne|an[eo])/.test(remainder)) {
            // Check if string STARTS with a units component (e.g., "do" in "dodecane")
            // If so, skip this tens match - let units be matched first, then tens on next iteration
            let startsWithUnits = false;
            for (const stemNames of Object.values(this.rules.alkaneStemComponents.units)) {
              const stemList = stemNames.split("|");
              for (const s of stemList) {
                if (str.startsWith(s) && str[s.length] === nm[0]) {
                  // Verify the tens component follows immediately after units
                  startsWithUnits = true;
                  break;
                }
              }
              if (startsWithUnits) break;
            }
            if (startsWithUnits) {
              // Skip this match - let units be matched first
              continue;
            }
            // OK: alkane suffix
          } else {
            // Check if followed by another stem component
            let isValidStem = false;
            for (const stemNames of Object.values(this.rules.alkaneStemComponents.units)) {
              const stemList = stemNames.split("|");
              for (const s of stemList) {
                if (remainder.startsWith(s)) {
                  isValidStem = true;
                  break;
                }
              }
              if (isValidStem) break;
            }
            if (!isValidStem) {
              // Not a valid alkane stem continuation - skip this match
              continue;
            }
          }

          return {
            type: "PARENT",
            value: nm,
            position: pos,
            length: nm.length,
            metadata: {
              numPart: "tens",
              number: parseInt(num),
            },
          };
        }
      }
    }

    for (const [num, names] of Object.entries(this.rules.alkaneStemComponents.units)) {
      const nameList = names.split("|");
      for (const nm of nameList) {
        if (str.startsWith(nm)) {
          // Validate that stem component is followed by valid continuation
          const nextPos = nm.length;
          const remainder = str.substring(nextPos);

          // Must be followed by: alkane suffix (ane/ene/yne/an), end/hyphen, or another stem
          if (remainder.length === 0 || remainder[0] === "-") {
            // OK: end of string or hyphen
          } else if (/^(ane|ene|yne|an[eo])/.test(remainder)) {
            // OK: alkane suffix
          } else {
            // Check if followed by another stem component (tens or hundreds)
            let isValidStem = false;
            for (const stemNames of [
              ...Object.values(this.rules.alkaneStemComponents.tens),
              ...Object.values(this.rules.alkaneStemComponents.hundreds),
            ]) {
              const stemList = stemNames.split("|");
              for (const s of stemList) {
                if (remainder.startsWith(s)) {
                  isValidStem = true;
                  break;
                }
              }
              if (isValidStem) break;
            }
            if (!isValidStem) {
              // Not a valid stem continuation - skip this match
              continue;
            }
          }

          return {
            type: "PARENT",
            value: nm,
            position: pos,
            length: nm.length,
            metadata: {
              numPart: "units",
              number: parseInt(num),
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * Find the matching closing parenthesis for an opening paren at given position
   * Returns -1 if no matching paren found
   */
  private findMatchingParen(str: string, openPos: number): number {
    if (str[openPos] !== "(") return -1;

    let depth = 1;
    let pos = openPos + 1;

    while (pos < str.length && depth > 0) {
      if (str[pos] === "(") {
        depth++;
      } else if (str[pos] === ")") {
        depth--;
        if (depth === 0) {
          return pos;
        }
      }
      pos++;
    }

    return -1; // No matching paren found
  }
}
