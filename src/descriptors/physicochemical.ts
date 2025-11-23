import type { Molecule } from "types";
import type { PhysicochemicalProperties } from "./types";
import {
  getHBondDonorCount,
  getHBondAcceptorCount,
  getTPSA,
  getRotatableBondCount,
  getFractionCSP3,
} from "src/utils/molecular-properties";
import { computeLogP } from "src/utils/logp";
import { getLabuteASA } from "src/utils/surface-descriptors";

export function physicochemical(mol: Molecule): PhysicochemicalProperties {
  return {
    logP: computeLogP(mol),
    tpsa: getTPSA(mol),
    rotatableBonds: getRotatableBondCount(mol),
    hbondDonors: getHBondDonorCount(mol),
    hbondAcceptors: getHBondAcceptorCount(mol),
    fractionCsp3: getFractionCSP3(mol),
    labuteASA: getLabuteASA(mol),
  };
}
