# 00. 棚卸し — このリポジトリで「自作してしまったもの」一覧

調査の出発点として、まず現物を読んで **何をゼロから書いたのか** を数え上げた。
以下はすべて実測（行数は `wc -l`、サイズは `du` / `stat`、2026-08-25 時点）。

---

## 1. 学習記録サイト `03.learning_site`（The Scholar's Casebook）

素の HTML を 1 ページずつ手書き。ビルド工程なし。

| 項目 | 現状 | 実測 |
|---|---|---|
| 記事 | `articles/case-0X-*.html` を手書き | 4 記事 / 789 行 |
| トップ | `index.html` にカードを手で追記 | 155 行 |
| 共通スタイル | `assets/style.css` 一枚 | 303 行 |
| 成果物 | `02.homework/01.week1/` から `works/` へ**手動コピー** | 2 作品を二重管理 |
| 画像 | 最適化なしの PNG をそのまま配信 | **26 枚 / 合計 69 MB** |

### 自作していること（＝ SSG が肩代わりする領域）

- **レイアウトの重複**：ヘッダ・フッタ・`<head>` が 4 記事＋2 ページにコピペで散在。
  1 か所直すと 6 ファイル触る。
- **記事一覧の手動同期**：新記事を足すたび `index.html` のカードを人間が書き足す。
  貼り忘れ＝リンク切れが構造的に起こりうる。
- **記事が HTML 直書き**：見出し・段落・コードブロックを毎回 `<h2>` `<p>` `<pre>` で書く。
- **無い機能**：サイト内検索 / タグ・カテゴリ / RSS / sitemap / OGP / 構造化データ /
  目次(TOC) / シンタックスハイライト / 前後の記事へのリンク。

### 実測で一番痛いところ — 画像

サムネイル 1 枚が **3.3〜4.0 MB の PNG**。上位 8 枚だけで 27 MB。

```
4.0 MB  assets/thumb-cross-domain.png
3.6 MB  assets/thumb-git-dungeon.png
3.6 MB  assets/thumb-linux-quest.png
3.5 MB  assets/thumb-subdomain.png
3.4 MB  articles/images/13_dns_ledger.png
```

トップページはこのサムネを 6 枚並べているので、**初回表示で約 20 MB を転送**している計算。
`loading="lazy"` も `width/height` 指定もレスポンシブ画像(`srcset`)も無い。
画像最適化パイプラインは、このサイトで**投資対効果が最も高い一手**。

---

## 2. 学習課題アプリ `02.homework/05.week5/web`（「かけら」）

フレームワーク不使用の静的 SPA。localStorage のみで動く。総計 1,996 行。

| ファイル | 行数 | 何を自作しているか |
|---|---:|---|
| `scripts/build.js` | 159 | **ビルドシステム全体**（後述） |
| `src/app/main.js` | 236 | ルーター、画面切替、history 同期、日付またぎ検知、遅延 import |
| `src/app/views/today.js` | 264 | テンプレートリテラル → `innerHTML` で画面生成 |
| `src/app/views/about.js` | 185 | 同上 |
| `src/app/views/outing.js` | 130 | 同上 |
| `src/app/views/fragments.js` | 99 | 同上 |
| `src/app/state.js` | 135 | 状態管理（単一オブジェクト＋購読者 `Set`＋`commit()`） |
| `src/app/lib/date.js` | 112 | 日付ユーティリティ |
| `src/app/storage/local.js` | 70 | localStorage 直列化＋手書きスキーマ検証 `normalize()` |
| `src/app/lib/dom.js` | 56 | DOM ラッパー（`querySelector` 等の言い換え） |
| `src/app/storage/index.js` | 10 | 保存先の差し替え口（re-export 1 行） |

### `scripts/build.js` の中身 — ここが再発明の密集地帯

159 行の中に、性質のまったく違う 5 つの仕事が同居している。

