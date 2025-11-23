import { parseSMILES, getLabuteASA } from "../index.ts";

const testMolecules = [
  { smiles: "CC", name: "Ethane", rdkit: 15.1 },
  { smiles: "CCC", name: "Propane", rdkit: 21.47 },
  { smiles: "CCCC", name: "Butane", rdkit: 27.84 },
  { smiles: "C=C", name: "Ethene", rdkit: 14.41 },
  { smiles: "C=CC", name: "Propene", rdkit: 20.78 },
  { smiles: "c1ccccc1", name: "Benzene", rdkit: 37.43 },
  { smiles: "Cc1ccccc1", name: "Toluene", rdkit: 43.8 },
  { smiles: "CCO", name: "Ethanol", rdkit: 19.9 },
  { smiles: "COC", name: "Dimethyl ether", rdkit: 20.22 },
  { smiles: "CC(=O)C", name: "Acetone", rdkit: 25.63 },
  { smiles: "CN", name: "Methylamine", rdkit: 14.08 },
  { smiles: "CNC", name: "Dimethylamine", rdkit: 20.44 },
  { smiles: "CC(=O)Oc1ccccc1C(=O)O", name: "Aspirin", rdkit: 74.76 },
  { smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", name: "Ibuprofen", rdkit: 90.94 },
];

console.log("LabuteASA Validation against RDKit:\n");
console.log("Molecule              RDKit    openchem   Diff   Match");
console.log("=".repeat(60));

let totalDiff = 0;
let matches = 0;

for (const test of testMolecules) {
  const result = parseSMILES(test.smiles);
  const mol = result.molecules[0];
  if (!mol) {
    console.log(`${test.name.padEnd(20)} ERROR: Failed to parse SMILES`);
    continue;
  }
  const asa = getLabuteASA(mol);
  const diff = asa - test.rdkit;
  const match = Math.abs(diff) < 0.5 ? "✓" : "✗";

  if (Math.abs(diff) < 0.5) matches++;
  totalDiff += Math.abs(diff);

  console.log(
    `${test.name.padEnd(20)} ${test.rdkit.toFixed(2).padStart(7)} ${asa.toFixed(2).padStart(10)} ${diff.toFixed(2).padStart(7)}   ${match}`,
  );
}

console.log("=".repeat(60));
console.log(
  `Matches: ${matches}/${testMolecules.length} (${((matches / testMolecules.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Average absolute difference: ${(totalDiff / testMolecules.length).toFixed(2)} Ų`,
);
