import type { Molecule } from "types";
import { matchSMARTS } from "src/matchers/smarts-matcher";

/**
 * Tautomer scoring system inspired by RDKit's MolStandardize/Tautomer.cpp
 *
 * Copyright notice for RDKit (BSD-3-Clause):
 * Copyright (c) 2006-2015, Rational Discovery LLC, Greg Landrum, and others
 * All rights reserved.
 *
 * This implementation is an independent TypeScript version inspired by RDKit's
 * tautomer scoring algorithm. The scoring rules and weights are based on the
 * RDKit C++ implementation but implemented from scratch in TypeScript.
 *
 * Source: https://github.com/rdkit/rdkit/blob/master/Code/GraphMol/MolStandardize/Tautomer.cpp
 *
 * RDKit-inspired tautomer scoring system.
 *
 * Based on RDKit's MolStandardize/Tautomer.cpp scoring algorithm:
 * - Aromatic rings: +100 per ring, +150 additional for all-carbon aromatic rings
 * - Heteroatom hydrogens: -1 per H on P, S, Se, Te
 * - Charges: -10 per non-zero charge
 * - Substructure patterns: various bonuses/penalties
 *
 * Higher score = more stable/canonical tautomer
 */

interface ScoringPattern {
  smarts: string;
  score: number;
  description: string;
}

// RDKit scoring patterns (from MolStandardize/Tautomer.cpp)
const SCORING_PATTERNS: ScoringPattern[] = [
  // Benzoquinone: +25 bonus (RDKit: very stable conjugated system)
  {
    smarts: "O=C1C=CC(=O)C=C1",
    score: 25,
    description: "benzoquinone (para)",
  },
  {
    smarts: "O=C1C=CC=CC1=O",
    score: 25,
    description: "benzoquinone (ortho)",
  },

  // Oximes: +4 bonus (RDKit: C=N-OH stable)
  {
    smarts: "[CX3]=[NX2][OX2H1]",
    score: 4,
    description: "oxime (C=N-OH)",
  },

  // Carbonyls: +2 bonus for C=O, N=O, P=O
  {
    smarts: "[CX3]=[OX1]",
    score: 2,
    description: "carbonyl C=O",
  },
  {
    smarts: "[NX3]=[OX1]",
    score: 2,
    description: "nitroso/nitro N=O",
  },
  {
    smarts: "[PX4]=[OX1]",
    score: 2,
    description: "phosphine oxide P=O",
  },

  // Methyl groups: +1 bonus (RDKit: weak hyperconjugation stabilization)
  {
    smarts: "[CH3]",
    score: 1,
    description: "methyl group",
  },

  // Amino groups: +3 bonus (more stable than imine)
  {
    smarts: "[NH2]",
    score: 3,
    description: "primary amine (amino group)",
  },

  // Aromatic C=exocyclic N: -1 penalty (RDKit: disfavored)
  {
    smarts: "c=[NX2]",
    score: -1,
    description: "aromatic C=exocyclic N",
  },

  // Aci-nitro: -4 penalty (RDKit: unstable form)
  {
    smarts: "[NX3+]([O-])([OH])",
    score: -4,
    description: "aci-nitro form",
  },
];

/**
 * Score aromatic rings in a molecule.
 * RDKit scoring:
 * - +100 per aromatic ring
 * - +150 additional (total +250) for aromatic rings where all atoms are carbon
 */
export function scoreAromaticRings(mol: Molecule): number {
  let score = 0;

  if (!mol.rings || mol.rings.length === 0) return 0;

  for (const ring of mol.rings) {
    // Check if ring is aromatic (all atoms in ring must be aromatic)
    const ringAtoms = ring.map((id) => mol.atoms.find((a) => a.id === id));
    const allAromatic = ringAtoms.every((a) => a?.aromatic === true);

    if (!allAromatic) continue;

    // Base aromatic ring bonus: +100
    score += 100;

    // Check if all atoms are carbon (for additional +150 bonus)
    const allCarbon = ringAtoms.every((a) => a?.symbol === "C");
    if (allCarbon) {
      score += 150; // Total +250 for all-carbon aromatic rings (like benzene)
    }
  }

  return score;
}

