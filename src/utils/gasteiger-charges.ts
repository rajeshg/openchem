/**
 * Gasteiger Partial Charges Implementation
 *
 * Derived from RDKit's Gasteiger charge calculation
 * Original C++ source: rdkit/Code/GraphMol/PartialCharges/GasteigerCharges.cpp
 * Copyright (c) 2006-2015, Rational Discovery LLC, Greg Landrum, and others
 *
 * This TypeScript implementation is based on RDKit's algorithms and is
 * distributed under the BSD 3-Clause License (same as RDKit).
 *
 * Reference:
 * - RDKit: https://github.com/rdkit/rdkit
 * - Gasteiger & Marsili, Tetrahedron 36:3219-3228 (1980)
 */

import type { Atom, Molecule } from "types";

/**
 * Gasteiger-Marsili partial charge parameters
 * Based on RDKit implementation
 * Source: Gasteiger & Marsili, Tetrahedron 36:3219-3228 (1980)
 */
interface GasteigerParams {
  a: number; // Electronegativity
  b: number; // Hardness factor
  c: number; // Third parameter
}

/**
 * Gasteiger parameters by element and hybridization
 * Format: [a, b, c] where a=electronegativity, b=hardness, c=third parameter
 */
const GASTEIGER_PARAMS: Record<string, Record<string, GasteigerParams>> = {
  H: {
    sp3: { a: 7.17, b: 6.24, c: -0.56 },
  },
  C: {
    sp: { a: 7.98, b: 9.18, c: 1.88 },
    sp2: { a: 8.79, b: 9.32, c: 1.51 },
    sp3: { a: 7.98, b: 9.18, c: 1.88 },
  },
  N: {
    sp: { a: 11.54, b: 10.82, c: 1.36 },
    sp2: { a: 12.87, b: 11.15, c: 0.85 },
    sp3: { a: 11.54, b: 10.82, c: 1.36 },
  },
  O: {
    sp2: { a: 14.18, b: 12.92, c: 1.39 },
    sp3: { a: 14.18, b: 12.92, c: 1.39 },
  },
  F: {
    sp3: { a: 14.66, b: 13.85, c: 2.31 },
  },
  Cl: {
    sp3: { a: 11.0, b: 9.69, c: 1.35 },
  },
  Br: {
    sp3: { a: 10.08, b: 8.47, c: 1.16 },
  },
  I: {
    sp3: { a: 9.9, b: 7.96, c: 0.96 },
  },
  S: {
    sp2: { a: 10.14, b: 9.13, c: 1.38 },
    sp3: { a: 10.14, b: 9.13, c: 1.38 },
  },
  P: {
    sp3: { a: 8.9, b: 8.0, c: 1.5 },
  },
  Si: {
    sp3: { a: 7.5, b: 6.5, c: 1.2 },
  },
  B: {
    sp2: { a: 7.0, b: 6.0, c: 1.0 },
    sp3: { a: 7.0, b: 6.0, c: 1.0 },
  },
};

/**
 * Get Gasteiger parameters for an atom
 */
function getGasteigerParams(atom: Atom): GasteigerParams {
  const element = atom.symbol;
  const hybridization = atom.hybridization || "sp3";

  const elementParams = GASTEIGER_PARAMS[element];
  if (!elementParams) {
    return { a: 7.0, b: 6.0, c: 1.0 };
  }

  const params = elementParams[hybridization];
  if (params) {
    return params;
  }

  if (elementParams.sp3) return elementParams.sp3;
  if (elementParams.sp2) return elementParams.sp2;
  if (elementParams.sp) return elementParams.sp;

  return { a: 7.0, b: 6.0, c: 1.0 };
}

/**
 * Compute Gasteiger partial charges for a molecule
 * Uses iterative equalization of orbital electronegativity
 *
 * Algorithm:
 * 1. Initialize charges to formal charges
 * 2. For each iteration:
 *    - Compute electronegativity for each atom
 *    - Transfer charge from less electronegative to more electronegative atoms
 *    - Apply damping factor
 * 3. Return final charges
 *
 * @param mol - Molecule to compute charges for
 * @param nIter - Number of iterations (default 12, matching RDKit)
 * @returns Array of partial charges indexed by atom id
 */
export function computeGasteigerCharges(mol: Molecule, nIter = 12): number[] {
  const charges: number[] = Array.from({ length: mol.atoms.length }, () => 0);
  const params: GasteigerParams[] = Array.from({ length: mol.atoms.length });

  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i]!;
    charges[i] = atom.charge;
    params[i] = getGasteigerParams(atom);
  }

  let damping = 0.5;
  const dampingFactor = 0.9;

  // Track which bonds we've processed to avoid double-counting
  const processedBonds = new Set<string>();

  for (let iter = 0; iter < nIter; iter++) {
    const deltaCharges: number[] = Array.from(
      { length: mol.atoms.length },
      () => 0,
    );
    processedBonds.clear();

    // Process each bond once
    for (const bond of mol.bonds) {
      const bondKey = `${Math.min(bond.atom1, bond.atom2)}-${Math.max(bond.atom1, bond.atom2)}`;
      if (processedBonds.has(bondKey)) continue;
      processedBonds.add(bondKey);

      const atomIdx1 = mol.atoms.findIndex((a) => a.id === bond.atom1);
      const atomIdx2 = mol.atoms.findIndex((a) => a.id === bond.atom2);

      if (atomIdx1 === -1 || atomIdx2 === -1) continue;

      const p1 = params[atomIdx1];
      const p2 = params[atomIdx2];
      const q1 = charges[atomIdx1];
      const q2 = charges[atomIdx2];

      if (!p1 || !p2 || q1 === undefined || q2 === undefined) continue;

      // Calculate electronegativity for both atoms
      const chi1 = p1.a + p1.b * q1 + p1.c * q1 * q1;
      const chi2 = p2.a + p2.b * q2 + p2.c * q2 * q2;

      // Transfer charge from lower to higher electronegativity
      // Use proper Gasteiger formula: dq = (chi_j - chi_i) / (a_i + a_j) * damping
      const delta = ((chi2 - chi1) / (p1.a + p2.a)) * damping;

      deltaCharges[atomIdx1] = (deltaCharges[atomIdx1] || 0) + delta;
      deltaCharges[atomIdx2] = (deltaCharges[atomIdx2] || 0) - delta;
    }

    // Apply accumulated delta charges
    for (let i = 0; i < mol.atoms.length; i++) {
      const delta = deltaCharges[i];
      const currentCharge = charges[i];
      if (delta !== undefined && currentCharge !== undefined) {
        charges[i] = currentCharge + delta;
      }
    }

    damping *= dampingFactor;
  }

  return charges;
}

// Removed unused getBondOrder function
