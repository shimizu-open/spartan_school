#!/usr/bin/env bash
# 猫先生の挿絵を Codex CLI で生成する。
#   使い方: bash gen-illust.sh s1-hero s1-bad ...   （省略時は prompts/s*.txt 全部）
#   出力:   images/<name>.png
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/images"
names=("$@")
[ ${#names[@]} -eq 0 ] && names=($(cd "$DIR/prompts" && ls s*.txt | sed 's/\.txt$//'))
for n in "${names[@]}"; do
  echo "== $n"
  { cat "$DIR/prompts/_common.txt" "$DIR/prompts/$n.txt"
    printf '\n生成した画像は、このディレクトリに %s.png というファイル名でコピーして保存してください。保存後、フルパスを報告してください。\n' "$n"
  } | codex exec -C "$PWD" -s workspace-write --skip-git-repo-check \
        -i _ref-cat.jpg -i _style.png > "$DIR/prompts/$n.log" 2>&1
  [ -f "$n.png" ] && echo "OK  $n.png" || echo "NG  $n (prompts/$n.log を確認)"
done
