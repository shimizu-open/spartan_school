# 02. 「かけら」(SPA) を OSS で組み直すなら

対象: `02.homework/05.week5/web`
調査: codex + web search（2026-08-25 実施）

---

## 結論 — 「必要な所だけ OSS 化する」

**全部をライブラリに置き換えるのは間違い**、というのが調査の結論。
4 画面・単一オブジェクト・数十 KB 未満の保存データに、ルーター・状態管理・IndexedDB を
一度に導入しても複雑さのほうが増える。

**採用すべき 3 つ**
| | 何のため |
|---|---|
| **Vite** | 自作 `build.js` 159 行を丸ごと消す |
| **lit-html** | `innerHTML` の XSS 対策を「規律」から「仕組み」に変える |
| **Valibot** | `normalize()` と `validBackup()` の二重の検証規則を 1 つに統合する |

**採用しないほうがよいもの（現状維持）**
ルーター（History API のまま）／状態管理ライブラリ／IndexedDB／日付ライブラリ
（※日付は 03 章で date-fns を推奨。ここは判断が分かれた点として後述）

---

## 1. ビルドツール — Vite で `build.js` は消える

ビルドツール自体はブラウザに送られないので、**ランタイムの増加は 0 KB**。

| 名前 | リポジトリ / ライセンス / 活動状況 | 置き換わるもの | コスト・注意点 |
|---|---|---|---|
| **Vite** | vitejs/vite · MIT · 活発 | minify、copy/clean、動的 import の分割、CSS、Fontsource 資産処理を**まとめて** | **低。第一推奨** |
| **esbuild** | evanw/esbuild · MIT · **v0.28.2（2026-08-08）** | minify + bundle | 低。単体で使うなら最有力（03 章参照） |
| **Rolldown** | rolldown/rolldown · MIT | Vite の内部バンドラ | Vite 経由で自然に使うことになる |
| **Parcel** | parcel-bundler/parcel · MIT | 設定ゼロのビルド | 中。設定が要らない反面、細かい制御が効きにくい |
| **Bun bundler** | oven-sh/bun · 主コード MIT · **v1.3.14（2026-05）** | HTML/JS/CSS/資産/minify | **中**。Node 22 + npm という前提を Bun に広げる必要。これだけのために実行環境を増やす理由は弱い |
| **素の ESM（ビルドなし）** | Web 標準 · 0 KB | `build.js` 自体を削除できる | **低に見えて中**。npm bare import、Tailwind 生成、Fontsource 配布、キャッシュ無効化、PWA precache 一覧が全部手作業になる。**不採用** |

### `build.js` は何行消えるか

Vite へ移し、自作 BPE をやめ、Fontsource を CSS import にすると **159 行は削除できる**。
代わりに必要なのは:

- `vite.config.js`: 10〜20 行
- `package.json` scripts: 2 行
- CSS サイズ検査 plugin（必要なら）: 8〜15 行

**純減 約 125〜145 行。**

---

## 2. UI レンダリング — ここが一番重要

### 現状の XSS リスクは「まだ起きていないが、構造的に起こる」

調査で現行コードを追った結果:

> `dom.js` の `setMarkup()` は `innerHTML` を直接使う。ただし現在の保存済みユーザーデータ
> （`feeling` / `done` / `person` / `goal`）は、**その後に `textContent` で挿入されている**。
> 確認した現行経路に、ユーザー文字列をそのまま HTML へ連結する明白な箇所はない。

**つまり今は穴が空いていない。** 問題は構造のほう。

12 箇所の `setMarkup()` と 21 箇所の `setText()` の対応を**人間の規律で維持している**ため、
将来 `${entry.feeling}` のような補間を **1 回追加するだけで保存型 XSS に変わる**。
lit-html なら通常の `${value}` がテキストノードになるので、この取り違えが構造的に起きない。

```js
// 現在 — 2段階。規律で守っている
setMarkup(root, `<p data-feeling></p>`);
setText(find(root, "[data-feeling]"), entry.feeling);

// lit-html — 1行。${} は常にテキスト
render(html`<p>${entry.feeling}</p>`, root);
```

危険な操作は `unsafeHTML` に隔離されるので、**レビューで grep できる**ようになる。

### 比較（サイズは minified+gzip の概算）

