# 13.〈本題〉既製品を使えるか — fork して始められるものはあるか

> **第一希望は「もう良いものがあるなら、それを使いたい」。この章はそれに答える。**

調査: codex + web search（2026-08-25）／trackD・track7 の統合

---

## 結論

**「そのまま使える既製品」は存在する。ただし必要なのは完成 LMS ではなく、
「教材の順序」と「独立アプリ」を静的に統合するコーススターター。**

そして推奨は **Starlight**。

### 推奨の食い違いと裁定

| トラック | 第一推奨 |
|---|---|
| track7（ドキュメント系） | **Starlight** |
| trackC（アーキテクチャ） | **Starlight** |
| trackD（既製品） | `btholt/next-course-starter` |

**Starlight を採る。理由:**

1. **next-course-starter は Next.js / React**。第1ラウンドで既に
   「Next.js は既存 HTML の JSX 化コストが最大、このサイトには過剰」と判定済み。
   素の JS で書いてきた人にとって React は新規学習になる
2. next-course-starter は **「GitHub Releases なし、最終コミット日は未確認」**（trackD 自身の記述）。
   Starlight は **v0.41.5（2026-07-28）** で公式保守
3. **trackD 自身が退路として Starlight を挙げている** ——
   「スターター固有の古さや Next.js 更新問題が大きければ、
   コンテンツ構造を保ったまま公式 Starlight へ移る」
4. next-course-starter の利点は `Course / Section / Lesson` を第一級概念に持つ点だが、
   **それは 12章の frontmatter で Starlight に足せる**
5. 手書きのヴィクトリア朝 CSS を保つには Astro 系が有利

→ **next-course-starter からは「ドメインモデル」と「1週間の手順」だけ借り、器は Starlight。**

---

## 1. コース・教材サイトのスターター

