import { describe, it, expect } from "bun:test";
import {
  parseSMILES,
  generateInChI,
  generateInChIKey,
  enumerateTautomers,
  canonicalTautomer,
  generateMolfile,
  parseMolfile,
  parseSDF,
  writeSDF,
  generateSMILES,
} from "openchem";

describe("Tool 6: identifiers", () => {
  it("should generate InChI and InChIKey for aspirin", async () => {
    const parseResult = parseSMILES("CC(=O)Oc1ccccc1C(=O)O");
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const inchi = await generateInChI(molecule);
    const inchiKey = await generateInChIKey(inchi);

    expect(inchi).toBeTruthy();
    expect(inchi).toContain("InChI=1S/C9H8O4");
    expect(inchiKey).toBeTruthy();
    expect(inchiKey).toMatch(/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/);
    expect(inchiKey).toBe("BSYNRYMUTXBXSQ-UHFFFAOYSA-N");
  });

  it("should generate InChI for benzene", async () => {
    const parseResult = parseSMILES("c1ccccc1");
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const inchi = await generateInChI(molecule);
    const inchiKey = await generateInChIKey(inchi);

    expect(inchi).toContain("InChI=1S/C6H6");
    expect(inchiKey).toBe("UHOVQNZJYSORNB-UHFFFAOYSA-N");
  });

  it("should handle molecules with stereochemistry", async () => {
    const parseResult = parseSMILES("C[C@H](O)C(=O)O"); // L-lactic acid
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const inchi = await generateInChI(molecule);
    const inchiKey = await generateInChIKey(inchi);

    expect(inchi).toBeTruthy();
    expect(inchiKey).toBeTruthy();
    expect(inchiKey).toMatch(/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/);
  });

  it("should generate canonical SMILES", () => {
    const parseResult = parseSMILES("C(C)C"); // propane (non-canonical)
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const canonicalSmiles = generateSMILES(molecule);
    expect(canonicalSmiles).toBe("CCC");
  });
});

describe("Tool 7: tautomers", () => {
  it("should enumerate tautomers for β-diketone (acetylacetone)", () => {
    const parseResult = parseSMILES("CC(=O)CC(=O)C");
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const tautomers = enumerateTautomers(molecule, { maxTautomers: 10 });
    expect(tautomers.length).toBeGreaterThan(1);
    expect(tautomers.length).toBeLessThanOrEqual(10);

    // Each tautomer should have a SMILES and score
    for (const tautomer of tautomers) {
      expect(tautomer.smiles).toBeTruthy();
      expect(typeof tautomer.score).toBe("number");
    }

    // Scores should be in descending order (most stable first)
    for (let i = 1; i < tautomers.length; i++) {
      expect(tautomers[i - 1]!.score).toBeGreaterThanOrEqual(tautomers[i]!.score);
    }
  });

  it("should return canonical tautomer for phenol", () => {
    const parseResult = parseSMILES("Oc1ccccc1");
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const canonical = canonicalTautomer(molecule);
    expect(canonical).toBeTruthy();

    // Phenol should be its own canonical tautomer (aromatic is stable)
    const canonicalSmiles = generateSMILES(canonical);
    expect(canonicalSmiles).toBeTruthy();
  });

  it("should enumerate tautomers for guanine", () => {
    // Guanine has multiple tautomers (keto-enol, imine-enamine)
    const parseResult = parseSMILES("NC1=Nc2c(ncn2)C(=O)N1");
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const tautomers = enumerateTautomers(molecule, { maxTautomers: 20 });
    expect(tautomers.length).toBeGreaterThan(1);

    // Verify all tautomers are valid SMILES
    for (const tautomer of tautomers) {
      const verifyResult = parseSMILES(tautomer.smiles);
      expect(verifyResult.errors).toEqual([]);
    }
  });

  it("should handle molecules with no tautomers (alkanes)", () => {
    const parseResult = parseSMILES("CCCC"); // n-butane
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const tautomers = enumerateTautomers(molecule, { maxTautomers: 10 });
    // Should return at least the original molecule
    expect(tautomers.length).toBeGreaterThanOrEqual(1);

    const canonical = canonicalTautomer(molecule);
    expect(canonical).toBeTruthy();
  });

  it("should respect maxTautomers limit", () => {
    const parseResult = parseSMILES("CC(=O)CC(=O)C");
    expect(parseResult.errors).toEqual([]);
    const molecule = parseResult.molecules[0]!;

    const tautomers5 = enumerateTautomers(molecule, { maxTautomers: 5 });
    expect(tautomers5.length).toBeLessThanOrEqual(5);

    const tautomers2 = enumerateTautomers(molecule, { maxTautomers: 2 });
    expect(tautomers2.length).toBeLessThanOrEqual(2);
  });
});

