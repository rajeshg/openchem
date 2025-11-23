import type { Molecule } from "types";
import {
  MONOISOTOPIC_MASSES,
  AVERAGE_ATOMIC_MASSES,
  ISOTOPE_MASSES,
} from "src/constants";
import { findRings, analyzeRings } from "src/utils/ring-analysis";
import { enrichMolecule } from "src/utils/molecule-enrichment";
import {
  getBondsForAtom,
  getHeavyNeighborCount,
  hasMultipleBond,
  hasTripleBond,
  hasDoubleBond,
  hasCarbonylBond,
  hasImineBond,
} from "src/utils/bond-utils";
import { MoleculeGraph } from "src/utils/molecular-graph";
import { computeLogP } from "src/utils/logp";

/**
 * Options for molecular property calculations.
 * @property {boolean} [includeImplicitH=true] - Include implicit hydrogens in formula and counts
 * @property {number} [tolerance] - Tolerance for floating-point comparisons
 * @property {boolean} [includeIsotopeLabels=false] - Include isotope labels in formula (e.g., "13C")
 */
export interface MolecularOptions {
  includeImplicitH?: boolean; // default true
  tolerance?: number;
  includeIsotopeLabels?: boolean; // default false
}

/**
 * Compute the molecular formula of a molecule.
 *
 * @param {Molecule} mol - The molecule to analyze
 * @param {MolecularOptions} [opts={}] - Calculation options
 * @returns {string} Molecular formula (e.g., "C6H12O" for cyclohexanol)
 *
 * @example
 * const formula = getMolecularFormula(cyclohexane);
 * console.log(formula); // "C6H12"
 *
 * @example
 * const formulaWithH = getMolecularFormula(cyclohexane, { includeImplicitH: true });
 * const formulaWithoutH = getMolecularFormula(cyclohexane, { includeImplicitH: false });
 *
 * @complexity O(N) where N = number of atoms
 * @see getMolecularMass for atomic mass calculation
 */
export function getMolecularFormula(
  mol: Molecule,
  opts: MolecularOptions = {},
): string {
  const includeImplicitH = opts.includeImplicitH ?? true;
  const includeIsotopeLabels = opts.includeIsotopeLabels ?? false;
  const counts: Record<string, number> = Object.create(null);
  const isotopeLabels: string[] = [];

  function addElement(sym: string, n = 1) {
    if (!sym || sym === "*") return;
    counts[sym] = (counts[sym] || 0) + n;
  }

  for (const atom of mol.atoms) {
    const sym = atom.symbol;
    if (!sym || sym === "*") continue;

    if (includeIsotopeLabels && atom.isotope) {
      isotopeLabels.push(`${atom.isotope}${sym}`);
    }

    if (sym === "H") {
      addElement("H", 1);
    } else {
      addElement(sym, 1);
      if (includeImplicitH && (atom.hydrogens ?? 0) > 0) {
        addElement("H", atom.hydrogens ?? 0);
      }
    }
  }

  for (const k of Object.keys(counts)) {
    if (!counts[k]) delete counts[k];
  }

  const hasC = counts["C"] !== undefined;
  const parts: string[] = [];

  function formatPart(symbol: string, count: number) {
    return count === 1 ? symbol : `${symbol}${count}`;
  }

  if (hasC) {
    if (counts["C"]) {
      parts.push(formatPart("C", counts["C"]));
      delete counts["C"];
    }
    if (counts["H"]) {
      parts.push(formatPart("H", counts["H"]));
      delete counts["H"];
    }
    const rest = Object.keys(counts).sort();
    for (const el of rest) parts.push(formatPart(el, counts[el] ?? 0));
  } else {
    const elts = Object.keys(counts).sort();
    for (const el of elts) parts.push(formatPart(el, counts[el] ?? 0));
  }

  const formula = parts.join("");
  if (includeIsotopeLabels && isotopeLabels.length) {
    // Prepend isotopic labels in square brackets e.g. [13C]CH4 -> 13C C H4 -> we will append labels in front
    return `${isotopeLabels.join(" ")} ${formula}`.trim();
  }
  return formula;
}

export function getMolecularMass(mol: Molecule): number {
  // Molecular weight using average atomic masses (RDKit-compatible)
  let mass = 0;
  for (const atom of mol.atoms) {
    const sym = atom.symbol;
    if (!sym || sym === "*") continue;
    const baseMass = getAverageAtomMass(sym, atom.isotope ?? null);
    if (sym === "H") {
      mass += baseMass;
    } else {
      mass += baseMass;
      if ((atom.hydrogens ?? 0) > 0) {
        mass += (atom.hydrogens ?? 0) * (AVERAGE_ATOMIC_MASSES["H"] || 1.008);
      }
    }
  }
  return mass;
}

export function getExactMass(mol: Molecule): number {
  // Exact mass using monoisotopic masses (most abundant isotope)
  let mass = 0;
  for (const atom of mol.atoms) {
    const sym = atom.symbol;
    if (!sym || sym === "*") continue;
    const baseMass = getMonoisotopicAtomMass(sym, atom.isotope ?? null);
    if (sym === "H") {
      mass += baseMass;
    } else {
      mass += baseMass;
      if ((atom.hydrogens ?? 0) > 0) {
        mass +=
          (atom.hydrogens ?? 0) * (MONOISOTOPIC_MASSES["H"] || 1.007825032);
      }
    }
  }
  return mass;
}

function getAverageAtomMass(symbol: string, isotope: number | null): number {
  if (isotope && ISOTOPE_MASSES[symbol] && ISOTOPE_MASSES[symbol][isotope]) {
    return ISOTOPE_MASSES[symbol][isotope];
  }
  const base = AVERAGE_ATOMIC_MASSES[symbol];
  if (base !== undefined) return base;
  return Math.max(
    1,
    Math.round(symbol.length > 0 ? symbol.charCodeAt(0) % 100 : 12),
  );
}

