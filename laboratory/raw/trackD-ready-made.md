# 第3ラウンド・トラックD調査結果

調査日: 2026-08-25

## 結論

「明日から始める」なら、第一候補は [`btholt/next-course-starter`](https://github.com/btholt/next-course-starter) を fork / clone する。

理由は、今回調べた中で最も素直に次の条件を同時に満たすためである。

- Markdown教材を「セクション → レッスン」として配置できる
- Node.js 20以上で動き、依頼者のNode.js 22環境に合う
- GitHub Pages向けの静的出力とデプロイ設定を含む
- 認証・DB・常時稼働サーバーが不要
- ゲームや習慣アプリを `public/` 以下へそのまま置ける
- コースメタデータを `course.json` に集約できる
- Apache-2.0でforkしやすい
- 実際の公開コースで使用されている

ただし、これはLMSではない。受講登録、サーバー側進捗、採点台帳、証明書は持たない。現在の「利用者は自分ひとり」「既存静的資産を生かす」という段階では、この欠如は欠点ではなく、運用負担を回避する利点である。

公式・長期保守を最優先する第二候補は [`withastro/starlight`](https://github.com/withastro/starlight)。こちらはコース固有モデルを持たないため、教材構造を自分で約束する必要があるが、2026年7月にもリリースされており、保守面ではより堅い。[公式の作成方法](https://starlight.astro.build/getting-started/)はリポジトリ直cloneではなく、次で新規リポジトリを生成する形になる。

```bash
npm create astro@latest -- --template starlight
```

---

## 1. コース・教材サイトのスターター

### 最有力候補

| 名前 | 説明・ドメインモデル | 実在・ライセンス・更新 | 規模・採用コスト・注意点 |
|---|---|---|---|
| **Next Course Starter** | Markdown教材専用スターター。第一級概念は `Course / Author / Section / Lesson`。番号付きディレクトリとMarkdownから順序、URL、目次を生成する。 | [Repository](https://github.com/btholt/next-course-starter) / Apache-2.0。GitHub Releasesなし、最終コミット日は検索結果では未確認。Node 20以上対応で、公開実例としてReactやMCP等のコースが列挙されている。[構成・ライセンス・実例](https://github.com/btholt/next-course-starter) | **小・低コスト・ひとり向け**。`npm install && npm run dev`。静的教材には非常に適合するが、受講者・進捗・採点はない。ブログと作品一覧は追加ページとして作る必要がある。 |
| **Starlight** | Astro公式ドキュメントフレームワーク。第一級概念は `Page / Sidebar group / Heading / Locale`。Cards、Steps、Tabs、Asideなどをレッスン表現に転用できる。 | [Repository](https://github.com/withastro/starlight) / MIT / 2026-07-28に0.41.5。[リリース](https://github.com/withastro/starlight/releases) | **小・低コスト・ひとり向け**。静的配信、アクセシビリティ、検索、モバイル表示が強い。ただし `Course / Lesson / Completion` は存在せず、自分で命名規則を決める必要がある。 |
| **Knowledge Core** | Astroによる教材・ドキュメント複合スターター。第一級概念は `Course / Module / Lesson / Goal / Quiz / Exercise / Progress`。docsアプリとcoursesアプリを分離する。 | [Repository](https://github.com/casoon/knowledge-core) / MIT / Releasesなし。確認時点で19コミット・2 stars。Node 22.12以上、Astro 6、Cloudflare Pages対応。[構成と機能](https://github.com/casoon/knowledge-core) | **中・中コスト**。今回の資産には驚くほど合うが、実績がまだ少なすぎる。RAG、Vectorize、Workers AI、monorepoまで入り、個人の初期段階には過剰。設計見本としては優秀だが第一採用にはしない。 |

### その他の静的教材器

| 名前 | 説明・ドメインモデル | 実在・ライセンス・更新 | 判定 |
|---|---|---|---|
| **withastro/docs** | Astro公式文書サイトそのもの。`Locale / Guide / Reference page / Sidebar / Translation status`を扱う。`src/content/docs`、独自コンポーネント、サイドバー生成、翻訳管理が実例になる。 | [Repository](https://github.com/withastro/docs) / MIT / 12,000超のコミットがあり活発。[リポジトリ構成](https://github.com/withastro/docs) | 大規模公式サイトの参照実装。翻訳・品質管理は参考になるが、fork元としては重すぎる。 |
| **Docusaurus** | `Docs / Category / Version / Locale / Blog post`。初期テンプレート自体に段階式チュートリアルが入り、教材の見本になる。 | [Repository](https://github.com/facebook/docusaurus) / MIT、文書はCC系 / 2026-07-10に3.10.2。[公式リリース](https://github.com/facebook/docusaurus/releases) | **小〜中・低〜中コスト**。ブログと教材の併設には強いがReact依存が増える。自作ゲームを置くだけなら可能だが、Astro/静的HTMLより複雑。 |
| **Material for MkDocs** | `Navigation tree / Page / Tutorial / Tag / Version`。教材はnav内の章・節として扱う。 | [Repository](https://github.com/squidfunk/mkdocs-material) / MIT / 2026-07-17に9.7.7。ただし新機能はfeature freeze、保守修正は継続。[CHANGELOG](https://github.com/squidfunk/mkdocs-material/blob/master/CHANGELOG) | **小・低コスト**。Markdown教材には非常に良い。Python環境を追加する点と、独立したJSアプリの統合がAstroほど自然でない点で次点。 |
| **Jupyter Book** | `Book / Chapter / Notebook / Code cell / Execution output / Citation`。計算結果を再実行・キャッシュして教材化する。 | [Repository](https://github.com/jupyter-book/jupyter-book) / BSD-3-Clause / 2026-05-02にv2.1.5。[公式リポジトリ](https://github.com/jupyter-book/jupyter-book) | **中・中コスト**。Python/R/数式中心の教材には最適。現在のHTML/JSゲームとAWS記事には過剰で、Node中心の運用から外れる。 |
| **Quarto** | `Project / Website or Book / Chapter / Executable document / Citation`。同じ原稿からWeb・PDF・書籍を生成する。 | [Repository](https://github.com/quarto-dev/quarto-cli) / MIT / 2026-05-25に安定版1.9.38。[リリース](https://github.com/quarto-dev/quarto-cli/releases) | **中・中コスト**。授業資料や将来のPDF化には強いが、成果物展示・ゲームサイトには出版機能が勝ちすぎる。 |
| **hugo-book** | `Book section / Page / Taxonomy / Blog entry`。シンプルな本型ナビゲーション。 | [Repository](https://github.com/alex-shpak/hugo-book) / MIT / 最終リリース時期未確認。現在の要件はHugo 0.158以上。[Repository](https://github.com/alex-shpak/hugo-book) | **小・低コスト**。高速で堅いが、今回はNode/JS資産とAstro系の方が接続しやすい。 |
| **Hugo Relearn** | `Page tree / Chapter / Tab / Notice / Resource`。オフラインと`file://`閲覧にも対応する教材・マニュアル型テーマ。 | [Repository](https://github.com/McShelby/hugo-theme-relearn) / MIT / 活発、最新リリース日は今回の検索結果では未確認。[機能一覧](https://github.com/McShelby/hugo-theme-relearn) | **小・低コスト**。閉じた環境の教材には強い。既存Node構成からHugoへ移る動機は薄い。 |
| **mdBook** | `Book / Part / Chapter / Summary order / Code playground`。`SUMMARY.md`が教材の正規順序を表す。 | [Repository](https://github.com/rust-lang/mdBook) / MPL-2.0 / 2026-05-19にv0.5.3。[公式リポジトリ](https://github.com/rust-lang/mdBook) | **小・低コスト**。直線的な技術書には非常に良い。ブログ、作品一覧、複数アプリの器としては狭い。 |
| **Rust Book / Rustlings構成** | Rust Bookは章と実行可能コード、Rustlingsは`Exercise / Hint / Solution / Progress`を第一級概念にする。 | mdBookによる[The Rust Programming Language](https://github.com/rust-lang/book)、Rustlingsは2026-08-21に6.5.0。[リリース](https://github.com/rust-lang/rustlings/releases) | 教材設計の参考になる。ただしRustlingsはCLI演習システムで、Web学習サイトのstarterではない。 |

### Next / Nuxt / SvelteKit系の判定

成熟した公式のNuxt/SvelteKit「コーススターター」は今回の検索では確認できなかった。GitHub上には個人製のLMS cloneが多数あるが、ライセンス不明、数コミット、外部SaaS必須のものが多く、今日forkする対象にはしにくい。

Next.jsでは次の2件を実在確認した。

- **Mux Video Course Starter**  
  名前 / 動画会員制コースのサンプル。  
  リポジトリ / [`muxinc/video-course-starter-kit`](https://github.com/muxinc/video-course-starter-kit)  
  ライセンス / リポジトリにLICENSEを確認できず、**未確認**。  
  更新 / Releasesなし、最終更新日未確認。  
  ドメインモデル / `User / Course / Video / Membership / Playback asset`。  
  規模 / 中。  
  採用コスト / 高。Mux、PlanetScale、Prisma、NextAuthが必要。  
  不採用理由 / 動画が中心で、外部アカウントとDBを増やす。[構成](https://github.com/muxinc/video-course-starter-kit)

- **Sanity Demo Course Platform**  
  名前 / Next.js + Sanityによる多言語コースデモ。  
  リポジトリ / [`sanity-io/demo-course-platform`](https://github.com/sanity-io/demo-course-platform)  
  ライセンス / **未確認**。  
  更新 / 213コミット、最終リリース時期未確認。  
  ドメインモデル / `Course / Lesson / Locale / Localized field`。  
  規模 / 中。  
  採用コスト / 中〜高。Sanityプロジェクトが必要。  
  不採用理由 / 多言語CMSのデモが主目的で、Git管理済みの既存Markdown/HTML資産には遠回り。[Repository](https://github.com/sanity-io/demo-course-platform)

---

## 2. そのまま動く軽量OSSプロダクト

### LMS・演習システム

| 名前 | 説明・ドメインモデル | URL / ライセンス / 更新 | 規模・コスト・判定 |
|---|---|---|---|
| **Frappe Learning** | `Course → Chapter → Lesson`の3層、加えて`Learner / Enrollment / Batch / Quiz / Assignment / Programming exercise / Completion`を持つ。 | [Repository](https://github.com/frappe/lms) / AGPL-3.0 / 2026年7月にも継続リリース。公式README上でも多数のリリースを確認できる。[Repository](https://github.com/frappe/lms) | **中〜大・高コスト**。Frappe Bench、DB、バックアップ、アップデートが必要。最も完成したLMS候補だが、ひとり利用には重い。外部ゲームの汎用iframeブロックは確認できず、標準埋め込みは動画、Google文書、CodeSandbox等。[Lesson types](https://docs.frappe.io/learning/course-creation/adding-a-lesson/adding-simple-content) |
| **CourseLit** | `Course / Lesson / Student / Product / Payment / Sales page / Media`。教材サイトと販売サイトを一体化する。 | [Repository](https://github.com/codelitdev/courselit) / AGPL-3.0 / 最終リリース時期未確認。 | **中〜大・高コスト**。MongoDB、メディアサービス、決済周辺が必要。販売しない現段階では不要なドメインが多い。 |
| **CTFd** | `Challenge / Category / Flag / Hint / Submission / Solve / Score / User or Team / Competition window`。 | [Repository](https://github.com/CTFd/CTFd) / Apache-2.0 / 2026-06-16に3.8.6。[リリース](https://github.com/CTFd/CTFd/releases) | **中・中コスト**。Docker Composeで始められる。Linux/Gitゲームを「解いたらflagを入力する」形式へ変えるなら非常に有力。ただし記事・授業ノート・作品集の母艦にはならない。 |
| **Runestone Academy** | `Book / Course / Section / Assignment / Question / Attempt / Student / Instructor / Analytics`。ActiveCode、CodeLens、自動採点を持つ。 | [Repository](https://github.com/RunestoneInteractive/rs) / MIT。ただし同梱教材・Handsontable等に個別ライセンス例外あり。[ライセンス](https://github.com/RunestoneInteractive/rs/blob/main/LICENSE) / 6.6系ドキュメントが現行。 | **大・高コスト**。Dockerで開発環境は一括構築できるが、本番運用は公式自身が「substantially more complex」としている。[セルフホスト手順](https://docs.runestone.academy/en/latest/running.html) 個人サイトには重すぎる。 |
| **Tutor LMS** | WordPress上の`Course / Topic / Lesson / Quiz / Assignment / Enrollment / Instructor / Order`。 | [Repository](https://github.com/themeum/tutor) / GPL-3.0 / WordPress版4.0.7が2026-08-20。[公式プラグインページ](https://wordpress.org/plugins/tutor/) | **中・中コスト**。GUI運用は強いが、WordPress/PHP/DBの保守が増え、Pro限定機能も多い。既存静的ゲームはリンクまたはiframe頼み。 |
| **LearnPress** | Tutor LMSと同様、WordPress上のコース、レッスン、クイズ、注文を扱う。 | [公式プラグイン](https://wordpress.org/plugins/learnpress/) / GPL互換 / 2026年8月にも更新を確認。GitHubの正規開発リポジトリと最新リリース対応は今回未確認。 | **中・中コスト**。OSSとして利用可能だが、アドオン依存とWordPress運用を増やしてまで採用する利点は薄い。 |

「Wisdom」「Academy」「Lernen」「Course-ware」は同名製品・商用テンプレート・小規模cloneが多く、今回の検索では、ライセンス、正規リポジトリ、継続更新を一貫して確認できる軽量OSSを特定できなかった。名称だけを根拠に候補には入れない。

### ナレッジベース系

| 名前 | ドメインモデル | URL / ライセンス / 更新 | 転用判定 |
|---|---|---|---|
| **Docmost** | `Workspace / Space / Page / Block / Comment / Revision / Permission`。 | [Repository](https://github.com/docmost/docmost) / コアAGPL-3.0、Enterprise部分は別ライセンス / 2026-07-03にv0.95.0。[リリース](https://github.com/docmost/docmost/releases) | **中・中コスト**。授業ノートの共同編集には良いが、学習順序・進捗・演習はない。公開教材サイトより編集用Wiki。 |
| **BookStack** | `Shelf → Book → Chapter → Page`という明快な出版階層。 | [Repository](https://github.com/BookStackApp/BookStack) / MIT / 2026-07-02にv26.05.2。現在の主開発はCodebergへ移行。[リリース](https://github.com/BookStackApp/BookStack/releases) | **中・中コスト**。教材階層としては優秀だがPHP/DBサーバーが必要。ゲームや習慣アプリを第一級教材として扱えない。 |
| **Outline** | `Workspace / Collection / Document / Revision / Member / Permission`。 | [Repository](https://github.com/outline/outline) / **BSL 1.1** / 2026-05-04にv1.7.1。[Repository](https://github.com/outline/outline) | **中〜大・高コスト**。共同ナレッジベースとして高機能だが、OSI系OSSライセンスではなく、学習サイトモデルも持たない。 |
| **Wiki.js** | `Page / Path / Tag / User / Group / Permission / Storage target`。 | [Repository](https://github.com/Requarks/wiki) / AGPL-3.0 / 安定版2.5.314、3.0は開発中。[リリース状況](https://github.com/requarks/wiki-docs/blob/master/releases.md) | **中・中コスト**。知識整理には使えるが、コース・進捗・演習がない。3.0移行途中も注意点。 |

結論として、ナレッジベースは「授業メモを編集する場所」にはなるが、「記事・ゲーム・習慣アプリを統合した公開学習サイト」の器には弱い。

---

## 3. 公開構成を真似できる個人・日本語教材

### 採用価値の高い実例

#### simonw/til

- 名前 / Simon WillisonのTILサイト
- 一行説明 / トピック別ディレクトリに短いMarkdownを蓄積し、検索可能なサイトへ変換する実例
- リポジトリ / [`simonw/til`](https://github.com/simonw/til)
- ライセンス / Apache-2.0
- 活動 / 2026-07-13付の項目を確認、継続更新中
- 規模 / 小、ひとり向け
- 採用コスト / 低
- ドメインモデル / `Topic / TIL entry / Date / Feed`
- 注意点 / コース順序、達成、演習は持たない
- 真似する点 / 週次メモを大作記事にしようとせず、1学習1Markdownで蓄積する構造。[現在581件・構成](https://github.com/simonw/til)

#### サバイバルTypeScript

- 名前 / サバイバルTypeScript
- 一行説明 / 実務志向の日本語TypeScript教材をOSSとして共同執筆する事例
- リポジトリ / [`yytypescript/book`](https://github.com/yytypescript/book)
- ライセンス / CC-BY-SA-4.0等、複数ライセンス表示
- 活動 / GitHub Releases上の最終リリースは2023-07。リポジトリ自体の最終更新日は今回未確認
- 規模 / 中
- 採用コスト / 構成参照なら低、直接forkは内容固有のため不向き
- ドメインモデル / `Learning phase / Chapter / Page / Example / Contribution`
- 真似する点 / 「あらまし → 作って学ぶ → 読んで学ぶ」という学習段階をサイト構造に反映している。[Repository](https://github.com/yytypescript/book)

#### 日本語版 Modern JavaScript Tutorial

- 名前 / 現代のJavaScriptチュートリアル日本語版
- 一行説明 / 記事だけでなく課題と解答を同じ構造で管理する翻訳教材
- リポジトリ / [`javascript-tutorial/ja.javascript.info`](https://github.com/javascript-tutorial/ja.javascript.info)
- ライセンス / リポジトリ独自LICENSE。再利用時は内容条件の個別確認が必要
- 活動 / 2,300超のコミット、最終リリース方式は未確認
- 規模 / 中
- 採用コスト / 構成参照は低
- ドメインモデル / `Section / Article / Task / Solution / Local resource`
- 真似する点 / `task.md`と`solution.md`を分離し、画像・コードを教材のそばに置く。[公式のディレクトリ説明](https://github.com/javascript-tutorial/ja.javascript.info)

#### Rust Book日本語版

- 名前 / The Rust Programming Language日本語版
- 一行説明 / mdBookで公式技術書とコードリストを管理する事例
- リポジトリ / [`rust-lang-ja/book-ja`](https://github.com/rust-lang-ja/book-ja)
- ライセンス / Apache-2.0 OR MIT
- 活動 / 4,400超コミット、最終リリース時期未確認
- 規模 / 中
- 採用コスト / 構成参照は低
- ドメインモデル / `Chapter / Listing / Translation mapping / Book configuration`
- 真似する点 / 本文と実行例を分離し、`book.toml`と`src`を出版の正規情報源にする。[Repository](https://github.com/rust-lang-ja/book-ja)

### OSSと誤認しやすい例

- **りあクト！**  
  GitHubには章別に動くサンプルコードが公開されているが、販売書籍本文そのものを自由にforkできるOSS教材とは確認できなかった。したがって「構成とサンプルの参考」までに留める。[書籍案内とサンプルリポジトリ説明](https://booth.pm/ja/items/2368019)

- **Zenn Bookリポジトリ**  
  `books/<slug>/config.yaml + chapter.md`という運用は参考になるが、GitHubで公開されていることとOSSであることは別である。各著者が明示したLICENSEがないリポジトリを教材fork元にしてはいけない。

- **技術書典系リポジトリ**  
  サンプルコードのみOSS、本文は販売物という構成が多い。リポジトリ単位・ディレクトリ単位でライセンスを確認する必要がある。

日本語事例から抽出できる定石は、「本文」「課題」「解答」「実行例」「画像」を別の第一級要素として管理すること、そして公開リポジトリと再利用可能なOSSを混同しないことである。

---

## 4. 学習ゲームを置く方法

### 第一選択: 同一静的サイト内に独立アプリとして同居

今回のLinux Story Quest、Git Dungeon、「かけら」は、既にブラウザ内で完結する。最初からH5PやLTIへ変換せず、ビルド結果へそのままコピーするのが最小コストである。

```text
public/
└── works/
    ├── linux-story-quest/
    │   ├── index.html
    │   ├── css/
    │   └── js/
    ├── git-dungeon/
    └── kakera/
```

教材ページ側では次の二通りを使う。

- 基本: 「新しいページでゲームを始める」リンク
- 教材の文脈を保ちたい場合: `iframe`で埋め込み

```html
<iframe
  src="/works/linux-story-quest/"
  title="Linux Story Quest"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
></iframe>
```

注意事項:

- ゲーム内URLは相対パスにする
- 各アプリの`localStorage`キーに名前空間を付ける
- iframeと親ページの進捗連携が必要になったら`postMessage`を使う
- 全画面操作やキーボード中心ゲームはiframeより別ページがよい
- CSPの`frame-src`、`frame-ancestors`を明示する
- サイト側の「完了」とゲーム内部の「クリア」は当初分離してよい

### H5P

- 名前 / H5P
- 一行説明 / LMSやCMS間で移植できるインタラクティブ教材パッケージ
- リポジトリ / [`h5p/h5p-php-library`](https://github.com/h5p/h5p-php-library)
- ライセンス / GPL-3.0。個別コンテンツタイプにはMIT等もある
- 活動 / 2026年7月にも複数リポジトリが更新
- 規模 / 中
- 採用コスト / 中〜高
- ドメインモデル / `Content type / Library / Content instance / Dependency / Attempt result`
- 判定 / 既存ゲームをそのまま`.h5p`へ詰める仕組みではない。H5P content typeとしてラッパーを開発する必要があり、現段階ではコスト超過。[コアライブラリ](https://github.com/h5p/h5p-php-library)

### LTI

LTI 1.3は、LMSを`Platform`、外部ゲームを`Tool`として扱い、`Context（ほぼCourse） / User / Role / Resource link / Launch / Result`を交換する標準である。iframe表示自体にも対応するが、OIDC、JWT、OAuth 2.0、HTTPSが必要になる。[LTI 1.3仕様](https://developers.imsglobal.org/spec/lti/v1p3)

現在の静的ゲームにLTIを導入するのは不適切である。必要になるのは次の場合だけでよい。

- 複数受講者をLMSで認証したい
- ゲーム結果をLMSの成績簿へ返したい
- 同じゲームを複数LMSへ提供したい

当面は「同一オリジン配下の独立アプリ」、将来はゲームが`postMessage`で完了イベントを送る、さらに必要になったらサーバー/LTIへ昇格する順序がよい。

---

## 5. OSSから抽出した「学習サイトの設計図」

既存OSSを横断すると、学習サイトには二種類のモデルがある。

### A. 出版モデル

Starlight、Docusaurus、MkDocs、mdBook、Quartoが持つモデル。

```text
Site
├── LearningPath / Book
│   ├── Module / Part / Section
│   │   └── Lesson / Chapter / Page
│   └── Navigation order
├── Article / TIL
├── Asset
└── Tag / Search index
```

必要なルール:

- 教材には明示された順序がある
- 記事には日付・タグがあるが、必ずしも順序はない
- URLは公開後になるべく変更しない
- 画像・コード・ゲームは、それを使う教材から追跡できる
- 下書きと公開済みを区別する
- 前後ナビゲーションとサイト横断検索を持つ

### B. 学習状態モデル

Frappe LMS、Runestone、CTFd、Tutor LMSが追加するモデル。

```text
Learner
├── Enrollment
├── Progress
│   ├── Lesson completion
│   └── Last visited position
└── Attempt
    ├── Activity
    ├── Submitted answer / Evidence
    ├── Result
    └── Feedback
```

必要なルール:

- 完了条件は「閲覧」「自己申告」「クイズ合格」「ゲームクリア」で異なる
- Attemptは何度でも作れるか、回数制限するかを決める
- 進捗と採点は別概念
- ゲームの内部状態とサイト全体の進捗は別ストアにする
- 認証がなければ進捗は端末ローカル
- 認証を入れた時点で、削除、エクスポート、バックアップ、プライバシー対応が必要になる

### 今回必要な最小ドメインモデル

```text
LearningPath
  id, title, description, status

Module
  id, learningPathId, title, order

Lesson
  id, moduleId, title, goals, order, estimatedMinutes

Activity
  id, lessonId, type(article | game | app | exercise | external)
  launchUrl, completionMode

Article
  title, publishedAt, tags, body

Work
  title, description, launchUrl, sourceUrl

LocalProgress
  activityId, state, completedAt, appSpecificData
```

この段階では`User / Enrollment / Payment / Certificate / Instructor`は作らない。将来公開して複数利用者の進捗を保存する段階で追加する。

---

## 6. 既存資産の配置案

`next-course-starter`を採用する場合:

```text
next-course-starter/
├── course.json
├── lessons/
│   ├── 01-web-infrastructure/
│   │   ├── A-aws.md
│   │   ├── B-dns.md
│   │   ├── C-https.md
│   │   └── D-subdomain-delegation.md
│   ├── 02-linux/
│   │   ├── A-linux-basics.md
│   │   └── B-story-quest.md
│   ├── 03-git/
│   │   ├── A-git-basics.md
│   │   └── B-git-dungeon.md
│   └── 04-class-notes/
│       ├── A-week1.md
│       └── ...
├── public/
│   ├── images/
│   └── works/
│       ├── linux-story-quest/
│       ├── git-dungeon/
│       └── kakera/
└── pages/
    └── works.js
```

資産別の扱い:

- **記事4本**: `01-web-infrastructure`の連続レッスンへ変換
- **Linuxゲーム**: `/works/linux-story-quest/`、Linuxレッスンから起動
- **Gitゲーム**: `/works/git-dungeon/`、Gitレッスンから起動
- **「かけら」**: コース進捗機能とは統合せず、`/works/kakera/`の独立アプリ
- **授業メモ week1〜6**: 最初はほぼそのままMarkdown化し、後から「教材」と「記録」に分離
- **成果物展示**: `pages/works.js`にカード一覧を追加
- **手作りPNG**: `public/images/articles/`へ移し、記事から相対参照

---

## 7. 最初の1週間

### 1日目: forkして素の状態を固定

- `btholt/next-course-starter`を自分のGitHubへfork
- clone、`npm install`、`npm run dev`
- `course.json`のタイトル、著者、説明、URLを変更
- 依存関係とビルド成功をコミット

### 2日目: 既存記事を1本だけ移植

- AWS記事1本をMarkdown化
- PNG図解を`public/images`へ移す
- 見出し、コードブロック、リンク、モバイル表示を確認
- 残り3本を一括移植する前に変換ルールを決める

### 3日目: ゲームを無改造で置く

- Linux Story Questを`public/works/linux-story-quest`へコピー
- Git Dungeonも同様に配置
- 相対URL、画像、音声、`localStorage`を確認
- まずはレッスンから別ページで開く

### 4日目: 教材構造を作る

- `Linux / Git / Webインフラ / 授業メモ`の4セクションを作る
- 各レッスンに「目的」「前提」「教材」「手を動かす」「振り返り」を置く
- 記事とゲームを同じLearningPath上に並べる

### 5日目: 作品一覧と「かけら」

- `/works`ページを追加
- 3アプリをカード表示
- 「教材」「成果物」「日常利用アプリ」をラベルで区別する

### 6日目: 静的デプロイ

- GitHub PagesまたはCloudflare Pagesへ公開
- サブパス、404、ゲームの直接URL、画像URLを確認
- 既存S3+CloudFrontへ出す場合も、生成物のみを配信する

### 7日目: 採用判定

次を満たせば継続する。

- 記事追加がMarkdown一枚で済む
- ゲームが改造なしで動く
- スマートフォンで教材→ゲーム→教材へ戻れる
- ビルドと公開が一コマンドまたはpushで完了する

この段階でスターター固有の古さやNext.js更新問題が大きければ、コンテンツ構造を保ったまま公式Starlightへ移る。Markdownと`public/works`を中心にしておけば移行コストは低い。

## 最終判定

「そのまま使える既製品」は存在する。ただし、今回必要なのは完成LMSではなく、**教材の順序と独立アプリを静的に統合するコーススターター**である。

したがって、

1. 今は`next-course-starter`で出版モデルを採用する
2. ゲームは独立静的アプリとして同居させる
3. 進捗は当面localStorageに留める
4. 複数受講者、採点、登録が実際に必要になった時だけFrappe Learningまたは別バックエンドを検討する

という順序が、既存資産を最も捨てず、運用負担も増やさない選択になる。