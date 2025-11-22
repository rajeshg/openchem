/**
 * Unified Generators: Support for both Molecule and PackedMolecule
 *
 * This module wraps the existing generators to accept both Molecule and
 * PackedMolecule transparently. All existing APIs remain unchanged.
 */

import type { MoleculeOrPacked } from "src/utils/molecule-adapter";
import { getMolecule } from "src/utils/molecule-adapter";
import { generateSMILES as generateSMILESBase } from "src/generators/smiles-generator";
import { generateMolfile as generateMolfileBase } from "src/generators/mol-generator";
import {
  renderSVG as renderSVGBase,
  type SVGRendererOptions,
  type SVGRenderResult,
} from "src/generators/svg-renderer";
import {
  generateInChI as generateInChIBase,
  generateInChIKey as generateInChIKeyBase,
} from "src/generators/inchi-generator";

/**
 * Generate SMILES from molecule (accepts both Molecule and PackedMolecule)
 */
export function generateSMILESUnified(molecule: MoleculeOrPacked): string {
  const mol = getMolecule(molecule);
  return generateSMILESBase(mol);
}

/**
 * Generate MOL/V2000 format from molecule
 */
export function generateMolfileUnified(molecule: MoleculeOrPacked): string {
  const mol = getMolecule(molecule);
  return generateMolfileBase(mol);
}

/**
 * Render molecule as SVG
 */
export function renderSVGUnified(
  molecule: MoleculeOrPacked,
  options?: SVGRendererOptions,
): SVGRenderResult {
  const mol = getMolecule(molecule);
  return renderSVGBase(mol, options);
}

/**
 * Generate InChI string
 */
export async function generateInChIUnified(
  molecule: MoleculeOrPacked,
): Promise<string> {
  const mol = getMolecule(molecule);
  return generateInChIBase(mol);
}

/**
 * Generate InChIKey
 */
export async function generateInChIKeyUnified(inchi: string): Promise<string> {
  return generateInChIKeyBase(inchi);
}
