import type { Molecule, Atom, Bond } from "types";
import { BondType } from "types";

export interface TransformationSite {
  type:
    | "keto-enol"
    | "enol-keto"
    | "thione-enethiol"
    | "enethiol-thione"
    | "lactam-lactim"
    | "amino-imine"
    | "amidine"
    | "imine-enamine"
    | "nitroso-oxime"
    | "amide-imidol"
    | "nitro-aci"
    | "aromatic-h-shift"
    | "furanone"
    | "keten-ynol"
    | "cyano-isocyanic"
    | "oxime-phenol"
    | "phosphonic-acid"
    | "formamidine-sulfinic"
    | "isocyanide"
    | "special-imine";
  atoms: number[];
  canTransform: boolean;
  priority: number;
  metadata?: Record<string, unknown>;
}

const debugSites = !!process.env.OPENCHEM_DEBUG_TAUTOMER;

function _hasAromaticRing(mol: Molecule): boolean {
  if (!mol.rings || mol.rings.length === 0) return false;
  for (const ring of mol.rings) {
    const ringAtoms = ring.map((id) => mol.atoms.find((a) => a.id === id));
    const allAromatic = ringAtoms.every((a) => a?.aromatic === true);
    if (allAromatic) return true;
  }
  return false;
}

function isAtomInAromaticRing(atom: Atom, mol: Molecule): boolean {
  if (!atom.aromatic) return false;
  if (!mol.rings || mol.rings.length === 0) return false;

  for (const ring of mol.rings) {
    if (!ring.includes(atom.id)) continue;
    const ringAtoms = ring.map((id) => mol.atoms.find((a) => a.id === id));
    const allAromatic = ringAtoms.every((a) => a?.aromatic === true);
    if (allAromatic) return true;
  }
  return false;
}

function _findBondBetween(mol: Molecule, atomId1: number, atomId2: number): Bond | null {
  return (
    mol.bonds.find(
      (b) =>
        (b.atom1 === atomId1 && b.atom2 === atomId2) ||
        (b.atom1 === atomId2 && b.atom2 === atomId1),
    ) ?? null
  );
}

export function detectKetoEnolSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: C=O with alpha carbon that has H
  for (let cIdx = 0; cIdx < mol.atoms.length; cIdx++) {
    const carbonyl = mol.atoms[cIdx];
    if (!carbonyl || carbonyl.symbol !== "C") continue;

    // Find C=O double bond
    const bonds = mol.bonds.filter((b) => b.atom1 === carbonyl.id || b.atom2 === carbonyl.id);

    for (const bond of bonds) {
      if (bond.type !== BondType.DOUBLE) continue;

      const otherId = bond.atom1 === carbonyl.id ? bond.atom2 : bond.atom1;
      const otherIdx = mol.atoms.findIndex((a) => a.id === otherId);
      if (otherIdx === -1) continue;

      const oxygen = mol.atoms[otherIdx];
      if (!oxygen || oxygen.symbol !== "O") continue;

      // Found C=O, now look for alpha carbon with H
      const alphaNeighbors = bonds
        .filter((b) => b !== bond && b.type === BondType.SINGLE)
        .map((b) => (b.atom1 === carbonyl.id ? b.atom2 : b.atom1))
        .map((id) => mol.atoms.findIndex((a) => a.id === id))
        .filter((idx) => idx !== -1);

      for (const alphaIdx of alphaNeighbors) {
        const alpha = mol.atoms[alphaIdx];
        if (!alpha || alpha.symbol !== "C") continue;
        if ((alpha.hydrogens ?? 0) === 0) continue;

        // Check if alpha carbon already has a C=C double bond (would create allene)
        const alphaBonds = mol.bonds.filter((b) => b.atom1 === alpha.id || b.atom2 === alpha.id);
        const alphaHasDoubleBondToCarbon = alphaBonds.some((b) => {
          if (b.type !== BondType.DOUBLE) return false;
          const neighborId = b.atom1 === alpha.id ? b.atom2 : b.atom1;
          const neighbor = mol.atoms.find((a) => a.id === neighborId);
          return neighbor?.symbol === "C";
        });
        if (alphaHasDoubleBondToCarbon) continue; // Skip - would create allene

        // Check if transformation would break aromaticity
        const wouldBreakAromatic =
          isAtomInAromaticRing(carbonyl, mol) || isAtomInAromaticRing(alpha, mol);

        sites.push({
          type: "keto-enol",
          atoms: [cIdx, otherIdx, alphaIdx], // [carbonyl C, O, alpha C]
          canTransform: !wouldBreakAromatic,
          priority: 100,
          metadata: { carbonyl: cIdx, oxygen: otherIdx, alpha: alphaIdx },
        });
      }
    }
  }

  return sites;
}

export function detectEnolKetoSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: C=C(OH) - enol form
  for (let alphaIdx = 0; alphaIdx < mol.atoms.length; alphaIdx++) {
    const alphaC = mol.atoms[alphaIdx];
    if (!alphaC || alphaC.symbol !== "C") continue;

    // Find C=C double bonds
    const bonds = mol.bonds.filter(
      (b) => (b.atom1 === alphaC.id || b.atom2 === alphaC.id) && b.type === BondType.DOUBLE,
    );

    for (const doubleBond of bonds) {
      const betaId = doubleBond.atom1 === alphaC.id ? doubleBond.atom2 : doubleBond.atom1;
      const betaIdx = mol.atoms.findIndex((a) => a.id === betaId);
      if (betaIdx === -1) continue;

      const betaC = mol.atoms[betaIdx];
      if (!betaC || betaC.symbol !== "C") continue;

      // Check if beta carbon has OH
      const betaBonds = mol.bonds.filter(
        (b) => (b.atom1 === betaC.id || b.atom2 === betaC.id) && b.type === BondType.SINGLE,
      );

      for (const ohBond of betaBonds) {
        const oId = ohBond.atom1 === betaC.id ? ohBond.atom2 : ohBond.atom1;
        const oIdx = mol.atoms.findIndex((a) => a.id === oId);
        if (oIdx === -1) continue;

        const oxygen = mol.atoms[oIdx];
        if (!oxygen || oxygen.symbol !== "O") continue;
        if ((oxygen.hydrogens ?? 0) === 0) continue; // Must have H

        // Check if transformation would break aromaticity
        const wouldBreakAromatic =
          isAtomInAromaticRing(alphaC, mol) || isAtomInAromaticRing(betaC, mol);

        sites.push({
          type: "enol-keto",
          atoms: [alphaIdx, betaIdx, oIdx], // [alpha C, beta C, OH]
          canTransform: !wouldBreakAromatic,
          priority: 100,
          metadata: { alpha: alphaIdx, beta: betaIdx, oxygen: oIdx },
        });
      }
    }
  }

  // Also detect: C-OH (non-aromatic) with adjacent C that has H
  // This handles partially ketonized forms like OC1CCC(=O)CC1
  // DISABLED: This creates chemically invalid transformations (allenes)
  // The standard enol-keto detection should handle proper C=C-OH patterns
  /*
  for (let cIdx = 0; cIdx < mol.atoms.length; cIdx++) {
    const carbon = mol.atoms[cIdx];
    if (!carbon || carbon.symbol !== "C") continue;

    // Skip if carbon is aromatic (handled by phenol-quinone detector)
    if (carbon.aromatic) continue;

    // Find C-O single bonds
    const bonds = mol.bonds.filter(
      (b) => (b.atom1 === carbon.id || b.atom2 === carbon.id) && b.type === BondType.SINGLE,
    );

    let oIdx = -1;
    for (const bond of bonds) {
      const atomId = bond.atom1 === carbon.id ? bond.atom2 : bond.atom1;
      const atomIdx = mol.atoms.findIndex((a) => a.id === atomId);
      if (atomIdx === -1) continue;

      const atom = mol.atoms[atomIdx];
      if (atom && atom.symbol === "O" && (atom.hydrogens ?? 0) > 0) {
        oIdx = atomIdx;
        break;
      }
    }

    if (oIdx === -1) continue; // No OH group

    // Find adjacent carbon with H
    for (const bond of bonds) {
      const adjId = bond.atom1 === carbon.id ? bond.atom2 : bond.atom1;
      const adjIdx = mol.atoms.findIndex((a) => a.id === adjId);
      if (adjIdx === -1) continue;

      const adjCarbon = mol.atoms[adjIdx];
      if (!adjCarbon || adjCarbon.symbol !== "C") continue;
      if ((adjCarbon.hydrogens ?? 0) === 0) continue; // Need H

      // Don't create sites that would break aromaticity
      if (isAtomInAromaticRing(carbon, mol) || isAtomInAromaticRing(adjCarbon, mol)) {
        continue;
      }

      // This is a valid C-OH + C-H → C=O + C-H2 transformation
      sites.push({
        type: "keto-enol", // Use keto-enol type for the reverse transform
        atoms: [cIdx, oIdx, adjIdx], // [C with OH, O, adjacent C with H]
        canTransform: true,
        priority: 95,
        metadata: {
          carbon: cIdx,
          oxygen: oIdx,
          adjacentCarbon: adjIdx,
          isSecondaryOH: true,
        },
      });
    }
  }
  */

  return sites;
}

