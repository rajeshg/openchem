/**
 * Murcko Scaffold Analysis Example
 *
 * Demonstrates how to extract and compare molecular scaffolds for drug discovery.
 * Murcko scaffolds are core ring systems + linkers, with all side chains removed.
 */

import {
  parseSMILES,
  generateSMILES,
  getMurckoScaffold,
  getBemisMurckoFramework,
  getScaffoldTree,
  getGraphFramework,
  haveSameScaffold,
} from "index";

console.log("=== Murcko Scaffold Analysis ===\n");

// Example 1: Extract scaffold from drug-like molecules
console.log("1. Basic Scaffold Extraction");
console.log("----------------------------");

const drugMolecules = [
  { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { name: "Ibuprofen", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O" },
  { name: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1" },
  { name: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" },
];

for (const drug of drugMolecules) {
  const mol = parseSMILES(drug.smiles).molecules[0]!;
  const scaffold = getMurckoScaffold(mol);
  const scaffoldSMILES = generateSMILES(scaffold);

  console.log(`${drug.name}:`);
  console.log(`  Input:    ${drug.smiles}`);
  console.log(`  Scaffold: ${scaffoldSMILES}`);
  console.log();
}

// Example 2: Generic Bemis-Murcko Framework
console.log("\n2. Bemis-Murcko Framework (Generic Scaffold)");
console.log("---------------------------------------------");

const heterocycles = [
  { name: "Pyridine", smiles: "c1ccncc1" },
  { name: "Pyrrole", smiles: "c1cc[nH]c1" },
  { name: "Furan", smiles: "c1ccoc1" },
  { name: "Thiophene", smiles: "c1ccsc1" },
];

console.log("All heterocycles have the same generic framework (cyclohexane):\n");

for (const hetero of heterocycles) {
  const mol = parseSMILES(hetero.smiles).molecules[0]!;
  const framework = getBemisMurckoFramework(mol);
  const frameworkSMILES = generateSMILES(framework);

  console.log(`${hetero.name.padEnd(12)} → ${frameworkSMILES}`);
}

// Example 3: Scaffold Tree
console.log("\n\n3. Hierarchical Scaffold Decomposition");
console.log("--------------------------------------");

const naphthalene = parseSMILES("c1ccc2ccccc2c1").molecules[0]!;
const tree = getScaffoldTree(naphthalene);

console.log("Naphthalene scaffold tree:");
for (const [idx, scaffold] of tree.entries()) {
  const smiles = generateSMILES(scaffold);
  console.log(`  Level ${idx}: ${smiles} (${scaffold.atoms.length} atoms)`);
}

// Example 4: Graph Framework (Pure Topology)
console.log("\n\n4. Graph Framework (Topology Only)");
console.log("-----------------------------------");

const complexMol = parseSMILES("CN1C=NC2=C1C(=O)N(C(=O)N2C)C").molecules[0]!;
const graphFw = getGraphFramework(complexMol);
const graphSMILES = generateSMILES(graphFw);

console.log("Caffeine:");
console.log(`  Original:  CN1C=NC2=C1C(=O)N(C(=O)N2C)C`);
console.log(`  Scaffold:  ${generateSMILES(getMurckoScaffold(complexMol))}`);
console.log(`  Framework: ${generateSMILES(getBemisMurckoFramework(complexMol))}`);
console.log(`  Graph:     ${graphSMILES}`);

// Example 5: Scaffold Comparison
console.log("\n\n5. Scaffold-Based Compound Series Analysis");
console.log("-------------------------------------------");

const compounds = [
  { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { name: "Ibuprofen", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O" },
  { name: "Naproxen", smiles: "COc1ccc2cc(ccc2c1)C(C)C(=O)O" },
  { name: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" },
];

const molecules = compounds.map((c) => ({
  name: c.name,
  mol: parseSMILES(c.smiles).molecules[0]!,
}));

console.log("Scaffold similarity matrix:\n");

// Print header
process.stdout.write("".padEnd(12));
for (const { name } of molecules) {
  process.stdout.write(name.slice(0, 10).padEnd(12));
}
console.log();

// Print similarity matrix
for (const mol1 of molecules) {
  process.stdout.write(mol1.name.padEnd(12));
  for (const mol2 of molecules) {
    const same = haveSameScaffold(mol1.mol, mol2.mol);
    process.stdout.write((same ? "✓" : "✗").padEnd(12));
  }
  console.log();
}

console.log("\nObservations:");
console.log("• Aspirin and Ibuprofen share monocyclic benzene scaffold");
console.log("• Naproxen has bicyclic naphthalene scaffold");
console.log("• Caffeine has unique fused bicyclic imidazole scaffold");
console.log("• Useful for identifying compound series and lead optimization");

// Example 6: Practical Drug Discovery Workflow
console.log("\n\n6. Drug Discovery Workflow");
console.log("--------------------------");

const leadCompound = parseSMILES("CC(C)Cc1ccc(cc1)C(C)C(=O)O").molecules[0]!;
const leadScaffold = getMurckoScaffold(leadCompound);
const leadScaffoldSMILES = generateSMILES(leadScaffold);

console.log("Lead compound: Ibuprofen");
console.log(`Core scaffold: ${leadScaffoldSMILES}`);
console.log();

const libraryCompounds = [
  { smiles: "CCc1ccc(cc1)CC(C)C(=O)O", name: "Analog 1" },
  { smiles: "CC(C)Cc1ccccc1C(C)C(=O)O", name: "Analog 2" },
  { smiles: "c1ccc(cc1)CC(C)C(=O)O", name: "Analog 3" },
  { smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", name: "Unrelated" },
];

console.log("Screening library for similar scaffolds:");
for (const compound of libraryCompounds) {
  const mol = parseSMILES(compound.smiles).molecules[0]!;
  const same = haveSameScaffold(leadCompound, mol);
  const status = same ? "✓ MATCH" : "✗ Different scaffold";

  console.log(`  ${compound.name.padEnd(12)} ${status}`);
}

console.log("\n=== End of Murcko Scaffold Analysis ===");
