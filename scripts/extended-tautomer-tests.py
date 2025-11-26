#!/usr/bin/env python3
"""
Extended tautomer test cases - generate RDKit expectations for more molecules.
Covers edge cases, rare tautomerism, and complex systems.
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

# Extended test cases covering more chemistry
test_cases = [
    # ===== Keto-Enol Tautomerism =====
    ("CC(=O)CC", "2-butanone"),
    ("CCC(=O)C", "2-butanone (isomer)"),
    ("O=C1CCCC1", "cyclopentanone"),
    ("O=C1CCCCC1", "cyclohexanone"),
    ("CC(=O)C(C)=O", "diacetyl (2,3-butanedione)"),
    
    # ===== 1,5-Keto-Enol (Conjugated) =====
    ("CC(=O)C=CC(=O)C", "1,5-hexanedione"),
    ("O=C1C=CC(=O)CC1", "cyclohex-2-en-1,4-dione"),
    
    # ===== Imine-Enamine =====
    ("CC(=N)CC", "butan-2-imine"),
    ("C=NCC", "propimine"),
    ("Nc1ccccc1", "aniline"),
    ("c1ccc(N)cc1", "aniline (alt)"),
    
    # ===== Amide Tautomerism =====
    ("NC(=O)C", "acetamide"),
    ("CC(=O)NC", "N-methylacetamide"),
    ("O=C1CCCCN1", "caprolactam"),
    ("O=C1CNC1", "beta-lactam (2-azetidinone)"),
    
    # ===== Aromatic Heterocycles =====
    ("c1ccc2[nH]ccc2c1", "indole"),
    ("c1ccc2nc[nH]c2c1", "benzimidazole"),
    ("c1c[nH]cn1", "imidazole"),
    ("c1cnc[nH]1", "imidazole (alt)"),
    ("c1cc[nH]n1", "pyrazole"),
    ("c1cn[nH]c1", "pyrazole (alt)"),
    
    # ===== Tetrazole and Triazole =====
    ("c1[nH]nnn1", "1H-tetrazole"),
    ("c1n[nH]nn1", "2H-tetrazole"),
    ("c1[nH]nnc1", "1H-1,2,3-triazole"),
    ("c1n[nH]nc1", "2H-1,2,3-triazole"),
    
    # ===== Pyridone/Hydroxypyridine =====
    ("O=C1C=CC=CN1", "2-pyridone"),
    ("O=C1NC=CC=C1", "2-pyridone (alt)"),
    ("O=c1ccccn1", "2-pyridone (aromatic)"),
    ("c1ccc(O)nc1", "2-hydroxypyridine"),
    
    # ===== Oximes and Nitroso =====
    ("CC(=O)NO", "acetone oxime"),
    ("CC(C)=NO", "propanone oxime"),
    ("C=NO", "formaldoxime"),
    
    # ===== Guanidine and Amidine =====
    ("NC(N)=N", "guanidine"),
    ("NC(=N)N", "guanidine (alt)"),
    ("CC(N)=N", "acetamidine"),
    ("CC(=N)N", "acetamidine (alt)"),
    
    # ===== Thione-Thiol =====
    ("CC(=S)C", "thioacetone"),
    ("CSC", "dimethyl sulfide (control - no tautomerism)"),
    ("NC(=S)N", "thiourea"),
    
    # ===== Nitro and Aci-Nitro =====
    ("CC(=O)C[N+](=O)[O-]", "nitroacetone"),
    ("[N+](=O)([O-])C", "nitromethane"),
    
    # ===== Phenolic Systems =====
    ("Oc1ccccc1", "phenol"),
    ("Oc1ccc(O)cc1", "hydroquinone (1,4)"),
    ("Oc1cccc(O)c1", "resorcinol (1,3)"),
    ("Oc1ccccc1O", "catechol (1,2)"),
    ("Oc1ccc(C=O)cc1", "4-hydroxybenzaldehyde"),
    
    # ===== Complex Natural Product Substructures =====
    ("O=C1CC(=O)c2ccccc2C1", "1,3-indandione"),
    ("CC(=O)c1ccc(O)cc1", "4-hydroxyacetophenone"),
    ("Nc1ncnc2[nH]cnc12", "adenine"),
    ("O=c1[nH]cnc2[nH]cnc12", "hypoxanthine"),
    
    # ===== Conjugated Systems =====
    ("C=CC=O", "acrolein"),
    ("CC(=O)C=O", "methylglyoxal"),
    ("O=CC=CC=O", "fumaraldehyde"),
    
    # ===== Hydroxamic Acids =====
    ("CC(=O)NO", "acetohydroxamic acid"),
    ("NC(=O)NO", "carbamhydroxamic acid"),
    
    # ===== Phosphonic and Sulfinic Acids =====
    ("CP(=O)(O)O", "methylphosphonic acid"),
    ("CS(=O)C", "dimethyl sulfoxide"),
    
    # ===== Rare Edge Cases =====
    ("C=C=O", "ketene"),
    ("OC#N", "cyanic acid"),
    ("C#N", "hydrogen cyanide"),
    
    # ===== Drug-like Molecules =====
    ("CC(=O)Oc1ccccc1C(=O)O", "aspirin"),
    ("CC(C)Cc1ccc(C(C)C(=O)O)cc1", "ibuprofen"),
    ("CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "caffeine"),
    ("NC(=O)c1cccnc1", "nicotinamide"),
]

if __name__ == "__main__":
    results = []
    
    print(f"Processing {len(test_cases)} test cases...", file=sys.stderr)
    
    for smiles, name in test_cases:
        print(f"Processing: {name} ({smiles})...", file=sys.stderr)
        result = enumerate_tautomers_rdkit(smiles)
        result["name"] = name
        results.append(result)
    
    print(f"Completed {len(results)} molecules", file=sys.stderr)
    
    # Output as JSON
    print(json.dumps(results, indent=2))