| 名前 | リポジトリ / ライセンス / 活動 / サイズ | XSS 耐性・置換範囲 | コスト・注意点 |
|---|---|---|---|
| **lit-html** | [lit/lit](https://github.com/lit/lit) · BSD-3-Clause · **v3.3.3（2026）** · 約 2.8〜3.8 KB gzip（現行正確値は未確認） | 通常の `${userText}` はテキスト。`unsafeHTML` だけが危険。`setMarkup`/`setText`/大半の `find`/`listen` を置換 | **低〜中。第一推奨**。既存 HTML 文字列をほぼそのまま移植できる |
| **Preact + htm** | [preactjs/preact](https://github.com/preactjs/preact) MIT（10.29.x, 2026 更新）+ [developit/htm](https://github.com/developit/htm) Apache-2.0（3.1.1, 約4年前） · 約 4 + 0.5 KB | 子文字列は安全に DOM text へ。生 HTML は `dangerouslySetInnerHTML` | 中〜高。React 式の再設計が必要。**htm 本体の更新が止まっている** |
| **Alpine.js** | [alpinejs/alpine](https://github.com/alpinejs/alpine) · MIT · **v3.16.2（2026-08）** · 約 12〜14 KB | `x-text` は安全、`x-html` は XSS になり得ると公式警告 | 中。**画面全体を JS で再生成している本件には相性が悪い** |
| **Solid** | [solidjs/solid](https://github.com/solidjs/solid) · MIT · 1.9 系（2026 更新、2.0 は RC 前後） · 最小 約 4.2 KB | JSX の通常補間はテキスト | **高**。Vite plugin + JSX + リアクティブモデルの学習。この規模には過剰 |
| **Svelte** | [sveltejs/svelte](https://github.com/sveltejs/svelte) · MIT · **v5.56.10（2026-08）** 非常に活発 · 最小 約 14.9 KB | `{value}` はテキスト、`{@html}` は危険 | **高**。ファイル形式・compiler・runes を導入。4 画面には大きい |
| **VanJS** | [vanjs-org/van](https://github.com/vanjs-org/van) · MIT · **v1.6.1（2026-07）** · **約 1.0 KB** | 文字列 children は Text node | 中。極小だが、長い Tailwind class を持つ既存 HTML が `div({...}, ...)` の深い関数呼び出しになり**可読性が落ちる** |
| **hyperscript 系 `h()`** | [hyperhype/hyperscript](https://github.com/hyperhype/hyperscript) · MIT · v2.0.2 長期未更新 | string child は Text node | 中。代表実装が古く、リアクティブ更新も別途必要。VanJS か Preact の `h()` のほうがよい |

### どのライブラリでも別問題として残るもの

- `href` / `src` にユーザー入力を渡すときの `javascript:` スキーム
- `unsafeHTML` / `innerHTML` / `dangerouslySetInnerHTML`
- イベントハンドラ文字列
- 信頼できない HTML を表示する場合のサニタイズ

CSP と Trusted Types は補助防御として有効だが、**通常のテキスト補間を使うことが第一**。

---

## 3. ルーター — 追加しない

| 名前 | リポジトリ / ライセンス / 活動 / gzip | 置換範囲 | 判断 |
|---|---|---|---|
| **History API** | Web 標準 · **0 KB** · 全対象ブラウザで安定 | 現状のまま | **この規模の第一推奨**。route 部分を小関数に整理するだけで十分 |
| **navaid** | [lukeed/navaid](https://github.com/lukeed/navaid) · MIT · v1.2.0 前後（近年のリリース未確認） · 約 1 KB | pushState / popstate / route dispatch | 低。**pathname を本当に付けるなら第一候補** |
| **Navigation API** | Web 標準 · 0 KB · **2026-01 から Baseline 2026** | navigation intercept、history entry 管理 | 中。新規学習には有益。古い iOS 等を含めるなら fallback が必要 |
| **page.js** | [visionmedia/page.js](https://github.com/visionmedia/page.js) · MIT · v1.11.6、近年は低活動 · 約 2〜4 KB | URL matching、リンク捕捉 | 中。S3/CloudFront で全 route を `index.html` へ fallback する設定が必要。現状には過剰 |
| **wouter** | [molefrog/wouter](https://github.com/molefrog/wouter) · MIT · 3.x · 約 2.1 KB | Preact 採用時の route hooks | 中。lit-html や vanilla 単独には合わない |
| **@remix-run/router** | [remix-run/react-router](https://github.com/remix-run/react-router) · MIT · **v1.23.3〜4（2026-08）** · 数十 KB 級 | routing、loader、mutation | **高。明確に過剰**。パッケージ自身が React Router 内部向けと説明 |

**判断**: このアプリは URL pathname を変えず、同じページ内の 4 つの `<section>` を切り替えている。
**ライブラリを追加せず History API を継続**するのが妥当。

将来 `/today` `/fragments` のような共有可能 URL が必要になったら navaid を導入する。
その際は CloudFront Functions 等で unknown path を `index.html` へ戻す設定も必要。

---

## 4. 状態管理 — 現状維持

| 名前 | リポジトリ / ライセンス / 活動 / gzip | 置換範囲 | 判断 |
|---|---|---|---|
| **nanostores** | [nanostores/nanostores](https://github.com/nanostores/nanostores) · MIT · 2026 更新中 · 340〜864 B（Brotli）、gzip も概ね 1 KB 未満 | `value` / `Set` / `getState` / `subscribe` / `commit` | 低。**導入するならこれが第一候補** |
| **zustand/vanilla** | [pmndrs/zustand](https://github.com/pmndrs/zustand) · MIT · **v5.0.15（2026-08）** · vanilla core 約 1 KB | `getState/setState/subscribe` を直接置換 | 低。**現行実装とほぼ同じ**。依存を増やして得るものが少ない |
| **Valtio** | [pmndrs/valtio](https://github.com/pmndrs/valtio) · MIT · **v2.3.2（2026-05）** | immutable spread → mutable Proxy 操作 | 中。コードは短くなるが、**現在の明示的 commit 経路を崩す** |
| **@preact/signals-core** | [preactjs/signals](https://github.com/preactjs/signals) · MIT · **v1.14.4（2026 夏）** · 約 1.6 KB | store と購読、derived state | 中。細粒度 DOM 更新なら有効。**全画面再 render の現状では能力を活かせない** |
| **solid-js/store** | solidjs/solid · MIT | store、nested immutable update | 高。Solid UI と一緒でなければ採る理由がない |

**判断**: `state.js` の store 基盤そのものは**約 20 行**しかない。残りは `saveEntry` や
`markOutingWent` といったアプリ固有のドメインロジックで、**状態管理ライブラリでは消えない**。

複数の独立 store や derived state が増えたときだけ nanostores へ移す。

---

## 5. 永続化 — localStorage のままでよい

| 名前 | リポジトリ / ライセンス / 活動 / gzip | 置換範囲 | 判断 |
|---|---|---|---|
| **idb-keyval** | [jakearchibald/idb-keyval](https://github.com/jakearchibald/idb-keyval) · Apache-2.0 · **v6.3.0（2026 夏）** · 約 0.6〜1 KB | `localStorage.getItem/setItem` | 中。`initialize`/`commit` の async 化が必要。**IndexedDB が必要になったときの第一候補** |
| **Dexie.js** | [dexie/Dexie.js](https://github.com/dexie/Dexie.js) · Apache-2.0 · **v4.4.5（2026-08）** · 約 26〜31 KB | storage、query、transaction、schema migration | **高。単一 JSON には過剰**。検索・索引・複数 table が必要になれば有力 |
| **localForage** | [localForage/localForage](https://github.com/localForage/localForage) · Apache-2.0 · **v1.10.0（2021 年、実質低活動）** · 8.8 KB | localStorage API を async storage へ | 中。WebSQL fallback 等が現代には不要。**新規採用は idb-keyval を優先** |
| **RxDB** | [pubkey/rxdb](https://github.com/pubkey/rxdb) · Apache-2.0 · **v17.4.0（2026-07）** 非常に活発 · 構成により 100 KB 級 | storage、schema、reactive query、同期 | **非常に高。完全に過剰** |

### IndexedDB へ移行する条件（今はどれも該当しない）

- 画像・音声・Blob を保存する
- 数千〜数万件を索引検索する
- 1 回の JSON stringify/parse で体感停止が出る
- 1 MiB 前後へ近づく
- transaction が必要になる
- 複数タブやバックグラウンド処理との競合が増える

このアプリは 1 日 最大 約 300 文字。数年使っても通常は数百 KB で、localStorage の一般的な
上限 5 MiB には遠い。

### ただし今すぐ直すべき点

> **現在の `save()` は `QuotaExceededError` やストレージ禁止を catch していない。**

保存失敗をユーザーへ通知し、バックアップを促す処理は追加すべき。
プライベートブラウジングやストレージ無効設定で**黙って記録が消える**経路がある。

---

## 6. スキーマ検証 — Valibot

### 現行の問題: 検証規則が 2 つある

`storage/local.js` の `normalize()` は `entries` と `outings` が**オブジェクトかどうかだけ**を
検査し、中の各 entry の型や長さを検査していない。
一方、バックアップ import 側の `validBackup()` は**深く検査している**。

**同じデータ形式に 2 つの検証規則があり、将来ずれる。**

| 名前 | リポジトリ / ライセンス / 活動 / gzip | 置換範囲 | コスト・注意点 |
|---|---|---|---|
| **Valibot** | [open-circle/valibot](https://github.com/open-circle/valibot) · MIT · **v1.4.2（2026-06）** · 小 schema は 700 B 未満、本件相当で 1〜3 KB | `normalize()` と `validBackup()` を**同じ schema へ統合** | **低。第一推奨**。変換を schema に載せられる |
| **Zod / Zod Mini** | [colinhacks/zod](https://github.com/colinhacks/zod) · MIT · **v4.4.3（2026-05）** · core 約 5.36 KB / Mini 約 1.88 KB | 同上 + form validation | 低〜中。**資料量が最大**。型推論の最大の利点は TypeScript 化した時 |
| **ArkType** | [arktypeio/arktype](https://github.com/arktypeio/arktype) · MIT · **v2.2.3（2026-07）** | normalize、backup validation | 中。表現力は高いが、**素の JS 学習者には独自構文の理解コストが増える** |
| **Standard Schema** | [standard-schema/standard-schema](https://github.com/standard-schema/standard-schema) · MIT · 実質 0 KB | validator そのものは置換しない | **目的外**。Zod/Valibot を受け取るライブラリ作者向け |

1 個の `StateSchema` を定義し、**localStorage load / backup import / migration 各段の出力 /
保存直前 / テスト fixture** の全境界で共用する。

### 壊れた保存データの復旧パターン

**「1 項目壊れたら全記録を初期化」は避ける。** 個人の日記に近いデータなので部分復旧を優先する。

1. `localStorage` の生文字列を読む
2. JSON parse 失敗時は、壊れた生文字列を `kakera.state.corrupt.<timestamp>` に**退避**
3. version だけを最小 schema で読む
4. 旧 version なら段階的に migration
5. 最新 schema で `safeParse`
6. `entries` は**1 件ずつ検証**し、壊れた日だけ隔離する
7. 正常部分を最新キーへ書き込んだ**後にだけ**旧キーを削除する
8. 「3 件復旧、1 件隔離」のようにユーザーへ通知し、壊れた原本を export 可能にする

---

## 7. オフライン / PWA

| 名前 | リポジトリ / ライセンス / 活動 | 置換範囲 | コスト・注意点 |
|---|---|---|---|
| **vite-plugin-pwa** | [vite-pwa/vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) · MIT · **v1.3.0（2026-05）** | precache manifest 生成、SW registration、更新通知 | 低。Vite 採用時の最短距離。**ただし現 package は今後 maintenance mode、新しい `@vite-pwa/*` へ移行予定と表明** |
| **Workbox** | [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) · MIT · **v7.4.0（2025-11）** | SW の precache、routing、cache 更新、fallback | 中。この規模には直接利用が大きい |
| **素の Service Worker** | Web 標準 · 0 KB · 実装 30〜50 行 | app shell の precache と offline response | 中。依存ゼロで理解しやすいが、cache version・古い cache 削除・更新待ち・hash 資産一覧の同期を自分で管理 |

現在の `site.webmanifest` は name / icons / start_url / display など基本要件を満たしている。
ただし **manifest だけでは資産はオフラインにならない**。Service Worker が必要。

**注意点**
- `skipWaiting` で即時更新すると、開いている旧 HTML と新 chunk が混ざる場合がある。
  **更新通知 → reload のほうが安全**。
- **4.5 MB の日本語フォントを全部 precache すると初回オフライン準備が重い。
  フォント削減を先に行うこと。**

---

## 8. データ移行・バージョニング

**単一の localStorage JSON について、広く定着した「標準 migration library」はほぼ存在しない。**
（IndexedDB へ移行するなら Dexie の `db.version(n).stores(...).upgrade(...)` が成熟した選択肢）

### 定石パターン

キー名にだけ `v1` を入れるより、**payload 内の整数 version を正本にする**。

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

実務上の条件:

- migration は `v1→v2→v3` と**一段ずつ**書く
- 各段の入力・出力を fixture test する
- 同じ入力を再度処理して壊れないようにする（冪等性）
- migration 開始前に生データを退避する
- 最新形式の保存成功後まで旧キーを消さない
- **未知の未来 version は初期化せず**、「このアプリ版では読めない」として保持する
- migration 失敗と通常の schema 破損を別エラーとして扱う
- export ファイルにも version を必須にする

---

## 現状コードと置換後の対応表

行数は現物を基にした実装見積り。アプリ固有の処理は残るため「1 行で全部消える」とはしていない。

| 現状の自作コード | 現状行数 | 推奨置換 | 置換後 | 純減・効果 |
|---|---:|---|---:|---|
| clean / mkdir / static copy | 約12行 | Vite `publicDir` / `build.outDir` | 0〜3行 | **約9〜12行減** |
| 自作 JS minifier | 約48行 | Vite/Rolldown minify | 0行 | **約48行減**、パーサ誤判定を解消 |
| Tailwind CLI 起動 | 約10行 | `@tailwindcss/vite` | 2〜4行 | 約6〜8行減 |
| CSS 20KB 検査 | 約5行 | Vite plugin または `size-limit` | 5〜10行 | 行数は同等、検査を独立化 |
| Fontsource CSS 正規表現変換・243ファイル copy | 約36行 | Fontsource CSS import + Vite assets | 2〜4行 | **約32行減** |
| JSON 文言の自作 BPE | 約40行 | JSON import + HTTP gzip/Brotli | 1行 | **約39行減**。gzip 差はわずか 63 B |
| **`build.js` 全体** | **159行** | **Vite config** | **10〜25行** | **約134〜149行減** |
| `setMarkup` + placeholder + `setText` | views 内多数 | lit-html `html` / `render` | 1 template 表現 | **views 全体で約70〜120行減**、XSS 規律を構造化 |
| `find` + `listen` | helper 約20行＋各view | lit-html `@click` / `.value` / `?hidden` | template 内 | helper の大半と再 query を削除 |
| ルーター自作 | `main.js` 中 約70〜90実効行 | **History API を整理して継続** | 約35〜50行 | 約20〜40行減。外部依存なし |
| store（value + Set + commit） | 約20〜25行 | **現状維持**（必要時 nanostores 4〜8行） | 現状のまま | domain action は消えないため効果小 |
| localStorage read/write | 約15行 | **現状維持** | 15〜20行 | `QuotaExceededError` 通知だけ追加 |
| `normalize()` | 約13行 | Valibot `StateSchema` | 約25〜35行 | **単体では増えるが、深い検証を獲得** |
| `validBackup()` | 約31行 | 同じ Valibot schema を再利用 | 1〜3行 | 重複解消。合計では約10〜20行減 |
| v1 キーだけの version 設計 | 数行 | migration map + Valibot | 約20〜30行 | 行数は増えるが**データを失わない** |
| webmanifest のみ | 23行 | manifest 維持 + SW | 自作30〜50行 / plugin 5〜10行 | **オフライン機能を新規獲得** |
| `downloadFile()` | 12行 | **自作継続** | 同程度 | 十分小さく安定。OSS 化不要 |
| 日付 utility | 112行 | ※ 03 章では date-fns 推奨 | — | **判断が分かれた点**。README 参照 |

---

## 自作を続けたほうがよい領域

- 4 画面だけの History API 同期
- `saveEntry`、60 日開放、外出記録などのドメインアクション
- Blob による JSON/テキスト export
- DST を避ける日付キー計算（※ `daysBetween` のバグは 03 章参照）
- 小規模 localStorage アダプタ
- データ migration 関数そのもの

短く、アプリ固有で、ライブラリへ移しても本質的なコードが消えない領域。

---

## 推奨導入順

1. **Vite へ移し、`build.js`・自作 minifier・BPE を削除**
2. **Valibot** で保存・backup 共通 schema を作り、壊れたデータを退避する
3. view を **1 画面ずつ lit-html へ移す**
4. localStorage 保存失敗の通知と自動 backup 導線を追加
5. **フォント資産を削減してから** Service Worker を追加
6. IndexedDB・router library・state library は、**実際の要件が発生するまで導入しない**
