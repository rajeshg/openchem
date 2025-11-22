import { parseSMILES } from "index";
import { generateCoordinatesV2 } from "src/generators/coordinate-generator/index";

const glucose = parseSMILES("OCC1OC(O)C(O)C(O)C1O");
const mol = glucose.molecules[0]!;
const coords = generateCoordinatesV2(mol);

// C2-C1-O0 bond angle
const c2 = coords.get(2)!;
const c1 = coords.get(1)!;
const o0 = coords.get(0)!;

// Vector C1→C2
const v1 = { x: c2.x - c1.x, y: c2.y - c1.y };
// Vector C1→O0
const v2 = { x: o0.x - c1.x, y: o0.y - c1.y };

// Dot product and magnitudes
const dot = v1.x * v2.x + v1.y * v2.y;
const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);

// Angle between vectors
const bondAngle = (Math.acos(dot / (mag1 * mag2)) * 180) / Math.PI;

console.log("C2-C1-O0 bond angle:", bondAngle.toFixed(1) + "°");
console.log("Expected for sp3 carbon: ~109.5° (tetrahedral)");
console.log("Expected for sp2 carbon: ~120° (trigonal planar)");
console.log("");
console.log("C1 hybridization:", mol.atoms[1]!.hybridization);
console.log("");

if (bondAngle > 170) {
  console.log("⚠️  Bond angle is nearly linear! This looks unnatural.");
  console.log("   The -CH2OH group should bend, not extend straight.");
} else if (bondAngle < 100 || bondAngle > 130) {
  console.log("⚠️  Bond angle deviates from tetrahedral geometry");
} else {
  console.log("✅ Bond angle looks good!");
}
