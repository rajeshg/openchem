/**
 * SVG Renderer - Converts molecular structures to SVG graphics
 *
 * This module handles all SVG rendering logic including:
 * - Coordinate transformations (molecule space → SVG viewport)
 * - Bond rendering (single, double, triple, wedge, dashed, aromatic)
 * - Atom label positioning and rendering
 * - Layout quality metrics
 */

import type { Molecule, ParseResult, Bond } from "types";
import { generateCoordinates } from "src/generators/coordinate-generator";
import { StereoType as StereoEnum, BondType } from "types";
import { kekulize } from "src/utils/kekulize";
import { matchSMARTSOptimized } from "src/matchers/smarts-matcher-optimized";

// ============================================================================
// Types
// ============================================================================

export type AtomCoordinates = { x: number; y: number };

/**
 * Highlight specification for individual atoms.
 */
export interface AtomHighlight {
  atoms: number[];
  color?: string;
  opacity?: number;
  radius?: number;
}

/**
 * Highlight specification for individual bonds.
 */
export interface BondHighlight {
  bonds: Array<[number, number]>;
  color?: string;
  width?: number;
  opacity?: number;
}

/**
 * Substructure highlight using SMARTS pattern or explicit atom/bond indices.
 */
export interface SubstructureHighlight {
  smarts?: string;
  atoms?: number[];
  bonds?: Array<[number, number]>;
  color?: string;
  atomColor?: string;
  bondColor?: string;
  opacity?: number;
  label?: string;
}

export interface SVGRendererOptions {
  width?: number;
  height?: number;
  bondLineWidth?: number;
  bondLength?: number;
  fontSize?: number;
  fontFamily?: string;
  padding?: number;
  showCarbonLabels?: boolean;
  showImplicitHydrogens?: boolean;
  kekulize?: boolean;
  atomColors?: Record<string, string>;
  backgroundColor?: string;
  bondColor?: string;
  showStereoBonds?: boolean;
  atomCoordinates?: Array<[number, number]> | AtomCoordinates[];
  moleculeSpacing?: number;
  highlights?: SubstructureHighlight[];
  atomHighlights?: AtomHighlight[];
  bondHighlights?: BondHighlight[];
}

export interface SVGRenderResult {
  svg: string;
  width: number;
  height: number;
  errors: string[];
}

export const DEFAULT_COLORS: Record<string, string> = {
  C: "#222",
  N: "#3050F8",
  O: "#FF0D0D",
  S: "#E6C200",
  F: "#50FF50",
  Cl: "#1FF01F",
  Br: "#A62929",
  I: "#940094",
  P: "#FF8000",
  H: "#AAAAAA",
  B: "#FFB5B5",
  Si: "#F0C8A0",
  default: "#222",
};

// ============================================================================
// Helper Functions
// ============================================================================

function determineVisibleAtoms(molecule: Molecule, showCarbonLabels: boolean): Set<number> {
  const atomsToShow = new Set<number>();

  for (let i = 0; i < molecule.atoms.length; ++i) {
    const atom = molecule.atoms[i];
    if (!atom) continue;

    const isHeteroatom = atom.symbol !== "C" && atom.symbol !== "H";
    if (isHeteroatom) {
      atomsToShow.add(i);
      continue;
    }

    if (showCarbonLabels) {
      atomsToShow.add(i);
      continue;
    }

    if (atom.symbol === "C") {
      const bonds = molecule.bonds.filter((b) => b.atom1 === atom.id || b.atom2 === atom.id);
      if (bonds.length === 1) {
        atomsToShow.add(i);
      }
    }
  }

  return atomsToShow;
}

function assignStereoBondsFromChirality(molecule: Molecule): Molecule {
  const bondsWithStereo: Bond[] = [];

  for (let i = 0; i < molecule.bonds.length; i++) {
    const bond = molecule.bonds[i]!;
    let newBond = bond;

    if (bond.stereo === StereoEnum.NONE) {
      const atom1 = molecule.atoms.find((a) => a.id === bond.atom1);
      const atom2 = molecule.atoms.find((a) => a.id === bond.atom2);

      if (atom1?.chiral && (atom1.chiral === "@" || atom1.chiral === "@@")) {
        const atom1BondsFromChiral = molecule.bonds.filter((b) => b.atom1 === atom1.id);
        if (atom1BondsFromChiral.length > 0 && atom1BondsFromChiral[0] === bond) {
          newBond = {
            ...bond,
            stereo: atom1.chiral === "@@" ? StereoEnum.DOWN : StereoEnum.UP,
          };
        }
      } else if (atom2?.chiral && (atom2.chiral === "@" || atom2.chiral === "@@")) {
        const atom2BondsFromChiral = molecule.bonds.filter((b) => b.atom1 === atom2.id);
        if (atom2BondsFromChiral.length > 0 && atom2BondsFromChiral[0] === bond) {
          newBond = {
            ...bond,
            stereo: atom2.chiral === "@@" ? StereoEnum.DOWN : StereoEnum.UP,
          };
        }
      }
    }

    bondsWithStereo.push(newBond);
  }

  return {
    ...molecule,
    bonds: bondsWithStereo,
  };
}

// ============================================================================
// SVG Primitives
// ============================================================================

function svgLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  bondClass?: string,
): string {
  const classAttr = bondClass ? ` class='${bondClass}'` : "";
  return `<path${classAttr} d='M ${x1.toFixed(1)},${y1.toFixed(1)} L ${x2.toFixed(1)},${y2.toFixed(1)}' style='fill:none;fill-rule:evenodd;stroke:${color};stroke-width:${width.toFixed(1)}px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1' />`;
}

function svgWedgeBond(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / len;
  const perpY = dx / len;
  const wedgeWidth = width * 3;

  const p1x = x2 + (perpX * wedgeWidth) / 2;
  const p1y = y2 + (perpY * wedgeWidth) / 2;
  const p2x = x2 - (perpX * wedgeWidth) / 2;
  const p2y = y2 - (perpY * wedgeWidth) / 2;

  return `<polygon points="${x1},${y1} ${p1x},${p1y} ${p2x},${p2y}" style="fill:${color};stroke:none;" />`;
}

function svgDashedBond(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / len;
  const perpY = dx / len;
  const wedgeWidth = width * 3;
  const numDashes = 6;

  let svg = "";
  for (let i = 0; i < numDashes; i++) {
    const t = i / (numDashes - 1);
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const dashWidth = (wedgeWidth * t) / 2;
    const lx1 = cx + perpX * dashWidth;
    const ly1 = cy + perpY * dashWidth;
    const lx2 = cx - perpX * dashWidth;
    const ly2 = cy - perpY * dashWidth;
    svg += `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" style="stroke:${color};stroke-width:${width}px;" />`;
  }
  return svg;
}

function svgText(
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number,
  fontFamily: string,
  options?: {
    background?: boolean;
    backgroundColor?: string;
    padding?: number;
  },
): string {
  const bg = options?.background ?? false;
  const bgColor = options?.backgroundColor ?? "#FFFFFF";
  const padding = options?.padding ?? Math.max(2, Math.floor(fontSize * 0.15));

  const textWidth = Math.max(6, text.length * fontSize * 0.6);
  const textHeight = Math.max(8, fontSize * 1.2);

  if (!bg) {
    return `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}" font-family="${fontFamily}" text-anchor="middle" alignment-baseline="middle">${text}</text>`;
  }

  const rectX = x - textWidth / 2 - padding;
  const rectY = y - textHeight / 2 - padding / 2;
  const rectW = textWidth + padding * 2;
  const rectH = textHeight + padding;

  return (
    `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="2" ry="2" style="fill:${bgColor};stroke:none;" />` +
    `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}" font-family="${fontFamily}" text-anchor="middle" alignment-baseline="middle">${text}</text>`
  );
}

// ============================================================================
// Highlighting Functions
// ============================================================================

/**
 * Renders a colored circle highlight around an atom.
 */
function renderAtomHighlight(
  x: number,
  y: number,
  options: { color?: string; opacity?: number; radius?: number },
): string {
  const { color = "#FFFF00", opacity = 0.3, radius = 1.5 } = options;
  const r = 8 * radius;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" opacity="${opacity}" />`;
}