export function detectThioneEnethiolSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: C=S with alpha carbon that has H (thione → enethiol)
  // Similar to keto-enol but with sulfur
  for (let cIdx = 0; cIdx < mol.atoms.length; cIdx++) {
    const thiocarbonyl = mol.atoms[cIdx];
    if (!thiocarbonyl || thiocarbonyl.symbol !== "C") continue;

    // Find C=S double bond
    const bonds = mol.bonds.filter(
      (b) => b.atom1 === thiocarbonyl.id || b.atom2 === thiocarbonyl.id,
    );

    for (const bond of bonds) {
      if (bond.type !== BondType.DOUBLE) continue;

      const otherId = bond.atom1 === thiocarbonyl.id ? bond.atom2 : bond.atom1;
      const otherIdx = mol.atoms.findIndex((a) => a.id === otherId);
      if (otherIdx === -1) continue;

      const sulfur = mol.atoms[otherIdx];
      if (!sulfur || sulfur.symbol !== "S") continue;

      // Found C=S, now look for alpha carbon with H
      const alphaNeighbors = bonds
        .filter((b) => b !== bond && b.type === BondType.SINGLE)
        .map((b) => (b.atom1 === thiocarbonyl.id ? b.atom2 : b.atom1))
        .map((id) => mol.atoms.findIndex((a) => a.id === id))
        .filter((idx) => idx !== -1);

      for (const alphaIdx of alphaNeighbors) {
        const alpha = mol.atoms[alphaIdx];
        if (!alpha || alpha.symbol !== "C") continue;
        if ((alpha.hydrogens ?? 0) === 0) continue;

        // Check if transformation would break aromaticity
        const wouldBreakAromatic =
          isAtomInAromaticRing(thiocarbonyl, mol) || isAtomInAromaticRing(alpha, mol);

        sites.push({
          type: "thione-enethiol",
          atoms: [cIdx, otherIdx, alphaIdx], // [thiocarbonyl C, S, alpha C]
          canTransform: !wouldBreakAromatic,
          priority: 95, // Similar priority to keto-enol
          metadata: { thiocarbonyl: cIdx, sulfur: otherIdx, alpha: alphaIdx },
        });
      }
    }
  }

  return sites;
}

export function detectEnethiolThioneSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: C=C-SH (enethiol → thione)
  // Similar to enol-keto but with sulfur
  for (let alphaIdx = 0; alphaIdx < mol.atoms.length; alphaIdx++) {
    const alphaC = mol.atoms[alphaIdx];
    if (!alphaC || alphaC.symbol !== "C") continue;

    // Find C=C double bonds
    const bonds = mol.bonds.filter(
      (b) => (b.atom1 === alphaC.id || b.atom2 === alphaC.id) && b.type === BondType.DOUBLE,
    );

    for (const doubleBond of bonds) {
      const betaId = doubleBond.atom1 === alphaC.id ? doubleBond.atom2 : doubleBond.atom1;
      const betaIdx = mol.atoms.findIndex((a) => a.id === betaId);
      if (betaIdx === -1) continue;

      const betaC = mol.atoms[betaIdx];
      if (!betaC || betaC.symbol !== "C") continue;

      // Check if beta carbon has SH
      const betaBonds = mol.bonds.filter(
        (b) => (b.atom1 === betaC.id || b.atom2 === betaC.id) && b.type === BondType.SINGLE,
      );

      for (const shBond of betaBonds) {
        const sId = shBond.atom1 === betaC.id ? shBond.atom2 : shBond.atom1;
        const sIdx = mol.atoms.findIndex((a) => a.id === sId);
        if (sIdx === -1) continue;

        const sulfur = mol.atoms[sIdx];
        if (!sulfur || sulfur.symbol !== "S") continue;
        if ((sulfur.hydrogens ?? 0) === 0) continue; // Must have H

        // Check if transformation would break aromaticity
        const wouldBreakAromatic =
          isAtomInAromaticRing(alphaC, mol) || isAtomInAromaticRing(betaC, mol);

        sites.push({
          type: "enethiol-thione",
          atoms: [alphaIdx, betaIdx, sIdx], // [alpha C, beta C (has SH), S]
          canTransform: !wouldBreakAromatic,
          priority: 95,
          metadata: { alpha: alphaIdx, beta: betaIdx, sulfur: sIdx },
        });
      }
    }
  }

  return sites;
}

export function detectLactamLactimSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: N-C=O (lactam)
  for (let nIdx = 0; nIdx < mol.atoms.length; nIdx++) {
    const nitrogen = mol.atoms[nIdx];
    if (!nitrogen || nitrogen.symbol !== "N") continue;
    if ((nitrogen.hydrogens ?? 0) === 0) continue; // Must have H

    const nBonds = mol.bonds.filter((b) => b.atom1 === nitrogen.id || b.atom2 === nitrogen.id);

    for (const nBond of nBonds) {
      if (nBond.type !== BondType.SINGLE) continue;

      const cId = nBond.atom1 === nitrogen.id ? nBond.atom2 : nBond.atom1;
      const cIdx = mol.atoms.findIndex((a) => a.id === cId);
      if (cIdx === -1) continue;

      const carbon = mol.atoms[cIdx];
      if (!carbon || carbon.symbol !== "C") continue;

      // Check if this carbon has C=O
      const cBonds = mol.bonds.filter((b) => b.atom1 === carbon.id || b.atom2 === carbon.id);

      for (const coBond of cBonds) {
        if (coBond.type !== BondType.DOUBLE) continue;

        const oId = coBond.atom1 === carbon.id ? coBond.atom2 : coBond.atom1;
        const oIdx = mol.atoms.findIndex((a) => a.id === oId);
        if (oIdx === -1) continue;

        const oxygen = mol.atoms[oIdx];
        if (!oxygen || oxygen.symbol !== "O") continue;

        // In heterocyclic systems (like guanine, uracil), lactam-lactim tautomerism
        // is valid even when N and C are aromatic, as long as O is exocyclic.
        // Only block if oxygen is part of the aromatic ring (rare).
        const oxygenInAromaticRing = isAtomInAromaticRing(oxygen, mol);

        sites.push({
          type: "lactam-lactim",
          atoms: [nIdx, cIdx, oIdx], // [N, C, O]
          canTransform: !oxygenInAromaticRing,
          priority: 90,
          metadata: { nitrogen: nIdx, carbon: cIdx, oxygen: oIdx },
        });
      }
    }
  }

  return sites;
}

export function detectAminoImineSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: N-C with N having H and C having H
  for (let nIdx = 0; nIdx < mol.atoms.length; nIdx++) {
    const nitrogen = mol.atoms[nIdx];
    if (!nitrogen || nitrogen.symbol !== "N") continue;
    if ((nitrogen.hydrogens ?? 0) < 2) continue; // Need at least 2 H (NH2)

    // Nitrogen itself should not be aromatic (e.g., in pyrrole)
    if (nitrogen.aromatic) continue;

    const nBonds = mol.bonds.filter(
      (b) => (b.atom1 === nitrogen.id || b.atom2 === nitrogen.id) && b.type === BondType.SINGLE,
    );

    for (const nBond of nBonds) {
      const cId = nBond.atom1 === nitrogen.id ? nBond.atom2 : nBond.atom1;
      const cIdx = mol.atoms.findIndex((a) => a.id === cId);
      if (cIdx === -1) continue;

      const carbon = mol.atoms[cIdx];
      if (!carbon || carbon.symbol !== "C") continue;
      if ((carbon.hydrogens ?? 0) === 0) continue; // Need H on carbon

      // Carbon CAN be aromatic (e.g., aniline Nc1ccccc1)
      // The transformation NH2-C(aromatic)-H -> NH=C(aromatic) is allowed
      // We just need to check if nitrogen becomes aromatic (which is fine)

      // Check if there's conjugation that would be disrupted
      const hasConjugation = mol.bonds.some((b) => {
        if (b.type !== BondType.DOUBLE) return false;
        return b.atom1 === carbon.id || b.atom2 === carbon.id;
      });

      sites.push({
        type: "amino-imine",
        atoms: [nIdx, cIdx], // [N, C]
        canTransform: true, // Allow aromatic carbons
        priority: hasConjugation ? 95 : 80,
        metadata: { nitrogen: nIdx, carbon: cIdx, hasConjugation },
      });
    }
  }

  return sites;
}

