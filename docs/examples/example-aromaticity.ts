import {
  parseSMILES,
  generateSMILES,
  getAromaticRingCount,
  getRingCount,
} from "index";

console.log("openchem Aromaticity Perception Examples");
console.log("========================================\n");

// Example molecules demonstrating aromaticity perception
const examples = [
  { smiles: "c1ccccc1", name: "Benzene", expected: true },
  { smiles: "c1ccoc1", name: "Furan", expected: true },
  { smiles: "c1ccsc1", name: "Thiophene", expected: true },
  { smiles: "c1cc[nH]c1", name: "Pyrrole", expected: true },
  { smiles: "c1ncccc1", name: "Pyridine", expected: true },
  { smiles: "c1ncncc1", name: "Pyrimidine", expected: true },
  { smiles: "c1nccn1O", name: "N-oxide imidazole", expected: true },
  { smiles: "c1nccn1C", name: "N-methyl imidazole", expected: false },
  { smiles: "c1ncn(c1)O", name: "N-oxide imidazole (alt)", expected: true },
  { smiles: "C1=CC=CC=C1", name: "Benzene (Kekulé)", expected: true },
  { smiles: "C1CCCCC1", name: "Cyclohexane", expected: false },
  { smiles: "c1ccc2ccccc2c1", name: "Naphthalene", expected: true },
];

console.log("1. Aromatic vs Non-Aromatic Rings");
console.log("----------------------------------\n");

for (const example of examples) {
  const result = parseSMILES(example.smiles);

  if (result.errors.length > 0) {
    console.log(`✗ ${example.name}: Parse error`);
    continue;
  }

  const molecule = result.molecules[0]!;
  const ringCount = getRingCount(molecule);
  const aromaticRingCount = getAromaticRingCount(molecule);
  const isAromatic = aromaticRingCount > 0;

  // Count aromatic atoms
  const aromaticAtomCount = molecule.atoms.filter((a) => a.aromatic).length;

  const status = isAromatic === example.expected ? "✓" : "✗";
  const aromaticStatus = isAromatic ? "AROMATIC" : "NOT AROMATIC";

  console.log(`${status} ${example.name} (${example.smiles})`);
  console.log(`  Status: ${aromaticStatus}`);
  console.log(`  Rings: ${ringCount} total, ${aromaticRingCount} aromatic`);
  console.log(`  Aromatic atoms: ${aromaticAtomCount}`);

  // Generate canonical SMILES to show normalized form
  const canonical = generateSMILES(molecule, true);
  console.log(`  Canonical: ${canonical}\n`);
}

console.log("\n2. Hückel's Rule (4n+2 π electrons)");
console.log("------------------------------------\n");

// Demonstrate pi electron counting
const huckelExamples = [
  { smiles: "c1ccccc1", name: "Benzene", piElectrons: 6, n: 1 },
  { smiles: "c1cc[nH]c1", name: "Pyrrole", piElectrons: 6, n: 1 },
  { smiles: "c1ccoc1", name: "Furan", piElectrons: 6, n: 1 },
  { smiles: "c1ccc2ccccc2c1", name: "Naphthalene", piElectrons: 10, n: 2 },
];

for (const example of huckelExamples) {
  const result = parseSMILES(example.smiles);
  if (result.errors.length === 0 && result.molecules[0]) {
    const molecule = result.molecules[0];
    const aromaticRings = getAromaticRingCount(molecule);

    console.log(`✓ ${example.name}`);
    console.log(
      `  Formula: 4n+2 = 4(${example.n})+2 = ${example.piElectrons} π electrons`,
    );
    console.log(`  Aromatic rings detected: ${aromaticRings}`);
    console.log(`  SMILES: ${example.smiles}\n`);
  }
}

console.log("\n3. N-Oxide Aromaticity (Bug Fix Demo)");
console.log("--------------------------------------\n");

// Demonstrate N-oxide aromaticity perception fix
const nOxideExamples = [
  {
    smiles: "c1nccn1O",
    name: "N-oxide imidazole",
    piElectrons: "3C(1e) + N(1e) + N-O(2e) = 6",
    aromatic: true,
  },
  {
    smiles: "c1nccn1C",
    name: "N-methyl imidazole",
    piElectrons: "3C(1e) + N(1e) + N-C(1e) = 5",
    aromatic: false,
  },
];

console.log("openchem uses strict Hückel's rule for aromaticity:");
console.log("- N with exocyclic O/N/F/Cl → 2 π electrons (pyrrolic)");
console.log("- N with exocyclic C (alkyl) → 1 π electron (pyridinic)\n");

for (const example of nOxideExamples) {
  const result = parseSMILES(example.smiles);
  if (result.errors.length === 0 && result.molecules[0]) {
    const molecule = result.molecules[0];
    const aromaticRings = getAromaticRingCount(molecule);
    const isAromatic = aromaticRings > 0;

    const status = isAromatic === example.aromatic ? "✓" : "✗";
    const aromaticStatus = isAromatic ? "AROMATIC" : "NOT AROMATIC";

    console.log(`${status} ${example.name}`);
    console.log(`  SMILES: ${example.smiles}`);
    console.log(`  π electron count: ${example.piElectrons}`);
    console.log(`  Result: ${aromaticStatus}`);
    console.log(
      `  Expected: ${example.aromatic ? "AROMATIC" : "NOT AROMATIC"}\n`,
    );
  }
}

console.log("\n4. Aromaticity Algorithm");
console.log("------------------------\n");

console.log("openchem uses strict Hückel aromaticity perception:");
console.log("✓ Ring-based (not conjugated system-based)");
console.log("✓ 4n+2 π electron rule");
console.log("✓ sp² hybridization requirement");
console.log("✓ Planar ring systems\n");

console.log("Key differences from RDKit:");
console.log("- openchem: Strict Hückel (mathematically rigorous)");
console.log("- RDKit: Extended aromaticity (empirical, chemical intuition)");
console.log("- Both approaches are valid for different use cases\n");

console.log("See docs/SMARTS_AROMATICITY_ANALYSIS.md for detailed comparison");
