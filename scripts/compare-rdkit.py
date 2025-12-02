#!/usr/bin/env python3
"""Compare coordinate generation with RDKit"""

from rdkit import Chem
from rdkit.Chem import AllChem, Draw
import sys
import os

molecules = [
    ("Adamantane", "C1C2CC3CC1CC(C2)C3"),
    ("Atorvastatin", "CC(C)c1c(C(=O)Nc2ccccc2)c(c2ccc(F)cc2)n(c1C)c1ccccc1"),
    ("Coronene", "c1cc2ccc3ccc4ccc5ccc6ccc1c7c2c3c4c5c67"),
]

out_dir = "output/svg/rdkit"
os.makedirs(out_dir, exist_ok=True)

for name, smiles in molecules:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        print(f"Failed to parse {name}")
        continue
    
    # Generate 2D coordinates
    AllChem.Compute2DCoords(mol)
    
    # Save as SVG
    drawer = Draw.MolDraw2DSVG(400, 300)
    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()
    svg = drawer.GetDrawingText()
    
    fname = os.path.join(out_dir, f"{name}.svg")
    with open(fname, "w") as f:
        f.write(svg)
    print(f"Wrote {fname}")
    
    # Print bond lengths for comparison
    conf = mol.GetConformer()
    print(f"\n{name} RDKit bond lengths:")
    for bond in mol.GetBonds():
        i, j = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        p1 = conf.GetAtomPosition(i)
        p2 = conf.GetAtomPosition(j)
        dist = ((p1.x - p2.x)**2 + (p1.y - p2.y)**2)**0.5
        print(f"  {i}-{j}: {dist:.2f}")

print("\nDone!")
