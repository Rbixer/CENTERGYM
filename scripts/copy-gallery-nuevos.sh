#!/usr/bin/env bash
# Copia GIF a public/images/routines/gallery/ como routine-gallery-28.gif … 34
# (hasta 7, orden alfabético A–Z por nombre de archivo). No pisa 01–27.
#
# Origen por defecto: <raíz del repo>/gym/nuevos
# Alternativa:  ./scripts/copy-gallery-nuevos.sh "/otra/ruta"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/images/routines/gallery"
SRC="${1:-$ROOT/gym/nuevos}"

mkdir -p "$OUT"

if [ ! -d "$SRC" ]; then
  echo "No existe: $SRC" >&2
  echo "Crea la carpeta gym/nuevos en la raíz del repo y coloca ahí los .gif, o pasa otra ruta:" >&2
  echo "  $0 $ROOT/gym/nuevos" >&2
  exit 1
fi

shopt -s nullglob
mapfile -t gifs < <(find "$SRC" -maxdepth 1 -type f -iname "*.gif" | LC_ALL=C sort -f)
shopt -u nullglob

if [ ${#gifs[@]} -eq 0 ]; then
  echo "No hay .gif en: $SRC" >&2
  exit 1
fi

i=28
for f in "${gifs[@]}"; do
  if [ "$i" -gt 34 ]; then
    break
  fi
  cp -f "$f" "$OUT/routine-gallery-$i.gif"
  echo "OK  routine-gallery-$i.gif  ←  $(basename "$f")"
  i=$((i + 1))
done

if [ ${#gifs[@]} -gt 7 ]; then
  echo "Aviso: se usaron solo 7 (orden A–Z); había ${#gifs[@]} archivos en la carpeta." >&2
fi

echo "Destino: $OUT"
