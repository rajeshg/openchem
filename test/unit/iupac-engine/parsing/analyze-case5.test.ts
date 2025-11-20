import { describe, it } from "bun:test";
import { parseIUPACName, parseSMILES } from "index";

describe("Case 5 analysis", () => {
  it("should analyze methyl 3-(2,2-dimethylbutanoylamino)-5-(3-methylbutyl)benzoate", () => {
    const iupacName =
      "methyl 3-(2,2-dimethylbutanoylamino)-5-(3-methylbutyl)benzoate";
    const expected = "O=C(C(C)(C)CC)Nc1cc(C(=O)OC)cc(c1)CCC(C)C";

    console.log("\nIUPAC:", iupacName);
    console.log("Expected:", expected);

    const result = parseIUPACName(iupacName);
    console.log("\nGenerated molecule atoms:", result.molecule?.atoms.length);
    console.log("Expected atoms: 23");
    console.log("Difference: +3 atoms");

    if (result.molecule) {
      const atoms = result.molecule.atoms
        .map((a) => a.symbol)
        .sort()
        .join("");
      console.log("\nGenerated atoms:", atoms);
      console.log("Expected atoms: CCCCCCCCCCCCCCCCCCCNOOO");

      // Check the errors
      if (result.errors.length > 0) {
        console.log("\nErrors:", result.errors);
      } else {
        console.log("\nNo errors during parsing");
      }
    }
  });
});
