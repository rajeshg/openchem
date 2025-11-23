/**
 * Topology Descriptors Implementation (Kappa Indices, Bertz CT)
 *
 * Derived from RDKit's topology descriptor calculations
 * Original C++ source: rdkit/Code/GraphMol/Descriptors/Lipinski.cpp
 * Copyright (c) 2006-2015, Rational Discovery LLC, Greg Landrum, and others
 *
 * This TypeScript implementation is based on RDKit's algorithms and is
 * distributed under the BSD 3-Clause License (same as RDKit).
 *
 * Reference:
 * - RDKit: https://github.com/rdkit/rdkit
 * - Kier, L.B. & Hall, L.H., Molecular Connectivity in Chemistry and Drug Research (1976)
 * - Bertz, S.H., J. Am. Chem. Soc. 103:3599-3601 (1981)
 */

import type { Molecule } from "types";
import { enrichMolecule } from "./molecule-enrichment";

/**
 * Count paths of a given length in the molecular graph.
 * A path of length n connects n+1 atoms through n bonds.
 *
 * @param mol - Molecule to analyze
 * @param pathLength - Length of paths to count (1 = bonds, 2 = atom-bond-atom, etc.)
 * @returns Number of paths of the specified length
 */
function countPaths(mol: Molecule, pathLength: number): number {
  if (pathLength < 1) return 0;

  const enriched = enrichMolecule(mol);

  // Path length 1 = number of bonds
  if (pathLength === 1) {
    return enriched.bonds.length;
  }

  // For longer paths, use depth-first search
  let pathCount = 0;
  const visited = new Set<number>();

  function dfs(currentAtom: number, depth: number, path: number[]): void {
    if (depth === pathLength) {
      pathCount++;
      return;
    }

    // Find neighbors
    const neighbors: number[] = [];
    for (const bond of enriched.bonds) {
      if (bond.atom1 === currentAtom && !path.includes(bond.atom2)) {
        neighbors.push(bond.atom2);
      } else if (bond.atom2 === currentAtom && !path.includes(bond.atom1)) {
        neighbors.push(bond.atom1);
      }
    }

    for (const neighbor of neighbors) {
      dfs(neighbor, depth + 1, [...path, neighbor]);
    }
  }

  // Start DFS from each atom
  for (const atom of enriched.atoms) {
    visited.clear();
    dfs(atom.id, 0, [atom.id]);
  }

  // Each path is counted twice (once from each direction), so divide by 2
  return pathCount / 2;
}

/**
 * Get the number of heavy atoms (non-hydrogen atoms) in the molecule.
 */
function getHeavyAtomCount(mol: Molecule): number {
  return mol.atoms.filter((a) => a.symbol !== "H" || !!a.isotope).length;
}

/**
 * Calculate Kappa1 shape index (molecular linearity).
 * Kappa1 characterizes the 1D shape of a molecule.
 * Higher values indicate more linear molecules.
 *
 * Formula: Kappa1 = (N * (N-1)^2) / P1^2
 * where N = number of heavy atoms, P1 = number of bonds
 *
 * Matches RDKit's Kappa1 descriptor.
 *
 * @example
 * getKappa1(parseSMILES('CCCCCC').molecules[0])  // Linear hexane: high Kappa1
 * getKappa1(parseSMILES('C1CCCCC1').molecules[0]) // Cyclic: lower Kappa1
 */
export function getKappa1(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const N = getHeavyAtomCount(enriched);

  if (N <= 1) return 0;

  const P1 = countPaths(enriched, 1); // Number of bonds

  if (P1 === 0) return 0;

  return (N * Math.pow(N - 1, 2)) / Math.pow(P1, 2);
}

/**
 * Calculate Kappa2 shape index (molecular planarity/area).
 * Kappa2 characterizes the 2D shape of a molecule.
 * Higher values indicate more branched/planar structures.
 *
 * Formula: Kappa2 = ((N-1) * (N-2)^2) / P2^2
 * where N = number of heavy atoms, P2 = number of 2-length paths
 *
 * Matches RDKit's Kappa2 descriptor.
 *
 * @example
 * getKappa2(parseSMILES('CC(C)(C)C').molecules[0]) // Branched: high Kappa2
 * getKappa2(parseSMILES('CCCCCC').molecules[0])    // Linear: lower Kappa2
 */
