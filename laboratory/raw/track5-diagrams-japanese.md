# 第2ラウンド調査：図解のコード化・SVG・日本語対応

調査日: 2026-08-25

## 結論

第一推奨は、技術図を **D2 + astro-d2 に移し、Astroのビルド時にSVGを生成する構成**です。

D2はテキスト差分が読みやすく、日本語を正式に扱え、スケッチ描画と配色テーマで現在の「手帳・古書」風に寄せられます。ブラウザへ描画用JavaScriptを送らず、S3 + CloudFrontへ完成済みSVGだけを配信できます。[D2](https://github.com/d2lang/d2) / [astro-d2](https://github.com/HiDeoo/astro-d2)

ただし、26枚すべてをコード化するべきではありません。

- 技術構造図: D2へ移行
- AWS公式アイコンが重要な構成図: PlantUML + AWSライブラリも候補
- DNSハイジャックなどの説明漫画: PNGのまま残す
- ヴィクトリア朝の物語挿絵、ヒーロー、サムネイル: PNG/次世代画像として残す

## 1. 実物調査

### 容量と内訳

実際に26枚すべてを確認した結果です。

| 場所 | 枚数 | 内容 | 判断 |
|---|---:|---|---|
| `articles/images/00〜09` | 10 | DNS、HTTPS、CloudFront、OACなどの説明図 | 6枚をコード化、4枚は挿絵併用 |
| `articles/images/10〜18` | 9 | 領地・台帳・封蝋などヴィクトリア朝の物語挿絵 | PNGとして維持 |
| `assets/hero.png` | 1 | サイトの主ビジュアル | 維持 |
| `assets/thumb-*.png` | 6 | 記事・ゲームのサムネイル | 維持 |
| 合計 | 26 | 約69MB | 技術図と美術資産を分離する |

技術図は約1.0〜1.8MB、ヴィクトリア朝の挿絵・サムネイルは約3.3〜4.2MBです。

### コード化する図

| 画像 | 現在の参照箇所 | 判断 | 移行案 |
|---|---|---|---|
| `01_overview.png` | [case-01:37](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:37) | コード化 | D2。利用者→お名前.com→Route 53→ACM→CloudFront |
| `02_dns_resolution.png` | [case-01:63](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:63) | コード化 | D2の番号付きフロー |
| `03_ns_delegation.png` | [case-01:68](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:68) | コード化 | D2。レジストラと権威DNSの境界をコンテナ化 |
| `04_https_cert.png` | [case-01:98](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:98) | コード化 | Mermaid sequenceDiagramまたはD2 |
| `08_subdomain_concept.png` | [case-02:55](/home/shimizu/study/spartan_school/03.learning_site/articles/case-02-subdomain-s3.html:55) | コード化 | D2の階層・分岐図。特に相性がよい |
| `09_s3_oac.png` | [case-02:74](/home/shimizu/study/spartan_school/03.learning_site/articles/case-02-subdomain-s3.html:74) | コード化 | D2、またはPlantUML + AWSアイコン |

### 構造図と挿絵を併用する図

| 画像 | 参照箇所 | 判断 |
|---|---|---|
| `00_visual_abstract.png` | [case-01:128](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:128) | 「SETUP」と「EVERY ACCESS」をD2で別図化。現在のポスターは記事末の総括挿絵として残せる |
| `05_cdn_edge.png` | [case-01:121](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:121) | オリジン→エッジ→利用者はコード化できるが、世界地図の視覚効果は残す価値がある |
| `06_why_cert.png` | [case-01:75](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:75) | 漫画として維持。必要なら直前に小さなTLS概念図を追加 |
| `07_dns_hijack.png` | [case-01:84](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:84) | 攻撃者を含む3コマ漫画として維持 |

### コード化しない図

[case-03](/home/shimizu/study/spartan_school/03.learning_site/articles/case-03-cross-account-subdomain.html:43)の `10_two_estates.png` から `18_delegation_key.png` までは、構成図ではなく「領地・地主・商人・台帳」による物語表現です。コード化するとサイト固有の価値を失います。

`hero.png` と6枚の `thumb-*.png` も同様です。これらは軽量化対象ではあっても、diagram-as-codeへの移行対象ではありません。

---

# 2. 図解のコード化

## 比較表

凡例: ◎=適する、○=可能、△=制約あり、×=不向き

| 名前 | テキスト・Git差分 | ビルド時SVG | 日本語・フォント | 手描き/古典調 | AWSアイコン |
|---|---:|---:|---:|---:|---:|
| D2 | ◎ | ◎ | ◎ | ◎ スケッチ描画 | ○ 外部SVG |
| Mermaid | ◎ | ◎ | ○ | ○ hand-drawn look | ○ Iconify |
| PlantUML | ◎ | ◎ | ○ JVMフォント依存 | △ | ◎ AWS stdlib |
| Graphviz DOT | ◎ | ◎ | ○ Pango依存 | △ クラシック技術図 | △ 外部画像 |
| Structurizr | ◎ | ◎ | ○ | × | ○ テーマ・アイコン |
| Pikchr | ◎ | ◎ | ○ | ○ 古典的線画 | × |
| svgbob | ◎ | ◎ | △ 等幅幅計算 | ○ ASCII風 | × |
| WaveDrom | ◎ | ◎ | △ | × | × |
| Excalidraw | △ JSON差分 | ◎ エクスポート | ○ | ◎ | ○ コミュニティ素材 |
| draw.io | △ XML差分 | ◎ エクスポート | ○ | △ | ◎ |
| tldraw | △ JSON差分 | ○ | ○ | ◎ | △ |

## 個別評価

### D2 — 第一推奨

- 一行説明: 読みやすい独自言語から自動レイアウトされたSVGを生成する。
- リポジトリ: [d2lang/d2](https://github.com/d2lang/d2)
- ライセンス: MPL-2.0
- 活発度: 2026年8月にも更新。最新リリースタグの正確な番号は未確認。
- 置き換わるもの: `01`、`02`、`03`、`04`、`08`、`09`、および`00`の構造部分。
- 採用コスト: 低〜中。D2 CLIまたはastro-d2をCIに追加する。
- 日本語: CJKを正式に扱い、カスタムフォント指定も可能。
- 見た目: sketchモードとカスタムテーマで、黒インク・セピア・羊皮紙調に寄せられる。
- AWS: SVGアイコンをノードへ設定可能だが、PlantUMLほど完成したAWS標準ライブラリではない。
- 注意点: 自動レイアウト結果がバージョン更新で変わる可能性があるため、CIではバージョンを固定する。

### Mermaid

- 一行説明: Markdown周辺で最も普及しているテキスト図表言語。
- リポジトリ: [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid)
- ライセンス: MIT
- 活発度: 11.15.0が2026年5月。継続的に更新。
- 置き換わるもの: DNSフロー、証明書シーケンス、サブドメイン階層。
- 採用コスト: 低。対応プラグインが多い。
- 日本語: 使用可能。日本語ラベルは引用符で囲み、CI側に対象フォントを用意する。
- 見た目: hand-drawn lookを選べるが、D2ほど細かい紙面調整には向かない。
- AWS: [architecture diagramとIconifyアイコン](https://mermaid.js.org/syntax/architecture.html)を利用可能。
- 注意点: ブラウザ描画にするとJS、描画待ち、CSP設定が増える。今回はビルド時描画を推奨。

### PlantUML

- 一行説明: Javaで動く、シーケンス図・構成図に強い成熟した図表言語。
- リポジトリ: [plantuml/plantuml](https://github.com/plantuml/plantuml)
- ライセンス: GPL-3.0が標準。MIT、Apache-2.0、BSD等の代替配布条件も公式に提示。
- 活発度: 1.2026.6が2026年6月。
- 置き換わるもの: `04_https_cert`、`09_s3_oac`、AWS構成全般。
- 採用コスト: 中。JVMとフォントをCIに入れる。
- 日本語: JVMに日本語フォントが存在すれば描画できる。`defaultFontName`を固定する。
- 見た目: skinparamで変更できるが、ヴィクトリア朝・手描き風には弱い。
- AWS: [公式stdlib](https://plantuml.com/stdlib)の`awslib`が強み。
- 注意点: 古い`aws`ライブラリではなく`awslib`を使う。依存がNodeだけでは完結しない。

### Graphviz / DOT

- 一行説明: グラフの自動レイアウトに特化した古典的な標準ツール。
- リポジトリ: [graphviz/graphviz](https://gitlab.com/graphviz/graphviz)
- ライセンス: EPL-1.0
- 活発度: 16.0.0が2026年8月。[リリースタグ](https://gitlab.com/graphviz/graphviz/-/tags)
- 置き換わるもの: DNS委任グラフ、依存関係、サブドメイン木。
- 採用コスト: 中。OS側のGraphvizと日本語フォントが必要。
- 日本語: Pango/fontconfigが日本語フォントを見つけられる環境なら可能。
- 見た目: 精密な古典的技術図は作れるが、手描き感は自力でスタイル指定する必要がある。
- AWS: ネイティブセットなし。画像ノードで外部SVGを使う。
- 注意点: DOTは詳細調整を始めると記述量が増える。今回ならD2のほうが読みやすい。

### Excalidraw

- 一行説明: 手描きホワイトボード風の図をGUIで作る。
- リポジトリ: [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw)
- ライセンス: MIT
- 活発度: 0.18.0が2025年3月。リポジトリは2026年も更新。
- 置き換わるもの: 漫画ほど描き込まない概念図、手描き矢印付き説明図。
- 採用コスト: 低。`.excalidraw`を原本としてSVGを書き出す。
- 日本語: CJKフォント対応あり。SVG書き出し時はフォント埋め込み・サブセットを確認。
- 見た目: 手描き風では最良。
- AWS: コミュニティライブラリはあるが、公式同梱を前提にしない。
- 注意点: JSON原本なのでGit差分は形式上取れても、人が読める意味差分ではない。

### tldraw

- 一行説明: ReactベースのホワイトボードSDK・エディタ。
- リポジトリ: [tldraw/tldraw](https://github.com/tldraw/tldraw)
- ライセンス: 独自tldraw License。現在のSDKはOSI準拠OSSではない。
- 活発度: 5.x系が2026年も活発。
- 置き換わるもの: ブラウザ上の共同作図エディタ。
- 採用コスト: 高。React SDKとライセンスキーの判断が必要。
- 日本語・見た目: 日本語と手描きUIは良好。
- AWS: 専用セットなし。
- 注意点・不採用理由: 静的記事の図を書くだけの用途には過剰。無料Hobby利用には透かし等の条件があるため採用しない。

### draw.io / diagrams.net

- 一行説明: XMLを原本にする汎用GUI作図ツール。
- リポジトリ: [jgraph/drawio](https://github.com/jgraph/drawio)
- ライセンス: エディタ本体はApache-2.0。個別ステンシルには別条件があり得る。
- 活発度: 31.2系が2026年8月。
- 置き換わるもの: AWS構成図をGUIで作る工程。
- 採用コスト: 低〜中。`.drawio`と書き出したSVGを管理する。
- 日本語: 対応。ただし書き出し先でも使えるフォントを選ぶ。
- AWS: AWSステンシルが充実。
- 注意点: XML差分はレビューしにくい。コード化ではなく「再編集可能なGUI原本」の選択肢。

### Structurizr

- 一行説明: C4モデルをDSLで定義し、複数ビューを生成する。
- リポジトリ: [structurizr/dsl](https://github.com/structurizr/dsl)
- ライセンス: Apache-2.0
- 活発度: 2026.06.28が2026年6月。
- 置き換わるもの: システム全体のC4構成図、コンテナ・コンポーネント関係。
- 採用コスト: 高。単純な記事図よりモデル設計が大きい。
- 日本語: ラベルは扱えるが、出力先のフォント設定に依存。
- 見た目・AWS: テーマやアイコンは設定可能。手描き・物語調には不向き。
- 注意点・不採用理由: 4記事のDNS説明には過剰。将来、学習アプリ群全体の設計文書をC4化する場合だけ再検討する。

### Pikchr

- 一行説明: PIC系の小さなテキスト言語からSVGを直接生成する。
- リポジトリ: [pikchr.orgソース](https://pikchr.org/home)
- ライセンス: 0BSD
- 活発度: 公式サイトは2026年8月にも生成・更新。通常のリリース番号は未確認。
- 置き換わるもの: 小型の線画、矢印、箱組み。
- 採用コスト: 中。配置を比較的明示して書く必要がある。
- 日本語: SVGテキストとして扱えるが、フォントは閲覧環境依存。
- 見た目: 古典的な論文・技術書風にはできる。
- AWS: アイコンセットなし。
- 注意点: 自動レイアウト中心のD2より学習コストが高く、今回の第一候補にはしない。

### svgbob

- 一行説明: ASCIIアートをSVGに変換するCLI。
- リポジトリ: [ivanceras/svgbob](https://github.com/ivanceras/svgbob)
- ライセンス: Apache-2.0
- 活発度: 2026年もリポジトリ更新。最新タグの時期は未確認。
- 置き換わるもの: ターミナル風の簡単な箱・矢印図。
- 採用コスト: 低。
- 日本語: ラベル自体は置けるが、全角文字幅とASCII罫線の整列に注意。
- 見た目: Linux Story Questなどの端末教材にはよく合う。
- AWS: なし。
- 注意点: learning_siteの優雅な紙面より、授業メモ・CLI教材向け。

### WaveDrom

- 一行説明: WaveJSONからデジタル信号のタイミング図を生成する。
- リポジトリ: [wavedrom/wavedrom](https://github.com/wavedrom/wavedrom)
- ライセンス: MIT
- 活発度: 2026年も更新。コアの最新タグは未確認。
- 置き換わるもの: クロック、ビット、プロトコルのタイミング図。
- 採用コスト: 低。
- 日本語: 注釈は可能だが主用途ではない。
- 注意点・不採用理由: 現在の記事にタイミング波形がないため導入しない。

---

# 3. Astro / Markdownへの組み込み

## 推奨パイプライン

```text
Markdown内のD2コード
        ↓ Astro build
astro-d2 + D2 CLI
        ↓
完成済みSVG
        ↓
S3 + CloudFront
```

### 組み込み候補

| 名前 | リポジトリ・ライセンス | 活発度 | 採用コスト・用途 | 注意点 |
|---|---|---|---|---|
| astro-d2 | [HiDeoo/astro-d2](https://github.com/HiDeoo/astro-d2) / MIT | 0.10.0、2026年3月 | 低。D2コードフェンスをインラインまたは外部SVG化 | D2実行環境とバージョンをCIで固定 |
| rehype-mermaid | [remcohaszing/rehype-mermaid](https://github.com/remcohaszing/rehype-mermaid) / MIT | 3.0.0、直近年は未確認 | 中。Mermaidをビルド時にSVG/PNG化 | Playwright + Chromiumが必要 |
| mermaid-cli / `mmdc` | [mermaid-js/mermaid-cli](https://github.com/mermaid-js/mermaid-cli) / MIT | 11.15.0、2026年5月 | 中。`.mmd`からSVGを一括生成 | Puppeteer/Chromiumとフォントが必要 |
| Kroki | [yuzutech/kroki](https://github.com/yuzutech/kroki) / MIT | 0.30.1、2026年3月 | 中〜高。多数の図表言語を統一APIで処理 | 公開APIはビルド時ネットワーク依存。セルフホストはDocker運用が増える |

### ビルド時SVGとクライアント描画の違い

| 項目 | ビルド時SVG | クライアント側Mermaid |
|---|---|---|
| ブラウザへ送るもの | SVGのみ | ソース＋Mermaid JS |
| 初回表示 | 即時 | JS実行後 |
| JavaScript無効時 | 表示できる | 表示できない |
| CSP | 単純 | スクリプト条件が増える |
| 日本語フォント | CIで固定可能 | 各端末のフォントに依存しやすい |
| キャッシュ | SVG単位で可能 | JSとソースを処理 |
| 今回の推奨 | **こちら** | プレビュー用途に限定 |

外部SVGを`<img>`で置けばキャッシュと分離性がよく、インラインSVGならCSS変更やアクセシビリティ調整が容易です。本文図は外部SVGを基本とし、色をテーマ連動させたい小図だけインライン化するのが妥当です。

---

# 4. SVGとアイコン

## SVG最適化

### SVGO — 採用

- 一行説明: SVGの不要属性・メタデータ・冗長なパスを最適化するNodeツール。
- リポジトリ: [svg/svgo](https://github.com/svg/svgo)
- ライセンス: MIT
- 活発度: 4.0.1、2026年。
- 置き換わるもの: 手動のSVG掃除、余分なXML削除。
- 採用コスト: 低。Astroビルドまたはnpm scriptに追加。
- 注意点: `viewBox`、`title`、`desc`、参照されるIDを消さない設定にする。D2/Mermaid出力へ盲目的に全プラグインを適用しない。

### svgcleaner — 不採用

- 一行説明: Rust製SVG最適化CLI。
- リポジトリ: [RazrFalcon/svgcleaner](https://github.com/RazrFalcon/svgcleaner)
- ライセンス: MPL-2.0
- 活発度: 2021年10月にアーカイブ。
- 置き換わるもの: SVGOと同じ。
- 採用コスト: 低。
- 不採用理由: 保守終了。Node 22/npm中心の構成ではSVGOのほうが自然。

## アイコンセット

| 名前 | 一行説明 / リポジトリ | ライセンス | 活発度 | 置き換え・採用コスト | 注意点 |
|---|---|---|---|---|---|
| Lucide | 軽量な線画UI。[lucide-icons/lucide](https://github.com/lucide-icons/lucide) | ISC。Feather由来分はMIT | 1.27.0、2026年7月 | 低。ナビや注意書きアイコン | 第一推奨。ヴィクトリア朝では線幅・色を抑える |
| Tabler Icons | 大規模な線画セット。[tabler/tabler-icons](https://github.com/tabler/tabler-icons) | MIT | 3.46.0、2026年7月 | 低 | Lucideとの混在を避ける |
| Phosphor | 複数ウェイトとduotone。[phosphor-icons/core](https://github.com/phosphor-icons/core) | MIT | core 2.0.8、2024年2月。組織は更新継続 | 低 | duotoneは装飾性が高いが、セット容量に注意 |
| Heroicons | Tailwind系のUIアイコン。[tailwindlabs/heroicons](https://github.com/tailwindlabs/heroicons) | MIT | 2.2.0、2024年11月 | 低 | 種類が比較的少なく、今回はLucideを優先 |
| Iconify | 多数セットの統一API。[iconify/iconify](https://github.com/iconify/iconify) | フレームワークMIT、各セットは個別 | 2026年も活発 | 低〜中。必要アイコンだけ生成 | アイコン単位のライセンス確認必須。全JSONを入れない |
| Simple Icons | ブランドロゴ集。[simple-icons/simple-icons](https://github.com/simple-icons/simple-icons) | CC0-1.0 | 2026年も活発 | 低。GitHub等のロゴ | 商標権はCC0で消えない。AWS構成アイコンの代用ではない |
| AWS Architecture Icons | AWS公式構成図素材。[AWS公式配布ページ](https://aws.amazon.com/architecture/icons/) | OSSライセンスではなくAWSの利用・商標条件 | 2026年版を確認 | 中。S3/CloudFront/Route 53/ACMを置換 | 色や形を勝手に改変せず、AWS公式の利用条件に従う |

UIアイコンはLucideを一種類だけ採用し、AWSサービス図だけAWS公式アイコンを使うのが一貫しています。

## Astroでのインライン化

### astro-icon — 第一推奨

- 一行説明: AstroコンポーネントとしてローカルSVGやIconifyアイコンをインライン化する。
- リポジトリ: [natemoo-re/astro-icon](https://github.com/natemoo-re/astro-icon)
- ライセンス: MIT
- 活発度: 1.2.0、2026年8月。
- 置き換わるもの: SVGの手書き`<svg>`、個別コピー、色・サイズ調整。
- 採用コスト: 低。
- 注意点: 同じ複雑なSVGを大量にインライン化するとHTMLが膨らむ。図解本体ではなくUIアイコン向け。

### unplugin-icons

- 一行説明: Vite等でIconifyアイコンをオンデマンドコンポーネント化する。
- リポジトリ: [unplugin/unplugin-icons](https://github.com/unplugin/unplugin-icons)
- ライセンス: MIT
- 活発度: 2026年も更新。最新リリース番号は未確認。
- 置き換わるもの: アイコンSVGの手動管理。
- 採用コスト: 中。
- 注意点: Astroだけならastro-iconのほうが単純。`@iconify/json`全体ではなく個別の`@iconify-json/*`を使う。

---

# 5. 日本語対応

## 第一優先: BudouX

- 一行説明: 日本語を読みやすい文節で区切り、自然な改行位置を生成する軽量分かち書き器。
- リポジトリ: [google/budoux](https://github.com/google/budoux)
- ライセンス: Apache-2.0
- 活発度: npm 0.9.0、2026年8月。
- 置き換わるもの: 見出し内へ手作業で入れている`<br>`。
- 採用コスト: 低。Astroビルド時処理またはWeb Componentを利用。
- 注意点: 形態素解析器ではない。本文全体ではなく、見出し・カードタイトルに限定する。

現在、記事見出しでは[case-01:30](/home/shimizu/study/spartan_school/03.learning_site/articles/case-01-domain-https.html:30)、[case-02:30](/home/shimizu/study/spartan_school/03.learning_site/articles/case-02-subdomain-s3.html:30)、[case-03:30](/home/shimizu/study/spartan_school/03.learning_site/articles/case-03-cross-account-subdomain.html:30)に手動`<br>`があります。これをMarkdownの素の見出しに戻し、BudouXで`<wbr>`相当を生成するのが直接的な置き換えです。

CSSは概ね次の方針です。

```css
.heading-ja {
  word-break: keep-all;
  overflow-wrap: anywhere;
}
```

生成物へゼロ幅空白を挿入する方式では、textlintは生成後HTMLではなくMarkdown原稿へ先に実行します。

## 約物詰め: Yaku Han JP / Yaku Han MP

- 一行説明: 句読点・括弧などの約物だけを半角幅へ調整する日本語Webフォント。
- リポジトリ: [qrac/yakuhanjp](https://github.com/qrac/yakuhanjp)
- ライセンス: OFL-1.1 AND MIT
- 活発度: 4.1.1系。2026年にもリポジトリ更新。
- 置き換わるもの: 個別の負マージンや手作業スペース調整。
- 採用コスト: 低。
- 注意点: `yakuhanmp`は別プロジェクトではなく、Yaku Han JPパッケージに含まれる明朝用CSS。

現状は[style.css:18](/home/shimizu/study/spartan_school/03.learning_site/assets/style.css:18)でCormorant Garamondと日本語明朝を組み合わせています。このサイトではゴシック用YakuHanJPより、明朝用の**YakuHanMP**を先頭へ置くほうが合います。

```css
font-family:
  "Yaku Han MP",
  "Cormorant Garamond",
  "Yu Mincho",
  "游明朝",
  serif;
```

ただし、本文すべてへ直ちに適用せず、見出し・カード・キャプションで視覚比較してから広げるべきです。

## textlint

### textlint本体

- 一行説明: 自然言語向けの拡張可能なLintツール。
- リポジトリ: [textlint/textlint](https://github.com/textlint/textlint)
- ライセンス: MIT
- 活発度: 15.8.0、2026年8月。
- 置き換わるもの: 目視だけの表記揺れ・長文・助詞重複チェック。
- 採用コスト: 低。Node.js 22は要件を満たす。
- 注意点: 標準ルールは同梱されない。現在はHTML原稿だが、予定されているMarkdown移行後に本領を発揮する。

### textlint-rule-preset-ja-technical-writing — 採用

- 一行説明: 日本語技術文書向けの定番ルールセット。
- リポジトリ: [textlint-ja/textlint-rule-preset-ja-technical-writing](https://github.com/textlint-ja/textlint-rule-preset-ja-technical-writing)
- ライセンス: MIT
- 活発度: 12.0.2、2026年1月。2026年7月にも更新。
- 置き換わるもの: 冗長表現、長すぎる文、同一助詞、弱い表現などの目視確認。
- 採用コスト: 低。
- 注意点: 物語調の記事にデフォルトをそのまま当てると厳しすぎる。文長や感嘆符などを調整する。

### preset-jtf-style

- 一行説明: JTF日本語標準スタイルガイドをtextlintルール化したもの。
- リポジトリ: [textlint-ja/textlint-rule-preset-jtf-style](https://github.com/textlint-ja/textlint-rule-preset-jtf-style)
- ライセンス: コードMIT。規則の由来となるガイドにはCC BY-SA条件あり。
- 活発度: 3.0.2系。直近リリース時期は未確認。
- 置き換わるもの: 記号、数字、全半角、単位表記の目視確認。
- 採用コスト: 低。
- 注意点: technical-writing presetがJTF系規則を含むため、両方を丸ごと重ねない。必要な規則だけ追加する。

### prh / textlint-rule-prh — 採用

- 一行説明: プロジェクト固有の表記統一辞書を作れる。
- リポジトリ: [textlint-rule/textlint-rule-prh](https://github.com/textlint-rule/textlint-rule-prh)
- ライセンス: MIT
- 活発度: 6.1.0系、2026年。
- 置き換わるもの: 「Route53/Route 53」「Cloud Front/CloudFront」などの手動検索。
- 採用コスト: 低。
- 注意点: 自動修正前に差分確認を必須にする。

最初の辞書候補は次です。

- `Route53` → `Route 53`
- `Cloud Front` → `CloudFront`
- `サブ ドメイン` → `サブドメイン`
- `お名前com` → `お名前.com`
- `Origin Access Control` / `OAC`の初出表記
- `ネームサーバ` / `ネームサーバー`の統一

## 形態素解析・検索

| 名前 | 説明 / リポジトリ | ライセンス・活発度 | 現実的な用途 | 注意点 |
|---|---|---|---|---|
| Lindera | Rust製形態素解析器。[lindera/lindera](https://github.com/lindera/lindera) | MIT / 5.1.0、2026年8月 | 本格的なビルド時日本語索引 | 第一候補だが辞書が大きく実装コスト中〜高 |
| kuromoji.js | JavaScript版形態素解析器。[takuyaa/kuromoji.js](https://github.com/takuyaa/kuromoji.js) | Apache-2.0 / 最終の活発な時期は2018年前後、正確な最新リリース未確認 | Nodeだけで試作 | 辞書が大きく、保守停滞 |
| Vibrato | 高速なRust製MeCab互換解析器。[daac-tools/vibrato](https://github.com/daac-tools/vibrato) | MIT OR Apache-2.0 / 2026年も更新、最新タグ未確認 | オフライン索引生成 | Node/Astroへ直結する導入路がLinderaより弱い |
| TinySegmenter | 小型の分かち書き器。[leungwensen/tiny-segmenter](https://github.com/leungwensen/tiny-segmenter) | ライセンス・最新タグとも未確認 | 実験用途 | 古く、品詞・原形を返さず、検索品質改善の本命ではない |
| BudouX | 文節改行器。[google/budoux](https://github.com/google/budoux) | Apache-2.0 / 0.9.0、2026年8月 | 見出し改行 | 形態素解析・検索トークナイザーではない |
| `Intl.Segmenter` | ブラウザ標準API | 標準仕様 | 単語・書記素境界 | 辞書・品詞・原形を持つ形態素解析器ではない |

### このサイトでの現実解

現時点では4記事しかないため、Lindera辞書をブラウザへ配るのは過剰です。

1. Pagefindの標準日本語処理を使う。
2. 記事メタデータへ検索別名を追加する。
   - `DNS`, `名前解決`, `ドメイン`
   - `証明書`, `HTTPS`, `TLS`, `ACM`
   - `配信`, `CDN`, `CloudFront`
   - `委任`, `NS`, `ネームサーバー`
3. 実際の検索失敗例をテストセットとして蓄積する。
4. 失敗が目立った時だけ、Linderaを**ビルド時**に使って読み・原形・別名を索引用テキストへ追加する。
5. 15MB以上の辞書をクライアントへ配らない。

## 縦組み・ルビ・禁則

通常の記事サイトなら、OSSを追加する前にブラウザ標準を使うべきです。

- ルビ: `<ruby>漢字<rt>かんじ</rt></ruby>`
- 縦組み: `writing-mode: vertical-rl`
- 禁則: `line-break: strict`
- 縦中横: `text-combine-upright: all`
- 約物: `font-feature-settings: "vpal"`とYakuHanMPを比較

### Vivliostyle

- 一行説明: 縦組み、ルビ、ページ組版に強いCSS組版エンジン。
- リポジトリ: [vivliostyle/vivliostyle.js](https://github.com/vivliostyle/vivliostyle.js)
- ライセンス: AGPL-3.0
- 活発度: 2.43.0、2026年5月。
- 置き換わるもの: 印刷用PDF・電子書籍組版。
- 採用コスト: 高。
- 注意点・不採用理由: 通常の横書きWeb記事には過剰。将来「事件簿を印刷用の本にする」ときだけ採用する。

### Mejiro

- 一行説明: 日本語の禁則・ぶら下がり・ルビ・縦組みを扱う新しい組版ライブラリ。
- リポジトリ: [libraz/mejiro](https://github.com/libraz/mejiro)
- ライセンス: Apache-2.0
- 活発度: 0.8.0、2026年8月。
- 置き換わるもの: 高度なWeb/EPUB日本語組版。
- 採用コスト: 中〜高。
- 注意点・不採用理由: 非常に新しく利用実績がまだ少ない。現時点では標準CSSを優先する。

---

# 6. PNGを作り続ける場合の作図ツール

| 名前 | 一行説明 / リポジトリ | ライセンス・活発度 | 置き換わるもの / 採用コスト | 判断 |
|---|---|---|---|---|
| Inkscape | SVGネイティブのベクター作図。[inkscape/inkscape](https://gitlab.com/inkscape/inkscape) | GPL-3.0 / 1.4.4、2026年5月 | 技術図、枠、飾り罫、タイトルプレート / 中 | 手作業図の第一推奨 |
| Penpot | オープンなWebデザイン共同編集環境。[penpot/penpot](https://github.com/penpot/penpot) | MPL-2.0 / 2.17系、2026年 | Figma的な画面・図版設計 / 中〜高 | 共同作業なら有力。個人には運用が重い |
| Krita | ブラシ・質感・描画に強いペイントソフト。[Krita source](https://invent.kde.org/graphics/krita) | GPL-3.0 / 5.3.3、2026年7月 | ヴィクトリア朝挿絵の描画・レタッチ / 中 | 物語絵には最適、構成図には不向き |
| ImageMagick | 画像の合成・切り抜き・一括処理CLI。[ImageMagick](https://github.com/ImageMagick/ImageMagick) | ImageMagick License / 7.1.2-29、2026年7月 | 書き出し後の合成・余白・透かし処理 / 低 | 作図ツールではなく再現可能な後処理用 |
| sharp-cli | sharpをCLIから使う画像処理パイプライン。[vseventer/sharp-cli](https://github.com/vseventer/sharp-cli) | MIT / 5.2.0、2026年6月 | Node/npm内のリサイズ・書き出し / 低 | 作図はできない。CIでの派生物生成用 |

推奨する役割分担は次です。

- 技術図: D2
- 手作業のベクター装飾: Inkscape
- ヴィクトリア朝の挿絵: Krita
- 共同デザインが必要になった場合だけ: Penpot
- 書き出しの自動化: sharp-cliまたはImageMagick

Inkscapeで日本語テキストをパス化する場合、編集用SVGではテキストを残し、配布用コピーだけパス化します。最初からパス化すると検索性、アクセシビリティ、修正性を失います。

---

# 7. 69MB・26枚の具体的な移行手順

## フェーズ1: 原本と派生物を分離

1. 現在のPNGを削除せず、まず一覧表を作る。
2. 各画像に次の分類を付ける。
   - `diagram-code`
   - `diagram-hybrid`
   - `illustration`
   - `hero`
   - `thumbnail`
3. 今後は原本を次のように分ける。

```text
src/
  diagrams/
    overview.d2
    dns-resolution.d2
    ns-delegation.d2
    https-cert.d2
    subdomain-concept.d2
    s3-oac.d2
  illustrations/
    source/
  icons/
    aws/
public/
  generated-diagrams/
  illustrations/
```

## フェーズ2: まず6枚だけコード化

次の順序なら、難易度が低く効果を確認しやすいです。

1. `03_ns_delegation.png`
2. `02_dns_resolution.png`
3. `08_subdomain_concept.png`
4. `01_overview.png`
5. `09_s3_oac.png`
6. `04_https_cert.png`

各図で確認する項目:

- 360px幅で日本語が欠けない
- SVGに`role="img"`、タイトル、説明がある
- セピア・黒・深緑の既存配色に合う
- CIとローカルでレイアウトが一致する
- ソース差分だけで変更内容をレビューできる
- 元PNGより内容が理解しやすい

移行直後は元PNGを`legacy/`相当へ残し、2〜3回の公開確認後にGit履歴へ委ねます。

## フェーズ3: ハイブリッド4枚を整理

- `00_visual_abstract`: D2版を本文用、既存PNGを記事末ポスター用にする。
- `05_cdn_edge`: 技術フローをD2化し、世界地図挿絵は補助図として残す。
- `06_why_cert`: 現行漫画を残す。
- `07_dns_hijack`: 現行3コマを残す。

一枚の画像に「構造説明」と「雰囲気作り」を両方背負わせないのが重要です。

## フェーズ4: 16枚の美術資産を維持

維持対象:

- `10_two_estates.png`〜`18_delegation_key.png`
- `assets/hero.png`
- `assets/thumb-*.png`

これらは構図や筆致が価値なので、D2・Mermaid・SVGトレースへ置き換えません。今後の新規制作では、可能ならKrita原本またはInkscape原本も保存し、PNGは配布用派生物とします。

## フェーズ5: Astroへ組み込む

1. Astro移行時に`astro-d2`を追加。
2. D2とastro-d2のバージョンをlockfileで固定。
3. CIへ日本語フォントを明示的に導入。
4. SVG生成後に安全な設定のSVGOを通す。
5. 外部SVGを基本にし、UIアイコンだけastro-iconでインライン化。
6. `<img>`置換時に既存の代替テキストを捨てず、SVGの`title`/`desc`にも反映する。
7. 生成SVGをLighthouse・axe・実機幅で確認する。

## フェーズ6: 日本語品質を同時に改善

1. 手動`<br>`を取り除き、BudouXを記事タイトル・カードタイトルへ限定導入。
2. `YakuHanMP`を見出しで比較導入。
3. Markdown移行と同時にtextlintを追加。
4. `preset-ja-technical-writing`を緩めに開始。
5. prhへAWS用語辞書を作る。
6. Pagefind検索失敗例を記録し、必要になるまでLinderaは導入しない。

## 完了状態

最終的な26枚の扱いは以下が妥当です。

- **6枚**: D2へ完全移行
- **2枚**: D2と挿絵へ分割
- **2枚**: 説明漫画として維持
- **9枚**: ヴィクトリア朝の本文挿絵として維持
- **7枚**: ヒーロー・サムネイルとして維持

つまり、コード化の対象は「PNGだから」ではなく、**情報構造の変更頻度が高く、箱・線・順序で説明できる図かどうか**で決めるべきです。現在のサイトではD2化は6〜8枚にとどめ、残りの美術資産を守る構成が最も効果的です。