/**
 * Score based on substructure patterns (carbonyl, oxime, benzoquinone, etc.)
 * Uses SMARTS pattern matching to identify specific functional groups.
 */
export function scoreSubstructures(mol: Molecule): number {
  let score = 0;

  for (const pattern of SCORING_PATTERNS) {
    try {
      const result = matchSMARTS(pattern.smarts, mol, { maxMatches: Infinity });
      if (result.success && result.matches.length > 0) {
        // Add score for each match
        score += pattern.score * result.matches.length;
      }
    } catch (_e) {
      // Skip patterns that fail to match
      continue;
    }
  }

  return score;
}

/**
 * Score based on heteroatom hydrogens.
 * RDKit penalty: -1 per hydrogen on P, S, Se, Te
 * (These atoms prefer to be unprotonated)
 */
export function scoreHeteroHydrogens(mol: Molecule): number {
  let score = 0;

  const penalizedElements = new Set(["P", "S", "Se", "Te"]);

  for (const atom of mol.atoms) {
    if (penalizedElements.has(atom.symbol)) {
      const hCount = atom.hydrogens ?? 0;
      score -= hCount; // -1 per hydrogen
    }
  }

  return score;
}

/**
 * Score based on formal charges.
 * Penalty: -10 per non-zero charge (RDKit standard)
 * Neutral molecules are strongly preferred.
 */
export function scoreCharges(mol: Molecule): number {
  let score = 0;

  for (const atom of mol.atoms) {
    if (atom.charge && atom.charge !== 0) {
      score -= 10;
    }
  }

  return score;
}

/**
 * Score based on broken aromatic rings.
 * Penalty: -100 per ring with partial aromaticity loss
 *
 * This penalty is critical for phenol-quinone tautomerism:
 * - Phenol form: fully aromatic benzene ring (no penalty)
 * - Quinone form: broken aromaticity with C=O (high penalty)
 *
 * A ring is considered "broken" if:
 * - It's a 6-membered ring
 * - Some atoms are aromatic (1-5 atoms)
 * - Not all atoms are aromatic (indicating partial disruption)
 */
export function scoreBrokenAromaticity(mol: Molecule): number {
  let score = 0;

  if (!mol.rings || mol.rings.length === 0) return 0;

  for (const ring of mol.rings) {
    // Only check 6-membered rings (common aromatic rings)
    if (ring.length !== 6) continue;

    const ringAtoms = ring.map((id) => mol.atoms.find((a) => a.id === id));
    const aromaticCount = ringAtoms.filter((a) => a?.aromatic === true).length;

    // Penalize rings with partial aromaticity (1-5 aromatic atoms)
    // Fully aromatic (6) or fully non-aromatic (0) rings are not penalized
    if (aromaticCount > 0 && aromaticCount < 6) {
      score -= 100;
    }
  }

  return score;
}

/**
 * Compute comprehensive tautomer score using RDKit-compatible scoring.
 *
 * Components:
 * 1. Aromatic rings: +100 per ring, +150 additional for all-carbon aromatic
 * 2. Substructure patterns: various bonuses (carbonyl +2, oxime +4, benzoquinone +25, etc.)
 * 3. Heteroatom hydrogens: -1 per H on P, S, Se, Te
 * 4. Charges: -10 per non-zero charge
 * 5. Broken aromaticity: -100 per partially disrupted aromatic ring
 *
 * Higher score = more stable/canonical tautomer
 *
 * @example
 * ```typescript
 * const mol = parseSMILES('CC(=O)C').molecules[0];
 * const score = scoreTautomer(mol);
 * console.log(`Score: ${score}`); // Higher = more stable
 * ```
 */
export function scoreTautomer(mol: Molecule): number {
  let score = 0;

  // 1. Aromatic rings: +100/+250 per ring
  score += scoreAromaticRings(mol);

  // 2. Substructure patterns: carbonyl, oxime, etc.
  score += scoreSubstructures(mol);

  // 3. Heteroatom hydrogens: -1 per H on P/S/Se/Te
  score += scoreHeteroHydrogens(mol);

  // 4. Charges: -10 per non-zero charge
  score += scoreCharges(mol);

  // 5. Broken aromaticity: -100 per partially disrupted ring
  score += scoreBrokenAromaticity(mol);

  return score;
}
