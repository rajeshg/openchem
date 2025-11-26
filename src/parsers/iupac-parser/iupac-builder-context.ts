import type { IUPACToken } from "./iupac-types";
import type { MoleculeGraphBuilder } from "../molecule-graph-builder";

export interface IUPACBuilderContext {
  applySubstituents(
    builder: MoleculeGraphBuilder,
    chainAtoms: number[],
    substituents: IUPACToken[],
    locants: IUPACToken[],
    multipliers: IUPACToken[],
    reverseNumbering: boolean,
    suffixes: IUPACToken[],
    prefixes: IUPACToken[],
  ): void;

  applySuffixes(
    builder: MoleculeGraphBuilder,
    chainAtoms: number[],
    suffixes: IUPACToken[],
    locants: IUPACToken[],
    substituents: IUPACToken[],
    multipliers?: IUPACToken[],
  ): void;

  applyStereo(
    builder: MoleculeGraphBuilder,
    chainAtoms: number[],
    stereoTokens: IUPACToken[],
    suffixTokens: IUPACToken[],
    locantTokens: IUPACToken[],
  ): void;

  locantToAtomIndex(
    locant: number,
    chainAtoms: number[],
    reverseNumbering?: boolean,
  ): number | null;

  getLocantsBeforeSuffix(suffix: IUPACToken, locantTokens: IUPACToken[]): number[];

  getLocantsBeforeSubstituent(substituent: IUPACToken, locantTokens: IUPACToken[]): number[];

  getMultiplierBeforeSubstituent(
    substituent: IUPACToken,
    multiplierTokens: IUPACToken[],
  ): IUPACToken | null;

  getAlkylLength(alkylName: string): number;

  buildBranchedAlkylFragment(
    builder: MoleculeGraphBuilder,
    branchType: string,
  ): { fragmentAtoms: number[]; attachmentPoint: number } | null;

  buildSilylGroup(builder: MoleculeGraphBuilder, name: string): number;
}
