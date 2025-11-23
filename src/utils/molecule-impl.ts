/**
 * MoleculeImpl: Molecule backed by PackedMol
 *
 * This is the concrete implementation of the Molecule interface, backed by
 * a compact binary PackedMol representation. All atom/bond data is lazily
 * decoded from PackedMol on first access, then cached.
 *
 * Key benefits:
 * - 50-90% smaller memory footprint per molecule
 * - Automatic caching after first decode
 * - Transparent to existing code (implements Molecule interface)
 * - Zero-copy transfer between threads possible
 */

import type { Atom, Bond, Molecule, RingInfo } from "types";
import type { PackedMol } from "src/types/packedmol-types";
import { decodePackedMol } from "src/parsers/packedmol-decoder";

/**
 * Concrete Molecule implementation backed by PackedMol
 *
 * Implements the Molecule interface while lazily decoding from binary.
 * All getters are cached after first access for O(1) performance.
 */
export class MoleculeImpl implements Molecule {
  private packedData: PackedMol;
  private enrichedData: Molecule | null;
  private atomsCache: readonly Atom[] | null = null;
  private bondsCache: readonly Bond[] | null = null;
  private ringsCache: readonly (readonly number[])[] | null = null;
  private ringInfoCache: Readonly<RingInfo> | null | undefined = undefined;
  private decodedMolecule: Molecule | null = null;

  constructor(packed: PackedMol, enriched?: Molecule | null) {
    this.packedData = packed;
    this.enrichedData = enriched ?? null;
  }

  /**
   * Get atoms from PackedMol (lazy decoded and cached)
   */
  get atoms(): readonly Atom[] {
    if (!this.atomsCache) {
      if (this.enrichedData) {
        this.atomsCache = this.enrichedData.atoms;
      } else {
        if (!this.decodedMolecule) {
          this.decodedMolecule = decodePackedMol(this.packedData);
        }
        this.atomsCache = this.decodedMolecule.atoms;
      }
    }
    return this.atomsCache;
  }

  /**
   * Get bonds from PackedMol (lazy decoded and cached)
   */
  get bonds(): readonly Bond[] {
    if (!this.bondsCache) {
      if (this.enrichedData) {
        this.bondsCache = this.enrichedData.bonds;
      } else {
        if (!this.decodedMolecule) {
          this.decodedMolecule = decodePackedMol(this.packedData);
        }
        this.bondsCache = this.decodedMolecule.bonds;
      }
    }
    return this.bondsCache;
  }

  /**
   * Get rings from PackedMol (lazy decoded and cached)
   */
  get rings(): readonly (readonly number[])[] | undefined {
    // If enriched data is available, return it directly
    if (this.enrichedData) {
      return this.enrichedData.rings;
    }
    // Otherwise decode from PackedMol
    if (this.ringsCache === null) {
      if (!this.decodedMolecule) {
        this.decodedMolecule = decodePackedMol(this.packedData);
      }
      this.ringsCache = this.decodedMolecule.rings ?? [];
    }
    return this.ringsCache.length > 0 ? this.ringsCache : undefined;
  }

  /**
   * Get ring info from PackedMol (lazy decoded and cached)
   */
  get ringInfo(): Readonly<RingInfo> | undefined {
    // If enriched data is available, return it directly
    if (this.enrichedData) {
      return this.enrichedData.ringInfo;
    }
    // Otherwise decode from PackedMol
    if (this.ringInfoCache === undefined) {
      if (!this.decodedMolecule) {
        this.decodedMolecule = decodePackedMol(this.packedData);
      }
      this.ringInfoCache = this.decodedMolecule.ringInfo || null;
    }
    return this.ringInfoCache === null ? undefined : this.ringInfoCache;
  }

  /**
   * Get the underlying PackedMol (for advanced usage)
   *
   * @internal
   */
  get _packedMol(): PackedMol {
    return this.packedData;
  }

  /**
   * Get metadata without full deserialization
   */
  getMetadata(): { atomCount: number; bondCount: number } {
    return {
      atomCount: this.packedData.header[1] as number,
      bondCount: this.packedData.header[2] as number,
    };
  }

  /**
   * Get enriched data if available (internal use only)
   * @internal
   */
  getEnrichedData(): Molecule | null {
    return this.enrichedData;
  }

  /**
   * Force full deserialization and caching (rarely needed)
   */
  ensureDecoded(): void {
    if (!this.decodedMolecule) {
      this.decodedMolecule = decodePackedMol(this.packedData);
      this.atomsCache = this.decodedMolecule.atoms;
      this.bondsCache = this.decodedMolecule.bonds;
      this.ringsCache = this.decodedMolecule.rings ?? [];
      this.ringInfoCache = this.decodedMolecule.ringInfo;
    }
  }

  /**
   * Clear decoded cache to free memory (rarely needed)
   */
  clearCache(): void {
    this.decodedMolecule = null;
    this.atomsCache = null;
    this.bondsCache = null;
    this.ringsCache = null;
    this.ringInfoCache = null;
  }

  /**
   * Create a MoleculeImpl from PackedMol
   */
  static from(packed: PackedMol): MoleculeImpl {
    return new MoleculeImpl(packed);
  }
}
