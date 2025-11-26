#!/usr/bin/env python3
"""
Test RDKit tautomer enumeration for molecules with many tautomers.
"""

from rdkit import Chem
from rdkit.Chem.MolStandardize import rdMolStandardize
import json
import sys

def enumerate_tautomers_rdkit(smiles, max_tautomers=100):
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
        "tautomers": results[:20],  # Only show first 20
        "canonical": canonical_smiles,
        "truncated": len(results) > 20
    }

# Molecules that should generate many tautomers
test_cases = [
    # Multiple keto-enol sites
    ("O=C(C)C(=O)C(=O)C(=O)C", "tetraketone - 4 keto sites"),
    ("CC(=O)CC(=O)CC(=O)CC(=O)C", "pentanedione chain - 4 keto sites"),
    
    # Long conjugated polyketones
    ("O=C1CC(=O)CC(=O)CC(=O)C1", "cyclic polyketone"),
    
    # Multiple amide sites
    ("NC(=O)C(=O)C(=O)C(=O)N", "polyamide"),
    ("NC(=O)CC(=O)CC(=O)N", "triamide"),
    
    # Mixed keto-amide systems
    ("CC(=O)CC(=O)CC(=O)NC(=O)C", "keto-amide hybrid"),
    ("NC(=O)CC(=O)CC(=O)CC(=O)N", "long keto-amide"),
    
    # Polyhydroxy aromatic systems
    ("Oc1cc(O)cc(O)c1", "trihydroxybenzene"),
    ("Oc1c(O)c(O)c(O)c(O)c1O", "hexahydroxybenzene"),
    
    # Quinones with multiple sites
    ("O=C1C(=O)C(=O)C(=O)C(=O)C1=O", "hexaketocyclohexane"),
    
    # Natural product-like with many sites
    ("CC(=O)c1cc(O)c(O)c(O)c1C(=O)C", "polyhydroxy diketone aromatic"),
    
    # Porphyrin-like with multiple NH
    ("c1cc2[nH]c(cc3[nH]c(cc4[nH]c(c1)cc4)cc3)cc2", "porphyrin core"),
    
    # Multiple heterocyclic sites
    ("c1c[nH]c(c2c[nH]cn2)n1", "bis-imidazole"),
    
    # Long conjugated enol chain
    ("C=C(O)C=C(O)C=C(O)C=C(O)C", "tetraenol"),
    
    # Flavonoid-like (real natural product)
    ("O=c1cc(O)c2c(O)cc(O)cc2o1", "flavone scaffold"),
    
    # Curcumin-like (diketo with enol)
    ("Oc1ccc(C=CC(=O)CC(=O)C=Cc2ccc(O)cc2)cc1", "curcumin"),
    
    # Barbituric acid derivatives
    ("O=C1NC(=O)NC(=O)N1", "barbituric acid"),
    ("O=C1NC(=O)NC(=O)C(=O)N1", "alloxan"),
    
    # Quinone-diamine systems
    ("NC1=C(N)C(=O)C(=O)C(N)=C1N", "tetraaminoquinone"),
    
    # Uric acid and analogs
    ("O=C1NC(=O)C2=C(N1)NC(=O)N2", "uric acid"),
    
    # Multiple guanidine-like groups
    ("NC(=N)NC(=N)NC(=N)N", "tri-guanidine"),
]

if __name__ == "__main__":
    results = []
    
    print(f"Processing {len(test_cases)} high-complexity molecules...", file=sys.stderr)
    
    for smiles, name in test_cases:
        print(f"Processing: {name} ({smiles})...", file=sys.stderr)
        result = enumerate_tautomers_rdkit(smiles, max_tautomers=100)
        result["name"] = name
        
        if "count" in result:
            print(f"  → Found {result['count']} tautomers", file=sys.stderr)
        
        results.append(result)
    
    print(f"\nCompleted {len(results)} molecules", file=sys.stderr)
    
    # Sort by tautomer count
    results.sort(key=lambda x: x.get("count", 0), reverse=True)
    
    print("\n=== TOP MOLECULES BY TAUTOMER COUNT ===", file=sys.stderr)
    for r in results[:10]:
        if "count" in r:
            print(f"{r['count']:3d} tautomers: {r['name']}", file=sys.stderr)
    
    # Output as JSON
    print(json.dumps(results, indent=2))
