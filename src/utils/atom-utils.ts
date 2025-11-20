import type { Atom } from "types";
import { ATOMIC_NUMBERS } from "src/constants";

/**
 * Check if a symbol represents an organic subset atom per SMILES specification
 * Organic subset: B, C, N, O, P, S, F, Cl, Br, I
 */
export function isOrganicAtom(symbol: string): boolean {
  return /^(B|C|N|O|P|S|F|Cl|Br|I)$/i.test(symbol);
}

/**
 * Create a new atom with the given properties
 */
export function createAtom(
  symbol: string,
  id: number,
  aromatic = false,
  isBracket = false,
  atomClass = 0,
): Atom | null {
  const normalizedSymbol =
    symbol.length === 2
      ? (symbol[0]?.toUpperCase() ?? "") + (symbol[1]?.toLowerCase() ?? "")
      : symbol.toUpperCase();
  const atomicNumber = ATOMIC_NUMBERS[normalizedSymbol];
  if (atomicNumber === undefined) {
    return null;
  }
  return {
    id,
    symbol: normalizedSymbol,
    atomicNumber,
    charge: 0,
    hydrogens: 0,
    isotope: null,
    aromatic,
    chiral: null,
    isBracket,
    atomClass,
  };
}
