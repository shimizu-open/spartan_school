# 汎用ユーティリティのOSS置き換え調査

調査日: 2026-08-25

実物の [build.js](/home/shimizu/study/spartan_school/02.homework/05.week5/web/scripts/build.js)、[date.js](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/app/lib/date.js)、[dom.js](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/app/lib/dom.js) を確認した。

## 結論

このアプリなら、次の構成が最小かつ安全である。

1. ビルドを Vite + `@tailwindcss/vite` に寄せる
2. 手書きminifierを廃止し、Viteの本番ビルドに任せる
3. BPEを廃止し、普通のJS/JSONをCloudFrontのBrotliで配る
4. 日付だけ `date-fns` を限定的に導入する
5. DOMラッパーは削除し、ファイル保存だけ素のBlob APIを残す
6. FontsourceはCSSをViteから正式にimportする
7. Biome、`checkJs`、`node:test`、Playwright、size-limitの順で品質機能を追加する

`build.js` は159行中、BPE・minifier・フォント正規表現・Tailwind実行だけで137行近くを占める。Viteへ移すと、独自ビルドスクリプトそのものをほぼ廃止できる。

## 削減行数の総括

| 領域 | 現在の場所 | 消せる見込み |
|---|---|---:|
| 手書きminifier | `build.js:84–147` | 64行 |
| 手書きBPE | `build.js:47–82` | 36行 |
| Fontsource正規表現・コピー | `build.js:19–45` | 27行 |
| Tailwind CLI・サイズ判定 | `build.js:149–158` | 10行 |
| copy/clean等のビルド骨格 | `build.js:1–17` | Vite化でさらに約17行 |
| 日付処理 | `lib/date.js` | 112行中、約45〜65行 |
| DOMラッパー | `lib/dom.js` | 56行中、約40〜56行 |
| 品質ツール | 現在なし | ソース削減なし。サイズ手書き判定4行を置換 |

合計は重複を除いて、`build.js` 約150行とアプリ側約90〜120行、計240行前後を既製機能へ移せる。

---

## 1. 手書きJavaScript minifier

### 第一推奨

**Viteへ移行して本番ビルドに任せる。単体で選ぶならesbuild。**

この規模では、Terserの数％の圧縮差より、ビルド・モジュール解決・動的import・アセット処理まで一つにまとめられることの方が大きい。既存構成を維持してminifierだけ交換する場合は、設定が非常に少ないesbuildが適する。

### 比較

