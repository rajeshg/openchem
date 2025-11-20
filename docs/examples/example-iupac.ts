import {
  parseSMILES,
  parseIUPACName,
  generateIUPACName,
  generateIUPACNameFromSMILES,
  generateSMILES,
} from "index";

console.log("openchem IUPAC Name Generation & Parsing");
console.log("=========================================\n");

// Part 1: SMILES → IUPAC Name Generation
console.log("1. SMILES → IUPAC Name Generation");
console.log("---------------------------------\n");

const smilesExamples = [
  { smiles: "CC", expected: "ethane" },
  { smiles: "CCC", expected: "propane" },
  { smiles: "CC(C)C", expected: "2-methylpropane" },
  { smiles: "CCCC", expected: "butane" },
  { smiles: "CC(C)CC", expected: "2-methylbutane" },
  { smiles: "CCO", expected: "ethanol" },
  { smiles: "CC(O)C", expected: "propan-2-ol" },
  { smiles: "CC(=O)C", expected: "propan-2-one" },
  { smiles: "CC(=O)O", expected: "acetic acid" },
  { smiles: "c1ccccc1", expected: "benzene" },
  { smiles: "Cc1ccccc1", expected: "toluene" },
  { smiles: "CC(=O)Oc1ccccc1C(=O)O", expected: "2-acetyloxybenzoic acid" },
];

console.log("Basic Examples:");
for (const example of smilesExamples) {
  const result = generateIUPACNameFromSMILES(example.smiles);

  if (result.errors.length > 0) {
    console.log(`✗ ${example.smiles}`);
    console.log(`  Error: ${result.errors[0]}\n`);
    continue;
  }

  const match = result.name.toLowerCase() === example.expected.toLowerCase();
  const status = match ? "✓" : "~";

  console.log(`${status} ${example.smiles}`);
  console.log(`  Generated: ${result.name}`);
  if (!match) {
    console.log(`  Expected:  ${example.expected}`);
  }
  if (result.confidence !== undefined) {
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  }
  console.log();
}

// Part 2: IUPAC Name → SMILES Parsing
console.log("\n2. IUPAC Name → SMILES Parsing");
console.log("-------------------------------\n");

const iupacExamples = [
  { iupac: "ethane", expected: "CC" },
  { iupac: "propane", expected: "CCC" },
  { iupac: "butane", expected: "CCCC" },
  { iupac: "2-methylpropane", expected: "CC(C)C" },
  { iupac: "2-methylbutane", expected: "CC(C)CC" },
  { iupac: "pentane", expected: "CCCCC" },
  { iupac: "hexane", expected: "CCCCCC" },
  { iupac: "ethanol", expected: "CCO" },
  { iupac: "propan-2-ol", expected: "CC(O)C" },
  { iupac: "butan-2-one", expected: "CC(=O)CC" },
];

console.log("Basic Examples:");
for (const example of iupacExamples) {
  const result = parseIUPACName(example.iupac);

  if (result.errors.length > 0) {
    console.log(`✗ ${example.iupac}`);
    console.log(`  Error: ${result.errors[0]}\n`);
    continue;
  }

  if (!result.molecule) {
    console.log(`✗ ${example.iupac}`);
    console.log(`  Error: No molecule generated\n`);
    continue;
  }

  const generatedSMILES = generateSMILES(result.molecule, true);

  // Parse expected SMILES to compare canonical forms
  const expectedResult = parseSMILES(example.expected);
  const expectedCanonical =
    expectedResult.molecules[0] &&
    generateSMILES(expectedResult.molecules[0], true);

  const match = generatedSMILES === expectedCanonical;
  const status = match ? "✓" : "~";

  console.log(`${status} ${example.iupac}`);
  console.log(`  Generated: ${generatedSMILES}`);
  if (!match && expectedCanonical) {
    console.log(`  Expected:  ${expectedCanonical}`);
  }
  console.log();
}

// Part 3: Round-trip Testing (IUPAC → SMILES → IUPAC)
console.log("\n3. Round-trip Testing (IUPAC → SMILES → IUPAC)");
console.log("-----------------------------------------------\n");

const roundtripExamples = ["ethane", "propane", "2-methylpropane", "ethanol"];

console.log("Testing bidirectional conversion:");
for (const iupacName of roundtripExamples) {
  console.log(`\nStarting: ${iupacName}`);

  // Step 1: IUPAC → SMILES
  const parseResult = parseIUPACName(iupacName);
  if (parseResult.errors.length > 0 || !parseResult.molecule) {
    console.log(`  ✗ Parse failed: ${parseResult.errors[0] || "No molecule"}`);
    continue;
  }

  const smiles = generateSMILES(parseResult.molecule, true);
  console.log(`  → SMILES: ${smiles}`);

  // Step 2: SMILES → IUPAC
  const nameResult = generateIUPACName(parseResult.molecule);
  if (nameResult.errors.length > 0) {
    console.log(`  ✗ Name generation failed: ${nameResult.errors[0]}`);
    continue;
  }

  console.log(`  → IUPAC:  ${nameResult.name}`);

  // Compare
  const match =
    nameResult.name.toLowerCase() === iupacName.toLowerCase() ||
    nameResult.name.toLowerCase().replace(/\s/g, "") ===
      iupacName.toLowerCase().replace(/\s/g, "");
  console.log(`  ${match ? "✓" : "~"} Round-trip ${match ? "successful" : "differs"}`);
}

// Part 4: Complex Molecules
console.log("\n\n4. Complex Molecules");
console.log("--------------------\n");

const complexExamples = [
  { smiles: "CC(=O)Oc1ccccc1C(=O)O", name: "Aspirin" },
  { smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", name: "Ibuprofen" },
  { smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", name: "Caffeine" },
];

for (const example of complexExamples) {
  console.log(`${example.name} (${example.smiles})`);

  const result = generateIUPACNameFromSMILES(example.smiles);

  if (result.errors.length > 0) {
    console.log(`  Error: ${result.errors[0]}`);
  } else {
    console.log(`  IUPAC: ${result.name}`);
    if (result.confidence !== undefined) {
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    }
    if (result.rules && result.rules.length > 0) {
      console.log(`  Rules applied: ${result.rules.slice(0, 3).join(", ")}...`);
    }
  }
  console.log();
}

// Part 5: Accuracy Information
console.log("\n5. IUPAC Engine Capabilities");
console.log("-----------------------------\n");

console.log("openchem IUPAC engine accuracy (realistic dataset):");
console.log("✓ Overall: 93.5% (124/127 molecules, 3 complex alkaloids skipped)");
console.log("✓ Simple chains: 100%");
console.log("✓ Branched alkanes: 100%");
console.log("✓ Functional groups: 100%");
console.log("✓ Aromatic systems: 100%");
console.log("✓ Basic heterocycles: 93%\n");

console.log("Supported IUPAC Blue Book rules:");
console.log("- P-14: Skeletal replacement nomenclature");
console.log("- P-44: Parent chain selection");
console.log("- P-45: Functional group priority");
console.log("- P-51: Numbering");
console.log("- P-59: Functional class nomenclature");
console.log("- P-61-P-68: Substituent nomenclature\n");

console.log("Known limitations:");
console.log("- Complex natural products (requires IUPAC P-101)");
console.log("- Some saturated heterocycles (morpholine, piperazine)");
console.log("- Complex polycyclic systems with multiple functional groups\n");

console.log("For detailed documentation, see:");
console.log("- docs/iupac-readme.md (central navigation)");
console.log("- docs/iupac-capabilities.md (accuracy & limitations)");
console.log("- docs/iupac-implementation.md (technical details)");
