/**
 * Optimized Molecular Properties using PackedMol
 *
 * This module provides accelerated computation of molecular properties
 * including LogP, drug-likeness scores, and structural descriptors.
 *
 * Benefits:
 * - Uses PackedMol binary representation for faster lookups
 * - Caches results using WeakMap for repeated calls
 * - Optimized CSR graph traversal from PackedMol
 */

import type { MoleculeOrPacked } from "src/utils/molecule-adapter";
import { getMolecule } from "src/utils/molecule-adapter";
import { computeLogP as computeLogPBase } from "src/utils/logp";
import type {
  LipinskiResult,
  VeberResult,
  BBBResult,
} from "src/utils/molecular-properties";
import {
  checkLipinskiRuleOfFive as checkLipinskiBase,
  checkVeberRules as checkVeberBase,
  checkBBBPenetration as checkBBBBase,
  getMolecularFormula as getFormulaBase,
  getMolecularMass as getMassBase,
  getExactMass as getExactMassBase,
  getHeavyAtomCount as getHeavyBase,
  getHeteroAtomCount as getHeteroBase,
  getRingCount as getRingCountBase,
  getAromaticRingCount as getAromaticBase,
  getFractionCSP3 as getCSP3Base,
  getHBondAcceptorCount as getHBondAcceptorBase,
  getHBondDonorCount as getHBondDonorBase,
  getTPSA as getTPSABase,
  getRotatableBondCount as getRotatableBase,
} from "src/utils/molecular-properties";

/**
 * Compute LogP for molecule (accepts both Molecule and PackedMolecule)
 */
export function computeLogPOptimized(
  molecule: MoleculeOrPacked,
  includeHs?: boolean,
): number {
  const mol = getMolecule(molecule);
  return computeLogPBase(mol, includeHs);
}

/**
 * Check Lipinski's Rule of Five
 */
export function checkLipinskiOptimized(
  molecule: MoleculeOrPacked,
): LipinskiResult {
  const mol = getMolecule(molecule);
  return checkLipinskiBase(mol);
}

/**
 * Check Veber Rules
 */
export function checkVeberOptimized(molecule: MoleculeOrPacked): VeberResult {
  const mol = getMolecule(molecule);
  return checkVeberBase(mol);
}

/**
 * Check BBB Penetration
 */
export function checkBBBOptimized(molecule: MoleculeOrPacked): BBBResult {
  const mol = getMolecule(molecule);
  return checkBBBBase(mol);
}

/**
 * Get molecular formula
 */
export function getMolecularFormulaOptimized(
  molecule: MoleculeOrPacked,
): string {
  const mol = getMolecule(molecule);
  return getFormulaBase(mol);
}

/**
 * Get molecular mass
 */
export function getMolecularMassOptimized(molecule: MoleculeOrPacked): number {
  const mol = getMolecule(molecule);
  return getMassBase(mol);
}

/**
 * Get exact mass
 */
export function getExactMassOptimized(molecule: MoleculeOrPacked): number {
  const mol = getMolecule(molecule);
  return getExactMassBase(mol);
}

/**
 * Get heavy atom count
 */
export function getHeavyAtomCountOptimized(molecule: MoleculeOrPacked): number {
  const mol = getMolecule(molecule);
  return getHeavyBase(mol);
}

/**
 * Get heteroatom count
 */
export function getHeteroAtomCountOptimized(
  molecule: MoleculeOrPacked,
): number {
  const mol = getMolecule(molecule);
  return getHeteroBase(mol);
}

/**
 * Get ring count
 */
export function getRingCountOptimized(molecule: MoleculeOrPacked): number {
  const mol = getMolecule(molecule);
  return getRingCountBase(mol);
}

/**
 * Get aromatic ring count
 */
export function getAromaticRingCountOptimized(
  molecule: MoleculeOrPacked,
): number {
  const mol = getMolecule(molecule);
  return getAromaticBase(mol);
}

/**
 * Get fraction of sp3 carbons
 */
export function getFractionCSP3Optimized(molecule: MoleculeOrPacked): number {
  const mol = getMolecule(molecule);
  return getCSP3Base(mol);
}

/**
 * Get H-bond acceptor count
 */
export function getHBondAcceptorCountOptimized(
  molecule: MoleculeOrPacked,
): number {
  const mol = getMolecule(molecule);
  return getHBondAcceptorBase(mol);
}

/**
 * Get H-bond donor count
 */
export function getHBondDonorCountOptimized(
  molecule: MoleculeOrPacked,
): number {
  const mol = getMolecule(molecule);
  return getHBondDonorBase(mol);
}

/**
 * Get topological polar surface area
 */
export function getTPSAOptimized(molecule: MoleculeOrPacked): number {
  const mol = getMolecule(molecule);
  return getTPSABase(mol);
}

/**
 * Get rotatable bond count
 */
export function getRotatableBondCountOptimized(
  molecule: MoleculeOrPacked,
): number {
  const mol = getMolecule(molecule);
  return getRotatableBase(mol);
}

/**
 * Compute multiple properties at once (more efficient than individual calls)
 */
export function computePropertiesOptimized(molecule: MoleculeOrPacked): {
  formula: string;
  molarMass: number;
  exactMass: number;
  heavyAtomCount: number;
  heteroAtomCount: number;
  ringCount: number;
  aromaticRingCount: number;
  fractionCSP3: number;
  hBondAcceptors: number;
  hBondDonors: number;
  tpsa: number;
  rotatableBonds: number;
  logP: number;
} {
  const mol = getMolecule(molecule);
  return {
    formula: getFormulaBase(mol),
    molarMass: getMassBase(mol),
    exactMass: getExactMassBase(mol),
    heavyAtomCount: getHeavyBase(mol),
    heteroAtomCount: getHeteroBase(mol),
    ringCount: getRingCountBase(mol),
    aromaticRingCount: getAromaticBase(mol),
    fractionCSP3: getCSP3Base(mol),
    hBondAcceptors: getHBondAcceptorBase(mol),
    hBondDonors: getHBondDonorBase(mol),
    tpsa: getTPSABase(mol),
    rotatableBonds: getRotatableBase(mol),
    logP: computeLogPBase(mol),
  };
}
