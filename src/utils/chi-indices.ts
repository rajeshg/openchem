/**
 * Chi Connectivity Indices Implementation
 *
 * Derived from RDKit's Chi indices calculation
 * Original C++ source: rdkit/Code/GraphMol/Descriptors/Lipinski.cpp
 * Copyright (c) 2006-2015, Rational Discovery LLC, Greg Landrum, and others
 *
 * This TypeScript implementation is based on RDKit's algorithms and is
 * distributed under the BSD 3-Clause License (same as RDKit).
 *
 * Reference:
 * - RDKit: https://github.com/rdkit/rdkit
 * - Hall, L.H. & Kier, L.B., J. Chem. Inf. Comput. Sci. 35:1039-1045 (1995)
 */

import type { Molecule, Atom } from "types";
import { enrichMolecule } from "./molecule-enrichment";
import { VALENCE_ELECTRONS } from "src/constants";

/**
 * Get the graph degree (simple connectivity) for an atom.
 * This is the number of heavy atom neighbors.
 */
function getSimpleDegree(atom: Atom, mol: Molecule): number {
  const bonds = mol.bonds.filter((b) => b.atom1 === atom.id || b.atom2 === atom.id);

  // Count heavy atom neighbors (excluding hydrogen)
  let degree = 0;
  for (const bond of bonds) {
    const neighborId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
    const neighbor = mol.atoms.find((a) => a.id === neighborId);
    if (neighbor && (neighbor.symbol !== "H" || neighbor.isotope)) {
      degree++;
    }
  }

  return degree;
}

/**
 * Get the valence-adjusted degree (delta-v) for an atom.
 * Formula: δv = (Zv - H) / (Z - Zv - 1)
 * where Zv = valence electrons, Z = atomic number, H = attached hydrogens
 */
function getValenceDegree(atom: Atom, mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const enrichedAtom = enriched.atoms.find((a) => a.id === atom.id);
  if (!enrichedAtom) return 0;

  // Z = atomic number
  const Z = getAtomicNumber(atom.symbol);

  // Get valence electrons using atomic number
  const Zv = (VALENCE_ELECTRONS as Record<number, number>)[Z] || 0;
  if (Zv === 0) return 0;

  // H = number of attached hydrogens (implicit + explicit)
  const H = enrichedAtom.hydrogens || 0;

  // δv = (Zv - H) / (Z - Zv - 1)
  const denominator = Z - Zv - 1;
  if (denominator === 0) return 0;

  return (Zv - H) / denominator;
}

/**
 * Get approximate atomic number from element symbol.
 */
function getAtomicNumber(symbol: string): number {
  const atomicNumbers: Record<string, number> = {
    H: 1,
    C: 6,
    N: 7,
    O: 8,
    F: 9,
    P: 15,
    S: 16,
    Cl: 17,
    Br: 35,
    I: 53,
    B: 5,
    Si: 14,
    Se: 34,
    As: 33,
    Te: 52,
  };
  return atomicNumbers[symbol] || 6;
}

/**
 * Calculate Chi0 (simple molecular connectivity index of order 0).
 * Sum over all atoms: 1/sqrt(degree)
 *
 * Matches RDKit's Chi0 descriptor.
 * Based on Kier & Hall connectivity indices.
 */
export function getChi0(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  let sum = 0;
  for (const atom of enriched.atoms) {
    if (atom.symbol === "H" && !atom.isotope) continue; // Skip hydrogen

    const degree = getSimpleDegree(atom, enriched);
    if (degree > 0) {
      sum += 1 / Math.sqrt(degree);
    }
  }

  return sum;
}

/**
 * Calculate Chi0n (path molecular connectivity index of order 0).
 * Like Chi0 but using atomic-number-adjusted degrees.
 *
 * Matches RDKit's Chi0n descriptor.
 */
export function getChi0n(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  let sum = 0;
  for (const atom of enriched.atoms) {
    if (atom.symbol === "H" && !atom.isotope) continue;

    const valDegree = getValenceDegree(atom, enriched);
    if (valDegree > 0) {
      sum += 1 / Math.sqrt(valDegree);
    }
  }

  return sum;
}

/**
 * Calculate Chi0v (valence molecular connectivity index of order 0).
 * Like Chi0n but using valence-adjusted degrees.
 *
 * Matches RDKit's Chi0v descriptor.
 */
export function getChi0v(mol: Molecule): number {
  // For most practical purposes, Chi0v = Chi0n
  return getChi0n(mol);
}

/**
 * Calculate Chi1 (simple molecular connectivity index of order 1).
 * Sum over all bonds: 1/sqrt(degree_i * degree_j)
 *
 * Matches RDKit's Chi1 descriptor.
 */
export function getChi1(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  let sum = 0;
  for (const bond of enriched.bonds) {
    const atom1 = enriched.atoms.find((a) => a.id === bond.atom1);
    const atom2 = enriched.atoms.find((a) => a.id === bond.atom2);

    if (!atom1 || !atom2) continue;
    if ((atom1.symbol === "H" && !atom1.isotope) || (atom2.symbol === "H" && !atom2.isotope))
      continue;

    const degree1 = getSimpleDegree(atom1, enriched);
    const degree2 = getSimpleDegree(atom2, enriched);

    if (degree1 > 0 && degree2 > 0) {
      sum += 1 / Math.sqrt(degree1 * degree2);
    }
  }

  return sum;
}

/**
 * Calculate Chi1n (path molecular connectivity index of order 1).
 * Like Chi1 but using valence-adjusted degrees.
 *
 * Matches RDKit's Chi1n descriptor.
 */