function getMonoisotopicAtomMass(
  symbol: string,
  isotope: number | null,
): number {
  if (isotope && ISOTOPE_MASSES[symbol] && ISOTOPE_MASSES[symbol][isotope]) {
    return ISOTOPE_MASSES[symbol][isotope];
  }
  const base = MONOISOTOPIC_MASSES[symbol];
  if (base !== undefined) return base;
  return Math.max(
    1,
    Math.round(symbol.length > 0 ? symbol.charCodeAt(0) % 100 : 12),
  );
}

export function getHeavyAtomCount(mol: Molecule): number {
  return mol.atoms.filter((a) => a.symbol !== "H" && a.symbol !== "*").length;
}

export function getHeteroAtomCount(mol: Molecule): number {
  return mol.atoms.filter((a) => {
    const sym = a.symbol;
    return sym !== "C" && sym !== "H" && sym !== "*";
  }).length;
}

export function getRingCount(mol: Molecule): number {
  if (mol.rings) {
    return mol.rings.length;
  }
  const mg = new MoleculeGraph(mol);
  return mg.sssr.length;
}

export function getAromaticRingCount(mol: Molecule): number {
  if (mol.rings) {
    return mol.rings.filter((ring: readonly number[]) => {
      return ring.every((atomId: number) => {
        const atom = mol.atoms.find((a) => a.id === atomId);
        return atom?.aromatic === true;
      });
    }).length;
  }
  const mg = new MoleculeGraph(mol);
  return mg.sssr.filter((ring: readonly number[]) => {
    return ring.every((atomId: number) => {
      const atom = mol.atoms.find((a) => a.id === atomId);
      return atom?.aromatic === true;
    });
  }).length;
}

export function getFractionCSP3(mol: Molecule): number {
  const carbons = mol.atoms.filter((a) => a.symbol === "C");
  if (carbons.length === 0) return 0;

  const sp3Carbons = carbons.filter((c) => {
    if (c.hybridization) {
      return c.hybridization === "sp3";
    }

    if (c.aromatic) return false;

    const bonds = getBondsForAtom(mol.bonds, c.id);
    const hasMultiple = hasMultipleBond(mol.bonds, c.id);

    if (hasMultiple) return false;

    const explicitBonds = bonds.length;
    const totalValence = explicitBonds + (c.hydrogens ?? 0);

    return totalValence === 4;
  });

  return sp3Carbons.length / carbons.length;
}

export function getHBondAcceptorCount(mol: Molecule): number {
  // Implement RDKit-compatible H-bond acceptor counting
  // SMARTS pattern: [$([O,S;H1;v2]-[!$(*=[O,N,P,S])]),$([O,S;H0;v2]),$([O,S;-]),
  //                  $([N;v3;!$(N-*=!@[O,N,P,S])]),$([nH0,o,s;+0])]
  // Where v2 = total valence including implicit H
  let count = 0;

  // Helper to check if atom is in a ring
  const isAtomInRing = (atomId: number): boolean => {
    if (!mol.rings) return false;
    return mol.rings.some((ring) => ring.includes(atomId));
  };

  for (const atom of mol.atoms) {
    let matched = false;

    if (atom.symbol === "O" || atom.symbol === "S") {
      const bonds = getBondsForAtom(mol.bonds, atom.id);
      const explicitValence = bonds.reduce((sum, b) => {
        const order =
          b.type === "single"
            ? 1
            : b.type === "double"
              ? 2
              : b.type === "triple"
                ? 3
                : b.type === "aromatic"
                  ? 1.5
                  : 1;
        return sum + order;
      }, 0);
      const totalValence = explicitValence + (atom.hydrogens || 0);

      const hydrogens = atom.hydrogens || 0;
      const charge = atom.charge || 0;

      // Rule: negatively charged O/S
      if (charge < 0) {
        count++;
        matched = true;
      } else if (totalValence === 2) {
        // O/S with valence 2
        if (hydrogens === 0) {
          // Rule: O/S with 0H and valence 2 (ethers, carbonyls, sulfides)
          count++;
          matched = true;
        } else if (hydrogens === 1) {
          // Rule: O/S with 1H and valence 2, bonded to atom WITHOUT =O,N,P,S
          // Check if any bonded atom has a double bond to O, N, P, or S
          let hasNeighborWithDoubleBond = false;
          for (const bond of bonds) {
            const neighborId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
            const neighborBonds = getBondsForAtom(mol.bonds, neighborId);

            for (const nb of neighborBonds) {
              if (nb.type === "double") {
                const doubleBondAtomId =
                  nb.atom1 === neighborId ? nb.atom2 : nb.atom1;
                const doubleBondAtom = mol.atoms[doubleBondAtomId];
                if (
                  doubleBondAtom &&
                  ["O", "N", "P", "S"].includes(doubleBondAtom.symbol)
                ) {
                  hasNeighborWithDoubleBond = true;
                  break;
                }
              }
            }
            if (hasNeighborWithDoubleBond) break;
          }

          if (!hasNeighborWithDoubleBond) {
            count++;
            matched = true;
          }
        }
      }
    }

    if (!matched && atom.symbol === "N") {
      const bonds = getBondsForAtom(mol.bonds, atom.id);
      const explicitValence = bonds.reduce((sum, b) => {
        const order =
          b.type === "single"
            ? 1
            : b.type === "double"
              ? 2
              : b.type === "triple"
                ? 3
                : b.type === "aromatic"
                  ? 1.5
                  : 1;
        return sum + order;
      }, 0);
      const totalValence = explicitValence + (atom.hydrogens || 0);

      const charge = atom.charge || 0;

      // Rule: N with valence 3, NOT bonded to anything with =O,N,P,S
      // SMARTS: $([N;v3;!$(N-*=!@[O,N,P,S])])
      // The "-" means we only check SINGLE bonds from N
      if (totalValence === 3 && charge >= 0) {
        let hasNeighborWithDoubleBond = false;
        for (const bond of bonds) {
          // Only check single bonds from N (SMARTS: N-*)
          if (bond.type !== "single") continue;

          const neighborId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
          const neighborBonds = getBondsForAtom(mol.bonds, neighborId);

          for (const nb of neighborBonds) {
            if (nb.type === "double") {
              const doubleBondAtomId =
                nb.atom1 === neighborId ? nb.atom2 : nb.atom1;
              const doubleBondAtom = mol.atoms[doubleBondAtomId];
              if (
                doubleBondAtom &&
                ["O", "N", "P", "S"].includes(doubleBondAtom.symbol)
              ) {
                hasNeighborWithDoubleBond = true;
                break;
              }
            }
          }
          if (hasNeighborWithDoubleBond) break;
        }

        if (!hasNeighborWithDoubleBond) {
          count++;
          matched = true;
        }
      }
    }

    if (
      !matched &&
      (atom.symbol === "n" || atom.symbol === "o" || atom.symbol === "s") &&
      atom.aromatic
    ) {
      // Rule: aromatic N/O/S with 0H and neutral charge
      if ((atom.hydrogens || 0) === 0 && (atom.charge || 0) === 0) {
        count++;
        matched = true;
      }
    }

    if (
      !matched &&
      (atom.symbol === "N" || atom.symbol === "O" || atom.symbol === "S") &&
      (atom.hydrogens || 0) === 0 &&
      (atom.charge || 0) === 0 &&
      isAtomInRing(atom.id)
    ) {
      // Additional rule: N/O/S in rings with 0H and neutral charge
      // This catches aromatic heteroatoms that weren't marked with lowercase symbols
      // or when aromaticity perceiver didn't identify them as aromatic
      // We check if this atom is in a ring and could reasonably be aromatic
      const bonds = getBondsForAtom(mol.bonds, atom.id);
      const ringSize = mol.rings?.find((r) => r.includes(atom.id))?.length;
      if (ringSize && ringSize >= 5 && ringSize <= 7) {
        // Could be aromatic - check that it's not part of an obvious non-aromatic pattern
        // (like a saturated ring or a carbonyl)
        const hasExocyclicDouble = bonds.some((b) => {
          const otherAtomId = b.atom1 === atom.id ? b.atom2 : b.atom1;
          return b.type === "double" && !isAtomInRing(otherAtomId);
        });

        if (!hasExocyclicDouble) {
          count++;
          matched = true;
        }
      }
    }
  }

  return count;
}

