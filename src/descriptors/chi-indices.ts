import type { Molecule } from "types";
import type { ChiProperties } from "./types";
import {
  getChi0,
  getChi0n,
  getChi0v,
  getChi1,
  getChi1n,
  getChi1v,
  getChi2n,
  getChi2v,
  getChi3n,
  getChi3v,
  getChi4n,
  getChi4v,
} from "src/utils/chi-indices";

export function chi(mol: Molecule): ChiProperties {
  return {
    chi0: getChi0(mol),
    chi0n: getChi0n(mol),
    chi0v: getChi0v(mol),
    chi1: getChi1(mol),
    chi1n: getChi1n(mol),
    chi1v: getChi1v(mol),
    chi2n: getChi2n(mol),
    chi2v: getChi2v(mol),
    chi3n: getChi3n(mol),
    chi3v: getChi3v(mol),
    chi4n: getChi4n(mol),
    chi4v: getChi4v(mol),
  };
}