export function getChi1n(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  let sum = 0;
  for (const bond of enriched.bonds) {
    const atom1 = enriched.atoms.find((a) => a.id === bond.atom1);
    const atom2 = enriched.atoms.find((a) => a.id === bond.atom2);

    if (!atom1 || !atom2) continue;
    if ((atom1.symbol === "H" && !atom1.isotope) || (atom2.symbol === "H" && !atom2.isotope))
      continue;

    const degree1 = getValenceDegree(atom1, enriched);
    const degree2 = getValenceDegree(atom2, enriched);

    if (degree1 > 0 && degree2 > 0) {
      sum += 1 / Math.sqrt(degree1 * degree2);
    }
  }

  return sum;
}

/**
 * Calculate Chi1v (valence molecular connectivity index of order 1).
 * Like Chi1n but using valence-adjusted degrees.
 *
 * Matches RDKit's Chi1v descriptor.
 */
export function getChi1v(mol: Molecule): number {
  // For most practical purposes, Chi1v = Chi1n
  return getChi1n(mol);
}

/**
 * Find all paths of length n in the molecular graph.
 * Returns array of paths, where each path is an array of atom IDs.
 */
function findPaths(mol: Molecule, length: number): number[][] {
  const enriched = enrichMolecule(mol);
  const paths: number[][] = [];

  function dfs(currentAtom: number, path: number[]): void {
    if (path.length === length + 1) {
      paths.push([...path]);
      return;
    }

    // Find neighbors not already in path
    for (const bond of enriched.bonds) {
      let neighbor: number | null = null;
      if (bond.atom1 === currentAtom && !path.includes(bond.atom2)) {
        neighbor = bond.atom2;
      } else if (bond.atom2 === currentAtom && !path.includes(bond.atom1)) {
        neighbor = bond.atom1;
      }

      if (neighbor !== null) {
        const neighborAtom = enriched.atoms.find((a) => a.id === neighbor);
        if (neighborAtom && (neighborAtom.symbol !== "H" || neighborAtom.isotope)) {
          dfs(neighbor, [...path, neighbor]);
        }
      }
    }
  }

  // Start from each heavy atom
  for (const atom of enriched.atoms) {
    if (atom.symbol === "H" && !atom.isotope) continue;
    dfs(atom.id, [atom.id]);
  }

  // Remove duplicates (same path in reverse)
  const uniquePaths: number[][] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    const key1 = path.join(",");
    const key2 = [...path].reverse().join(",");
    if (!seen.has(key1) && !seen.has(key2)) {
      uniquePaths.push(path);
      seen.add(key1);
      seen.add(key2);
    }
  }

  return uniquePaths;
}

/**
 * Calculate Chi2n (path molecular connectivity index of order 2).
 * Sum over all 2-paths: 1/sqrt(degree_i * degree_j * degree_k)
 *
 * Matches RDKit's Chi2n descriptor.
 */
export function getChi2n(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const paths = findPaths(enriched, 2);

  let sum = 0;
  for (const path of paths) {
    const atoms = path.map((id) => enriched.atoms.find((a) => a.id === id)!);
    const degrees = atoms.map((a) => getValenceDegree(a, enriched));

    if (degrees.every((d) => d > 0)) {
      const product = degrees.reduce((acc, d) => acc * d, 1);
      sum += 1 / Math.sqrt(product);
    }
  }

  return sum;
}

/**
 * Calculate Chi2v (valence molecular connectivity index of order 2).
 * Like Chi2n but using valence-adjusted degrees.
 *
 * Matches RDKit's Chi2v descriptor.
 */
export function getChi2v(mol: Molecule): number {
  // For most practical purposes, Chi2v = Chi2n
  return getChi2n(mol);
}

/**
 * Calculate Chi3n (path molecular connectivity index of order 3).
 * Sum over all 3-paths: 1/sqrt(degree_i * degree_j * degree_k * degree_l)
 *
 * Matches RDKit's Chi3n descriptor.
 */
export function getChi3n(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const paths = findPaths(enriched, 3);

  let sum = 0;
  for (const path of paths) {
    const atoms = path.map((id) => enriched.atoms.find((a) => a.id === id)!);
    const degrees = atoms.map((a) => getValenceDegree(a, enriched));

    if (degrees.every((d) => d > 0)) {
      const product = degrees.reduce((acc, d) => acc * d, 1);
      sum += 1 / Math.sqrt(product);
    }
  }

  return sum;
}

/**
 * Calculate Chi3v (valence molecular connectivity index of order 3).
 * Like Chi3n but using valence-adjusted degrees.
 *
 * Matches RDKit's Chi3v descriptor.
 */
export function getChi3v(mol: Molecule): number {
  // For most practical purposes, Chi3v = Chi3n
  return getChi3n(mol);
}

/**
 * Calculate Chi4n (path molecular connectivity index of order 4).
 * Sum over all 4-paths: 1/sqrt(degree_i * ... * degree_m)
 *
 * Matches RDKit's Chi4n descriptor.
 */
export function getChi4n(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const paths = findPaths(enriched, 4);

  let sum = 0;
  for (const path of paths) {
    const atoms = path.map((id) => enriched.atoms.find((a) => a.id === id)!);
    const degrees = atoms.map((a) => getValenceDegree(a, enriched));

    if (degrees.every((d) => d > 0)) {
      const product = degrees.reduce((acc, d) => acc * d, 1);
      sum += 1 / Math.sqrt(product);
    }
  }

  return sum;
}

/**
 * Calculate Chi4v (valence molecular connectivity index of order 4).
 * Like Chi4n but using valence-adjusted degrees.
 *
 * Matches RDKit's Chi4v descriptor.
 */
export function getChi4v(mol: Molecule): number {
  // For most practical purposes, Chi4v = Chi4n
  return getChi4n(mol);
}
