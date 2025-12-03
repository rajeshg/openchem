import type { Atom, Bond, Molecule, BondType } from "types";
import { BondType as BondTypeEnum } from "types";
import { RingStructureBuilders, type RingBuilderContext } from "./ring-structure-builders";
import { SubstituentBuilders, type SubstituentBuilderContext } from "./substituent-builders";
import { PolycyclicBuilders, type PolycyclicBuilderContext } from "./polycyclic-builders";

export class MoleculeGraphBuilder
  implements RingBuilderContext, SubstituentBuilderContext, PolycyclicBuilderContext
{
  private atoms: Array<{
    id: number;
    symbol: string;
    atomicNumber: number;
    charge: number;
    hydrogens: number;
    isotope: number | null;
    aromatic: boolean;
    chiral: string | null;
    isBracket: boolean;
    atomClass: number;
  }> = [];

  private bonds: Array<{
    atom1: number;
    atom2: number;
    type: BondType;
    stereo: "none" | "up" | "down" | "either";
  }> = [];

  private atomicNumbers: Record<string, number> = {
    H: 1,
    C: 6,
    N: 7,
    O: 8,
    F: 9,
    P: 15,
    S: 16,
    Cl: 17,
    Br: 35,
    I: 53,
    Si: 14,
  };

  private amineNitrogenIndices: number[] = [];

  private ringBuilder: RingStructureBuilders;
  private substituentBuilder: SubstituentBuilders;
  private polycyclicBuilder: PolycyclicBuilders;

  constructor() {
    this.ringBuilder = new RingStructureBuilders(this);
    this.substituentBuilder = new SubstituentBuilders(this);
    this.polycyclicBuilder = new PolycyclicBuilders(this);
  }

  addCarbon(): number {
    const id = this.atoms.length;
    this.atoms.push({
      id,
      symbol: "C",
      atomicNumber: 6,
      charge: 0,
      hydrogens: 0,
      isotope: null,
      aromatic: false,
      chiral: null,
      isBracket: false,
      atomClass: 0,
    });
    return id;
  }

  addAtom(element: string, aromatic = false): number {
    const id = this.atoms.length;
    const atomicNumber = this.atomicNumbers[element] ?? 6;
    this.atoms.push({
      id,
      symbol: element,
      atomicNumber,
      charge: 0,
      hydrogens: 0,
      isotope: null,
      aromatic,
      chiral: null,
      isBracket: false,
      atomClass: 0,
    });
    return id;
  }

  setHydrogens(atomIdx: number, hydrogens: number): void {
    if (atomIdx >= 0 && atomIdx < this.atoms.length) {
      const atom = this.atoms[atomIdx]!;
      atom.hydrogens = hydrogens;
      if (atom.aromatic && atom.symbol === "N" && hydrogens > 0) {
        atom.isBracket = true;
      }
    }
  }

  saturateAtom(atomIdx: number): void {
    if (atomIdx >= 0 && atomIdx < this.atoms.length) {
      const atom = this.atoms[atomIdx]!;
      if (process.env.VERBOSE) {
        console.log(`[builder] Saturating atom ${atomIdx} (${atom.symbol}) - removing aromaticity`);
      }
      atom.aromatic = false;

      this.bonds.forEach((bond) => {
        if (
          (bond.atom1 === atomIdx || bond.atom2 === atomIdx) &&
          bond.type === BondTypeEnum.AROMATIC
        ) {
          bond.type = BondTypeEnum.SINGLE;
          if (process.env.VERBOSE) {
            console.log(`[builder] Converted bond ${bond.atom1}-${bond.atom2} to SINGLE`);
          }
        }
      });

      // Check if saturation breaks conjugation for neighboring heteroatoms
      this.checkAndDeAromatizeNeighboringHeteroatoms(atomIdx);
    }
  }

  convertRingDoubleBondsToSingle(atomIdx: number): void {
    if (atomIdx < 0 || atomIdx >= this.atoms.length) return;

    const atom = this.atoms[atomIdx]!;
    atom.aromatic = false;

    this.bonds.forEach((bond) => {
      if (bond.atom1 === atomIdx || bond.atom2 === atomIdx) {
        if (bond.type === BondTypeEnum.DOUBLE || bond.type === BondTypeEnum.AROMATIC) {
          bond.type = BondTypeEnum.SINGLE;
          if (process.env.VERBOSE) {
            console.log(
              `[builder] Converted ring bond ${bond.atom1}-${bond.atom2} from ${bond.type} to SINGLE for alkylidene`,
            );
          }
        }
      }
    });
  }

  setCharge(atomIdx: number, charge: number): void {
    if (atomIdx >= 0 && atomIdx < this.atoms.length) {
      const atom = this.atoms[atomIdx]!;
      atom.charge = charge;
      if (charge !== 0) {
        atom.isBracket = true;
      }
    }
  }

  addBond(atom1: number, atom2: number, type: BondType = BondTypeEnum.SINGLE): void {
    this.bonds.push({
      atom1,
      atom2,
      type,
      stereo: "none",
    });

    const a1 = this.atoms[atom1];
    if (a1 && a1.aromatic && a1.symbol === "N" && a1.hydrogens > 0) {
      a1.hydrogens--;
      if (a1.hydrogens === 0) a1.isBracket = false;
    }

    const a2 = this.atoms[atom2];
    if (a2 && a2.aromatic && a2.symbol === "N" && a2.hydrogens > 0) {
      a2.hydrogens--;
      if (a2.hydrogens === 0) a2.isBracket = false;
    }
  }

  replaceAtom(atomIdx: number, element: string): void {
    if (atomIdx >= 0 && atomIdx < this.atoms.length) {
      const atom = this.atoms[atomIdx]!;
      atom.symbol = element;
      atom.atomicNumber = this.atomicNumbers[element] || 0;
      atom.hydrogens = 0;
    }
  }

  createLinearChain(length: number): number[] {
    const atomIndices: number[] = [];

    for (let i = 0; i < length; i++) {
      const atomIdx = this.addCarbon();
      atomIndices.push(atomIdx);

      if (i > 0) {
        this.addBond(atomIndices[i - 1]!, atomIdx);
      }
    }

    return atomIndices;
  }

  createCyclicChain(size: number, aromatic = false): number[] {
    const atomIndices: number[] = [];

    for (let i = 0; i < size; i++) {
      const atomIdx = aromatic ? this.addAtom("C", true) : this.addCarbon();
      atomIndices.push(atomIdx);

      if (i > 0) {
        const bondType = aromatic ? BondTypeEnum.AROMATIC : BondTypeEnum.SINGLE;
        this.addBond(atomIndices[i - 1]!, atomIdx, bondType);
      }
    }

    if (atomIndices.length > 2) {
      const bondType = aromatic ? BondTypeEnum.AROMATIC : BondTypeEnum.SINGLE;
      this.addBond(atomIndices[atomIndices.length - 1]!, atomIndices[0]!, bondType);
    }

    return atomIndices;
  }

  /**
   * Create a cyclic chain with heteroatom replacements.
   * @param size Total ring size
   * @param heteroatoms Array of {position, element} where position is 1-based (IUPAC numbering)
   * @param aromatic Whether the ring is aromatic
   */
  createCyclicChainWithHeteroatoms(
    size: number,
    heteroatoms: Array<{ position: number; element: string }>,
    aromatic = false,
  ): number[] {
    const atomIndices: number[] = [];

    // Convert 1-based positions to 0-based indices for internal use
    const heteroPositions = new Map<number, string>();
    for (const h of heteroatoms) {
      heteroPositions.set(h.position - 1, h.element); // Convert to 0-based
    }

    for (let i = 0; i < size; i++) {
      let atomIdx: number;
      const heteroElement = heteroPositions.get(i);
      if (heteroElement) {
        // Add heteroatom
        atomIdx = this.addAtom(heteroElement, aromatic);
      } else {
        // Add carbon
        atomIdx = aromatic ? this.addAtom("C", true) : this.addCarbon();
      }
      atomIndices.push(atomIdx);

      if (i > 0) {
        const bondType = aromatic ? BondTypeEnum.AROMATIC : BondTypeEnum.SINGLE;
        this.addBond(atomIndices[i - 1]!, atomIdx, bondType);
      }
    }

    // Close the ring
    if (atomIndices.length > 2) {
      const bondType = aromatic ? BondTypeEnum.AROMATIC : BondTypeEnum.SINGLE;
      this.addBond(atomIndices[atomIndices.length - 1]!, atomIndices[0]!, bondType);
    }

    return atomIndices;
  }

  createBenzeneRing(): number[] {
    return this.createCyclicChain(6, true);
  }

  createNaphthaleneRing(): number[] {
    return this.ringBuilder.createNaphthaleneRing();
  }

  createOxiraneRing(): number[] {
    return this.ringBuilder.createOxiraneRing();
  }

  createOxetaneRing(): number[] {
    return this.ringBuilder.createOxetaneRing();
  }

  createAzetidineRing(): number[] {
    return this.ringBuilder.createAzetidineRing();
  }

  createOxolanRing(): number[] {
    return this.ringBuilder.createOxolanRing();
  }

  createTriazineRing(): number[] {
    return this.ringBuilder.createTriazineRing();
  }

  createFuranRing(): number[] {
    return this.ringBuilder.createFuranRing();
  }

  createThiopheneRing(): number[] {
    return this.ringBuilder.createThiopheneRing();
  }

  createPyrroleRing(): number[] {
    return this.ringBuilder.createPyrroleRing();
  }

  createPyridineRing(): number[] {
    return this.ringBuilder.createPyridineRing();
  }

  createThiazoleRing(): number[] {
    return this.ringBuilder.createThiazoleRing();
  }

  createOxazoleRing(): number[] {
    return this.ringBuilder.createOxazoleRing();
  }

  createMorpholineRing(): number[] {
    return this.ringBuilder.createMorpholineRing();
  }

  createPiperidineRing(): number[] {
    return this.ringBuilder.createPiperidineRing();
  }

  createPyrrolidineRing(): number[] {
    return this.ringBuilder.createPyrrolidineRing();
  }

  createPiperazineRing(): number[] {
    return this.ringBuilder.createPiperazineRing();
  }

  createOxaneRing(): number[] {
    return this.ringBuilder.createOxaneRing();
  }

  createThianeRing(): number[] {
    return this.ringBuilder.createThianeRing();
  }

  createThiolaneRing(): number[] {
    return this.ringBuilder.createThiolaneRing();
  }

  createQuinolineRing(): number[] {
    return this.ringBuilder.createQuinolineRing();
  }

  createIndoleRing(): number[] {
    return this.ringBuilder.createIndoleRing();
  }

  createBenzofuranRing(): number[] {
    return this.ringBuilder.createBenzofuranRing();
  }

  createIsoindolRing(): number[] {
    return this.ringBuilder.createIsoindolRing();
  }

  createDiaziridineRing(): number[] {
    return this.ringBuilder.createDiaziridineRing();
  }

  createAzirineRing(): number[] {
    return this.ringBuilder.createAzirineRing();
  }

  createImidazolidineRing(): number[] {
    return this.ringBuilder.createImidazolidineRing();
  }

  createTriazoleRing(): number[] {
    return this.ringBuilder.createTriazoleRing();
  }

  createPyrazoleRing(): number[] {
    return this.ringBuilder.createPyrazoleRing();
  }

  createImidazoleRing(): number[] {
    return this.ringBuilder.createImidazoleRing();
  }

  createIsoxazoleRing(): number[] {
    return this.ringBuilder.createIsoxazoleRing();
  }

  createTetrazoleRing(): number[] {
    return this.ringBuilder.createTetrazoleRing();
  }

  createIsothiazoleRing(): number[] {
    return this.ringBuilder.createIsothiazoleRing();
  }

  createPyrimidineRing(): number[] {
    return this.ringBuilder.createPyrimidineRing();
  }

  createPyrazineRing(): number[] {
    return this.ringBuilder.createPyrazineRing();
  }

  createPyridazineRing(): number[] {
    return this.ringBuilder.createPyridazineRing();
  }

  createThiazoleSaturated(): number[] {
    return this.ringBuilder.createThiazoleSaturated();
  }

  createOxazoleSaturated(): number[] {
    return this.ringBuilder.createOxazoleSaturated();
  }

  createImidazoleSaturated(): number[] {
    return this.ringBuilder.createImidazoleSaturated();
  }

  createIsothiazoleSaturated(): number[] {
    return this.ringBuilder.createIsothiazoleSaturated();
  }

  createPyrazoleSaturated(): number[] {
    return this.ringBuilder.createPyrazoleSaturated();
  }

  createBenzothiopheneRing(): number[] {
    return this.ringBuilder.createBenzothiopheneRing();
  }

  createBenzimidazoleRing(): number[] {
    return this.ringBuilder.createBenzimidazoleRing();
  }

  createBenzoxazoleRing(): number[] {
    return this.ringBuilder.createBenzoxazoleRing();
  }

  createBenzothiazoleRing(): number[] {
    return this.ringBuilder.createBenzothiazoleRing();
  }

  createIndazoleRing(): number[] {
    return this.ringBuilder.createIndazoleRing();
  }

  createBenzotriazoleRing(): number[] {
    return this.ringBuilder.createBenzotriazoleRing();
  }

  create134OxadiazoleRing(): number[] {
    return this.ringBuilder.create134OxadiazoleRing();
  }

  create124OxadiazoleRing(): number[] {
    return this.ringBuilder.create124OxadiazoleRing();
  }

  create123OxadiazoleRing(): number[] {
    return this.ringBuilder.create123OxadiazoleRing();
  }

  create134ThiadiazoleRing(): number[] {
    return this.ringBuilder.create134ThiadiazoleRing();
  }

  create124ThiadiazoleRing(): number[] {
    return this.ringBuilder.create124ThiadiazoleRing();
  }

  create123ThiadiazoleRing(): number[] {
    return this.ringBuilder.create123ThiadiazoleRing();
  }

  addHydroxyl(atomIdx: number): void {
    const oxygenIdx = this.addAtom("O");
    this.addBond(atomIdx, oxygenIdx);
  }

  addCarbonyl(atomIdx: number): void {
    const oxygenIdx = this.addAtom("O");
    this.addBond(atomIdx, oxygenIdx, BondTypeEnum.DOUBLE);

    // When adding a carbonyl to an atom, it can no longer be aromatic
    // This is critical for molecules like isoindole-1,3-dione where
    // the carbonyl carbons (C=O) should not be aromatic
    if (atomIdx >= 0 && atomIdx < this.atoms.length) {
      const atom = this.atoms[atomIdx]!;
      if (atom.aromatic) {
        if (process.env.VERBOSE) {
          console.log(
            `[builder] De-aromatizing atom ${atomIdx} (${atom.symbol}) due to carbonyl addition`,
          );
        }
        atom.aromatic = false;

        // Convert aromatic bonds to single bonds
        this.bonds.forEach((bond) => {
          if (
            (bond.atom1 === atomIdx || bond.atom2 === atomIdx) &&
            bond.type === BondTypeEnum.AROMATIC
          ) {
            bond.type = BondTypeEnum.SINGLE;
            if (process.env.VERBOSE) {
              console.log(`[builder] Converted bond ${bond.atom1}-${bond.atom2} to SINGLE`);
            }
          }
        });
      }
    }

    // Check if any nitrogen neighbors are now between two carbonyl groups
    // If so, they should also be de-aromatized (e.g., isoindole-1,3-dione)
    this.deAromatizeNitrogensAdjacentToCarbonyls(atomIdx);
  }

  private deAromatizeNitrogensAdjacentToCarbonyls(carbonylCarbonIdx: number): void {
    // Get all neighbors of this carbonyl carbon
    const neighbors = this.bonds
      .filter((b) => b.atom1 === carbonylCarbonIdx || b.atom2 === carbonylCarbonIdx)
      .map((b) => (b.atom1 === carbonylCarbonIdx ? b.atom2 : b.atom1));

    // Check each nitrogen neighbor
    for (const neighborIdx of neighbors) {
      const neighbor = this.atoms[neighborIdx];
      if (!neighbor || neighbor.symbol !== "N" || !neighbor.aromatic) continue;

      // Count how many carbonyl carbons this nitrogen is bonded to
      const neighborBonds = this.bonds.filter(
        (b) => b.atom1 === neighborIdx || b.atom2 === neighborIdx,
      );

      let carbonylCount = 0;
      for (const bond of neighborBonds) {
        const otherIdx = bond.atom1 === neighborIdx ? bond.atom2 : bond.atom1;
        const otherAtom = this.atoms[otherIdx];

        // Check if this neighbor is a carbon with a C=O bond
        if (otherAtom?.symbol === "C") {
          const hasDoubleBondedOxygen = this.bonds.some(
            (b) =>
              (b.atom1 === otherIdx || b.atom2 === otherIdx) &&
              b.type === BondTypeEnum.DOUBLE &&
              ((b.atom1 === otherIdx && this.atoms[b.atom2]?.symbol === "O") ||
                (b.atom2 === otherIdx && this.atoms[b.atom1]?.symbol === "O")),
          );

          if (hasDoubleBondedOxygen) {
            carbonylCount++;
          }
        }
      }

      // If nitrogen is bonded to 2 carbonyl carbons, de-aromatize it
      if (carbonylCount >= 2) {
        if (process.env.VERBOSE) {
          console.log(
            `[builder] De-aromatizing nitrogen ${neighborIdx} bonded to ${carbonylCount} carbonyl groups`,
          );
        }
        neighbor.aromatic = false;

        // Convert its aromatic bonds to single bonds
        this.bonds.forEach((bond) => {
          if (
            (bond.atom1 === neighborIdx || bond.atom2 === neighborIdx) &&
            bond.type === BondTypeEnum.AROMATIC
          ) {
            bond.type = BondTypeEnum.SINGLE;
          }
        });
      }
    }
  }

  addCarboxyl(atomIdx: number): void {
    const carbonylOxygenIdx = this.addAtom("O");
    this.addBond(atomIdx, carbonylOxygenIdx, BondTypeEnum.DOUBLE);

    const hydroxylOxygenIdx = this.addAtom("O");
    this.addBond(atomIdx, hydroxylOxygenIdx);
  }

  addAmine(atomIdx: number): number {
    const nitrogenIdx = this.addAtom("N");
    this.addBond(atomIdx, nitrogenIdx);
    this.amineNitrogenIndices.push(nitrogenIdx);
    return nitrogenIdx;
  }

  addAldehyde(atomIdx: number): void {
    const oxygenIdx = this.addAtom("O");
    this.addBond(atomIdx, oxygenIdx, BondTypeEnum.DOUBLE);
  }

  addNitrile(atomIdx: number): void {
    const nitrogenIdx = this.addAtom("N");
    this.addBond(atomIdx, nitrogenIdx, BondTypeEnum.TRIPLE);
  }

  addThiocyanate(atomIdx: number): void {
    const sulfurIdx = this.addAtom("S");
    const carbonIdx = this.addCarbon();
    const nitrogenIdx = this.addAtom("N");

    this.addBond(atomIdx, sulfurIdx);
    this.addBond(sulfurIdx, carbonIdx);
    this.addBond(carbonIdx, nitrogenIdx, BondTypeEnum.TRIPLE);
  }

  addEster(atomIdx: number, alkylChainLength: number): number {
    const carbonylOxygenIdx = this.addAtom("O");
    this.addBond(atomIdx, carbonylOxygenIdx, BondTypeEnum.DOUBLE);

    const etherOxygenIdx = this.addAtom("O");
    this.addBond(atomIdx, etherOxygenIdx);

    if (alkylChainLength > 0) {
      const firstAlkylCarbon = this.addCarbon();
      this.addBond(etherOxygenIdx, firstAlkylCarbon);

      let prevCarbon = firstAlkylCarbon;
      for (let i = 1; i < alkylChainLength; i++) {
        const nextCarbon = this.addCarbon();
        this.addBond(prevCarbon, nextCarbon);
        prevCarbon = nextCarbon;
      }
    }

    return etherOxygenIdx;
  }

  addAmide(atomIdx: number): number {
    const carbonylOxygenIdx = this.addAtom("O");
    this.addBond(atomIdx, carbonylOxygenIdx, BondTypeEnum.DOUBLE);

    const nitrogenIdx = this.addAtom("N");
    this.addBond(atomIdx, nitrogenIdx);

    this.amineNitrogenIndices.push(nitrogenIdx);

    return nitrogenIdx;
  }

  addCarboxamide(atomIdx: number): number {
    const carbonIdx = this.addCarbon();
    this.addBond(atomIdx, carbonIdx);

    const carbonylOxygenIdx = this.addAtom("O");
    this.addBond(carbonIdx, carbonylOxygenIdx, BondTypeEnum.DOUBLE);

    const nitrogenIdx = this.addAtom("N");
    this.addBond(carbonIdx, nitrogenIdx);

    this.amineNitrogenIndices.push(nitrogenIdx);

    return nitrogenIdx;
  }

  addMethyl(atomIdx: number): void {
    return this.substituentBuilder.addMethyl(atomIdx);
  }

  addEthyl(atomIdx: number): void {
    return this.substituentBuilder.addEthyl(atomIdx);
  }

  addIsopropyl(atomIdx: number): void {
    return this.substituentBuilder.addIsopropyl(atomIdx);
  }

  addTertButyl(atomIdx: number): void {
    return this.substituentBuilder.addTertButyl(atomIdx);
  }

  addIsobutyl(atomIdx: number): void {
    return this.substituentBuilder.addIsobutyl(atomIdx);
  }

  addSecButyl(atomIdx: number): void {
    return this.substituentBuilder.addSecButyl(atomIdx);
  }

  addMethoxy(atomIdx: number): void {
    return this.substituentBuilder.addMethoxy(atomIdx);
  }

  addEthoxy(atomIdx: number): void {
    return this.substituentBuilder.addEthoxy(atomIdx);
  }

  addPropoxy(atomIdx: number): void {
    return this.substituentBuilder.addPropoxy(atomIdx);
  }

  addButoxy(atomIdx: number): void {
    return this.substituentBuilder.addButoxy(atomIdx);
  }

  addAmino(atomIdx: number): void {
    return this.substituentBuilder.addAmino(atomIdx);
  }

  addTrifluoromethyl(atomIdx: number): void {
    return this.substituentBuilder.addTrifluoromethyl(atomIdx);
  }

  addBenzyl(atomIdx: number): void {
    return this.substituentBuilder.addBenzyl(atomIdx);
  }

  addPhenethyl(atomIdx: number): void {
    return this.substituentBuilder.addPhenethyl(atomIdx);
  }

  addCyclopropyl(atomIdx: number): void {
    return this.substituentBuilder.addCyclopropyl(atomIdx);
  }

  addCyclobutyl(atomIdx: number): void {
    return this.substituentBuilder.addCyclobutyl(atomIdx);
  }

  addCyclopentyl(atomIdx: number): void {
    return this.substituentBuilder.addCyclopentyl(atomIdx);
  }

  addCyclohexyl(atomIdx: number): void {
    return this.substituentBuilder.addCyclohexyl(atomIdx);
  }

  addCyclopropylidene(atomIdx: number): void {
    return this.substituentBuilder.addCyclopropylidene(atomIdx);
  }

  addCyclobutylidene(atomIdx: number): void {
    return this.substituentBuilder.addCyclobutylidene(atomIdx);
  }

  addCyclopentylidene(atomIdx: number): void {
    return this.substituentBuilder.addCyclopentylidene(atomIdx);
  }

  addCyclohexylidene(atomIdx: number): void {
    return this.substituentBuilder.addCyclohexylidene(atomIdx);
  }

  addAcetyl(atomIdx: number): void {
    return this.substituentBuilder.addAcetyl(atomIdx);
  }

  addPropanoyl(atomIdx: number): void {
    return this.substituentBuilder.addPropanoyl(atomIdx);
  }

  addButanoyl(atomIdx: number): void {
    return this.substituentBuilder.addButanoyl(atomIdx);
  }

  addPentanoyl(atomIdx: number): void {
    return this.substituentBuilder.addPentanoyl(atomIdx);
  }

  addHexanoyl(atomIdx: number): void {
    return this.substituentBuilder.addHexanoyl(atomIdx);
  }

  addFormyl(atomIdx: number): void {
    return this.substituentBuilder.addFormyl(atomIdx);
  }

  addHydroxymethyl(atomIdx: number): void {
    return this.substituentBuilder.addHydroxymethyl(atomIdx);
  }

  addAlkylSubstituent(atomIdx: number, chainLength: number): number[] {
    return this.substituentBuilder.addAlkylSubstituent(atomIdx, chainLength);
  }

  addDoubleBond(atom1: number, atom2: number): void {
    const existingBond = this.bonds.find(
      (b) => (b.atom1 === atom1 && b.atom2 === atom2) || (b.atom1 === atom2 && b.atom2 === atom1),
    );

    if (existingBond) {
      existingBond.type = BondTypeEnum.DOUBLE;
    } else {
      this.addBond(atom1, atom2, BondTypeEnum.DOUBLE);
    }
  }

  addTripleBond(atom1: number, atom2: number): void {
    const existingBond = this.bonds.find(
      (b) => (b.atom1 === atom1 && b.atom2 === atom2) || (b.atom1 === atom2 && b.atom2 === atom1),
    );

    if (existingBond) {
      existingBond.type = BondTypeEnum.TRIPLE;
    } else {
      this.addBond(atom1, atom2, BondTypeEnum.TRIPLE);
    }
  }

  addAlkoxyGroup(atomIdx: number, alkylChainAtoms: number[]): number {
    return this.substituentBuilder.addAlkoxyGroup(atomIdx, alkylChainAtoms);
  }

  createBicyclicStructureWithHetero(
    n: number,
    m: number,
    p: number,
    heteroAtomPos?: number,
    heteroSymbol: string = "C",
  ): number[] {
    return this.polycyclicBuilder.createBicyclicStructureWithHetero(
      n,
      m,
      p,
      heteroAtomPos,
      heteroSymbol,
    );
  }

  createSpiroStructure(a: number, b: number): number[] {
    return this.polycyclicBuilder.createSpiroStructure(a, b);
  }

  createTricyclicStructureWithHetero(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    heteroPositions: Map<number, string> = new Map(),
  ): number[] {
    return this.polycyclicBuilder.createTricyclicStructureWithHetero(
      a,
      b,
      c,
      d,
      e,
      f,
      heteroPositions,
    );
  }

  createVonBaeyerSystem(
    bridgeLengths: number[],
    secondaryBridges: { from: number; to: number; length: number }[],
    heteroPositions: Map<number, string> = new Map(),
  ): number[] {
    return this.polycyclicBuilder.createVonBaeyerSystem(
      bridgeLengths,
      secondaryBridges,
      heteroPositions,
    );
  }

  createPentacyclicStructure(
    bridges: number[],
    heteroPositions: Map<number, string> = new Map(),
    hasSecondaryBridges: boolean = false,
    expectedAtomCount?: number,
  ): number[] {
    return this.polycyclicBuilder.createPentacyclicStructure(
      bridges,
      heteroPositions,
      hasSecondaryBridges,
      expectedAtomCount,
    );
  }

  createHeptacyclicStructure(
    bridges: number[],
    heteroPositions: Map<number, string> = new Map(),
  ): number[] {
    return this.polycyclicBuilder.createHeptacyclicStructure(bridges, heteroPositions);
  }

  getAtomCount(): number {
    return this.atoms.length;
  }

  getAtom(index: number) {
    return this.atoms[index];
  }

  getBonds() {
    return this.bonds;
  }

  getAmineNitrogenIndices(): number[] {
    return this.amineNitrogenIndices;
  }

  clearAmineNitrogenIndices(): void {
    this.amineNitrogenIndices = [];
  }

  private checkAndDeAromatizeNeighboringHeteroatoms(saturatedAtomIdx: number): void {
    // When an atom is saturated in a ring, we need to check if any aromatic heteroatoms
    // in the same ring system should also be de-aromatized because conjugation is broken.
    // E.g., in 3,4-dihydro-2H-quinoline, saturating C2, C3 and C4 breaks the aromatic system,
    // so the nitrogen should also become non-aromatic.

    // Find all aromatic heteroatoms (N, O, S, etc. - NOT carbons)
    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      if (!atom || !atom.aromatic || atom.symbol === "C") continue;

      // Check if this heteroatom is in a ring system that contains the saturated atom
      // by doing a simple path search
      if (this.areAtomsInSameRingSystem(i, saturatedAtomIdx)) {
        // Count saturated atoms in this ring system that are reachable from the heteroatom
        const saturatedInRing = this.countSaturatedAtomsInRingPath(i);

        // If there are 2+ saturated atoms in the ring, the heteroatom should be de-aromatized
        if (saturatedInRing >= 2) {
          if (process.env.VERBOSE) {
            console.log(
              `[builder] De-aromatizing heteroatom ${i} (${atom.symbol}) - ring has ${saturatedInRing} saturated atoms`,
            );
          }
          atom.aromatic = false;

          // Convert its aromatic bonds to single bonds
          this.bonds.forEach((bond) => {
            if ((bond.atom1 === i || bond.atom2 === i) && bond.type === BondTypeEnum.AROMATIC) {
              bond.type = BondTypeEnum.SINGLE;
            }
          });
        }
      }
    }
  }

  private areAtomsInSameRingSystem(atom1: number, atom2: number): boolean {
    // Simple BFS to check if atoms are connected and likely in same ring
    const visited = new Set<number>();
    const queue = [atom1];
    visited.add(atom1);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === atom2) return true;

      // Limit search depth to avoid traversing entire molecule
      if (visited.size > 20) return false;

      const neighbors = this.bonds
        .filter((b) => b.atom1 === current || b.atom2 === current)
        .map((b) => (b.atom1 === current ? b.atom2 : b.atom1));

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return false;
  }

  private countSaturatedAtomsInRingPath(heteroatomIdx: number): number {
    // Count non-aromatic carbons that are close to this heteroatom (within 3 bonds)
    const visited = new Set<number>();
    const queue: [number, number][] = [[heteroatomIdx, 0]];
    visited.add(heteroatomIdx);
    let count = 0;

    while (queue.length > 0) {
      const [current, depth] = queue.shift()!;

      // Limit depth to atoms close to heteroatom
      if (depth > 3) continue;

      const currentAtom = this.atoms[current];
      if (currentAtom && currentAtom.symbol === "C" && !currentAtom.aromatic) {
        count++;
      }

      const neighbors = this.bonds
        .filter((b) => b.atom1 === current || b.atom2 === current)
        .map((b) => (b.atom1 === current ? b.atom2 : b.atom1));

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([neighbor, depth + 1]);
        }
      }
    }

    return count;
  }

  build(): Molecule {
    return {
      atoms: this.atoms as readonly Atom[],
      bonds: this.bonds as readonly Bond[],
      rings: [],
      ringInfo: {
        atomRings: new Map(),
        bondRings: new Map(),
        rings: [],
      },
    };
  }
}
