import { BondType } from "types";

export interface SubstituentBuilderContext {
  addAtom(element: string, aromatic?: boolean): number;
  addCarbon(aromatic?: boolean): number;
  addBond(atom1: number, atom2: number, type?: BondType): void;
  setHydrogens(atomIdx: number, count: number): void;
  createBenzeneRing(): number[];
}

export class SubstituentBuilders {
  private ctx: SubstituentBuilderContext;
  amineNitrogenIndices: number[] = [];

  constructor(context: SubstituentBuilderContext) {
    this.ctx = context;
  }

  addMethyl(atomIdx: number): void {
    const methylIdx = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, methylIdx);
  }

  addEthyl(atomIdx: number): void {
    const ch2Idx = this.ctx.addCarbon();
    const ch3Idx = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, ch2Idx);
    this.ctx.addBond(ch2Idx, ch3Idx);
  }

  addIsopropyl(atomIdx: number): void {
    const chIdx = this.ctx.addCarbon();
    const ch3_1 = this.ctx.addCarbon();
    const ch3_2 = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, chIdx);
    this.ctx.addBond(chIdx, ch3_1);
    this.ctx.addBond(chIdx, ch3_2);
  }

  addTertButyl(atomIdx: number): void {
    const centralC = this.ctx.addCarbon();
    const ch3_1 = this.ctx.addCarbon();
    const ch3_2 = this.ctx.addCarbon();
    const ch3_3 = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, centralC);
    this.ctx.addBond(centralC, ch3_1);
    this.ctx.addBond(centralC, ch3_2);
    this.ctx.addBond(centralC, ch3_3);
  }

  addIsobutyl(atomIdx: number): void {
    const ch2 = this.ctx.addCarbon();
    const ch = this.ctx.addCarbon();
    const ch3_1 = this.ctx.addCarbon();
    const ch3_2 = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, ch2);
    this.ctx.addBond(ch2, ch);
    this.ctx.addBond(ch, ch3_1);
    this.ctx.addBond(ch, ch3_2);
  }

  addSecButyl(atomIdx: number): void {
    const ch = this.ctx.addCarbon();
    const ch3_branch = this.ctx.addCarbon();
    const ch2 = this.ctx.addCarbon();
    const ch3_end = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, ch);
    this.ctx.addBond(ch, ch3_branch);
    this.ctx.addBond(ch, ch2);
    this.ctx.addBond(ch2, ch3_end);
  }

  addMethoxy(atomIdx: number): void {
    const oxygenIdx = this.ctx.addAtom("O");
    const methylIdx = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, oxygenIdx);
    this.ctx.addBond(oxygenIdx, methylIdx);
  }

  addEthoxy(atomIdx: number): void {
    const oxygenIdx = this.ctx.addAtom("O");
    const ch2Idx = this.ctx.addCarbon();
    const ch3Idx = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, oxygenIdx);
    this.ctx.addBond(oxygenIdx, ch2Idx);
    this.ctx.addBond(ch2Idx, ch3Idx);
  }

  addPropoxy(atomIdx: number): void {
    const oxygenIdx = this.ctx.addAtom("O");
    this.ctx.addBond(atomIdx, oxygenIdx);
    this.addAlkylSubstituent(oxygenIdx, 3);
  }

  addButoxy(atomIdx: number): void {
    const oxygenIdx = this.ctx.addAtom("O");
    this.ctx.addBond(atomIdx, oxygenIdx);
    this.addAlkylSubstituent(oxygenIdx, 4);
  }

  addAmino(atomIdx: number): void {
    const nitrogenIdx = this.ctx.addAtom("N");
    this.ctx.addBond(atomIdx, nitrogenIdx);
  }

  addTrifluoromethyl(atomIdx: number): void {
    const carbonIdx = this.ctx.addCarbon();
    const f1 = this.ctx.addAtom("F");
    const f2 = this.ctx.addAtom("F");
    const f3 = this.ctx.addAtom("F");
    this.ctx.addBond(atomIdx, carbonIdx);
    this.ctx.addBond(carbonIdx, f1);
    this.ctx.addBond(carbonIdx, f2);
    this.ctx.addBond(carbonIdx, f3);
  }

  addBenzyl(atomIdx: number): void {
    const ch2Idx = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, ch2Idx);
    const benzeneAtoms = this.ctx.createBenzeneRing();
    if (benzeneAtoms[0] !== undefined) {
      this.ctx.addBond(ch2Idx, benzeneAtoms[0]);
    }
  }

  addPhenethyl(atomIdx: number): void {
    const ch2_1 = this.ctx.addCarbon();
    const ch2_2 = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, ch2_1);
    this.ctx.addBond(ch2_1, ch2_2);
    const benzeneAtoms = this.ctx.createBenzeneRing();
    if (benzeneAtoms[0] !== undefined) {
      this.ctx.addBond(ch2_2, benzeneAtoms[0]);
    }
  }

  addCyclopropyl(atomIdx: number): void {
    const c1 = this.ctx.addCarbon();
    const c2 = this.ctx.addCarbon();
    const c3 = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, c1);
    this.ctx.addBond(c1, c2);
    this.ctx.addBond(c2, c3);
    this.ctx.addBond(c3, c1);
  }

  addCyclobutyl(atomIdx: number): void {
    const c1 = this.ctx.addCarbon();
    const c2 = this.ctx.addCarbon();
    const c3 = this.ctx.addCarbon();
    const c4 = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, c1);
    this.ctx.addBond(c1, c2);
    this.ctx.addBond(c2, c3);
    this.ctx.addBond(c3, c4);
    this.ctx.addBond(c4, c1);
  }

  addCyclopentyl(atomIdx: number): void {
    const c1 = this.ctx.addCarbon();
    const c2 = this.ctx.addCarbon();
    const c3 = this.ctx.addCarbon();
    const c4 = this.ctx.addCarbon();
    const c5 = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, c1);
    this.ctx.addBond(c1, c2);
    this.ctx.addBond(c2, c3);
    this.ctx.addBond(c3, c4);
    this.ctx.addBond(c4, c5);
    this.ctx.addBond(c5, c1);
  }

  addCyclohexyl(atomIdx: number): void {
    const c1 = this.ctx.addCarbon();
    const c2 = this.ctx.addCarbon();
    const c3 = this.ctx.addCarbon();
    const c4 = this.ctx.addCarbon();
    const c5 = this.ctx.addCarbon();
    const c6 = this.ctx.addCarbon();
    this.ctx.addBond(atomIdx, c1);
    this.ctx.addBond(c1, c2);
    this.ctx.addBond(c2, c3);
    this.ctx.addBond(c3, c4);
    this.ctx.addBond(c4, c5);
    this.ctx.addBond(c5, c6);
    this.ctx.addBond(c6, c1);
  }

  addCyclopropylidene(atomIdx: number): void {
    const c1 = this.ctx.addCarbon();
    const c2 = this.ctx.addCarbon();
    const c3 = this.ctx.addCarbon();
    this.addDoubleBond(atomIdx, c1);
    this.ctx.addBond(c1, c2);
    this.ctx.addBond(c2, c3);
    this.ctx.addBond(c3, c1);
  }

  addCyclobutylidene(atomIdx: number): void {
    const c1 = this.ctx.addCarbon();
    const c2 = this.ctx.addCarbon();
    const c3 = this.ctx.addCarbon();
    const c4 = this.ctx.addCarbon();
    this.addDoubleBond(atomIdx, c1);
    this.ctx.addBond(c1, c2);
    this.ctx.addBond(c2, c3);
    this.ctx.addBond(c3, c4);
    this.ctx.addBond(c4, c1);
  }

  addCyclopentylidene(atomIdx: number): void {
    const c1 = this.ctx.addCarbon();
    const c2 = this.ctx.addCarbon();
    const c3 = this.ctx.addCarbon();
    const c4 = this.ctx.addCarbon();
    const c5 = this.ctx.addCarbon();
    this.addDoubleBond(atomIdx, c1);
    this.ctx.addBond(c1, c2);
    this.ctx.addBond(c2, c3);
    this.ctx.addBond(c3, c4);
    this.ctx.addBond(c4, c5);
    this.ctx.addBond(c5, c1);
  }

  addCyclohexylidene(atomIdx: number): void {
    const c1 = this.ctx.addCarbon();
    const c2 = this.ctx.addCarbon();
    const c3 = this.ctx.addCarbon();
    const c4 = this.ctx.addCarbon();
    const c5 = this.ctx.addCarbon();
    const c6 = this.ctx.addCarbon();
    this.addDoubleBond(atomIdx, c1);
    this.ctx.addBond(c1, c2);
    this.ctx.addBond(c2, c3);
    this.ctx.addBond(c3, c4);
    this.ctx.addBond(c4, c5);
    this.ctx.addBond(c5, c6);
    this.ctx.addBond(c6, c1);
  }

  addAcetyl(atomIdx: number): void {
    const carbonylC = this.ctx.addCarbon();
    const oxygenIdx = this.ctx.addAtom("O");
    const methylIdx = this.ctx.addCarbon();

    this.ctx.addBond(atomIdx, carbonylC);
    this.ctx.addBond(carbonylC, oxygenIdx, BondType.DOUBLE);
    this.ctx.addBond(carbonylC, methylIdx);
  }

  addPropanoyl(atomIdx: number): void {
    const carbonylC = this.ctx.addCarbon();
    const oxygenIdx = this.ctx.addAtom("O");
    const ch2Idx = this.ctx.addCarbon();
    const ch3Idx = this.ctx.addCarbon();

    this.ctx.addBond(atomIdx, carbonylC);
    this.ctx.addBond(carbonylC, oxygenIdx, BondType.DOUBLE);
    this.ctx.addBond(carbonylC, ch2Idx);
    this.ctx.addBond(ch2Idx, ch3Idx);
  }

  addButanoyl(atomIdx: number): void {
    const carbonylC = this.ctx.addCarbon();
    const oxygenIdx = this.ctx.addAtom("O");

    this.ctx.addBond(atomIdx, carbonylC);
    this.ctx.addBond(carbonylC, oxygenIdx, BondType.DOUBLE);

    this.addAlkylSubstituent(carbonylC, 3);
  }

  addPentanoyl(atomIdx: number): void {
    const carbonylC = this.ctx.addCarbon();
    const oxygenIdx = this.ctx.addAtom("O");

    this.ctx.addBond(atomIdx, carbonylC);
    this.ctx.addBond(carbonylC, oxygenIdx, BondType.DOUBLE);

    this.addAlkylSubstituent(carbonylC, 4);
  }

  addHexanoyl(atomIdx: number): void {
    const carbonylC = this.ctx.addCarbon();
    const oxygenIdx = this.ctx.addAtom("O");

    this.ctx.addBond(atomIdx, carbonylC);
    this.ctx.addBond(carbonylC, oxygenIdx, BondType.DOUBLE);

    this.addAlkylSubstituent(carbonylC, 5);
  }

  addFormyl(atomIdx: number): void {
    const carbonIdx = this.ctx.addCarbon();
    const oxygenIdx = this.ctx.addAtom("O");
    this.ctx.addBond(atomIdx, carbonIdx);
    this.ctx.addBond(carbonIdx, oxygenIdx, BondType.DOUBLE);
  }

  addHydroxymethyl(atomIdx: number): void {
    const ch2Idx = this.ctx.addCarbon();
    const oxygenIdx = this.ctx.addAtom("O");
    this.ctx.addBond(atomIdx, ch2Idx);
    this.ctx.addBond(ch2Idx, oxygenIdx);
  }

  addAlkylSubstituent(atomIdx: number, chainLength: number): number[] {
    const substituentAtoms: number[] = [];

    for (let i = 0; i < chainLength; i++) {
      const carbonIdx = this.ctx.addCarbon();
      substituentAtoms.push(carbonIdx);

      if (i === 0) {
        this.ctx.addBond(atomIdx, carbonIdx);
      } else {
        this.ctx.addBond(substituentAtoms[i - 1]!, carbonIdx);
      }
    }

    return substituentAtoms;
  }

  addDoubleBond(atom1: number, atom2: number): void {
    this.ctx.addBond(atom1, atom2, BondType.DOUBLE);
  }

  addTripleBond(atom1: number, atom2: number): void {
    this.ctx.addBond(atom1, atom2, BondType.TRIPLE);
  }

  addAlkoxyGroup(atomIdx: number, alkylChainAtoms: number[]): number {
    const oxygenIdx = this.ctx.addAtom("O");
    this.ctx.addBond(atomIdx, oxygenIdx);

    if (alkylChainAtoms.length > 0 && alkylChainAtoms[0] !== undefined) {
      this.ctx.addBond(oxygenIdx, alkylChainAtoms[0]);
    }

    return oxygenIdx;
  }
}