export function detectAmidineSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: N(-H)-C=N (amidine) - H migrates between the two nitrogens
  // This covers patterns like: NH2-C=N ↔ NH=C-NH (guanidine, amidines)
  // Also covers heterocyclic patterns in guanine, adenine, cytosine, etc.

  for (let n1Idx = 0; n1Idx < mol.atoms.length; n1Idx++) {
    const nitrogen1 = mol.atoms[n1Idx];
    if (!nitrogen1 || nitrogen1.symbol !== "N") continue;
    if ((nitrogen1.hydrogens ?? 0) === 0) continue; // Must have H to donate

    // Find N-C bonds
    const n1Bonds = mol.bonds.filter((b) => b.atom1 === nitrogen1.id || b.atom2 === nitrogen1.id);

    for (const n1Bond of n1Bonds) {
      // N-C can be single or aromatic
      if (n1Bond.type !== BondType.SINGLE && n1Bond.type !== BondType.AROMATIC) continue;

      const cId = n1Bond.atom1 === nitrogen1.id ? n1Bond.atom2 : n1Bond.atom1;
      const cIdx = mol.atoms.findIndex((a) => a.id === cId);
      if (cIdx === -1) continue;

      const carbon = mol.atoms[cIdx];
      if (!carbon || carbon.symbol !== "C") continue;

      // Find C=N or C-N(aromatic) bonds to another nitrogen
      const cBonds = mol.bonds.filter(
        (b) => (b.atom1 === carbon.id || b.atom2 === carbon.id) && b !== n1Bond,
      );

      for (const cnBond of cBonds) {
        // Look for C=N double bond or aromatic C-N
        if (cnBond.type !== BondType.DOUBLE && cnBond.type !== BondType.AROMATIC) continue;

        const n2Id = cnBond.atom1 === carbon.id ? cnBond.atom2 : cnBond.atom1;
        const n2Idx = mol.atoms.findIndex((a) => a.id === n2Id);
        if (n2Idx === -1) continue;

        const nitrogen2 = mol.atoms[n2Idx];
        if (!nitrogen2 || nitrogen2.symbol !== "N") continue;
        if (n2Idx === n1Idx) continue; // Can't be the same nitrogen

        // Check if N2 can accept a hydrogen
        // N2 should be sp2 (in C=N) or aromatic without too many H
        const n2Hydrogens = nitrogen2.hydrogens ?? 0;
        if (n2Hydrogens >= 2) continue; // Already has max H for this pattern

        // Valid amidine site: H can move from N1 to N2
        sites.push({
          type: "amidine",
          atoms: [n1Idx, cIdx, n2Idx], // [N-donor, C, N-acceptor]
          canTransform: true,
          priority: 85,
          metadata: {
            donor: n1Idx,
            carbon: cIdx,
            acceptor: n2Idx,
            donorH: nitrogen1.hydrogens,
            acceptorH: n2Hydrogens,
          },
        });
      }
    }
  }

  return sites;
}

export function detectImineEnamineSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: C=N (imine)
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.DOUBLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    let nIdx = -1;
    let cIdx = -1;

    if (atom1.symbol === "N" && atom2.symbol === "C") {
      nIdx = atom1Idx;
      cIdx = atom2Idx;
    } else if (atom2.symbol === "N" && atom1.symbol === "C") {
      nIdx = atom2Idx;
      cIdx = atom1Idx;
    } else {
      continue;
    }

    const nitrogen = mol.atoms[nIdx];
    const carbon = mol.atoms[cIdx];
    if (!nitrogen || !carbon) continue;

    // Find alpha carbon (carbon with H adjacent to C=N)
    const cBonds = mol.bonds.filter(
      (b) =>
        (b.atom1 === carbon.id || b.atom2 === carbon.id) &&
        b !== bond &&
        b.type === BondType.SINGLE,
    );

    for (const cBond of cBonds) {
      const alphaId = cBond.atom1 === carbon.id ? cBond.atom2 : cBond.atom1;
      const alphaIdx = mol.atoms.findIndex((a) => a.id === alphaId);
      if (alphaIdx === -1) continue;

      const alpha = mol.atoms[alphaIdx];
      if (!alpha || alpha.symbol !== "C") continue;
      if ((alpha.hydrogens ?? 0) === 0) continue;

      // Check if alpha carbon already has a C=C double bond (would create allene)
      // The transformation changes C-alpha to C=alpha, so if alpha already has a double bond to another C, skip
      const alphaBonds = mol.bonds.filter((b) => b.atom1 === alpha.id || b.atom2 === alpha.id);
      const alphaHasDoubleBondToCarbon = alphaBonds.some((b) => {
        if (b.type !== BondType.DOUBLE) return false;
        const neighborId = b.atom1 === alpha.id ? b.atom2 : b.atom1;
        const neighbor = mol.atoms.find((a) => a.id === neighborId);
        return neighbor?.symbol === "C";
      });
      if (alphaHasDoubleBondToCarbon) continue; // Skip - would create allene

      // Check if transformation would break aromaticity
      const wouldBreakAromatic =
        isAtomInAromaticRing(nitrogen, mol) ||
        isAtomInAromaticRing(carbon, mol) ||
        isAtomInAromaticRing(alpha, mol);

      sites.push({
        type: "imine-enamine",
        atoms: [nIdx, cIdx, alphaIdx], // [N, C, alpha C]
        canTransform: !wouldBreakAromatic,
        priority: 85,
        metadata: { nitrogen: nIdx, carbon: cIdx, alpha: alphaIdx },
      });
    }
  }

  return sites;
}

export function detectNitrosoOximeSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: N=O (nitroso) with adjacent carbon that has H
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.DOUBLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    let nIdx = -1;
    let oIdx = -1;

    if (atom1.symbol === "N" && atom2.symbol === "O") {
      nIdx = atom1Idx;
      oIdx = atom2Idx;
    } else if (atom2.symbol === "N" && atom1.symbol === "O") {
      nIdx = atom2Idx;
      oIdx = atom1Idx;
    } else {
      continue;
    }

    const nitrogen = mol.atoms[nIdx];
    if (!nitrogen) continue;

    // Find carbon adjacent to N
    const nBonds = mol.bonds.filter(
      (b) =>
        (b.atom1 === nitrogen.id || b.atom2 === nitrogen.id) &&
        b !== bond &&
        b.type === BondType.SINGLE,
    );

    for (const nBond of nBonds) {
      const cId = nBond.atom1 === nitrogen.id ? nBond.atom2 : nBond.atom1;
      const cIdx = mol.atoms.findIndex((a) => a.id === cId);
      if (cIdx === -1) continue;

      const carbon = mol.atoms[cIdx];
      if (!carbon || carbon.symbol !== "C") continue;
      if ((carbon.hydrogens ?? 0) === 0) continue;

      // Check if transformation would break aromaticity
      const wouldBreakAromatic =
        isAtomInAromaticRing(nitrogen, mol) || isAtomInAromaticRing(carbon, mol);

      sites.push({
        type: "nitroso-oxime",
        atoms: [nIdx, oIdx, cIdx], // [N, O, C]
        canTransform: !wouldBreakAromatic,
        priority: 70,
        metadata: { nitrogen: nIdx, oxygen: oIdx, carbon: cIdx },
      });
    }
  }

  return sites;
}

export function areSitesCompatible(site1: TransformationSite, site2: TransformationSite): boolean {
  // Two sites are incompatible if they share any atoms
  const atoms1 = new Set(site1.atoms);
  const atoms2 = new Set(site2.atoms);

  for (const atom of atoms1) {
    if (atoms2.has(atom)) {
      return false;
    }
  }

  return true;
}

export function getCompatibleSiteCombinations(sites: TransformationSite[]): number[] {
  const validMasks: number[] = [];
  const totalCombinations = Math.pow(2, sites.length);

  for (let mask = 0; mask < totalCombinations; mask++) {
    const selectedSites: TransformationSite[] = [];

    for (let i = 0; i < sites.length; i++) {
      if (mask & (1 << i)) {
        selectedSites.push(sites[i] as TransformationSite);
      }
    }

    // Check if all selected sites are pairwise compatible
    let allCompatible = true;
    for (let i = 0; i < selectedSites.length; i++) {
      for (let j = i + 1; j < selectedSites.length; j++) {
        const site1 = selectedSites[i];
        const site2 = selectedSites[j];
        if (site1 && site2 && !areSitesCompatible(site1, site2)) {
          allCompatible = false;
          break;
        }
      }
      if (!allCompatible) break;
    }

    if (allCompatible) {
      validMasks.push(mask);
    }
  }

  if (debugSites && validMasks.length < totalCombinations) {
    console.debug(
      `[site-detector] Filtered ${totalCombinations} combinations to ${validMasks.length} compatible ones`,
    );
  }

  return validMasks;
}

