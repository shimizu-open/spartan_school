# B. 「かけら」アプリ基盤のOSS調査

調査日: 2026-08-25  
対象: [`02.homework/05.week5/web`](/home/shimizu/study/spartan_school/02.homework/05.week5/web)

## 結論――この人ならこれ

第一推奨は、次の「必要な所だけOSS化する」構成です。

- **Vite 8**
- **lit-html**
- **Valibot**
- ルーター・状態管理・永続化は当面ブラウザ標準と現行コードを維持
- オフライン化は、最初は小さな自作Service Worker。更新制御が複雑になったら `vite-plugin-pwa`

Viteは、自作minifier、copy/clean、動的importの分割、CSS・Fontsource資産処理をまとめて置換できます。UIは現在のテンプレートリテラルに最も近いlit-htmlへ移すと、ユーザー入力を通常の補間で安全なテキストとして扱え、XSS対策と移行コストのバランスが最良です。

一方、4画面・単一オブジェクト・数十KB未満の保存データに、ルーター、状態管理、IndexedDBを一度に導入しても複雑さの方が増えます。ここは自作を残す方が合理的です。

## 現物から分かったこと

| 対象 | 物理行 | コメント・空行を除く概算 |
|---|---:|---:|
| `scripts/build.js` | 159 | 148 |
| `main.js` | 236 | 139 |
| `state.js` | 135 | 81 |
| `storage/local.js` | 70 | 34 |
| `lib/dom.js` | 56 | 23 |
| `views/*.js` 合計 | 706 | 510 |

### 現在のXSSリスク

[`dom.js`](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/app/lib/dom.js:15) の `setMarkup()` は `innerHTML` を直接使用しています。ただし、現在の保存済みユーザーデータは、`feeling`、`done`、`person`、`goal`とも、その後に `textContent` で挿入されています。したがって、確認した現行経路には、ユーザー文字列をそのままHTMLへ連結する明白な箇所はありません。

