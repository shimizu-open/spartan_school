# 03. 自作ユーティリティを枯れた OSS に置き換える

対象: `02.homework/05.week5/web/scripts/build.js` と `web/src/app/lib/`
調査: codex + web search（2026-08-25 実施）
**※ この章の主要な主張は、こちらで独立に再実測して裏を取っている（各節の「実測」参照）**

---

## 結論

1. ビルドを **Vite + `@tailwindcss/vite`** に寄せる
2. **手書き minifier を廃止**し、Vite の本番ビルドに任せる
3. **BPE を廃止**し、普通の JS/JSON を CloudFront の Brotli で配る
4. 日付だけ **date-fns** を限定的に導入する
5. **DOM ラッパーは削除**し、ファイル保存だけ素の Blob API を残す
6. Fontsource は **Vite から公式 CSS を import** する
7. **Biome → `checkJs` → `node:test` → size-limit → Playwright** の順で品質機能を追加する

### 削減行数の総括

| 領域 | 現在の場所 | 消せる見込み |
|---|---|---:|
| 手書き minifier | `build.js:84–147` | **64 行** |
| 手書き BPE | `build.js:47–82` | **36 行** |
| Fontsource 正規表現・コピー | `build.js:19–45` | **27 行** |
| Tailwind CLI・サイズ判定 | `build.js:149–158` | 10 行 |
| copy/clean 等のビルド骨格 | `build.js:1–17` | Vite 化でさらに約 17 行 |
| 日付処理 | `lib/date.js` | 112 行中 約 45〜65 行 |
| DOM ラッパー | `lib/dom.js` | 56 行中 約 40〜56 行 |

**重複を除いて `build.js` 約 150 行 + アプリ側 約 90〜120 行 = 計 240 行前後**を既製機能へ移せる。

---

## 1. 手書き JavaScript minifier — 最優先で捨てる

### 第一推奨: Vite へ移行して本番ビルドに任せる。単体で選ぶなら esbuild。

この規模では、Terser の数％の圧縮差より、ビルド・モジュール解決・動的 import・アセット処理まで
一つにまとめられることのほうが大きい。既存構成を維持して minifier だけ交換するなら、
設定が非常に少ない **esbuild** が適する。

### 比較

