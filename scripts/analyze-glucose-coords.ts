import { parseSMILES } from "index";
import { generateCoordinatesV2 } from "src/generators/coordinate-generator/index";

const glucose = parseSMILES("OCC1OC(O)C(O)C(O)C1O");
if (glucose.molecules.length === 0) {
  console.error("Failed to parse");
  process.exit(1);
}

const mol = glucose.molecules[0]!;
const coords = generateCoordinatesV2(mol);

console.log("\nGlucose coordinates:\n");
console.log("Atom | Element | X      | Y      | Bonds");
console.log("-----|---------|--------|--------|-------");

for (let i = 0; i < mol.atoms.length; i++) {
  const atom = mol.atoms[i];
  if (!atom) continue;

  const coord = coords.get(i);
  const bonds = mol.bonds.filter((b) => b.atom1 === i || b.atom2 === i);
  const neighbors = bonds.map((b) => (b.atom1 === i ? b.atom2 : b.atom1));

  if (coord) {
    console.log(
      `${i.toString().padStart(4)} | ${atom.symbol.padEnd(7)} | ${coord.x.toFixed(1).padStart(6)} | ${coord.y.toFixed(1).padStart(6)} | [${neighbors.join(",")}]`,
    );
  }
}

// Analyze terminal OH angles
console.log("\nTerminal OH angles relative to parent carbon:\n");

for (let i = 0; i < mol.atoms.length; i++) {
  const atom = mol.atoms[i];
  if (!atom || atom.symbol !== "O") continue;

  const bonds = mol.bonds.filter((b) => b.atom1 === i || b.atom2 === i);
  if (bonds.length !== 1) continue; // Not terminal

  const parentId = bonds[0]!.atom1 === i ? bonds[0]!.atom2 : bonds[0]!.atom1;
  const parentAtom = mol.atoms[parentId];
  const parentCoord = coords.get(parentId);
  const atomCoord = coords.get(i);

  if (!parentCoord || !atomCoord || !parentAtom) continue;

  const dx = atomCoord.x - parentCoord.x;
  const dy = atomCoord.y - parentCoord.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dist = Math.sqrt(dx * dx + dy * dy);

  console.log(
    `O${i} → ${parentAtom.symbol}${parentId}: angle=${angle.toFixed(1)}°, dist=${dist.toFixed(1)}`,
  );
}
