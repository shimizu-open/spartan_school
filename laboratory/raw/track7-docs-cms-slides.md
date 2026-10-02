# 第2ラウンド調査：学習サイトの別解・コンテンツ運用・学習リソース

調査日：2026-08-25

結論から言うと、`03.learning_site` は **B: Starlightへ載せ替える案**を推します。  
現在の記事はブログというより、章立てされた連続学習教材です。StarlightならAstroの画像処理・自由なページ制作を残しつつ、目次、サイドバー、検索、前後リンク、i18nを自作せずに得られます。

なお、実行環境が読み取り専用だったため、`laboratory/` へのMarkdown保存はできませんでした。以下がそのまま保存可能な完成稿です。

## 0. 現状確認

`03.learning_site` は次の構成でした。

- HTML：1,115行
- 共通CSS：303行
- 記事：4本
- 記事用PNG：19枚
- ヘッダー、グローバルナビ、フッター、記事前後リンクを各HTMLで重複管理

具体的には、各記事のヘッダー・ナビが [case-00-s3-cloudfront.html:11](/home/shimizu/study/spartan_school/03.learning_site/articles/case-00-s3-cloudfront.html:11)、記事前後リンクが [case-00-s3-cloudfront.html:163](/home/shimizu/study/spartan_school/03.learning_site/articles/case-00-s3-cloudfront.html:163) にあります。これはStarlightのレイアウト、サイドバー、ページャーで置き換えられます。

ヴィクトリア朝テーマは [style.css:5](/home/shimizu/study/spartan_school/03.learning_site/assets/style.css:5) の色・フォント変数と、[style.css:187](/home/shimizu/study/spartan_school/03.learning_site/assets/style.css:187) 以降の記事装飾をStarlightのカスタムCSSへ移植できます。

---

## 1. ドキュメント／ナレッジ系フレームワーク

### 1.1 候補比較

