import { parseSMILES } from "index";
import { generateCoordinatesV2 } from "src/generators/coordinate-generator/index";

const glucose = parseSMILES("OCC1OC(O)C(O)C(O)C1O");
const mol = glucose.molecules[0]!;
const coords = generateCoordinatesV2(mol);

console.log("Glucose Structure Analysis:\n");
console.log("SMILES: OCC1OC(O)C(O)C(O)C1O\n");

// Ring atoms
const ringAtoms = [2, 3, 4, 6, 8, 10];
console.log(
  "Ring (6-membered):",
  ringAtoms
    .map((id) => {
      const a = mol.atoms[id]!;
      const c = coords.get(id)!;
      return `${a.symbol}${id}(${c.x.toFixed(1)},${c.y.toFixed(1)})`;
    })
    .join(" → "),
);

console.log("\nSubstituents on ring:");
for (const ringId of ringAtoms) {
  const ringAtom = mol.atoms[ringId]!;
  const ringCoord = coords.get(ringId)!;

  const bonds = mol.bonds.filter(
    (b) => b.atom1 === ringId || b.atom2 === ringId,
  );
  const substituents = bonds
    .map((b) => {
      const otherId = b.atom1 === ringId ? b.atom2 : b.atom1;
      return otherId;
    })
    .filter((id) => !ringAtoms.includes(id));

  if (substituents.length > 0) {
    for (const subId of substituents) {
      const subAtom = mol.atoms[subId]!;
      const subCoord = coords.get(subId)!;
      const angle =
        (Math.atan2(subCoord.y - ringCoord.y, subCoord.x - ringCoord.x) * 180) /
        Math.PI;
      console.log(
        `  ${ringAtom.symbol}${ringId} → ${subAtom.symbol}${subId}: ${angle.toFixed(1)}°`,
      );
    }
  }
}

console.log("\nChain extending from ring (O-C-C):");
const c1Coord = coords.get(1)!;
const c2Coord = coords.get(2)!;
const o0Coord = coords.get(0)!;

const c2ToC1Angle =
  (Math.atan2(c1Coord.y - c2Coord.y, c1Coord.x - c2Coord.x) * 180) / Math.PI;
const c1ToO0Angle =
  (Math.atan2(o0Coord.y - c1Coord.y, o0Coord.x - c1Coord.x) * 180) / Math.PI;

console.log(`  C2(ring) → C1: ${c2ToC1Angle.toFixed(1)}°`);
console.log(`  C1 → O0: ${c1ToO0Angle.toFixed(1)}°`);
console.log(
  `  Overall chain direction: ${c2ToC1Angle.toFixed(1)}° then ${c1ToO0Angle.toFixed(1)}°`,
);

// Check if O0 extends in same general direction as the C2-C1 bond
const angleDiff = Math.abs(c1ToO0Angle - c2ToC1Angle);
console.log(
  `  Angle difference: ${angleDiff.toFixed(1)}° (smaller = more linear)`,
);
