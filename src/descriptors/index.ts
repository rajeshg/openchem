import type { Molecule } from "types";
import { all } from "./all";
import { basic } from "./basic";
import { physicochemical } from "./physicochemical";
import { structural } from "./structural";
import { drugLikeness } from "./drug-likeness";
import { topology } from "./topology";
import { chi } from "./chi-indices";
import {
  getMolecularFormula,
  getMolecularMass,
  getTPSA,
  getRotatableBondCount,
  getRingCount,
  getAromaticRingCount,
  getHBondDonorCount,
  getHBondAcceptorCount,
} from "src/utils/molecular-properties";
import { computeLogP } from "src/utils/logp";

export const Descriptors = {
  // Category functions
  all,
  basic,
  physicochemical,
  structural,
  drugLikeness,
  topology,
  chi,

  // Individual accessors (most commonly used)
  formula: (mol: Molecule) => getMolecularFormula(mol),
  mass: (mol: Molecule) => getMolecularMass(mol),
  logP: (mol: Molecule) => computeLogP(mol),
  tpsa: (mol: Molecule) => getTPSA(mol),
  rotatableBonds: (mol: Molecule) => getRotatableBondCount(mol),
  rings: (mol: Molecule) => getRingCount(mol),
  aromaticRings: (mol: Molecule) => getAromaticRingCount(mol),
  hbondDonors: (mol: Molecule) => getHBondDonorCount(mol),
  hbondAcceptors: (mol: Molecule) => getHBondAcceptorCount(mol),
};

// Export types
export type {
  BasicProperties,
  PhysicochemicalProperties,
  StructuralProperties,
  DrugLikenessProperties,
  TopologyProperties,
  ChiProperties,
  MolecularProperties,
  LipinskiResult,
  VeberResult,
  BBBResult,
} from "./types";