| 名前 | 一行説明 | リポジトリ・ライセンス | 活動状況 | このケースで置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|---|---|
| **Starlight** | Astro公式のドキュメント用ツールキット | [withastro/starlight](https://github.com/withastro/starlight)・MIT | 活発。0.39系を2026年5月に確認 | 記事HTML、目次、サイドバー、検索、前後リンク、i18n UI | **中** | 既存デザインの完全再現にはCSS変数・コンポーネントoverrideが必要 |
| **VitePress** | Vite＋Vueの高速なドキュメントSSG | [vuejs/vitepress](https://github.com/vuejs/vitepress)・MIT | 活発。v2.0.0-alpha.19を2026-08-02に公開 | 記事、ナビ、目次、前後リンク、ローカル検索 | 中 | v2はまだalpha。Vue依存を新たに持つ |
| **Docusaurus** | バージョニング・i18n・文書群管理に強いReact系フレームワーク | [facebook/docusaurus](https://github.com/facebook/docusaurus)・MIT、公式文書はCC BY 4.0 | 活発。v3.10.2、2026-07-10 | 記事、文書バージョン、サイドバー、i18n | 高 | React、設定量、クライアントJSが個人4記事には重い |
| **mdBook** | Rust製の「本」を作るMarkdownジェネレータ | [rust-lang/mdBook](https://github.com/rust-lang/mdBook)・MPL-2.0 | 活発。v0.5.3を2026年5月に確認 | 章順、目次、前後移動、印刷向け教材 | 中 | Rustバイナリ追加。ポートフォリオやカード型トップページは不得手 |
| **Nextra** | Next.js上のドキュメント・ブログテーマ | [shuding/nextra](https://github.com/shuding/nextra)・MIT | v4.6.1、2025-12-04。2026年も保守活動あり | Markdown記事、目次、検索、Reactコンポーネント | 高 | Next.js＋Reactは現在の静的S3サイトには過剰 |
| **Docsify** | ビルドせずブラウザでMarkdownを読み込む文書サイト | [docsifyjs/docsify](https://github.com/docsifyjs/docsify)・MIT | v5系列の開発が2026年も活発。最新安定版日時は未確認 | HTML生成作業、サイドバー、クライアント検索 | 低 | 初回表示にJS必須で、生成済みHTMLを持たない。SEO、障害耐性、印刷に不利 |
| **Material for MkDocs** | Python MkDocs向けの高機能文書テーマ | [squidfunk/mkdocs-material](https://github.com/squidfunk/mkdocs-material)・MIT | v9.7.7、2026-07-17。ただし新機能はfeature freeze | 記事、目次、検索、タブ、注釈、前後リンク | 中 | Python環境追加。MkDocs 2非互換問題から後継基盤へ移行中 |
| **Quartz** | Markdownのリンク・バックリンク・グラフを公開するデジタルガーデン | [jackyzha0/quartz](https://github.com/jackyzha0/quartz)・MIT | 第1ラウンド参照 | TIL、相互リンク、知識グラフ | 中 | 順番に読む教材より、断片ノートの探索に向く |

Material for MkDocsは現在もバグ・脆弱性修正が続いていますが、作者は上流MkDocsとの技術的問題から新機能を凍結したと説明しています。新規採用ではこの移行リスクを考慮すべきです。[作者による状況説明](https://github.com/squidfunk/mkdocs-material/discussions/8461)

### 1.2 日本語全文検索

| フレームワーク | 標準検索 | 日本語の扱い |
|---|---|---|
| Starlight | Pagefind | **良好**。ビルド時索引＋ブラウザ側CJK分割。追加サーバー不要 |
| VitePress | MiniSearch | UIは標準搭載。ただしMiniSearch標準の空白中心トークナイズでは、日本語複合語の検索精度を要検証。`tokenize`/`processTerm`の調整余地あり |
| Docusaurus | Algolia DocSearchが公式第一選択 | 日本語索引はAlgolia設定に依存。ローカル検索はコミュニティプラグインで、公式標準ではない。[検索方式](https://docusaurus.io/docs/next/search) |
| mdBook | elasticlunr | 英語・空白区切り中心。標準状態で日本語形態素解析は期待しにくい |
| Nextra | Pagefind | **良好**。静的export後にPagefind索引を生成 |
| Docsify | search plugin＋IndexedDB | 多言語UIは設定可能だが、日本語分割の公式保証は確認できず。[検索プラグイン](https://github.com/docsifyjs/docsify/blob/develop/docs/plugins.md) |
| Material for MkDocs | Lunr＋lunr-languages | `lang: ja`を公式サポート。日本語はクライアント側で分割される。[検索仕様](https://github.com/squidfunk/mkdocs-material/blob/master/docs/plugins/search.md) |
| Quartz | 第1ラウンド参照 | 既存調査の検索評価を再利用 |

日本語サイトでは、追加設定なしでPagefindを使えるStarlightが最も安全です。

### 1.3 ブログSSGか、文書フレームワークか

現在の4記事は、単発の時系列ブログより以下の性質が強くあります。

- Case No.0～3の読む順番がある
- 1記事に複数の章がある
- AWS用語を後から参照する
- 章目次、現在位置、前後移動が有用
- 今後 `STUDY.md` や授業ノートを統合できる

したがって記事部分はドキュメントフレームワーク向きです。一方、[index.html:32](/home/shimizu/study/spartan_school/03.learning_site/index.html:32) のCase Filesと [index.html:103](/home/shimizu/study/spartan_school/03.learning_site/index.html:103) のExhibitionはポートフォリオ的です。

最適解は、**Astroプロジェクト内でStarlightを使い、トップ・About・Worksだけ通常のAstroページにする構成**です。

---

## 2. GitベースCMS

### 2.1 候補比較

| 名前 | 一行説明 | リポジトリ・ライセンス | 活動状況 | 置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|---|---|
| **Sveltia CMS** | Decap互換設定を使える、モダンなGitベースCMS | [sveltia/sveltia-cms](https://github.com/sveltia/sveltia-cms)・MIT | 非常に活発。v0.187.0、2026-08-11 | HTML/Markdown直接編集、画像追加、frontmatter編集 | **低～中** | GitHub OAuthには別の認証Workerが必要。PATはlocalStorage保存 |
| **Decap CMS** | 旧Netlify CMS。`/admin`からGitへコミットするCMS | [decaporg/decap-cms](https://github.com/decaporg/decap-cms)・MIT | 再活性化。v3.12.2、2026-04-17 | 記事・画像の直接編集 | 中 | 過去に停滞期間あり。未回答issueや旧設計の負債が多い |
| **Keystatic** | Markdown/YAMLを直接扱うTypeScript CMS | [Thinkmill/keystatic](https://github.com/Thinkmill/keystatic)・MIT | 2026年も保守議論あり。最新releaseは未確認。公式READMEはexperimental表記 | Markdown、画像、構造化フィールド | 中～高 | GitHub modeはアプリ側ルートを要し、純粋なS3静的配信と相性が悪い |
| **TinaCMS** | 視覚編集とGraphQLデータ層を持つGit-backed CMS | [tinacms/tinacms](https://github.com/tinacms/tinacms)・Apache-2.0、一部データ層は別ライセンス | 活発。3.11系を2026年7月に確認 | Markdown編集、リアルタイムプレビュー、メディア管理 | 高 | TinaCloudまたはデータ層・認証の運用が必要。個人4記事には過剰 |
| **Pages CMS** | GitHub Appでリポジトリ内ファイルを編集するCMS | [hunvreus/pagescms](https://github.com/hunvreus/pagescms)・MIT | 活発。2026年も継続更新。最新release日時は未確認 | Markdown、メディア、frontmatter | 低（hosted）／高（self-host） | hosted版への信頼が必要。self-hostはPostgreSQL、GitHub App、秘密鍵が必要 |
| **Static CMS** | Decap停滞期に作られたフォーク | [StaticJsCMS/static-cms](https://github.com/StaticJsCMS/static-cms)・MIT | **2024-09-09にarchive、開発終了** | Decap相当 | 低 | 採用不可。作者自身がDecap復活と他候補を理由に終了を明記 |

Decapは「放棄されたまま」ではありません。2026年にもリリースされており、公開プロセスも整備されています。ただし、Sveltia側がDecap互換性を保ちながらUI、モバイル対応、i18n、性能を改善しているため、新規採用ではSveltiaが上です。

### 2.2 S3＋CloudFront／Cloudflare Pagesで使えるか

| CMS | S3＋CloudFront | Cloudflare Pages | GitHub認証 |
|---|---|---|---|
| Sveltia | `/admin/index.html`を配置可能 | 配置可能 | 個人ならfine-grained PAT。OAuthなら[Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth)をCloudflare Workerへ |
| Decap | 管理SPA自体は配置可能 | 配置可能 | GitHub OAuth用サーバー、Lambda、Worker等が必要 |
| Keystatic | local modeは可。公開GitHub modeは静的S3だけでは不足 | Functions等を併用 | GitHub App／Keystatic Cloud |
| TinaCMS | 生成サイトは配置可能 | 配置可能 | TinaCloudまたはself-hosted backend |
| Pages CMS | hosted版からS3サイトのGit repoを編集可能 | 同様 | hosted GitHub App。self-hostはGitHub App＋PostgreSQL |

重要なのは、CMSがS3へ直接書くのではなく、通常は次の経路になることです。

```text
ブラウザのCMS
  → GitHub APIへMarkdown/画像をcommit
  → GitHub ActionsまたはCloudflare Pagesがbuild
  → distをS3/CloudFrontまたはPagesへ配信
```

S3はOAuthのclient secretを安全に保持できません。Sveltiaの公式文書も、個人・少人数ならPAT、複数編集者ならCloudflare Worker上のOAuthクライアントを推奨しています。[GitHub認証方式](https://sveltiacms.app/en/docs/backends/github)

### 第一推奨

**Sveltia CMS**です。

StarlightのMarkdownをそのまま編集でき、既存GitHub Actions＋S3デプロイを変えずに済みます。ただし本人しか編集しない現在は、CMS自体を急いで導入せず、まずMarkdown＋VS Codeで運用しても十分です。CMSは「スマホから更新したい」「Gitを知らない編集者が加わる」段階で導入するのが妥当です。

---

## 3. 発表・スライド

[PRESENTATION.md](/home/shimizu/study/spartan_school/02.homework/05.week5/docs/PRESENTATION.md:1) はすでにMarkdownで、`---` による6区切りがあります。発表用ツールへ移す前提がほぼ整っています。

### 3.1 候補比較

| 名前 | 一行説明 | リポジトリ・ライセンス | 活動状況 | Markdown／PDF／静的配信 | 置き換わるもの・コスト・注意点 |
|---|---|---|---|---|---|
| **Marp CLI** | MarkdownをHTML/PDF/PPTX/画像へ変換 | [marp-team/marp-cli](https://github.com/marp-team/marp-cli)・MIT | v4.5.0、2026-07-17 | 全対応 | `PRESENTATION.md`をほぼそのまま利用。**低コスト**。複雑なインタラクションは弱い |
| **Marp for VS Code** | エディタ内プレビュー・書き出し | [marp-team/marp-vscode](https://github.com/marp-team/marp-vscode)・MIT | v3.5.1、2026年5月を確認 | Markdown、PDF等 | VS Code利用者には最短。CLIと併用可能 |
| **Slidev** | Vue/Viteベースの開発者向け対話型スライド | [slidevjs/slidev](https://github.com/slidevjs/slidev)・MIT | v52.15.2、2026-05-10。ソースは52.19系まで進行 | Markdown、PDF/PNG/PPTX、静的SPA | ライブコード、Mermaid、発表者画面。**中コスト**。依存が大きい |
| **reveal.js** | 高機能なHTMLプレゼンテーション基盤 | [hakimel/reveal.js](https://github.com/hakimel/reveal.js)・MIT | v6.0.1、2026-04-11 | Markdown plugin、PDF、静的配信 | ネストスライド・アニメーション。中コスト。HTML設定が増える |
| **Spectacle** | React JSXで作るプレゼンテーション | [FormidableLabs/spectacle](https://github.com/FormidableLabs/spectacle)・MIT | 公式にActive表記。最新release日時は未確認 | React中心。PDFはブラウザ印刷系 | Reactライブデモ向け。Markdown中心の本件には高コスト |
| **remark slideshow** | ブラウザ上でMarkdownをスライド化する旧来のツール | [gnab/remark](https://github.com/gnab/remark)・MIT | 最新release時期未確認、近年の活発な保守を確認できず | Markdown、静的HTML、印刷PDF | 軽量だが保守状況が弱い。`remark`処理系との名称衝突にも注意 |

### 3.2 日本語フォント

全候補ともCSSで日本語フォントを指定できます。PDFで文字化けや代替フォントへの置換を防ぐには、Webフォントを外部CDNへ依存せず、ローカル配布して明示します。

```css
@font-face {
  font-family: "Presentation JP";
  src: url("./fonts/subset.woff2") format("woff2");
  font-display: swap;
}

section {
  font-family: "Presentation JP", "Yu Gothic", "Hiragino Sans", sans-serif;
}
```

Marp/SlidevのPDF生成はブラウザレンダリングなので、CI環境にも同じフォントを用意する必要があります。

### 3.3 現行ファイルの移行

`PRESENTATION.md` の区切りはすでにスライド単位として使えます。

- 1～5行：タイトル
- 8～20行：目的・利用者
- 24～47行：HTML/CSS/JS
- 51～69行：データフロー
- 73～88行：Tailwind
- 92～105行：AWS配信
- 109～117行：まとめ

ただし1区切りの情報量が多いので、Marpでは表や画像を含む部分をさらに分割し、10～14枚程度にするのが読みやすいでしょう。

### 3.4 学習サイトへの埋め込み

第一推奨は次の二段構えです。

1. MarpでHTMLとPDFを生成し、`/slides/kakera/` と `/slides/kakera.pdf` に配置
2. 記事内にはサムネイル＋「スライドを開く」「PDF」のリンクを置く

インライン表示が本当に必要なときだけ、同一オリジンのiframeを使います。

```html
<iframe
  src="/slides/kakera/"
  title="かけら 発表スライド"
  loading="lazy"
  allowfullscreen>
</iframe>
<p><a href="/slides/kakera/">スライドを単独で開く</a></p>
```

CSPで `frame-ancestors 'none'` を返している場合はiframe表示できません。スライドだけ`frame-ancestors 'self'`へ変更するか、単独リンク方式にします。

### 第一推奨

**Marp CLI＋Marp for VS Code**です。

現行Markdownを最小変更で使え、HTML・PDF・PPTXをGitHub Actionsで同時生成できます。Slidevはライブコードや操作可能なデモが必要になってから追加すれば十分です。

---

## 4. 学習リソースそのもの

### 4.1 カリキュラム・公式教材

| 名前 | 一行説明 | リポジトリ／ライセンス | 活動状況 | このケースで置き換わるもの | コスト・注意点 |
|---|---|---|---|---|---|
| **roadmap.sh** | 分野別ロードマップと学習項目集 | [developer-roadmap](https://github.com/kamranahmedse/developer-roadmap)・サイトコンテンツ再配布禁止 | 活発 | 自作の学習順序表 | 無料。**リンクのみ**。内容の転載・再配布不可。[公式条件](https://roadmap.sh/about/) |
| **The Odin Project** | プロジェクト中心のWeb開発カリキュラム | [TheOdinProject/curriculum](https://github.com/TheOdinProject/curriculum)・教材CC BY-NC-SA、サイトコードMIT | 活発、2026年も多数更新 | HTML/CSS/JSの自作課題設計 | 無料。表示・改変時は帰属、非営利、同一条件 |
| **freeCodeCamp** | 演習・認定付きの大規模プログラミング教材 | [freeCodeCamp/freeCodeCamp](https://github.com/freeCodeCamp/freeCodeCamp)・コードBSD-3-Clause、教材CC BY-SA 4.0 | 活発 | 基礎問題、演習判定環境 | 無料。教材引用は帰属＋同一条件 |
| **MDN Learn** | Web標準に基づくHTML/CSS/JS教材 | [mdn/content](https://github.com/mdn/content)・文書CC BY-SA 2.5-or-later、近年のコード例CC0 | 活発 | 自作文法解説・APIリファレンス | 日本語あり。記事転載は出典・ライセンス・変更点を明記。[公式条件](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Attrib_copyright_license) |
| **web.dev** | GoogleによるWeb性能・UX・アクセシビリティ教材 | [GoogleChrome/web.dev](https://github.com/GoogleChrome/web.dev)・記事CC BY 4.0、サンプルApache-2.0が基本 | 公式サイトは継続更新。repo最新releaseは未確認 | 性能・PWA・アクセシビリティ解説 | 帰属表示。ページ個別表記があればそちらを優先 |
| **Full Stack Open** | React、Node、DB、GraphQL等の大学公開講座 | [fullstack-hy2020/fullstack-hy2020.github.io](https://github.com/fullstack-hy2020/fullstack-hy2020.github.io)・CC BY-NC-SA 3.0 | 活発。2026-07にも更新 | フルスタック課題設計 | 日本語版あり。非営利・帰属・同一条件 |

### 4.2 プロジェクト集・CS知識

| 名前 | 一行説明 | リポジトリ／ライセンス | 活動状況 | 置き換わるもの | コスト・注意点 |
|---|---|---|---|---|---|
| **build-your-own-x** | DB、Git、Docker等を自作して学ぶリンク集 | [codecrafters-io/build-your-own-x](https://github.com/codecrafters-io/build-your-own-x)・CC0 | 継続保守、最新release時期は未確認 | 次に作る題材の発案 | リスト自体は自由利用。リンク先教材のライセンスは別 |
| **Project Based Learning** | 言語別のプロジェクト教材集 | [practical-tutorials/project-based-learning](https://github.com/practical-tutorials/project-based-learning)・MIT | 継続更新。最新release時期は未確認 | 課題アイデア作成 | リストのMITはリンク先本文には波及しない |
| **System Design Primer** | システム設計の概念・面接問題集 | [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer)・CC BY 4.0 | 2026年も更新を確認、releaseなし | AWS構成理解の次段階 | 転載・翻訳時は作者、URL、ライセンス、変更点を表示 |
| **Awesome** | 分野別awesomeリストの公式索引 | [sindresorhus/awesome](https://github.com/sindresorhus/awesome)・CC0-1.0 | 活発 | OSS探索の入口 | リストのCC0は各リンク先には適用されない |
| **Every Programmer Should Know** | 開発者向け基礎知識の索引 | [mtdvio/every-programmer-should-know](https://github.com/mtdvio/every-programmer-should-know)・CC BY 4.0 | 保守継続、releaseなし | 学習漏れチェック | リスト転載は帰属。リンク先は別ライセンス |
| **Teach Yourself CS** | 独学者向けCS基礎科目ロードマップ | [teachyourselfcs.com](https://teachyourselfcs.com/)・公式repo未確認、コンテンツライセンス未確認 | サイト現存。最終更新時期は未確認 | CS基礎の学習順序 | **リンクとして利用**。本文や図の転載は許諾がない限り避ける |

### 4.3 AWS学習

| 名前 | 一行説明 | リポジトリ／ライセンス | 活動状況 | 置き換わるもの | コスト・注意点 |
|---|---|---|---|---|---|
| **AWS Skill Builder無料枠** | AWS公式の無料デジタル教材・学習パス | OSS repoなし・AWS独自著作物 | 継続提供。公式ページは1,000以上の無料リソースを案内 | AWS基礎解説の自作 | 無料枠と有料ラボが混在。教材転載不可、リンクと自分の理解による要約に留める。[公式案内](https://aws.amazon.com/training/digital/) |
| **aws-samples** | AWS公式サンプルコード群 | [aws-samples](https://github.com/aws-samples)・repoごとにMIT-0/MIT/Apache-2.0等 | 非常に活発、2026年も日次更新 | IaCや構成例のゼロからの手書き | 必ず個別repoのLICENSE確認。サンプルは非サポートで、本番前に安全性・コストを再検証 |
| **Cloud Resume Challenge** | 履歴書サイトを題材にAWS・CI・API・IaCを一周する課題 | [cloudresumechallenge/projects](https://github.com/cloudresumechallenge/projects)・MIT | 継続保守、新課題追加あり | 次のAWS総合課題の設計 | 実AWS料金に注意。現在の学習サイトを課題成果物へ発展可能 |

### 推奨する使い分け

- Web基礎：MDN Learnを正本にする
- 総合カリキュラム：The Odin ProjectまたはFull Stack Open
- AWS：Skill Builderで概念 → `aws-samples`で実装確認 → Cloud Resume Challengeで統合
- 自作記事：教材の複製ではなく「自分が誤解した点」「実際に構築して分かった点」を書く
- roadmap.sh：進捗表をコピーせず、リンクと自分用チェックリストだけ作る

### 引用時の最低ルール

```text
タイトル
著者・プロジェクト名
元URL
ライセンス名とURL
原文か翻訳・要約・改変か
変更した場合は変更内容
```

MITやApache-2.0は主にソフトウェアライセンスであり、リンク先記事の転載許可を自動的に与えるものではありません。各教材・各画像の個別ライセンスを優先します。

---

## 5. 学習の定着

### 5.1 間隔反復

| 名前 | 一行説明 | リポジトリ・ライセンス | 活動状況 | 置き換わるもの | 採用コスト・注意点 |
|---|---|---|---|---|---|
| **Anki** | 成熟したローカル中心の間隔反復アプリ | [ankitects/anki](https://github.com/ankitects/anki)・AGPL-3.0-or-later | 活発。26.05系列を2026年6月に確認 | 復習機能の自作 | **最小コスト**。まずこれを使う。サイトにSRSを再実装しない |
| **FSRS / ts-fsrs** | 最新世代の復習スケジューラをJS/TSから利用 | [open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)・MIT | 活発。ts-fsrs 5.4.1、binding 0.5.0を2026年6月に確認 | 独自SRSのスケジューリング | 中～高。UI、カード形式、履歴、バックアップは別途必要 |
| **AnkiConnect** | ローカルAnkiをHTTP APIで操作するアドオン | 旧repo：[FooSoft/anki-connect](https://github.com/FooSoft/anki-connect)、現行：[SourceHut](https://git.sr.ht/~foosoft/anki-connect)・ライセンス未確認 | GitHub版は2025年にarchiveしSourceHutへ移転 | MarkdownからAnkiカードを自動生成 | 中。ローカルAPIを外部公開しないこと |
| **Recall** | FSRS＋PWA＋ローカル保存のブラウザSRS | [Madlezz/Recall](https://github.com/Madlezz/Recall)・MIT | v1.2.0、2026年。非常に新しい小規模project | ブラウザSRS自作 | 実験用途。利用実績・移行互換性がまだ弱い |

第一推奨はAnkiです。学習サイト側ではfrontmatterに任意の`anki_tags`や「復習問題」セクションを置き、必要になったらAnkiConnect経由でカード生成する程度で十分です。

`ts-fsrs`を使ってサイト内にSRSを作るのは、SRS実装そのものが学習課題になった場合だけにします。

### 5.2 学習ログ可視化

| 名前 | 一行説明 | リポジトリ・ライセンス | 活動状況 | 置き換わるもの | コスト・注意点 |
|---|---|---|---|---|---|
| **Cal-Heatmap** | GitHub contribution風のカレンダーヒートマップ | [wa0x6e/cal-heatmap](https://github.com/wa0x6e/cal-heatmap)・MIT | 保守継続、最新release日時は未確認 | 学習日データの描画 | 低～中。ロケール・タイムゾーン対応 |
| **github-calendar** | GitHub contributionをサイトへ埋め込むライブラリ | [Bloggify/github-calendar](https://github.com/Bloggify/github-calendar)・MIT | 最新releaseは未確認 | GitHub活動表示 | 学習ログではなくGitHub活動。外部取得・仕様変更依存があるため本件では非推奨 |

「かけら」は連続日数や達成率を意図的に持たない設計です。[PRESENTATION.md:20](/home/shimizu/study/spartan_school/02.homework/05.week5/docs/PRESENTATION.md:20)  
その思想を壊さないよう、ヒートマップを使うなら「連続記録」「未達」を強調せず、月ごとの学習量や扱った分野の分布だけを表示するのがよいでしょう。

### 5.3 Obsidian代替のOSSノート

| 名前 | 一行説明 | リポジトリ・ライセンス | 活動状況 | Markdown互換 | 採用コスト・注意点 |
|---|---|---|---|---|---|
| **Zettlr** | ローカルMarkdown中心のデスクトップ執筆環境 | [Zettlr/Zettlr](https://github.com/Zettlr/Zettlr)・GPL-3.0 | v4.5.0、2026-05-08 | **高い** | Starlightと同じMarkdownフォルダを直接開ける。第一候補 |
| **SilverBullet** | ブラウザで動く自己ホスト型Markdown PKM | [silverbulletmd/silverbullet](https://github.com/silverbulletmd/silverbullet)・MIT | v2.10.0、2026-07-28 | 高い | ローカルサーバーが必要。Luaによる自動化は強力だが学習コストあり |
| **Joplin** | 同期・暗号化・Web Clipperを持つノートアプリ | [laurent22/joplin](https://github.com/laurent22/joplin)・原則AGPL-3.0-or-later | 活発。2026年も継続リリース | エクスポート可能だが内部DB中心 | Starlightのcontentフォルダを直接編集する用途には弱い |

ここでは**Zettlr**を推します。ノートと公開記事の両方を同じMarkdownファイルとして扱え、独自データベースからのexport作業が要りません。

---

## 6. アクセシビリティと読みやすさ

### 6.1 SPA画面切替

推奨パターンは次の順序です。

1. 新しいviewを描画
2. `document.title`を変更
3. `tabindex="-1"`を付けた新しい`h1`へフォーカス
4. ページ上部へスクロール
5. 保存完了など、フォーカス移動では伝わらない状態だけ`aria-live="polite"`で通知

live regionは初期HTMLに空の状態で存在させ、後からテキストを変更します。[MDN aria-live](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live)

現行「かけら」はかなり適切に実装済みです。

- live region：[index.html:35](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/index.html:35)
- 同一文も再通知する処理：[main.js:46](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/app/main.js:46)
- 通常ナビ後の`h1.focus()`：[main.js:126](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/app/main.js:126)

ただし、ブラウザの戻る／進むを扱う`popstate`側は [main.js:194](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/app/main.js:194) で再描画とスクロールだけを行い、見出しへのフォーカス移動がありません。ここは通常の`navigate()`と共通関数化すべきです。また画面ごとの`document.title`更新も追加候補です。

### 6.2 フォーカス管理用OSS

| 名前 | 一行説明 | リポジトリ・ライセンス | 活動状況 | 置き換わるもの | コスト・不採用理由 |
|---|---|---|---|---|---|
| **Oaf Side Effects** | SPAルーティング後のtitle、focus、scroll等をまとめる考え方・ライブラリ | [oaf-project/oaf-side-effects](https://github.com/oaf-project/oaf-side-effects)・MIT | 最終release時期は未確認 | route後の副作用処理 | 小規模な素のJSアプリには依存追加の方が大きい |
| **React Aria / React Spectrum** | React用の包括的アクセシビリティ部品群 | [adobe/react-spectrum](https://github.com/adobe/react-spectrum)・Apache-2.0 | 活発。2026年もrelease継続 | React UIのフォーカス・overlay・live announcer | React専用なので現行には不採用 |

この領域は**自作のままでよい**です。現行処理は数行で明快であり、フレームワーク専用ライブラリを追加する価値がありません。

### 6.3 読み物品質を上げる小さなOSS

| 名前 | 一行説明 | リポジトリ・ライセンス | 活動状況 | 置き換わるもの | コスト・注意点 |
|---|---|---|---|---|---|
| **reading-time** | テキスト量から推定読了時間を計算 | [ngryman/reading-time](https://github.com/ngryman/reading-time)・MIT | 最新release時期は未確認 | カードの手入力読了時間 | 低。日本語は文字数／分を実測して調整した方がよい |
| **Tocbot** | 見出しから目次を生成し、現在章を追従表示 | [tscanlin/tocbot](https://github.com/tscanlin/tocbot)・MIT | 4.32.2を確認、公開日は未確認 | 手動目次、IntersectionObserver実装 | 低。ただしStarlight採用後は不要 |
| **rehype-external-links** | Markdownの外部リンクへ属性や内容を追加 | [rehypejs/rehype-external-links](https://github.com/rehypejs/rehype-external-links)・MIT | v3.0.0、最終publish約3年前 | 外部リンク属性の手作業 | 低。新規タブを強制しない設定が望ましい |

外部サイトであることと、新しいタブを開くことは別です。原則は同じタブで開き、`target="_blank"`が必要な場合だけ視覚アイコンと読み上げ用の「新しいタブで開く」を付けます。[W3C G201](https://www.w3.org/WAI/WCAG21/Techniques/general/G201)

Starlight採用時は目次・章追従・前後リンクが標準で揃うため、Tocbotは導入しません。読了時間だけfrontmatterまたはビルド時処理で追加するのが適切です。

---

## 7. A／B／C最終比較

| 評価軸 | A: Astroで作り直す | B: Starlightに載せる | C: Quartzに載せる |
|---|---|---|---|
| 主用途 | ブログ＋ポートフォリオ | **連続教材＋ナレッジ＋ポートフォリオ** | 相互リンクされたデジタルガーデン |
| 現行デザイン再現 | **最も自由** | CSS・overrideでかなり可能 | テーマ構造との衝突が大きい |
| 記事目次 | 自作または統合 | **標準** | 標準 |
| サイドバー | 自作 | **標準** | 標準 |
| 前後リンク | 自作 | **標準** | 文書構造次第 |
| 日本語検索 | Pagefindを追加 | **Pagefind標準** | 既存Quartz検索 |
| i18n | Astro側で設計 | **標準機能あり** | 主目的ではない |
| 画像19枚 | `astro:assets` | **Astro資産をそのまま利用** | 配置調整が必要 |
| 独自トップ／Works | **最適** | 通常Astroページ併設で対応 | 不得手 |
| Markdown CMS | Sveltiaと相性良好 | **Sveltiaと相性良好** | Markdown編集は可能だがfrontmatter差異に注意 |
| 学習ノート統合 | Content Collectionsを設計 | **sidebarへ自然に追加** | バックリンク中心 |
| 移行量 | 中 | **中** | 中～高 |
| 継続的な自作量 | レイアウト・目次・ナビが残る | **最少** | Quartz流への調整が必要 |
| 中身を理解する学習価値 | 最も高い | Astroを理解しつつ運用品質を確保 | グラフ・Markdown処理の学習向き |
| 本件への適合 | ○ | **◎** | △ |

## 8. 最終推奨

### 第一推奨：B — Starlight

理由は3点です。

1. 現在の記事は「日付順ブログ」ではなく、Case No.0から順番に理解する教材である
2. StarlightはAstro上で動くため、第1ラウンドのAstro資産・画像最適化・S3静的配信の利点を失わない
3. 目次、サイドバー、日本語検索、前後リンクを自作対象から外し、記事内容と図解に時間を使える

推奨構成は次です。

```text
src/
  content/
    docs/
      aws/
        00-s3-cloudfront.md
        01-domain-https.md
        02-subdomain-s3.md
        03-cross-account-subdomain.md
      week5/
        kakera-study.md
  pages/
    index.astro       # Victorian調のトップ
    about.astro
    works.astro
    slides/
public/
  images/
  slides/kakera/
```

移行順は次の通りです。

1. Starlightを最小構成で導入
2. 4記事をHTMLからMarkdownへ変換
3. `style.css`の色・書体・calloutだけカスタムCSSへ移植
4. PNG 19枚をAstro画像処理へ
5. Pagefind日本語検索、サイドバー、前後リンクを確認
6. `PRESENTATION.md`をMarpでHTML/PDF化
7. 必要になった段階でSveltia CMSを追加

Aの素のAstroは、ポートフォリオ表現を最優先するなら依然有力です。CのQuartzは、今後の記事が順序付き教材ではなく大量のTIL・用語ノート・相互リンク中心になった場合に再検討するのが適切です。