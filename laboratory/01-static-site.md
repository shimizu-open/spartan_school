# 01. 学習記録サイトを OSS で作り直すなら

対象: `03.learning_site`（The Scholar's Casebook）
調査: codex + web search（2026-08-25 実施）／実測値は `00-inventory.md` を参照

---

## 結論 — Astro

**Astro + Content Collections + Pagefind + `astro:assets`** を第一推奨とする。

理由は3つ。
1. `.astro` のテンプレート部分は**ほぼ素の HTML** なので、手書きした 303 行の
   ヴィクトリア朝 CSS と素の JS を**書き直さずそのまま持ち込める**。
2. いま手作業になっている部分（共通レイアウト、記事一覧の同期、frontmatter 検証、
   画像最適化、RSS、sitemap）が**標準機能または公式パッケージで埋まる**。
3. Eleventy もほぼ同点だが、画像処理・記事メタデータ・検索を**個別に選んで組む**量が増える。
   このサイトは不足機能が多いので、統合度の高い Astro が向く。

```
Astro
├─ Layout / Component  … 現行 assets/style.css をそのまま利用
├─ Content Collections … posts（記事）/ projects（作品）を frontmatter + schema で管理
├─ Shiki               … コードハイライト（Astro 標準・追加ゼロ）
├─ astro:assets        … WebP/AVIF 生成・srcset・width/height 自動付与
├─ Pagefind            … 日本語対応のサイト内検索
├─ @astrojs/rss        … RSS
├─ @astrojs/sitemap    … sitemap.xml
└─ vite-plugin-static-copy … 02.homework の成果物をビルド時だけ dist/works へ収録
```

---

## 1. SSG 比較

### 移行のしやすさ

| 候補 | 既存 HTML/CSS/JS の再利用 | Markdown | 学習コスト | 日本語 |
|---|---|---|---|---|
| **Astro** | `.astro` はほぼ HTML。既存 CSS と素の JS を直接使える | 標準。frontmatter / MDX / 型付き Content Collections | 低〜中 | 問題なし。`lang="ja"` と ASCII slug の明示を推奨 |
| **Eleventy** | HTML そのものを入力テンプレートにできる。最も素の HTML に近い | 標準。Liquid/Nunjucks 等も選択可 | 低 | 問題なし。検索の分かち書きは別途 |
| **Hugo** | 使えるが Go Template へ分解が必要 | 強力（taxonomy / 多言語 / TOC 内蔵） | 中 | 多言語は強い |
| **Zola** | Tera テンプレートへ移植が必要 | 標準（taxonomy / TOC / 検索索引 内蔵） | 中 | 既定 slug の ASCII 化設定に注意 |
| **Jekyll** | Liquid へ移植 | 標準 | 中（Ruby 環境が増える） | 問題なし |
| **Next.js static export** | **JSX/React へ書き換えが必要** | MDX 可だが構成が増える | 高 | 表示上は問題なし |

### 保守状況と採否