/**
 * Renders a thick colored line highlight over a bond.
 */
function renderBondHighlight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: { color?: string; width?: number; opacity?: number },
): string {
  const { color = "#FF0000", width = 2.0, opacity = 0.8 } = options;
  const lineWidth = 2 * width;
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
}

/**
 * Finds all bonds connecting atoms in the given set.
 */
function inferBondsBetweenAtoms(molecule: Molecule, atoms: number[]): Array<[number, number]> {
  const atomSet = new Set(atoms);
  const bonds: Array<[number, number]> = [];

  for (const bond of molecule.bonds) {
    if (atomSet.has(bond.atom1) && atomSet.has(bond.atom2)) {
      bonds.push([bond.atom1, bond.atom2]);
    }
  }

  return bonds;
}

/**
 * Converts SubstructureHighlight specifications to explicit atom/bond highlights.
 * Processes SMARTS patterns and returns concrete rendering instructions.
 */
function processHighlights(
  molecule: Molecule,
  highlights: SubstructureHighlight[],
): { atomHighlights: AtomHighlight[]; bondHighlights: BondHighlight[] } {
  const atomHighlights: AtomHighlight[] = [];
  const bondHighlights: BondHighlight[] = [];

  for (const hl of highlights) {
    let atoms: number[] = [];
    let bonds: Array<[number, number]> = [];

    if (hl.smarts) {
      try {
        const result = matchSMARTSOptimized(hl.smarts, molecule);
        if (result.success && result.matches.length > 0) {
          const firstMatch = result.matches[0];
          if (firstMatch) {
            // Convert molecule indices to atom IDs
            const atomIndices = firstMatch.atoms.map((am) => am.moleculeIndex);
            atoms = atomIndices.map((idx) => molecule.atoms[idx]?.id ?? idx);
            bonds = inferBondsBetweenAtoms(molecule, atoms);
          }
        }
      } catch (error) {
        if (process.env.VERBOSE) {
          console.warn(`Failed to match SMARTS pattern "${hl.smarts}":`, error);
        }
      }
    } else {
      atoms = hl.atoms || [];
      bonds = hl.bonds || [];
    }

    if (atoms.length > 0) {
      atomHighlights.push({
        atoms,
        color: hl.atomColor || hl.color || "#FFFF00",
        opacity: hl.opacity ?? 0.3,
      });
    }

    if (bonds.length > 0) {
      bondHighlights.push({
        bonds,
        color: hl.bondColor || hl.color || "#FF0000",
        opacity: hl.opacity ?? 0.8,
      });
    }
  }

  return { atomHighlights, bondHighlights };
}

// ============================================================================
// Coordinate Utilities
// ============================================================================

function normalizeCoordinates(
  rawCoords: Array<[number, number]> | AtomCoordinates[],
): AtomCoordinates[] {
  return rawCoords.map((c) => (Array.isArray(c) ? { x: c[0], y: c[1] } : c));
}

function createCoordinateTransforms(
  coords: AtomCoordinates[],
  width: number,
  height: number,
  padding: number,
  useRDKitStyle: boolean,
): [(x: number) => number, (y: number) => number] {
  const xs = coords.map((c) => c.x);
  const ys = coords.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  if (useRDKitStyle) {
    let xRange = maxX - minX;
    let yRange = maxY - minY;

    if (xRange < 1.0e-4) xRange = 1.0;
    if (yRange < 1.0e-4) yRange = 1.0;

    const rdkitPadding = 0.05;
    const drawWidth = width * (1 - 2 * rdkitPadding);
    const drawHeight = height * (1 - 2 * rdkitPadding);

    const minDim = Math.min(drawWidth, drawHeight);
    const scale = (minDim * 0.75) / Math.max(xRange, yRange);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const tx = (x: number) => width / 2 + (x - centerX) * scale;
    const ty = (y: number) => height / 2 - (y - centerY) * scale;
    return [tx, ty];
  } else {
    const scale = Math.min(
      (width - 2 * padding) / (maxX - minX || 1),
      (height - 2 * padding) / (maxY - minY || 1),
    );
    const offsetX = padding - minX * scale + (width - (maxX - minX) * scale) / 2;
    const offsetY = padding - minY * scale + (height - (maxY - minY) * scale) / 2;

    const tx = (x: number) => x * scale + offsetX;
    const ty = (y: number) => y * scale + offsetY;
    return [tx, ty];
  }
}

function computeLayoutQuality(
  coords: AtomCoordinates[],
  molecule: Molecule,
  atomsToShow: Set<number>,
  fontSize: number,
  bondLineWidth: number,
  allowedAnglesDeg: number[] = [30, 45, 60, 90, 120, 180],
) {
  const allowedRad = allowedAnglesDeg.map((d) => (d * Math.PI) / 180);
  const atomIdToIndex = new Map<number, number>();
  molecule.atoms.forEach((a, i) => atomIdToIndex.set(a.id, i));

  const angleWeight = 1.0;
  const lengthWeight = 0.5;
  const atomOverlapWeight = 2.0;
  const labelOverlapWeight = 1.5;

  let anglePenalty = 0;
  let lengthPenalty = 0;
  let atomOverlapPenalty = 0;
  let labelOverlapPenalty = 0;

  const bondLens: number[] = [];
  for (const bond of molecule.bonds) {
    const idxA = atomIdToIndex.get(bond.atom1 as number) ?? -1;
    const idxB = atomIdToIndex.get(bond.atom2 as number) ?? -1;
    if (idxA < 0 || idxB < 0) continue;
    const a = coords[idxA];
    const b = coords[idxB];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    bondLens.push(len);

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const aRad of allowedRad) {
      for (const base of [aRad, (aRad + Math.PI) % (Math.PI * 2)]) {
        const diff = Math.abs(Math.atan2(Math.sin(angle - base), Math.cos(angle - base)));
        if (diff < bestDiff) bestDiff = diff;
      }
    }
    anglePenalty += bestDiff * bestDiff;
  }

  if (bondLens.length > 0) {
    const mean = bondLens.reduce((s, v) => s + v, 0) / bondLens.length;
    let varSum = 0;
    for (const l of bondLens) {
      const rel = (l - mean) / (mean || 1);
      varSum += rel * rel;
    }
    lengthPenalty = varSum / bondLens.length;
  }

  const minAtomDist = Math.max(4, fontSize * 0.4);
  for (let i = 0; i < molecule.atoms.length; i++) {
    for (let j = i + 1; j < molecule.atoms.length; j++) {
      const ci = coords[i];
      const cj = coords[j];
      if (!ci || !cj) continue;
      const dx = ci.x - cj.x;
      const dy = ci.y - cj.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minAtomDist) {
        const diff = minAtomDist - d;
        atomOverlapPenalty += diff * diff;
      }
    }
  }

  const minLabelDist = Math.max(
    fontSize * 0.6,
    bondLens.length > 0 ? (bondLens.reduce((s, v) => s + v, 0) / bondLens.length) * 0.2 : fontSize,
  );
  const shown: number[] = [];
  for (const n of atomsToShow) {
    if (typeof n === "number" && n >= 0 && n < coords.length) shown.push(n as number);
  }
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const ai = shown[i];
      const aj = shown[j];
      if (ai === undefined || aj === undefined) continue;
      const ci = coords[ai];
      const cj = coords[aj];
      if (!ci || !cj) continue;
      const dx = ci.x - cj.x;
      const dy = ci.y - cj.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minLabelDist) {
        const diff = minLabelDist - d;
        labelOverlapPenalty += diff * diff;
      }
    }
  }

  const total =
    angleWeight * anglePenalty +
    lengthWeight * lengthPenalty +
    atomOverlapWeight * atomOverlapPenalty +
    labelOverlapWeight * labelOverlapPenalty;

  return {
    total,
    components: {
      angle: anglePenalty,
      length: lengthPenalty,
      atomOverlap: atomOverlapPenalty,
      labelOverlap: labelOverlapPenalty,
    },
  };
}

