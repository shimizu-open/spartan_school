# raw — codex の生の調査結果

`laboratory/` の各章は、ここにある codex の出力を Claude Code が
リポジトリの実測値と突き合わせて統合・編集したもの。こちらは**編集前の原文**。

## 第1ラウンド — 「自作したものを何で置き換えるか」

| ファイル | 統合先 |
|---|---|
| `00-brief-round1.md` | 共通ブリーフ |
| `track1-static-site.md` | → `../01-static-site.md` |
| `track2-spa-stack.md` | → `../02-spa-stack.md` |
| `track3-utilities.md` | → `../03-utilities.md` |
| `track4-infra-and-learning.md` | → `../04-infra-and-learning.md` |

## 第2ラウンド — 第1ラウンドで抜けた領域

| ファイル | 統合先 |
|---|---|
| `00-brief-round2.md` | 共通ブリーフ |
| `track5-diagrams-japanese.md` | → `../05-diagrams-and-japanese.md` |
| `track6-browser-runtimes.md` | → `../06-browser-runtimes.md` / `../11-exercise-and-grading.md` |
| `track7-docs-cms-slides.md` | → `../07-docs-cms-slides.md` / `../13-ready-made-oss.md` |
| `track8-repo-ops.md` | → `../08-repo-ops.md` |

## 第3ラウンド（本題）— 「学習サイトを作る」という観点

| ファイル | 統合先 |
|---|---|
| `00-brief-round3.md` | 共通ブリーフ（**目的の定義がここにある**） |
| `trackA-lms-domain-model.md` | → `../10-learning-site-elements.md` |
| `trackB-exercise-grading.md` | → `../11-exercise-and-grading.md` |
| `trackC-architecture.md` | → `../12-architecture.md` |
| `trackD-ready-made.md` | → `../13-ready-made-oss.md` |

`../14-mapping.md` は調査結果ではなく、リポジトリの現物を読んだ上での配置案。

## 再実行する場合

```bash
cat laboratory/raw/00-brief-round3.md | codex exec \
  -c tools.web_search=true -s read-only \
  --cd /home/shimizu/study/spartan_school \
  -o /tmp/out.md '<トラックごとの指示>'
```

調査は 2026-08-25 実施。バージョン番号は当時の web 検索結果。
