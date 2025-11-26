import { BondType as BondTypeEnum } from "types";

/**
 * Interface for ring structure builders to access parent builder methods
 */
export interface RingBuilderContext {
  addCarbon(): number;
  addAtom(element: string, aromatic?: boolean): number;
  addBond(atom1: number, atom2: number, type?: BondTypeEnum): void;
  setHydrogens(atomIdx: number, hydrogens: number): void;
}

/**
 * Ring structure builders for creating various cyclic systems
 * Extracted from MoleculeGraphBuilder to improve modularity
 */
export class RingStructureBuilders {
  private context: RingBuilderContext;

  constructor(context: RingBuilderContext) {
    this.context = context;
  }

  /**
   * Create a cyclic carbon chain (ring)
   * @param size Ring size (3 for cyclopropane, 6 for cyclohexane, etc.)
   * @param aromatic Whether ring is aromatic
   * @returns Array of atom indices
   */
  createCyclicChain(size: number, aromatic = false): number[] {
    const atomIndices: number[] = [];

    for (let i = 0; i < size; i++) {
      const atomIdx = aromatic ? this.context.addAtom("C", true) : this.context.addCarbon();
      atomIndices.push(atomIdx);

      // Bond to previous carbon
      if (i > 0) {
        const bondType = aromatic ? BondTypeEnum.AROMATIC : BondTypeEnum.SINGLE;
        this.context.addBond(atomIndices[i - 1]!, atomIdx, bondType);
      }
    }

    // Close the ring
    if (atomIndices.length > 2) {
      const bondType = aromatic ? BondTypeEnum.AROMATIC : BondTypeEnum.SINGLE;
      this.context.addBond(atomIndices[atomIndices.length - 1]!, atomIndices[0]!, bondType);
    }

    return atomIndices;
  }

  /**
   * Create a benzene ring (6-membered aromatic ring)
   * @returns Array of atom indices
   */
  createBenzeneRing(): number[] {
    return this.createCyclicChain(6, true);
  }

  /**
   * Create naphthalene ring (fused benzene rings)
   * SMILES: c1ccc2ccccc2c1
   * Structure: Two benzene rings sharing an edge
   * Numbering: 1-2-3-4-4a-5-6-7-8-8a-1
   * @returns Array of atom indices [C1-C10]
   */
  createNaphthaleneRing(): number[] {
    const atoms: number[] = [];

    // Create 10 aromatic carbons
    for (let i = 0; i < 10; i++) {
      atoms.push(this.context.addAtom("C", true));
    }

    // First ring: atoms 0-1-2-3-8-9 (positions 1-2-3-4-4a-8a)
    this.context.addBond(atoms[0]!, atoms[1]!, BondTypeEnum.AROMATIC);
    this.context.addBond(atoms[1]!, atoms[2]!, BondTypeEnum.AROMATIC);
    this.context.addBond(atoms[2]!, atoms[3]!, BondTypeEnum.AROMATIC);
    this.context.addBond(atoms[3]!, atoms[8]!, BondTypeEnum.AROMATIC); // fusion edge
    this.context.addBond(atoms[8]!, atoms[9]!, BondTypeEnum.AROMATIC); // fusion edge
    this.context.addBond(atoms[9]!, atoms[0]!, BondTypeEnum.AROMATIC);

    // Second ring: atoms 3-4-5-6-7-8 (positions 4-5-6-7-8-4a)
    this.context.addBond(atoms[3]!, atoms[4]!, BondTypeEnum.AROMATIC);
    this.context.addBond(atoms[4]!, atoms[5]!, BondTypeEnum.AROMATIC);
    this.context.addBond(atoms[5]!, atoms[6]!, BondTypeEnum.AROMATIC);
    this.context.addBond(atoms[6]!, atoms[7]!, BondTypeEnum.AROMATIC);
    this.context.addBond(atoms[7]!, atoms[8]!, BondTypeEnum.AROMATIC);

    return atoms;
  }

  /**
   * Create oxirane ring (3-membered ring with O)
   * SMILES: C1CO1
   * Numbering: C1-O-C2 (oxygen at position 2, but substituents only on carbons)
   * @returns Array of atom indices [C1, O, C2] ordered for IUPAC positions [1, 2, 3]
   */
  createOxiraneRing(): number[] {
    const c1 = this.context.addCarbon();
    const o = this.context.addAtom("O");
    const c2 = this.context.addCarbon();

    this.context.addBond(c1, o);
    this.context.addBond(o, c2);
    this.context.addBond(c2, c1);

    // Return all atoms in IUPAC numbering order
    // In Hantzsch-Widman nomenclature, heteroatom gets position 1
    // Position 1 = O, Position 2 = C1, Position 3 = C2
    return [o, c1, c2];
  }

