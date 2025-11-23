import { parseSMILES } from "index";

const glucose = parseSMILES("OCC1OC(O)C(O)C(O)C1O");
const mol = glucose.molecules[0]!;

console.log(
  "Ring atoms:",
  mol.atoms.filter((a) => a.isInRing).map((a) => a.id),
);
console.log("\nNon-ring atoms and their neighbors:");

for (let i = 0; i < mol.atoms.length; i++) {
  const atom = mol.atoms[i]!;
  if (!atom.isInRing) {
    const bonds = mol.bonds.filter((b) => b.atom1 === i || b.atom2 === i);
    const neighbors = bonds.map((b) => {
      const nid = b.atom1 === i ? b.atom2 : b.atom1;
      const neighbor = mol.atoms[nid]!;
      return `${neighbor.symbol}${nid}(${neighbor.isInRing ? "ring" : "not-ring"})`;
    });
    console.log(`  ${atom.symbol}${i}: neighbors = [${neighbors.join(", ")}]`);
  }
}
