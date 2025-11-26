import { describe, it } from "bun:test";
import { parseSMILES, parseIUPACName } from "index";
import type { Atom } from "types";

interface CaseAnalysis {
  name: string;
  expected: string;
  expAtoms: number;
  expBonds: number;
  expAtomTypes: string;
  generated: string;
  genAtoms: number;
  genBonds: number;
  genAtomTypes: string;
  atomDiff: number;
  bondDiff: number;
}

describe("Failure analysis", () => {
  it("should analyze all failures", () => {
    const failures: Array<[string, string, string]> = [
      [
        "6-hydroxy-7-methyl-9-oxabicyclo[3.3.1]nonan-2-one",
        "CC1CC2OC(CCC2=O)C1O",
        "C1(C(CCCC(CCC1)=O)C)O",
      ],
      [
        "(4-acetyl-5,5-dimethyl-2-propan-2-yloxolan-2-yl) acetate",
        "CC(=O)OC1(OC(C)(C)C(C(=O)C)C1)C(C)C",
        "CC(=O)OC1OC(C(C(C)C)(C(=O)C)C1)(C)C",
      ],
      [
        "(2-butanoyloxy-2-ethoxyethyl) butanoate",
        "O(C(OCC)COC(=O)CCC)C(CCC)=O",
        "O(C(OCC)COC(=O)CCC)C(CCC)=O",
      ],
      [
        "methyl 3-(2,2-dimethylbutanoylamino)-5-(3-methylbutyl)benzoate",
        "O=C(C(C)(C)CC)Nc1cc(C(=O)OC)cc(c1)CCC(C)C",
        "COC(c1cc(cc(c1)CCC(C)C)NC(=O)CC(C)(C)C)=O",
      ],
      ["1-(oxolan-2-yl)ethyl octanoate", "C1CCOC1C(OC(CCCCCCC)=O)C", "O(C(CCCCCCCCC)=O)C1CCCO1"],
      [
        "N-(3-chloro-4-fluorophenyl)-5-methylidene-4H-1,3-thiazol-2-amine",
        "Fc1c(Cl)cc(NC2=NCC(S2)=C)cc1",
        "Fc2c(Cl)cc(S1C(N)NCC1=C)cc2",
      ],
    ];

    const analysis: CaseAnalysis[] = [];

    for (const [name, exp, gen] of failures) {
      const expMol = parseSMILES(exp).molecules[0];
      const genMol = parseSMILES(gen).molecules[0];

      if (expMol && genMol) {
        const case_: CaseAnalysis = {
          name,
          expected: exp,
          expAtoms: expMol.atoms.length,
          expBonds: expMol.bonds.length,
          expAtomTypes: expMol.atoms
            .map((a: Atom) => a.symbol)
            .sort()
            .join(""),
          generated: gen,
          genAtoms: genMol.atoms.length,
          genBonds: genMol.bonds.length,
          genAtomTypes: genMol.atoms
            .map((a: Atom) => a.symbol)
            .sort()
            .join(""),
          atomDiff: genMol.atoms.length - expMol.atoms.length,
          bondDiff: genMol.bonds.length - expMol.bonds.length,
        };
        analysis.push(case_);
      }
    }

    // Sort by atom difference (closest to 0 first)
    analysis.sort((a, b) => Math.abs(a.atomDiff) - Math.abs(b.atomDiff));

    console.log("\nFailures sorted by atom count difference:");
    for (const c of analysis) {
      console.log(`\n${c.name}`);
      console.log(`  Atoms: exp=${c.expAtoms}, gen=${c.genAtoms}, diff=${c.atomDiff}`);
      console.log(`  Bonds: exp=${c.expBonds}, gen=${c.genBonds}, diff=${c.bondDiff}`);
      console.log(`  Types match: ${c.expAtomTypes === c.genAtomTypes}`);
      if (c.expAtomTypes !== c.genAtomTypes) {
        console.log(`    Expected: ${c.expAtomTypes}`);
        console.log(`    Generated: ${c.genAtomTypes}`);
      }
    }
  });
});