export function detectPhenolQuinoneSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: Aromatic OH (phenol) that can become quinone C=O
  // Look for O-H attached to aromatic carbon
  for (let oIdx = 0; oIdx < mol.atoms.length; oIdx++) {
    const oxygen = mol.atoms[oIdx];
    if (!oxygen || oxygen.symbol !== "O") continue;
    if ((oxygen.hydrogens ?? 0) === 0) continue; // Need OH

    // Find carbon attached to oxygen
    const bonds = mol.bonds.filter(
      (b) => (b.atom1 === oxygen.id || b.atom2 === oxygen.id) && b.type === BondType.SINGLE,
    );

    for (const bond of bonds) {
      const cId = bond.atom1 === oxygen.id ? bond.atom2 : bond.atom1;
      const cIdx = mol.atoms.findIndex((a) => a.id === cId);
      if (cIdx === -1) continue;

      const carbon = mol.atoms[cIdx];
      if (!carbon || carbon.symbol !== "C") continue;

      // Check if carbon is aromatic (part of aromatic ring)
      if (!carbon.aromatic) continue;
      if (!isAtomInAromaticRing(carbon, mol)) continue;

      // Find an adjacent aromatic carbon in the ring that has H
      const cBonds = mol.bonds.filter(
        (b) => (b.atom1 === carbon.id || b.atom2 === carbon.id) && b.type === BondType.AROMATIC,
      );

      for (const cBond of cBonds) {
        const adjCId = cBond.atom1 === carbon.id ? cBond.atom2 : cBond.atom1;
        const adjCIdx = mol.atoms.findIndex((a) => a.id === adjCId);
        if (adjCIdx === -1) continue;

        const adjCarbon = mol.atoms[adjCIdx];
        if (!adjCarbon || adjCarbon.symbol !== "C") continue;
        if ((adjCarbon.hydrogens ?? 0) === 0) continue; // Need H on adjacent carbon

        // This is a valid phenol → quinone transformation
        // O-H on aromatic carbon, adjacent carbon has H
        // Transform: Ar-OH + Ar-H → Ar=O + Ar-H2
        sites.push({
          type: "keto-enol", // Reuse keto-enol type
          atoms: [cIdx, oIdx, adjCIdx], // [aromatic C, O, adjacent C with H]
          canTransform: true,
          priority: 85, // High priority for aromatic systems
          metadata: {
            aromaticCarbon: cIdx,
            oxygen: oIdx,
            adjacentCarbon: adjCIdx,
            isPhenolQuinone: true,
          },
        });
      }
    }
  }

  return sites;
}

export function detect15KetoEnolSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: C=O with gamma carbon (4 bonds away) that has H
  // C(=O)-C=C-C-H → C(OH)=C-C=C
  for (let cIdx = 0; cIdx < mol.atoms.length; cIdx++) {
    const carbonyl = mol.atoms[cIdx];
    if (!carbonyl || carbonyl.symbol !== "C") continue;

    // Find C=O double bond
    const bonds = mol.bonds.filter((b) => b.atom1 === carbonyl.id || b.atom2 === carbonyl.id);

    for (const bond of bonds) {
      if (bond.type !== BondType.DOUBLE) continue;

      const otherId = bond.atom1 === carbonyl.id ? bond.atom2 : bond.atom1;
      const otherIdx = mol.atoms.findIndex((a) => a.id === otherId);
      if (otherIdx === -1) continue;

      const oxygen = mol.atoms[otherIdx];
      if (!oxygen || oxygen.symbol !== "O") continue;

      // Found C=O, now look for conjugated path: C=O-C=C-C-H
      // Find beta carbons (adjacent to carbonyl, not O)
      const betaNeighbors = bonds
        .filter((b) => b !== bond && b.type === BondType.SINGLE)
        .map((b) => (b.atom1 === carbonyl.id ? b.atom2 : b.atom1))
        .map((id) => mol.atoms.findIndex((a) => a.id === id))
        .filter((idx) => idx !== -1);

      for (const betaIdx of betaNeighbors) {
        const beta = mol.atoms[betaIdx];
        if (!beta || beta.symbol !== "C") continue;

        // Find gamma carbons connected by double bond
        const betaBonds = mol.bonds.filter((b) => b.atom1 === beta.id || b.atom2 === beta.id);

        for (const betaBond of betaBonds) {
          if (betaBond.type !== BondType.DOUBLE) continue;

          const gammaId = betaBond.atom1 === beta.id ? betaBond.atom2 : betaBond.atom1;
          const gammaIdx = mol.atoms.findIndex((a) => a.id === gammaId);
          if (gammaIdx === -1) continue;

          const gamma = mol.atoms[gammaIdx];
          if (!gamma || gamma.symbol !== "C") continue;

          // Find delta carbons (4th carbon with H)
          const gammaBonds = mol.bonds.filter(
            (b) => (b.atom1 === gamma.id || b.atom2 === gamma.id) && b.type === BondType.SINGLE,
          );

          for (const gammaBond of gammaBonds) {
            const deltaId = gammaBond.atom1 === gamma.id ? gammaBond.atom2 : gammaBond.atom1;
            const deltaIdx = mol.atoms.findIndex((a) => a.id === deltaId);
            if (deltaIdx === -1) continue;

            const delta = mol.atoms[deltaIdx];
            if (!delta || delta.symbol !== "C") continue;
            if ((delta.hydrogens ?? 0) === 0) continue;

            // Check if delta carbon already has a C=C double bond to another carbon (not gamma)
            // This would create an allene when we add gamma=delta
            const deltaBonds = mol.bonds.filter(
              (b) => b.atom1 === delta.id || b.atom2 === delta.id,
            );
            const deltaHasOtherDoubleBondToCarbon = deltaBonds.some((b) => {
              if (b.type !== BondType.DOUBLE) return false;
              const neighborId = b.atom1 === delta.id ? b.atom2 : b.atom1;
              if (neighborId === gamma.id) return false; // Ignore gamma-delta bond (doesn't exist yet as double)
              const neighbor = mol.atoms.find((a) => a.id === neighborId);
              return neighbor?.symbol === "C";
            });
            if (deltaHasOtherDoubleBondToCarbon) continue; // Skip - would create allene

            // Check if transformation would break aromaticity
            const wouldBreakAromatic =
              isAtomInAromaticRing(carbonyl, mol) ||
              isAtomInAromaticRing(beta, mol) ||
              isAtomInAromaticRing(gamma, mol) ||
              isAtomInAromaticRing(delta, mol);

            sites.push({
              type: "keto-enol",
              atoms: [cIdx, otherIdx, betaIdx, gammaIdx, deltaIdx], // [C=O, O, beta, gamma, delta]
              canTransform: !wouldBreakAromatic,
              priority: 95,
              metadata: {
                carbonyl: cIdx,
                oxygen: otherIdx,
                beta: betaIdx,
                gamma: gammaIdx,
                delta: deltaIdx,
                is15KetoEnol: true,
              },
            });
          }
        }
      }
    }
  }

  return sites;
}

