#!/usr/bin/env node
/**
 * Test script for phenol-quinone tautomer enumeration
 * Tests the newly implemented phenol → quinone transformations
 */

import { parseSMILES, enumerateTautomers, generateSMILES } from "../index.ts";

console.log("=== Phenol-Quinone Tautomer Enumeration Test ===\n");

const testCases = [
  {
    name: "Phenol (simple)",
    smiles: "Oc1ccccc1",
    expectedMin: 2, // phenol + quinone
  },
  {
    name: "1,4-Dihydroxybenzene (hydroquinone)",
    smiles: "Oc1ccc(O)cc1",
    expectedMin: 3, // phenol + para-quinone + ortho-quinone
  },
  {
    name: "1,2,3-Trihydroxybenzene",
    smiles: "Oc1cccc(O)c1O",
    expectedMin: 4,
  },
  {
    name: "Hexahydroxybenzene",
    smiles: "Oc1c(O)c(O)c(O)c(O)c1O",
    expectedMin: 5, // Should enumerate multiple quinone forms
  },
  {
    name: "Resorcinol (1,3-dihydroxybenzene)",
    smiles: "Oc1cccc(O)c1",
    expectedMin: 3,
  },
];

for (const testCase of testCases) {
  console.log(`\n--- ${testCase.name} ---`);
  console.log(`Input SMILES: ${testCase.smiles}`);

  try {
    const parseResult = parseSMILES(testCase.smiles);
    if (!parseResult.molecules || parseResult.molecules.length === 0) {
      console.error(
        `❌ Failed to parse: ${parseResult.errors?.map((e) => e.message).join(", ") || "Unknown error"}`,
      );
      continue;
    }

    const mol = parseResult.molecules[0];
    const tautomers = enumerateTautomers(mol, { maxTautomers: 50 });

    console.log(`Generated tautomers: ${tautomers.length}`);
    console.log(`Expected minimum: ${testCase.expectedMin} (RDKit comparison)`);

    if (tautomers.length >= testCase.expectedMin) {
      console.log(`✅ PASS: Generated sufficient tautomers`);
    } else {
      console.log(`⚠️  WARN: Generated fewer tautomers than expected`);
    }

    // Show first 5 unique SMILES
    console.log("\nFirst 5 tautomers (SMILES):");
    const uniqueSmiles = new Set();
    for (let i = 0; i < Math.min(5, tautomers.length); i++) {
      const smiles = tautomers[i].smiles || generateSMILES(tautomers[i].molecule);
      if (smiles) {
        uniqueSmiles.add(smiles);
        console.log(`  ${i + 1}. ${smiles}`);
      }
    }

    // Check for quinone patterns
    let hasQuinone = false;
    for (const taut of tautomers) {
      const smiles = taut.smiles || generateSMILES(taut.molecule);
      if (smiles) {
        // Look for carbonyl pattern (quinone form: can be O= or =O depending on SMILES direction)
        if (/O=|=O/.test(smiles)) {
          hasQuinone = true;
          break;
        }
      }
    }

    if (hasQuinone) {
      console.log("✅ Contains quinone form (C=O detected)");
    } else {
      console.log("⚠️  No quinone form detected (expected C=O)");
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

console.log("\n=== Test Complete ===");
