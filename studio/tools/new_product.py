#!/usr/bin/env python3
"""Crée l'arborescence d'un produit : python3 new_product.py <slug>"""
import sys, pathlib
slug = sys.argv[1]
base = pathlib.Path(__file__).resolve().parents[1] / "produits" / slug
for d in ["photos_reference","scenes","voix","musique","sous_titres","montage","miniature","publication"]:
    (base/d).mkdir(parents=True, exist_ok=True)
for p in ["tiktok","instagram_reels","pinterest","youtube_shorts"]:
    (base/"export"/p).mkdir(parents=True, exist_ok=True)
for f in ["script.md","storyboard.md","prompts_scenes.md"]:
    (base/f).touch()
print("OK", base)
