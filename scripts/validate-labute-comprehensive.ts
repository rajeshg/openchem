import { parseSMILES, getLabuteASA } from "../index.ts";

const testMolecules = [
  // Simple alkanes
  { smiles: "CC", name: "Ethane", rdkit: 15.1 },
  { smiles: "CCC", name: "Propane", rdkit: 21.47 },
  { smiles: "CCCC", name: "Butane", rdkit: 27.84 },

  // Alkenes
  { smiles: "C=C", name: "Ethene", rdkit: 14.41 },
  { smiles: "C=CC", name: "Propene", rdkit: 20.78 },

  // Aromatics
  { smiles: "c1ccccc1", name: "Benzene", rdkit: 37.43 },
  { smiles: "Cc1ccccc1", name: "Toluene", rdkit: 43.8 },

  // Alcohols
  { smiles: "CCO", name: "Ethanol", rdkit: 19.9 },
  { smiles: "Oc1ccccc1", name: "Phenol", rdkit: 42.23 },

  // Ethers
  { smiles: "COC", name: "Dimethyl ether", rdkit: 20.22 },

  // Ketones
  { smiles: "CC(=O)C", name: "Acetone", rdkit: 25.63 },

  // Amines
  { smiles: "CN", name: "Methylamine", rdkit: 14.08 },
  { smiles: "CNC", name: "Dimethylamine", rdkit: 20.44 },
  { smiles: "Nc1ccccc1", name: "Aniline", rdkit: 42.77 },

  // Carboxylic acids
  { smiles: "CC(=O)O", name: "Acetic acid", rdkit: 24.06 },
  { smiles: "c1ccccc1C(=O)O", name: "Benzoic acid", rdkit: 52.75 },

  // Esters
  { smiles: "CC(=O)OC", name: "Methyl acetate", rdkit: 30.74 },
  { smiles: "CC(=O)OCC", name: "Ethyl acetate", rdkit: 37.11 },

  // Heterocycles
  { smiles: "c1ccncc1", name: "Pyridine", rdkit: 36.65 },

  // Drug molecules
  { smiles: "CC(=O)Oc1ccccc1C(=O)O", name: "Aspirin", rdkit: 74.76 },
  { smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", name: "Ibuprofen", rdkit: 90.94 },
];

console.log("LabuteASA Comprehensive Validation against RDKit:\n");
console.log("Molecule              RDKit    openchem   Diff   Match");
console.log("=".repeat(60));

let totalDiff = 0;
let matches = 0;
let closeMatches = 0; // Within 1.0 Ų

for (const test of testMolecules) {
  const result = parseSMILES(test.smiles);
  const mol = result.molecules[0];
  if (!mol) {
    console.log(`${test.name.padEnd(20)} ERROR: Failed to parse SMILES`);
    continue;
  }
  const asa = getLabuteASA(mol);
  const diff = asa - test.rdkit;
  const match = Math.abs(diff) < 0.5 ? "✓" : Math.abs(diff) < 1.0 ? "~" : "✗";

  if (Math.abs(diff) < 0.5) matches++;
  if (Math.abs(diff) < 1.0) closeMatches++;
  totalDiff += Math.abs(diff);

  console.log(
    `${test.name.padEnd(20)} ${test.rdkit.toFixed(2).padStart(7)} ${asa.toFixed(2).padStart(10)} ${diff.toFixed(2).padStart(7)}   ${match}`,
  );
}

console.log("=".repeat(60));
console.log(
  `Exact matches (<0.5 Ų): ${matches}/${testMolecules.length} (${((matches / testMolecules.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Close matches (<1.0 Ų): ${closeMatches}/${testMolecules.length} (${((closeMatches / testMolecules.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Average absolute difference: ${(totalDiff / testMolecules.length).toFixed(2)} Ų`,
);