export function detectAromaticHeteroatomHShift(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: Aromatic heteroatom H-shift (1,3 or 1,5 shift in aromatic systems)
  // Example: [nH]-c=n <-> n=c-[nH] (for heterocycles like uric acid)
  // This transformation moves H between aromatic nitrogens through the conjugated system

  for (let donorIdx = 0; donorIdx < mol.atoms.length; donorIdx++) {
    const donor = mol.atoms[donorIdx];
    if (!donor) continue;

    // Donor must be aromatic heteroatom with H (N, O, S)
    if (!donor.aromatic) continue;
    if (!["N", "O", "S"].includes(donor.symbol)) continue;
    if ((donor.hydrogens ?? 0) === 0) continue;

    // Find aromatic neighbors
    const donorBonds = mol.bonds.filter(
      (b) =>
        (b.atom1 === donor.id || b.atom2 === donor.id) &&
        (b.type === BondType.AROMATIC || b.type === BondType.SINGLE || b.type === BondType.DOUBLE),
    );

    for (const bond1 of donorBonds) {
      const bridgeId = bond1.atom1 === donor.id ? bond1.atom2 : bond1.atom1;
      const bridgeIdx = mol.atoms.findIndex((a) => a.id === bridgeId);
      if (bridgeIdx === -1) continue;

      const bridge = mol.atoms[bridgeIdx];
      if (!bridge || !bridge.aromatic) continue;

      // Find acceptor atoms through the bridge
      const bridgeBonds = mol.bonds.filter(
        (b) =>
          (b.atom1 === bridge.id || b.atom2 === bridge.id) &&
          b.atom1 !== donor.id &&
          b.atom2 !== donor.id &&
          (b.type === BondType.AROMATIC ||
            b.type === BondType.SINGLE ||
            b.type === BondType.DOUBLE),
      );

      for (const bond2 of bridgeBonds) {
        const acceptorId = bond2.atom1 === bridge.id ? bond2.atom2 : bond2.atom1;
        const acceptorIdx = mol.atoms.findIndex((a) => a.id === acceptorId);
        if (acceptorIdx === -1) continue;

        const acceptor = mol.atoms[acceptorIdx];
        if (!acceptor || !acceptor.aromatic) continue;

        // Acceptor must be heteroatom (can have or not have H)
        if (!["N", "O", "S"].includes(acceptor.symbol)) continue;

        // Don't shift to same atom
        if (donorIdx === acceptorIdx) continue;

        // This is a valid 1,3-shift: donor-[nH]--bridge--acceptor-n
        sites.push({
          type: "aromatic-h-shift",
          atoms: [donorIdx, bridgeIdx, acceptorIdx], // [donor with H, bridge, acceptor]
          canTransform: true,
          priority: 85, // High priority for aromatic systems
          metadata: {
            donor: donorIdx,
            bridge: bridgeIdx,
            acceptor: acceptorIdx,
            shiftType: "1,3",
          },
        });

        // Also look for 1,5-shifts (through 2 bridges)
        const bridge2Bonds = mol.bonds.filter(
          (b) =>
            (b.atom1 === acceptor.id || b.atom2 === acceptor.id) &&
            b.atom1 !== bridge.id &&
            b.atom2 !== bridge.id &&
            (b.type === BondType.AROMATIC ||
              b.type === BondType.SINGLE ||
              b.type === BondType.DOUBLE),
        );

        for (const bond3 of bridge2Bonds) {
          const acceptor2Id = bond3.atom1 === acceptor.id ? bond3.atom2 : bond3.atom1;
          const acceptor2Idx = mol.atoms.findIndex((a) => a.id === acceptor2Id);
          if (acceptor2Idx === -1) continue;

          const acceptor2 = mol.atoms[acceptor2Idx];
          if (!acceptor2 || !acceptor2.aromatic) continue;
          if (!["N", "O", "S"].includes(acceptor2.symbol)) continue;
          if (donorIdx === acceptor2Idx) continue;

          sites.push({
            type: "aromatic-h-shift",
            atoms: [donorIdx, bridgeIdx, acceptorIdx, acceptor2Idx], // [donor, bridge1, bridge2, acceptor]
            canTransform: true,
            priority: 80, // Slightly lower priority for 1,5-shift
            metadata: {
              donor: donorIdx,
              bridge1: bridgeIdx,
              bridge2: acceptorIdx,
              acceptor: acceptor2Idx,
              shiftType: "1,5",
            },
          });
        }
      }
    }
  }

  return sites;
}

export function detectFuranoneSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: 5-membered ring with O/S/N-H that can tautomerize
  // [O,S,N;!H0]-[#6z2r5]=,:[#6X3r5]
  if (!mol.rings || mol.rings.length === 0) return sites;

  for (const ring of mol.rings) {
    if (ring.length !== 5) continue;

    // Check each atom in the ring
    for (let i = 0; i < ring.length; i++) {
      const atomId = ring[i];
      if (atomId === undefined) continue;

      const atomIdx = mol.atoms.findIndex((a) => a.id === atomId);
      if (atomIdx === -1) continue;

      const heteroatom = mol.atoms[atomIdx];
      if (!heteroatom) continue;

      // Must be O, S, or N with H
      if (!["O", "S", "N"].includes(heteroatom.symbol)) continue;
      if ((heteroatom.hydrogens ?? 0) === 0) continue;

      // Find adjacent carbon in ring
      const nextIdx = (i + 1) % ring.length;
      const nextId = ring[nextIdx];
      if (nextId === undefined) continue;

      const carbonIdx = mol.atoms.findIndex((a) => a.id === nextId);
      if (carbonIdx === -1) continue;

      const carbon = mol.atoms[carbonIdx];
      if (!carbon || carbon.symbol !== "C") continue;

      // Find the carbon 2 positions away (with double bond potential)
      const nextNextIdx = (i + 2) % ring.length;
      const nextNextId = ring[nextNextIdx];
      if (nextNextId === undefined) continue;

      const targetIdx = mol.atoms.findIndex((a) => a.id === nextNextId);
      if (targetIdx === -1) continue;

      const target = mol.atoms[targetIdx];
      if (!target || target.symbol !== "C") continue;
      if ((target.hydrogens ?? 0) === 0) continue;

      sites.push({
        type: "furanone",
        atoms: [atomIdx, carbonIdx, targetIdx],
        canTransform: true,
        priority: 75,
        metadata: { heteroatom: atomIdx, carbon1: carbonIdx, carbon2: targetIdx },
      });
    }
  }

  return sites;
}

export function detectKetenYnolSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Forward: [C!H0]=[C]=[O,S,Se,Te;X1] → triple bond
  // Reverse: [O,S,Se,Te;!H0X2]-[C]#[C] → allene
  for (let i = 0; i < mol.bonds.length; i++) {
    const bond1 = mol.bonds[i];
    if (!bond1 || bond1.type !== BondType.DOUBLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond1.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond1.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    // Look for C=C=X pattern
    if (atom1.symbol === "C" && atom2.symbol === "C") {
      // Check if one carbon has H
      const c1HasH = (atom1.hydrogens ?? 0) > 0;
      const c2HasH = (atom2.hydrogens ?? 0) > 0;

      if (!c1HasH && !c2HasH) continue;

      // Find the double bond to X
      const centerIdx = c1HasH ? atom2Idx : atom1Idx;
      const terminalIdx = c1HasH ? atom1Idx : atom2Idx;
      const center = mol.atoms[centerIdx];
      if (!center) continue;

      const centerBonds = mol.bonds.filter(
        (b) =>
          (b.atom1 === center.id || b.atom2 === center.id) &&
          b.type === BondType.DOUBLE &&
          b !== bond1,
      );

      for (const bond2 of centerBonds) {
        const xId = bond2.atom1 === center.id ? bond2.atom2 : bond2.atom1;
        const xIdx = mol.atoms.findIndex((a) => a.id === xId);
        if (xIdx === -1) continue;

        const x = mol.atoms[xIdx];
        if (!x || !["O", "S", "Se", "Te"].includes(x.symbol)) continue;

        sites.push({
          type: "keten-ynol",
          atoms: [terminalIdx, centerIdx, xIdx],
          canTransform: true,
          priority: 70,
          metadata: { direction: "forward", terminal: terminalIdx, center: centerIdx, x: xIdx },
        });
      }
    }
  }

  // Reverse direction: X-C#C
  for (let i = 0; i < mol.bonds.length; i++) {
    const bond = mol.bonds[i];
    if (!bond || bond.type !== BondType.TRIPLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    if (atom1.symbol !== "C" || atom2.symbol !== "C") continue;

    // Find X-C connection
    for (const c of [atom1, atom2]) {
      const cIdx = c === atom1 ? atom1Idx : atom2Idx;
      const otherCIdx = c === atom1 ? atom2Idx : atom1Idx;

      const cBonds = mol.bonds.filter(
        (b) => (b.atom1 === c.id || b.atom2 === c.id) && b.type === BondType.SINGLE && b !== bond,
      );

      for (const xBond of cBonds) {
        const xId = xBond.atom1 === c.id ? xBond.atom2 : xBond.atom1;
        const xIdx = mol.atoms.findIndex((a) => a.id === xId);
        if (xIdx === -1) continue;

        const x = mol.atoms[xIdx];
        if (!x || !["O", "S", "Se", "Te"].includes(x.symbol)) continue;
        if ((x.hydrogens ?? 0) === 0) continue;

        sites.push({
          type: "keten-ynol",
          atoms: [xIdx, cIdx, otherCIdx],
          canTransform: true,
          priority: 70,
          metadata: { direction: "reverse", x: xIdx, c1: cIdx, c2: otherCIdx },
        });
      }
    }
  }

  return sites;
}

export function detectCyanoIsocyanicSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Forward: [O!H0]-[C]#[N] → [N!H0]=[C]=[O]
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.TRIPLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    let cIdx = -1;
    let nIdx = -1;

    if (atom1.symbol === "C" && atom2.symbol === "N") {
      cIdx = atom1Idx;
      nIdx = atom2Idx;
    } else if (atom2.symbol === "C" && atom1.symbol === "N") {
      cIdx = atom2Idx;
      nIdx = atom1Idx;
    } else {
      continue;
    }

    const carbon = mol.atoms[cIdx];
    if (!carbon) continue;

    // Look for O-C#N
    const cBonds = mol.bonds.filter(
      (b) => (b.atom1 === carbon.id || b.atom2 === carbon.id) && b.type === BondType.SINGLE,
    );

    for (const oBond of cBonds) {
      const oId = oBond.atom1 === carbon.id ? oBond.atom2 : oBond.atom1;
      const oIdx = mol.atoms.findIndex((a) => a.id === oId);
      if (oIdx === -1) continue;

      const oxygen = mol.atoms[oIdx];
      if (!oxygen || oxygen.symbol !== "O") continue;
      if ((oxygen.hydrogens ?? 0) === 0) continue;

      sites.push({
        type: "cyano-isocyanic",
        atoms: [oIdx, cIdx, nIdx],
        canTransform: true,
        priority: 75,
        metadata: { direction: "forward", oxygen: oIdx, carbon: cIdx, nitrogen: nIdx },
      });
    }
  }

  // Reverse: [N!H0]=[C]=[O] → [O!H0]-[C]#[N]
  for (let i = 0; i < mol.bonds.length; i++) {
    const bond1 = mol.bonds[i];
    if (!bond1 || bond1.type !== BondType.DOUBLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond1.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond1.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    // Look for N=C=O pattern
    let nIdx = -1;
    let cIdx = -1;

    if (atom1.symbol === "N" && atom2.symbol === "C") {
      nIdx = atom1Idx;
      cIdx = atom2Idx;
    } else if (atom2.symbol === "N" && atom1.symbol === "C") {
      nIdx = atom2Idx;
      cIdx = atom1Idx;
    } else {
      continue;
    }

    const nitrogen = mol.atoms[nIdx];
    const carbon = mol.atoms[cIdx];
    if (!nitrogen || !carbon) continue;
    if ((nitrogen.hydrogens ?? 0) === 0) continue;

    // Find C=O double bond
    const cBonds = mol.bonds.filter(
      (b) =>
        (b.atom1 === carbon.id || b.atom2 === carbon.id) &&
        b.type === BondType.DOUBLE &&
        b !== bond1,
    );

    for (const bond2 of cBonds) {
      const oId = bond2.atom1 === carbon.id ? bond2.atom2 : bond2.atom1;
      const oIdx = mol.atoms.findIndex((a) => a.id === oId);
      if (oIdx === -1) continue;

      const oxygen = mol.atoms[oIdx];
      if (!oxygen || oxygen.symbol !== "O") continue;

      sites.push({
        type: "cyano-isocyanic",
        atoms: [nIdx, cIdx, oIdx],
        canTransform: true,
        priority: 75,
        metadata: { direction: "reverse", nitrogen: nIdx, carbon: cIdx, oxygen: oIdx },
      });
    }
  }

  return sites;
}