  /**
   * Create oxetane ring (4-membered saturated ring with O)
   * SMILES: C1COC1
   * Hantzsch-Widman numbering: O at position 1
   * @returns Array of atom indices [O, C, C, C]
   */
  createOxetaneRing(): number[] {
    const o = this.context.addAtom("O");
    const c2 = this.context.addCarbon();
    const c3 = this.context.addCarbon();
    const c4 = this.context.addCarbon();

    this.context.addBond(o, c2);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, c4);
    this.context.addBond(c4, o);

    return [o, c2, c3, c4];
  }

  /**
   * Create azetidine ring (4-membered saturated ring with N)
   * SMILES: C1CNC1
   * Hantzsch-Widman numbering: N at position 1
   * @returns Array of atom indices [N, C, C, C]
   */
  createAzetidineRing(): number[] {
    const n = this.context.addAtom("N");
    const c2 = this.context.addCarbon();
    const c3 = this.context.addCarbon();
    const c4 = this.context.addCarbon();

    this.context.addBond(n, c2);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, c4);
    this.context.addBond(c4, n);

    return [n, c2, c3, c4];
  }

  /**
   * Create oxolan ring (5-membered ring with O)
   * SMILES: C1CCOC1
   * @returns Array of atom indices [O, C, C, C, C]
   */
  createOxolanRing(): number[] {
    const o = this.context.addAtom("O");
    const c2 = this.context.addCarbon();
    const c3 = this.context.addCarbon();
    const c4 = this.context.addCarbon();
    const c5 = this.context.addCarbon();

    this.context.addBond(o, c2);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, c4);
    this.context.addBond(c4, c5);
    this.context.addBond(c5, o);

    // IUPAC numbering: O gets position 1, carbons 2,3,4,5
    return [o, c2, c3, c4, c5];
  }

  /**
   * Create 1,2,4-triazine ring (6-membered aromatic ring with 3 N atoms)
   * SMILES: n1nnc(cn1)X where X at position 6
   * IUPAC numbering: 1=N, 2=N, 3=C, 4=N, 5=C, 6=C
   * @returns Array of atom indices [N1, N2, C3, N4, C5, C6]
   */
  createTriazineRing(): number[] {
    const n1 = this.context.addAtom("N", true);
    const n2 = this.context.addAtom("N", true);
    const c3 = this.context.addAtom("C", true);
    const n4 = this.context.addAtom("N", true);
    const c5 = this.context.addAtom("C", true);
    const c6 = this.context.addAtom("C", true);

    this.context.addBond(n1, n2, BondTypeEnum.AROMATIC);
    this.context.addBond(n2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, n4, BondTypeEnum.AROMATIC);
    this.context.addBond(n4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, c6, BondTypeEnum.AROMATIC);
    this.context.addBond(c6, n1, BondTypeEnum.AROMATIC);

    return [n1, n2, c3, n4, c5, c6];
  }

  /**
   * Create furan ring (5-membered aromatic ring with O)
   * SMILES: o1cccc1
   * @returns Array of atom indices [O, C, C, C, C]
   */
  createFuranRing(): number[] {
    const o = this.context.addAtom("O", true);
    const c2 = this.context.addAtom("C", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(o, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, o, BondTypeEnum.AROMATIC);

    return [o, c2, c3, c4, c5];
  }

  /**
   * Create thiophene ring (5-membered aromatic ring with S)
   * SMILES: s1cccc1 (S at position 1)
   * @returns Array of atom indices [S, C, C, C, C]
   */
  createThiopheneRing(): number[] {
    const s = this.context.addAtom("S", true);
    const c2 = this.context.addAtom("C", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    if (process.env.VERBOSE) {
      console.log(
        `[createThiopheneRing] Created atoms: S=${s}, C2=${c2}, C3=${c3}, C4=${c4}, C5=${c5}`,
      );
    }

    this.context.addBond(s, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, s, BondTypeEnum.AROMATIC);

    const result = [s, c2, c3, c4, c5];
    if (process.env.VERBOSE) {
      console.log(`[createThiopheneRing] Returning array:`, result);
    }
    return result;
  }

  /**
   * Create pyrrole ring (5-membered aromatic ring with NH)
   * SMILES: n1cccc1 (N at position 1)
   * @returns Array of atom indices [N, C, C, C, C]
   */
  createPyrroleRing(): number[] {
    const n = this.context.addAtom("N", true);
    const c2 = this.context.addAtom("C", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(n, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, n, BondTypeEnum.AROMATIC);

    this.context.setHydrogens(n, 1);

    return [n, c2, c3, c4, c5];
  }

  /**
   * Create pyridine ring (6-membered aromatic ring with N)
   * SMILES: n1ccccc1 (N at position 1)
   * @returns Array of atom indices [N, C, C, C, C, C]
   */
  createPyridineRing(): number[] {
    const n = this.context.addAtom("N", true);
    const c2 = this.context.addAtom("C", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);
    const c6 = this.context.addAtom("C", true);

    this.context.addBond(n, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, c6, BondTypeEnum.AROMATIC);
    this.context.addBond(c6, n, BondTypeEnum.AROMATIC);

    return [n, c2, c3, c4, c5, c6];
  }

  /**
   * Create thiazole ring (5-membered aromatic ring with S and N)
   * SMILES: c1cscn1 (canonical form)
   * Hantzsch-Widman numbering: S at position 1, N at position 3
   * @returns Array of atom indices [S, C, N, C, C]
   */
  createThiazoleRing(): number[] {
    const s = this.context.addAtom("S", true);
    const c2 = this.context.addAtom("C", true);
    const n = this.context.addAtom("N", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(s, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, n, BondTypeEnum.AROMATIC);
    this.context.addBond(n, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, s, BondTypeEnum.AROMATIC);

    return [s, c2, n, c4, c5];
  }

  /**
   * Create oxazole ring (5-membered aromatic ring with O and N)
   * SMILES: c1cocn1 (canonical form)
   * Hantzsch-Widman numbering: O at position 1, N at position 3
   * @returns Array of atom indices [O, C, N, C, C]
   */
  createOxazoleRing(): number[] {
    const o = this.context.addAtom("O", true);
    const c2 = this.context.addAtom("C", true);
    const n = this.context.addAtom("N", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(o, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, n, BondTypeEnum.AROMATIC);
    this.context.addBond(n, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, o, BondTypeEnum.AROMATIC);

    return [o, c2, n, c4, c5];
  }

  /**
   * Create morpholine ring (6-membered saturated ring with O and N)
   * SMILES: C1CNCCO1
   * @returns Array of atom indices [C, C, N, C, C, O]
   */
  createMorpholineRing(): number[] {
    const c1 = this.context.addCarbon();
    const c2 = this.context.addCarbon();
    const n = this.context.addAtom("N");
    const c4 = this.context.addCarbon();
    const c5 = this.context.addCarbon();
    const o = this.context.addAtom("O");

    this.context.addBond(c1, c2);
    this.context.addBond(c2, n);
    this.context.addBond(n, c4);
    this.context.addBond(c4, c5);
    this.context.addBond(c5, o);
    this.context.addBond(o, c1);

    return [c1, c2, n, c4, c5, o];
  }

  /**
   * Create piperidine ring (6-membered saturated ring with N)
   * SMILES: C1CCNCC1
   * @returns Array of atom indices [C, C, C, N, C, C]
   */
  createPiperidineRing(): number[] {
    const c1 = this.context.addCarbon();
    const c2 = this.context.addCarbon();
    const c3 = this.context.addCarbon();
    const n = this.context.addAtom("N");
    const c5 = this.context.addCarbon();
    const c6 = this.context.addCarbon();

    this.context.addBond(c1, c2);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, n);
    this.context.addBond(n, c5);
    this.context.addBond(c5, c6);
    this.context.addBond(c6, c1);

    return [c1, c2, c3, n, c5, c6];
  }

  /**
   * Create pyrrolidine ring (5-membered saturated ring with N)
   * SMILES: C1CCNC1
   * @returns Array of atom indices [C, C, C, N, C]
   */
  createPyrrolidineRing(): number[] {
    const c1 = this.context.addCarbon();
    const c2 = this.context.addCarbon();
    const c3 = this.context.addCarbon();
    const n = this.context.addAtom("N");
    const c5 = this.context.addCarbon();

    this.context.addBond(c1, c2);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, n);
    this.context.addBond(n, c5);
    this.context.addBond(c5, c1);

    return [c1, c2, c3, n, c5];
  }

  /**
   * Create piperazine ring (6-membered saturated ring with 2 N)
   * SMILES: C1CNCCN1
   * @returns Array of atom indices [C, C, N, C, C, N]
   */
  createPiperazineRing(): number[] {
    const c1 = this.context.addCarbon();
    const c2 = this.context.addCarbon();
    const n3 = this.context.addAtom("N");
    const c4 = this.context.addCarbon();
    const c5 = this.context.addCarbon();
    const n6 = this.context.addAtom("N");

    this.context.addBond(c1, c2);
    this.context.addBond(c2, n3);
    this.context.addBond(n3, c4);
    this.context.addBond(c4, c5);
    this.context.addBond(c5, n6);
    this.context.addBond(n6, c1);

    return [c1, c2, n3, c4, c5, n6];
  }

  /**
   * Create oxane ring (6-membered saturated ring with O, tetrahydropyran)
   * SMILES: C1CCOCC1
   * Hantzsch-Widman numbering: O at position 1
   * @returns Array of atom indices [O, C, C, C, C, C]
   */
  createOxaneRing(): number[] {
    const o = this.context.addAtom("O");
    const c2 = this.context.addCarbon();
    const c3 = this.context.addCarbon();
    const c4 = this.context.addCarbon();
    const c5 = this.context.addCarbon();
    const c6 = this.context.addCarbon();

    this.context.addBond(o, c2);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, c4);
    this.context.addBond(c4, c5);
    this.context.addBond(c5, c6);
    this.context.addBond(c6, o);

    return [o, c2, c3, c4, c5, c6];
  }

  /**
   * Create thiane ring (6-membered saturated ring with S, tetrahydrothiopyran)
   * SMILES: C1CCSCC1
   * Hantzsch-Widman numbering: S at position 1
   * @returns Array of atom indices [S, C, C, C, C, C]
   */
  createThianeRing(): number[] {
    const s = this.context.addAtom("S");
    const c2 = this.context.addCarbon();
    const c3 = this.context.addCarbon();
    const c4 = this.context.addCarbon();
    const c5 = this.context.addCarbon();
    const c6 = this.context.addCarbon();

    this.context.addBond(s, c2);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, c4);
    this.context.addBond(c4, c5);
    this.context.addBond(c5, c6);
    this.context.addBond(c6, s);

    return [s, c2, c3, c4, c5, c6];
  }

  /**
   * Create thiolane ring (5-membered saturated ring with S, tetrahydrothiophene)
   * SMILES: C1CCSC1
   * Hantzsch-Widman numbering: S at position 1
   * @returns Array of atom indices [S, C, C, C, C]
   */
  createThiolaneRing(): number[] {
    const s = this.context.addAtom("S");
    const c2 = this.context.addCarbon();
    const c3 = this.context.addCarbon();
    const c4 = this.context.addCarbon();
    const c5 = this.context.addCarbon();

    this.context.addBond(s, c2);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, c4);
    this.context.addBond(c4, c5);
    this.context.addBond(c5, s);

    return [s, c2, c3, c4, c5];
  }

  /**
   * Create quinoline ring (benzopyridine)
   * SMILES: n1cccc2ccccc21
   * Numbering order: N1, C2, C3, C4, C5, C6, C7, C8, C4a, C8a
   * @returns Array of atom indices [10 atoms]
   */
  createQuinolineRing(): number[] {
    const atoms: number[] = [];

    // 1: Nitrogen
    const n1 = this.context.addAtom("N", true);
    atoms.push(n1);

    // 2, 3, 4: Pyridine carbons
    const c2 = this.context.addAtom("C", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    atoms.push(c2, c3, c4);

    // 5, 6, 7, 8: Benzene carbons
    const c5 = this.context.addAtom("C", true);
    const c6 = this.context.addAtom("C", true);
    const c7 = this.context.addAtom("C", true);
    const c8 = this.context.addAtom("C", true);
    atoms.push(c5, c6, c7, c8);

    // Bridgeheads: 4a, 8a
    const c4a = this.context.addAtom("C", true);
    const c8a = this.context.addAtom("C", true);
    atoms.push(c4a, c8a);

    // Pyridine ring: N1-C2-C3-C4-C4a-C8a-N1
    this.context.addBond(n1, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c4a, BondTypeEnum.AROMATIC);
    this.context.addBond(c4a, c8a, BondTypeEnum.AROMATIC); // Fusion
    this.context.addBond(c8a, n1, BondTypeEnum.AROMATIC);

    // Benzene ring: C5-C6-C7-C8-C8a-C4a-C5
    this.context.addBond(c5, c6, BondTypeEnum.AROMATIC);
    this.context.addBond(c6, c7, BondTypeEnum.AROMATIC);
    this.context.addBond(c7, c8, BondTypeEnum.AROMATIC);
    this.context.addBond(c8, c8a, BondTypeEnum.AROMATIC);
    // c8a-c4a is already bonded
    this.context.addBond(c4a, c5, BondTypeEnum.AROMATIC);

    return atoms;
  }

  /**
   * Create indole ring (fused pyrrole + benzene)
   * SMILES: c1ccc2[nH]ccc2c1
   * Structure: Benzene ring C0-C1-C2-C3-C7-C8-C0 fused with pyrrole C3-N4-C5-C6-C7-C3
   * Shared edge: C3-C7
   * @returns Array of atom indices [9 atoms: C0-C8, N4]
   */
  createIndoleRing(): number[] {
    const atoms: number[] = [];

    // Create all atoms: C0-C1-C2-C3(fused)-N4-C5-C6-C7(fused)-C8
    for (let i = 0; i < 4; i++) {
      atoms.push(this.context.addAtom("C", true));
    }
    const n = this.context.addAtom("N", true); // 4: N with H
    atoms.push(n);

    for (let i = 5; i < 9; i++) {
      atoms.push(this.context.addAtom("C", true));
    }

    // Benzene ring: C0-C1-C2-C3-C7-C8-C0 (6-membered)
    this.context.addBond(atoms[0]!, atoms[1]!, BondTypeEnum.AROMATIC); // C0-C1
    this.context.addBond(atoms[1]!, atoms[2]!, BondTypeEnum.AROMATIC); // C1-C2
    this.context.addBond(atoms[2]!, atoms[3]!, BondTypeEnum.AROMATIC); // C2-C3
    this.context.addBond(atoms[3]!, atoms[7]!, BondTypeEnum.AROMATIC); // C3-C7 (fusion edge)
    this.context.addBond(atoms[7]!, atoms[8]!, BondTypeEnum.AROMATIC); // C7-C8
    this.context.addBond(atoms[8]!, atoms[0]!, BondTypeEnum.AROMATIC); // C8-C0

    // Pyrrole ring: C3-N4-C5-C6-C7-C3 (5-membered)
    this.context.addBond(atoms[3]!, atoms[4]!, BondTypeEnum.AROMATIC); // C3-N4
    this.context.addBond(atoms[4]!, atoms[5]!, BondTypeEnum.AROMATIC); // N4-C5
    this.context.addBond(atoms[5]!, atoms[6]!, BondTypeEnum.AROMATIC); // C5-C6
    this.context.addBond(atoms[6]!, atoms[7]!, BondTypeEnum.AROMATIC); // C6-C7 (completes pyrrole, C7 already bonded to C3)

    this.context.setHydrogens(n, 1);

    return atoms;
  }

  /**
   * Create benzofuran ring (benzofused furan)
   * Numbering order for array: O1, C2, C3, C4, C5, C6, C7, C3a(bridge), C7a(bridge)
   * This ensures locants 1-7 map correctly to array indices 0-6
   * @returns Array of 9 atom indices
   */
  createBenzofuranRing(): number[] {
    const atoms: number[] = [];

    // 1: Oxygen
    const o1 = this.context.addAtom("O", true);
    atoms.push(o1);

    // 2, 3: Furan carbons
    const c2 = this.context.addAtom("C", true);
    const c3 = this.context.addAtom("C", true);
    atoms.push(c2, c3);

    // 4, 5, 6, 7: Benzene carbons
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);
    const c6 = this.context.addAtom("C", true);
    const c7 = this.context.addAtom("C", true);
    atoms.push(c4, c5, c6, c7);

    // Bridgeheads (3a, 7a)
    const c3a = this.context.addAtom("C", true);
    const c7a = this.context.addAtom("C", true);
    atoms.push(c3a, c7a);

    // Connections
    // Furan ring: O1-C2-C3-C3a-C7a-O1
    this.context.addBond(o1, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c3a, BondTypeEnum.AROMATIC);
    this.context.addBond(c3a, c7a, BondTypeEnum.AROMATIC); // Fusion bond
    this.context.addBond(c7a, o1, BondTypeEnum.AROMATIC);

    // Benzene ring: C4-C5-C6-C7-C7a-C3a-C4
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, c6, BondTypeEnum.AROMATIC);
    this.context.addBond(c6, c7, BondTypeEnum.AROMATIC);
    this.context.addBond(c7, c7a, BondTypeEnum.AROMATIC);
    // c7a-c3a is already bonded (fusion)
    this.context.addBond(c3a, c4, BondTypeEnum.AROMATIC);

    return atoms;
  }

  /**
   * Create isoindole ring (benzo[c]pyrrole)
   * SMILES: c1ccc2c(c1)c[nH]2
   * Numbering order: C1, N2, C3, C4, C5, C6, C7, C3a, C7a
   * @returns Array of 9 atom indices
   */
  createIsoindolRing(): number[] {
    const atoms: number[] = [];

    // 1: Carbon
    const c1 = this.context.addAtom("C", true);
    atoms.push(c1);

    // 2: Nitrogen
    const n2 = this.context.addAtom("N", true);
    atoms.push(n2);

    // 3: Carbon
    const c3 = this.context.addAtom("C", true);
    atoms.push(c3);

    // 4, 5, 6, 7: Benzene carbons
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);
    const c6 = this.context.addAtom("C", true);
    const c7 = this.context.addAtom("C", true);
    atoms.push(c4, c5, c6, c7);

    // Bridgeheads: 3a, 7a
    const c3a = this.context.addAtom("C", true);
    const c7a = this.context.addAtom("C", true);
    atoms.push(c3a, c7a);

    // Connections
    // Pyrrole ring: C1-N2-C3-C3a-C7a-C1
    this.context.addBond(c1, n2, BondTypeEnum.AROMATIC);
    this.context.addBond(n2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c3a, BondTypeEnum.AROMATIC);
    this.context.addBond(c3a, c7a, BondTypeEnum.AROMATIC); // Fusion
    this.context.addBond(c7a, c1, BondTypeEnum.AROMATIC);

    // Benzene ring: C4-C5-C6-C7-C7a-C3a-C4
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, c6, BondTypeEnum.AROMATIC);
    this.context.addBond(c6, c7, BondTypeEnum.AROMATIC);
    this.context.addBond(c7, c7a, BondTypeEnum.AROMATIC);
    // c7a-c3a already bonded
    this.context.addBond(c3a, c4, BondTypeEnum.AROMATIC);

    this.context.setHydrogens(n2, 1);

    return atoms;
  }

  /**
   * Create diaziridine ring (3-membered ring with 2 N atoms)
   * SMILES: N1NCC1 or similar
   * Hantzsch-Widman numbering: N atoms at positions 1 and 2, C at 3
   * @returns Array of atom indices [N, N, C]
   */
  createDiaziridineRing(): number[] {
    const n1 = this.context.addAtom("N");
    const n2 = this.context.addAtom("N");
    const c3 = this.context.addCarbon();

    this.context.addBond(n1, n2);
    this.context.addBond(n2, c3);
    this.context.addBond(c3, n1);

    return [n1, n2, c3];
  }

  /**
   * Create azirine ring (3-membered ring with 1 N and C=N double bond)
   * Hantzsch-Widman numbering: N at position 1, C at positions 2 and 3
   * SMILES: N1CC1 with double bond: C1=N1 written as C1=N-C1
   * @returns Array of atom indices [N, C, C] for positions [1, 2, 3]
   */
  createAzirineRing(): number[] {
    const n1 = this.context.addAtom("N");
    const c2 = this.context.addAtom("C");
    const c3 = this.context.addAtom("C");

    this.context.addBond(n1, c2, BondTypeEnum.DOUBLE);
    this.context.addBond(c2, c3);
    this.context.addBond(c3, n1);

    return [n1, c2, c3];
  }

  /**
   * Create imidazolidine ring (5-membered ring with 2 N atoms, saturated)
   * SMILES: N1CCNC1
   * Hantzsch-Widman numbering: N at positions 1 and 3, C at 2, 4, 5
   * @returns Array of atom indices [N, C, N, C, C]
   */
  createImidazolidineRing(): number[] {
    const n1 = this.context.addAtom("N");
    const c2 = this.context.addCarbon();
    const n3 = this.context.addAtom("N");
    const c4 = this.context.addCarbon();
    const c5 = this.context.addCarbon();

    this.context.addBond(n1, c2);
    this.context.addBond(c2, n3);
    this.context.addBond(n3, c4);
    this.context.addBond(c4, c5);
    this.context.addBond(c5, n1);

    return [n1, c2, n3, c4, c5];
  }

  /**
   * Create triazole ring (5-membered aromatic ring with 3 N atoms)
   * SMILES: c1c[nH]nn1
   * Hantzsch-Widman numbering: N at positions 1, 2, 4; C at 3, 5
   * @returns Array of atom indices [N, N, C, N, C]
   */
  createTriazoleRing(): number[] {
    const n1 = this.context.addAtom("N", true); // aromatic
    const n2 = this.context.addAtom("N", true);
    const c3 = this.context.addAtom("C", true);
    const n4 = this.context.addAtom("N", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(n1, n2, BondTypeEnum.AROMATIC);
    this.context.addBond(n2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, n4, BondTypeEnum.AROMATIC);
    this.context.addBond(n4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, n1, BondTypeEnum.AROMATIC);

    return [n1, n2, c3, n4, c5];
  }

  /**
   * Create pyrazole ring (5-membered aromatic ring with N at positions 1,2)
   * SMILES: c1c[nH]nc1 or n1nccc1 (canonical)
   * Hantzsch-Widman: N(1), N(2), C(3), C(4), C(5)
   * @returns Array of atom indices [N1, N2, C3, C4, C5]
   */
  createPyrazoleRing(): number[] {
    const n1 = this.context.addAtom("N", true);
    const n2 = this.context.addAtom("N", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(n1, n2, BondTypeEnum.AROMATIC);
    this.context.addBond(n2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, n1, BondTypeEnum.AROMATIC);

    // Set H on N1
    this.context.setHydrogens(n1, 1);

    return [n1, n2, c3, c4, c5];
  }

  /**
   * Create imidazole ring (5-membered aromatic ring with 2 nitrogens at positions 1,3)
   * SMILES: c1c[nH]cn1 (canonical form)
   * Hantzsch-Widman numbering: N at positions 1,3
   * @returns Array of atom indices [N1, C2, N3, C4, C5]
   */
  createImidazoleRing(): number[] {
    const n1 = this.context.addAtom("N", true);
    const c2 = this.context.addAtom("C", true);
    const n3 = this.context.addAtom("N", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(n1, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, n3, BondTypeEnum.AROMATIC);
    this.context.addBond(n3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, n1, BondTypeEnum.AROMATIC);

    return [n1, c2, n3, c4, c5];
  }

  /**
   * Create isoxazole ring (5-membered aromatic ring with O at position 1, N at position 2)
   * SMILES: o1nccc1 (aromatic form with O-N adjacent)
   * Hantzsch-Widman: O(1), N(2), C(3), C(4), C(5)
   * @returns Array of atom indices [O, N, C3, C4, C5]
   */
  createIsoxazoleRing(): number[] {
    const o = this.context.addAtom("O", true);
    const n = this.context.addAtom("N", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(o, n, BondTypeEnum.AROMATIC);
    this.context.addBond(n, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, o, BondTypeEnum.AROMATIC);

    return [o, n, c3, c4, c5];
  }

  /**
   * Create tetrazole ring (5-membered aromatic ring with 4 nitrogens, 1 carbon)
   * SMILES: c1nnn[nH]1 (1H-tetrazole) - explicit H required for aromaticity
   * Structure: C(1), N(2), N(3), N(4), N(5)
   * Note: One nitrogen must have H to achieve 6 π electrons (Hückel 4n+2 rule)
   * @returns Array of atom indices [C, N2, N3, N4, N5]
   */
  createTetrazoleRing(): number[] {
    const c1 = this.context.addAtom("C", true);
    const n2 = this.context.addAtom("N", true);
    const n3 = this.context.addAtom("N", true);
    const n4 = this.context.addAtom("N", true);
    const n5 = this.context.addAtom("N", true);

    this.context.addBond(c1, n2, BondTypeEnum.AROMATIC);
    this.context.addBond(n2, n3, BondTypeEnum.AROMATIC);
    this.context.addBond(n3, n4, BondTypeEnum.AROMATIC);
    this.context.addBond(n4, n5, BondTypeEnum.AROMATIC);
    this.context.addBond(n5, c1, BondTypeEnum.AROMATIC);

    this.context.setHydrogens(n2, 1);

    return [c1, n2, n3, n4, n5];
  }

  /**
   * Create isothiazole ring (5-membered aromatic ring with S at position 1, N at position 2)
   * SMILES: s1nccc1 (aromatic form with S-N adjacent)
   * Hantzsch-Widman: S(1), N(2), C(3), C(4), C(5)
   * @returns Array of atom indices [S, N, C3, C4, C5]
   */
  createIsothiazoleRing(): number[] {
    const s = this.context.addAtom("S", true);
    const n = this.context.addAtom("N", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);

    this.context.addBond(s, n, BondTypeEnum.AROMATIC);
    this.context.addBond(n, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, s, BondTypeEnum.AROMATIC);

    return [s, n, c3, c4, c5];
  }

  /**
   * Create pyrimidine ring (6-membered aromatic ring with N at positions 1,3)
   * SMILES: c1cnc[nH]c1 or aromatic form
   * Structure: C(1), C(2), N(3), C(4), N(5), C(6)
   * @returns Array of atom indices [C1, C2, N3, C4, N5, C6]
   */
  createPyrimidineRing(): number[] {
    const c1 = this.context.addAtom("C", true);
    const c2 = this.context.addAtom("C", true);
    const n3 = this.context.addAtom("N", true);
    const c4 = this.context.addAtom("C", true);
    const n5 = this.context.addAtom("N", true);
    const c6 = this.context.addAtom("C", true);

    this.context.addBond(c1, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, n3, BondTypeEnum.AROMATIC);
    this.context.addBond(n3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, n5, BondTypeEnum.AROMATIC);
    this.context.addBond(n5, c6, BondTypeEnum.AROMATIC);
    this.context.addBond(c6, c1, BondTypeEnum.AROMATIC);

    return [c1, c2, n3, c4, n5, c6];
  }

  /**
   * Create pyrazine ring (6-membered aromatic ring with N at positions 1,4)
   * SMILES: c1cnccn1
   * Structure: N(1), C(2), N(3), C(4), C(5), C(6)
   * @returns Array of atom indices [N1, C2, N3, C4, C5, C6]
   */
  createPyrazineRing(): number[] {
    const n1 = this.context.addAtom("N", true);
    const c2 = this.context.addAtom("C", true);
    const n3 = this.context.addAtom("N", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);
    const c6 = this.context.addAtom("C", true);

    this.context.addBond(n1, c2, BondTypeEnum.AROMATIC);
    this.context.addBond(c2, n3, BondTypeEnum.AROMATIC);
    this.context.addBond(n3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, c6, BondTypeEnum.AROMATIC);
    this.context.addBond(c6, n1, BondTypeEnum.AROMATIC);

    return [n1, c2, n3, c4, c5, c6];
  }

  /**
   * Create pyridazine ring (6-membered aromatic ring with N at positions 1,2)
   * SMILES: c1ccnnc1 or aromatic form
   * Structure: N(1), N(2), C(3), C(4), C(5), C(6)
   * @returns Array of atom indices [N1, N2, C3, C4, C5, C6]
   */
  createPyridazineRing(): number[] {
    const n1 = this.context.addAtom("N", true);
    const n2 = this.context.addAtom("N", true);
    const c3 = this.context.addAtom("C", true);
    const c4 = this.context.addAtom("C", true);
    const c5 = this.context.addAtom("C", true);
    const c6 = this.context.addAtom("C", true);

    this.context.addBond(n1, n2, BondTypeEnum.AROMATIC);
    this.context.addBond(n2, c3, BondTypeEnum.AROMATIC);
    this.context.addBond(c3, c4, BondTypeEnum.AROMATIC);
    this.context.addBond(c4, c5, BondTypeEnum.AROMATIC);
    this.context.addBond(c5, c6, BondTypeEnum.AROMATIC);
    this.context.addBond(c6, n1, BondTypeEnum.AROMATIC);

    return [n1, n2, c3, c4, c5, c6];
  }

  /**
   * Create saturated (non-aromatic) thiazole ring (5-membered with S and N)
   * Used when "4H-1,3-thiazole" notation indicates a saturated form
   * Creates Kekule structure with explicit single/double bonds
   * SMILES: C1=NC(S1)=C or similar Kekule form
   * @returns Array of atom indices [S, C, N, C, C]
   */
  createThiazoleSaturated(): number[] {
    const s = this.context.addAtom("S", false); // Not aromatic
    const c2 = this.context.addAtom("C", false);
    const n = this.context.addAtom("N", false);
    const c4 = this.context.addAtom("C", false);
    const c5 = this.context.addAtom("C", false);

    // Kekule structure: single/double alternating
    // S-C (single), C=N (double), N-C (single), C=C (double), C-S (single)
    this.context.addBond(s, c2, BondTypeEnum.SINGLE);
    this.context.addBond(c2, n, BondTypeEnum.DOUBLE);
    this.context.addBond(n, c4, BondTypeEnum.SINGLE);
    this.context.addBond(c4, c5, BondTypeEnum.DOUBLE);
    this.context.addBond(c5, s, BondTypeEnum.SINGLE);

    return [s, c2, n, c4, c5];
  }

  /**
   * Create saturated (non-aromatic) oxazole ring (5-membered with O and N)
   * Used when "4H-1,3-oxazole" notation indicates a saturated form
   * SMILES: C1=NC(O1)=C or similar Kekule form
   * @returns Array of atom indices [O, C, N, C, C]
   */
  createOxazoleSaturated(): number[] {
    const o = this.context.addAtom("O", false);
    const c2 = this.context.addAtom("C", false);
    const n = this.context.addAtom("N", false);
    const c4 = this.context.addAtom("C", false);
    const c5 = this.context.addAtom("C", false);

    // Kekule structure
    this.context.addBond(o, c2, BondTypeEnum.SINGLE);
    this.context.addBond(c2, n, BondTypeEnum.DOUBLE);
    this.context.addBond(n, c4, BondTypeEnum.SINGLE);
    this.context.addBond(c4, c5, BondTypeEnum.DOUBLE);
    this.context.addBond(c5, o, BondTypeEnum.SINGLE);

    return [o, c2, n, c4, c5];
  }

  /**
   * Create saturated (non-aromatic) imidazole ring (5-membered with N at positions 1,3)
   * Used when "4H-1,3-imidazole" notation indicates saturated form
   * @returns Array of atom indices [N1, C2, N3, C4, C5]
   */
  createImidazoleSaturated(): number[] {
    const n1 = this.context.addAtom("N", false);
    const c2 = this.context.addAtom("C", false);
    const n3 = this.context.addAtom("N", false);
    const c4 = this.context.addAtom("C", false);
    const c5 = this.context.addAtom("C", false);

    // Kekule structure
    this.context.addBond(n1, c2, BondTypeEnum.DOUBLE);
    this.context.addBond(c2, n3, BondTypeEnum.SINGLE);
    this.context.addBond(n3, c4, BondTypeEnum.DOUBLE);
    this.context.addBond(c4, c5, BondTypeEnum.SINGLE);
    this.context.addBond(c5, n1, BondTypeEnum.SINGLE);

    return [n1, c2, n3, c4, c5];
  }

  /**
   * Create saturated (non-aromatic) isothiazole ring (5-membered with S at 1, N at 2)
   * @returns Array of atom indices [S, N, C3, C4, C5]
   */
  createIsothiazoleSaturated(): number[] {
    const s = this.context.addAtom("S", false);
    const n = this.context.addAtom("N", false);
    const c3 = this.context.addAtom("C", false);
    const c4 = this.context.addAtom("C", false);
    const c5 = this.context.addAtom("C", false);

    // Kekule structure
    this.context.addBond(s, n, BondTypeEnum.DOUBLE);
    this.context.addBond(n, c3, BondTypeEnum.SINGLE);
    this.context.addBond(c3, c4, BondTypeEnum.DOUBLE);
    this.context.addBond(c4, c5, BondTypeEnum.SINGLE);
    this.context.addBond(c5, s, BondTypeEnum.SINGLE);

    return [s, n, c3, c4, c5];
  }

  /**
   * Create saturated (non-aromatic) pyrazole ring (5-membered with N at positions 1,2)
   * @returns Array of atom indices [N1, N2, C3, C4, C5]
   */
  createPyrazoleSaturated(): number[] {
    const n1 = this.context.addAtom("N", false);
    const n2 = this.context.addAtom("N", false);
    const c3 = this.context.addAtom("C", false);
    const c4 = this.context.addAtom("C", false);
    const c5 = this.context.addAtom("C", false);

    // Kekule structure
    this.context.addBond(n1, n2, BondTypeEnum.DOUBLE);
    this.context.addBond(n2, c3, BondTypeEnum.SINGLE);
    this.context.addBond(c3, c4, BondTypeEnum.DOUBLE);
    this.context.addBond(c4, c5, BondTypeEnum.SINGLE);
    this.context.addBond(c5, n1, BondTypeEnum.SINGLE);

    return [n1, n2, c3, c4, c5];
  }
}
