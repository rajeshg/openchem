export interface PolycyclicBuilderContext {
  addAtom(element: string, aromatic?: boolean): number;
  addCarbon(aromatic?: boolean): number;
  addBond(atom1: number, atom2: number, type?: unknown): void;
}

export class PolycyclicBuilders {
  private ctx: PolycyclicBuilderContext;

  constructor(context: PolycyclicBuilderContext) {
    this.ctx = context;
  }

  createBicyclicStructureWithHetero(
    n: number,
    m: number,
    p: number,
    heteroAtomPos?: number,
    heteroSymbol: string = "C",
  ): number[] {
    const atoms: number[] = [];

    const bridgehead1 = this.ctx.addCarbon();
    const bridgehead2 = this.ctx.addCarbon();

    let currentPosition = 0;

    atoms.push(bridgehead1);
    currentPosition++;

    let currentAtom = bridgehead1;
    for (let i = 0; i < n; i++) {
      currentPosition++;
      const newAtom =
        heteroAtomPos === currentPosition
          ? this.ctx.addAtom(heteroSymbol, false)
          : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead2);

    currentPosition++;
    atoms.push(bridgehead2);

    currentAtom = bridgehead2;
    for (let i = 0; i < m; i++) {
      currentPosition++;
      const newAtom =
        heteroAtomPos === currentPosition
          ? this.ctx.addAtom(heteroSymbol, false)
          : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead1);

    currentAtom = bridgehead1;
    for (let i = 0; i < p; i++) {
      currentPosition++;
      const newAtom =
        heteroAtomPos === currentPosition
          ? this.ctx.addAtom(heteroSymbol, false)
          : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead2);

    return atoms;
  }

  createSpiroStructure(a: number, b: number): number[] {
    const atoms: number[] = [];

    const spiroAtom = this.ctx.addCarbon();
    atoms.push(spiroAtom);

    let currentAtom = spiroAtom;
    for (let i = 0; i < a; i++) {
      const newAtom = this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, spiroAtom);

    currentAtom = spiroAtom;
    for (let i = 0; i < b; i++) {
      const newAtom = this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, spiroAtom);

    return atoms;
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
    const atoms: number[] = [];

    const bridgehead1 = this.ctx.addCarbon();
    const bridgehead2 = this.ctx.addCarbon();
    const bridgehead3 = this.ctx.addCarbon();

    let currentPosition = 0;

    atoms.push(bridgehead1);
    currentPosition++;

    let currentAtom = bridgehead1;
    for (let i = 0; i < a; i++) {
      currentPosition++;
      const newAtom = heteroPositions.has(currentPosition)
        ? this.ctx.addAtom(heteroPositions.get(currentPosition)!, false)
        : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead2);

    currentPosition++;
    atoms.push(bridgehead2);

    currentAtom = bridgehead2;
    for (let i = 0; i < b; i++) {
      currentPosition++;
      const newAtom = heteroPositions.has(currentPosition)
        ? this.ctx.addAtom(heteroPositions.get(currentPosition)!, false)
        : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead3);

    currentPosition++;
    atoms.push(bridgehead3);

    currentAtom = bridgehead3;
    for (let i = 0; i < c; i++) {
      currentPosition++;
      const newAtom = heteroPositions.has(currentPosition)
        ? this.ctx.addAtom(heteroPositions.get(currentPosition)!, false)
        : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead1);

    return atoms;
  }

  createVonBaeyerSystem(
    bridgeLengths: number[],
    secondaryBridges: { from: number; to: number; length: number }[],
    heteroPositions: Map<number, string> = new Map(),
  ): number[] {
    if (bridgeLengths.length < 3) return [];

    const k = bridgeLengths[0] || 0;
    const l = bridgeLengths[1] || 0;
    const m = bridgeLengths[2] || 0;

    const bridgehead1Loc = 1;
    const bridgehead2Loc = k + 2;

    let totalAtoms = 2 + k + l + m;
    for (const b of secondaryBridges) {
      totalAtoms += b.length;
    }

    const atoms: number[] = [];

    const createAtom = (pos: number): number => {
      return heteroPositions.has(pos)
        ? this.ctx.addAtom(heteroPositions.get(pos)!, false)
        : this.ctx.addCarbon();
    };

    for (let i = 1; i <= totalAtoms; i++) {
      atoms.push(createAtom(i));
    }

    const getAtom = (locant: number) => atoms[locant - 1]!;

    let currentLoc = bridgehead1Loc;
    for (let i = 0; i < k; i++) {
      const nextLoc = currentLoc + 1;
      this.ctx.addBond(getAtom(currentLoc), getAtom(nextLoc));
      currentLoc = nextLoc;
    }
    this.ctx.addBond(getAtom(currentLoc), getAtom(bridgehead2Loc));

    currentLoc = bridgehead2Loc;
    for (let i = 0; i < l; i++) {
      const nextLoc = k + 3 + i;
      this.ctx.addBond(getAtom(currentLoc), getAtom(nextLoc));
      currentLoc = nextLoc;
    }
    this.ctx.addBond(getAtom(currentLoc), getAtom(bridgehead1Loc));

    currentLoc = bridgehead1Loc;
    for (let i = 0; i < m; i++) {
      const nextLoc = k + l + 3 + i;
      this.ctx.addBond(getAtom(currentLoc), getAtom(nextLoc));
      currentLoc = nextLoc;
    }
    this.ctx.addBond(getAtom(currentLoc), getAtom(bridgehead2Loc));

    let nextAvailableLoc = k + l + m + 3;

    for (const sb of secondaryBridges) {
      const u = sb.from;
      const v = sb.to;
      const len = sb.length;

      let prevLoc = u;
      for (let i = 0; i < len; i++) {
        const currLoc = nextAvailableLoc + i;
        this.ctx.addBond(getAtom(prevLoc), getAtom(currLoc));
        prevLoc = currLoc;
      }
      this.ctx.addBond(getAtom(prevLoc), getAtom(v));

      nextAvailableLoc += len;
    }

    return atoms;
  }

