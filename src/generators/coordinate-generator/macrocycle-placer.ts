/**
 * Macrocycle placement for large rings (>6 atoms).
 *
 * Regular polygons have poor interior angles for large rings:
 * - 8-gon: 135° (15° deviation from 120°)
 * - 10-gon: 144° (24° deviation)
 * - 12-gon: 150° (30° deviation)
 *
 * This module implements relaxed ring conformations that minimize
 * angle strain while maintaining planarity.
 */

import type { Vec2 } from "./types";

export interface MacrocycleOptions {
  bondLength: number;
  idealAngle?: number; // Target bond angle (default: 120° for sp2)
  maxIterations?: number;
}

/**
 * Generate coordinates for a macrocycle (ring with >6 atoms).
 * Uses iterative relaxation to find low-strain conformation.
 *
 * @param ringSize - Number of atoms in the ring
 * @param options - Placement options
 * @returns Array of 2D coordinates
 */
export function placeMacrocycle(ringSize: number, options: MacrocycleOptions): Vec2[] {
  const { bondLength, idealAngle = (2 * Math.PI) / 3, maxIterations = 100 } = options;

  // For small rings (<=6), use regular polygon
  if (ringSize <= 6) {
    return regularPolygon(ringSize, bondLength);
  }

  // Start with regular polygon
  let coords = regularPolygon(ringSize, bondLength);

  // Iteratively relax to minimize angle strain
  for (let iter = 0; iter < maxIterations; iter++) {
    const newCoords = relaxMacrocycle(coords, bondLength, idealAngle);

    // Check convergence
    const maxMove = Math.max(
      ...coords.map((c, i) => {
        const nc = newCoords[i]!;
        return Math.sqrt((c.x - nc.x) ** 2 + (c.y - nc.y) ** 2);
      }),
    );

    coords = newCoords;

    if (maxMove < bondLength * 0.001) {
      break; // Converged
    }
  }

  return coords;
}

/**
 * Generate regular polygon coordinates.
 */
function regularPolygon(n: number, bondLength: number): Vec2[] {
  const radius = bondLength / (2 * Math.sin(Math.PI / n));
  const coords: Vec2[] = [];

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2; // Start at top
    coords.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  }

  return coords;
}

/**
 * One iteration of macrocycle relaxation.
 * Adjusts positions to minimize angle strain while maintaining bond lengths.
 */
function relaxMacrocycle(coords: Vec2[], bondLength: number, idealAngle: number): Vec2[] {
  const n = coords.length;
  const newCoords: Vec2[] = coords.map((c) => ({ ...c }));

  // For each atom, compute forces from:
  // 1. Bond length constraints (spring forces)
  // 2. Angle constraints (torsion forces)

  const forces: Vec2[] = coords.map(() => ({ x: 0, y: 0 }));

  // Bond length forces
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = coords[j]!.x - coords[i]!.x;
    const dy = coords[j]!.y - coords[i]!.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.001) {
      const stretch = (dist - bondLength) / dist;
      const fx = dx * stretch * 0.5;
      const fy = dy * stretch * 0.5;

      forces[i]!.x += fx;
      forces[i]!.y += fy;
      forces[j]!.x -= fx;
      forces[j]!.y -= fy;
    }
  }

  // Angle forces
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    const v1x = coords[prev]!.x - coords[i]!.x;
    const v1y = coords[prev]!.y - coords[i]!.y;
    const v2x = coords[next]!.x - coords[i]!.x;
    const v2y = coords[next]!.y - coords[i]!.y;

    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (len1 < 0.001 || len2 < 0.001) continue;

    const u1x = v1x / len1;
    const u1y = v1y / len1;
    const u2x = v2x / len2;
    const u2y = v2y / len2;

    const dot = u1x * u2x + u1y * u2y;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    // Angle error (want to approach idealAngle)
    const error = angle - idealAngle;
    const torque = error * 0.1; // Damped torque

    // Apply perpendicular forces to neighbors
    forces[prev]!.x += -u1y * torque;
    forces[prev]!.y += u1x * torque;
    forces[next]!.x += u2y * torque;
    forces[next]!.y += -u2x * torque;
  }

  // Apply forces
  for (let i = 0; i < n; i++) {
    newCoords[i]!.x += forces[i]!.x;
    newCoords[i]!.y += forces[i]!.y;
  }

  // Re-center
  const cx = newCoords.reduce((s, c) => s + c.x, 0) / n;
  const cy = newCoords.reduce((s, c) => s + c.y, 0) / n;
  for (const c of newCoords) {
    c.x -= cx;
    c.y -= cy;
  }

  return newCoords;
}

/**
 * Check if a ring should be treated as a macrocycle.
 * Macrocycles are rings with >6 atoms that benefit from
 * relaxed placement rather than regular polygon geometry.
 */
export function isMacrocycle(ringSize: number): boolean {
  return ringSize > 6;
}

/**
 * Compute angle strain for a ring conformation.
 * Lower is better.
 */
export function computeAngleStrain(coords: Vec2[], idealAngle: number = (2 * Math.PI) / 3): number {
  const n = coords.length;
  let totalStrain = 0;

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    const v1x = coords[prev]!.x - coords[i]!.x;
    const v1y = coords[prev]!.y - coords[i]!.y;
    const v2x = coords[next]!.x - coords[i]!.x;
    const v2y = coords[next]!.y - coords[i]!.y;

    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (len1 < 0.001 || len2 < 0.001) continue;

    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    totalStrain += (angle - idealAngle) ** 2;
  }

  return totalStrain;
}