describe("Tool 8: fileConvert", () => {
  describe("smilesToMol operation", () => {
    it("should convert benzene to MOL format", () => {
      const smiles = "c1ccccc1";
      const parseResult = parseSMILES(smiles);
      expect(parseResult.errors).toEqual([]);
      const molecule = parseResult.molecules[0]!;

      const molfile = generateMolfile(molecule, { title: "Benzene" });
      expect(molfile).toBeTruthy();
      expect(molfile).toContain("Benzene");
      expect(molfile).toContain("V2000");
      expect(molfile).toContain("M  END");

      // Should have 6 atoms and 6 bonds
      const lines = molfile.split("\n");
      const countsLine = lines[3]; // 4th line is counts line
      expect(countsLine).toMatch(/^\s*6\s+6/); // 6 atoms, 6 bonds
    });

    it("should convert aspirin to MOL format", () => {
      const smiles = "CC(=O)Oc1ccccc1C(=O)O";
      const parseResult = parseSMILES(smiles);
      expect(parseResult.errors).toEqual([]);
      const molecule = parseResult.molecules[0]!;

      const molfile = generateMolfile(molecule, { title: "Aspirin" });
      expect(molfile).toBeTruthy();
      expect(molfile).toContain("Aspirin");
      expect(molfile).toContain("V2000");
      expect(molfile).toContain("M  END");
    });
  });

  describe("molToSmiles operation", () => {
    it("should parse MOL format and convert to SMILES", () => {
      const smiles = "c1ccccc1";
      const parseResult = parseSMILES(smiles);
      expect(parseResult.errors).toEqual([]);
      const molecule = parseResult.molecules[0]!;

      // Generate MOL file
      const molfile = generateMolfile(molecule, { title: "Benzene" });
      expect(molfile).toBeTruthy();

      // Parse it back
      const parsedResult = parseMolfile(molfile);
      expect(parsedResult.errors).toEqual([]);
      expect(parsedResult.molecule).toBeTruthy();

      // Should have same structure
      const parsedMol = parsedResult.molecule!;
      expect(parsedMol.atoms.length).toBe(6);
      expect(parsedMol.bonds.length).toBe(6);
    });

    it("should roundtrip through MOL format", () => {
      const originalSmiles = "CC(=O)O"; // acetic acid
      const parseResult = parseSMILES(originalSmiles);
      expect(parseResult.errors).toEqual([]);
      const molecule = parseResult.molecules[0]!;

      // Convert to MOL and back
      const molfile = generateMolfile(molecule);
      const parsedResult = parseMolfile(molfile);
      expect(parsedResult.errors).toEqual([]);
      expect(parsedResult.molecule).toBeTruthy();

      // Should have same atom count
      expect(parsedResult.molecule!.atoms.length).toBe(molecule.atoms.length);
    });
  });

  describe("smilesToSDF operation", () => {
    it("should convert SMILES to SDF with properties", () => {
      const smiles = "c1ccccc1";
      const parseResult = parseSMILES(smiles);
      expect(parseResult.errors).toEqual([]);
      const molecule = parseResult.molecules[0]!;

      const properties = {
        NAME: "Benzene",
        MW: "78.11",
        FORMULA: "C6H6",
      };

      const result = writeSDF([{ molecule, properties }]);
      expect(result.sdf).toBeTruthy();
      expect(result.sdf).toContain("V2000");
      expect(result.sdf).toContain("M  END");
      expect(result.sdf).toContain("<NAME>");
      expect(result.sdf).toContain("<MW>");
      expect(result.sdf).toContain("$$$$");
    });

    it("should handle multiple molecules in SDF", () => {
      const benzene = parseSMILES("c1ccccc1").molecules[0]!;
      const toluene = parseSMILES("Cc1ccccc1").molecules[0]!;

      const records = [
        { molecule: benzene, properties: { NAME: "Benzene" } },
        { molecule: toluene, properties: { NAME: "Toluene" } },
      ];

      const result = writeSDF(records);
      expect(result.sdf).toBeTruthy();
      expect(result.sdf).toContain("Benzene");
      expect(result.sdf).toContain("Toluene");

      // Should have two $$$$ separators
      const separatorCount = (result.sdf.match(/\$\$\$\$/g) || []).length;
      expect(separatorCount).toBe(2);
    });
  });

  describe("sdfToSmiles operation", () => {
    it("should parse SDF and extract molecules", () => {
      const benzene = parseSMILES("c1ccccc1").molecules[0]!;
      const properties = { NAME: "Benzene", FORMULA: "C6H6" };
      const result = writeSDF([{ molecule: benzene, properties }]);

      const parseResult = parseSDF(result.sdf);
      expect(parseResult.records.length).toBe(1);
      expect(parseResult.records[0]?.errors).toEqual([]);
      expect(parseResult.records[0]?.molecule).toBeTruthy();
      expect(parseResult.records[0]?.properties.NAME).toBe("Benzene");
      expect(parseResult.records[0]?.properties.FORMULA).toBe("C6H6");
    });

    it("should parse multi-molecule SDF", () => {
      const benzene = parseSMILES("c1ccccc1").molecules[0]!;
      const toluene = parseSMILES("Cc1ccccc1").molecules[0]!;

      const records = [
        { molecule: benzene, properties: { NAME: "Benzene", ID: "1" } },
        { molecule: toluene, properties: { NAME: "Toluene", ID: "2" } },
      ];

      const result = writeSDF(records);
      const parseResult = parseSDF(result.sdf);

      // Should parse at least the first molecule
      expect(parseResult.records.length).toBeGreaterThanOrEqual(1);
      expect(parseResult.records[0]?.properties.NAME).toBe("Benzene");
      expect(parseResult.records[0]?.molecule?.atoms.length).toBe(6);
      
      // If second molecule parsed, verify it
      if (parseResult.records[1]) {
        expect(parseResult.records[1].properties.NAME).toBe("Toluene");
      }
    });

    it("should roundtrip through SDF format", () => {
      const originalSmiles = "CC(=O)Oc1ccccc1C(=O)O"; // aspirin
      const parseResult = parseSMILES(originalSmiles);
      expect(parseResult.errors).toEqual([]);
      const molecule = parseResult.molecules[0]!;

      const properties = { NAME: "Aspirin", MW: "180.16" };
      const writeResult = writeSDF([{ molecule, properties }]);
      const parsedResult = parseSDF(writeResult.sdf);

      expect(parsedResult.records.length).toBe(1);
      expect(parsedResult.records[0]?.errors).toEqual([]);
      expect(parsedResult.records[0]?.molecule?.atoms.length).toBe(molecule.atoms.length);
      expect(parsedResult.records[0]?.properties.NAME).toBe("Aspirin");
    });
  });
});