export function detect17AromaticHShift(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // 1,7-shift: [X!H0]-C=C-C=C-C=C-[Y]
  // X, Y = N, O, S with at least one having H
  for (let donorIdx = 0; donorIdx < mol.atoms.length; donorIdx++) {
    const donor = mol.atoms[donorIdx];
    if (!donor || !donor.aromatic) continue;
    if (!["N", "O", "S"].includes(donor.symbol)) continue;
    if ((donor.hydrogens ?? 0) === 0) continue;

    // Walk 7 positions (6 bonds) through conjugated system
    const path = findConjugatedPath(mol, donorIdx, 7);
    if (path.length !== 7) continue;

    const acceptorIdx = path[6];
    if (acceptorIdx === undefined) continue;

    const acceptor = mol.atoms[acceptorIdx];
    if (!acceptor || !acceptor.aromatic) continue;
    if (!["N", "O", "S"].includes(acceptor.symbol)) continue;

    sites.push({
      type: "aromatic-h-shift",
      atoms: path,
      canTransform: true,
      priority: 70,
      metadata: {
        donor: donorIdx,
        acceptor: acceptorIdx,
        shiftType: "1,7",
        path,
      },
    });
  }

  return sites;
}

export function detect19And111AromaticHShift(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // 1,9-shift: 9-atom path
  for (let donorIdx = 0; donorIdx < mol.atoms.length; donorIdx++) {
    const donor = mol.atoms[donorIdx];
    if (!donor || !donor.aromatic) continue;
    if (!["N", "O"].includes(donor.symbol)) continue;
    if ((donor.hydrogens ?? 0) === 0) continue;

    const path = findConjugatedPath(mol, donorIdx, 9);
    if (path.length === 9) {
      const acceptorIdx = path[8];
      if (acceptorIdx === undefined) continue;

      const acceptor = mol.atoms[acceptorIdx];
      if (!acceptor || !acceptor.aromatic) continue;
      if (!["N", "O"].includes(acceptor.symbol)) continue;

      sites.push({
        type: "aromatic-h-shift",
        atoms: path,
        canTransform: true,
        priority: 65,
        metadata: {
          donor: donorIdx,
          acceptor: acceptorIdx,
          shiftType: "1,9",
          path,
        },
      });
    }
  }

  // 1,11-shift: 11-atom path
  for (let donorIdx = 0; donorIdx < mol.atoms.length; donorIdx++) {
    const donor = mol.atoms[donorIdx];
    if (!donor || !donor.aromatic) continue;
    if (!["N", "O"].includes(donor.symbol)) continue;
    if ((donor.hydrogens ?? 0) === 0) continue;

    const path = findConjugatedPath(mol, donorIdx, 11);
    if (path.length === 11) {
      const acceptorIdx = path[10];
      if (acceptorIdx === undefined) continue;

      const acceptor = mol.atoms[acceptorIdx];
      if (!acceptor || !acceptor.aromatic) continue;
      if (!["N", "O"].includes(acceptor.symbol)) continue;

      sites.push({
        type: "aromatic-h-shift",
        atoms: path,
        canTransform: true,
        priority: 60,
        metadata: {
          donor: donorIdx,
          acceptor: acceptorIdx,
          shiftType: "1,11",
          path,
        },
      });
    }
  }

  return sites;
}

function findConjugatedPath(mol: Molecule, startIdx: number, length: number): number[] {
  const path: number[] = [startIdx];
  const visited = new Set<number>([startIdx]);

  function dfs(currentIdx: number, remaining: number): boolean {
    if (remaining === 0) return true;

    const current = mol.atoms[currentIdx];
    if (!current) return false;

    const bonds = mol.bonds.filter(
      (b) =>
        (b.atom1 === current.id || b.atom2 === current.id) &&
        (b.type === BondType.DOUBLE || b.type === BondType.AROMATIC),
    );

    for (const bond of bonds) {
      const nextId = bond.atom1 === current.id ? bond.atom2 : bond.atom1;
      const nextIdx = mol.atoms.findIndex((a) => a.id === nextId);

      if (nextIdx === -1 || visited.has(nextIdx)) continue;

      const next = mol.atoms[nextIdx];
      if (!next || !next.aromatic) continue;

      visited.add(nextIdx);
      path.push(nextIdx);

      if (dfs(nextIdx, remaining - 1)) return true;

      path.pop();
      visited.delete(nextIdx);
    }

    return false;
  }

  dfs(startIdx, length - 1);
  return path;
}

export function detectSpecialImineSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Rule 7: [Nz0!H0]-[C]=[Cz0X3R0] (non-aromatic imine, acyclic carbon)
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.DOUBLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    // C=C with special conditions
    if (atom1.symbol === "C" && atom2.symbol === "C") {
      if (atom1.aromatic || atom2.aromatic) continue;

      // Look for N-C=C pattern
      for (const c of [atom1, atom2]) {
        const cIdx = c === atom1 ? atom1Idx : atom2Idx;
        const otherCIdx = c === atom1 ? atom2Idx : atom1Idx;

        const cBonds = mol.bonds.filter(
          (b) => (b.atom1 === c.id || b.atom2 === c.id) && b.type === BondType.SINGLE && b !== bond,
        );

        for (const nBond of cBonds) {
          const nId = nBond.atom1 === c.id ? nBond.atom2 : nBond.atom1;
          const nIdx = mol.atoms.findIndex((a) => a.id === nId);
          if (nIdx === -1) continue;

          const nitrogen = mol.atoms[nIdx];
          if (!nitrogen || nitrogen.symbol !== "N") continue;
          if (nitrogen.aromatic) continue;
          if ((nitrogen.hydrogens ?? 0) === 0) continue;

          sites.push({
            type: "special-imine",
            atoms: [nIdx, cIdx, otherCIdx],
            canTransform: true,
            priority: 75,
            metadata: { rule: 7, nitrogen: nIdx, carbon1: cIdx, carbon2: otherCIdx },
          });
        }
      }
    }
  }

  // Rules 8-9: Aromatic imine cases [Cz0R0X4!H0]-[c]=[nz0]
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.DOUBLE && bond.type !== BondType.AROMATIC) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    // Aromatic c=n pattern
    if (atom1.symbol === "C" && atom1.aromatic && atom2.symbol === "N") {
      const c = atom1;
      const cIdx = atom1Idx;
      const nIdx = atom2Idx;

      // Look for non-aromatic C-H attached to aromatic carbon
      const cBonds = mol.bonds.filter(
        (b) => (b.atom1 === c.id || b.atom2 === c.id) && b.type === BondType.SINGLE && b !== bond,
      );

      for (const alkylBond of cBonds) {
        const alkylId = alkylBond.atom1 === c.id ? alkylBond.atom2 : alkylBond.atom1;
        const alkylIdx = mol.atoms.findIndex((a) => a.id === alkylId);
        if (alkylIdx === -1) continue;

        const alkyl = mol.atoms[alkylIdx];
        if (!alkyl || alkyl.symbol !== "C") continue;
        if (alkyl.aromatic) continue;
        if ((alkyl.hydrogens ?? 0) === 0) continue;

        sites.push({
          type: "special-imine",
          atoms: [alkylIdx, cIdx, nIdx],
          canTransform: true,
          priority: 75,
          metadata: { rule: 8, alkyl: alkylIdx, aromaticC: cIdx, aromaticN: nIdx },
        });
      }
    }
  }

  return sites;
}

