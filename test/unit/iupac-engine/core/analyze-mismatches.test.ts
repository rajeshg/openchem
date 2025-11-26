import { describe, it } from "bun:test";
import { parseSMILES } from "index";
import type { Atom } from "types";

describe("Analyze mismatches", () => {
  it("should analyze differences", () => {
    const mismatches = [
      {
        name: "6-hydroxy-7-methyl-9-oxabicyclo[3.3.1]nonan-2-one",
        expected: "CC1CC2OC(CCC2=O)C1O",
        generated: "C1(C(CCCC(CCC1)=O)C)O",
      },
      {
        name: "(4-acetyl-5,5-dimethyl-2-propan-2-yloxolan-2-yl) acetate",
        expected: "CC(=O)OC1(OC(C)(C)C(C(=O)C)C1)C(C)C",
        generated: "CC(=O)OC1OC(C(C(C)C)(C(=O)C)C1)(C)C",
      },
      {
        name: "1-(oxolan-2-yl)ethyl octanoate",
        expected: "C1CCOC1C(OC(CCCCCCC)=O)C",
        generated: "O(C(CCCCCCCCC)=O)C1CCCO1",
      },
    ];

    for (const m of mismatches) {
      const exp = parseSMILES(m.expected);
      const gen = parseSMILES(m.generated);

      const expAtoms = exp.molecules[0]?.atoms.length ?? 0;
      const genAtoms = gen.molecules[0]?.atoms.length ?? 0;
      const expBonds = exp.molecules[0]?.bonds.length ?? 0;
      const genBonds = gen.molecules[0]?.bonds.length ?? 0;

      console.log(`\n${m.name}`);
      console.log(`  Expected: ${expAtoms} atoms, ${expBonds} bonds`);
      console.log(`  Generated: ${genAtoms} atoms, ${genBonds} bonds`);
      console.log(`  Diff: ${genAtoms - expAtoms} atoms, ${genBonds - expBonds} bonds`);
    }
  });
});