  createPentacyclicStructure(
    bridges: number[],
    heteroPositions: Map<number, string> = new Map(),
    hasSecondaryBridges: boolean = false,
    expectedAtomCount?: number,
  ): number[] {
    if (hasSecondaryBridges) {
      const expectedAtoms = expectedAtomCount || bridges.reduce((sum, b) => sum + b, 0) + 4;

      const atoms: number[] = [];
      for (let i = 0; i < expectedAtoms; i++) {
        const pos = i + 1;
        const newAtom = heteroPositions.has(pos)
          ? this.ctx.addAtom(heteroPositions.get(pos)!, false)
          : this.ctx.addCarbon();
        atoms.push(newAtom);

        if (i > 0) {
          this.ctx.addBond(atoms[i - 1]!, newAtom);
        }
      }

      if (atoms.length > 0) {
        this.ctx.addBond(atoms[atoms.length - 1]!, atoms[0]!);
      }

      return atoms;
    }

    if (expectedAtomCount) {
      const atoms: number[] = [];
      for (let i = 0; i < expectedAtomCount; i++) {
        const pos = i + 1;
        const newAtom = heteroPositions.has(pos)
          ? this.ctx.addAtom(heteroPositions.get(pos)!, false)
          : this.ctx.addCarbon();
        atoms.push(newAtom);

        if (i > 0) {
          this.ctx.addBond(atoms[i - 1]!, newAtom);
        }
      }

      if (atoms.length > 0) {
        this.ctx.addBond(atoms[atoms.length - 1]!, atoms[0]!);
      }

      return atoms;
    }

    const atoms: number[] = [];

    const bridgehead1 = this.ctx.addCarbon();
    const bridgehead2 = this.ctx.addCarbon();
    const bridgehead3 = this.ctx.addCarbon();
    const bridgehead4 = this.ctx.addCarbon();

    atoms.push(bridgehead1, bridgehead2, bridgehead3, bridgehead4);

    let currentPosition = 4;

    let currentAtom = bridgehead1;
    for (let i = 0; i < bridges[0]!; i++) {
      currentPosition++;
      const newAtom = heteroPositions.has(currentPosition)
        ? this.ctx.addAtom(heteroPositions.get(currentPosition)!, false)
        : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead2);

    currentAtom = bridgehead2;
    for (let i = 0; i < bridges[1]!; i++) {
      currentPosition++;
      const newAtom = heteroPositions.has(currentPosition)
        ? this.ctx.addAtom(heteroPositions.get(currentPosition)!, false)
        : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead3);

    currentAtom = bridgehead3;
    for (let i = 0; i < bridges[2]!; i++) {
      currentPosition++;
      const newAtom = heteroPositions.has(currentPosition)
        ? this.ctx.addAtom(heteroPositions.get(currentPosition)!, false)
        : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead4);

    currentAtom = bridgehead4;
    for (let i = 0; i < bridges[3]!; i++) {
      currentPosition++;
      const newAtom = heteroPositions.has(currentPosition)
        ? this.ctx.addAtom(heteroPositions.get(currentPosition)!, false)
        : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead1);

    currentAtom = bridgehead1;
    for (let i = 0; i < bridges[4]!; i++) {
      currentPosition++;
      const newAtom = heteroPositions.has(currentPosition)
        ? this.ctx.addAtom(heteroPositions.get(currentPosition)!, false)
        : this.ctx.addCarbon();
      this.ctx.addBond(currentAtom, newAtom);
      atoms.push(newAtom);
      currentAtom = newAtom;
    }
    this.ctx.addBond(currentAtom, bridgehead3);

    return atoms;
  }

  createHeptacyclicStructure(
    bridges: number[],
    heteroPositions: Map<number, string> = new Map(),
  ): number[] {
    const totalBridgeAtoms = bridges.reduce((sum, b) => sum + b, 0);
    const expectedAtoms = totalBridgeAtoms + 6;

    const atoms: number[] = [];
    for (let i = 0; i < expectedAtoms; i++) {
      const pos = i + 1;
      const newAtom = heteroPositions.has(pos)
        ? this.ctx.addAtom(heteroPositions.get(pos)!, false)
        : this.ctx.addCarbon();
      atoms.push(newAtom);

      if (i > 0) {
        this.ctx.addBond(atoms[i - 1]!, newAtom);
      }
    }

    if (atoms.length > 0) {
      this.ctx.addBond(atoms[atoms.length - 1]!, atoms[0]!);
    }

    return atoms;
  }
}