問題は構造です。12箇所の `setMarkup()` と21箇所の `setText()` の対応を人間の規律で維持しているため、将来 `${entry.feeling}` のような補間を1回追加するだけで、保存型XSSへ変わります。lit-htmlなどでは通常の `${value}` がテキストノードになるため、この取り違えを構造的に減らせます。Lit自身も、静的テンプレートと動的値を分離して処理し、`unsafeHTML`/`unsafeStatic` は明示的な危険操作として隔離しています。[Lit expressions](https://lit.dev/docs/v2/templates/expressions/), [Lit内部のセキュリティ設計](https://github.com/lit/lit/blob/main/packages/lit-html/src/lit-html.ts)

### 自作BPEは削除してよい

実測値は次の通りです。

| 形式 | 非圧縮 | gzip -9 |
|---|---:|---:|
| 元の `lines.json` | 20,433 B | 6,161 B |
| 自作BPE生成後 `lines.js` | 9,022 B | 6,098 B |

差はgzip後でわずか **63 B** です。約40行のBPE生成処理と復号器を維持する価値はありません。ViteでJSONをimportし、CloudFrontでgzip/Brotliを配信する方がよいです。

---

## 1. ビルドツール

ビルドツール自体はブラウザに送られないため、ランタイムgzip増分は原則0 KBです。

| 名前・一行説明 | リポジトリ / ライセンス / 活動状況 | このケースで置き換わるもの | 採用コスト・注意点 |
|---|---|---|---|
| **Vite** — 開発サーバーと本番ビルドを一体化した標準的フロントエンド基盤 | [vitejs/vite](https://github.com/vitejs/vite) / MIT。8.2.2、2026-08-20公開で活発。Vite 8はRolldownを本番bundlerとして使用。[npm](https://www.npmjs.com/package/vite), [Vite 8発表](https://vite.dev/blog/announcing-vite8) | JS minify、bundle、dynamic import分割、HTML/CSS/JSON処理、public copy、ハッシュ付き資産、dev server。`build.js` 159行のほぼ全体 | **低**。`@tailwindcss/vite` とFontsource CSS importを加える。第一推奨 |
| **esbuild** — Go製の高速bundler/minifier | [evanw/esbuild](https://github.com/evanw/esbuild) / MIT。0.28.2が2026年時点の公式導入例で、2026年にも更新あり。[公式](https://esbuild.github.io/getting-started/) | 自作minifierとJS bundle。copy、HTML、PWA、Fontsource処理は別スクリプトが必要 | **中**。速いが、このアプリではViteより自作処理が残る |
| **Rolldown** — Rust製、Rollup互換を目指すbundler | [rolldown/rolldown](https://github.com/rolldown/rolldown) / MIT。1.2.5、2026-08公開で非常に活発。[npm](https://www.npmjs.com/package/rolldown) | JS/CSS bundle、minify、code splitting | **中**。単体利用ではHTML・dev server等を組み合わせる必要がある。Vite経由で使う方が自然 |
| **Parcel** — HTMLを入口に資産全体をゼロ設定で処理するbundler | [parcel-bundler/parcel](https://github.com/parcel-bundler/parcel) / MIT。2.16.4、2026-02公開。現役だがViteよりリリース頻度は低い。[npm](https://www.npmjs.com/package/parcel) | HTML、JS、CSS、fonts、copy、minifyをほぼ全面置換 | **低～中**。ゼロ設定は魅力だが、Tailwind/PWA周辺の事例量と小規模Vite構成の分かりやすさで次点 |
| **Bun bundler** — runtime/package manager/test/bundlerを一体化 | [oven-sh/bun](https://github.com/oven-sh/bun) / 主コードMIT、同梱物は各ライセンス。1.3.14が2026-05公開で活発。[HTML build公式](https://bun.sh/docs/bundler/html-static) | HTML、JS、CSS、資産処理、minify | **中**。Node.js 22/npmという前提をBunへ広げる。機能は十分だが、このためだけに実行環境を増やす理由が弱い |
| **素のESM・ビルドなし** — ブラウザにソースをそのまま配る | Web標準、ライセンスなし。import mapsも広く利用可能。[MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) | copy/minifyをやめれば `build.js` 自体を削除可能 | **低に見えて中**。npm bare import、Tailwind生成、Fontsource配布、キャッシュ無効化、PWA precache一覧が手作業になる。依存なしの学習用なら有効だが今回は不採用 |

### `build.js` は何行消えるか

Viteへ移し、自作BPEをやめ、FontsourceをCSS importにすると、`build.js` 159行は削除できます。代わりに概ね以下です。

- `vite.config.js`: 10～20行
- `package.json` scripts: 2行
- 必要ならCSSサイズ検査plugin: 8～15行

したがって、**純減約125～145行**が現実的です。Fontsourceの243個のwoff2は総計約4.5 MBなので、Vite化とは別に、日本語サブセットやシステムフォント優先の検討余地があります。

---

## 2. UIレンダリングとXSS

サイズは原則minified+gzipの概算です。tree shakingや実際に使うAPIで変化します。

| 名前・一行説明 | Repo / ライセンス / 活動・サイズ | XSS耐性・置換範囲 | 採用コスト・注意点 |
|---|---|---|---|
| **lit-html** — 現在のテンプレートリテラルを安全なDOM templateへ変える | [lit/lit](https://github.com/lit/lit) / BSD-3-Clause。`lit-html` 3.3.3、2026年公開で活発。[npm](https://www.npmjs.com/package/lit-html)。現行正確値は未確認、過去公式測定は約2.8～3.8 KB gzip | 通常の`${userText}`はテキストとして処理される。`unsafeHTML`だけが危険。`setMarkup`、`setText`、大半の`find/listen`を置換 | **低～中**。既存HTML文字列をほぼそのまま移植できる。**第一推奨** |
| **Preact + htm** — JSXなしでReact風コンポーネントを使う | [preactjs/preact](https://github.com/preactjs/preact) MIT、10.29.xが2026年にも更新。[developit/htm](https://github.com/developit/htm) Apache-2.0、3.1.1は約4年前。Preact約4 KB + htm約0.5 KB gzip。[Preact releases](https://github.com/preactjs/preact/releases), [htm](https://www.npmjs.com/package/htm) | 子文字列は安全にDOM textへ渡る。生HTMLは`dangerouslySetInnerHTML`という明示的な逃げ道。UI、状態、イベントをコンポーネント化 | **中～高**。安全だがReact式の再設計が必要。htm本体の更新が止まっている |
| **Alpine.js** — HTML属性内の宣言で画面挙動を付ける | [alpinejs/alpine](https://github.com/alpinejs/alpine) / MIT。3.16.2、2026-08公開。約12～14 KB gzip。[npm](https://www.npmjs.com/package/alpinejs) | `x-text`は安全、`x-html`はXSSになり得ると公式警告。[公式templating](https://alpinejs.dev/essentials/templating) | **中**。サーバー生成HTMLや小さな装飾に向く。画面全体をJSで再生成している本件には相性が悪い |
| **Solid** — fine-grained reactivityを持つコンパイル型UI | [solidjs/solid](https://github.com/solidjs/solid) / MIT。1.9系が2026年更新、2.0は調査時点でRC前後。1.x最小app約4.2 KB、full core/store/web約18 KB gzip | JSXの通常補間はテキスト。`innerHTML`は危険な逃げ道。UIとstateを全面置換 | **高**。Vite plugin、JSX、Solidのリアクティブモデルを学ぶ必要があり、この規模では過剰。[サイズ測定](https://github.com/solidjs/solid/issues/2883) |
| **Svelte** — `.svelte`をDOM更新コードへコンパイルするUI compiler | [sveltejs/svelte](https://github.com/sveltejs/svelte) / MIT。5.56.10、2026-08公開で非常に活発。[npm](https://www.npmjs.com/package/svelte)。最小app約14.9 KB、実アプリ依存 | 通常の `{value}` はテキスト。`{@html}` は未サニタイズなら危険。ビューと局所状態を全面置換 | **高**。読みやすいがファイル形式・compiler・runesを導入する。4画面には大きい |
| **VanJS** — DOM関数を直接組み合わせる約1 KBのリアクティブUI | [vanjs-org/van](https://github.com/vanjs-org/van) / MIT。1.6.1、2026-07公開。約1.0 KB gzip。[npm](https://www.npmjs.com/package/vanjs-core) | 文字列childrenはText nodeとなるため安全。DOM nodeやプロパティを明示的に扱う | **中**。極小で理解しやすい。一方、長いTailwind classを持つ既存HTMLが `div({...}, ...)` の深い関数呼び出しになり、可読性が落ちる |
| **hyperscript系 `h()`** — JS関数でDOM nodeを生成する最小方式 | 代表例 [hyperhype/hyperscript](https://github.com/hyperhype/hyperscript) / MIT。2.0.2で長期間更新なし、gzip現行値未確認 | string childはText nodeとなり、`innerHTML`連結を避けられる | **中**。構造的には安全だが、代表実装が古く、リアクティブ更新も別途必要。VanJSまたはPreactの`h()`の方がよい |

### UIの判断

lit-htmlがこのケースに最適です。例えば、現在の次の二段階処理、

```js
setMarkup(root, `<p data-feeling></p>`);
setText(find(root, "[data-feeling]"), entry.feeling);
```

は、

```js
render(html`<p>${entry.feeling}</p>`, root);
```

になります。HTMLとして解釈したい場合だけ `unsafeHTML` をimportするため、レビューでも危険箇所を検索できます。

ただし、どのUIライブラリでも次は別問題です。

- `href`、`src`へユーザー入力を渡す場合の`javascript:`等
- `unsafeHTML`、`innerHTML`、`dangerouslySetInnerHTML`
- event handler文字列
- 信頼できないHTMLを表示する場合のサニタイズ

CSPとTrusted Typesは補助防御として有効ですが、通常のテキスト補間を使うことが第一です。

---

## 3. ルーター

| 名前・一行説明 | Repo / ライセンス / 活動・gzip | 置換範囲 | 採用コスト・不採用理由 |
|---|---|---|---|
| **navaid** — 約1 KBの小型URL router | [lukeed/navaid](https://github.com/lukeed/navaid) / MIT。最終安定版は1.2.0前後、近年のリリースは未確認。約1 KB gzip | `pushState`、`popstate`、route dispatch | **低**。pathnameを本当に付けるなら第一候補。ただし現在は履歴stateだけなので利益が小さい |
| **page.js** — Express風の小型client router | [visionmedia/page.js](https://github.com/visionmedia/page.js) / MIT。1.11.6、最終リリース時期は古く近年は低活動。gzip約2～4 KB、現行測定未確認 | URL matching、リンク捕捉、popstate | **中**。S3/CloudFrontで全routeを`index.html`へfallbackする設定が必要。現状には過剰 |
| **@remix-run/router** — data loader/actionまで持つframework-agnostic router | [remix-run/react-router](https://github.com/remix-run/react-router) / MIT。1.23.3～1.23.4、2026-08公開で活発。[npm](https://www.npmjs.com/package/%40remix-run/router)。gzipは数十KB級、正確値未確認 | routing、loader、mutation、race/cancellation | **高**。サーバー通信のない4画面には明確に過剰。パッケージ自身もReact Router内部向けと説明 |
| **wouter** — React/Preact向けの小型router | [molefrog/wouter](https://github.com/molefrog/wouter) / MIT。3.x、近年の正確な最終公開は未確認。公式値約2.1 KB gzip | Preact採用時のroute hooks | **中**。Preact/Solid等とセットなら候補。lit-htmlやvanilla単独には合わない |
| **Navigation API** — SPA向けの新しいブラウザ標準 | Web標準、0 KB。2026年1月からBaseline 2026。ただし古い端末には未対応。[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) | navigation intercept、history entry管理 | **中**。新規学習には有益だが、古いiOS等を含めるならfallbackが必要 |
| **History API** — 現在使っている成熟した標準API | Web標準、0 KB。全対象ブラウザで安定 | 現状のまま | **低**。この規模の第一推奨。route部分を小関数へ整理するだけで十分 |

### 判断

このアプリはURL pathnameを変えず、同じページ内の4つの`section`を切り替えています。したがって**ライブラリを追加せずHistory APIを継続**するのが妥当です。

将来 `/today`、`/fragments` の共有可能URLが必要になった時にnavaidを導入してください。その場合はCloudFront Functions等でunknown pathを`index.html`へ戻す設定も必要です。

---

## 4. 状態管理

| 名前・一行説明 | Repo / ライセンス / 活動・gzip | 置換範囲 | 採用コスト・注意点 |
|---|---|---|---|
| **nanostores** — atom中心の極小store | [nanostores/nanostores](https://github.com/nanostores/nanostores) / MIT。2026年も更新中。公式値340～864 BはBrotli、gzipも概ね1 KB未満 | `value`、`Set`、`getState`、`subscribe`、`commit` | **低**。導入するなら第一候補。ただしdomain actionは残る |
| **zustand/vanilla** — Reactなしでも使える単一store | [pmndrs/zustand](https://github.com/pmndrs/zustand) / MIT。5.0.15、2026-08公開で活発。vanilla coreは約1 KB前後、全package測定は約3.5 KB gzip | `getState/setState/subscribe`を直接置換 | **低**。現行実装とほぼ同じ。依存を増やして得るものが少ない。[vanilla API](https://github.com/pmndrs/zustand/blob/main/src/vanilla.ts) |
| **Valtio** — mutable objectをProxyで追跡するstore | [pmndrs/valtio](https://github.com/pmndrs/valtio) / MIT。2.3.2、2026-05公開で活発。gzip現行値未確認、数KB級 | immutable spread更新をmutableなProxy操作へ変更 | **中**。コードは短くなるが、現在の明示的commit経路を崩す。小規模vanilla appでは利点が弱い |
| **@preact/signals-core** — framework非依存のsignal/computed/effect | [preactjs/signals](https://github.com/preactjs/signals) / MIT。1.14.4、2026年夏公開で活発。約1.6 KB gzipの測定例 | storeと購読、derived state | **中**。細粒度DOM更新を採用すると有効。全画面再renderの現状では能力を活かせない |
| **solid-js/store** — SolidのProxyベースstore | [solidjs/solid](https://github.com/solidjs/solid) / MIT。1.9系更新中、2.0移行期。単独正確gzip値は未確認 | store、nested immutable update | **高**。Solid UIと一緒なら自然。vanilla単独で採る理由はない |

### 判断

[`state.js`](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/app/state.js:26) のstore基盤そのものは約20行です。残りの多くは `saveEntry` や `markOutingWent` というアプリ固有のdomain logicなので、状態管理ライブラリでは消えません。

したがって、現状維持を推奨します。複数の独立storeやderived stateが増えた時だけnanostoresへ移すのがよいでしょう。

---

## 5. 永続化

| 名前・一行説明 | Repo / ライセンス / 活動・gzip | 置換範囲 | 採用コスト・注意点 |
|---|---|---|---|
| **idb-keyval** — IndexedDBをlocalStorage風Promise APIにする極小wrapper | [jakearchibald/idb-keyval](https://github.com/jakearchibald/idb-keyval) / Apache-2.0。6.3.0、2026年夏公開で活発。[npm](https://www.npmjs.com/package/idb-keyval)。gzipは約0.6～1 KB、現行公式値未確認 | `localStorage.getItem/setItem` | **中**。`initialize`と`commit`をasync化する必要がある。IndexedDBが必要になった時の第一候補 |
| **Dexie.js** — schema、query、transaction、migrationを備えたIndexedDB wrapper | [dexie/Dexie.js](https://github.com/dexie/Dexie.js) / Apache-2.0。4.4.5、2026-08公開で活発。[npm](https://www.npmjs.com/package/dexie)。約26～31 KB gzip | storage、query、transaction、schema version migration | **高**。数百件の単一JSONには過剰。検索・索引・複数tableが必要になれば有力 |
| **localForage** — IndexedDB/WebSQL/localStorageを統一する古典的wrapper | [localForage/localForage](https://github.com/localForage/localForage) / Apache-2.0。1.10.0、最終リリースは2021年で実質低活動。公式8.8 KB gzip | localStorage APIをasync storageへ | **中**。WebSQL fallback等が現代には不要。新規採用はidb-keyvalを優先 |
| **RxDB** — reactive query・replicationを備えたlocal-first DB | [pubkey/rxdb](https://github.com/pubkey/rxdb) / Apache-2.0。17.4.0、2026-07公開で非常に活発。[changelog](https://github.com/pubkey/rxdb/blob/master/CHANGELOG.md)。機能構成により大きく、過去full bundleは約100 KB gzip | storage、schema、reactive query、同期・競合処理 | **非常に高**。サーバー同期も複数端末共有もない本件には完全に過剰 |

### localStorageのままでよいか

**現状はlocalStorageのままでよい**です。

Web Storageは同期APIで、大量データではmain threadを止めます。一方で一般的な上限はlocalStorage 5 MiB、sessionStorageと合わせ10 MiB程度です。[MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), [Storage quota](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

このアプリは1日最大約300文字程度です。数年使っても通常は数百KBであり、保存頻度も操作ごとに1回です。IndexedDB移行の条件は次のいずれかです。

- 画像・音声・Blobを保存する
- 数千～数万件を索引検索する
- 1回のJSON stringify/parseで体感停止が出る
- 1 MiB前後へ近づく
- transactionが必要になる
- 複数tabやバックグラウンド処理との競合が増える

ただし現在の `save()` は `QuotaExceededError` やstorage禁止をcatchしていません。保存失敗をユーザーへ通知し、バックアップを促す処理は追加すべきです。

---

## 6. スキーマ検証

| 名前・一行説明 | Repo / ライセンス / 活動・gzip | 置換範囲 | 採用コスト・注意点 |
|---|---|---|---|
| **Zod / Zod Mini** — 最も普及したschema validator | [colinhacks/zod](https://github.com/colinhacks/zod) / MIT。4.4.3、2026-05公開で活発。通常版core約5.36 KB、Mini約1.88 KB gzip。[公式サイズ](https://zod.dev/v4?id=introducing-zod-mini) | `normalize()`、`validBackup()`、form/storage validation | **低～中**。資料量最大。JSでも使えるが、型推論の最大利点はTypeScript化した時 |
| **Valibot** — tree-shaking前提の小型schema validator | [open-circle/valibot](https://github.com/open-circle/valibot) / MIT。1.4.2、2026-06公開で活発。小schemaは700 B未満、本件相当は概ね1～3 KB gzip | `normalize()`と`validBackup()`を同じschemaへ統合 | **低**。小さい、変換をschemaに載せられる。**このケースの第一推奨** |
| **ArkType** — TypeScript風文字列構文でschemaを書くvalidator | [arktypeio/arktype](https://github.com/arktypeio/arktype) / MIT。2.2.3、2026-07公開で活発。gzip現行値未確認、一般にValibot/Zod Miniより大きい | normalize、backup validation | **中**。表現力は高いが、素のJavaScript学習者には独自構文の理解コストが増える |
| **Standard Schema** — validator間の相互運用interface | [standard-schema/standard-schema](https://github.com/standard-schema/standard-schema) / MIT。2026年にも活発。仕様/interfaceなので実質0 KB | validatorそのものは置換しない | **低だが目的外**。Zod/Valibot/ArkTypeを受け取るlibrary作者向け。単独では保存データを検証できない |

### 現行`normalize()`の問題

[`storage/local.js`](/home/shimizu/study/spartan_school/02.homework/05.week5/web/src/app/storage/local.js:40) は、`entries`と`outings`がオブジェクトかだけを検査し、中の各entryの型や長さを検査していません。一方、backup import側の `validBackup()` は深く検査しています。同じデータ形式に二つの検証規則があり、将来ずれる可能性があります。

Valibotで1個の`StateSchema`を定義し、次の全境界で共用するべきです。

- localStorage load
- backup import
- migration各段の出力
- 必要なら保存直前
- テストfixture

### 壊れた保存データの復旧パターン

「1項目壊れたら全記録を初期化」は避けます。

1. `localStorage`の生文字列を読む。
2. JSON parse失敗時は、壊れた生文字列を `kakera.state.corrupt.<timestamp>` に退避。
3. versionだけを最小schemaで読む。
4. 旧versionなら段階的にmigration。
5. 最新schemaで`safeParse`。
6. `entries`は1件ずつ検証し、壊れた日だけ隔離する。
7. 正常部分を最新キーへ書き込んだ後にだけ旧キーを残す／削除する。
8. 「3件復旧、1件隔離」のようにユーザーへ通知し、壊れた原本をexport可能にする。

個人の日記に近いデータなので、黙って全消去するより部分復旧を優先すべきです。

---

## 7. オフライン / PWA

| 名前・一行説明 | Repo / ライセンス / 活動・サイズ | 置換範囲 | 採用コスト・注意点 |
|---|---|---|---|
| **vite-plugin-pwa** — Vite成果物からmanifestとprecache SWを生成 | [vite-pwa/vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) / MIT。1.3.0、2026-05公開。生成SWサイズは設定依存 | precache manifest生成、SW registration、更新通知 | **低**。Vite採用時の最短距離。ただし現packageは今後maintenance mode、新しい`@vite-pwa/*`へ移行予定と表明されている。[移行告知](https://github.com/vite-pwa/vite-plugin-pwa/issues/933) |
| **Workbox** — caching strategyとprecacheを提供するGoogle製toolkit | [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) / MIT。7.4.0、2025-11公開。使用moduleによって数KB～、正確なgzipは構成依存 | SWのprecache、routing、cache更新、fallback | **中**。この規模には直接利用が大きい。上記の後継移行も見極める |
| **素のService Worker** — Cache APIとfetch eventを直接使う | Web標準、0 KB依存。実装は概ね30～50行 | app shellのprecacheとoffline response | **中**。依存ゼロで理解しやすいが、cache version、古いcache削除、更新待ち、hash資産一覧の同期を自分で管理する |

現在のmanifestは、name、icons、start_url、displayなど基本要件を満たしています。ただしmanifestだけではアプリ資産はofflineになりません。Service WorkerでHTML、JS、CSS、fonts、iconsをCache Storageへ入れる必要があります。[PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [PWA caching](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching)

### 最短距離

- Vite移行と同時なら `vite-plugin-pwa` の `generateSW` を5～10行設定。
- Vite移行前に学習目的で試すなら、素のService Workerを1本追加。
- `skipWaiting`で勝手に即時更新すると、開いている旧HTMLと新chunkが混ざる場合があるため、更新通知→reloadの方が安全。
- 4.5 MBの日本語fontをすべてprecacheすると、初回offline準備が重くなる。font削減を先に行う。

---

## 8. データ移行・バージョニング

### 利用できるOSS

IndexedDBへ移行するなら、Dexieの `db.version(n).stores(...).upgrade(tx => ...)` が成熟した選択肢です。upgradeはtransaction内で実行されます。[Dexie migration公式](https://dexie.org/docs/Dexie/Dexie.version%28%29)

一方、単一のlocalStorage JSONについて、広く定着した「標準migration library」はほぼありません。永続化ライブラリや状態管理middlewareにmigration機能を持つ例はありますが、それだけのためにstore全体を交換するほどではありません。Zodもschema migration自体は対象外としています。[Zod discussion](https://github.com/colinhacks/zod/issues/3604)

### 推奨する定石

キー名にだけ`v1`を入れるより、payload内の整数versionを正本にします。

```js
const migrations = {
  1: (v1) => ({ ...v1, version: 2, settings: {} }),
  2: (v2) => ({ ...v2, version: 3 }),
};

function migrate(input) {
  let value = input;
  while (value.version < CURRENT_VERSION) {
    const step = migrations[value.version];
    if (!step) throw new Error(`Missing migration from v${value.version}`);
    value = step(value);
  }
  return CurrentStateSchema.parse(value);
}
```

実務上の条件は次の通りです。

- migrationは `v1→v2→v3` と一段ずつ書く。
- 各段の入力・出力をfixture testする。
- 同じ入力を再度処理して壊れないようにする。
- migration開始前に生データを退避する。
- 最新形式の保存成功後まで旧キーを消さない。
- 未知の未来versionは初期化せず、「このアプリ版では読めない」として保持する。
- migration失敗と通常のschema破損を別エラーとして扱う。
- exportファイルにもversionを必須にする。

---

## 現状コードと置換後の対応表

行数は現物を基にした実装見積りです。アプリ固有の処理は残るため、ライブラリのAPI呼び出しだけを数えて「1行で全部消える」とはしていません。

| 現状の自作コード | 現状行数 | 推奨置換 | 置換後の概算 | 純減・効果 |
|---|---:|---|---:|---|
| clean / mkdir / static copy / public copy | 約12行 | Vite `publicDir` / `build.outDir` | 0～3行設定 | 約9～12行減 |
| 自作JS minifier + tree走査 | 約48行 | Vite/Rolldown minify | 0行 | 約48行減、パーサ誤判定を解消 |
| Tailwind CLI起動 | 約10行 | `@tailwindcss/vite` | 2～4行 | 約6～8行減 |
| CSS 20 KB検査 | 約5行 | 小さなVite pluginまたは`size-limit` | 5～10行 | 行数は同等、検査を独立化 |
| Fontsource CSS正規表現変換・243ファイルcopy | 約36行 | Fontsource CSS import + Vite assets | 2～4行 | 約32行減 |
| JSON文言の自作BPE | 約40行 | JSON import + HTTP gzip/Brotli | 1行 | 約39行減。gzip差は63 Bのみ |
| `build.js` 全体 | 159行 | Vite config | 10～25行 | **約134～149行減** |
| `setMarkup` + 空placeholder + `setText` | views内多数 | lit-html `html` / `render` | 1 template表現 | views全体で約70～120行減見込み、XSS規律を構造化 |
| `find` + `listen` | DOM helper約20行＋各view | lit-html `@click`、`.value`、`?hidden` | template内 | helperの大半と再queryを削除 |
| ルーター自作 | `main.js`中約70～90実効行 | **History APIを整理して継続** | 約35～50行 | 約20～40行減。外部依存なし |
| `value + Set + get/subscribe/commit` | 約20～25行 | **現状維持**。必要時nanostores 4～8行 | 現状のまま | domain actionは消えないため置換効果が小さい |
| localStorage read/write | 約15行 | **現状維持** | 15～20行 | `QuotaExceededError`通知だけ追加 |
| `normalize()` | 約13行 | Valibot `StateSchema` | schema約25～35行 | 単体では増えるが、深い検証を獲得 |
| backup用`validBackup()` | 約31行 | 同じValibot schemaを再利用 | 1～3行 | normalizeとの重複を解消、合計では約10～20行減 |
| v1キーだけのversion設計 | 数行 | migration map + Valibot | 約20～30行 | 行数は増えるが、データを失わない |
| webmanifestのみ | 23行 | manifest維持 + SW | 自作30～50行、plugin設定5～10行 | offline機能を新規獲得 |
| `downloadFile()` | 12行 | **自作継続** | 同程度 | 十分小さく安定。OSS化不要 |
| 日付utility 112行 | 112行 | **今回の基盤範囲では自作継続** | 同程度 | domain仕様が強く、汎用date libraryへ替える利益が小さい |

## 自作を続けた方がよい領域

- 4画面だけのHistory API同期
- `saveEntry`、60日開放、外出記録などのdomain action
- BlobによるJSON/テキストexport
- DSTを避ける日付キー計算
- 小規模localStorage adapter
- データmigration関数そのもの

これらは短く、アプリ固有で、ライブラリへ移しても本質的なコードが消えません。反対に、自作minifier、BPE、HTML文字列と`innerHTML`の組み合わせ、深いschema検証は、既存OSSに任せる価値が高い領域です。

## 推奨導入順

1. Viteへ移し、`build.js`、自作minifier、BPEを削除。
2. Valibotで保存・backup共通schemaを作り、壊れたデータを退避する。
3. viewを1画面ずつlit-htmlへ移す。
4. localStorage保存失敗の通知と自動backup導線を追加。
5. font資産を削減してからService Workerを追加。
6. IndexedDB、router library、state libraryは、実際の要件が発生するまで導入しない。