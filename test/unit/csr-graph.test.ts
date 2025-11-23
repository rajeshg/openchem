import { describe, it, expect } from "bun:test";
import { parseSMILES } from "index";
import { BondType } from "types";
import { CSRGraph, getCSRGraph } from "src/utils/csr-graph";

describe("CSR Graph Representation", () => {
  it("should create CSR graph from molecule", () => {
    const mol = parseSMILES("CC(=O)O").molecules[0]!; // acetic acid
    const graph = new CSRGraph(mol);

    expect(graph.numAtoms).toBe(mol.atoms.length);
    expect(graph.numBonds).toBe(mol.bonds.length);
  });

  it("should get neighbors correctly", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0]!; // benzene
    const graph = new CSRGraph(mol);

    // In benzene, each carbon should have 2 neighbors (in ring)
    for (let i = 0; i < 6; i++) {
      const neighbors = graph.getNeighbors(i);
      expect(neighbors.length).toBe(2);
    }
  });

  it("should identify connected atoms", () => {
    const mol = parseSMILES("CCO").molecules[0]!; // ethanol
    const graph = new CSRGraph(mol);

    // C-C bond
    expect(graph.isConnected(0, 1)).toBe(true);
    expect(graph.isConnected(1, 0)).toBe(true);

    // C-O bond
    expect(graph.isConnected(1, 2)).toBe(true);
    expect(graph.isConnected(2, 1)).toBe(true);

    // C-O (different C) should not be connected
    const c_o_direct = graph.isConnected(0, 2);
    expect(c_o_direct).toBe(false);
  });

  it("should get correct degree", () => {
    const mol = parseSMILES("c1ccccc1").molecules[0]!; // benzene
    const graph = new CSRGraph(mol);

    // Each carbon in benzene ring has degree 2
    for (let i = 0; i < 6; i++) {
      expect(graph.getDegree(i)).toBe(2);
    }
  });

  it("should retrieve bond information", () => {
    const mol = parseSMILES("C=C").molecules[0]!; // ethene
    const graph = new CSRGraph(mol);

    const bond = graph.getBond(0, 1);
    expect(bond).toBeDefined();
    expect(bond?.type).toBe(BondType.DOUBLE);
  });

  it("should handle iterator interface efficiently", () => {
    const mol = parseSMILES("CC(C)C").molecules[0]!; // isobutane
    const graph = new CSRGraph(mol);

    // Central carbon (atom 1) should have 3 neighbors
    const neighbors: number[] = [];
    for (const neighbor of graph.getNeighborsIterator(1)) {
      neighbors.push(neighbor);
    }
    expect(neighbors.length).toBe(3);
  });

  it("should export CSR data", () => {
    const mol = parseSMILES("CCO").molecules[0]!;
    const graph = new CSRGraph(mol);

    const exported = graph.export();
    expect(exported.numAtoms).toBe(mol.atoms.length);
    expect(exported.numBonds).toBe(mol.bonds.length);
    expect(exported.rowPtr instanceof Uint32Array).toBe(true);
    expect(exported.colIdx instanceof Uint32Array).toBe(true);
    expect(exported.edgeData instanceof Uint32Array).toBe(true);
  });

  it("should have reasonable memory usage", () => {
    const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!; // aspirin
    const graph = new CSRGraph(mol);

    const memUsage = graph.getMemoryUsage();
    expect(memUsage).toBeGreaterThan(0);
    expect(memUsage).toBeLessThan(10000); // Should be compact
  });

  it("should handle cached access", () => {
    const mol = parseSMILES("CCO").molecules[0]!;

    const graph1 = getCSRGraph(mol);
    const graph2 = getCSRGraph(mol);

    // Should return same object (cached)
    expect(graph1).toBe(graph2);
  });

  it("should handle linear molecule (chain)", () => {
    const mol = parseSMILES("CCCCCC").molecules[0]!; // hexane
    const graph = new CSRGraph(mol);

    // Terminal atoms should have degree 1
    expect(graph.getDegree(0)).toBe(1);
    expect(graph.getDegree(5)).toBe(1);

    // Middle atoms should have degree 2
    expect(graph.getDegree(1)).toBe(2);
    expect(graph.getDegree(2)).toBe(2);
  });

  it("should handle branched molecules", () => {
    const mol = parseSMILES("CC(C)C").molecules[0]!; // isobutane
    const graph = new CSRGraph(mol);

    // Central carbon has 3 neighbors
    expect(graph.getDegree(1)).toBe(3);

    // Terminal carbons have 1 neighbor
    expect(graph.getDegree(0)).toBe(1);
    expect(graph.getDegree(2)).toBe(1);
    expect(graph.getDegree(3)).toBe(1);
  });

  it("should correctly represent aromatic rings", () => {
    const mol = parseSMILES("c1ccc2c(c1)cccc2").molecules[0]!; // naphthalene
    const graph = new CSRGraph(mol);

    // Should have 10 atoms (2 benzene rings fused)
    expect(graph.numAtoms).toBe(10);

    // Should have 11 bonds (2x6 from benzene, minus 1 for fusion)
    expect(graph.numBonds).toBe(11);

    // Each atom should have exactly 2 or 3 neighbors
    for (let i = 0; i < 10; i++) {
      const degree = graph.getDegree(i);
      expect(degree === 2 || degree === 3).toBe(true);
    }
  });

  it("should handle molecules with heteroatoms", () => {
    const mol = parseSMILES("c1ccc(cc1)O").molecules[0]!; // phenol
    const graph = new CSRGraph(mol);

    // Should correctly identify connections to oxygen
    const oxygenNeighbors = graph.getNeighbors(6); // oxygen is typically last
    expect(oxygenNeighbors.length).toBeGreaterThan(0);
  });

  it("should provide atom access", () => {
    const mol = parseSMILES("CCO").molecules[0]!;
    const graph = new CSRGraph(mol);

    const atom = graph.getAtom(0);
    expect(atom).toBeDefined();
    expect(atom?.symbol).toBe("C");

    const atoms = graph.getAtoms();
    expect(atoms.length).toBe(mol.atoms.length);
  });

  it("should provide bond access", () => {
    const mol = parseSMILES("C=C").molecules[0]!;
    const graph = new CSRGraph(mol);

    const bonds = graph.getBonds();
    expect(bonds.length).toBe(mol.bonds.length);
  });

  it("should handle performance on complex molecule", () => {
    const mol = parseSMILES("CC(=O)Oc1ccccc1C(=O)O").molecules[0]!; // aspirin
    const graph = new CSRGraph(mol);

    // Should efficiently access neighbors
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      for (let a = 0; a < graph.numAtoms; a++) {
        graph.getNeighbors(a);
      }
    }
    const end = performance.now();

    const avgMs = (end - start) / 1000;
    expect(avgMs).toBeLessThan(10); // Should be very fast
  });
});