2026年7月更新の同一ベンチマークでは、Reactの例でSWC 18ms/8.19KB、Oxc 3ms/8.36KB、Terser 199ms/8.26KB、UglifyJS 420ms/8.18KB、esbuild 18ms/8.54KBだった。圧縮後gzipサイズは僅差だが、Terser/UglifyJSはかなり遅い。[比較条件と全結果](https://github.com/privatenumber/minification-benchmarks)

| 名前 | 一行説明・リポジトリ | License / 活発さ | ES2022+・速度・圧縮 | このケースでの置換 / コスト / 注意点 |
|---|---|---|---|---|
| **esbuild** | [Go製の高速bundler/minifier](https://github.com/evanw/esbuild) | MIT。v0.28.2、2026-08-08。活発 | 非常に高速。Terserより圧縮後サイズが概ね数％大きい。`target`で現代JSを扱える | minifier 64行に加え、copyやbundleも置換可能。導入低。最高圧縮率が必要な場合は不利 |
| **Terser** | [定番のASTベースJS compressor](https://github.com/terser/terser) | BSD-2-Clause。v5.50.0、2026-08。活発 | 遅めだが圧縮率は安定して良い。ES6+対応 | 64行を数行のAPI呼び出しへ。設定は低〜中。小アプリでは処理時間差は実害なし |
| **SWC** | [Rust製JS/TSコンパイラ兼minifier](https://github.com/swc-project/swc) | Apache-2.0。v1.16.1、2026-08。非常に活発 | 高速で圧縮率もトップ級。ES2022/TS対応が強い | 64行を置換。ネイティブバイナリが大きく、minifyだけには過剰 |
| **oxc-minify** | [Rust/Oxcの高速minifier](https://github.com/oxc-project/oxc) | MIT。v0.144.0、2026-08。非常に活発 | 最速級。現代構文対応。ただし圧縮技法の一部が未実装 | 導入低。ただし公式npm説明が「alpha、誤った結果を返す可能性」と明記。現時点の第一選択にはしない |
| **uglify-js** | [古参のJS compressor](https://github.com/mishoo/UglifyJS) | BSD-2-Clause。v3.19.3、最終publish 2024-08。更新は鈍い | 圧縮率は良いが非常に遅い。READMEも一部の新構文は事前変換を推奨 | 64行を置換できるが、ES2022+を積極利用する新規案件ではTerserを選ぶべき |

なお、Oxcの公式パッケージ自身が、定数インライン化やdead-code removalの不足とalpha品質を明記している。[oxc-minify npm情報](https://www.npmjs.com/package/oxc-minify)

### なぜ自作minifierが危険か

現実のJavaScriptは「文字を一字ずつ見て空白とコメントを除く」だけでは解析できない。ASTを構築する正規のパーサが必要である。

この実装では、次のような具体的破壊が起こる。

#### 正規表現リテラルと除算

```js
const result = value / /x/.test(text);
```

最初の `/` は除算、次は正規表現の開始である。しかし空白を消すと、

```js
const result=value//x/.test(text);
```

となり、`//`以降がコメント扱いになる。

`/`が「除算・正規表現・コメント」のどれかは、前後1文字では判断できず、構文上の位置を理解しなければならない。

#### テンプレートリテラルの意味を変更する

現在の処理は、すべてのテンプレートリテラル内部に対して、

```js
literal.replace(/\s+/g, " ").replace(/> </g, "><")
```

を実行する。HTML以外でも改行、連続スペース、タブをデータとして使う可能性があるため、通常の文字列値やタグ付きテンプレートのraw値が変わる。

さらに、

```js
`outer ${`inner ${value}`}`
```

のようなネストでは、内側のバッククォートを外側の終了と誤認する。`${...}`内をJavaScriptとして再帰解析していないからである。

#### ASI（自動セミコロン挿入）

```js
function f() {
  return
  { ok: true };
}
```

元は`undefined`を返すが、改行を消すとオブジェクトを返す意味へ変わる。

また、

```js
a
++b
```

はASIにより二文だが、このminifierでは`a++b`となり構文エラーになる。

#### その他

- 正規表現内の文字クラス、Unicode Sets、flags
- private fields、decorators、import attributesなど新構文
- `async`と改行、`yield`、optional chaining周辺
- source mapとライセンスコメント
- HTMLテンプレート中の`<pre>`やユーザー向け空白

この64行は「単純なminifier」ではなく、「不完全なJavaScript字句解析器」になっている。学習用として一度作る価値はあるが、成果物の本番処理に残してはいけない。

---

## 2. 手書きBPE圧縮

### 第一推奨

**BPEを完全に削除し、普通のJS配列またはJSONをCloudFrontのBrotliで配る。クライアント側圧縮ライブラリは入れない。**

このリポジトリのデプロイ手順は、すでに [CloudFrontの自動圧縮をYes](/home/shimizu/study/spartan_school/02.homework/05.week5/docs/DEPLOY.md:88) としている。AWS公式にも、`Compress`とgzip/Brotli対応キャッシュを有効にすれば、`Accept-Encoding`に応じてCloudFrontが圧縮すると記載されている。[AWS公式](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html)

### 実データでの測定

`lines.json` と現在生成されている `lines.js` をNode.jsのgzip/Brotli level 11で測定した。

| 形式 | raw | gzip | Brotli |
|---|---:|---:|---:|
| 元の`lines.json` | 20,433 B | 6,159 B | 5,544 B |
| 自作BPE＋復号コード | 9,022 B | 6,093 B | 4,979 B |
| 単純な`export default [...]` | 16,056 B | **5,132 B** | **4,698 B** |

重要なのは、単純なJS配列の方が自作BPEよりBrotli後で281バイト小さいことだ。BPEはrawサイズだけを見ると効いているが、HTTP圧縮後には独自辞書・トークン・復号コードが重複になる。

削減量は `build.js:47–82` の36行。単純なJS生成を残しても4〜6行程度、JSONをViteからimportすればビルド側は0行にできる。

### クライアント圧縮OSS

| 名前 | 一行説明・リポジトリ | License / 活発さ | 何を置換するか / コスト / 注意点 |
|---|---|---|---|
| **lz-string** | [UTF-16/文字列保存向けLZ圧縮](https://github.com/pieroxy/lz-string) | MIT。npm stable 1.5.0は約3年前、2.0はRC | BPEを置換できるが独自形式と復号コードが残る。localStorage容量対策向けで、HTTP配信には不採用 |
| **fflate** | [小型のDEFLATE/gzip/ZIP実装](https://github.com/101arrowz/fflate) | MIT。v0.8.3、2026-05、活発 | gzipデータのクライアント復号向け。約8KB級のライブラリを20KBのデータのために足すのは逆効果。0.8.2以前には2026年公開のDoS問題もあるため必ず0.8.3+ |
| **pako** | [zlibの成熟したJS移植](https://github.com/nodeca/pako) | MIT AND Zlib。v3.0.1、2026-07。活発 | gzip/deflate互換性が必要な場合に有効。フルbundleはgzip 15KB未満だが、このデータより大きい |
| **brotli-wasm** | [ブラウザ/Node用Brotli WASM](https://github.com/httptoolkit/brotli-wasm) | MIT。v3.0.1、最終publish約2年前 | 独自`.br`ファイルをJSで展開可能。WASM初期化と追加assetが必要で完全に過剰 |
| **`@cloudflare/brotli`系** | 指定名の現行npmパッケージ | ライセンス・最終リリースとも確認できず | 2026-08時点で、その名前の推奨可能な公式クライアントライブラリを確認できなかった。Cloudflare Workersでは`node:zlib`のBrotliが使えるが、ブラウザ配布用OSSとは別物。[Cloudflare公式](https://developers.cloudflare.com/workers/runtime-apis/nodejs/zlib/) |

`CompressionStream("gzip")`も主要ブラウザで広く使えるが、これはユーザーが作成した巨大データを保存・送信するときの機能である。静的配信の解凍はHTTP層が自動で行うため、アプリコードから呼ぶ必要はない。[MDN](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream)

### クライアント圧縮が必要になる条件

次のいずれかが発生した場合だけ検討すればよい。

- localStorage/IndexedDBに数MB以上のデータを保存する
- ユーザー生成ファイルをZIPとして書き出す
- サーバーへ送る前にブラウザ側で圧縮する
- HTTP `Content-Encoding`が使えない独自コンテナを扱う
- オフライン単一HTMLへ大量データを埋め込む

現状はいずれにも該当しない。

---

## 3. 日付ユーティリティ

### 現在の実装にはDSTバグが残っている

「正午固定」は日付文字列のずれを避けるうえでは有効だが、`daysBetween`は依然として安全ではない。

America/New_Yorkで2026-03-07正午から03-08正午まではDST開始により23時間である。現在の実装は、

```js
Math.floor(23 * 60 * 60 * 1000 / 86_400_000) === 0
```

となり、隣の日を0日差と判定する。60日アンロックもDST境界付近で1日ずれる可能性がある。

### 第一推奨

**date-fnsを必要な関数だけimportする。**

`parseISO`、`format`、`addDays`、`differenceInCalendarDays`程度で足りる。`differenceInCalendarDays`を使えば「24時間の経過」ではなく「カレンダー上の日付差」というアプリの意図を直接表現できる。

`date.js`は112行だが実コード相当は57行。表示文言、60日アンロック、うるう年基準の`monthDayIndex`はアプリ固有なので残し、危険なparse/add/differenceだけ任せると、物理行で約45〜65行削減できる。

| 名前 | 一行説明・リポジトリ | License / 活発さ | このケースでの置換 / コスト / 注意点 |
|---|---|---|---|
| **date-fns** | [関数単位で使える日付ユーティリティ](https://github.com/date-fns/date-fns) | MIT。v4.4.0、2026-05。活発 | parse/add/difference/formatを置換。必要関数だけbundle可能。最小で要件に合う |
| **Day.js** | [Moment互換風の小型immutable API](https://github.com/iamkun/dayjs) | MIT。v1.11.21、2026年夏。活発 | 日付操作全般を置換。約2KBだが、厳密parseやtimezoneはpluginが必要。チェーンAPIはこの用途ではやや過剰 |
| **Luxon** | [Intlベースのtimezone対応日時ライブラリ](https://github.com/moment/luxon) | MIT。v3.7.2、安定版は約1年前だが2026年にもcommitあり | ZonedDateTime、Duration、Intervalを包括。多地域timezoneを扱わない本件では重い |
| **Temporal API** | [Dateを置き換える標準日時API](https://github.com/tc39/proposal-temporal) | 標準APIのためnpmライセンスなし | `Temporal.PlainDate`は要件に最も正確。ただし2026-08でもSafari/iOS Safari未対応でBaseline外。[対応状況](https://web-platform-dx.github.io/web-features-explorer/features/temporal/) |
| **Temporal polyfill** | [Temporalの参照polyfill](https://github.com/js-temporal/temporal-polyfill) | BSD-3-Clause。v0.5.1、2025-03 | Safari対応を補えるが、この小アプリにはbundleコストとAPI規模が大きい |

### このアプリに必要な最小設計

- `YYYY-MM-DD`は「日時」ではなくdate-only値として扱う
- `differenceInCalendarDays`で日数を求める
- `addDays`で前後日を作る
- `format(date, "yyyy-MM-dd")`でキー化する
- 表示は既存の短い日本語関数か`Intl.DateTimeFormat("ja-JP")`
- `monthDayIndex`と60日アンロックは業務ルールとして残す

日付ライブラリへアプリ固有ルールまで隠す必要はない。そこは自作を続ける価値がある。

---

## 4. DOMヘルパー

### 第一推奨

**ライブラリを追加せず、ブラウザ標準APIを直接使う。**

`find`、`listen`、`setMarkup`、`setText`は完全な別名であり、検証・nullチェック・サニタイズ・イベント委譲などの付加価値がない。

例えば、

```js
listen(find(root, "[data-back]"), "click", back);
```

より、

```js
root.querySelector("[data-back]").addEventListener("click", back);
```

の方が、MDNやTypeScriptの型情報と直接対応している。`querySelectorAll()`はすでに標準の静的NodeListを返す。[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Selection_and_traversal_on_the_DOM_tree)

`dom.js`は56行、実コード相当23行。ファイル保存だけ残す場合は約40〜45行、保存処理も利用側へ移せば56行すべて削除できる。

### ファイルダウンロード比較

| 名前 | 一行説明・リポジトリ | License / 活発さ | このケースでの置換 / コスト / 注意点 |
|---|---|---|---|
| **Blob + `URL.createObjectURL`** | [ブラウザ標準のBlob URL](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob) | 標準API | 現在の8行をほぼそのまま維持。依存0。数KBのJSON/TXTにはこれが定番 |
| **FileSaver.js** | [ブラウザ差を吸収する`saveAs()`](https://github.com/eligrey/FileSaver.js) | MIT。v2.0.5、最終publish約6年前 | `downloadFile`を1呼び出しへ。古いSafari/IE互換が必要なら有効だが、現代ブラウザだけなら依存追加の価値が薄い |
| **StreamSaver.js** | [巨大ファイルをRAMへ全展開せず保存](https://github.com/jimmywarting/StreamSaver.js) | MIT。v2.0.6、最終publish約5年前 | 数GB級や生成stream向け。Service Worker/MITM設定が必要。数KBのバックアップには不採用 |
| **File System Access API** | `showSaveFilePicker()`による直接保存 | 標準API | 保存場所指定や継続書き込みが可能。ただしSafari/Firefox未対応でBaseline外。[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker) |

注意点として、`URL.revokeObjectURL(url)`をクリック直後に同期実行すると、ブラウザによっては保存開始前に破棄される可能性がある。`setTimeout(() => URL.revokeObjectURL(url), 0)`など、タスクを一つ遅らせる方が安全である。

---

## 5. フォント自己ホスト・サブセット

### 現状評価

現在のビルドは、2フォントの`400.css`から243個の`@font-face`を抽出し、243個のwoff2、計約4.5MiBを`dist/fonts`へコピーしている。

ただし、「243ファイルをデプロイしている」と「利用者が243ファイル全部をダウンロードする」は別である。CSSには`unicode-range`があるため、ブラウザはページに登場したグリフを含む断片だけを要求する。この仕組みはFontsourceおよびGoogle Fontsの正式な日本語フォント配信方式である。Googleは日本語フォントの分割によって、単一ファイル配信より88%少ない転送量になったと説明している。[Google Developers](https://developers.googleblog.com/en/google-fonts-launches-japanese-support/)

したがって、

- 243ファイルの**デプロイ自体は異常ではない**
- 243個を**全部読み込んでいるなら異常**
- 現状の正規表現によるCSS変換は不要で壊れやすい
- 日本語の自由入力があるため、固定テキストだけの完全サブセットは不適切

という評価になる。

### 第一推奨

**ViteのエントリからFontsourceの公式CSSを直接importする。**

```js
import "@fontsource/zen-old-mincho/400.css";
import "@fontsource/zen-kaku-gothic-new/400.css";
```

ViteがCSSのURLを解決し、参照されたフォントをassetとして出力する。Fontsource公式もbundlerのentryからのimportを推奨している。[公式手順](https://fontsource.org/docs/getting-started/install)

これで `build.js:19–45` の27行が消える。

| 名前 | 一行説明・リポジトリ | License / 活発さ | このケースでの置換 / コスト / 注意点 |
|---|---|---|---|
| **Fontsource正式import** | [npmで自己ホストフォントを管理](https://github.com/fontsource/fontsource) | ツールMIT、対象2フォントはOFL-1.1。各5.3.0、2026-07。活発 | 正規表現解析と手動コピー27行を置換。Vite導入時はimport 2行だけ |
| **subfont** | [HTMLを解析して使用グリフだけ抽出](https://github.com/Munter/subfont) | MIT。v7.2.3、2026年初頭。活動あり | 静的UI文字を自動抽出。23依存で構成が重く、実行時に増えるユーザー入力文字を含められない |
| **glyphhanger** | [Chromeでページを走査しグリフ抽出](https://github.com/zachleat/glyphhanger) | MIT。v6.0.0、2026年夏。活発 | 静的ページの文字集合生成。Puppeteerとfonttoolsが必要。自由入力フォントの完全置換には不向き |
| **fonttools / pyftsubset** | [フォント加工の標準的Pythonツール](https://github.com/fonttools/fonttools) | MIT。v4.63.0、2026-05-14。非常に活発 | 最も精密なサブセット生成。Python環境と文字集合管理が必要。自動化を自分で設計する中〜高コスト |
| **Google Fonts配信** | Google側が日本語フォントをunicode-range分割 | フォントOFL-1.1。サービス側で継続運用 | ローカルasset管理を削除できる。ただし外部通信・プライバシー・CSP・オフライン方針と衝突 |
| **unicode-range分割** | CSS Fonts標準によるグリフ別ロード | 標準機能 | 現在Fontsourceがすでに生成済み。自作分割は不要 |

`japanese-400.css`という名前のファイルもあるが、これは約1.8MiBの日本語全体woff2を一個読む形式であり、小さな画面には通常不利である。Fontsourceも既定CSSの`unicode-range`分割の方が効率的としている。[Fontsource subset説明](https://fontsource.org/docs/getting-started/subsets)

実務的には、次の構成がよい。

- UI固定文言: 現在の分割Fontsource
- ユーザー入力: 同じ分割フォントから必要な漢字断片だけ追加ロード
- 固定ランディングページだけならsubfontを検討
- さらに軽量化したければ、ゴシック体はシステムフォントへ戻し、明朝一書体だけを自己ホストする

---

## 6. Tailwind CSS v4

### 第一推奨

**Vite + `@tailwindcss/vite`。**

Tailwind公式は、v4ではPostCSSよりVite pluginの方がさらに高速で、Vite利用時は最もシームレスな方法としている。[公式Vite手順](https://tailwindcss.com/docs/installation/using-vite)

```js
// vite.config.js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

CSS側は既存の、

```css
@import "tailwindcss";
```

をそのまま使える。

| 名前 | 一行説明・リポジトリ | License / 活発さ | 何を置換するか / コスト / 注意点 |
|---|---|---|---|
| **`@tailwindcss/vite`** | [Tailwind公式Vite plugin](https://github.com/tailwindlabs/tailwindcss) | MIT。Tailwind v4.3.3、2026-07-16。非常に活発 | CLI実行10行とビルド全体をViteへ統合。導入低。今回の第一選択 |
| **`@tailwindcss/postcss`** | Tailwind公式PostCSS plugin | MIT。同じリポジトリ・リリース系列 | Viteを使わない既存PostCSS pipeline向け。`postcss.config.js`が増える |
| **`@tailwindcss/cli`** | Tailwind単体CLI | MIT。現在導入済み | CSSだけ処理するなら正当な選択。問題はCLIそのものではなく、Nodeから`execFile`して独自buildを組み立てたこと |

現在の20KB判定は発想として正しいが、Tailwind処理と密結合させない方がよい。後述のsize-limitで、Brotli後サイズをCI監視する方が利用者の転送量に近い。

---

## 7. 品質まわり

### 学習者向けの低コスト順

1. **Biome**でformat + lint
2. **JSDoc + TypeScript `checkJs`**
3. **`node:test`**で日付・storage・stateの単体テスト
4. **size-limit**で配信サイズ監視
5. **Playwright**で保存→再読込→復元のE2E
6. 必要になったらVitestや本格TypeScriptへ移行

### Lint / Format

| 名前 | 一行説明・リポジトリ | License / 活発さ | 採用コスト / 注意点 |
|---|---|---|---|
| **Biome** | [formatterとlinterを一体化](https://github.com/biomejs/biome) | MIT OR Apache-2.0。v2.5.10、2026-08。非常に活発 | **最低コスト**。設定なしでも開始できる。この人への第一推奨 |
| **ESLint flat config** | [最も拡張性の高いJS linter](https://github.com/eslint/eslint) | MIT。v10.9.0、2026-08。非常に活発 | ルール・pluginが豊富。v10ではflat configのみ。学習初期には設定の選択肢が多い |
| **oxlint** | [Rust製高速linter](https://github.com/oxc-project/oxc) | MIT。v1.80.0、2026-08-25。非常に活発 | 設定なしで高速。ESLintの全plugin/custom rule互換ではない |
| **Prettier** | [定番のコードformatter](https://github.com/prettier/prettier) | MIT。v3.9.6、2026年夏。非常に活発 | formatだけなら簡単。lintには別途ESLint等が必要 |

Biome一個で始め、Biomeにないルールが具体的に必要になった時だけESLintへ移るのがよい。

### 型

| 名前 | 一行説明・リポジトリ | License / 活発さ | 採用コスト / 注意点 |
|---|---|---|---|
| **JSDoc + `checkJs`** | [TypeScriptで`.js`をそのまま検査](https://github.com/microsoft/TypeScript) | Apache-2.0。TypeScript v7.0.2、2026-08。非常に活発 | ファイルをTSへ変えず開始可能。`// @ts-check`または`checkJs: true`。第一段階に最適 |
| **TypeScript化** | `.js`を`.ts`へ移行 | 同上 | 型の強制力は最大。DOM null、storage schema、event型で効果が高いが、学習と移行量は増える |

最初は、特に次へJSDoc型を付ける価値が高い。

- `normalize()`へ入る保存データ
- stateの`commit` payload
- DOM eventのtarget
- date keyを受ける関数
- import/exportバックアップ構造

### テスト

| 名前 | 一行説明・リポジトリ | License / 活発さ | 置換範囲 / コスト / 注意点 |
|---|---|---|---|
| **node:test** | [Node標準のテストランナー](https://nodejs.org/download/release/latest-jod/docs/api/test.html) | Node同梱。Node 20以降stable | 依存0。date/storage/stateの純粋関数に最適。最初の第一推奨 |
| **Vitest** | [Vite-nativeのテストランナー](https://github.com/vitest-dev/vitest) | MIT。stable v4.1系、2026年も継続更新 | watch、mock、coverage、DOM環境が使いやすい。Vite導入後の次候補 |
| **Playwright** | [Chromium/Firefox/WebKit E2E](https://github.com/microsoft/playwright) | Apache-2.0。v1.62.1、2026-07-30。非常に活発 | ブラウザdownload、localStorage、history、動的importを実際に検証。ブラウザ取得が重いので単体テストより後 |

最初に書くべきテストは以下である。

- DST開始・終了日の`daysBetween`
- 月末、年末、うるう日
- 60日ちょうどのアンロック
- 壊れたlocalStorageのnormalize
- JSON export → clear → importの往復
- 履歴の戻る/進む
- 日本語入力後の再読込
- TXT/JSONダウンロード

### サイズ監視

| 名前 | 一行説明・リポジトリ | License / 活発さ | 採用コスト / 注意点 |
|---|---|---|---|
| **size-limit** | [Brotli/gzip後のサイズbudgetをCI検査](https://github.com/ai/size-limit) | MIT。v11.2.0、2026年春。活動あり | 現在の4行の20KB判定を置換。CSSだけなら`@size-limit/file`と`webpack:false`を使う。第一推奨 |
| **bundlesize** | [簡単なファイルサイズ上限チェック](https://github.com/siddharthkp/bundlesize) | MIT。v0.18.2、最終publish約2年前 | 設定は簡単だが更新が鈍い。新規採用はsize-limitを優先 |
| **Vite出力サイズ表示** | Vite標準のbuild結果 | ViteはMIT。2026年も活発 | 追加依存0。ただし上限超過でCIを失敗させるbudget機能ではない |

---

## 最終的な推奨構成

```text
Vite
├── JS bundle/minify
├── static assets
├── dynamic import
├── Fontsource CSS / woff2
└── @tailwindcss/vite

CloudFront
└── Brotli / gzip Content-Encoding

アプリ
├── date-fns（必要関数だけ）
├── 素のDOM API
└── Blob + URL.createObjectURL

品質
├── Biome
├── TypeScript checkJs
├── node:test
├── Playwright
└── size-limit
```

## 自作を続けてよい領域

次は汎用ライブラリへ追い出さず、アプリ固有コードとして残す価値がある。

- 60日後に読み返せるというルール
- 直近7日と全期間の表示方針
- `monthDayIndex`と366件の文言対応
- 日本語の日付表示方針
- TXT/JSONのバックアップ内容
- UI上の「かけら」「今月のひとつ」という状態遷移
- 20KBなど、このサイト独自の性能budget値

反対に、JavaScript構文解析、圧縮アルゴリズム、フォントCSS解析、カレンダー日数計算は、自作を本番へ残す利点がほぼない。今回もっとも明確な車輪の再発明はminifierとBPEであり、もっとも実害が出ているのはDST日数計算とフォント用正規表現である。