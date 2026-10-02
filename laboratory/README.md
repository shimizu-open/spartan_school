# laboratory — 学習サイトを作るための調査

> **目的**: 学習サイトを作る。そのために
> ① 使える OSS があるなら使う ②**既存 OSS から「学習サイトに必要な要素・機能・ルール・処理」を
> 抽出して、抽象・具体の両面で把握する** ③ 最適なフレームワークを選んで作る。

調査日: **2026-08-25**
方法: codex CLI（gpt-5.6-sol）に web 検索付きで **12トラック並列**調査させ、
Claude Code がリポジトリの実測値と突き合わせて統合。主要な数値は独立に再実測。

---

## 読む順番

### 第1部（本題）— 学習サイトとして何を作るか

| ファイル | 内容 |
|---|---|
| **[10-learning-site-elements.md](10-learning-site-elements.md)** | **学習サイトに必要な要素** — LMS・教育標準規格から抽出したドメインモデル |
| **[11-exercise-and-grading.md](11-exercise-and-grading.md)** | **演習と正誤判定** — Exercism / PrairieLearn / Learn Git Branching の設計 |
| **[12-architecture.md](12-architecture.md)** | **アーキテクチャ** — ディレクトリ・frontmatter・進捗JSON まで具体化 |
| **[13-ready-made-oss.md](13-ready-made-oss.md)** | **既製品を使えるか** — fork 候補、LMS、実例リポジトリ |
| **[14-mapping.md](14-mapping.md)** | **いまある資産をどう当てはめるか** |

### 第2部 — 実装技術リファレンス（器が決まった後に引く）

| ファイル | 内容 |
|---|---|
| [00-inventory.md](00-inventory.md) | 自作したものの実測棚卸し |
| [01-static-site.md](01-static-site.md) | SSG・検索・画像最適化・RSS |
| [02-spa-stack.md](02-spa-stack.md) | ビルド・描画・状態管理・永続化・PWA |
| [03-utilities.md](03-utilities.md) | minifier・圧縮・日付・フォント・Lint/テスト |
| [04-infra-and-learning.md](04-infra-and-learning.md) | IaC・ホスティング・CI・既存学習教材 |
| [05-diagrams-and-japanese.md](05-diagrams-and-japanese.md) | **図解のコード化**・日本語組版・校正 |
| [06-browser-runtimes.md](06-browser-runtimes.md) | ブラウザ内 Git/Linux 実行基盤カタログ |
| [07-docs-cms-slides.md](07-docs-cms-slides.md) | 日本語検索対応表・スライド・学習リソースのライセンス |
| [08-repo-ops.md](08-repo-ops.md) | **リポジトリ運営・セキュリティ**・CSS の土台 |
| [raw/](raw/) | codex の編集前の原文（12ファイル） |

---

## 結論を4つに圧縮すると

### 1. 学習サイトは「2つのモデル」でできている

| | 誰が提供するか |
|---|---|
| **A. 出版モデル**（Path → Module → Lesson、順序、検索、前後移動） | **既存 SSG が提供する** |
| **B. 学習状態モデル**（Progress、Attempt、完了条件、イベント） | **既存 SSG は提供しない。自分で足す** |

**`03.learning_site` は A を自作していた。** それが遠回りだった。
足すべきなのは B だけ。→ [10章](10-learning-site-elements.md)

### 2. 最小ドメインモデル — 記事も演習も作品も、同じ `Unit`

```
Course → Chapter → Unit
                    ├─ kind: article    読む     完了＝手動
                    ├─ kind: exercise   試す     完了＝イベント/得点
                    └─ kind: project    作る     完了＝チェックリスト＋URL

  共通: id（不変） / order / prerequisites / estimatedMinutes / status / contentVersion

LearnerState ← ここが既存 SSG に無い部分
  UnitProgress / ReviewCard / Bookmark / ChecklistState / LearningEvent
```

現在の「Case Files（記事）」と「Exhibition（作品）」の**セクション分割は構造上の誤り**。
分けるべきは `kind` と完了条件だけ。→ [14章](14-mapping.md)

### 3. 器は Starlight

**フル機能 LMS（Moodle / Frappe / Open edX）はすべて DB ＋常時稼働サーバーが必要で過剰。**
必要なのは「教材の順序」と「独立アプリ」を静的に統合するもの。

`Astro + Starlight` に、12章の frontmatter で `Unit / 完了条件 / 前提条件 / SRSカード /
学習イベント` を足す。進捗は IndexedDB、サーバーなし。→ [12章](12-architecture.md)・[13章](13-ready-made-oss.md)

> 記事は日付順ブログではなく **Case No.0 から順に読む教材**なので、
> 汎用ブログ SSG より**ドキュメント基盤が正しい**。

### 4. 正解判定は「文字列一致」ではなく「状態一致」

```js
❌ input === "cp docs/a.txt atelier/b.txt"        // 一つの手順しか認めない
✅ fileExists("/home/student/atelier/b.txt")      // 到達した状態を見る
```

**正解 ＝ 最終状態制約 ＋（学習目標に必要なら）操作の証拠**。
これで相対/絶対パス、先に `cd` する、引用符の差、**別解**をすべて許容できる。
Learn Git Branching が採る「目標グラフと一致したらクリア」と同じ原理。→ [11章](11-exercise-and-grading.md)

---

## 実測で分かったこと

