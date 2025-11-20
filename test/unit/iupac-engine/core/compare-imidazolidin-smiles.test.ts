import { describe, it } from "bun:test";
import { parseSMILES } from "index";
import type { Atom } from "types";

describe("Imidazolidin SMILES comparison", () => {
  it("should compare expected vs generated SMILES", () => {
    const expected = "O=C1N(C(C)(C)NC1)N=C(C)C";
    const generated = "CC(=NN1C(=O)CNC1(C)C)C";

    const expMol = parseSMILES(expected);
    const genMol = parseSMILES(generated);

    console.log("\nExpected SMILES:", expected);
    if (expMol.molecules[0]) {
      console.log("  Atoms:", expMol.molecules[0].atoms.length);
      console.log(
        "  Types:",
        expMol.molecules[0].atoms
          .map((a: Atom) => a.symbol)
          .sort()
          .join(""),
      );
    }

    console.log("\nGenerated SMILES:", generated);
    if (genMol.molecules[0]) {
      console.log("  Atoms:", genMol.molecules[0].atoms.length);
      console.log(
        "  Types:",
        genMol.molecules[0].atoms
          .map((a: Atom) => a.symbol)
          .sort()
          .join(""),
      );
    }
  });
});
