/**
 * Tautomer Enumeration and Canonical Selection Examples
 *
 * Demonstrates:
 * 1. Basic tautomer enumeration
 * 2. Keto-enol tautomerism
 * 3. Imine-enamine tautomerism
 * 4. Canonical tautomer selection
 * 5. Scoring interpretation
 * 6. Multi-site tautomerism
 */

import { parseSMILES, enumerateTautomers, canonicalTautomer, generateSMILES } from "index";

console.log("=".repeat(60));
console.log("Tautomer Enumeration Examples");
console.log("=".repeat(60));

// Example 1: Simple keto-enol tautomerism (acetone)
console.log("\n1. Simple Keto-Enol: Acetone");
console.log("-".repeat(60));
const acetone = parseSMILES("CC(=O)C").molecules[0];
if (acetone) {
  const tautomers = enumerateTautomers(acetone, { maxTautomers: 8 });
  console.log(`Found ${tautomers.length} tautomer(s):`);
  tautomers.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.smiles.padEnd(20)} (score: ${t.score})`);
  });

  const canonical = canonicalTautomer(acetone);
  console.log(`\nCanonical form: ${generateSMILES(canonical)}`);
  console.log("Interpretation: Keto form (C=O) is strongly preferred (+2 carbonyl bonus)");
}

// Example 2: Acetylacetone (multiple tautomerization sites)
console.log("\n2. Multi-Site Tautomerism: Acetylacetone (1,3-diketone)");
console.log("-".repeat(60));
const acetylacetone = parseSMILES("CC(=O)CC(=O)C").molecules[0];
if (acetylacetone) {
  const tautomers = enumerateTautomers(acetylacetone, { maxTautomers: 16 });
  console.log(`Found ${tautomers.length} tautomer(s):`);
  tautomers.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.smiles.padEnd(25)} (score: ${t.score})`);
  });

  const canonical = canonicalTautomer(acetylacetone);
  console.log(`\nCanonical form: ${generateSMILES(canonical)}`);
  console.log("Interpretation: Diketo form preferred (2 carbonyls = +4 score)");
}

// Example 3: Phenol (aromatic stabilization dominates)
console.log("\n3. Aromatic Stabilization: Phenol");
console.log("-".repeat(60));
const phenol = parseSMILES("c1ccccc1O").molecules[0];
if (phenol) {
  const tautomers = enumerateTautomers(phenol, { maxTautomers: 8 });
  console.log(`Found ${tautomers.length} tautomer(s):`);
  tautomers.forEach((t, i) => {
    const form = t.smiles.includes("c1ccccc1") ? "aromatic" : "keto";
    console.log(
      `  ${i + 1}. ${t.smiles.padEnd(20)} (score: ${t.score.toString().padStart(4)}) [${form}]`,
    );
  });

  const canonical = canonicalTautomer(phenol);
  console.log(`\nCanonical form: ${generateSMILES(canonical)}`);
  console.log("Interpretation: Aromatic form massively preferred (+250 aromatic ring bonus)");
}

// Example 4: Imine-enamine tautomerism
console.log("\n4. Imine-Enamine Tautomerism");
console.log("-".repeat(60));
const imine = parseSMILES("CC(=N)C").molecules[0];
if (imine) {
  const tautomers = enumerateTautomers(imine, { maxTautomers: 8 });
  console.log(`Found ${tautomers.length} tautomer(s):`);
  tautomers.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.smiles.padEnd(20)} (score: ${t.score})`);
  });

  const canonical = canonicalTautomer(imine);
  console.log(`\nCanonical form: ${generateSMILES(canonical)}`);
}

// Example 5: Pyridone vs. hydroxypyridine (aromatic + heteroatom effects)
console.log("\n5. Pyridone vs. Hydroxypyridine");
console.log("-".repeat(60));
const pyridone = parseSMILES("O=C1C=CC=CN1").molecules[0];
if (pyridone) {
  const tautomers = enumerateTautomers(pyridone, { maxTautomers: 8 });
  console.log(`Found ${tautomers.length} tautomer(s):`);
  tautomers.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.smiles.padEnd(20)} (score: ${t.score})`);
  });

  const canonical = canonicalTautomer(pyridone);
  console.log(`\nCanonical form: ${generateSMILES(canonical)}`);
  console.log("Interpretation: Aromatic + carbonyl bonuses determine preference");
}

// Example 6: Understanding the scoring system
console.log("\n6. Scoring System Breakdown");
console.log("-".repeat(60));
console.log("Score contributions:");
console.log("  +250 per all-carbon aromatic ring (benzene)");
console.log("  +100 per heteroaromatic ring (pyridine)");
console.log("  +25  for benzoquinone patterns");
console.log("  +4   for oximes (C=N-OH)");
console.log("  +2   per carbonyl (C=O, N=O, P=O)");
console.log("  +1   per methyl group");
console.log("  -1   per H on P, S, Se, Te");
console.log("  -4   for aci-nitro forms");
console.log("  -10  per formal charge");

// Example 7: Canonical tautomer selection workflow
console.log("\n7. Canonical Tautomer Selection Workflow");
console.log("-".repeat(60));
const molecules = [
  { name: "Acetone", smiles: "CC(=O)C" },
  { name: "Acetylacetone", smiles: "CC(=O)CC(=O)C" },
  { name: "2-Pyridone", smiles: "O=C1C=CC=CN1" },
  { name: "Imidazole", smiles: "c1cnc[nH]1" },
];

console.log("\nCanonical tautomers for common molecules:");
molecules.forEach(({ name, smiles }) => {
  const mol = parseSMILES(smiles).molecules[0];
  if (mol) {
    const canonical = canonicalTautomer(mol);
    const canonicalSmiles = generateSMILES(canonical);
    const tautomers = enumerateTautomers(mol, { maxTautomers: 8 });
    console.log(
      `  ${name.padEnd(20)} → ${canonicalSmiles.padEnd(20)} (${tautomers.length} form(s))`,
    );
  }
});

// Example 8: Controlling enumeration options
console.log("\n8. Enumeration Options");
console.log("-".repeat(60));
const complex = parseSMILES("CC(=O)CC(=O)CC(=O)C").molecules[0];
if (complex) {
  console.log("Default enumeration:");
  const defaultTauts = enumerateTautomers(complex);
  console.log(`  Found ${defaultTauts.length} tautomers`);

  console.log("\nLimited enumeration (max 8):");
  const limitedTauts = enumerateTautomers(complex, { maxTautomers: 8 });
  console.log(`  Found ${limitedTauts.length} tautomers`);

  // Note: V2 does not have phases - all transformations are applied iteratively
  console.log("\nAll transformations (V2 iterative approach):");
  console.log(`  Found ${limitedTauts.length} tautomers`);
}

console.log("\n" + "=".repeat(60));
console.log("Tautomer Enumeration Complete");
console.log("=".repeat(60));
