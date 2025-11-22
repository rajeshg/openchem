import { parseSMILES } from "../index";
import { generateCoordinatesV2 } from "../src/generators/coordinate-generator";

const molecules = [
  { name: "Phenanthrene", smiles: "c1ccc2c(c1)ccc3c2ccc4c3cccc4" },
  { name: "Morphine", smiles: "CN1CCC23C4C1CC5=C2C(=C(C=C5)O)OC3C(C=C4)O" },
];

function analyzeCoordinates(name: string, smiles: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Analyzing: ${name}`);
  console.log(`SMILES: ${smiles}`);
  console.log("=".repeat(70));

  const result = parseSMILES(smiles);
  const mol = result.molecules[0]!;

  // Generate coordinates
  const coords = generateCoordinatesV2(mol);

  // Print all atom coordinates
  console.log(`\nAtom coordinates:`);
  const coordArray = Array.from(coords.entries()).sort((a, b) => a[0] - b[0]);

  for (const [atomId, coord] of coordArray) {
    const atom = mol.atoms[atomId];
    console.log(
      `  Atom ${atomId.toString().padStart(2)} (${atom?.symbol}): x=${coord.x.toFixed(2).padStart(8)}, y=${coord.y.toFixed(2).padStart(8)}`,
    );
  }

  // Check for atoms that are too close
  console.log(`\nDistance analysis (checking for overlaps):`);
  const minBondLength = 25; // Reasonable minimum bond length
  let closeAtomCount = 0;

  for (let i = 0; i < coordArray.length; i++) {
    for (let j = i + 1; j < coordArray.length; j++) {
      const [id1, coord1] = coordArray[i]!;
      const [id2, coord2] = coordArray[j]!;

      const dx = coord2.x - coord1.x;
      const dy = coord2.y - coord1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if atoms are bonded
      const areBonded = mol.bonds.some(
        (b) =>
          (b.atom1 === id1 && b.atom2 === id2) ||
          (b.atom1 === id2 && b.atom2 === id1),
      );

      // If not bonded but very close, that's a problem
      if (!areBonded && distance < minBondLength) {
        closeAtomCount++;
        console.log(
          `  ⚠️  Atoms ${id1}-${id2}: distance=${distance.toFixed(2)} (NOT bonded but close!)`,
        );
      }
    }
  }

  if (closeAtomCount === 0) {
    console.log(`  ✓ No overlapping atoms found`);
  } else {
    console.log(
      `  ❌ Found ${closeAtomCount} pairs of atoms that are too close!`,
    );
  }

  // Calculate coordinate spread
  const xCoords = coordArray.map(([_, c]) => c.x);
  const yCoords = coordArray.map(([_, c]) => c.y);

  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);

  console.log(`\nCoordinate bounds:`);
  console.log(
    `  X: ${minX.toFixed(2)} to ${maxX.toFixed(2)} (width: ${(maxX - minX).toFixed(2)})`,
  );
  console.log(
    `  Y: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (height: ${(maxY - minY).toFixed(2)})`,
  );
  console.log(`  Aspect ratio: ${((maxX - minX) / (maxY - minY)).toFixed(2)}`);
}

console.log("\n" + "█".repeat(70));
console.log("COORDINATE ANALYSIS - CHECKING FOR OVERLAPS");
console.log("█".repeat(70));

for (const { name, smiles } of molecules) {
  analyzeCoordinates(name, smiles);
}

console.log(`\n${"█".repeat(70)}\n`);
