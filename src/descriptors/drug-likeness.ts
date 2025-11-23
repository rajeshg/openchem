import type { Molecule } from "types";
import type {
  DrugLikenessProperties,
  LipinskiResult,
  VeberResult,
  BBBResult,
} from "./types";
import {
  checkLipinskiRuleOfFive,
  checkVeberRules,
  checkBBBPenetration,
} from "src/utils/molecular-properties";

export function drugLikeness(mol: Molecule): DrugLikenessProperties {
  const lipinskiOld = checkLipinskiRuleOfFive(mol);
  const veberOld = checkVeberRules(mol);
  const bbbOld = checkBBBPenetration(mol);

  const lipinski: LipinskiResult = {
    passes: lipinskiOld.passes,
    violations: lipinskiOld.violations,
    properties: {
      mw: (lipinskiOld.properties as { molecularWeight: number })
        .molecularWeight,
      logP: lipinskiOld.properties.logP,
      hbondDonors: lipinskiOld.properties.hbondDonors,
      hbondAcceptors: lipinskiOld.properties.hbondAcceptors,
    },
  };

  const veber: VeberResult = {
    passes: veberOld.passes,
    violations: veberOld.violations,
    properties: {
      rotatableBonds: veberOld.properties.rotatableBonds,
      tpsa: veberOld.properties.tpsa,
    },
  };

  const bbb: BBBResult = {
    penetrates: bbbOld.likelyPenetration,
    reason: bbbOld.likelyPenetration
      ? undefined
      : `TPSA ${bbbOld.tpsa.toFixed(1)} > 90`,
    properties: {
      tpsa: bbbOld.tpsa,
      logP: lipinskiOld.properties.logP,
    },
  };

  return { lipinski, veber, bbb };
}
