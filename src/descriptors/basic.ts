import type { Molecule } from "types";
import type { BasicProperties } from "./types";
import {
  getMolecularFormula,
  getMolecularMass,
  getExactMass,
  getHeavyAtomCount,
  getHeteroAtomCount,
} from "src/utils/molecular-properties";

export function basic(mol: Molecule): BasicProperties {
  return {
    formula: getMolecularFormula(mol),
    mass: getMolecularMass(mol),
    exactMass: getExactMass(mol),
    atoms: mol.atoms.length,
    heavyAtoms: getHeavyAtomCount(mol),
    heteroAtoms: getHeteroAtomCount(mol),
    bonds: mol.bonds.length,
  };
}