export function detectOximePhenolSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Forward: [O!H0]-[N]=[C]-[C]=[C]-[C]=[OH0]
  for (let oIdx = 0; oIdx < mol.atoms.length; oIdx++) {
    const oxygen = mol.atoms[oIdx];
    if (!oxygen || oxygen.symbol !== "O") continue;
    if ((oxygen.hydrogens ?? 0) === 0) continue;

    const oBonds = mol.bonds.filter(
      (b) => (b.atom1 === oxygen.id || b.atom2 === oxygen.id) && b.type === BondType.SINGLE,
    );

    for (const nBond of oBonds) {
      const nId = nBond.atom1 === oxygen.id ? nBond.atom2 : nBond.atom1;
      const nIdx = mol.atoms.findIndex((a) => a.id === nId);
      if (nIdx === -1) continue;

      const nitrogen = mol.atoms[nIdx];
      if (!nitrogen || nitrogen.symbol !== "N") continue;

      // Find N=C
      const nBonds = mol.bonds.filter(
        (b) =>
          (b.atom1 === nitrogen.id || b.atom2 === nitrogen.id) &&
          b.type === BondType.DOUBLE &&
          b !== nBond,
      );

      for (const ncBond of nBonds) {
        const cId = ncBond.atom1 === nitrogen.id ? ncBond.atom2 : ncBond.atom1;
        const cIdx = mol.atoms.findIndex((a) => a.id === cId);
        if (cIdx === -1) continue;

        const carbon = mol.atoms[cIdx];
        if (!carbon || carbon.symbol !== "C") continue;

        // Walk through conjugated path to find terminal oxygen
        const path = findConjugatedPath(mol, cIdx, 4);
        if (path.length === 4) {
          const termOIdx = path[3];
          if (termOIdx === undefined) continue;

          const termO = mol.atoms[termOIdx];
          if (!termO || termO.symbol !== "O") continue;
          if ((termO.hydrogens ?? 0) > 0) continue;

          sites.push({
            type: "oxime-phenol",
            atoms: [oIdx, nIdx, ...path],
            canTransform: true,
            priority: 70,
            metadata: { direction: "forward", oxygen1: oIdx, nitrogen: nIdx, terminalO: termOIdx },
          });
        }
      }
    }
  }

  return sites;
}

export function detectPhosphonicAcidSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Forward: [OH]-[PX3H0] → [PX4H]=[O]
  for (let pIdx = 0; pIdx < mol.atoms.length; pIdx++) {
    const phosphorus = mol.atoms[pIdx];
    if (!phosphorus || phosphorus.symbol !== "P") continue;

    const pBonds = mol.bonds.filter((b) => b.atom1 === phosphorus.id || b.atom2 === phosphorus.id);

    // Count connections
    let hasOH = false;
    let oIdx = -1;

    for (const bond of pBonds) {
      if (bond.type !== BondType.SINGLE) continue;

      const otherId = bond.atom1 === phosphorus.id ? bond.atom2 : bond.atom1;
      const otherIdx = mol.atoms.findIndex((a) => a.id === otherId);
      if (otherIdx === -1) continue;

      const other = mol.atoms[otherIdx];
      if (!other || other.symbol !== "O") continue;
      if ((other.hydrogens ?? 0) > 0) {
        hasOH = true;
        oIdx = otherIdx;
        break;
      }
    }

    if (hasOH && oIdx !== -1) {
      sites.push({
        type: "phosphonic-acid",
        atoms: [pIdx, oIdx],
        canTransform: true,
        priority: 60,
        metadata: { direction: "forward", phosphorus: pIdx, oxygen: oIdx },
      });
    }
  }

  // Reverse: [PX4H]=[O] → [OH]-[PX3H0]
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.DOUBLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    let pIdx = -1;
    let oIdx = -1;

    if (atom1.symbol === "P" && atom2.symbol === "O") {
      pIdx = atom1Idx;
      oIdx = atom2Idx;
    } else if (atom2.symbol === "P" && atom1.symbol === "O") {
      pIdx = atom2Idx;
      oIdx = atom1Idx;
    } else {
      continue;
    }

    const phosphorus = mol.atoms[pIdx];
    if (!phosphorus || (phosphorus.hydrogens ?? 0) === 0) continue;

    sites.push({
      type: "phosphonic-acid",
      atoms: [pIdx, oIdx],
      canTransform: true,
      priority: 60,
      metadata: { direction: "reverse", phosphorus: pIdx, oxygen: oIdx },
    });
  }

  return sites;
}

export function detectFormamidineSulfinicSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Forward: [O,N;!H0]-[C]=[S,Se,Te;v6]=[O]
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.DOUBLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    // C=S/Se/Te pattern
    let cIdx = -1;
    let sIdx = -1;

    if (atom1.symbol === "C" && ["S", "Se", "Te"].includes(atom2.symbol)) {
      cIdx = atom1Idx;
      sIdx = atom2Idx;
    } else if (atom2.symbol === "C" && ["S", "Se", "Te"].includes(atom1.symbol)) {
      cIdx = atom2Idx;
      sIdx = atom1Idx;
    } else {
      continue;
    }

    const carbon = mol.atoms[cIdx];
    const sulfur = mol.atoms[sIdx];
    if (!carbon || !sulfur) continue;

    // Find O/N-H attached to carbon
    const cBonds = mol.bonds.filter(
      (b) => (b.atom1 === carbon.id || b.atom2 === carbon.id) && b.type === BondType.SINGLE,
    );

    for (const xBond of cBonds) {
      const xId = xBond.atom1 === carbon.id ? xBond.atom2 : xBond.atom1;
      const xIdx = mol.atoms.findIndex((a) => a.id === xId);
      if (xIdx === -1) continue;

      const x = mol.atoms[xIdx];
      if (!x || !["O", "N"].includes(x.symbol)) continue;
      if ((x.hydrogens ?? 0) === 0) continue;

      // Find S=O
      const sBonds = mol.bonds.filter(
        (b) =>
          (b.atom1 === sulfur.id || b.atom2 === sulfur.id) &&
          b.type === BondType.DOUBLE &&
          b !== bond,
      );

      for (const soBond of sBonds) {
        const oId = soBond.atom1 === sulfur.id ? soBond.atom2 : soBond.atom1;
        const oIdx = mol.atoms.findIndex((a) => a.id === oId);
        if (oIdx === -1) continue;

        const oxygen = mol.atoms[oIdx];
        if (!oxygen || oxygen.symbol !== "O") continue;

        sites.push({
          type: "formamidine-sulfinic",
          atoms: [xIdx, cIdx, sIdx, oIdx],
          canTransform: true,
          priority: 55,
          metadata: { x: xIdx, carbon: cIdx, sulfur: sIdx, oxygen: oIdx },
        });
      }
    }
  }

  return sites;
}

