import { parseSMILES, renderSVG } from "index";

const molecules = [
  "c1ccccc1", // benzene
  "c1ccc2ccccc2c1", // naphthalene
  "C1CCCCCCC1", // cyclooctane
  "CC1=CC=C(C=C1)C(=O)O", // para-toluic acid
  "OCC1OC(O)C(O)C(O)C1O", // glucose
];

for (const smiles of molecules) {
  const result = parseSMILES(smiles);
  if (result.molecules.length > 0) {
    const svg = renderSVG(result.molecules[0]!, { width: 400, height: 400 });
    const quality = svg.svg.match(/layout-quality: total=([\d.]+)/)?.[1];
    console.log(`${smiles.padEnd(30)} quality=${quality}`);
  }
}
