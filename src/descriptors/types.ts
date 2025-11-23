export interface BasicProperties {
  formula: string;
  mass: number;
  exactMass: number;
  atoms: number;
  heavyAtoms: number;
  heteroAtoms: number;
  bonds: number;
}

export interface PhysicochemicalProperties {
  logP: number;
  tpsa: number;
  rotatableBonds: number;
  hbondDonors: number;
  hbondAcceptors: number;
  fractionCsp3: number;
  labuteASA: number;
}

export interface StructuralProperties {
  rings: number;
  aromaticRings: number;
  saturatedRings: number;
  aliphaticRings: number;
  saturatedAliphaticRings: number;
  heterocycles: number;
  aromaticHeterocycles: number;
  saturatedHeterocycles: number;
  aliphaticHeterocycles: number;
  spiroAtoms: number;
  bridgeheadAtoms: number;
  stereocenters: number;
  unspecifiedStereocenters: number;
}

export interface LipinskiResult {
  passes: boolean;
  violations: string[];
  properties: {
    mw: number;
    logP: number;
    hbondDonors: number;
    hbondAcceptors: number;
  };
}

export interface VeberResult {
  passes: boolean;
  violations: string[];
  properties: {
    rotatableBonds: number;
    tpsa: number;
  };
}

export interface BBBResult {
  penetrates: boolean;
  reason?: string;
  properties: {
    tpsa: number;
    logP: number;
  };
}

export interface DrugLikenessProperties {
  lipinski: LipinskiResult;
  veber: VeberResult;
  bbb: BBBResult;
}

export interface TopologyProperties {
  kappa1: number;
  kappa2: number;
  kappa3: number;
  hallKierAlpha: number;
  bertzCT: number;
}

export interface ChiProperties {
  chi0: number;
  chi0n: number;
  chi0v: number;
  chi1: number;
  chi1n: number;
  chi1v: number;
  chi2n: number;
  chi2v: number;
  chi3n: number;
  chi3v: number;
  chi4n: number;
  chi4v: number;
}

export interface MolecularProperties
  extends BasicProperties,
    PhysicochemicalProperties,
    StructuralProperties {
  lipinskiPass: boolean;
  veberPass: boolean;
  bbbPenetration: boolean;
}
