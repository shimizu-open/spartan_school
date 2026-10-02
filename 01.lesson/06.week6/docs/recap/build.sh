#!/usr/bin/env bash
# ビジュアルアブストラクト3枚を生成する。
#   p*.tpl.html + poster.css + images/*.png → 自己完結HTML（out/*.html）→ ヘッドレスChromeでPNG化
#   使い方: bash build.sh [p1-trust p2-query p3-undo]
#   出力:   out/<name>.html, out/<name>.png (2480x3508), out/<name>-1x.png (1240x1754)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/out"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium)"
W=1240; H=1754; SCALE=2
# ヘッドレス Chrome はウィンドウ枠ぶん小さいビューポートになるため、余分に取ってから切り出す
WIN_W=$((W + 15)); WIN_H=$((H + 87))

names=("$@"); [ ${#names[@]} -eq 0 ] && names=(p1-trust p2-query p3-undo)

# 1) 挿絵を WebP 化（存在するものだけ）
mkdir -p "$TMP/webp"
for f in "$DIR"/images/s*.png; do
  [ -e "$f" ] || continue
  npx --yes sharp-cli -i "$f" -o "$TMP/webp" -f webp -q 84 resize 720 >/dev/null 2>&1
done

for n in "${names[@]}"; do
  # 2) CSS と画像を埋め込む
  python3 - "$DIR" "$TMP/webp" "$n" "$OUT/$n.html" <<'PY'
import base64, pathlib, re, sys
d, webp, name, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3], pathlib.Path(sys.argv[4])
html = (d / f"{name}.tpl.html").read_text(encoding="utf-8")
html = html.replace("{{CSS}}", (d / "poster.css").read_text(encoding="utf-8"))
missing = []
def img(m):
    p = webp / f"{m.group(1)}.webp"
    if not p.exists():
        missing.append(m.group(1))
        return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>"
    return "data:image/webp;base64," + base64.b64encode(p.read_bytes()).decode("ascii")
html = re.sub(r"\{\{IMG:([\w-]+)\}\}", img, html)
if "{{" in html:
    sys.exit(f"ERROR: 未置換のプレースホルダ in {name}")
out.write_text(html, encoding="utf-8")
if missing:
    print(f"  (未生成の挿絵: {', '.join(sorted(set(missing)))})")
PY
  # 3) PNG 化して正確なサイズに切り出す
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=$SCALE --window-size=$WIN_W,$WIN_H \
    --screenshot="$TMP/raw.png" "file://$OUT/$n.html" 2>/dev/null
  rm -rf "$TMP/cut" "$TMP/s1"; mkdir -p "$TMP/cut" "$TMP/s1"
  npx --yes sharp-cli -i "$TMP/raw.png" -o "$TMP/cut" -f png extract 0 0 $((W*SCALE)) $((H*SCALE)) >/dev/null 2>&1
  mv "$TMP/cut/raw.png" "$OUT/$n.png"
  npx --yes sharp-cli -i "$OUT/$n.png" -o "$TMP/s1" -f png resize $W >/dev/null 2>&1
  mv "$TMP/s1/$n.png" "$OUT/$n-1x.png"
  echo "生成: out/$n.png / out/$n-1x.png / out/$n.html"
done