function computeLabelOffsets(
  svgCoords: Array<{ x: number; y: number }>,
  molecule: Molecule,
  atomsToShow: Set<number>,
  fontSize: number,
  bondLineWidth: number,
): Map<number, { dx: number; dy: number }> {
  const offsets = new Map<number, { dx: number; dy: number }>();

  function bboxForLabel(idx: number, label: string) {
    const c = svgCoords[idx];
    if (!c) return { x: 0, y: 0, w: 0, h: 0 };
    const w = Math.max(8, label.length * fontSize * 0.6);
    const h = fontSize;
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
  }

  for (let i = 0; i < molecule.atoms.length; i++) offsets.set(i, { dx: 0, dy: 0 });

  const labels: {
    idx: number;
    label: string;
    box: { x: number; y: number; w: number; h: number };
  }[] = [];
  for (let i = 0; i < molecule.atoms.length; i++) {
    if (!atomsToShow.has(i)) continue;
    if (!svgCoords[i]) continue;
    const atom = molecule.atoms[i];
    if (!atom) continue;
    const label = atom.symbol;
    labels.push({ idx: i, label, box: bboxForLabel(i, label) });
  }

  const maxIter = 10;
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false;
    for (let a = 0; a < labels.length; a++) {
      for (let b = a + 1; b < labels.length; b++) {
        const A = labels[a];
        const B = labels[b];
        if (!A || !B) continue;
        const offA = offsets.get(A.idx);
        const offB = offsets.get(B.idx);
        if (!offA || !offB) continue;
        const ax = A.box.x + offA.dx;
        const ay = A.box.y + offA.dy;
        const bx = B.box.x + offB.dx;
        const by = B.box.y + offB.dy;
        if (ax < bx + B.box.w && ax + A.box.w > bx && ay < by + B.box.h && ay + A.box.h > by) {
          const acx = ax + A.box.w / 2;
          const acy = ay + A.box.h / 2;
          const bcx = bx + B.box.w / 2;
          const bcy = by + B.box.h / 2;
          let vx = bcx - acx;
          let vy = bcy - acy;
          const vlen = Math.sqrt(vx * vx + vy * vy) || 1;
          vx /= vlen;
          vy /= vlen;
          const push = Math.max(4, (A.box.w + B.box.w) / 8);
          offsets.set(B.idx, {
            dx: offB.dx + vx * push,
            dy: offB.dy + vy * push,
          });
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  for (const L of labels) {
    const curr = offsets.get(L.idx) || { dx: 0, dy: 0 };
    const c = svgCoords[L.idx];
    if (!c) continue;

    const atomIdToIndex = new Map<number, number>();
    molecule.atoms.forEach((a, i) => atomIdToIndex.set(a.id, i));

    const lx = c.x + curr.dx;
    const ly = c.y + curr.dy;

    for (const bond of molecule.bonds) {
      const idxA = atomIdToIndex.get(bond.atom1 as number) ?? -1;
      const idxB = atomIdToIndex.get(bond.atom2 as number) ?? -1;
      if (idxA < 0 || idxB < 0) continue;
      const a = svgCoords[idxA];
      const b = svgCoords[idxB];
      if (!a || !b) continue;

      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const segLen2 = vx * vx + vy * vy;
      if (segLen2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((lx - a.x) * vx + (ly - a.y) * vy) / segLen2));
      const projX = a.x + vx * t;
      const projY = a.y + vy * t;
      const dx = lx - projX;
      const dy = ly - projY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = Math.max(fontSize * 0.6, bondLineWidth * 1.5);
      if (dist < minDist) {
        let px = dx / (dist || 1);
        let py = dy / (dist || 1);
        const push = minDist - dist + 4;
        const currOff = offsets.get(L.idx) || { dx: 0, dy: 0 };
        offsets.set(L.idx, {
          dx: currOff.dx + px * push,
          dy: currOff.dy + py * push,
        });
      }
    }
  }

  return offsets;
}

// ============================================================================
// Aromatic Ring Detection
// ============================================================================

interface AromaticRing {
  ringId: number;
  atoms: number[];
  bonds: Bond[];
}

function detectAromaticRings(molecule: Molecule): AromaticRing[] {
  const aromaticRings: AromaticRing[] = [];

  if (!molecule.ringInfo) return aromaticRings;

  for (let rid = 0; rid < molecule.ringInfo.rings.length; rid++) {
    const ring = molecule.ringInfo.rings[rid];
    if (!ring) continue;

    const ringAtomIds: number[] = Array.from(ring);
    const allAromatic = ringAtomIds.every((atomId) => {
      const atom = molecule.atoms.find((a) => a.id === atomId);
      return atom?.aromatic === true;
    });

    if (!allAromatic || ringAtomIds.length < 5 || ringAtomIds.length > 7) {
      continue;
    }

    const ringBonds: Bond[] = molecule.bonds.filter((bond) => {
      return ringAtomIds.includes(bond.atom1) && ringAtomIds.includes(bond.atom2);
    });

    const allBondsAromatic =
      ringBonds.length > 0 && ringBonds.every((bond) => bond.type === BondType.AROMATIC);

    let allBondsAlternating = false;
    if (ringBonds.length > 0 && ringBonds.length === ringAtomIds.length) {
      const orderedBonds = orderBondsInRing(ringAtomIds, ringBonds);
      allBondsAlternating = checkAlternatingBonds(orderedBonds);
    }

    if ((allBondsAromatic || allBondsAlternating) && ringBonds.length === ringAtomIds.length) {
      aromaticRings.push({ ringId: rid, atoms: ringAtomIds, bonds: ringBonds });
    }
  }

  return aromaticRings;
}

function orderBondsInRing(ringAtomIds: number[], ringBonds: Bond[]): Bond[] {
  const orderedBonds: Bond[] = [];
  for (let i = 0; i < ringAtomIds.length; i++) {
    const a1 = ringAtomIds[i]!;
    const a2 = ringAtomIds[(i + 1) % ringAtomIds.length]!;
    const bond = ringBonds.find(
      (b) => (b.atom1 === a1 && b.atom2 === a2) || (b.atom1 === a2 && b.atom2 === a1),
    );
    if (bond) orderedBonds.push(bond);
  }
  return orderedBonds;
}

function checkAlternatingBonds(orderedBonds: Bond[]): boolean {
  if (orderedBonds.length === 0) return false;

  let alternatingCount = 0;
  for (let i = 1; i < orderedBonds.length; i++) {
    const bond = orderedBonds[i]!;
    const prevBond = orderedBonds[i - 1]!;
    if (
      (bond.type === BondType.SINGLE && prevBond.type === BondType.DOUBLE) ||
      (bond.type === BondType.DOUBLE && prevBond.type === BondType.SINGLE)
    ) {
      alternatingCount++;
    }
  }
  return alternatingCount >= orderedBonds.length - 2;
}

// ============================================================================
// Double Bond Rendering
// ============================================================================

function svgDoubleBond(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  bond: Bond,
  molecule: Molecule,
  atomIdToCoords: Map<number, AtomCoordinates>,
  bondClass?: string,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  let perpX = -dy / len;
  let perpY = dx / len;
  const offset = width * 1.5;
  let outerOffset = offset;
  let innerOffset = offset;

  function isRegularPolygon(ringAtoms: number[], coords: Map<number, AtomCoordinates>): boolean {
    if (ringAtoms.length < 5 || ringAtoms.length > 7) return false;
    const dists: number[] = [];
    for (let i = 0; i < ringAtoms.length; ++i) {
      const idxA = ringAtoms[i];
      const idxB = ringAtoms[(i + 1) % ringAtoms.length];
      if (typeof idxA !== "number" || typeof idxB !== "number") return false;
      const a = coords.get(idxA);
      const b = coords.get(idxB);
      if (!a || !b) return false;
      dists.push(Math.hypot(a.x - b.x, a.y - b.y));
    }
    const avg = dists.reduce((a, b) => a + b, 0) / dists.length;
    return dists.every((d) => Math.abs(d - avg) < avg * 0.12);
  }

  let usePolygonParallel = false;
  let ringAtoms: number[] | undefined = undefined;

  if (bond.isInRing && molecule.ringInfo && bond.ringIds && bond.ringIds.length > 0) {
    for (const rid of bond.ringIds) {
      const ringArr = molecule.ringInfo.rings[rid];
      if (!ringArr) continue;
      const candidate = Array.from(ringArr);
      if (isRegularPolygon(candidate, atomIdToCoords)) {
        ringAtoms = candidate;
        usePolygonParallel = true;
        break;
      }
    }
  }

  if (usePolygonParallel && ringAtoms) {
    const a1 = atomIdToCoords.get(bond.atom1);
    const a2 = atomIdToCoords.get(bond.atom2);
    if (a1 && a2 && ringAtoms && ringAtoms.length > 0) {
      let cx = 0,
        cy = 0;
      for (const atomId of ringAtoms) {
        const c = atomIdToCoords.get(atomId);
        if (c) {
          cx += c.x;
          cy += c.y;
        }
      }
      cx /= ringAtoms.length;
      cy /= ringAtoms.length;
      const mx = (a1.x + a2.x) / 2;
      const my = (a1.y + a2.y) / 2;
      let vx = cx - mx;
      let vy = cy - my;
      const vlen = Math.sqrt(vx * vx + vy * vy);
      if (vlen > 0) {
        vx /= vlen;
        vy /= vlen;
      }
      let line1X1 = x1;
      let line1Y1 = y1;
      let line1X2 = x2;
      let line1Y2 = y2;
      const innerOffset = offset * 0.9;
      let line2X1 = x1 + vx * innerOffset;
      let line2Y1 = y1 + vy * innerOffset;
      let line2X2 = x2 + vx * innerOffset;
      let line2Y2 = y2 + vy * innerOffset;
      const innerDx = line2X2 - line2X1;
      const innerDy = line2Y2 - line2Y1;
      const innerLen = Math.sqrt(innerDx * innerDx + innerDy * innerDy);
      const shortenAmount = innerLen * 0.11;
      line2X1 += (innerDx / innerLen) * shortenAmount;
      line2Y1 += (innerDy / innerLen) * shortenAmount;
      line2X2 -= (innerDx / innerLen) * shortenAmount;
      line2Y2 -= (innerDy / innerLen) * shortenAmount;
      return (
        svgLine(line1X1, line1Y1, line1X2, line1Y2, color, width, bondClass) +
        svgLine(line2X1, line2Y1, line2X2, line2Y2, color, width, bondClass)
      );
    }
  } else if (bond.isInRing && molecule.ringInfo) {
    outerOffset = offset * 1.0;
    innerOffset = offset * 0.55;
  }

  let line1X1 = x1 + perpX * outerOffset;
  let line1Y1 = y1 + perpY * outerOffset;
  let line1X2 = x2 + perpX * outerOffset;
  let line1Y2 = y2 + perpY * outerOffset;

  let line2X1 = x1 - perpX * innerOffset;
  let line2Y1 = y1 - perpY * innerOffset;
  let line2X2 = x2 - perpX * innerOffset;
  let line2Y2 = y2 - perpY * innerOffset;

  if (bond.isInRing && molecule.ringInfo) {
    const ringId = bond.ringIds?.[0];
    if (ringId !== undefined) {
      const participatingRingIds = bond.ringIds ?? [];
      let ringCenterX = 0;
      let ringCenterY = 0;
      let centerCount = 0;
      for (const rid of participatingRingIds) {
        const ringAtoms = molecule.ringInfo.rings[rid];
        if (!ringAtoms) continue;
        let cx = 0,
          cy = 0,
          count = 0;
        for (const atomId of ringAtoms) {
          const coord = atomIdToCoords.get(atomId);
          if (coord) {
            cx += coord.x;
            cy += coord.y;
            count++;
          }
        }
        if (count === 0) continue;
        ringCenterX += cx / count;
        ringCenterY += cy / count;
        centerCount++;
      }
      if (centerCount === 0) return "";
      ringCenterX /= centerCount;
      ringCenterY /= centerCount;

      const a1Coord = atomIdToCoords.get(bond.atom1);
      const a2Coord = atomIdToCoords.get(bond.atom2);

      if (!a1Coord || !a2Coord) return "";

      const rcx = ringCenterX - a1Coord.x;
      const rcy = ringCenterY - a1Coord.y;
      const crossProduct = dx * rcy - dy * rcx;
      if (crossProduct > 0) {
        [line1X1, line2X1] = [line2X1, line1X1];
        [line1Y1, line2Y1] = [line2Y1, line1Y1];
        [line1X2, line2X2] = [line2X2, line1X2];
        [line1Y2, line2Y2] = [line2Y2, line1Y2];
      }
      const innerDx = line2X2 - line2X1;
      const innerDy = line2Y2 - line2Y1;
      const innerLen = Math.sqrt(innerDx * innerDx + innerDy * innerDy);
      const shortenAmount = innerLen * 0.075;
      line2X1 += (innerDx / innerLen) * shortenAmount;
      line2Y1 += (innerDy / innerLen) * shortenAmount;
      line2X2 -= (innerDx / innerLen) * shortenAmount;
      line2Y2 -= (innerDy / innerLen) * shortenAmount;
    }
  }

  return (
    svgLine(line1X1, line1Y1, line1X2, line1Y2, color, width, bondClass) +
    svgLine(line2X1, line2Y1, line2X2, line2Y2, color, width, bondClass)
  );
}

function svgTripleBond(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  bondClass?: string,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / len;
  const perpY = dx / len;
  const offset = width * 2;

  const line1X1 = x1 + perpX * offset;
  const line1Y1 = y1 + perpY * offset;
  const line1X2 = x2 + perpX * offset;
  const line1Y2 = y2 + perpY * offset;

  const line2X1 = x1 - perpX * offset;
  const line2Y1 = y1 - perpY * offset;
  const line2X2 = x2 - perpX * offset;
  const line2Y2 = y2 + perpY * offset;

  return (
    svgLine(line1X1, line1Y1, line1X2, line1Y2, color, width, bondClass) +
    svgLine(x1, y1, x2, y2, color, width, bondClass) +
    svgLine(line2X1, line2Y1, line2X2, line2Y2, color, width, bondClass)
  );
}

// ============================================================================
// Main Rendering Functions
// ============================================================================

interface MoleculeWithCoords {
  molecule: Molecule;
  coords: AtomCoordinates[];
  offsetX: number;
  offsetY: number;
  atomHighlights?: AtomHighlight[];
  bondHighlights?: BondHighlight[];
}

export function renderSVG(
  input: string | Molecule | Molecule[] | ParseResult,
  options: SVGRendererOptions = {},
): SVGRenderResult {
  let molecules: Molecule[] = [];

  if (typeof input === "string") {
    return {
      svg: "",
      width: 0,
      height: 0,
      errors: ["SMILES parsing not implemented in stub"],
    };
  } else if (Array.isArray(input)) {
    molecules = input;
  } else if ("molecules" in input && Array.isArray(input.molecules)) {
    molecules = input.molecules;
  } else {
    molecules = [input as Molecule];
  }

  if (molecules.length === 0)
    return { svg: "", width: 0, height: 0, errors: ["No molecules provided"] };

  if (molecules.length === 1) {
    return renderSingleMolecule(molecules[0]!, options);
  }

  return renderMultipleMolecules(molecules, options);
}

function renderSingleMolecule(
  molecule: Molecule,
  options: SVGRendererOptions = {},
): SVGRenderResult {
  molecule = assignStereoBondsFromChirality(molecule);

  // Process highlights BEFORE kekulization so aromatic SMARTS patterns work
  let processedHighlights: {
    atomHighlights: AtomHighlight[];
    bondHighlights: BondHighlight[];
  } | null = null;
  if (options.highlights) {
    processedHighlights = processHighlights(molecule, options.highlights);
  }

  const shouldKekulize = options.kekulize !== false;
  if (shouldKekulize) {
    molecule = kekulize(molecule);
  }

  const rawCoords =
    options.atomCoordinates ??
    generateCoordinates(molecule, {
      bondLength: options.bondLength,
    });
  const coords: AtomCoordinates[] = normalizeCoordinates(rawCoords);

  const atomIdToIndex = new Map<number, number>();
  molecule.atoms.forEach((a, idx) => atomIdToIndex.set(a.id, idx));

  const atomIdToCoords = new Map<number, AtomCoordinates>();
  molecule.atoms.forEach((atom, index) => {
    atomIdToCoords.set(atom.id, coords[index]!);
  });

  const width = options.width ?? 250;
  const height = options.height ?? 200;
  const padding = options.padding ?? 20;
  const bondColor = options.bondColor ?? "#000000";
  const bondLineWidth = options.bondLineWidth ?? 2;
  const fontSize = options.fontSize ?? 16;
  const fontFamily = options.fontFamily ?? "sans-serif";
  const atomColors = { ...DEFAULT_COLORS, ...options.atomColors };
  const showStereoBonds = options.showStereoBonds ?? true;

  const [tx, ty] = createCoordinateTransforms(
    coords,
    width,
    height,
    padding,
    !!options.atomCoordinates,
  );

  // Compute bounding box in SVG coordinate space (after transforms) so we can emit
  // a tight, normalized viewBox and keep preserveAspectRatio for consistent scaling.
  const transformedPoints = coords.filter(Boolean).map((c) => ({ x: tx(c.x), y: ty(c.y) }));

  // Prepare SVG-space coords array for helpers (one entry per atom index)
  const svgCoords: Array<{ x: number; y: number } | undefined> = Array(coords.length);
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    if (!c) {
      svgCoords[i] = undefined;
      continue;
    }
    svgCoords[i] = { x: tx(c.x), y: ty(c.y) };
  }

  // Decide which atoms get labels
  // (we compute label offsets and layout quality after this point)

  const atomsToShow = determineVisibleAtoms(molecule, options.showCarbonLabels ?? false);

  // Prepare a dense SVG coordinate array (no undefined) for helper routines
  const denseSvgCoords: Array<{ x: number; y: number }> = svgCoords.map((c) => c ?? { x: 0, y: 0 });

  // Compute label offsets to avoid overlaps in SVG space
  let labelOffsets = new Map<number, { dx: number; dy: number }>();
  try {
    labelOffsets = computeLabelOffsets(
      denseSvgCoords,
      molecule,
      atomsToShow,
      fontSize,
      bondLineWidth,
    );
  } catch (_e) {
    labelOffsets = new Map();
  }

  // For heteroatoms that are part of rings (e.g. the N in pyridine), prefer
  // drawing the label centered on the atom so it overlaps ring lines like RDKit.
  // Build a set of atom indices that are heteroatoms in any ring and force
  // their label offsets to zero.
  const heteroRingIndices = new Set<number>();
  try {
    if (molecule.ringInfo && Array.isArray(molecule.ringInfo.rings)) {
      for (const ring of molecule.ringInfo.rings) {
        if (!ring) continue;
        for (const aid of ring) {
          const idx = atomIdToIndex.get(aid as number);
          if (idx !== undefined) {
            const atom = molecule.atoms[idx];
            if (atom && atom.symbol !== "C") {
              heteroRingIndices.add(idx);
            }
          }
        }
      }
    }
  } catch (_e) {
    // ignore
  }

  // Override offsets for heteroatoms in rings so the label sits centered
  // on the atom coordinate (dx=0, dy=0).
  for (const idx of heteroRingIndices) {
    labelOffsets.set(idx, { dx: 0, dy: 0 });
  }

  let vbX = 0,
    vbY = 0,
    vbW = width,
    vbH = height;
  if (transformedPoints.length > 0) {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (let i = 0; i < molecule.atoms.length; i++) {
      const coord = svgCoords[i];
      if (!coord) continue;

      let atomMinX = coord.x;
      let atomMaxX = coord.x;
      let atomMinY = coord.y;
      let atomMaxY = coord.y;

      if (atomsToShow.has(i)) {
        const atom = molecule.atoms[i]!;
        let label = atom.symbol;
        if (options.showImplicitHydrogens && atom.hydrogens > 0 && atom.symbol !== "C") {
          const hText = atom.hydrogens === 1 ? "H" : `H${atom.hydrogens}`;
          label = atom.symbol + hText;
        }

        const offsets = labelOffsets.get(i) ?? { dx: 0, dy: 0 };
        const labelX = coord.x + offsets.dx;
        const labelY = coord.y + offsets.dy;

        const labelWidth = label.length * fontSize * 0.6;
        const labelHeight = fontSize * 1.2;

        atomMinX = Math.min(atomMinX, labelX - labelWidth / 2);
        atomMaxX = Math.max(atomMaxX, labelX + labelWidth / 2);
        atomMinY = Math.min(atomMinY, labelY - labelHeight / 2);
        atomMaxY = Math.max(atomMaxY, labelY + labelHeight / 2);

        if (atom.charge !== 0) {
          const chargeSign = atom.charge > 0 ? "+" : "−";
          const chargeStr =
            Math.abs(atom.charge) > 1 ? `${Math.abs(atom.charge)}${chargeSign}` : chargeSign;
          const chargeX = labelX + fontSize * 0.5;
          const chargeY = labelY - fontSize * 0.3;
          const smallFontSize = fontSize * 0.7;

          const chargeWidth = chargeStr.length * smallFontSize * 0.6;
          const chargeHeight = smallFontSize * 1.2;
          atomMinX = Math.min(atomMinX, chargeX - chargeWidth / 2);
          atomMaxX = Math.max(atomMaxX, chargeX + chargeWidth / 2);
          atomMinY = Math.min(atomMinY, chargeY - chargeHeight / 2);
          atomMaxY = Math.max(atomMaxY, chargeY + chargeHeight / 2);
        }
      }

      minX = Math.min(minX, atomMinX);
      maxX = Math.max(maxX, atomMaxX);
      minY = Math.min(minY, atomMinY);
      maxY = Math.max(maxY, atomMaxY);
    }

    if (isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
      const bbPadding = Math.max(8, Math.min(padding, 40));
      vbX = minX - bbPadding;
      vbY = minY - bbPadding;
      vbW = maxX - minX + bbPadding * 2;
      vbH = maxY - minY + bbPadding * 2;
    } else {
      const xs = transformedPoints.map((p) => p.x);
      const ys = transformedPoints.map((p) => p.y);
      const minXFallback = Math.min(...xs);
      const maxXFallback = Math.max(...xs);
      const minYFallback = Math.min(...ys);
      const maxYFallback = Math.max(...ys);

      const bbPadding = Math.max(8, Math.min(padding, 40));
      vbX = minXFallback - bbPadding;
      vbY = minYFallback - bbPadding;
      vbW = maxXFallback - minXFallback + bbPadding * 2;
      vbH = maxYFallback - minYFallback + bbPadding * 2;
    }

    vbW = Math.max(vbW, 16);
    vbH = Math.max(vbH, 16);
  }

  let svg =
    `<?xml version='1.0' encoding='iso-8859-1'?>\n` +
    `<svg version='1.1' baseProfile='full' xmlns='http://www.w3.org/2000/svg' xmlns:rdkit='http://www.rdkit.org/xml' xmlns:xlink='http://www.w3.org/1999/xlink' xml:space='preserve' preserveAspectRatio='xMidYMid meet' width='${width}px' height='${height}px' viewBox='${vbX} ${vbY} ${vbW} ${vbH}'>\n<!-- END OF HEADER -->\n`;

  let svgBody = ` <rect style='opacity:1.0;fill:#FFFFFF;stroke:none' width='${vbW}.0' height='${vbH}.0' x='${vbX}.0' y='${vbY}.0'> </rect>\n`;

  // Compute a layout quality score and append as comment to the SVG header
  try {
    const quality = computeLayoutQuality(coords, molecule, atomsToShow, fontSize, bondLineWidth);
    const qc = `<!-- layout-quality: total=${quality.total.toFixed(3)} angle=${quality.components.angle.toFixed(3)} length=${quality.components.length.toFixed(3)} atomOverlap=${quality.components.atomOverlap.toFixed(3)} labelOverlap=${quality.components.labelOverlap.toFixed(3)} -->\n`;
    svg += qc;
  } catch (_e) {
    // ignore
  }

  const aromaticRings = detectAromaticRings(molecule);

  const bondsInAromaticRings = new Set<number>();
  for (const aromRing of aromaticRings) {
    for (const bond of aromRing.bonds) {
      const bondIdx = molecule.bonds.indexOf(bond);
      bondsInAromaticRings.add(bondIdx);
    }
  }

  // Prepare highlights to render after bonds (so they appear on top of bonds)
  // but before atom labels (so labels remain readable)
  let allAtomHighlights: AtomHighlight[] = [];
  let allBondHighlights: BondHighlight[] = [];

  if (processedHighlights || options.atomHighlights || options.bondHighlights) {
    if (processedHighlights) {
      allAtomHighlights.push(...processedHighlights.atomHighlights);
      allBondHighlights.push(...processedHighlights.bondHighlights);
    }

    if (options.atomHighlights) {
      allAtomHighlights.push(...options.atomHighlights);
    }

    if (options.bondHighlights) {
      allBondHighlights.push(...options.bondHighlights);
    }
  }

  for (let bondIndex = 0; bondIndex < molecule.bonds.length; bondIndex++) {
    if (bondsInAromaticRings.has(bondIndex)) {
      const bond = molecule.bonds[bondIndex]!;
      const idxA = atomIdToIndex.get(bond.atom1 as number) ?? -1;
      const idxB = atomIdToIndex.get(bond.atom2 as number) ?? -1;
      const a1 = idxA >= 0 ? coords[idxA] : undefined;
      const a2 = idxB >= 0 ? coords[idxB] : undefined;
      if (!a1 || !a2) continue;

      const x1 = tx(a1.x);
      const y1 = ty(a1.y);
      const x2 = tx(a2.x);
      const y2 = ty(a2.y);

      const bondClass = `bond-${bondIndex} atom-${bond.atom1} atom-${bond.atom2}`;

      if (bond.type === BondType.SINGLE) {
        svgBody += svgLine(x1, y1, x2, y2, bondColor, bondLineWidth, bondClass);
      } else if (bond.type === BondType.DOUBLE || bond.type === BondType.AROMATIC) {
        // For bonds that participate in aromatic rings, compute an orientation
        // using the average center of all aromatic rings that include this bond.
        // This makes the offset decision stable for fused rings (e.g., naphthalene)
        // where a bond may belong to more than one ring.
        const ringsForBond = aromaticRings.filter((r) => r.bonds.includes(bond));
        if (ringsForBond.length > 0) {
          let cx = 0,
            cy = 0,
            count = 0;
          for (const ring of ringsForBond) {
            for (const atomId of ring.atoms) {
              const idx = molecule.atoms.findIndex((a) => a.id === atomId);
              const c = coords[idx];
              if (c) {
                cx += c.x;
                cy += c.y;
                count++;
              }
            }
          }
          if (count > 0) {
            cx /= count;
            cy /= count;

            const cxSvg = tx(cx);
            const cySvg = ty(cy);

            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            let vx = cxSvg - mx;
            let vy = cySvg - my;
            const vlen = Math.sqrt(vx * vx + vy * vy);
            if (vlen > 0) {
              vx /= vlen;
              vy /= vlen;
            }

            const offset = bondLineWidth * 3.0;
            const innerOffset = offset * 0.9;

            let line2X1 = x1 + vx * innerOffset;
            let line2Y1 = y1 + vy * innerOffset;
            let line2X2 = x2 + vx * innerOffset;
            let line2Y2 = y2 + vy * innerOffset;

            const innerDx = line2X2 - line2X1;
            const innerDy = line2Y2 - line2Y1;
            const innerLen = Math.sqrt(innerDx * innerDx + innerDy * innerDy);
            const shortenAmount = innerLen * 0.11;
            line2X1 += (innerDx / innerLen) * shortenAmount;
            line2Y1 += (innerDy / innerLen) * shortenAmount;
            line2X2 -= (innerDx / innerLen) * shortenAmount;
            line2Y2 -= (innerDy / innerLen) * shortenAmount;

            svgBody += svgLine(x1, y1, x2, y2, bondColor, bondLineWidth, bondClass);
            svgBody += svgLine(
              line2X1,
              line2Y1,
              line2X2,
              line2Y2,
              bondColor,
              bondLineWidth,
              bondClass,
            );
          }
        }
      }
      svgBody += "\n";
      continue;
    }

    const bond = molecule.bonds[bondIndex]!;
    const idxA = atomIdToIndex.get(bond.atom1 as number) ?? -1;
    const idxB = atomIdToIndex.get(bond.atom2 as number) ?? -1;
    const a1 = idxA >= 0 ? coords[idxA] : undefined;
    const a2 = idxB >= 0 ? coords[idxB] : undefined;
    if (!a1 || !a2) continue;

    let x1 = tx(a1.x);
    let y1 = ty(a1.y);
    let x2 = tx(a2.x);
    let y2 = ty(a2.y);

    const shortenDistance = fontSize * 0.6;

    if (atomsToShow.has(bond.atom1)) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        // If this atom is a heteroatom inside a ring we prefer the label to
        // overlap the bond (do not shorten). Otherwise shorten to avoid
        // overlapping label text.
        const atom1Idx = atomIdToIndex.get(bond.atom1 as number) ?? -1;
        if (!heteroRingIndices.has(atom1Idx)) {
          x1 += (dx / len) * shortenDistance;
          y1 += (dy / len) * shortenDistance;
        }
      }
    }

    if (atomsToShow.has(bond.atom2)) {
      const dx = x1 - x2;
      const dy = y1 - y2;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const atom2Idx = atomIdToIndex.get(bond.atom2 as number) ?? -1;
        if (!heteroRingIndices.has(atom2Idx)) {
          x2 += (dx / len) * shortenDistance;
          y2 += (dy / len) * shortenDistance;
        }
      }
    }

    const bondClass = `bond-${bondIndex} atom-${bond.atom1} atom-${bond.atom2}`;

    if (showStereoBonds && bond.stereo === StereoEnum.UP) {
      svgBody += svgWedgeBond(x1, y1, x2, y2, bondColor, bondLineWidth);
    } else if (showStereoBonds && bond.stereo === StereoEnum.DOWN) {
      svgBody += svgDashedBond(x1, y1, x2, y2, bondColor, bondLineWidth);
    } else if (bond.type === BondType.DOUBLE) {
      svgBody += svgDoubleBond(
        x1,
        y1,
        x2,
        y2,
        bondColor,
        bondLineWidth,
        bond,
        molecule,
        atomIdToCoords,
        bondClass,
      );
    } else if (bond.type === BondType.TRIPLE) {
      svgBody += svgTripleBond(x1, y1, x2, y2, bondColor, bondLineWidth, bondClass);
    } else {
      svgBody += svgLine(x1, y1, x2, y2, bondColor, bondLineWidth, bondClass);
    }
    svgBody += "\n";
  }

  // Render highlights after bonds but before atom labels
  // This ensures highlights appear on top of bonds but labels remain readable
  for (const bondHL of allBondHighlights) {
    for (const [atomId1, atomId2] of bondHL.bonds) {
      const idx1 = atomIdToIndex.get(atomId1);
      const idx2 = atomIdToIndex.get(atomId2);
      if (idx1 === undefined || idx2 === undefined) continue;

      const coord1 = svgCoords[idx1];
      const coord2 = svgCoords[idx2];
      if (!coord1 || !coord2) continue;

      svgBody += renderBondHighlight(coord1.x, coord1.y, coord2.x, coord2.y, {
        color: bondHL.color,
        width: bondHL.width,
        opacity: bondHL.opacity,
      });
    }
  }

  for (const atomHL of allAtomHighlights) {
    for (const atomId of atomHL.atoms) {
      const idx = atomIdToIndex.get(atomId);
      if (idx === undefined) continue;

      const coord = svgCoords[idx];
      if (!coord) continue;

      svgBody += renderAtomHighlight(coord.x, coord.y, {
        color: atomHL.color,
        opacity: atomHL.opacity,
        radius: atomHL.radius,
      });
    }
  }

  for (let i = 0; i < molecule.atoms.length; ++i) {
    const atom = molecule.atoms[i];
    const coord = coords[i];
    if (!atom || !coord) continue;
    const color = atomColors[atom.symbol] ?? atomColors.default ?? "#222";

    if (atomsToShow.has(i)) {
      const x = tx(coord.x);
      const y = ty(coord.y);

      const offsets = labelOffsets.get(i) ?? { dx: 0, dy: 0 };
      const labelX = x + offsets.dx;
      const labelY = y + offsets.dy;

      let label = atom.symbol;

      if (options.showImplicitHydrogens && atom.hydrogens > 0 && atom.symbol !== "C") {
        const hColor = atomColors["H"] ?? "#AAAAAA";
        const hText = atom.hydrogens === 1 ? "H" : `H${atom.hydrogens}`;

        const atomWidth = label.length * fontSize * 0.6;
        const hWidth = hText.length * fontSize * 0.6;

        const isHeteroRing = heteroRingIndices.has(i);
        svgBody += svgText(
          labelX - hWidth / 2,
          labelY,
          label,
          color,
          fontSize,
          fontFamily,
          isHeteroRing ? { background: true } : undefined,
        );
        svgBody += svgText(
          labelX + atomWidth / 2,
          labelY,
          hText,
          hColor,
          fontSize,
          fontFamily,
          isHeteroRing ? { background: true } : undefined,
        );
      } else {
        const isHeteroRing = heteroRingIndices.has(i);
        svgBody += svgText(
          labelX,
          labelY,
          label,
          color,
          fontSize,
          fontFamily,
          isHeteroRing ? { background: true } : undefined,
        );
      }

      if (atom.charge !== 0) {
        const chargeSign = atom.charge > 0 ? "+" : "−";
        const chargeStr =
          Math.abs(atom.charge) > 1 ? `${Math.abs(atom.charge)}${chargeSign}` : chargeSign;
        const chargeX = labelX + fontSize * 0.5;
        const chargeY = labelY - fontSize * 0.3;
        const smallFontSize = fontSize * 0.7;
        svgBody += svgText(chargeX, chargeY, chargeStr, color, smallFontSize, fontFamily);
      }
    }
  }

  svg += svgBody;
  svg += "</svg>\n";
  return { svg, width, height, errors: [] };
}

