# A. 学習記録サイト `03.learning_site` OSS調査

調査日: 2026-08-25  
対象: `/home/shimizu/study/spartan_school/03.learning_site`

## 結論――この人なら Astro

第一推奨は **Astro + Markdown Content Collections + Pagefind + `astro:assets`** です。

AstroコンポーネントはHTMLに近く、現在のヴィクトリア朝CSSと素のJavaScriptをほぼそのまま使えます。一方で、記事一覧・共通レイアウト・frontmatter検証・画像最適化・RSS・sitemapという、今まさに手作業になっている部分は標準機能または公式パッケージへ移せます。Eleventyも有力ですが、画像・型付き記事データ・Markdown周辺を個別に組み立てる量がやや多くなります。

推奨構成は次のとおりです。

```text
Astro 7
├─ Astro Layout / Component
│  └─ 現在の assets/style.css を継続利用
├─ Content Collections
│  ├─ posts: Markdown + frontmatter
│  └─ projects: Markdown + frontmatter
├─ Shiki（Astro標準）
├─ astro:assets / sharp
├─ Pagefind
├─ @astrojs/rss
├─ @astrojs/sitemap
├─ giscus（必要になってから）
└─ vite-plugin-static-copy
   └─ 02.homework の成果物をビルド時だけ dist/works へ収録
```

## 現状確認

実物には記事HTMLが4本、作品が2本あります。

- [index.html](/home/shimizu/study/spartan_school/03.learning_site/index.html) の記事・作品カードは手動更新。
- 各記事と `about.html` にヘッダ、ナビ、フッタが重複。
- [style.css](/home/shimizu/study/spartan_school/03.learning_site/assets/style.css) はテーマ変数と部品別スタイルが整理されており、再利用価値が高い。
- 記事中には18枚以上のPNG図解がある。
- `02.homework/01.week1/{linux,git}` と `03.learning_site/works/{linux-story-quest,git-dungeon}` は同じGitリポジトリ内の別コピー。したがって、このケースでGit submoduleを使う理由はありません。

## 1. SSG比較

### 機能面

| 候補 | HTML/CSS/JSの再利用 | Markdown | 学習コスト | 日本語 |
|---|---|---|---|---|
| Astro | `.astro` のテンプレート部分はほぼHTML。既存CSSと素のJSを直接利用可能 | 標準対応。frontmatter、MDX、型付きContent Collectionsあり | 低〜中 | UTF-8、日本語本文とも問題なし。`lang="ja"` と明示的なASCII slugを推奨 |
| Eleventy | HTMLそのものを入力テンプレートにでき、最も「素のHTML」に近い | 標準対応。Liquid/Nunjucks等も選択可能 | 低 | 問題なし。ただし検索の分かち書きは別途必要 |
| Hugo | HTML/CSSは使えるがGo Templateへ分解する必要がある | 強力。taxonomy、多言語、TOC等が組み込み | 中 | 多言語対応は強い。日本語本文も問題なし |
| Zola | HTMLをTeraテンプレートへ移植 | 標準。taxonomy、TOC、検索索引等が組み込み | 中 | 本文は問題なし。既定slugのASCII化設定には注意 |
| Jekyll | Liquidへ移植。GitHub Pagesとの相性がよい | 標準 | 中。Ruby環境が追加される | 問題なし。日本語URLより明示slugが安全 |
| Next.js static export | JSX/Reactへ書き換える必要がある | MDXは可能だが追加構成が多い | 高 | 表示上は問題なし |


### 保守状況・採否