1. **JavaScript minifier を手書き**（約 55 行）
   ソースを 1 文字ずつ走査してコメント・空白・文字列を判定する自作パーサ。
   正規表現リテラルと除算の区別、テンプレートリテラルのネスト、ASI（自動セミコロン挿入）を
   扱っていないため、**書き方次第で静かに壊れたコードを吐く**構造になっている。
2. **BPE（Byte Pair Encoding）圧縮を手書き**（約 25 行）
   `lines.json`（368 行の文言データ）を語彙マージで圧縮し、
   自己解凍コード付きの `lines.js` として `dist` に出力する。
3. **フォント `@font-face` の生成**（約 25 行）
   `@fontsource` の `400.css` を**正規表現で書き換え**て `url()` を差し替え、
   woff2 を手動コピー。結果 **243 ファイル / 4.5 MB** を配信物に含めている。
4. **静的ファイルの clean / copy**（約 10 行）
5. **Tailwind CLI の呼び出しと CSS サイズの上限チェック**（約 15 行）

### アプリ側で自作しているもの

- **ルーティング**：`main.js` が `active` という文字列で現在画面を持ち、
  History API と手で同期。about だけ動的 `import()` で遅延読み込み。
- **描画**：テンプレートリテラルで HTML 文字列を組み、`innerHTML` に代入。
  `lib/dom.js` のコメントに「ユーザーの書いた文字は絶対にここへ混ぜない」と
  注意書きがあるが、これは**規律で守っている**だけで、仕組みでは守られていない。
- **状態管理**：`commit()` が「①差し替え ②保存 ③購読者へ通知」を必ず通る設計。
  設計自体は筋が良いが、これは既存ライブラリが 1 行で提供する機能。
- **永続化とスキーマ検証**：`normalize()` が読み込んだ JSON の型を手で検査し、
  壊れていれば初期値に戻す。キー名に `v1` を含めた素朴なマイグレーション設計。
- **日付**：`YYYY-MM-DD` キー生成、日数差、月キー、直近 N 日。
  DST 事故を避けるため `fromDateKey()` で**正午に固定**する工夫が入っている
  （＝この領域の落とし穴を、痛い目を見ながら自力で塞いだ跡）。

### 無いもの

テスト / 型チェック / Lint / Formatter / Service Worker（`site.webmanifest` だけ存在）。

---

## 3. インフラ `02.homework/05.week5/infra`

IaC ツールを使わず、AWS の設定を**生 JSON で手書き**して git に置いている。

```
infra/s3/bucket-policy.json
infra/cloudfront/response-headers-policy.json
infra/iam/deploy-role-policy.json
infra/iam/deploy-role-trust.json   # GitHub OIDC の信頼ポリシー
```

`<ACCOUNT_ID>` `<DISTRIBUTION_ID>` `<OWNER>` をプレースホルダとして残し、
**適用は人間が AWS コンソール / CLI で手作業**という運用。
デプロイは GitHub Actions から aws-cli で S3 同期。

---

## 4. 学習ゲーム `02.homework/01.week1`

素の HTML/CSS/JS で 2 本自作。合計 4,330 行。

| 作品 | HTML | JS | CSS |
|---|---:|---:|---:|
| Linux Story Quest | 151 | 1,119 | 1,133 |
| Git Dungeon | 123 | 1,063 | 741 |

シナリオ・進行管理・判定ロジック・UI をすべて 1 本の `script.js` に手書きしている。
ゲームエンジンもシナリオ記述用 DSL も使っていない。

---

## まとめ — 自作の総量

| 区分 | 行数 | 備考 |
|---|---:|---|
| 学習ゲーム 2 本 | 4,330 | エンジン不使用 |
| 学習記録サイト | 1,882 | ＋最適化なし画像 69 MB |
| かけら（SPA） | 1,996 | うちビルド系 159 |
| インフラ JSON | 4 ファイル | IaC 不使用 |

このうち **「学習の本体」ではない部分**（minifier、BPE、DOM ラッパー、日付計算、
レイアウトのコピペ、フォント CSS の正規表現書き換え、画像の手作業）が、
既存 OSS で置き換えられる領域である。何をどう置き換えるかは 01〜04 の各章で扱う。