function renderMultipleMolecules(
  molecules: Molecule[],
  options: SVGRendererOptions = {},
): SVGRenderResult {
  const moleculesWithCoords: MoleculeWithCoords[] = [];
  const spacing = options.moleculeSpacing ?? 60;

  for (const mol of molecules) {
    let processed = assignStereoBondsFromChirality(mol);

    // Process highlights BEFORE kekulization so aromatic SMARTS patterns work
    let atomHighlights: AtomHighlight[] = [];
    let bondHighlights: BondHighlight[] = [];

    if (options.highlights) {
      const processedHighlights = processHighlights(processed, options.highlights);
      atomHighlights.push(...processedHighlights.atomHighlights);
      bondHighlights.push(...processedHighlights.bondHighlights);
    }

    if (options.atomHighlights) {
      atomHighlights.push(...options.atomHighlights);
    }

    if (options.bondHighlights) {
      bondHighlights.push(...options.bondHighlights);
    }

    const shouldKekulize = options.kekulize !== false;
    if (shouldKekulize) {
      processed = kekulize(processed);
    }

    const rawCoords =
      options.atomCoordinates ??
      generateCoordinates(processed, {
        bondLength: options.bondLength,
      });
    const coords = normalizeCoordinates(rawCoords);

    moleculesWithCoords.push({
      molecule: processed,
      coords,
      offsetX: 0,
      offsetY: 0,
      atomHighlights: atomHighlights.length > 0 ? atomHighlights : undefined,
      bondHighlights: bondHighlights.length > 0 ? bondHighlights : undefined,
    });
  }

  const width = options.width ?? 250;
  const height = options.height ?? 200;
  const padding = options.padding ?? 20;

  const allBounds: Array<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }> = [];

  for (const mwc of moleculesWithCoords) {
    const coords = mwc.coords;
    if (coords.length === 0) {
      allBounds.push({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
      continue;
    }

    const xs = coords.filter((c) => c).map((c) => c!.x);
    const ys = coords.filter((c) => c).map((c) => c!.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    allBounds.push({ minX, maxX, minY, maxY });
  }

  let currentX = 0;
  let maxY = 0;

  for (let i = 0; i < moleculesWithCoords.length; i++) {
    const bounds = allBounds[i]!;
    let width_i = bounds.maxX - bounds.minX;
    let height_i = bounds.maxY - bounds.minY;
    let isSingleAtom = false;

    if (width_i === 0 && height_i === 0 && moleculesWithCoords[i]!.molecule.atoms.length === 1) {
      width_i = 30;
      height_i = 30;
      isSingleAtom = true;
    }

    moleculesWithCoords[i]!.offsetX = currentX - bounds.minX + (isSingleAtom ? width_i / 2 : 0);
    moleculesWithCoords[i]!.offsetY = -bounds.minY + (isSingleAtom ? height_i / 2 : 0);

    currentX += width_i + spacing;
    maxY = Math.max(maxY, height_i);
  }

  const totalWidth = currentX - spacing;
  const totalHeight = maxY;

  const bondColor = options.bondColor ?? "#000000";
  const bondLineWidth = options.bondLineWidth ?? 2;
  const fontSize = options.fontSize ?? 16;
  const fontFamily = options.fontFamily ?? "sans-serif";
  const atomColors = { ...DEFAULT_COLORS, ...options.atomColors };
  const showStereoBonds = options.showStereoBonds ?? true;

  const vbPadding = Math.max(8, Math.min(padding, 40));
  const vbX = -vbPadding;
  const vbY = -vbPadding;
  const vbW = totalWidth + vbPadding * 2;
  const vbH = totalHeight + vbPadding * 2;

  let svg =
    `<?xml version='1.0' encoding='iso-8859-1'?>\n` +
    `<svg version='1.1' baseProfile='full' xmlns='http://www.w3.org/2000/svg' xmlns:rdkit='http://www.rdkit.org/xml' xmlns:xlink='http://www.w3.org/1999/xlink' xml:space='preserve' preserveAspectRatio='xMidYMid meet' width='${width}px' height='${height}px' viewBox='${vbX} ${vbY} ${vbW} ${vbH}'>\n<!-- END OF HEADER -->\n`;

  let svgBody = ` <rect style='opacity:1.0;fill:#FFFFFF;stroke:none' width='${vbW}' height='${vbH}' x='${vbX}' y='${vbY}'> </rect>\n`;

  for (const mwc of moleculesWithCoords) {
    const molecule = mwc.molecule;
    const coords = mwc.coords;
    const offsetX = mwc.offsetX;
    const offsetY = mwc.offsetY;

    const tx = (x: number) => x + offsetX;
    const ty = (y: number) => y + offsetY;

    const atomIdToIndex = new Map<number, number>();
    molecule.atoms.forEach((a, idx) => atomIdToIndex.set(a.id, idx));

    const atomIdToCoords = new Map<number, AtomCoordinates>();
    molecule.atoms.forEach((atom, index) => {
      const c = coords[index];
      if (c) {
        atomIdToCoords.set(atom.id, {
          x: tx(c.x),
          y: ty(c.y),
        });
      }
    });

    const atomsToShow = determineVisibleAtoms(molecule, options.showCarbonLabels ?? false);
    const aromaticRings = detectAromaticRings(molecule);

    // Compute heteroatoms that belong to rings for this molecule and force
    // their labels to be centered (so they overlap ring lines) and avoid
    // bond shortening around them.
    const heteroRingIndices = new Set<number>();
    try {
      if (molecule.ringInfo && Array.isArray(molecule.ringInfo.rings)) {
        for (const ring of molecule.ringInfo.rings) {
          if (!ring) continue;
          for (const aid of ring) {
            const idx = atomIdToIndex.get(aid as number);
            if (idx !== undefined) {
              const atom = molecule.atoms[idx];
              if (atom && atom.symbol !== "C") {
                heteroRingIndices.add(idx);
              }
            }
          }
        }
      }
    } catch (_e) {
      // ignore
    }

    const bondsInAromaticRings = new Set<number>();
    for (const aromRing of aromaticRings) {
      for (const bond of aromRing.bonds) {
        const bondIdx = molecule.bonds.indexOf(bond);
        bondsInAromaticRings.add(bondIdx);
      }
    }

    for (let bondIndex = 0; bondIndex < molecule.bonds.length; bondIndex++) {
      if (bondsInAromaticRings.has(bondIndex)) {
        const bond = molecule.bonds[bondIndex]!;
        const idxA = atomIdToIndex.get(bond.atom1 as number) ?? -1;
        const idxB = atomIdToIndex.get(bond.atom2 as number) ?? -1;
        const a1 = idxA >= 0 ? coords[idxA] : undefined;
        const a2 = idxB >= 0 ? coords[idxB] : undefined;
        if (!a1 || !a2) continue;

        const x1 = tx(a1.x);
        const y1 = ty(a1.y);
        const x2 = tx(a2.x);
        const y2 = ty(a2.y);

        const bondClass = `bond-${bondIndex} atom-${bond.atom1} atom-${bond.atom2}`;

        if (bond.type === BondType.SINGLE) {
          svgBody += svgLine(x1, y1, x2, y2, bondColor, bondLineWidth, bondClass);
        } else if (bond.type === BondType.DOUBLE || bond.type === BondType.AROMATIC) {
          const ringsForBond = aromaticRings.filter((r) => r.bonds.includes(bond));
          if (ringsForBond.length > 0) {
            let cx = 0,
              cy = 0,
              count = 0;
            for (const ring of ringsForBond) {
              for (const atomId of ring.atoms) {
                const idx = molecule.atoms.findIndex((a) => a.id === atomId);
                const c = coords[idx];
                if (c) {
                  cx += c.x;
                  cy += c.y;
                  count++;
                }
              }
            }
            if (count > 0) {
              cx /= count;
              cy /= count;

              const cxSvg = tx(cx);
              const cySvg = ty(cy);

              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              let vx = cxSvg - mx;
              let vy = cySvg - my;
              const vlen = Math.sqrt(vx * vx + vy * vy);
              if (vlen > 0) {
                vx /= vlen;
                vy /= vlen;
              }

              const offset = bondLineWidth * 3.0;
              const innerOffset = offset * 0.9;

              let line2X1 = x1 + vx * innerOffset;
              let line2Y1 = y1 + vy * innerOffset;
              let line2X2 = x2 + vx * innerOffset;
              let line2Y2 = y2 + vy * innerOffset;

              const innerDx = line2X2 - line2X1;
              const innerDy = line2Y2 - line2Y1;
              const innerLen = Math.sqrt(innerDx * innerDx + innerDy * innerDy);
              const shortenAmount = innerLen * 0.11;
              line2X1 += (innerDx / innerLen) * shortenAmount;
              line2Y1 += (innerDy / innerLen) * shortenAmount;
              line2X2 -= (innerDx / innerLen) * shortenAmount;
              line2Y2 -= (innerDy / innerLen) * shortenAmount;

              svgBody += svgLine(x1, y1, x2, y2, bondColor, bondLineWidth, bondClass);
              svgBody += svgLine(
                line2X1,
                line2Y1,
                line2X2,
                line2Y2,
                bondColor,
                bondLineWidth,
                bondClass,
              );
            }
          }
        }
        svgBody += "\n";
        continue;
      }

      const bond = molecule.bonds[bondIndex]!;
      const idxA = atomIdToIndex.get(bond.atom1 as number) ?? -1;
      const idxB = atomIdToIndex.get(bond.atom2 as number) ?? -1;
      const a1 = idxA >= 0 ? coords[idxA] : undefined;
      const a2 = idxB >= 0 ? coords[idxB] : undefined;
      if (!a1 || !a2) continue;

      let x1 = tx(a1.x);
      let y1 = ty(a1.y);
      let x2 = tx(a2.x);
      let y2 = ty(a2.y);

      const shortenDistance = fontSize * 0.6;

      if (atomsToShow.has(bond.atom1)) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const atom1Idx = atomIdToIndex.get(bond.atom1 as number) ?? -1;
          if (!heteroRingIndices.has(atom1Idx)) {
            x1 += (dx / len) * shortenDistance;
            y1 += (dy / len) * shortenDistance;
          }
        }
      }

      if (atomsToShow.has(bond.atom2)) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const atom2Idx = atomIdToIndex.get(bond.atom2 as number) ?? -1;
          if (!heteroRingIndices.has(atom2Idx)) {
            x2 += (dx / len) * shortenDistance;
            y2 += (dy / len) * shortenDistance;
          }
        }
      }

      const bondClass = `bond-${bondIndex} atom-${bond.atom1} atom-${bond.atom2}`;

      if (showStereoBonds && bond.stereo === StereoEnum.UP) {
        svgBody += svgWedgeBond(x1, y1, x2, y2, bondColor, bondLineWidth);
      } else if (showStereoBonds && bond.stereo === StereoEnum.DOWN) {
        svgBody += svgDashedBond(x1, y1, x2, y2, bondColor, bondLineWidth);
      } else if (bond.type === BondType.DOUBLE) {
        svgBody += svgDoubleBond(
          x1,
          y1,
          x2,
          y2,
          bondColor,
          bondLineWidth,
          bond,
          molecule,
          atomIdToCoords,
          bondClass,
        );
      } else if (bond.type === BondType.TRIPLE) {
        svgBody += svgTripleBond(x1, y1, x2, y2, bondColor, bondLineWidth, bondClass);
      } else {
        svgBody += svgLine(x1, y1, x2, y2, bondColor, bondLineWidth, bondClass);
      }
      svgBody += "\n";
    }

    // Render highlights after bonds but before atom labels
    // This ensures highlights appear on top of bonds but labels remain readable
    if (mwc.bondHighlights) {
      for (const bh of mwc.bondHighlights) {
        for (const [atomId1, atomId2] of bh.bonds) {
          const coord1 = atomIdToCoords.get(atomId1);
          const coord2 = atomIdToCoords.get(atomId2);
          if (coord1 && coord2) {
            svgBody += renderBondHighlight(coord1.x, coord1.y, coord2.x, coord2.y, {
              color: bh.color,
              width: bh.width,
              opacity: bh.opacity,
            });
          }
        }
      }
    }

    if (mwc.atomHighlights) {
      for (const ah of mwc.atomHighlights) {
        for (const atomId of ah.atoms) {
          const coord = atomIdToCoords.get(atomId);
          if (coord) {
            svgBody += renderAtomHighlight(coord.x, coord.y, {
              color: ah.color,
              opacity: ah.opacity,
              radius: ah.radius,
            });
          }
        }
      }
    }

    for (let i = 0; i < molecule.atoms.length; ++i) {
      const atom = molecule.atoms[i];
      const coord = coords[i];
      if (!atom || !coord) continue;
      const color = atomColors[atom.symbol] ?? atomColors.default ?? "#222";

      if (atomsToShow.has(i)) {
        const x = tx(coord.x);
        const y = ty(coord.y);

        let label = atom.symbol;

        if (options.showImplicitHydrogens && atom.hydrogens > 0 && atom.symbol !== "C") {
          const hColor = atomColors["H"] ?? "#AAAAAA";
          const hText = atom.hydrogens === 1 ? "H" : `H${atom.hydrogens}`;

          const atomWidth = label.length * fontSize * 0.6;
          const hWidth = hText.length * fontSize * 0.6;

          const atomIdx = i;
          const isHeteroRing = heteroRingIndices.has(atomIdx);
          svgBody += svgText(
            x - hWidth / 2,
            y,
            label,
            color,
            fontSize,
            fontFamily,
            isHeteroRing ? { background: true } : undefined,
          );
          svgBody += svgText(
            x + atomWidth / 2,
            y,
            hText,
            hColor,
            fontSize,
            fontFamily,
            isHeteroRing ? { background: true } : undefined,
          );
        } else {
          const atomIdx = i;
          const isHeteroRing = heteroRingIndices.has(atomIdx);
          svgBody += svgText(
            x,
            y,
            label,
            color,
            fontSize,
            fontFamily,
            isHeteroRing ? { background: true } : undefined,
          );
        }

        if (atom.charge !== 0) {
          const chargeSign = atom.charge > 0 ? "+" : "−";
          const chargeStr =
            Math.abs(atom.charge) > 1 ? `${Math.abs(atom.charge)}${chargeSign}` : chargeSign;
          const chargeX = x + fontSize * 0.5;
          const chargeY = y - fontSize * 0.3;
          const smallFontSize = fontSize * 0.7;
          svgBody += svgText(chargeX, chargeY, chargeStr, color, smallFontSize, fontFamily);
        }
      }
    }
  }

  svg += svgBody;
  svg += "</svg>\n";
  return { svg, width, height, errors: [] };
}