export function getHBondDonorCount(mol: Molecule): number {
  // Implement RDKit-compatible H-bond donor counting
  // Based on RDKit's NumHDonors logic: [N&!H0&v3,N&!H0&+1&v4,O&H1&+0,S&H1&+0,n&H1&+0]
  let count = 0;

  for (const atom of mol.atoms) {
    const hydrogens = atom.hydrogens || 0;
    const charge = atom.charge || 0;

    if (hydrogens === 0) continue; // Must have hydrogens to donate

    if (atom.symbol === "O" || atom.symbol === "S") {
      // O/S with exactly 1 H and neutral charge (RDKit: O&H1&+0, S&H1&+0)
      // Note: RDKit does NOT count water (OH2) or H2S as HBD
      if (hydrogens === 1 && charge === 0) {
        count++;
      }
    } else if (atom.symbol === "N") {
      // N with hydrogens and appropriate valence
      const bonds = getBondsForAtom(mol.bonds, atom.id);
      const explicitValence = bonds.reduce((sum, b) => {
        const order =
          b.type === "single"
            ? 1
            : b.type === "double"
              ? 2
              : b.type === "triple"
                ? 3
                : b.type === "aromatic"
                  ? 1.5
                  : 1;
        return sum + order;
      }, 0);
      const valence = explicitValence + (atom.hydrogens || 0);

      // N with valence 3 or 4 (including charged) and hydrogens
      // Count each atom as 1 HBD site (not count all H atoms)
      if ((valence === 3 || (valence === 4 && charge === 1)) && hydrogens > 0) {
        count++;
      }
    } else if (atom.symbol === "n" && atom.aromatic) {
      // Aromatic N with hydrogens (pyrrole, imidazole)
      if (hydrogens >= 1) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Calculate Topological Polar Surface Area (TPSA)
 *
 * Implementation based on published parameters from:
 * Ertl, P.; Rohde, B.; Selzer, P. "Fast Calculation of Molecular Polar Surface Area
 * as a Sum of Fragment-Based Contributions and Its Application to the Prediction of
 * Drug Transport Properties" J. Med. Chem. 2000, 43, 3714-3717.
 *
 * Also validated against RDKit's TPSA implementation (RDKit uses the same Ertl parameters).
 *
 * @param mol - Molecule to analyze
 * @param includeSandP - Include sulfur and phosphorus contributions (default: false)
 * @returns TPSA value in Ų (square Angstroms)
 */
export function getTPSA(mol: Molecule, includeSandP: boolean = false): number {
  let tpsa = 0;

  // Get ring info for 3-membered ring detection
  const ringInfo = analyzeRings(mol);

  for (const atom of mol.atoms) {
    const symbol = atom.symbol;
    if (symbol !== "N" && symbol !== "O") {
      if (!includeSandP || (symbol !== "S" && symbol !== "P")) {
        continue;
      }
    }

    const hydrogens = atom.hydrogens ?? 0;
    const bonds = getBondsForAtom(mol.bonds, atom.id);
    const heavyNeighbors = bonds.length;

    const singleBonds = bonds.filter((b) => b.type === "single").length;
    const doubleBonds = bonds.filter((b) => b.type === "double").length;
    const tripleBonds = bonds.filter((b) => b.type === "triple").length;
    const aromaticBonds = bonds.filter((b) => b.type === "aromatic").length;

    const charge = atom.charge ?? 0;
    // Check if atom is in a 3-membered ring
    const ringsContainingAtom = ringInfo.getRingsContainingAtom(atom.id);
    const in3Ring = ringsContainingAtom.some((ring) => ring.length === 3);

    const contribution = getTPSAContribution(
      symbol,
      hydrogens,
      heavyNeighbors,
      singleBonds,
      doubleBonds,
      tripleBonds,
      aromaticBonds,
      atom.aromatic ?? false,
      charge,
      in3Ring,
    );

    tpsa += contribution;
  }

  return Math.round(tpsa * 100) / 100;
}

function getTPSAContribution(
  symbol: string,
  hydrogens: number,
  heavyNeighbors: number,
  singleBonds: number,
  doubleBonds: number,
  tripleBonds: number,
  aromaticBonds: number,
  aromatic: boolean,
  charge: number,
  in3Ring: boolean,
): number {
  if (symbol === "N") {
    // Aromatic nitrogen
    if (aromatic) {
      if (heavyNeighbors === 2) {
        if (hydrogens === 0 && charge === 0 && aromaticBonds === 2)
          return 12.89; // pyridine
        if (hydrogens === 1 && charge === 0 && aromaticBonds === 2)
          return 15.79; // pyrrole
        if (hydrogens === 1 && charge === 1 && aromaticBonds === 2)
          return 14.14; // charged aromatic NH
      } else if (heavyNeighbors === 3) {
        if (hydrogens === 0 && charge === 0 && aromaticBonds === 3) return 4.41; // 3 aromatic bonds
        if (
          hydrogens === 0 &&
          charge === 0 &&
          singleBonds === 1 &&
          aromaticBonds === 2
        )
          return 4.93; // xanthine/caffeine
        if (
          hydrogens === 0 &&
          charge === 0 &&
          doubleBonds === 1 &&
          aromaticBonds === 2
        )
          return 8.39; // aromatic with =O
        if (hydrogens === 0 && charge === 1 && aromaticBonds === 3) return 4.1; // charged aromatic
        if (
          hydrogens === 0 &&
          charge === 1 &&
          singleBonds === 1 &&
          aromaticBonds === 2
        )
          return 3.88; // charged
      }
      // Fallback for aromatic N
      if (hydrogens === 1) return 15.79;
      return 12.89;
    }

    // Non-aromatic nitrogen - organized by neighbor count
    if (heavyNeighbors === 1) {
      if (hydrogens === 0 && charge === 0 && tripleBonds === 1) return 23.79; // nitrile
      if (hydrogens === 1 && charge === 0 && doubleBonds === 1) return 23.85; // imine -NH
      if (hydrogens === 2 && charge === 0 && singleBonds === 1) return 26.02; // primary amine with 1 bond
      if (hydrogens === 2 && charge === 1 && doubleBonds === 1) return 25.59; // charged imine
      if (hydrogens === 3 && charge === 1 && singleBonds === 1) return 27.64; // ammonium with 1 bond
    } else if (heavyNeighbors === 2) {
      if (
        hydrogens === 0 &&
        charge === 0 &&
        singleBonds === 1 &&
        doubleBonds === 1
      )
        return 12.36; // imine
      if (
        hydrogens === 0 &&
        charge === 0 &&
        tripleBonds === 1 &&
        doubleBonds === 1
      )
        return 13.6; // rare
      if (hydrogens === 1 && charge === 0 && singleBonds === 2 && in3Ring)
        return 21.94; // 3-ring NH
      if (hydrogens === 1 && charge === 0 && singleBonds === 2 && !in3Ring)
        return 12.03; // secondary amine
      if (
        hydrogens === 0 &&
        charge === 1 &&
        tripleBonds === 1 &&
        singleBonds === 1
      )
        return 4.36; // charged
      if (
        hydrogens === 1 &&
        charge === 1 &&
        doubleBonds === 1 &&
        singleBonds === 1
      )
        return 13.97; // charged
      if (hydrogens === 2 && charge === 1 && singleBonds === 2) return 16.61; // protonated amine
    } else if (heavyNeighbors === 3) {
      if (hydrogens === 0 && charge === 0 && singleBonds === 3 && in3Ring)
        return 3.01; // 3-ring tertiary
      if (hydrogens === 0 && charge === 0 && singleBonds === 3 && !in3Ring)
        return 3.24; // tertiary amine
      if (
        hydrogens === 0 &&
        charge === 0 &&
        singleBonds === 1 &&
        doubleBonds === 2
      )
        return 11.68; // 2 double bonds
      if (
        hydrogens === 0 &&
        charge === 1 &&
        singleBonds === 2 &&
        doubleBonds === 1
      )
        return 3.01; // charged
      if (hydrogens === 1 && charge === 1 && singleBonds === 3) return 4.44; // protonated amine
    } else if (heavyNeighbors === 4) {
      if (hydrogens === 0 && singleBonds === 4 && charge === 1) return 0.0; // quaternary ammonium
    }

    // Fallback formula: 30.5 - nNbrs * 8.2 + nHs * 1.5
    const fallback = 30.5 - heavyNeighbors * 8.2 + hydrogens * 1.5;
    return fallback < 0 ? 0 : fallback;
  }

  if (symbol === "O") {
    if (aromatic) {
      return 13.14; // furan-like
    }

    if (heavyNeighbors === 0) {
      // Water or standalone oxygen
      if (hydrogens >= 1) return 20.23;
      return 17.07;
    } else if (heavyNeighbors === 1) {
      if (hydrogens === 0 && charge === 0 && doubleBonds === 1) return 17.07; // carbonyl
      if (hydrogens === 1 && charge === 0 && singleBonds === 1) return 20.23; // hydroxyl
      if (hydrogens === 0 && charge === -1 && singleBonds === 1) return 23.06; // oxyanion
    } else if (heavyNeighbors === 2) {
      if (hydrogens === 0 && charge === 0 && singleBonds === 2 && in3Ring)
        return 12.53; // epoxide
      if (hydrogens === 0 && charge === 0 && singleBonds === 2 && !in3Ring)
        return 9.23; // ether
    }

    // Fallback formula: 28.5 - nNbrs * 8.6 + nHs * 1.5
    const fallback = 28.5 - heavyNeighbors * 8.6 + hydrogens * 1.5;
    return fallback < 0 ? 0 : fallback;
  }

  if (symbol === "S") {
    if (heavyNeighbors === 1) {
      if (hydrogens === 0 && charge === 0 && doubleBonds === 1) return 32.09; // S=C
      if (hydrogens === 1 && charge === 0 && singleBonds === 1) return 38.8; // thiol
    } else if (heavyNeighbors === 2) {
      if (hydrogens === 0 && charge === 0 && singleBonds === 2) return 25.3; // thioether
      if (hydrogens === 0 && charge === 0 && aromaticBonds === 2) return 28.24; // thiophene
    } else if (heavyNeighbors === 3) {
      if (
        hydrogens === 0 &&
        charge === 0 &&
        aromaticBonds === 2 &&
        doubleBonds === 1
      )
        return 21.7; // aromatic S=O
      if (
        hydrogens === 0 &&
        charge === 0 &&
        singleBonds === 2 &&
        doubleBonds === 1
      )
        return 19.21; // sulfoxide
    } else if (heavyNeighbors === 4) {
      if (
        hydrogens === 0 &&
        charge === 0 &&
        singleBonds === 2 &&
        doubleBonds === 2
      )
        return 8.38; // sulfone
    }

    return 0;
  }

  if (symbol === "P") {
    if (heavyNeighbors === 2) {
      if (
        hydrogens === 0 &&
        charge === 0 &&
        singleBonds === 1 &&
        doubleBonds === 1
      )
        return 34.14; // P=C
    } else if (heavyNeighbors === 3) {
      if (hydrogens === 0 && charge === 0 && singleBonds === 3) return 13.59; // phosphine
      if (
        hydrogens === 1 &&
        charge === 0 &&
        singleBonds === 2 &&
        doubleBonds === 1
      )
        return 23.47; // P-OH with P=O
    } else if (heavyNeighbors === 4) {
      if (
        hydrogens === 0 &&
        charge === 0 &&
        singleBonds === 3 &&
        doubleBonds === 1
      )
        return 9.81; // phosphate
    }

    return 0;
  }

  return 0;
}

export function getRotatableBondCount(mol: Molecule): number {
  // Enrich the molecule to ensure ring information is available
  const enriched = enrichMolecule(mol);
  if (enriched.bonds.some((b) => b.isRotatable !== undefined)) {
    return enriched.bonds.filter((b) => b.isRotatable).length;
  }

  let count = 0;

  // Use findRings to detect all rings for accurate bond-in-ring detection
  const rings = findRings(enriched.atoms, enriched.bonds);
  const isBondInRing = (a1: number, a2: number) =>
    rings.some((ring) => {
      const idx1 = ring.indexOf(a1);
      const idx2 = ring.indexOf(a2);
      if (idx1 === -1 || idx2 === -1) return false;
      const dist = Math.abs(idx1 - idx2);
      return dist === 1 || dist === ring.length - 1; // adjacent in ring
    });
  const isAtomInRing = (id: number) => rings.some((ring) => ring.includes(id));

  for (const bond of mol.bonds) {
    if (bond.type !== "single") continue;

    if (isBondInRing(bond.atom1, bond.atom2)) continue;

    const atom1 = mol.atoms.find((a) => a.id === bond.atom1)!;
    const atom2 = mol.atoms.find((a) => a.id === bond.atom2)!;

    if (atom1.symbol === "H" && !atom1.isotope) continue;
    if (atom2.symbol === "H" && !atom2.isotope) continue;

    const heavyNeighbors1 = getHeavyNeighborCount(
      mol.bonds,
      atom1.id,
      mol.atoms,
    );
    const heavyNeighbors2 = getHeavyNeighborCount(
      mol.bonds,
      atom2.id,
      mol.atoms,
    );

    if (heavyNeighbors1 < 2 || heavyNeighbors2 < 2) continue;

    const atom1InRing = isAtomInRing(atom1.id);
    const atom2InRing = isAtomInRing(atom2.id);

    if (
      (atom1InRing && heavyNeighbors2 === 1) ||
      (atom2InRing && heavyNeighbors1 === 1)
    )
      continue;

    if (
      hasTripleBond(mol.bonds, atom1.id) ||
      hasTripleBond(mol.bonds, atom2.id)
    )
      continue;

    const hasDoubleBond1 =
      !atom1.aromatic && hasDoubleBond(mol.bonds, atom1.id);
    const hasDoubleBond2 =
      !atom2.aromatic && hasDoubleBond(mol.bonds, atom2.id);

    if (heavyNeighbors1 >= 4 && !atom1InRing && !hasDoubleBond1) continue;
    if (heavyNeighbors2 >= 4 && !atom2InRing && !hasDoubleBond2) continue;

    const hasCarbonyl1 = hasCarbonylBond(mol.bonds, atom1.id, mol.atoms);
    const hasCarbonyl2 = hasCarbonylBond(mol.bonds, atom2.id, mol.atoms);
    const hasImine1 = hasImineBond(mol.bonds, atom1.id, mol.atoms);
    const hasImine2 = hasImineBond(mol.bonds, atom2.id, mol.atoms);

    const isHeteroatom1 = atom1.symbol !== "C" && atom1.symbol !== "H";
    const isHeteroatom2 = atom2.symbol !== "C" && atom2.symbol !== "H";

    // Check if a heteroatom is bonded to another atom that has conjugation
    const neighborHasConjugation = (atomId: number) => {
      const neighborBonds = mol.bonds.filter(
        (b) =>
          b.type === "single" &&
          (b.atom1 === atomId || b.atom2 === atomId) &&
          !(
            (b.atom1 === bond.atom1 && b.atom2 === bond.atom2) ||
            (b.atom1 === bond.atom2 && b.atom2 === bond.atom1)
          ),
      );
      return neighborBonds.some((nb) => {
        const neighborId = nb.atom1 === atomId ? nb.atom2 : nb.atom1;
        return (
          hasCarbonylBond(mol.bonds, neighborId, mol.atoms) ||
          hasImineBond(mol.bonds, neighborId, mol.atoms)
        );
      });
    };

    if (
      (hasCarbonyl1 && isHeteroatom2) ||
      (hasCarbonyl2 && isHeteroatom1) ||
      (hasImine1 && isHeteroatom2) ||
      (hasImine2 && isHeteroatom1) ||
      (isHeteroatom1 && neighborHasConjugation(atom1.id)) ||
      (isHeteroatom2 && neighborHasConjugation(atom2.id))
    )
      continue;

    count++;
  }

  return count;
}

export interface LipinskiResult {
  passes: boolean;
  violations: string[];
  properties: {
    molecularWeight: number;
    hbondDonors: number;
    hbondAcceptors: number;
    logP: number;
  };
}

export function checkLipinskiRuleOfFive(mol: Molecule): LipinskiResult {
  const mw = getMolecularMass(mol);
  const donors = getHBondDonorCount(mol);
  const acceptors = getHBondAcceptorCount(mol);
  const logP = computeLogP(mol);

  const violations: string[] = [];

  if (mw > 500) {
    violations.push(`Molecular weight ${mw.toFixed(2)} > 500 Da`);
  }

  if (donors > 5) {
    violations.push(`H-bond donors ${donors} > 5`);
  }

  if (acceptors > 10) {
    violations.push(`H-bond acceptors ${acceptors} > 10`);
  }

  if (logP > 5) {
    violations.push(`LogP ${logP.toFixed(2)} > 5`);
  }

  return {
    passes: violations.length === 0,
    violations,
    properties: {
      molecularWeight: mw,
      hbondDonors: donors,
      hbondAcceptors: acceptors,
      logP,
    },
  };
}

export interface VeberResult {
  passes: boolean;
  violations: string[];
  properties: {
    rotatableBonds: number;
    tpsa: number;
  };
}

export function checkVeberRules(mol: Molecule): VeberResult {
  const rotatableBonds = getRotatableBondCount(mol);
  const tpsa = getTPSA(mol);

  const violations: string[] = [];

  if (rotatableBonds > 10) {
    violations.push(`Rotatable bonds ${rotatableBonds} > 10`);
  }

  if (tpsa > 140) {
    violations.push(`TPSA ${tpsa.toFixed(2)} Ų > 140 Ų`);
  }

  return {
    passes: violations.length === 0,
    violations,
    properties: {
      rotatableBonds,
      tpsa,
    },
  };
}

export interface BBBResult {
  likelyPenetration: boolean;
  tpsa: number;
}

export function checkBBBPenetration(mol: Molecule): BBBResult {
  const tpsa = getTPSA(mol);

  return {
    likelyPenetration: tpsa < 90,
    tpsa,
  };
}

// ============================================================================
// Phase 1 Molecular Descriptors (RDKit-compatible)
//
// The following descriptors are derived from RDKit's descriptor implementations:
// Original C++ source: rdkit/Code/GraphMol/Descriptors/Lipinski.cpp
// Copyright (c) 2006-2015, Rational Discovery LLC, Greg Landrum, and others
//
// This TypeScript implementation is based on RDKit's algorithms and is
// distributed under the BSD 3-Clause License (same as RDKit).
//
// Reference: https://github.com/rdkit/rdkit
// ============================================================================

/**
 * Count total valence electrons in the molecule.
 * Sum of outer shell electrons for all atoms (including implicit H), adjusted for formal charges.
 * Matches RDKit's NumValenceElectrons descriptor.
 */
export function getNumValenceElectrons(mol: Molecule): number {
  const { VALENCE_ELECTRONS } = require("src/constants");
  let count = 0;

  for (const atom of mol.atoms) {
    const valenceElectrons = VALENCE_ELECTRONS[atom.atomicNumber] || 0;
    count += valenceElectrons - (atom.charge || 0);

    // Add valence electrons from implicit hydrogens (1 electron per H)
    count += atom.hydrogens || 0;
  }

  return count;
}

/**
 * Count total radical electrons in the molecule.
 * Currently returns 0 as radical support is not yet implemented in the parser.
 * Matches RDKit's NumRadicalElectrons descriptor.
 */
export function getNumRadicalElectrons(_mol: Molecule): number {
  return 0;
}

/**
 * Count the number of amide bonds in the molecule.
 * An amide bond is a C(=O)-N bond (carbonyl carbon bonded to nitrogen).
 * Matches RDKit's NumAmideBonds descriptor.
 */
export function getNumAmideBonds(mol: Molecule): number {
  const { enrichMolecule } = require("./molecule-enrichment");
  const { hasCarbonylBond } = require("./bond-utils");
  const enriched = enrichMolecule(mol);
  let count = 0;

  for (const bond of enriched.bonds) {
    if (bond.type !== "single") continue;

    const atom1 = enriched.atoms[bond.atom1];
    const atom2 = enriched.atoms[bond.atom2];

    if (!atom1 || !atom2) continue;

    if (atom1.symbol === "C" && atom2.symbol === "N") {
      if (hasCarbonylBond(enriched.bonds, atom1.id, enriched.atoms)) {
        count++;
      }
    } else if (atom1.symbol === "N" && atom2.symbol === "C") {
      if (hasCarbonylBond(enriched.bonds, atom2.id, enriched.atoms)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Count the number of spiro atoms in the molecule.
 * A spiro atom is an atom that belongs to exactly two rings that share only that atom.
 */
export function getNumSpiroAtoms(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const ringInfo = enriched.ringInfo;

  if (!ringInfo || !enriched.rings) return 0;

  let count = 0;

  for (const atom of enriched.atoms) {
    const atomRings = ringInfo.atomRings.get(atom.id);
    if (!atomRings || atomRings.size !== 2) continue;

    const [ring1, ring2] = Array.from(atomRings);
    if (ring1 === undefined || ring2 === undefined) continue;

    const ring1Data = enriched.rings[ring1];
    const ring2Data = enriched.rings[ring2];
    if (!ring1Data || !ring2Data) continue;

    const ring1Atoms = new Set(ring1Data);
    const ring2Atoms = new Set(ring2Data);

    let sharedCount = 0;
    for (const atomId of ring1Atoms) {
      if (ring2Atoms.has(atomId)) sharedCount++;
    }

    if (sharedCount === 1) count++;
  }

  return count;
}

/**
 * Count the number of bridgehead atoms in the molecule.
 * A bridgehead atom is an atom that belongs to 3 or more rings.
 */
export function getNumBridgeheadAtoms(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const ringInfo = enriched.ringInfo;

  if (!ringInfo) return 0;

  let count = 0;

  for (const atom of enriched.atoms) {
    const atomRings = ringInfo.atomRings.get(atom.id);
    if (atomRings && atomRings.size >= 3) {
      count++;
    }
  }

  return count;
}

/**
 * Count the number of saturated rings (all single bonds).
 */
export function getNumSaturatedRings(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  if (!enriched.rings || enriched.rings.length === 0) return 0;

  let count = 0;

  for (const ring of enriched.rings) {
    let isSaturated = true;

    for (let i = 0; i < ring.length; i++) {
      const atom1 = ring[i]!;
      const atom2 = ring[(i + 1) % ring.length]!;

      const bond = enriched.bonds.find(
        (b) =>
          (b.atom1 === atom1 && b.atom2 === atom2) ||
          (b.atom1 === atom2 && b.atom2 === atom1),
      );

      if (bond && bond.type !== "single") {
        isSaturated = false;
        break;
      }
    }

    if (isSaturated) count++;
  }

  return count;
}

/**
 * Count the number of aliphatic rings (non-aromatic rings).
 */
export function getNumAliphaticRings(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  if (!enriched.rings || enriched.rings.length === 0) return 0;

  let count = 0;

  for (const ring of enriched.rings) {
    let isAromatic = false;

    for (const atomId of ring) {
      const atom = enriched.atoms[atomId];
      if (atom?.aromatic) {
        isAromatic = true;
        break;
      }
    }

    if (!isAromatic) count++;
  }

  return count;
}

/**
 * Count the number of saturated aliphatic rings.
 */
export function getNumSaturatedAliphaticRings(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  if (!enriched.rings || enriched.rings.length === 0) return 0;

  let count = 0;

  for (const ring of enriched.rings) {
    let isAromatic = false;
    let isSaturated = true;

    for (const atomId of ring) {
      const atom = enriched.atoms[atomId];
      if (atom?.aromatic) isAromatic = true;
    }

    if (isAromatic) continue;

    for (let i = 0; i < ring.length; i++) {
      const atom1 = ring[i]!;
      const atom2 = ring[(i + 1) % ring.length]!;

      const bond = enriched.bonds.find(
        (b) =>
          (b.atom1 === atom1 && b.atom2 === atom2) ||
          (b.atom1 === atom2 && b.atom2 === atom1),
      );

      if (bond && bond.type !== "single") {
        isSaturated = false;
        break;
      }
    }

    if (isSaturated) count++;
  }

  return count;
}

/**
 * Count the number of heterocyclic rings (rings containing non-carbon atoms).
 */
export function getNumHeterocycles(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  if (!enriched.rings || enriched.rings.length === 0) return 0;

  let count = 0;

  for (const ring of enriched.rings) {
    let hasHeteroatom = false;

    for (const atomId of ring) {
      const atom = enriched.atoms[atomId];
      if (atom && atom.symbol !== "C") {
        hasHeteroatom = true;
        break;
      }
    }

    if (hasHeteroatom) count++;
  }

  return count;
}

/**
 * Count the number of aromatic heterocyclic rings.
 */
export function getNumAromaticHeterocycles(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  if (!enriched.rings || enriched.rings.length === 0) return 0;

  let count = 0;

  for (const ring of enriched.rings) {
    let isAromatic = false;
    let hasHeteroatom = false;

    for (const atomId of ring) {
      const atom = enriched.atoms[atomId];
      if (!atom) continue;

      if (atom.aromatic) isAromatic = true;
      if (atom.symbol !== "C") hasHeteroatom = true;
    }

    if (isAromatic && hasHeteroatom) count++;
  }

  return count;
}

/**
 * Count the number of saturated heterocyclic rings.
 */
export function getNumSaturatedHeterocycles(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  if (!enriched.rings || enriched.rings.length === 0) return 0;

  let count = 0;

  for (const ring of enriched.rings) {
    let hasHeteroatom = false;

    for (const atomId of ring) {
      const atom = enriched.atoms[atomId];
      if (atom && atom.symbol !== "C") {
        hasHeteroatom = true;
        break;
      }
    }

    if (!hasHeteroatom) continue;

    let isSaturated = true;

    for (let i = 0; i < ring.length; i++) {
      const atom1 = ring[i]!;
      const atom2 = ring[(i + 1) % ring.length]!;

      const bond = enriched.bonds.find(
        (b) =>
          (b.atom1 === atom1 && b.atom2 === atom2) ||
          (b.atom1 === atom2 && b.atom2 === atom1),
      );

      if (bond && bond.type !== "single") {
        isSaturated = false;
        break;
      }
    }

    if (isSaturated) count++;
  }

  return count;
}

/**
 * Count the number of aliphatic heterocyclic rings.
 */
export function getNumAliphaticHeterocycles(mol: Molecule): number {
  const enriched = enrichMolecule(mol);

  if (!enriched.rings || enriched.rings.length === 0) return 0;

  let count = 0;

  for (const ring of enriched.rings) {
    let isAromatic = false;
    let hasHeteroatom = false;

    for (const atomId of ring) {
      const atom = enriched.atoms[atomId];
      if (!atom) continue;

      if (atom.aromatic) isAromatic = true;
      if (atom.symbol !== "C") hasHeteroatom = true;
    }

    if (!isAromatic && hasHeteroatom) count++;
  }

  return count;
}

/**
 * Count the number of defined (specified) tetrahedral stereocenters.
 * Matches RDKit's CalcNumAtomStereoCenters descriptor.
 */
export function getNumAtomStereoCenters(mol: Molecule): number {
  let count = 0;

  for (const atom of mol.atoms) {
    if (atom.chiral && (atom.chiral === "@" || atom.chiral === "@@")) {
      count++;
    }
  }

  return count;
}

/**
 * Count the number of potential (unspecified) tetrahedral stereocenters.
 * Matches RDKit's CalcNumUnspecifiedAtomStereoCenters descriptor.
 */
export function getNumUnspecifiedAtomStereoCenters(mol: Molecule): number {
  const enriched = enrichMolecule(mol);
  const { getBondsForAtom } = require("./bond-utils");
  let count = 0;

  for (const atom of enriched.atoms) {
    if (atom.chiral && (atom.chiral === "@" || atom.chiral === "@@")) {
      continue;
    }

    if (atom.symbol !== "C" && atom.symbol !== "N") continue;
    if (atom.hybridization !== "sp3") continue;

    const bonds = getBondsForAtom(enriched.bonds, atom.id);
    const totalSubstituents = bonds.length + (atom.hydrogens ?? 0);

    if (totalSubstituents !== 4) continue;

    const neighborSymbols: string[] = [];
    for (const bond of bonds) {
      const neighborId = bond.atom1 === atom.id ? bond.atom2 : bond.atom1;
      const neighbor = enriched.atoms.find((a) => a.id === neighborId);
      if (neighbor) {
        neighborSymbols.push(neighbor.symbol);
      }
    }

    for (let i = 0; i < (atom.hydrogens ?? 0); i++) {
      neighborSymbols.push("H");
    }

    const uniqueSymbols = new Set(neighborSymbols);

    if (uniqueSymbols.size >= 3) {
      count++;
    }
  }

  return count;
}

/**
 * Get the maximum Gasteiger partial charge in the molecule.
 * Uses Gasteiger-Marsili electronegativity equalization method.
 * Matches RDKit's MaxPartialCharge descriptor.
 *
 * @param mol - Molecule to analyze
 * @param nIter - Number of Gasteiger iterations (default 12)
 * @returns Maximum partial charge value
 *
 * @example
 * getMaxPartialCharge(parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0]) // ~0.339 (aspirin)
 */
export function getMaxPartialCharge(mol: Molecule, nIter = 12): number {
  const enriched = enrichMolecule(mol);
  const { computeGasteigerCharges } = require("./gasteiger-charges");
  const charges = computeGasteigerCharges(enriched, nIter);

  if (charges.length === 0) return 0;

  return Math.max(...charges);
}

/**
 * Get the minimum Gasteiger partial charge in the molecule.
 * Uses Gasteiger-Marsili electronegativity equalization method.
 * Matches RDKit's MinPartialCharge descriptor.
 *
 * @param mol - Molecule to analyze
 * @param nIter - Number of Gasteiger iterations (default 12)
 * @returns Minimum partial charge value
 *
 * @example
 * getMinPartialCharge(parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0]) // ~-0.478 (aspirin)
 */
export function getMinPartialCharge(mol: Molecule, nIter = 12): number {
  const enriched = enrichMolecule(mol);
  const { computeGasteigerCharges } = require("./gasteiger-charges");
  const charges = computeGasteigerCharges(enriched, nIter);

  if (charges.length === 0) return 0;

  return Math.min(...charges);
}

/**
 * Get the maximum absolute Gasteiger partial charge in the molecule.
 * Uses Gasteiger-Marsili electronegativity equalization method.
 * Matches RDKit's MaxAbsPartialCharge descriptor.
 *
 * @param mol - Molecule to analyze
 * @param nIter - Number of Gasteiger iterations (default 12)
 * @returns Maximum absolute partial charge value
 *
 * @example
 * getMaxAbsPartialCharge(parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0]) // ~0.478 (aspirin)
 */
export function getMaxAbsPartialCharge(mol: Molecule, nIter = 12): number {
  const enriched = enrichMolecule(mol);
  const { computeGasteigerCharges } = require("./gasteiger-charges");
  const charges = computeGasteigerCharges(enriched, nIter);

  if (charges.length === 0) return 0;

  const absCharges = charges.map(Math.abs);
  return Math.max(...absCharges);
}

/**
 * Get the minimum absolute Gasteiger partial charge in the molecule.
 * Uses Gasteiger-Marsili electronegativity equalization method.
 * Matches RDKit's MinAbsPartialCharge descriptor.
 *
 * @param mol - Molecule to analyze
 * @param nIter - Number of Gasteiger iterations (default 12)
 * @returns Minimum absolute partial charge value
 *
 * @example
 * getMinAbsPartialCharge(parseSMILES('CC(=O)Oc1ccccc1C(=O)O').molecules[0]) // ~0.339 (aspirin)
 */
export function getMinAbsPartialCharge(mol: Molecule, nIter = 12): number {
  const enriched = enrichMolecule(mol);
  const { computeGasteigerCharges } = require("./gasteiger-charges");
  const charges = computeGasteigerCharges(enriched, nIter);

  if (charges.length === 0) return 0;

  const absCharges = charges.map(Math.abs);
  return Math.min(...absCharges);
}