export function detectIsocyanideSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: [C-]#[N+] ⟷ C=N (isocyanide with formal charges)
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.TRIPLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    // C#N with specific charges
    let cIdx = -1;
    let nIdx = -1;

    if (atom1.symbol === "C" && atom2.symbol === "N") {
      cIdx = atom1Idx;
      nIdx = atom2Idx;
    } else if (atom2.symbol === "C" && atom1.symbol === "N") {
      cIdx = atom2Idx;
      nIdx = atom1Idx;
    } else {
      continue;
    }

    const carbon = mol.atoms[cIdx];
    const nitrogen = mol.atoms[nIdx];
    if (!carbon || !nitrogen) continue;

    // Check for isocyanide pattern: [C-]#[N+]
    if (carbon.charge === -1 && nitrogen.charge === 1) {
      sites.push({
        type: "isocyanide",
        atoms: [cIdx, nIdx],
        canTransform: true,
        priority: 50,
        metadata: { direction: "forward", carbon: cIdx, nitrogen: nIdx },
      });
    }
  }

  // Also check for C=N (no charges, double bond) that can transform to [C-]#[N+]
  for (const bond of mol.bonds) {
    if (bond.type !== BondType.DOUBLE) continue;

    const atom1Idx = mol.atoms.findIndex((a) => a.id === bond.atom1);
    const atom2Idx = mol.atoms.findIndex((a) => a.id === bond.atom2);
    if (atom1Idx === -1 || atom2Idx === -1) continue;

    const atom1 = mol.atoms[atom1Idx];
    const atom2 = mol.atoms[atom2Idx];
    if (!atom1 || !atom2) continue;

    let cIdx = -1;
    let nIdx = -1;

    if (atom1.symbol === "C" && atom2.symbol === "N") {
      cIdx = atom1Idx;
      nIdx = atom2Idx;
    } else if (atom2.symbol === "C" && atom1.symbol === "N") {
      cIdx = atom2Idx;
      nIdx = atom1Idx;
    } else {
      continue;
    }

    const carbon = mol.atoms[cIdx];
    const nitrogen = mol.atoms[nIdx];
    if (!carbon || !nitrogen) continue;

    // C=N with no charges can transform to [C-]#[N+]
    if (carbon.charge === 0 && nitrogen.charge === 0) {
      sites.push({
        type: "isocyanide",
        atoms: [cIdx, nIdx],
        canTransform: true,
        priority: 50,
        metadata: { direction: "reverse", carbon: cIdx, nitrogen: nIdx },
      });
    }
  }

  return sites;
}

export function detectAmideImidolSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: R-CO-NH2 ⟷ R-C(OH)=NH
  // Similar to lactam-lactim but not in a ring
  for (let cIdx = 0; cIdx < mol.atoms.length; cIdx++) {
    const carbon = mol.atoms[cIdx];
    if (!carbon || carbon.symbol !== "C") continue;

    const cBonds = mol.bonds.filter((b) => b.atom1 === carbon.id || b.atom2 === carbon.id);

    let oIdx = -1;
    let nIdx = -1;

    // Find C=O
    for (const bond of cBonds) {
      if (bond.type !== BondType.DOUBLE) continue;

      const otherId = bond.atom1 === carbon.id ? bond.atom2 : bond.atom1;
      const otherIdx = mol.atoms.findIndex((a) => a.id === otherId);
      if (otherIdx === -1) continue;

      const other = mol.atoms[otherIdx];
      if (other && other.symbol === "O") {
        oIdx = otherIdx;
        break;
      }
    }

    if (oIdx === -1) continue;

    // Find N-H2
    for (const bond of cBonds) {
      if (bond.type !== BondType.SINGLE) continue;

      const otherId = bond.atom1 === carbon.id ? bond.atom2 : bond.atom1;
      const otherIdx = mol.atoms.findIndex((a) => a.id === otherId);
      if (otherIdx === -1) continue;

      const other = mol.atoms[otherIdx];
      if (other && other.symbol === "N" && (other.hydrogens ?? 0) >= 2) {
        nIdx = otherIdx;
        break;
      }
    }

    if (nIdx === -1) continue;

    sites.push({
      type: "amide-imidol",
      atoms: [cIdx, oIdx, nIdx],
      canTransform: true,
      priority: 80,
      metadata: { carbon: cIdx, oxygen: oIdx, nitrogen: nIdx },
    });
  }

  return sites;
}

export function detectNitroAciSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Pattern: R-NO2 ⟷ R-N(O)OH (nitro ⟷ aci-nitro)
  // Find nitrogen with 2 oxygens (double bonds) and adjacent carbon with H

  for (const nitrogen of mol.atoms) {
    if (nitrogen.symbol !== "N") continue;

    const nIdx = mol.atoms.findIndex((a) => a.id === nitrogen.id);
    if (nIdx === -1) continue;

    // Find bonds to nitrogen
    const nBonds = mol.bonds.filter((b) => b.atom1 === nitrogen.id || b.atom2 === nitrogen.id);

    // Count O atoms bonded to N
    const oxygenBonds = nBonds.filter((b) => {
      const otherId = b.atom1 === nitrogen.id ? b.atom2 : b.atom1;
      const otherAtom = mol.atoms.find((a) => a.id === otherId);
      return otherAtom && otherAtom.symbol === "O";
    });

    if (oxygenBonds.length < 2) continue;

    // Get the two oxygen indices
    const oxygen1Bond = oxygenBonds[0];
    const oxygen2Bond = oxygenBonds[1];
    if (!oxygen1Bond || !oxygen2Bond) continue;

    const o1Id = oxygen1Bond.atom1 === nitrogen.id ? oxygen1Bond.atom2 : oxygen1Bond.atom1;
    const o2Id = oxygen2Bond.atom1 === nitrogen.id ? oxygen2Bond.atom2 : oxygen2Bond.atom1;

    const o1Idx = mol.atoms.findIndex((a) => a.id === o1Id);
    const o2Idx = mol.atoms.findIndex((a) => a.id === o2Id);
    if (o1Idx === -1 || o2Idx === -1) continue;

    // Find carbon bonded to nitrogen
    const carbonBond = nBonds.find((b) => {
      const otherId = b.atom1 === nitrogen.id ? b.atom2 : b.atom1;
      const otherAtom = mol.atoms.find((a) => a.id === otherId);
      return otherAtom && otherAtom.symbol === "C";
    });

    if (!carbonBond) continue;

    const carbonId = carbonBond.atom1 === nitrogen.id ? carbonBond.atom2 : carbonBond.atom1;
    const carbonIdx = mol.atoms.findIndex((a) => a.id === carbonId);
    if (carbonIdx === -1) continue;

    const carbon = mol.atoms[carbonIdx];
    if (!carbon) continue;

    // Carbon must have at least one hydrogen
    if ((carbon.hydrogens ?? 0) === 0) continue;

    sites.push({
      type: "nitro-aci",
      atoms: [nIdx, o1Idx, o2Idx, carbonIdx],
      canTransform: true,
      priority: 70,
      metadata: {
        nitrogen: nIdx,
        oxygen1: o1Idx,
        oxygen2: o2Idx,
        carbon: carbonIdx,
      },
    });
  }

  return sites;
}

export function identifyAllTransformationSites(mol: Molecule): TransformationSite[] {
  const sites: TransformationSite[] = [];

  // Detect all site types
  sites.push(...detectKetoEnolSites(mol));
  sites.push(...detect15KetoEnolSites(mol));
  sites.push(...detectEnolKetoSites(mol));
  sites.push(...detectThioneEnethiolSites(mol));
  sites.push(...detectEnethiolThioneSites(mol));
  sites.push(...detectPhenolQuinoneSites(mol));
  sites.push(...detectLactamLactimSites(mol));
  sites.push(...detectAminoImineSites(mol));
  sites.push(...detectAmidineSites(mol));
  sites.push(...detectImineEnamineSites(mol));
  sites.push(...detectNitrosoOximeSites(mol));
  sites.push(...detectAromaticHeteroatomHShift(mol));

  // New transformations (all 22 missing rules)
  sites.push(...detectFuranoneSites(mol));
  sites.push(...detectKetenYnolSites(mol));
  sites.push(...detectCyanoIsocyanicSites(mol));
  sites.push(...detect17AromaticHShift(mol));
  sites.push(...detect19And111AromaticHShift(mol));
  sites.push(...detectSpecialImineSites(mol));
  sites.push(...detectOximePhenolSites(mol));
  sites.push(...detectPhosphonicAcidSites(mol));
  sites.push(...detectFormamidineSulfinicSites(mol));
  sites.push(...detectIsocyanideSites(mol));
  sites.push(...detectAmideImidolSites(mol));
  sites.push(...detectNitroAciSites(mol));

  // Filter out sites that can't be transformed
  const validSites = sites.filter((site) => site.canTransform);

  // Sort by priority (higher priority first)
  validSites.sort((a, b) => b.priority - a.priority);

  if (debugSites) {
    console.debug(`[site-detector] Found ${validSites.length} valid transformation sites:`);
    for (const site of validSites) {
      console.debug(
        `  - ${site.type} at atoms [${site.atoms.join(",")}] priority=${site.priority}`,
      );
    }
  }

  return validSites;
}