### コンテンツは足りている。器が無いだけ

**Markdown で既に書いた学習コンテンツが約 8,800 行あるのに、公開サイトには 4 記事しかない。**

| | 行数 |
|---|---:|
| `week5/docs/STUDY.md`（裏側の全解説） | 1,023 |
| `week4/html_gen_pattern/docs/*` | 2,709 |
| `week5/docs/FILES.md` / `DESIGN.md` / `REQUIREMENTS.md` | 1,872 |
| `week3/独自ドメインとHTTPS化の仕組み解説.md` ほか | 約 3,200 |

Starlight を入れて sidebar に載せるだけで、**公開量が一気に増える**。→ [14章](14-mapping.md)

### 画像 69MB — 根治は「図をコードで書く」

サムネイル1枚が 3.3〜4.0MB の PNG。トップは6枚並ぶので**初回表示で約20MB転送**。
ただし**容量の大半は「コード化できない美術資産」の側**（挿絵・ヒーロー・サムネ）。

- **技術図6枚** → **D2 でコード化**（git 差分が読める、数KB になる）
- **挿絵・サムネ** → `astro:assets` で WebP/AVIF + srcset

→ [05章](05-diagrams-and-japanese.md)・[01章](01-static-site.md)

### 自作 BPE 圧縮は、配信サイズを悪化させていた（実測）

| 形式 | raw | gzip | **Brotli** |
|---|---:|---:|---:|
| 自作 BPE ＋ 復号コード | 9,022 B | 6,093 B | **4,979 B** |
| 素の JS 配列 | 16,056 B | 5,100 B | **4,681 B** |

**素の配列のほうが 298 バイト小さい。** 36行書いて損をしていた。→ [03章](03-utilities.md)

### 手書き minifier は「不完全な JS 字句解析器」

`value / /x/.test(text)` が `value//x/...` になってコメント化する。`a\n++b` が `a++b` で構文エラー。
いま動いていても**書き方を変えた瞬間に静かに壊れる**。→ [03章](03-utilities.md)

### DST バグを1件確認（実害は限定的）

`daysBetween` が `TZ=America/New_York` で 60日開放を 59 日と判定する。
**JST には DST がないので国内では出ない。**→ [03章](03-utilities.md)

---

## 🔴 いますぐ直したほうがよいもの（調査とは別件）

1. **`.gitignore` に `vendor/` が無い** — `01.lesson/06.week6/memo-app/src/vendor/` は
   **93MB / 8,794ファイル**。week6 は未コミットなので、`git add .` する前に直す
2. **デプロイ Workflow が動いていない** — `02.homework/05.week5/.github/workflows/deploy-web.yml`
   にあるが、**GitHub Actions が見るのはリポジトリ直下の `.github/` だけ**

→ [08章](08-repo-ops.md)

---

## 判断が分かれた点（統合時の裁定）

12本を並列で走らせたため、4箇所で推奨が競合した。

| 論点 | 競合 | 裁定 |
|---|---|---|
| **サイトの器** | Astro単体(01章) / **Starlight**(07・12章) / Quartz(04章) / next-course-starter(13章) | **Starlight**。記事は順序を持つ教材でありブログではない。next-course-starter は React ＋ 保守状況が未確認、Quartz は独自テーマ体系で Victorian CSS の移植が重い |
| **Git エンジン** | isomorphic-git(06章) / 小型自作モデル(11章) | **isomorphic-git**。原理（状態で判定）は両者一致。**学習サイトなので、自分の Git 理解が間違っていたときにゲームも一緒に間違う**のを避けたい。CI で本物の git と付き合わせられる |
| **日付ライブラリ** | 自作継続(02章) / date-fns(03章) | **`differenceInCalendarDays` だけ** date-fns に。DST バグは実在するが JST では出ないので優先度は低い |
| **SRS** | Anki をそのまま使う(07章) / ts-fsrs で自作(12章) | **両方**。サイト内の復習キューは `ts-fsrs`、それとは別に Anki を使う。**SRS 実装自体が学習課題になる場合を除き、作り込まない** |

---

## この調査の読み方（注意）

- **バージョン番号とリリース日は codex の web 検索由来。** 主要なものは妥当に見えるが、
  全件を再確認したわけではない。**採用前に npm / GitHub で最新を確認すること。**
- codex が確認できなかった項目は各表に **「未確認」** と明記してある。推測で埋めていない。
- **実測値（行数・ファイルサイズ・圧縮率・DST バグの再現）は独立に測定済み。**
- ライセンスで特に注意が必要なもの:
  **Terraform = BUSL-1.1（OSI 型 OSS ではない）** /
  **Outline = BSL 1.1** / **Zola = EUPL-1.2** / **ZenFS = LGPL-3.0** /
  **wasm-git = GPL-2.0 + linking exception** / **Anki = AGPL-3.0** /
  **CheerpX = プロプライエタリ（自己ホスト不可）** /
  **roadmap.sh = 再配布禁止** / **The Odin Project = CC BY-NC-SA（非商用）** /
  **tldr 本文 = CC BY-4.0（帰属必須）** / **OverTheWire Bandit = OSS ではない**
- ⚠ **Judge0 は 1.13.0 以前に重大な sandbox escape。使うなら 1.13.1 以降。**
- ⚠ **公開リポジトリであることと OSS であることは別。**
  LICENSE のないリポジトリを教材の fork 元にしない。
