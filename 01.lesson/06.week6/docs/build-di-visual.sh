#!/usr/bin/env bash
# di-visual.html を再生成する。
#   テンプレート(di-visual.tpl.html) + images/*.png → 画像を WebP 化して base64 で埋め込み、
#   外部リソース 0 の自己完結 HTML を出力する。
#
#   使い方:  bash docs/build-di-visual.sh
#   依存:    npx (sharp-cli を自動取得), python3
set -euo pipefail

DOCS="$(cd "$(dirname "$0")" && pwd)"
IMG="$DOCS/images"
TPL="$DOCS/di-visual.tpl.html"
OUT="$DOCS/di-visual.html"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1) PNG → WebP（表示サイズに合わせて縮小）
shrink() { # <入力png> <幅> <品質> <出力名>
  npx --yes sharp-cli -i "$IMG/$1" -o "$TMP" -f webp -q "$3" resize "$2" >/dev/null 2>&1
  [ "${1%.png}.webp" = "$4" ] || mv "$TMP/${1%.png}.webp" "$TMP/$4"
}
shrink hero.png    560 80 hero.webp
shrink before.png  520 78 before.webp
shrink after.png   520 78 after.webp
shrink order.png   420 78 order.webp
shrink summary.png 430 80 summary.webp

# 吹き出し用の顔アイコン（summary.png の顔まわりを切り抜いて縮小）
mkdir -p "$TMP/f1" "$TMP/f2"
npx --yes sharp-cli -i "$IMG/summary.png" -o "$TMP/f1" -f webp -q 82 extract 130 320 640 640 >/dev/null 2>&1
npx --yes sharp-cli -i "$TMP/f1/summary.webp" -o "$TMP/f2" -f webp -q 82 resize 150 >/dev/null 2>&1
mv "$TMP/f2/summary.webp" "$TMP/face.webp"

# 2) プレースホルダを data URI に置換
python3 - "$TMP" "$TPL" "$OUT" <<'PY'
import base64, pathlib, sys
tmp, tpl, out = (pathlib.Path(a) for a in sys.argv[1:4])
mapping = {"{{HERO}}":"hero.webp", "{{FACE}}":"face.webp", "{{BEFORE}}":"before.webp",
           "{{AFTER}}":"after.webp", "{{ORDER}}":"order.webp", "{{SUMMARY}}":"summary.webp"}
html = tpl.read_text(encoding="utf-8")
for token, name in mapping.items():
    if token not in html:
        sys.exit(f"ERROR: プレースホルダ {token} がテンプレートにありません")
    data = (tmp / name).read_bytes()
    html = html.replace(token, "data:image/webp;base64," + base64.b64encode(data).decode("ascii"))
out.write_text(html, encoding="utf-8")
print(f"生成: {out}  ({out.stat().st_size/1024:.0f} KB)")
PY