| 名前 | リポジトリ / ライセンス / 活動状況 | 置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **Astro** | [withastro/astro](https://github.com/withastro/astro) · MIT · **v7.2.6（2026-08-25）** 非常に活発 | 共通レイアウト、記事一覧、タグ、frontmatter 検証、画像、コード表示 | 低〜中 | メジャー更新が速い。テーマを大改造すると追従コストが出る |
| **Eleventy (11ty)** | [11ty/eleventy](https://github.com/11ty/eleventy) · MIT · **v3.1.6（2026-05 頃）**、4.0 alpha 進行中 | レイアウト重複、Markdown 記事、一覧生成、passthrough copy | 低 | 対抗馬。画像・検索・SEO を個別に選ぶ必要あり |
| **Hugo** | [gohugoio/hugo](https://github.com/gohugoio/hugo) · Apache-2.0 · **v0.165.0（2026-08-12）** 非常に活発 | 記事、taxonomy、RSS、sitemap、多言語、画像処理 | 中 | Node/npm 中心という前提から外れ、Go Template の独自知識が増える |
| **Zola** | [getzola/zola](https://github.com/getzola/zola) · **EUPL-1.2**（2026 にライセンス変更） · **v0.23.4（2026-08-20）** | Markdown、taxonomy、TOC、feed、sitemap、ハイライト、検索索引 | 中 | Tera を新規に学ぶ。v0.23 は破壊的変更が大きい |
| **Jekyll** | [jekyll/jekyll](https://github.com/jekyll/jekyll) · MIT · **v4.4.1（2025-01-29）** リリース頻度は低い | Liquid レイアウト、Markdown 記事、一覧、feed | 中 | Ruby 環境を足す割に、S3 公開では GitHub Pages 統合の利点がない |
| **Next.js static export** | [vercel/next.js](https://github.com/vercel/next.js) · MIT · **v16.3.1（2026-08）** | ページ生成、React、画像、MDX | 高 | **このサイトには過剰**。既存 HTML の JSX 化コストが最大 |

**順位: Astro > Eleventy > Hugo > Zola > Jekyll > Next.js**

---

## 2. 既製テーマ — 「参考にする、丸ごと使わない」

現行のヴィクトリア朝 CSS はこのサイト固有の価値なので、**テーマを丸ごと採用すると個性が消える**。
推奨は AstroPaper か Cactus から「検索・RSS・OGP の実装だけ学ぶ」方式。

| 名前 | リポジトリ / ライセンス / 活動状況 | 何が学べる／置き換わるか | 注意点 |
|---|---|---|---|
| **AstroPaper** | [satnaing/astro-paper](https://github.com/satnaing/astro-paper) · MIT · **v6.1.0（2026-06-06）** | ブログ一覧、タグ、Pagefind 検索、動的 OGP、RSS、sitemap、SEO | Tailwind 前提。現行 CSS に戻すほど fork 追従が難しくなる |
| **Astro Cactus** | [chrismwilliams/astro-theme-cactus](https://github.com/chrismwilliams/astro-theme-cactus) · MIT · 2026 年設定へ更新済み（タグ付き release は未確認） | Pagefind、Satori OGP、RSS、sitemap、MDX、コード表示 | 機能が近い。作品コレクションは自作。搭載機能が多く理解量も増える |
| **Dante** | [JustGoodUI/dante-astro-theme](https://github.com/JustGoodUI/dante-astro-theme) · **GPL-3.0** · 2026-07-21 更新 | ブログ＋ポートフォリオ兼用の完成形 | GPL-3.0。デザインを大きく変えるなら fork の利点が薄い |
| **Astro Portfolio Starter** | [drehimself/astro-portfolio-starter](https://github.com/drehimself/astro-portfolio-starter) · MIT · 最終更新未確認 | 作品一覧、ブログ、タグ、ダークモード | RSS・sitemap・検索・画像処理は追加が必要 |
| **Astrofy** | [manuelernestog/astrofy](https://github.com/manuelernestog/astrofy) · MIT · Astro 4 系で更新遅れ | ブログ、作品カード、CV、RSS | Tailwind/DaisyUI 依存が増え本体も古い。**不採用寄り** |

> 「クラシック／ヴィクトリア朝」にそのまま合う、十分に保守された既製テーマは**確認できなかった**。
> 現行 CSS を維持するのが最も確実。

---

## 3. サイト内検索 — 日本語の分かち書きが焦点

### 第一推奨: Pagefind

完成後の HTML を索引化するので、**記事データを検索用 JSON に変換する処理が要らない**。
v1.5 で索引側だけでなく**検索語側も `Intl.Segmenter` で CJK 分割**されるようになった。
`<html lang="ja">` を出力し、ビルド後に `npx pagefind --site dist` を回すだけ。

| 名前 | リポジトリ / ライセンス / 活動状況 | 日本語対応 | コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **Pagefind** | [Pagefind/pagefind](https://github.com/Pagefind/pagefind) · MIT · **v1.5.2（2026-04-12）** 活発 | extended 版 ＋ v1.5 の CJK `Intl.Segmenter` 対応。日本語 UI あり | 低 | dev サーバーだけでは索引が作られない。production build 後に確認 |
| **Lunr.js + lunr-languages** | [olivernn/lunr.js](https://github.com/olivernn/lunr.js) · MIT · core は **v2.3.9（約6年前）低活動** / [lunr-languages](https://github.com/MihaiValentin/lunr-languages) は v1.20.0（2026-05） | 拡張側に日本語 tokenization | 中〜高 | **core が長期未更新**。索引 JSON 生成と読み込み最適化を自作 |
| **Fuse.js** | [krisk/Fuse](https://github.com/krisk/Fuse) · Apache-2.0 · **v7.5.0（2026-07 頃）** | v7.4+ でカスタム tokenizer に `Intl.Segmenter("ja")` を指定可 | 中 | 本文全文検索には索引サイズと抽出処理が必要。日本語長文の順位が不安定 |
| **Orama** | [oramasearch/orama](https://github.com/oramasearch/orama) · Apache-2.0 · **v3.1.18（2025-12-19）** | `@orama/tokenizers` に日本語 tokenizer（stemmer は無し） | 高 | 記事数本〜数十本には**過剰** |
| **MiniSearch** | [lucaong/minisearch](https://github.com/lucaong/minisearch) · MIT · **v7.2.0（2025 年頃）** | 既定は空白・句読点分割。`Intl.Segmenter` のカスタム tokenizer が必要 | 中 | 日本語対応も索引 JSON も自作。Pagefind より作業が多い |

> **注意**: `Intl.Segmenter` は形態素解析器ではない。「CloudFront」「S3」「独自ドメイン」等の
> 技術語の検索品質は、frontmatter に `searchTerms`（別表記）を持たせると改善する。

---

## 4. 記事執筆まわり

### 推奨 frontmatter（小さく保つ）

```yaml
---
title: "独自ドメインとHTTPSの謎"
description: "Route 53・ACM・CloudFront を巡る学習記録"
published: 2026-07-01
updated: 2026-07-01
caseNumber: 1
tags: ["AWS", "DNS", "HTTPS"]
slug: "case-01-domain-https"   # 既存URLを維持するため ASCII で明示
hero: "./images/01_overview.png"
draft: false
---
```

| 名前 | リポジトリ / ライセンス / 活動状況 | 置き換わるもの | コスト | 注意点 |
|---|---|---|---|---|
| **Astro Markdown + Content Collections** | withastro/astro · MIT · v7.2.6 | 手書き記事 HTML、一覧カード、タグ、日付・説明の重複 | 低 | **通常記事はこれを標準に**。既存 HTML 断片も Markdown 内に残せる |
| **MDX** | [mdx-js/mdx](https://github.com/mdx-js/mdx) · MIT · **v3.1.1（2025-08-29）**、2026 も更新あり | 図解コンポーネント、注意書き、リンクカード | 中 | 全記事を MDX にする必要はない。記事がコード化しやすい副作用あり |
| **remark-gfm** | [remarkjs/remark-gfm](https://github.com/remarkjs/remark-gfm) · MIT · **v4.0.1（約2年前）** unified collective 保守 | 脚注・表の手書き HTML | 低 | 必要な GFM 機能だけ追加 |
| **remark-toc** | [remarkjs/remark-toc](https://github.com/remarkjs/remark-toc) · MIT · **v9.0.0（約3年前）** | 手動 TOC | 低 | リリースが古い。**Astro の `render()` が返す headings からレイアウト側で作る方が依存が少ない** |
| **Shiki** | [shikijs/shiki](https://github.com/shikijs/shiki) · MIT · **v4.4.3（2026-08）** 活発 | コードブロックの色付け | **ほぼゼロ** | Astro 標準。クライアント JS 不要 |
| **Prism** | [PrismJS/prism](https://github.com/PrismJS/prism) · MIT · **v1.30.0（2025-03 頃）** | コードハイライト | 低 | 標準の Shiki を外してまで選ぶ理由は小さい |
| **remark-link-card-plus** | [okaryo/remark-link-card-plus](https://github.com/okaryo/remark-link-card-plus) · MIT · Node 22 対応（最終 release 日 未確認） | リンクカード HTML と OGP 取得 | 中 | **ビルドが外部サイトの応答に依存する**。キャッシュをコミットするか手入力の方が再現性が高い |

---

## 5. 画像最適化 — このサイト最大の課題

> 実測: **PNG 26 枚 / 合計 69 MB**。サムネイル 1 枚が 3.3〜4.0 MB。
> トップページはそれを 6 枚並べているので**初回表示で約 20 MB 転送**（`00-inventory.md` 参照）。

PNG 図解は写真と違い**文字と細線**を含む。原本を lossy 圧縮で上書きせず、
**原本は保持したままビルド成果物だけ**を WebP/AVIF/最適化 PNG に変換するのが安全。

| 名前 | リポジトリ / ライセンス / 活動状況 | 置き換わるもの | コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **`astro:assets`** | withastro/astro · MIT · v7.2.6 | responsive 画像、width/height 自動付与、WebP/AVIF 生成 | 低 | **`public/` の画像は最適化対象外**。記事画像を `src/assets` か記事隣接へ移すこと |
| **sharp** | [lovell/sharp](https://github.com/lovell/sharp) · Apache-2.0 · **v0.35.3（2026-06 頃）** | resize、PNG 圧縮、WebP/AVIF 変換 | 低〜中 | 直接 API を書く必要はなく、通常は Astro の既定画像サービス経由 |
| **`@11ty/eleventy-img`** | [11ty/image](https://github.com/11ty/image) · MIT · **v7.0.0（2026-07-29）** | `picture/srcset`、複数形式、リモート画像キャッシュ | 低〜中 | Eleventy 採用時の第一候補 |
| **OxiPNG** | [oxipng/oxipng](https://github.com/oxipng/oxipng) · MIT · **v10.1.1（2026-04-22）** 活発 | 原本 PNG の**無劣化**圧縮、metadata 除去 | 低 | CI 時間が増える。原本の一度きり最適化に向く |
| **pngquant** | [kornelski/pngquant](https://github.com/kornelski/pngquant) · **GPL-3.0 または商用** · 2026 最新 release 未確認 | PNG 容量の大幅削減 | 中 | **図中の文字・グラデ・細線が劣化し得る**。原本の一括上書きは避ける |
| **Squoosh CLI** | [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh) · Apache-2.0 · CLI **v0.7.3（約4年前）「no longer maintained」** | 手動画像圧縮 | 中 | **保守終了。不採用** |

**推奨順**: `astro:assets` → 必要なら原本に OxiPNG。
PNG fallback を残しつつ WebP を配信し、AVIF は図解ごとに容量とデコード品質を比較してから追加。

---

## 6. 付帯機能

### RSS / sitemap / OGP

| 名前 | リポジトリ / ライセンス / 活動状況 | 置き換わるもの | コスト | 注意点 |
|---|---|---|---|---|
| **`@astrojs/rss`** | withastro/astro · MIT · Astro 7 系で継続更新 | `rss.xml` の手書き | 低 | `site` URL と公開済み記事だけを渡す。draft 除外をテスト |
| **`@astrojs/sitemap`** | withastro/astro · MIT · 公式統合 **3.7 系** | `sitemap.xml` | 低 | 作品ゲーム・404・draft の含有ルールを明示 |
| **Satori** | [vercel/satori](https://github.com/vercel/satori) · **MPL-2.0** · **v0.29.0（2026-07-23）** 活発 | 記事ごとの OGP 画像自動生成 | 中 | CSS は一部のみ対応。**日本語フォントデータをビルド時に読む必要**あり |

> OGP は最初から動的生成しなくてよい。まず共通 `hero.png` ＋ 記事ごとの title/description を
> 設定し、記事数が増えてから Satori を足せば十分。

### コメント

| 名前 | リポジトリ / ライセンス / 活動状況 | 置き換わるもの | コスト | 注意点 |
|---|---|---|---|---|
| **giscus** | [giscus/giscus](https://github.com/giscus/giscus) · MIT · rolling release（**2026-05-26 更新**） | コメント DB・認証・管理画面 | 低 | 投稿者に GitHub アカウントが必要。public repo と GitHub App 設定が必要 |
| **utterances** | [utterance/utterances](https://github.com/utterance/utterances) · MIT · 最終更新 未確認 | コメント DB・認証 | 低 | giscus よりスレッド管理が弱く、活動状況も弱い |

採用するなら giscus。ただし**個人の学習記録なら、コメント欄を置かない判断も合理的**。

### アクセス解析

| 名前 | リポジトリ / ライセンス / 活動状況 | 置き換わるもの | コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **GoAccess** | [allinurl/goaccess](https://github.com/allinurl/goaccess) · MIT · **v1.11（2026-07-19）** 活発 | CloudFront ログの集計 | 低〜中 | bot 除外と CloudFront ログ形式の設定が必要 |
| **Umami** | [umami-software/umami](https://github.com/umami-software/umami) · MIT · **v3.3.1（2026-08-20）** 非常に活発 | PV、referrer、event、dashboard | **高** | S3 だけでは動かない。Node サーバー＋PostgreSQL の運用が増える |
| **Plausible CE** | [plausible/analytics](https://github.com/plausible/analytics) · **AGPL-3.0** · **v3.2.1（2026-05-15）** | PV、campaign、goal | **高** | Docker + PostgreSQL + ClickHouse。個人サイトには重い |

**既存 AWS 構成を崩さない第一候補**: CloudFront 標準ログを S3 に保存し、GoAccess で定期集計。
訪問イベントが本当に必要になった時点で Umami を検討。

---

## 7. `02.homework` との二重管理を解く

### 結論: submodule は不要

`02.homework` と `03.learning_site` は**すでに同じ Git リポジトリ内**なので、submodule を使う理由がない。
最小の解決は以下。

- submodule に分割**しない**
- `works/` に成果物ソースを**コミットしない**
- **ビルド時に正本 `02.homework` から `dist/works` へコピーする**

```
02.homework/01.week1/linux/** → dist/works/linux-story-quest/**
02.homework/01.week1/git/**   → dist/works/git-dungeon/**
```

| 名前 | リポジトリ / ライセンス / 活動状況 | 置き換わるもの | コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **vite-plugin-static-copy** | [sapphi-red/vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy) · MIT · **v4.1.1（2026-06 頃）** 活発 | `works/` への手動コピー | 低 | **これが第一推奨**。Windows ではパス normalize が必要 |
| **Astro/Vite `publicDir`** | [vitejs/vite](https://github.com/vitejs/vite) · MIT · 2026 も活発 | 単一作品ディレクトリのコピー | 低 | `publicDir` は基本 1 つ。複数作品・名前変換には不足 |
| **Astro Content Loader `glob()`** | withastro/astro · MIT · v7.2.6 | `02.homework` 側に置いた作品メタデータを一覧へ反映 | 低〜中 | HTML/CSS/JS ディレクトリ自体を公開する機能ではない。**作品説明の一元管理向け** |
| **npm Workspaces** | [npm/cli](https://github.com/npm/cli) · Artistic-2.0 · **npm 12.0.2（2026-07）** | 各作品とサイトの依存・build script 統合 | 低〜中 | Week1 作品は依存ゼロなので、コピー問題だけには不要 |
| **Turborepo** | [vercel/turborepo](https://github.com/vercel/turborepo) · MIT · **v2.10.6（2026-07-22）** | 多数作品の build orchestration | 中 | 作品 2 件には**過剰** |
| **Nx** | [nrwl/nx](https://github.com/nrwl/nx) · MIT · **v23.0.2（2026-07-10）** | 大規模 monorepo | 高 | この個人リポジトリには**明確に過剰** |
| **Git submodule** | git · GPL-2.0-only · Git 2.55 系 | 別リポジトリ間の固定参照 | 中〜高 | **同一リポジトリなので不採用**。clone 初期化と pointer 更新という別の手作業が増える |

> 将来ゲームを独立リポジトリとして公開するときにだけ、submodule か CI での checkout を再検討する。

---

## 8. 自作を続けたほうがよい領域

置き換えないほうがよいもの:

- **ヴィクトリア朝テーマの CSS** — サイト固有の価値。既製テーマへ置き換える必要がない。
- **記事本文と図解** — Markdown に移しても内容・語り口・挿絵はそのまま残す。
- **小さな Astro コンポーネント** — `Header.astro` / `Footer.astro` / `CaseCard.astro` 程度は
  自作したほうが HTML/CSS の学習になる。
- **frontmatter の項目設計** — ライブラリではなく、自分の公開方針に合わせて小さく保つ。
- **リンクカードの見た目** — OGP 取得は OSS に任せても、テーマに合わせた CSS は自作が適切。

逆に**絶対に自作しない**領域: Markdown パーサ、検索索引、画像エンコーダ、RSS XML、sitemap、
コードハイライト。

---

## 9. 移行プラン（現行サイトを止めずに 8 ステップ）

1. **現状を固定し、URL を記録する**
   いまの HTML 一式を「動く基準版」とし、記事・作品・画像の URL 一覧を作る。
   初期は `build.format: "file"` を使い、`case-01-domain-https.html` 等の既存 URL を維持する。

2. **同じディレクトリに Astro を導入する**
   `src/` と `public/` を追加し、既存 HTML は**削除せず残す**。
   `assets/style.css`・画像・作品をまず passthrough して、生成前後の外観を比較する。

3. **共通レイアウトだけ先に部品化する**
   `BaseLayout.astro` / `Header.astro` / `Nav.astro` / `Footer.astro` を作り、
   まず `about` と index だけ Astro 化。**HTML タグと CSS class 名は変更しない**。

4. **新規記事を Content Collection へ移す**
   `posts` collection と frontmatter schema を定義し、**新しい記事から** Markdown で書く。
   index のカード・タグページ・日付・説明は `getCollection()` から自動生成する。
   → ここで「新記事のたびに index.html を手編集する」運用が消える。

5. **既存記事を 1 本ずつ Markdown 化する**
   一度に書き直さない。まず Markdown 内へ既存 HTML をそのまま置いて動作確認し、
   見出し・段落・リストから順に Markdown 記法へ置換する。**slug は変えない**。

6. **検索・RSS・sitemap・画像処理を追加する**
   Shiki は Astro 標準設定。Pagefind は `astro build` の後に実行。
   記事画像を順次 `src/assets` へ移し、`<Picture>` で WebP/PNG を生成。
   → **ここで 69 MB の画像問題が解消する**。

7. **作品の正本を `02.homework` に一本化する**
   `03.learning_site/works` の重複コピーを参照しない構成へ変え、
   `vite-plugin-static-copy` で `02.homework` から `dist/works` を生成。
   リンク切れ検査を通してから、追跡済みの重複ファイルを削除する。

8. **CI を Astro 成果物へ切り替える**
   GitHub Actions を `npm ci → astro build → pagefind → リンク検査 → dist を S3 同期` に。
   旧 HTML と新出力を比較できる期間を設け、CloudFront 上の URL 維持を確認してから
   旧ソースを段階的に整理する。

どの段階でも現行サイトを公開し続けられ、既存 HTML・CSS・作品を一括廃棄せずに移行できる。