2026-07 更新の同一ベンチマーク（React の例）:
SWC 18ms/8.19KB、Oxc 3ms/8.36KB、**Terser 199ms/8.26KB**、**UglifyJS 420ms/8.18KB**、esbuild 18ms/8.54KB。
→ **gzip 後のサイズは僅差だが、Terser/UglifyJS はかなり遅い**。
[minification-benchmarks](https://github.com/privatenumber/minification-benchmarks)

| 名前 | リポジトリ / ライセンス / 活動 | 速度・圧縮 | このケースでの置換・注意点 |
|---|---|---|---|
| **esbuild** | [evanw/esbuild](https://github.com/evanw/esbuild) · MIT · **v0.28.2（2026-08-08）** 活発 | 非常に高速。Terser より gzip 後が概ね数％大きい | minifier 64 行に加え copy や bundle も置換可能。**導入コスト最低**。最高圧縮率が必要なら不利 |
| **Terser** | [terser/terser](https://github.com/terser/terser) · BSD-2-Clause · **v5.50.0（2026-08）** 活発 | 遅めだが圧縮率は安定して良い | 64 行を数行の API 呼び出しへ。小アプリでは処理時間差は実害なし |
| **SWC** | [swc-project/swc](https://github.com/swc-project/swc) · Apache-2.0 · **v1.16.1（2026-08）** 非常に活発 | 高速で圧縮率もトップ級 | ネイティブバイナリが大きく、**minify だけには過剰** |
| **oxc-minify** | [oxc-project/oxc](https://github.com/oxc-project/oxc) · MIT · **v0.144.0（2026-08）** 非常に活発 | 最速級 | **公式 npm 説明が「alpha、誤った結果を返す可能性」と明記。現時点の第一選択にしない** |
| **uglify-js** | [mishoo/UglifyJS](https://github.com/mishoo/UglifyJS) · BSD-2-Clause · **v3.19.3（最終 publish 2024-08）** 更新は鈍い | 圧縮率は良いが非常に遅い | README も一部の新構文は事前変換を推奨。**ES2022+ を使う新規案件では Terser を選ぶべき** |

### なぜ自作 minifier が危険か — 具体的な破壊パターン

現実の JavaScript は「文字を一字ずつ見て空白とコメントを除く」だけでは解析できない。
**AST を構築する正規のパーサが必要**。この実装では次が起こる。

#### ① 正規表現リテラルと除算の区別ができない

```js
const result = value / /x/.test(text);
```

最初の `/` は除算、次は正規表現の開始。しかし空白を消すと:

```js
const result=value//x/.test(text);   // ← //以降が全部コメント扱い
```

`/` が「除算・正規表現・コメント」のどれかは**前後 1 文字では判断できず、構文上の位置を
理解しなければならない**。

#### ② テンプレートリテラルの中身を書き換えてしまう

現在の処理は、**すべての**テンプレートリテラル内部に対して
`literal.replace(/\s+/g," ").replace(/> </g,"><")` を実行する。
HTML 以外でも改行・連続スペース・タブをデータとして使う可能性があるので、
**通常の文字列値やタグ付きテンプレートの raw 値が変わる**。

さらにネストで壊れる:

```js
`outer ${`inner ${value}`}`
```

`${...}` 内を JavaScript として再帰解析していないため、**内側のバッククォートを外側の終了と誤認**する。

#### ③ ASI（自動セミコロン挿入）を無視している

```js
function f() {
  return
  { ok: true };
}
```

元は `undefined` を返すが、改行を消すと**オブジェクトを返す意味に変わる**。

```js
a
++b
```

ASI により本来 2 文だが、このminifier では `a++b` となり**構文エラー**。

#### ④ その他の未対応

正規表現内の文字クラス / Unicode Sets / flags、private fields、decorators、
import attributes、`async` と改行、`yield`、optional chaining 周辺、
source map、ライセンスコメント、HTML テンプレート中の `<pre>` の空白。

> この 64 行は「単純な minifier」ではなく、**「不完全な JavaScript 字句解析器」**になっている。
> 学習用として一度作る価値はあるが、**成果物の本番処理に残してはいけない**。

---

## 2. 手書き BPE 圧縮 — 削除してよい（実測で確認済み）

### 第一推奨: BPE を完全に削除し、普通の JS 配列を CloudFront の Brotli で配る。クライアント側圧縮ライブラリは入れない。

`docs/DEPLOY.md` の手順は**すでに CloudFront の自動圧縮を Yes にしている**。
`Compress` と gzip/Brotli 対応キャッシュを有効にすれば、`Accept-Encoding` に応じて
CloudFront が圧縮する（[AWS 公式](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html)）。

### 実測（このリポジトリの実データで再測定）

| 形式 | raw | gzip -9 | **Brotli** |
|---|---:|---:|---:|
| 元の `lines.json` | 20,433 B | 6,159 B | 5,544 B |
| **自作 BPE ＋ 復号コード** | 9,022 B | 6,093 B | **4,979 B** |
| **素の `export default [...]`** | 16,056 B | **5,100 B** | **4,681 B** |

> **結論: 素の JS 配列のほうが、自作 BPE より Brotli 後で 298 バイト「小さい」。**

BPE は raw サイズだけ見ると効いているが、**HTTP 圧縮後には独自辞書・トークン・復号コードが
そのまま重複コストになる**。つまり 36 行のコードを書いて、配信サイズを**悪化させていた**。

削減量は `build.js:47–82` の **36 行**。JSON を Vite から import すればビルド側は 0 行にできる。

### クライアント圧縮 OSS（＝ 今回はどれも不要）

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **lz-string** | [pieroxy/lz-string](https://github.com/pieroxy/lz-string) · MIT · npm stable 1.5.0 は約3年前、2.0 は RC | BPE を置換できるが独自形式と復号コードが残る。**localStorage 容量対策向けで HTTP 配信には不採用** |
| **fflate** | [101arrowz/fflate](https://github.com/101arrowz/fflate) · MIT · **v0.8.3（2026-05）** 活発 | 約 8KB のライブラリを 20KB のデータのために足すのは**逆効果**。※ 0.8.2 以前に 2026 年公開の DoS 問題あり、使うなら 0.8.3+ |
| **pako** | [nodeca/pako](https://github.com/nodeca/pako) · MIT AND Zlib · **v3.0.1（2026-07）** 活発 | gzip/deflate 互換が必要な場合に有効。**フル bundle がこのデータより大きい** |
| **brotli-wasm** | [httptoolkit/brotli-wasm](https://github.com/httptoolkit/brotli-wasm) · MIT · v3.0.1（最終 publish 約2年前） | WASM 初期化と追加 asset が必要。**完全に過剰** |
| **`@cloudflare/brotli` 系** | — | **2026-08 時点で、その名前の推奨可能な公式クライアントライブラリを確認できなかった。** Cloudflare Workers では `node:zlib` の Brotli が使えるが、ブラウザ配布用 OSS とは別物 |

`CompressionStream("gzip")` も主要ブラウザで使えるが、これは**ユーザーが作った巨大データを
保存・送信するときの機能**。静的配信の解凍は HTTP 層が自動で行うので、アプリコードから呼ぶ必要はない。

### クライアント圧縮が必要になる条件（今はどれも該当しない）

- localStorage/IndexedDB に数 MB 以上を保存する
- ユーザー生成ファイルを ZIP として書き出す
- サーバーへ送る前にブラウザ側で圧縮する
- HTTP `Content-Encoding` が使えない独自コンテナを扱う
- オフライン単一 HTML へ大量データを埋め込む

---

## 3. 日付ユーティリティ — 実在するバグを 1 件確認

### `daysBetween` に DST バグがある（再現確認済み）

「正午固定」は日付文字列のずれを避けるうえで有効な工夫だが、`daysBetween` は依然として安全ではない。

```js
export function daysBetween(first, last = dateKey()) {
  return Math.floor((fromDateKey(last) - fromDateKey(first)) / DAY);
}
```

DST 開始日をまたぐと、正午どうしの間隔が **23 時間**になり `Math.floor(23/24) === 0` になる。

**実行して再現した結果:**

```
TZ=America/New_York (DST あり)
  2026-03-07 → 2026-03-08 の日数差: 0   ← 期待値 1
  60日開放: 2026-02-01 → 2026-04-02 : 59   ← 期待値 60（開放が1日遅れる）

TZ=Asia/Tokyo (DST なし)
  2026-03-07 → 2026-03-08 の日数差: 1   ← 正常
  60日開放: 2026-02-01 → 2026-04-02 : 60   ← 正常
```

> **重要な但し書き**: 日本（JST）には DST がないため、**国内の利用者には現れない**。
> DST のある地域の端末で使われたときにだけ、60 日開放が 1 日ずれる。
> 「今すぐ壊れている」のではなく「移動したら壊れる」種類のバグ。

### 第一推奨: date-fns を必要な関数だけ import する

`parseISO` / `format` / `addDays` / `differenceInCalendarDays` 程度で足りる。
`differenceInCalendarDays` を使えば「24 時間の経過」ではなく **「カレンダー上の日付差」**という
アプリの意図を直接表現できる（＝上のバグが定義上起きない）。

`date.js` は 112 行だが実コード相当は 57 行。表示文言・60 日アンロック・うるう年基準の
`monthDayIndex` はアプリ固有なので残し、**危険な parse/add/difference だけ任せる**と
物理行で **約 45〜65 行削減**できる。

| 名前 | リポジトリ / ライセンス / 活動 | このケースでの判定 |
|---|---|---|
| **date-fns** | [date-fns/date-fns](https://github.com/date-fns/date-fns) · MIT · **v4.4.0（2026-05）** 活発 | parse/add/difference/format を置換。**必要関数だけ bundle 可能。最小で要件に合う。第一推奨** |
| **Day.js** | [iamkun/dayjs](https://github.com/iamkun/dayjs) · MIT · **v1.11.21（2026 夏）** 活発 | 約 2KB だが厳密 parse や timezone は plugin が必要。チェーン API はこの用途ではやや過剰 |
| **Luxon** | [moment/luxon](https://github.com/moment/luxon) · MIT · **v3.7.2**（安定版は約1年前、2026 にも commit） | 多地域 timezone を扱わない本件では**重い** |
| **Temporal API** | [tc39/proposal-temporal](https://github.com/tc39/proposal-temporal) · 標準 API | `Temporal.PlainDate` は要件に**最も正確**。ただし **2026-08 でも Safari/iOS Safari 未対応で Baseline 外** |
| **Temporal polyfill** | [js-temporal/temporal-polyfill](https://github.com/js-temporal/temporal-polyfill) · BSD-3-Clause · **v0.5.1（2025-03）** | Safari 対応を補えるが、この小アプリには bundle コストと API 規模が大きい |

### このアプリに必要な最小設計

- `YYYY-MM-DD` は「日時」ではなく **date-only 値**として扱う
- `differenceInCalendarDays` で日数を求める（← DST バグの根治）
- `addDays` で前後日を作る
- `format(date, "yyyy-MM-dd")` でキー化する
- 表示は既存の短い日本語関数か `Intl.DateTimeFormat("ja-JP")`
- **`monthDayIndex` と 60 日アンロックは業務ルールとして残す**

> 日付ライブラリへアプリ固有ルールまで隠す必要はない。そこは自作を続ける価値がある。

---

## 4. DOM ヘルパー — ラッパーは要らない

### 第一推奨: ライブラリを追加せず、ブラウザ標準 API を直接使う。

`find` / `listen` / `setMarkup` / `setText` は**完全な別名**であり、
検証・null チェック・サニタイズ・イベント委譲などの付加価値がない。

```js
// 現在
listen(find(root, "[data-back]"), "click", back);

// 標準API — MDN や TypeScript の型情報と直接対応する
root.querySelector("[data-back]").addEventListener("click", back);
```

`dom.js` は 56 行、実コード相当 23 行。ファイル保存だけ残すなら **約 40〜45 行**、
保存処理も利用側へ移せば **56 行すべて削除**できる。

> ただし 02 章の通り、lit-html を採用すればこれらは自然に消える。**ラッパーを剥がすだけの
> 変更を単独でやるより、lit-html 移行に含めるほうがよい。**

### ファイルダウンロード比較

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **Blob + `URL.createObjectURL`** | ブラウザ標準 API | **現在の 8 行をほぼそのまま維持。依存 0。数 KB の JSON/TXT にはこれが定番。第一推奨** |
| **FileSaver.js** | [eligrey/FileSaver.js](https://github.com/eligrey/FileSaver.js) · MIT · **v2.0.5（最終 publish 約6年前）** | 古い Safari/IE 互換が必要なら有効。**現代ブラウザだけなら依存追加の価値が薄い** |
| **StreamSaver.js** | [jimmywarting/StreamSaver.js](https://github.com/jimmywarting/StreamSaver.js) · MIT · **v2.0.6（最終 publish 約5年前）** | 数 GB 級や生成 stream 向け。Service Worker/MITM 設定が必要。**不採用** |
| **File System Access API** | 標準 API | 保存場所指定や継続書き込みが可能。ただし **Safari/Firefox 未対応で Baseline 外** |

> **注意点**: `URL.revokeObjectURL(url)` をクリック直後に同期実行すると、ブラウザによっては
> **保存開始前に破棄される**可能性がある。`setTimeout(() => URL.revokeObjectURL(url), 0)` の
> ようにタスクを一つ遅らせるほうが安全。

---

## 5. フォント自己ホスト・サブセット

### 現状評価 — 「243 ファイル」自体は異常ではない

現在のビルドは 2 フォントの `400.css` から 243 個の `@font-face` を抽出し、
243 個の woff2（計 約 4.5 MiB）を `dist/fonts` へコピーしている。

ただし **「243 ファイルをデプロイしている」と「利用者が 243 ファイル全部を
ダウンロードする」は別**。CSS に `unicode-range` があるため、ブラウザはページに登場した
グリフを含む断片だけを要求する。これは Fontsource / Google Fonts の**正式な日本語配信方式**で、
Google は日本語フォントの分割によって単一ファイル配信より**88% 少ない転送量**になったと説明している。

したがって評価は:

| | 判定 |
|---|---|
| 243 ファイルのデプロイ自体 | **異常ではない**（正式な方式） |
| 243 個を全部読み込んでいるなら | 異常（要確認） |
| **正規表現による CSS 変換** | **不要で壊れやすい。ここが本当の問題** |
| 固定テキストだけの完全サブセット | **不適切**（日本語の自由入力があるため） |

### 第一推奨: Vite のエントリから Fontsource の公式 CSS を直接 import する

```js
import "@fontsource/zen-old-mincho/400.css";
import "@fontsource/zen-kaku-gothic-new/400.css";
```

Vite が CSS の URL を解決し、参照されたフォントを asset として出力する。
Fontsource 公式も bundler の entry からの import を推奨している。
**これで `build.js:19–45` の 27 行が消える。**

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **Fontsource 正式 import** | [fontsource/fontsource](https://github.com/fontsource/fontsource) · ツール MIT / 対象2フォントは **OFL-1.1** · 各 **v5.3.0（2026-07）** 活発 | **第一推奨**。正規表現解析と手動コピー 27 行を import 2 行に |
| **subfont** | [Munter/subfont](https://github.com/Munter/subfont) · MIT · **v7.2.3（2026 初頭）** | 静的 UI 文字を自動抽出。**23 依存で構成が重く、実行時に増えるユーザー入力文字を含められない** |
| **glyphhanger** | [zachleat/glyphhanger](https://github.com/zachleat/glyphhanger) · MIT · **v6.0.0（2026 夏）** 活発 | Puppeteer と fonttools が必要。**自由入力フォントの完全置換には不向き** |
| **fonttools / pyftsubset** | [fonttools/fonttools](https://github.com/fonttools/fonttools) · MIT · **v4.63.0（2026-05-14）** 非常に活発 | 最も精密。Python 環境と文字集合管理が必要。自動化を自分で設計する中〜高コスト |
| **Google Fonts 配信** | フォントは OFL-1.1 | ローカル asset 管理を削除できるが、**外部通信・プライバシー・CSP・オフライン方針と衝突** |
| **unicode-range 分割** | CSS Fonts 標準 | **Fontsource がすでに生成済み。自作分割は不要** |

> `japanese-400.css` という名前のファイルもあるが、これは **約 1.8 MiB の日本語全体 woff2 を
> 一個読む形式**で、小さな画面には通常不利。Fontsource も既定 CSS の `unicode-range` 分割の
> ほうが効率的としている。

### 実務的な構成

- UI 固定文言 → 現在の分割 Fontsource
- ユーザー入力 → 同じ分割フォントから必要な漢字断片だけ追加ロード
- 固定ランディングページだけなら subfont を検討
- **さらに軽量化したければ、ゴシック体はシステムフォントへ戻し、明朝一書体だけを自己ホストする**

---

## 6. Tailwind CSS v4

### 第一推奨: Vite + `@tailwindcss/vite`

Tailwind 公式は、v4 では PostCSS より Vite plugin のほうがさらに高速で、
Vite 利用時は最もシームレスな方法としている。

```js
// vite.config.js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({ plugins: [tailwindcss()] });
```

CSS 側は既存の `@import "tailwindcss";` をそのまま使える。

| 名前 | ライセンス / 活動 | 判定 |
|---|---|---|
| **`@tailwindcss/vite`** | MIT · Tailwind **v4.3.3（2026-07-16）** 非常に活発 | CLI 実行 10 行とビルド全体を Vite へ統合。**今回の第一選択** |
| **`@tailwindcss/postcss`** | MIT · 同リリース系列 | Vite を使わない既存 PostCSS pipeline 向け |
| **`@tailwindcss/cli`** | MIT · **現在導入済み** | CSS だけ処理するなら正当な選択。**問題は CLI そのものではなく、Node から `execFile` して独自ビルドを組み立てたこと** |

現在の 20KB 判定は**発想としては正しい**が、Tailwind 処理と密結合させないほうがよい。
size-limit で **Brotli 後**サイズを CI 監視するほうが、利用者の転送量に近い。

---

## 7. 品質まわり — 今は Lint も型もテストも無い

### 学習者向けの低コスト順

1. **Biome** で format + lint
2. **JSDoc + TypeScript `checkJs`**
3. **`node:test`** で日付・storage・state の単体テスト
4. **size-limit** で配信サイズ監視
5. **Playwright** で 保存 → 再読込 → 復元 の E2E
6. 必要になったら Vitest や本格 TypeScript へ

### Lint / Format

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **Biome** | [biomejs/biome](https://github.com/biomejs/biome) · MIT OR Apache-2.0 · **v2.5.10（2026-08）** 非常に活発 | **最低コスト。設定なしでも開始できる。第一推奨** |
| **ESLint flat config** | [eslint/eslint](https://github.com/eslint/eslint) · MIT · **v10.9.0（2026-08）** 非常に活発 | ルール・plugin が豊富。**v10 では flat config のみ**。学習初期には設定の選択肢が多すぎる |
| **oxlint** | [oxc-project/oxc](https://github.com/oxc-project/oxc) · MIT · **v1.80.0（2026-08-25）** 非常に活発 | 設定なしで高速。ESLint の全 plugin/custom rule 互換ではない |
| **Prettier** | [prettier/prettier](https://github.com/prettier/prettier) · MIT · **v3.9.6（2026 夏）** 非常に活発 | format だけなら簡単。lint には別途 ESLint 等が必要 |

**Biome 一個で始め、Biome にないルールが具体的に必要になった時だけ ESLint へ移る。**

### 型

| 名前 | ライセンス / 活動 | 判定 |
|---|---|---|
| **JSDoc + `checkJs`** | TypeScript · Apache-2.0 · **v7.0.2（2026-08）** 非常に活発 | **ファイルを TS へ変えず開始可能**。`// @ts-check` または `checkJs: true`。**第一段階に最適** |
| **TypeScript 化** | 同上 | 型の強制力は最大。DOM null、storage schema、event 型で効果が高いが移行量は増える |

特に JSDoc 型を付ける価値が高い箇所:
`normalize()` へ入る保存データ / state の `commit` payload / DOM event の target /
date key を受ける関数 / import-export バックアップ構造。

### テスト

| 名前 | ライセンス / 活動 | 判定 |
|---|---|---|
| **node:test** | Node 同梱 · Node 20 以降 stable | **依存 0。date/storage/state の純粋関数に最適。最初の第一推奨** |
| **Vitest** | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) · MIT · **v4.1 系（2026 継続更新）** | watch、mock、coverage、DOM 環境が使いやすい。**Vite 導入後の次候補** |
| **Playwright** | [microsoft/playwright](https://github.com/microsoft/playwright) · Apache-2.0 · **v1.62.1（2026-07-30）** 非常に活発 | localStorage、history、動的 import を実際に検証。**ブラウザ取得が重いので単体テストより後** |

**最初に書くべきテスト:**

- **DST 開始・終了日の `daysBetween`**（← 上で確認したバグの回帰テスト）
- 月末、年末、うるう日
- 60 日ちょうどのアンロック
- 壊れた localStorage の normalize
- JSON export → clear → import の往復
- 履歴の戻る/進む
- 日本語入力後の再読込
- TXT/JSON ダウンロード

### サイズ監視

| 名前 | ライセンス / 活動 | 判定 |
|---|---|---|
| **size-limit** | [ai/size-limit](https://github.com/ai/size-limit) · MIT · **v11.2.0（2026 春）** | 現在の 4 行の 20KB 判定を置換。CSS だけなら `@size-limit/file` と `webpack:false`。**第一推奨** |
| **bundlesize** | [siddharthkp/bundlesize](https://github.com/siddharthkp/bundlesize) · MIT · **v0.18.2（最終 publish 約2年前）** | 設定は簡単だが更新が鈍い。**新規採用は size-limit を優先** |
| **Vite 出力サイズ表示** | Vite · MIT | 追加依存 0。ただし**上限超過で CI を失敗させる budget 機能ではない** |

---

## 最終的な推奨構成

```
Vite
├── JS bundle/minify        ← 自作 minifier 64 行を廃止
├── static assets           ← copy/clean 17 行を廃止
├── dynamic import
├── Fontsource CSS / woff2  ← 正規表現変換 27 行を廃止
└── @tailwindcss/vite       ← CLI execFile 10 行を廃止

CloudFront
└── Brotli / gzip           ← 自作 BPE 36 行を廃止（しかも配信サイズが改善する）

アプリ
├── date-fns（必要関数だけ） ← DST バグを根治
├── 素の DOM API
└── Blob + URL.createObjectURL

品質（新規）
├── Biome
├── TypeScript checkJs
├── node:test
├── Playwright
└── size-limit
```

---

## 自作を続けてよい領域

汎用ライブラリへ追い出さず、アプリ固有コードとして残す価値があるもの:

- 60 日後に読み返せるというルール
- 直近 7 日と全期間の表示方針
- `monthDayIndex` と 366 件の文言対応
- 日本語の日付表示方針
- TXT/JSON のバックアップ内容
- UI 上の「かけら」「今月のひとつ」という状態遷移
- 20KB など、このサイト独自の性能 budget 値

反対に **JavaScript 構文解析・圧縮アルゴリズム・フォント CSS 解析・カレンダー日数計算**は、
自作を本番へ残す利点がほぼない。

> 今回もっとも明確な車輪の再発明は **minifier と BPE**。
> もっとも実害が出ているのは **DST 日数計算とフォント用正規表現**。