| 名前 | 第一級の概念 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|---|
| **Starlight** ★ | `Page / Sidebar group / Heading / Locale`。Cards・Steps・Tabs・Aside をレッスン表現に転用 | [withastro/starlight](https://github.com/withastro/starlight) · **MIT** · **v0.41.5（2026-07-28）** | **採用**。静的配信・a11y・検索・モバイルが強い。ただし `Course / Lesson / Completion` は**無い**ので自分で決める |
| **Next Course Starter** | **`Course / Author / Section / Lesson`**。番号付きディレクトリと Markdown から順序・URL・目次を生成 | [btholt/next-course-starter](https://github.com/btholt/next-course-starter) · **Apache-2.0** · Releases なし、最終コミット日 **未確認**。Node 20+ | **モデルだけ借りる**。`course.json` にメタを集約する設計は参考になる。実際の公開コースで使用実績あり |
| **Knowledge Core** | **`Course / Module / Lesson / Goal / Quiz / Exercise / Progress`** ← 驚くほど今回に合う | [casoon/knowledge-core](https://github.com/casoon/knowledge-core) · MIT · Releases なし、**19 commits / 2 stars** | **設計見本としては優秀だが第一採用にしない**。実績が少なすぎる。RAG・Vectorize・Workers AI・monorepo まで入り初期段階には過剰 |
| **withastro/docs** | `Locale / Guide / Reference page / Sidebar / Translation status` | [withastro/docs](https://github.com/withastro/docs) · MIT · 12,000+ commits | **参照実装**。翻訳・品質管理は参考。fork 元としては重すぎる |
| **Docusaurus** | `Docs / Category / Version / Locale / Blog post` | [facebook/docusaurus](https://github.com/facebook/docusaurus) · MIT · **v3.10.2（2026-07-10）** | ブログと教材の併設に強いが **React 依存が増える** |
| **Material for MkDocs** | `Navigation tree / Page / Tutorial / Tag / Version` | [squidfunk/mkdocs-material](https://github.com/squidfunk/mkdocs-material) · MIT · **v9.7.7（2026-07-17）** | Markdown 教材には非常に良いが **Python 環境追加**。⚠ **作者が新機能を feature freeze**（上流 MkDocs との技術的問題）。移行リスク |
| **VitePress** | Vue/Vite の高速ドキュメント SSG | [vuejs/vitepress](https://github.com/vuejs/vitepress) · MIT · **v2.0.0-alpha.19（2026-08-02）** | **v2 はまだ alpha**。Vue 依存を新規に持つ |
| **mdBook** | **`Book / Part / Chapter / Summary order / Code playground`**。`SUMMARY.md` が正規順序 | [rust-lang/mdBook](https://github.com/rust-lang/mdBook) · **MPL-2.0** · **v0.5.3（2026-05）** | 直線的な技術書には非常に良い。**ブログ・作品一覧・複数アプリの器としては狭い** |
| **Jupyter Book 2** | `Book / Chapter / Notebook / Code cell / Execution output / Citation` | [jupyter-book/jupyter-book](https://github.com/jupyter-book/jupyter-book) · BSD-3-Clause · **v2.1.5（2026-05-02）** | Python/R/数式中心の教材には最適。**今回は過剰**で Node 中心から外れる |
| **Quarto** | `Project / Website or Book / Chapter / Executable document / Citation` | [quarto-dev/quarto-cli](https://github.com/quarto-dev/quarto-cli) · MIT · **v1.9.38（2026-05-25）** | 授業資料や PDF 化には強いが、**出版機能が勝ちすぎる** |
| **Nextra** | Next.js 上のドキュメント・ブログテーマ | [shuding/nextra](https://github.com/shuding/nextra) · MIT · **v4.6.1（2025-12-04）** | Next.js + React は現在の静的 S3 サイトには過剰 |
| **Docsify** | ビルドせずブラウザで Markdown を読む | [docsifyjs/docsify](https://github.com/docsifyjs/docsify) · MIT · v5 系開発中 | ⚠ **初回表示に JS 必須で生成済み HTML を持たない**。SEO・障害耐性・印刷に不利 |
| **hugo-book / Hugo Relearn** | `Book section / Page / Chapter / Tab / Notice` | [alex-shpak/hugo-book](https://github.com/alex-shpak/hugo-book) · MIT / [McShelby/hugo-theme-relearn](https://github.com/McShelby/hugo-theme-relearn) · MIT | 高速で堅いが、**Node/JS 資産との接続は Astro 系が上** |
| **Rust Book / Rustlings** | Rustlings は **`Exercise / Hint / Solution / Progress`** を第一級概念に | [rust-lang/book](https://github.com/rust-lang/book) / [rust-lang/rustlings](https://github.com/rust-lang/rustlings) · **v6.5.0（2026-08-21）** | **教材設計の参考**。Rustlings は CLI 演習システムで Web スターターではない |

### Next / Nuxt / SvelteKit 系

**成熟した公式のコーススターターは確認できなかった。**
GitHub 上には個人製の LMS clone が多数あるが、ライセンス不明・数コミット・外部 SaaS 必須が多く、
今日 fork する対象にしにくい。実在確認できた2件も不採用:

- **Mux Video Course Starter**（[muxinc/video-course-starter-kit](https://github.com/muxinc/video-course-starter-kit)）
  — **LICENSE を確認できず（未確認）**。Mux・PlanetScale・Prisma・NextAuth が必要
- **Sanity Demo Course Platform**（[sanity-io/demo-course-platform](https://github.com/sanity-io/demo-course-platform)）
  — **ライセンス未確認**。Sanity プロジェクトが必要

---

## 2. そのまま動く OSS プロダクト

→ 各 LMS の詳細と第一級概念は [10-learning-site-elements.md](10-learning-site-elements.md) を参照。

**結論**: フル機能 LMS（Frappe Learning / CourseLit / Runestone / Tutor LMS）は
**すべて DB ＋常時稼働サーバーが必要**で、ひとり利用には重すぎる。

**唯一の条件付き有力候補は CTFd**（Apache-2.0・v3.8.6・Docker Compose で開始可）。
ただし **記事・授業ノート・作品集の母艦にはならない**。

### ナレッジベース系は器にならない

| 名前 | 第一級の概念 | ライセンス / 活動 | 判定 |
|---|---|---|---|
| **BookStack** | **`Shelf → Book → Chapter → Page`**（明快な出版階層） | [BookStackApp/BookStack](https://github.com/BookStackApp/BookStack) · MIT · **v26.05.2（2026-07-02）**、主開発は Codeberg へ移行 | 階層は優秀だが **PHP/DB サーバーが必要**。ゲームを第一級教材として扱えない |
| **Docmost** | `Workspace / Space / Page / Block / Comment / Revision` | [docmost/docmost](https://github.com/docmost/docmost) · コア AGPL-3.0 / Enterprise 部分は別 · **v0.95.0（2026-07-03）** | 授業ノートの共同編集には良いが、**学習順序・進捗・演習がない** |
| **Wiki.js** | `Page / Path / Tag / User / Group / Permission` | [Requarks/wiki](https://github.com/Requarks/wiki) · AGPL-3.0 · 安定 2.5.314、**3.0 は開発中** | コース・進捗・演習がない。3.0 移行途中も注意 |
| **Outline** | `Workspace / Collection / Document / Revision` | [outline/outline](https://github.com/outline/outline) · ⚠ **BSL 1.1（OSI 系 OSS ではない）** · v1.7.1（2026-05-04） | 学習サイトモデルを持たない |

> ナレッジベースは**「授業メモを編集する場所」にはなるが、
> 「記事・ゲーム・習慣アプリを統合した公開学習サイト」の器には弱い。**

---

## 3. 構成を真似できる実例

### simonw/til — 記録の粒度の手本

- [simonw/til](https://github.com/simonw/til) · **Apache-2.0** · 2026-07-13 の項目を確認、継続更新中
- ドメインモデル: `Topic / TIL entry / Date / Feed`
- **真似する点**: **週次メモを大作記事にしようとせず、1学習1Markdownで蓄積する**（現在581件）
- 持たないもの: コース順序、達成、演習

### 日本語版 Modern JavaScript Tutorial — 課題と解答の分離

- [javascript-tutorial/ja.javascript.info](https://github.com/javascript-tutorial/ja.javascript.info)
  · リポジトリ独自 LICENSE（再利用時は個別確認が必要）· 2,300+ commits
- ドメインモデル: **`Section / Article / Task / Solution / Local resource`**
- **真似する点**: **`task.md` と `solution.md` を分離**し、画像・コードを教材のそばに置く

### サバイバルTypeScript — 学習段階のサイト構造化

- [yytypescript/book](https://github.com/yytypescript/book) · CC-BY-SA-4.0 等（複数ライセンス表示）
  · GitHub Releases 上の最終リリースは **2023-07**
- ドメインモデル: `Learning phase / Chapter / Page / Example / Contribution`
- **真似する点**: **「あらまし → 作って学ぶ → 読んで学ぶ」という学習段階をサイト構造に反映**

### Rust Book 日本語版 — 本文と実行例の分離

- [rust-lang-ja/book-ja](https://github.com/rust-lang-ja/book-ja) · **Apache-2.0 OR MIT** · 4,400+ commits
- ドメインモデル: `Chapter / Listing / Translation mapping / Book configuration`
- **真似する点**: 本文と実行例を分離し、`book.toml` と `src` を出版の正規情報源にする

### ⚠ OSS と誤認しやすい例

- **りあクト！** — サンプルコードは公開されているが、**販売書籍本文を自由に fork できる OSS とは
  確認できなかった**。構成とサンプルの参考までに留める
- **Zenn Book** — `books/<slug>/config.yaml + chapter.md` の運用は参考になるが、
  **GitHub で公開されていることと OSS であることは別**。
  **著者が明示した LICENSE がないリポジトリを教材 fork 元にしてはいけない**
- **技術書典系** — サンプルコードのみ OSS、本文は販売物という構成が多い。
  **リポジトリ単位・ディレクトリ単位でライセンスを確認する**

> **日本語事例から抽出できる定石**:
> 「本文」「課題」「解答」「実行例」「画像」を**別の第一級要素として管理する**こと。
> そして**公開リポジトリと再利用可能な OSS を混同しない**こと。

---

## 4. 学習ゲームをどう置くか

### 第一選択: 同一静的サイト内に独立アプリとして同居

Linux Story Quest / Git Dungeon / かけら は既にブラウザ内で完結している。
**最初から H5P や LTI へ変換せず、ビルド結果へそのままコピーするのが最小コスト。**

```
public/works/
├── linux-story-quest/
├── git-dungeon/
└── kakera/
```

教材ページ側では2通り:

- **基本**: 「新しいページでゲームを始める」リンク
- 教材の文脈を保ちたい場合: iframe

```html
<iframe src="/works/linux-story-quest/" title="Linux Story Quest"
        loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe>
```

**注意事項:**
- ゲーム内 URL は**相対パス**にする
- **各アプリの `localStorage` キーに名前空間を付ける**
- iframe と親ページの進捗連携が必要になったら **`postMessage`**
- **全画面操作やキーボード中心ゲームは iframe より別ページがよい**
- CSP の `frame-src` / `frame-ancestors` を明示する
- **サイト側の「完了」とゲーム内部の「クリア」は当初分離してよい**

### H5P — 現段階ではコスト超過

[h5p/h5p-php-library](https://github.com/h5p/h5p-php-library) · **GPL-3.0**（個別 content type に MIT 等）
ドメインモデル: `Content type / Library / Content instance / Dependency / Attempt result`

> **既存ゲームをそのまま `.h5p` へ詰める仕組みではない。**
> H5P content type としてラッパーを開発する必要がある。

### LTI 1.3 — 今は不適切

LMS を `Platform`、外部ゲームを `Tool` として `Context / User / Role / Resource link / Launch / Result`
を交換する標準。iframe 表示にも対応するが、**OIDC・JWT・OAuth 2.0・HTTPS が必要**。

必要になるのは次の場合だけ:
- 複数受講者を LMS で認証したい
- ゲーム結果を LMS の成績簿へ返したい
- 同じゲームを複数 LMS へ提供したい

**昇格の順序**: 同一オリジン配下の独立アプリ → `postMessage` で完了イベント → サーバー/LTI

---

## 5. Git ベース CMS — 今は不要、将来の選択肢

**現状は本人しか編集しないので、Markdown ＋ VS Code で十分。**
CMS は「**スマホから更新したい**」「**Git を知らない編集者が加わる**」段階で導入する。

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **Sveltia CMS** ★ | [sveltia/sveltia-cms](https://github.com/sveltia/sveltia-cms) · **MIT** · **v0.187.0（2026-08-11）** 非常に活発 | **将来の第一推奨**。Decap 互換設定。個人なら fine-grained PAT、OAuth なら [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) を Cloudflare Worker へ |
| **Decap CMS** | [decaporg/decap-cms](https://github.com/decaporg/decap-cms) · MIT · **v3.12.2（2026-04-17）** | **「放棄されたまま」ではなく再活性化している**。ただし Sveltia の方が UI・モバイル・i18n・性能で上 |
| **Keystatic** | [Thinkmill/keystatic](https://github.com/Thinkmill/keystatic) · MIT · 最新 release **未確認**、README は experimental 表記 | GitHub mode はアプリ側ルートを要し、**純粋な S3 静的配信と相性が悪い** |
| **TinaCMS** | [tinacms/tinacms](https://github.com/tinacms/tinacms) · Apache-2.0（一部データ層は別） · 3.11 系（2026-07） | TinaCloud またはデータ層・認証の運用が必要。**個人4記事には過剰** |
| **Pages CMS** | [hunvreus/pagescms](https://github.com/hunvreus/pagescms) · MIT · 2026 継続更新 | hosted は低コスト、self-host は PostgreSQL + GitHub App + 秘密鍵 |
| **Static CMS** | [StaticJsCMS/static-cms](https://github.com/StaticJsCMS/static-cms) | ⚠ **2024-09-09 に archive、開発終了。採用不可** |

**重要**: CMS は S3 へ直接書かない。経路は必ずこうなる:

```
ブラウザの CMS → GitHub API へ Markdown/画像を commit
              → GitHub Actions または Cloudflare Pages が build
              → dist を S3/CloudFront または Pages へ配信
```

⚠ **S3 は OAuth の client secret を安全に保持できない。**

---

## 6. 最初の1週間（trackD の手順を Starlight 用に読み替え）

**1日目 — 素の状態を固定**
```bash
npm create astro@latest -- --template starlight
```
タイトル・説明・サイト URL を設定。ビルド成功をコミット。

**2日目 — 既存記事を1本だけ移植**
AWS 記事1本を Markdown 化。PNG を移す。見出し・コードブロック・リンク・モバイル表示を確認。
**残り3本を一括移植する前に変換ルールを決める。**

**3日目 — ゲームを無改造で置く**
`public/works/linux-story-quest/` と `git-dungeon/` へコピー。
相対 URL・画像・`localStorage` を確認。まずはレッスンから**別ページで開く**。

**4日目 — 教材構造を作る**
`Webインフラ / Linux / Git / 授業メモ` の4セクション。
各レッスンに「目的」「前提」「教材」「手を動かす」「振り返り」を置く。
**記事とゲームを同じコース上に並べる**。

**5日目 — 作品一覧と「かけら」**
`/works` ページを追加。3アプリをカード表示。
**「教材」「成果物」「日常利用アプリ」をラベルで区別する。**

**6日目 — 静的デプロイ**
サブパス・404・ゲームの直接 URL・画像 URL を確認。

**7日目 — 採用判定**
次を満たせば継続:
- 記事追加が **Markdown 一枚**で済む
- ゲームが**改造なし**で動く
- スマートフォンで**教材 → ゲーム → 教材**へ戻れる
- ビルドと公開が**一コマンドまたは push** で完了する
