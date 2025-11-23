import type { Molecule } from "types";
import type { TopologyProperties } from "./types";
import {
  getKappa1,
  getKappa2,
  getKappa3,
  getHallKierAlpha,
  getBertzCT,
} from "src/utils/topology-descriptors";

export function topology(mol: Molecule): TopologyProperties {
  return {
    kappa1: getKappa1(mol),
    kappa2: getKappa2(mol),
    kappa3: getKappa3(mol),
    hallKierAlpha: getHallKierAlpha(mol),
    bertzCT: getBertzCT(mol),
  };
}