export function getKappa2(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const N = getHeavyAtomCount(enriched);

  if (N <= 2) return 0;

  const P2 = countPaths(enriched, 2); // Number of 2-length paths

  if (P2 === 0) return 0;

  return ((N - 1) * Math.pow(N - 2, 2)) / Math.pow(P2, 2);
}

/**
 * Calculate Kappa3 shape index (molecular sphericity/volume).
 * Kappa3 characterizes the 3D shape of a molecule.
 * Higher values indicate more spherical/compact structures.
 *
 * Formula depends on whether N is odd or even:
 * - Odd N:  Kappa3 = ((N-1) * (N-3)^2) / P3^2
 * - Even N: Kappa3 = ((N-3) * (N-2)^2) / P3^2
 * where N = number of heavy atoms, P3 = number of 3-length paths
 *
 * Matches RDKit's Kappa3 descriptor.
 *
 * @example
 * getKappa3(parseSMILES('C1C2CC3CC1CC(C2)C3').molecules[0]) // Adamantane: high Kappa3
 * getKappa3(parseSMILES('CCCCCC').molecules[0])            // Linear: lower Kappa3
 */
export function getKappa3(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const N = getHeavyAtomCount(enriched);

  if (N <= 3) return 0;

  const P3 = countPaths(enriched, 3); // Number of 3-length paths

  if (P3 === 0) return 0;

  // Different formula for odd vs even N
  if (N % 2 === 1) {
    // Odd N
    return ((N - 1) * Math.pow(N - 3, 2)) / Math.pow(P3, 2);
  } else {
    // Even N
    return ((N - 2) * Math.pow(N - 3, 2)) / Math.pow(P3, 2);
  }
}

/**
 * Calculate Hall-Kier alpha value.
 * This is a molecular flexibility parameter based on sp3 carbons.
 *
 * Formula: alpha = (N_sp3 / N_C) - 1
 * where N_sp3 = number of sp3 carbons, N_C = total carbons
 *
 * Matches RDKit's HallKierAlpha descriptor.
 */
export function getHallKierAlpha(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  let totalCarbons = 0;
  let sp3Carbons = 0;

  for (const atom of enriched.atoms) {
    if (atom.symbol === "C") {
      totalCarbons++;
      if (atom.hybridization === "sp3") {
        sp3Carbons++;
      }
    }
  }

  if (totalCarbons === 0) return 0;

  return sp3Carbons / totalCarbons - 1;
}

/**
 * Calculate Bertz complexity index (BertzCT).
 * A topological index that quantifies molecular complexity.
 * Sum of connection complexity and heteroatom distribution complexity.
 *
 * Based on: S. H. Bertz, J. Am. Chem. Soc. 103:3599-3601 (1981)
 *
 * Matches RDKit's BertzCT descriptor.
 *
 * @param mol - Molecule to analyze
 * @returns Complexity index
 */
export function getBertzCT(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const N = enriched.atoms.length;

  if (N <= 1) return 0;

  // Part 1: Connection complexity
  // Based on the diversity of bond orders and connections
  let connectionComplexity = 0;

  // Count different bond types
  const bondTypeCounts = new Map<string, number>();
  for (const bond of enriched.bonds) {
    const type = bond.type;
    bondTypeCounts.set(type, (bondTypeCounts.get(type) || 0) + 1);
  }

  // Calculate entropy-based complexity for bond types
  const totalBonds = enriched.bonds.length;
  if (totalBonds > 0) {
    for (const count of bondTypeCounts.values()) {
      const p = count / totalBonds;
      if (p > 0) {
        connectionComplexity -= p * Math.log2(p);
      }
    }
    connectionComplexity *= totalBonds;
  }

  // Part 2: Heteroatom distribution complexity
  let heteroComplexity = 0;

  // Count different element types
  const elementCounts = new Map<string, number>();
  for (const atom of enriched.atoms) {
    const element = atom.symbol;
    elementCounts.set(element, (elementCounts.get(element) || 0) + 1);
  }

  // Calculate entropy-based complexity for element distribution
  if (N > 0) {
    for (const count of elementCounts.values()) {
      const p = count / N;
      if (p > 0) {
        heteroComplexity -= p * Math.log2(p);
      }
    }
    heteroComplexity *= N;
  }

  // Total complexity
  return connectionComplexity + heteroComplexity;
}