| 名前／一行説明 | Repository・ライセンス・活動状況 | このケースで置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **Astro**／コンテンツ中心サイト向けの静的Webフレームワーク | [withastro/astro](https://github.com/withastro/astro)、MIT。npm安定版 **7.2.6、2026-08-25公開**で非常に活発。[MarkdownとContent Collections](https://docs.astro.build/en/guides/markdown-content/)も公式機能 | 共通レイアウト、記事一覧、タグ、frontmatter検証、画像、コード表示、静的ビルド | 低〜中 | メジャー更新が速い。テーマを大幅改造すると追従コストが生じる |
| **Eleventy (11ty)**／HTMLを中心に複数テンプレート形式を扱う小さなSSG | [11ty/eleventy](https://github.com/11ty/eleventy)、MIT。安定版 **3.1.6、2026年5月頃**、4.0 alphaも継続中で活発 | レイアウト重複、Markdown記事、一覧生成、任意ディレクトリのpassthrough copy | 低 | 最も素のHTMLに近い対抗候補。ただし画像、検索、SEOを個別に選ぶ必要がある |
| **Hugo**／高速な単一バイナリ型SSG | [gohugoio/hugo](https://github.com/gohugoio/hugo)、Apache-2.0。**v0.165.0、2026-08-12**で非常に活発 | 記事、taxonomy、RSS、sitemap、多言語、画像処理 | 中 | Node/npm中心という本人の前提から外れ、Go Templateの独自知識が増える |
| **Zola**／Rust製で機能を内蔵した単一バイナリSSG | [getzola/zola](https://github.com/getzola/zola)、**EUPL-1.2**。**v0.23.4、2026-08-20**で活発。2026年にライセンス変更あり | Markdown、taxonomy、TOC、feed、sitemap、ハイライト、検索索引 | 中 | Teraテンプレートを新たに学ぶ。v0.23は破壊的変更が大きく、テーマ追従にも注意 |
| **Jekyll**／Ruby製の古典的なブログ向けSSG | [jekyll/jekyll](https://github.com/jekyll/jekyll)、MIT。**v4.4.1、2025-01-29**。保守は続くが他候補よりリリース頻度が低い | Liquidレイアウト、Markdown記事、一覧、feed | 中 | Ruby環境を追加する割に、S3公開ではGitHub Pages統合の利点がない |
| **Next.js static export**／Reactアプリを静的HTMLとして出力 | [vercel/next.js](https://github.com/vercel/next.js)、MIT。**16.3.1、2026年8月**で非常に活発。`output: "export"` は[公式対応](https://nextjs.org/docs/app/getting-started/deploying) | ページ生成、Reactコンポーネント、画像、MDX | 高 | このサイトには過剰。既存HTMLをJSX化し、ReactとNext固有概念を学ぶコストが最大 |

### 判定

1. Astro
2. Eleventy
3. Hugo
4. Zola
5. Jekyll
6. Next.js static export

「HTMLテンプレート機能だけ」が必要ならEleventyもほぼ同点です。しかし、このサイトではPNG図解、記事メタデータ、RSS、OGP、検索まで不足しているため、統合度の高いAstroを上位にします。

## 2. 既製テーマ／スターター

テーマをそのまま採用すると現在の個性が失われます。推奨は、AstroPaperまたはCactusから検索・RSS・OGP等の実装を学び、見た目は現行CSSを残す方式です。

| 名前／一行説明 | Repository・ライセンス・活動状況 | 置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **AstroPaper**／アクセシブルでSEO機能の揃ったブログスターター | [satnaing/astro-paper](https://github.com/satnaing/astro-paper)、MIT。**v6.1.0、2026-06-06**。Astro 6対応、Pagefind、RSS、sitemap、動的OGP、MDXあり | ブログ一覧、タグ、検索、OGP、RSS、SEO | 中 | ポートフォリオは追加実装が必要。Tailwind前提で、現行CSSに戻すほどfork追従が難しくなる |
| **Astro Cactus**／ダーク・ライト対応の多機能ブログスターター | [chrismwilliams/astro-theme-cactus](https://github.com/chrismwilliams/astro-theme-cactus)、MIT。タグ付きreleaseは未確認だが、Astro 6・2026年設定へ更新されており活発 | Pagefind、Satori OGP、RSS、sitemap、MDX、コード表示 | 中 | 機能は非常に近いが、作品コレクションは自分で追加。搭載機能が多く理解量も増える |
| **Dante**／ブログとポートフォリオを兼ねるダーク対応テーマ | [JustGoodUI/dante-astro-theme](https://github.com/JustGoodUI/dante-astro-theme)、GPL-3.0。GitHub releaseなし、**2026-07-21更新** | 記事、作品一覧、タグ、RSS、sitemap、OGP、画像最適化 | 低〜中 | 機能適合は高いがGPL-3.0。デザインを大きく変えるなら完成テーマをforkする利点が薄れる |
| **Astro Portfolio Starter**／MDXブログ付きの軽量ポートフォリオ | [drehimself/astro-portfolio-starter](https://github.com/drehimself/astro-portfolio-starter)、MIT。タグ付きreleaseなし、最終更新日は未確認。Tailwind 4対応版 | 作品一覧、ブログ、タグ、ダークモード、ページング | 低 | 小規模で理解しやすい反面、RSS・sitemap・検索・画像処理は追加が必要 |
| **Astrofy**／ブログ、CV、作品、RSSを備えたポートフォリオ | [manuelernestog/astrofy](https://github.com/manuelernestog/astrofy)、MIT。release時期未確認。現行 `package.json` はAstro 4系のため更新遅れあり | ブログ、作品カード、CV、RSS、sitemap | 中 | Tailwind/DaisyUI依存が増え、Astro本体も古い。不採用寄り |

ダーク系ならCactus、ブログ＋ポートフォリオ完成形ならDanteです。「クラシック／ヴィクトリア朝」にそのまま合う、十分に保守された既製テーマは確認できませんでした。現行CSSを維持するのが最も確実です。

## 3. サイト内検索――日本語分かち書き比較

### 第一推奨: Pagefind

Pagefindは完成後のHTMLを索引化するため、Astroの記事データを検索用JSONへ変換する処理が不要です。v1.5では、索引作成時だけでなく検索語側も `Intl.Segmenter` でCJK分割されるようになりました。`<html lang="ja">` を必ず出力し、`npx pagefind --site dist` をビルド後に実行します。

| 名前／一行説明 | Repository・ライセンス・活動状況 | 日本語対応 | 置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|---|
| **Pagefind**／生成済みHTMLを索引化する静的検索 | [Pagefind/pagefind](https://github.com/Pagefind/pagefind)、MIT。**v1.5.2、2026-04-12**で活発 | 専用extended版とv1.5のCJK `Intl.Segmenter` 対応。日本語UIあり | 本文抽出、索引分割、検索UI | 低 | 開発サーバーだけでは索引が生成されない。production build後の確認が必要 |
| **Lunr.js + lunr-languages**／ブラウザ内全文検索 | [olivernn/lunr.js](https://github.com/olivernn/lunr.js)、MIT。coreは **2.3.9、約6年前**で低活動。拡張の[lunr-languages](https://github.com/MihaiValentin/lunr-languages)は **v1.20.0、2026年5月** | 拡張側に日本語tokenizationあり | 独自検索索引 | 中〜高 | coreが長期間更新されていない。索引JSON生成と読み込み最適化を自分で行う |
| **Fuse.js**／小規模配列向けの曖昧検索 | [krisk/Fuse](https://github.com/krisk/Fuse)、Apache-2.0。**v7.5.0、2026年7月頃**で活発 | v7.4以降、カスタムtokenizerに `Intl.Segmenter("ja")` を指定可能 | タイトル・概要・タグの絞り込み | 中 | 本文全文検索には索引サイズと抽出処理が必要。単純fuzzy検索だけでは日本語長文の順位が不安定 |
| **Orama**／BM25・typo tolerance・facetを備えた検索エンジン | [oramasearch/orama](https://github.com/oramasearch/orama)、Apache-2.0。**v3.1.18、2025-12-19**。開発活動は継続 | `@orama/tokenizers` に日本語専用tokenizer。日本語stemmerはなし | 高機能な検索・フィルタ | 高 | 数本〜数十本の記事には過剰。スキーマ、索引保存、検索UIを設計する必要がある |
| **MiniSearch**／依存ゼロの小型全文検索 | [lucaong/minisearch](https://github.com/lucaong/minisearch)、MIT。**v7.2.0、2025年頃** | 既定は空白・句読点分割。`Intl.Segmenter` を使うカスタムtokenizerが必要 | 軽量な本文・タグ検索 | 中 | 日本語対応を自分で設定し、索引JSONも自作する。Pagefindより作業が多い |

補足として、`Intl.Segmenter` は形態素解析器ではありません。「CloudFront」「S3」「独自ドメイン」など技術語の検索品質は、frontmatterに `searchTerms` や別表記を持たせると改善できます。

## 4. 記事執筆まわり

推奨frontmatterは次の程度に限定します。

```yaml
---
title: "独自ドメインとHTTPSの謎"
description: "Route 53・ACM・CloudFrontを巡る学習記録"
published: 2026-07-01
updated: 2026-07-01
caseNumber: 1
tags: ["AWS", "DNS", "HTTPS"]
slug: "case-01-domain-https"
hero: "./images/01_overview.png"
draft: false
---
```

`slug` は既存URLを維持するためASCIIで明示します。日本語のタイトルやタグはそのままで構いません。

| 名前／一行説明 | Repository・ライセンス・活動状況 | 置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **Astro Markdown + Content Collections**／frontmatterをスキーマ検証できる標準記事機構 | [withastro/astro](https://github.com/withastro/astro)、MIT。Astro 7.2.6、2026-08-25 | 手書き記事HTML、一覧カード、タグ、日付・説明の重複 | 低 | 通常記事はこれを標準にする。既存HTML断片もMarkdown内へ残せる |
| **MDX**／Markdown中にコンポーネントを配置 | [mdx-js/mdx](https://github.com/mdx-js/mdx)、MIT。**v3.1.1、2025-08-29**、2026年にもリポジトリ更新あり | 図解コンポーネント、注意書き、リンクカード等 | 中 | 全記事をMDXにする必要はない。JS式を含められる分、記事がコード化しやすい |
| **remark-gfm**／表、脚注、task list、取り消し線等を追加 | [remarkjs/remark-gfm](https://github.com/remarkjs/remark-gfm)、MIT。**v4.0.1、約2年前**。unified collectiveで保守 | 脚注や表の手書きHTML | 低 | Astroで必要なGFM機能だけ追加。脚注は日本語ラベルのアクセシビリティを確認 |
| **remark-toc**／Markdown内へ目次リストを生成 | [remarkjs/remark-toc](https://github.com/remarkjs/remark-toc)、MIT。**v9.0.0、約3年前** | 手動TOC | 低 | リリースは古い。Astroの `render()` が返すheadingsからレイアウト側でTOCを作る方が、このケースでは依存が少ない |
| **Shiki**／TextMate grammarによるビルド時コードハイライト | [shikijs/shiki](https://github.com/shikijs/shiki)、MIT。**v4.4.3、2026年8月**で活発 | コードブロックの色付け | ほぼゼロ | Astro標準なので第一推奨。出力HTMLは増えるがクライアントJS不要 |
| **Prism**／クラスを付けて表示する軽量ハイライタ | [PrismJS/prism](https://github.com/PrismJS/prism)、MIT。**v1.30.0、2025-03-10頃** | コードハイライト | 低 | CSSを別途用意。Astro標準Shikiを外してまで選ぶ理由は小さい |
| **remark-link-card-plus**／単独URLをOGPカードへ変換 | [okaryo/remark-link-card-plus](https://github.com/okaryo/remark-link-card-plus)、MIT。2026年時点でNode 22対応、正確な最終release日は未確認 | リンクカードHTMLとOGP取得 | 中 | ビルドが外部サイトの応答に依存する。キャッシュをコミットするか、重要リンクだけMDXコンポーネントへ手入力する方が再現性が高い |

記事の基本はMarkdown、特殊な図解・リンクカードを必要とする記事だけMDXが適切です。目次はAstroの `getHeadings()` / `render()` から生成すれば、`remark-toc` を増やさずに済みます。

## 5. 画像最適化

PNG図解は写真と違い、文字と細線を含みます。元PNGをlossy圧縮で上書きせず、原本を保持してビルド成果物だけWebP/AVIF/最適化PNGに変換する構成が安全です。

| 名前／一行説明 | Repository・ライセンス・活動状況 | 置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **`astro:assets`**／Astro標準の画像・`Picture` API | [withastro/astro](https://github.com/withastro/astro)、MIT。Astro 7.2.6 | responsive画像、width/height、WebP/AVIF生成 | 低 | `public/` の画像は最適化対象外。記事画像を `src/assets` または記事隣接位置へ移す |
| **sharp**／libvipsベースの高速Node画像処理 | [lovell/sharp](https://github.com/lovell/sharp)、Apache-2.0。**v0.35.3、2026年6月頃** | resize、PNG圧縮、WebP/AVIF変換 | 低〜中 | 直接APIを組む必要はなく、通常はAstroの既定画像サービス経由で使う |
| **`@11ty/eleventy-img`**／Eleventy向けresponsive画像生成 | [11ty/image](https://github.com/11ty/image)、MIT。**v7.0.0、2026-07-29** | `picture/srcset`、複数形式、リモート画像キャッシュ | 低〜中 | Eleventy採用時の第一候補。Astroでは使わない |
| **OxiPNG**／PNG/APNGの可逆圧縮CLI | [oxipng/oxipng](https://github.com/oxipng/oxipng)、MIT。**v10.1.1、2026-04-22**で活発 | 原本PNGの無劣化圧縮、不要metadata除去 | 低 | CI時間が増える。原本を一度最適化する用途か、変更画像だけ処理する |
| **pngquant**／パレット削減による非可逆PNG圧縮 | [kornelski/pngquant](https://github.com/kornelski/pngquant)、GPL-3.0または商用ライセンス。公開版の正確な2026年最新releaseは未確認 | PNG容量の大幅削減 | 中 | 図中の文字、グラデーション、細線が劣化し得る。生成物にはライセンスは波及しないが、原本の一括上書きは避ける |
| **Squoosh CLI**／Wasmコーデックを利用する画像CLI | [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh)、Apache-2.0。CLI **v0.7.3、約4年前**で「no longer maintained」 | 手動画像圧縮 | 中 | CLIは明示的に保守終了。不採用。ブラウザ版の単発比較用途に限定 |

推奨順は `astro:assets` → 必要なら原本へOxiPNGです。PNG fallbackを残しつつWebPを配信し、AVIFは図解によって容量・デコード品質を比較して追加します。

## 6. 付帯機能

### RSS・sitemap・OGP

| 名前／一行説明 | Repository・ライセンス・活動状況 | 置き換わるもの | 採用コスト | 注意点 |
|---|---|---|---|---|
| **`@astrojs/rss`**／Astro公式RSS生成ヘルパー | [withastro/astro](https://github.com/withastro/astro)、MIT。Astro 7系列と継続更新 | `rss.xml` の手書き | 低 | `site` URLと公開済み記事だけを渡す。draft除外をテスト |
| **`@astrojs/sitemap`**／Astro公式sitemap生成 | [withastro/astro](https://github.com/withastro/astro)、MIT。公式統合 **3.7系**、継続更新 | `sitemap.xml` | 低 | 作品ゲーム、404、draft等の含有ルールを明示 |
| **Satori**／HTML/CSS風レイアウトをSVGへ変換するOG画像生成器 | [vercel/satori](https://github.com/vercel/satori)、MPL-2.0。**v0.29.0、2026-07-23**で活発 | 記事ごとのOGP画像 | 中 | CSSは一部分だけ対応。日本語フォントデータをビルド時に読み込む必要がある |

OGPは最初から動的生成せず、まず共通 `hero.png` と記事ごとのtitle/descriptionを設定し、記事数が増えてからSatoriを追加しても十分です。

### コメント

| 名前／一行説明 | Repository・ライセンス・活動状況 | 置き換わるもの | 採用コスト | 注意点 |
|---|---|---|---|---|
| **giscus**／GitHub Discussionsを利用するコメントUI | [giscus/giscus](https://github.com/giscus/giscus)、MIT。rolling release方式、**2026-05-26更新** | コメントDB・認証・管理画面 | 低 | 投稿者にGitHubアカウントが必要。public repoとGitHub App設定が必要 |
| **utterances**／GitHub Issuesをコメントとして使う軽量widget | [utterance/utterances](https://github.com/utterance/utterances)、MIT。タグ付き最新release・最終更新日は未確認 | コメントDB・認証 | 低 | Discussionsを使うgiscusよりスレッド管理機能が少なく、活動状況も弱い |

採用するならgiscusです。ただし個人学習記録で反応がまだ少ない段階なら、コメント欄自体を置かない判断も合理的です。

### アクセス解析

| 名前／一行説明 | Repository・ライセンス・活動状況 | 置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **GoAccess**／アクセスログからHTMLレポートを作る解析CLI | [allinurl/goaccess](https://github.com/allinurl/goaccess)、MIT。**v1.11、2026-07-19**で活発 | CloudFrontログの集計 | 低〜中 | リアルタイム利用者行動よりアクセスログ分析向け。bot除外やCloudFrontログ形式の設定が必要 |
| **Umami**／cookie不要のself-host解析 | [umami-software/umami](https://github.com/umami-software/umami)、MIT。**v3.3.1、2026-08-20**で非常に活発 | PV、referrer、event、dashboard | 高 | S3だけでは動かず、NodeサーバーとPostgreSQLの運用が増える |
| **Plausible CE**／privacy-firstなself-host解析 | [plausible/analytics](https://github.com/plausible/analytics)、AGPL-3.0。**v3.2.1、2026-05-15**。CEは年2回程度のrelease | PV、campaign、goal、dashboard | 高 | Docker、PostgreSQL、ClickHouse等の運用が個人サイトには重い。managed版は有料 |

既存AWS構成を崩さない第一候補は、CloudFront標準ログをS3へ保存してGoAccessで定期集計する方式です。訪問イベントが本当に必要になった時点でUmamiを検討します。

## 7. `02.homework` との二重管理解消

### 現状に対する結論

`02.homework` と `03.learning_site` は既に同じGitリポジトリ内です。したがって、

- submoduleへ分割しない
- `works/` に成果物ソースをコミットしない
- ビルド時に正本 `02.homework` から `dist/works` へコピーする

のが最も小さい解決です。

具体的には、Astro/Viteのビルドに `vite-plugin-static-copy` を追加し、次の対応を設定します。

```text
02.homework/01.week1/linux/** → dist/works/linux-story-quest/**
02.homework/01.week1/git/**   → dist/works/git-dungeon/**
```

コピーされるのはビルド成果物だけなので、Git上の二重管理は消えます。

| 名前／一行説明 | Repository・ライセンス・活動状況 | 置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **vite-plugin-static-copy**／任意ディレクトリをVite出力へ収録 | [sapphi-red/vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy)、MIT。**v4.1.1、2026年6月頃**で活発 | `works/` への手動コピー | 低 | コピー元と公開URLの対応表は残る。Windowsではパスnormalizeが必要 |
| **Astro/Vite `publicDir`**／単一の外部ディレクトリをそのまま配信 | [vitejs/vite](https://github.com/vitejs/vite)、MIT。2026年も活発 | 単一作品ディレクトリのコピー | 低 | `publicDir` は基本的に1つ。このケースの複数作品・名前変換には不足 |
| **Astro Content Loader `glob()`**／任意場所のMarkdown/JSON等をcollection化 | [withastro/astro](https://github.com/withastro/astro)、MIT。Astro 7.2.6 | `02.homework` 側に置いた作品メタデータを一覧へ反映 | 低〜中 | HTML/CSS/JSディレクトリそのものを公開する機能ではない。作品説明の一元管理向け |
| **npm Workspaces**／複数Node packageを一つのルートで管理 | [npm/cli](https://github.com/npm/cli)、Artistic-2.0。npm **12.0.2、2026年7月**で活発 | 各作品とサイトの依存・build script統合 | 低〜中 | 現在のWeek 1作品は依存なしなので、コピー問題だけのためには不要 |
| **Turborepo**／monorepoのbuild順序とcacheを管理 | [vercel/turborepo](https://github.com/vercel/turborepo)、MIT。安定版 **v2.10.6、2026-07-22**で活発 | 多数作品のbuild orchestration | 中 | 作品2件には過剰。アプリが複数のnpm packageへ増えてから検討 |
| **Nx**／大規模monorepo向けbuild・dependency graph基盤 | [nrwl/nx](https://github.com/nrwl/nx)、MIT。**v23.0.2、2026-07-10** | 多数アプリ、共有library、affected build | 高 | この個人リポジトリには明確に過剰 |
| **Git submodule**／別Gitリポジトリを特定commitで参照 | [git/git](https://github.com/git/git)、GPL-2.0-only。Git 2.55系列、submodule文書は2.54で2026年更新 | 別リポジトリ間の固定参照 | 中〜高 | 現在は同一リポジトリなので不採用。clone時の初期化やcommit pointer更新という別の手作業が増える |

将来、各ゲームを独立リポジトリに公開する場合にだけsubmoduleまたはCIでのcheckoutを再検討します。

## 自作を続けた方がよい領域

以下は現行資産を維持する価値があります。

- **ヴィクトリア朝テーマのCSS**: サイト固有の価値であり、既製テーマへ置き換える必要がない。
- **記事本文と図解**: Markdownへ移しても内容・語り口・挿絵はそのまま残す。
- **小さなAstroコンポーネント**: `Header.astro`、`Footer.astro`、`CaseCard.astro` 程度は自作した方がHTML/CSSの学習になる。
- **frontmatterの項目設計**: ライブラリではなく、自分の公開方針に合わせて小さく保つ。
- **リンクカードの見た目**: OGP取得はOSSへ任せても、ヴィクトリア朝に合わせたカードCSSは自作が適切。

逆に、Markdownパーサ、検索索引、画像エンコーダ、RSS XML、sitemap、コードハイライトは自作しない方がよい領域です。

## 移行プラン

1. **現状を固定し、URLを記録する**  
   現在のHTML一式をそのまま動く基準版とし、記事・作品・画像URLの一覧を作ります。初期は `build.format: "file"` を使い、既存の `case-01-domain-https.html` 等を維持します。

2. **同じディレクトリへAstroを導入する**  
   `src/` と `public/` を追加し、既存HTMLは削除せず残します。`assets/style.css`、画像、作品をまずpassthroughして、生成前後の外観を比較します。

3. **共通レイアウトだけ先に部品化する**  
   `BaseLayout.astro`、`Header.astro`、`Nav.astro`、`Footer.astro` を作り、まず `about` とindexだけAstro化します。現行HTMLタグとCSS class名は変更しません。

4. **新規記事をContent Collectionへ移す**  
   `posts` collectionとfrontmatter schemaを定義し、新しい記事からMarkdownで書きます。indexのカード、タグページ、日付、説明は `getCollection()` から自動生成します。

5. **既存記事を1本ずつMarkdown化する**  
   既存HTML本文を一度に書き直さず、Markdown内へ既存HTMLをそのまま置いて動作確認し、見出し・段落・リストから順次Markdown記法へ置換します。slugは変えません。

6. **検索・RSS・sitemap・画像処理を追加する**  
   ShikiはAstro標準設定を使い、Pagefindは `astro build` 後に実行します。記事画像を順次 `src/assets` 側へ移し、`Picture` でWebP/PNGを生成します。RSSとsitemapもこの段階で有効化します。

7. **作品の正本を `02.homework` に一本化する**  
   `03.learning_site/works` の重複コピーを参照しない構成へ変更し、`vite-plugin-static-copy` で `02.homework` から `dist/works` へ生成します。生成後にリンク切れテストを行ってから、追跡済みの重複ファイルを削除します。

8. **CIをAstro成果物へ切り替える**  
   GitHub Actionsで `npm ci → astro build → pagefind → リンク検査 → distをS3同期` とします。旧HTMLと新出力を比較できる期間を設け、CloudFront上のURLが維持できた後に旧ソースを段階的に整理します。

この順序なら、途中のどの段階でも現行サイトを公開し続けられ、既存HTML・CSS・作品を一括廃棄せずに移行できます。