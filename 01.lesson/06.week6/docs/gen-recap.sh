#!/usr/bin/env bash
# 学習まとめのインフォグラフィックを Codex CLI で生成する。
#   使い方: bash docs/gen-recap.sh recap-1-trust [recap-2-query ...]
#   EXTRA_REF=<画像> を付けると4枚目の参照として添付する（猫先生の水彩での見本など）
#   出力:   docs/images/<name>.png
set -uo pipefail
DOCS="$(cd "$(dirname "$0")" && pwd)"
cd "$DOCS/images"
for n in "$@"; do
  { cat ../prompts/_recap-common-head.txt ../prompts/$n.txt ../prompts/_recap-common-tail.txt
    printf '\n画像生成ツールの出力を、そのまま保存してください。Python や Pillow などで文字を重ね書きしたり、拡大・切り貼り・加工したりしないこと。\n生成した画像は、カレントディレクトリに %s.png という名前で保存し、フルパスを報告してください。\n' "$n"
  } | codex exec -C "$PWD" -s workspace-write --skip-git-repo-check \
        -i _style-clean.png -i _style-dense.png -i _ref-cat.jpg -i _ref-cat-watercolor.png ${EXTRA_REF:+-i "$EXTRA_REF"} > "../prompts/$n.log" 2>&1
  [ -f "$n.png" ] && echo "OK  $n.png" || echo "NG  $n"
done
