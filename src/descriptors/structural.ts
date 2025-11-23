import type { Molecule } from "types";
import type { StructuralProperties } from "./types";
import {
  getRingCount,
  getAromaticRingCount,
  getNumSaturatedRings,
  getNumAliphaticRings,
  getNumSaturatedAliphaticRings,
  getNumHeterocycles,
  getNumAromaticHeterocycles,
  getNumSaturatedHeterocycles,
  getNumAliphaticHeterocycles,
  getNumSpiroAtoms,
  getNumBridgeheadAtoms,
  getNumAtomStereoCenters,
  getNumUnspecifiedAtomStereoCenters,
} from "src/utils/molecular-properties";

export function structural(mol: Molecule): StructuralProperties {
  return {
    rings: getRingCount(mol),
    aromaticRings: getAromaticRingCount(mol),
    saturatedRings: getNumSaturatedRings(mol),
    aliphaticRings: getNumAliphaticRings(mol),
    saturatedAliphaticRings: getNumSaturatedAliphaticRings(mol),
    heterocycles: getNumHeterocycles(mol),
    aromaticHeterocycles: getNumAromaticHeterocycles(mol),
    saturatedHeterocycles: getNumSaturatedHeterocycles(mol),
    aliphaticHeterocycles: getNumAliphaticHeterocycles(mol),
    spiroAtoms: getNumSpiroAtoms(mol),
    bridgeheadAtoms: getNumBridgeheadAtoms(mol),
    stereocenters: getNumAtomStereoCenters(mol),
    unspecifiedStereocenters: getNumUnspecifiedAtomStereoCenters(mol),
  };
}
