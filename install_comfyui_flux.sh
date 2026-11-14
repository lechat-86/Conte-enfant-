#!/usr/bin/env bash
# Installe ComfyUI + Flux.1 schnell (Apache 2.0, sans compte Hugging Face).
# Usage : ./install_comfyui_flux.sh [dossier]   (défaut : ./ComfyUI)
set -euo pipefail

DIR="${1:-ComfyUI}"
HF="https://huggingface.co"

[ -d "$DIR/.git" ] || git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git "$DIR"
cd "$DIR"
pip install -r requirements.txt

dl() { # url destination
  mkdir -p "$(dirname "$2")"
  [ -s "$2" ] || curl -L --fail --retry 4 -C - -o "$2" "$1"
}

dl "$HF/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell-fp8.safetensors" \
   models/checkpoints/flux1-schnell-fp8.safetensors   # tout-en-un : modèle + VAE + encodeurs (~17 Go)
echo "OK. Lancez : cd $DIR && python main.py"
