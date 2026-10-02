#!/usr/bin/env bash
# ビジュアルアブストラクト（1枚絵）を生成する。
#   di-poster.tpl.html + images/*.png → 自己完結HTML → ヘッドレスChromeでPNG化
#
#   使い方: bash docs/build-di-poster.sh
#   依存:   npx (sharp-cli を自動取得), python3, google-chrome
#   出力:   images/di-visual-abstract.png     2480x3508 (A4比・2倍解像度)
#           images/di-visual-abstract-1x.png  1240x1754 (共有用)
set -euo pipefail

DOCS="$(cd "$(dirname "$0")" && pwd)"
IMG="$DOCS/images"
TPL="$DOCS/di-poster.tpl.html"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium)"

# ポスターの CSS 上のサイズ（A4 縦 @150dpi 相当）
W=1240; H=1754; SCALE=2
# ヘッドレス Chrome は --window-size からウィンドウ枠ぶんを引いた値をビューポートにする。
# 実測で 幅 -15px / 高さ -87px だったため、その分を足してから正確に切り出す。
WIN_W=$((W + 15)); WIN_H=$((H + 87))

# 1) 画像を WebP 化（表示サイズの約2倍の解像度で用意）
shrink() {
  npx --yes sharp-cli -i "$IMG/$1" -o "$TMP" -f webp -q "$3" resize "$2" >/dev/null 2>&1
  [ "${1%.png}.webp" = "$4" ] || mv "$TMP/${1%.png}.webp" "$TMP/$4"
}
shrink hero.png    460 84 hero.webp
shrink before.png  900 82 before.webp
shrink after.png   900 82 after.webp
shrink summary.png 420 84 summary.webp
mkdir -p "$TMP/f1" "$TMP/f2"
npx --yes sharp-cli -i "$IMG/summary.png" -o "$TMP/f1" -f webp -q 86 extract 130 320 640 640 >/dev/null 2>&1
npx --yes sharp-cli -i "$TMP/f1/summary.webp" -o "$TMP/f2" -f webp -q 86 resize 220 >/dev/null 2>&1
mv "$TMP/f2/summary.webp" "$TMP/face.webp"

# 2) base64 埋め込みで自己完結 HTML を作る
python3 - "$TMP" "$TPL" "$TMP/poster.html" <<'PY'
import base64, pathlib, sys
tmp, tpl, out = (pathlib.Path(a) for a in sys.argv[1:4])
mapping = {"{{HERO}}":"hero.webp", "{{FACE}}":"face.webp",
           "{{BEFORE}}":"before.webp", "{{AFTER}}":"after.webp", "{{SUMMARY}}":"summary.webp"}
html = tpl.read_text(encoding="utf-8")
for token, name in mapping.items():
    if token not in html:
        continue
    data = (tmp / name).read_bytes()
    html = html.replace(token, "data:image/webp;base64," + base64.b64encode(data).decode("ascii"))
leftover = [t for t in mapping if t in html]
if leftover:
    sys.exit(f"ERROR: 未置換のプレースホルダ {leftover}")
out.write_text(html, encoding="utf-8")
PY
cp "$TMP/poster.html" "$DOCS/di-poster.html"

# 3) PNG 化してから正確なサイズへ切り出し
"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=$SCALE --window-size=$WIN_W,$WIN_H \
  --screenshot="$TMP/raw.png" "file://$TMP/poster.html" 2>/dev/null
mkdir -p "$TMP/cut" "$TMP/s1"
npx --yes sharp-cli -i "$TMP/raw.png" -o "$TMP/cut" -f png \
  extract 0 0 $((W*SCALE)) $((H*SCALE)) >/dev/null 2>&1
mv "$TMP/cut/raw.png" "$IMG/di-visual-abstract.png"

# 4) 共有用の等倍版
npx --yes sharp-cli -i "$IMG/di-visual-abstract.png" -o "$TMP/s1" -f png resize $W >/dev/null 2>&1
mv "$TMP/s1/di-visual-abstract.png" "$IMG/di-visual-abstract-1x.png"

python3 - "$IMG" <<'PY'
import struct, pathlib, sys
for n in ("di-visual-abstract.png", "di-visual-abstract-1x.png"):
    p = pathlib.Path(sys.argv[1]) / n
    w, h = struct.unpack(">II", p.read_bytes()[16:24])
    print(f"生成: {p}  {w} x {h}  ({p.stat().st_size/1024/1024:.1f} MB)")
PY
