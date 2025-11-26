#!/usr/bin/env python3
"""
Compare openchem tautomer enumeration with RDKit.
Generates tautomers using RDKit and outputs them for comparison.
"""

from rdkit import Chem
from rdkit.Chem.MolStandardize import rdMolStandardize
import json
import sys

def enumerate_tautomers_rdkit(smiles, max_tautomers=32):
    """Enumerate tautomers using RDKit."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {"error": f"Failed to parse SMILES: {smiles}"}
    
    enumerator = rdMolStandardize.TautomerEnumerator()
    enumerator.SetMaxTautomers(max_tautomers)
    
    # Get all tautomers
    tautomers = enumerator.Enumerate(mol)
    
    results = []
    for taut in tautomers:
        taut_smiles = Chem.MolToSmiles(taut)
        results.append(taut_smiles)
    
    # Get canonical tautomer
    canonical = enumerator.Canonicalize(mol)
    canonical_smiles = Chem.MolToSmiles(canonical)
    
    return {
        "input": smiles,
        "count": len(results),
        "tautomers": results,
        "canonical": canonical_smiles
    }

# Test molecules
test_cases = [
    # Simple keto-enol
    ("CC(=O)C", "acetone"),
    ("CC(=O)CC(=O)C", "acetylacetone (pentane-2,4-dione)"),
    
    # Phenol
    ("Oc1ccccc1", "phenol"),
    
    # Imine-enamine
    ("C=NC", "simple imine"),
    ("CC(=N)C", "ketoimine"),
    
    # Amide
    ("CC(=O)N", "acetamide"),
    
    # Heterocycles
    ("c1c[nH]cn1", "imidazole"),
    ("c1[nH]nnn1", "tetrazole"),
    ("O=C1C=CC=CN1", "2-pyridone"),
    
    # Guanidine
    ("NC(N)=N", "guanidine"),
    
    # Aromatic heterocycles
    ("c1ccc2[nH]ccc2c1", "indole"),
    
    # Lactam
    ("O=C1NCCCC1", "caprolactam"),
    
    # Thione-thiol
    ("CC(=S)C", "thioacetone"),
    
    # Complex molecules
    ("CC(=O)CC(=O)NC", "keto-amide"),
    ("Oc1ccc(O)cc1", "hydroquinone"),
]

if __name__ == "__main__":
    results = []
    
    for smiles, name in test_cases:
        print(f"Processing: {name} ({smiles})...", file=sys.stderr)
        result = enumerate_tautomers_rdkit(smiles)
        result["name"] = name
        results.append(result)
    
    # Output as JSON
    print(json.dumps(results, indent=2))
