import type { Molecule } from "types";
import type { MolecularProperties } from "./types";
import { basic } from "./basic";
import { physicochemical } from "./physicochemical";
import { structural } from "./structural";
import { drugLikeness } from "./drug-likeness";

export function all(mol: Molecule): MolecularProperties {
  const basicProps = basic(mol);
  const physchemProps = physicochemical(mol);
  const structuralProps = structural(mol);
  const drugLike = drugLikeness(mol);

  return {
    ...basicProps,
    ...physchemProps,
    ...structuralProps,
    lipinskiPass: drugLike.lipinski.passes,
    veberPass: drugLike.veber.passes,
    bbbPenetration: drugLike.bbb.penetrates,
  };
}
