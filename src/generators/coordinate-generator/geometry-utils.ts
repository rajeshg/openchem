/**
 * Vector math, geometric transforms, and polygon generation.
 * All operations are deterministic and order-independent.
 */

import type { Vec2, Transform } from "./types";

// ============================================================================
// Vector Operations
// ============================================================================

/** Add two vectors */
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** Subtract two vectors */
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** Scale vector by scalar */
export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

/** Dot product */
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** Cross product (2D: returns scalar z-component) */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

/** Vector length */
export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/** Distance between two points */
export function distance(a: Vec2, b: Vec2): number {
  return length(sub(b, a));
}

/** Normalize vector to unit length */
export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Rotate vector by angle (in radians) */
export function rotate(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

/** Get perpendicular vector (90° counterclockwise) */
export function perpendicular(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}

/** Angle between two vectors (in radians, [0, π]) */
export function angleBetween(a: Vec2, b: Vec2): number {
  const na = normalize(a);
  const nb = normalize(b);
  const cosAngle = dot(na, nb);
  // Clamp to avoid numerical errors
  const clamped = Math.max(-1, Math.min(1, cosAngle));
  return Math.acos(clamped);
}

/** Angle from point a to point b (in radians, [-π, π]) */
export function angleFromTo(a: Vec2, b: Vec2): number {
  const v = sub(b, a);
  return Math.atan2(v.y, v.x);
}

/** Signed angle from vector a to vector b (in radians, [-π, π]) */
export function signedAngle(a: Vec2, b: Vec2): number {
  return Math.atan2(cross(a, b), dot(a, b));
}

// ============================================================================
// Polygon Generation
// ============================================================================

/**
 * Generate regular polygon vertices.
 * Placed with center at origin, first vertex at (radius, 0).
 */
export function regularPolygon(sides: number, radius: number): Vec2[] {
  const vertices: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides;
    vertices.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  }
  return vertices;
}

/**
 * Generate regular polygon with flat-top orientation (for hexagons).
 * First vertex at top: (0, radius).
 */
export function flatTopPolygon(sides: number, radius: number): Vec2[] {
  const vertices: Vec2[] = [];
  const startAngle = Math.PI / 2; // Start at top
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (2 * Math.PI * i) / sides;
    vertices.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  }
  return vertices;
}

/**
 * Get radius for regular polygon given desired edge length.
 * For polygon with n sides and edge length d:
 * radius = d / (2 * sin(π/n))
 */
export function radiusForEdgeLength(sides: number, edgeLength: number): number {
  return edgeLength / (2 * Math.sin(Math.PI / sides));
}

/**
 * Get edge length for regular polygon given radius.
 * edge = 2 * radius * sin(π/n)
 */
export function edgeLengthForRadius(sides: number, radius: number): number {
  return 2 * radius * Math.sin(Math.PI / sides);
}

// ============================================================================
// Geometric Transforms
// ============================================================================

/** Apply transform to a point */
export function applyTransform(point: Vec2, transform: Transform): Vec2 {
  // Scale
  let p = scale(point, transform.scale);
  // Rotate
  p = rotate(p, transform.rotation);
  // Translate
  p = add(p, transform.translation);
  return p;
}

/** Inverse transform */
export function inverseTransform(transform: Transform): Transform {
  const neg = scale(transform.translation, -1);
  return {
    rotation: -transform.rotation,
    translation: rotate(neg, -transform.rotation),
    scale: 1.0 / transform.scale,
  };
}

/** Compose two transforms: first apply t1, then t2 */
export function composeTransforms(t1: Transform, t2: Transform): Transform {
  // Apply t1 first, then t2
  const p = applyTransform(t1.translation, t2);
  return {
    rotation: t1.rotation + t2.rotation,
    translation: p,
    scale: t1.scale * t2.scale,
  };
}

/**
 * Compute alignment transform to move/rotate edge (p1, p2) to match (target1, target2).
 * Returns transform that maps p1→target1 and p2→target2.
 */
export function computeAlignmentTransform(
  p1: Vec2,
  p2: Vec2,
  target1: Vec2,
  target2: Vec2,
): Transform {
  // Vector from p1 to p2
  const edge = sub(p2, p1);
  const targetEdge = sub(target2, target1);

  // Compute rotation angle
  const currentAngle = Math.atan2(edge.y, edge.x);
  const targetAngle = Math.atan2(targetEdge.y, targetEdge.x);
  const rotation = targetAngle - currentAngle;

  // Compute translation (move p1 to target1 after rotation)
  const rotated = rotate(p1, rotation);
  const translation = sub(target1, rotated);

  return { rotation, translation, scale: 1.0 };
}

/**
 * Compute transform to align one ring to another via shared edge.
 * Given:
 *   - sourceEdge: [atom1Idx, atom2Idx] in source ring's template
 *   - targetEdge: [atom1Idx, atom2Idx] in target ring's template
 *   - sourceTemplate: coordinates in source ring
 *   - targetCoords: already-placed coordinates of shared atoms
 * Returns transform to apply to targetTemplate to align with sourceTemplate.
 */
export function computeRingAlignmentTransform(
  targetEdge: [number, number],
  targetTemplate: Vec2[],
  targetCoords: [Vec2, Vec2],
): Transform {
  const [targetP1, targetP2] = [
    targetTemplate[targetEdge[0]]!,
    targetTemplate[targetEdge[1]]!,
  ];

  const [placedP1, placedP2] = targetCoords;

  // Align target ring's edge to already-placed edge
  return computeAlignmentTransform(targetP1, targetP2, placedP1, placedP2);
}

// ============================================================================
// Bounding Box & Geometry Queries
// ============================================================================

/** Compute bounding box of points */
export function boundingBox(points: Vec2[]): { min: Vec2; max: Vec2 } {
  if (points.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }

  let minX = points[0]!.x;
  let maxX = points[0]!.x;
  let minY = points[0]!.y;
  let maxY = points[0]!.y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
  };
}

/** Center of points */
export function centroid(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return scale(sum, 1 / points.length);
}

/** Average distance from centroid */
export function averageRadius(points: Vec2[]): number {
  const center = centroid(points);
  const distances = points.map((p) => distance(center, p));
  return distances.reduce((a, b) => a + b, 0) / distances.length;
}

/**
 * Check if point p is inside circle (center, radius).
 */
export function isInsideCircle(p: Vec2, center: Vec2, radius: number): boolean {
  return distance(p, center) <= radius;
}

/**
 * Check if point p is inside polygon (convex).
 * Uses cross product method.
 */
export function isInsideConvexPolygon(p: Vec2, polygon: Vec2[]): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const edge = sub(b, a);
    const toPoint = sub(p, a);
    if (cross(edge, toPoint) < 0) return false;
  }

  return true;
}

/**
 * Closest point on line segment AB to point P.
 */
export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const abDotAb = dot(ab, ab);

  if (abDotAb === 0) return a; // A and B are same

  let t = dot(ap, ab) / abDotAb;
  t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]

  return add(a, scale(ab, t));
}

/**
 * Distance from point P to line segment AB.
 */
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const closest = closestPointOnSegment(p, a, b);
  return distance(p, closest);
}
