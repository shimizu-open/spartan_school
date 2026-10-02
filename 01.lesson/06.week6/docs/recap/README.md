# 学習まとめ ビジュアルアブストラクト（3枚）

| 出力 | テーマ |
|---|---|
| `out/p1-trust.png`  | 外から来たものは信用しない（`$fillable` / プリペアドステートメント） |
| `out/p2-query.png`  | クエリは「メモ → 清書 → 実行」（組み立て / 戻り値の形） |
| `out/p3-undo.png`   | やり直せる設計（`down()` と migrate コマンド / 論理削除） |

各テーマに `-1x.png`（1240×1754・共有用）と `.html`（自己完結、外部リソースなし）もある。

## 作り直し方

```bash
bash gen-illust.sh s1-bad      # 挿絵を1枚だけ再生成（引数なしで全部）
bash build.sh                  # 3枚を組み直す（引数で p1-trust などを指定可）
```

- 挿絵: `prompts/_common.txt` ＋ `prompts/<name>.txt` を Codex CLI に渡して `images/<name>.png` を作る。
  猫先生の基準は `images/_ref-cat.jpg`、画風は `images/_style.png`。挿絵には文字を入れない（文字はHTML側）。
- 組版: `p*.tpl.html` ＋ `poster.css` に挿絵を WebP で埋め込み、ヘッドレス Chrome で PNG 化。
