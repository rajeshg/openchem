export const ALKYL_NAMES = {
  METHYL: "methyl",
  ETHYL: "ethyl",
  PROPYL: "propyl",
  BUTYL: "butyl",
  PENTYL: "pentyl",
  HEXYL: "hexyl",
  HEPTYL: "heptyl",
  OCTYL: "octyl",
  NONYL: "nonyl",
  DECYL: "decyl",
} as const;

export const ALKYL_LENGTHS: Record<string, number> = {
  meth: 1,
  methyl: 1,
  eth: 2,
  ethyl: 2,
  prop: 3,
  propyl: 3,
  but: 4,
  butyl: 4,
  pent: 5,
  pentyl: 5,
  hex: 6,
  hexyl: 6,
  hept: 7,
  heptyl: 7,
  oct: 8,
  octyl: 8,
  non: 9,
  nonyl: 9,
  dec: 10,
  decyl: 10,
};

export const SUBSTITUENT_NAMES = {
  HYDROXY: "hydroxy",
  HYDROXYL: "hydroxyl",
  METHYL: "methyl",
  ETHYL: "ethyl",
  CHLORO: "chloro",
  BROMO: "bromo",
  FLUORO: "fluoro",
  IODO: "iodo",
  OXO: "oxo",
  AMINO: "amino",
  ANILINO: "anilino",
} as const;

export const SUFFIX_NAMES = {
  YL: "yl",
  OXY: "oxy",
  IDENE: "idene",
  YLIDENE: "ylidene",
  OYL: "oyl",
  SULFAMOYL: "sulfamoyl",
  SULFONYL: "sulfonyl",
  SULFINYL: "sulfinyl",
  SULFANYL: "sulfanyl",
  AMIDE: "amide",
} as const;

export const PREFIX_NAMES = {
  SPIRO: "spiro",
  BICYCLO: "bicyclo",
  CYCLO: "cyclo",
} as const;

export const RING_NAMES = {
  PHENYL: "phenyl",
  BENZENE: "benzene",
  PYRIDINE: "pyridine",
  OXOLAN: "oxolan",
  OXANE: "oxane",
} as const;

export const PATTERNS = {
  SILYL: /silyl|silanyl/i,
  PHENYL: /phenyl$/i,
  OXY_ENDING: /oxy$/i,
  YL_ENDING: /yl$/i,
  SULFUR_GROUP: /sulfonyl|sulfinyl|sulfanyl/i,
  ACYL: /oyl$/i,
} as const;
