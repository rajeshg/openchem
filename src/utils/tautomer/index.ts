import type { Molecule } from "types";
import { enumerateTautomers, getCanonicalTautomer } from "./tautomer-enumerator";

export { enumerateTautomers, getCanonicalTautomer };
export type { TautomerOptions, TautomerResult } from "./tautomer-enumerator";

export function canonicalTautomer(input: Molecule) {
  const result = getCanonicalTautomer(input, { maxTautomers: 128 });
  return result.molecule;
}
