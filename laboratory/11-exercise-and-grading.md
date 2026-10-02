# 11.〈本題〉演習と正誤判定 — どう設計されているか

対象: `02.homework/01.week1/linux/script.js`（1,119行）、`git/script.js`（1,063行）
調査: codex + web search（2026-08-25）／trackB・track6 の統合

---

## 結論 — 判定は「文字列一致」ではなく「状態一致」

これがこの章の全体を貫く原理。

```js
// ❌ 悪い判定 — 一つの手順しか認めない
input === "cp docs/a.txt atelier/b.txt"

// ✅ 望ましい判定 — 到達した状態を見る
fileExists("/home/student/atelier/b.txt") &&
fileContent("/home/student/atelier/b.txt") === originalContent
```

これで以下が**すべて正解として許容される**:

- 相対パス / 絶対パス
- `./atelier/b.txt`
- 先に `cd atelier` してからコピー
- 引用符の差
- 同じ結果になる別手順

> **ただし「特定コマンドを覚える」ことが学習目標なら**、状態に加えて**操作の証拠**を課す。
>
> ```js
> goal: {
>   state:    { fileExists: "/atelier/b.txt" },
>   evidence: { commandUsed: "cp" }
> }
> ```
>
> **正解 ＝ 最終状態制約 ＋ 学習目標に必要な操作証拠**

---

## 1. 判定を三層に分ける

```
1. 構文受付      parse("cp docs/a.txt atelier/b.txt")  →  AST
2. コマンド実行   nextState = execute(previousState, ast)
3. 課題判定      grade(nextState, goalConstraints)
```

現在の Linux Story Quest は**すでに良い方向**にある。`stageSeed` が課題ごとの `check(ctx)` を持ち、
コマンド実行結果の context で判定している（`script.js:67`）。

**改善点**: `ctx.name === "..."` を主条件にしすぎず、
**仮想 FS やプロセスの post-state を独立した grader に渡す**。

### テスト結果は boolean にしない

```js
{
  testId: "file-created",
  passed: true,
  message: "plan.txt が atelier に作成された",
  expected: { path: "/home/student/atelier/plan.txt" },
  actual: { exists: true },
  weight: 1
}
```

フィードバックを返せるかどうかが、教材としての質を分ける。

---

## 2. Git の判定 — Learn Git Branching の状態一致モデル

Learn Git Branching は **100% クライアントサイド**で、各 level が次を持つ:

- `startTree`
- `goalTreeString`
- `solutionCommand`
- 説明・ヒント
- branch / commit / tag / HEAD / remote tree

**本質は、模範コマンド列を再現したかではなく、現在のリポジトリ状態が目標グラフと一致するか。**

### 現在の Git Dungeon の問題

```js
// 真偽値の連鎖で16段階を判定している（script.js:120, 176）
firstCommit, featureCreated, navCommit, mergedFeature,
conflictStarted, conflictResolved, pushed
```

コマンド受付にも具体的な文字列一致が多い（`script.js:561`）。
**「コマンド結果が Git として正しいか」を自作コード自身が決めている**ため、
教材の正しさを別の実装で検証できない。

### 置き換えるモデル

```js
repoState = {
  commits: { C0: { parents: [], tree: {...} },
             C1: { parents: ["C0"], tree: {...} } },
  refs:    { "refs/heads/main": "C1",
             "refs/heads/feature/nav": "C2" },
  HEAD:    { symbolic: "refs/heads/main" },
  index:   {...},
  worktree:{...},
  remotes: {...},
  merge:   { inProgress: false, conflicts: [] }
}
```

課題側は**制約**で書く:

```js
goal: {
  branch: "main",
  refs: { "feature/nav": { mergedInto: "main" } },
  worktree: { clean: true },
  requiredFiles: ["nav.js"]
}
```

### グラフ比較のときは正規化する

- commit ID を生成順または構造で**再ラベル**する
- parent 関係を比較
- branch/tag が指すノードを比較
- HEAD / index / worktree / conflict 状態を比較
- **無関係な dangling commit を許すかは課題ごとに指定する**

> Learn Git Branching でも、見た目上同等でも余分な dangling commit があると
> 不一致になる問題が報告されている（issue #99）。
> したがって**完全同型比較だけでなく、制約ベース比較も持つべき**。

---

## 3. Git エンジンの選択 — 調査が割れた点

**2つのトラックが違う結論を出した。原理（状態で判定する）は一致している。**

| | track6 の主張 | trackB の主張 |
|---|---|---|
| 結論 | **isomorphic-git へ全面置換** | **小型の自作リポジトリモデルを継続** |
| 理由 | 実コミット・index・refs を source of truth にできる。**教材の正しさを別実装で検証できる** | **本物の Git を動かすより学習目標を制御しやすい**。Learn Git Branching も独自ツリーモデル |

### 裁定: isomorphic-git を採る。ただし判定は制約ベースで書く

両者は排他ではない。**isomorphic-git をエンジンにし、目標は制約として表現する**のが統合案。

**isomorphic-git を推す決め手**は「学習サイトである」こと。
自作モデルだと、**自分の Git 理解が間違っていた場合にゲームも一緒に間違う**。
実オブジェクトを使えば、CI で本物の git と付き合わせて検証できる。

```
git commit -m "..."
      ↓  薄い許可リスト型アダプター（自作）
git.commit({ fs, dir, message, author })
      ↓
statusMatrix() / currentBranch() / log() / resolveRef() で実状態を検査
      ↓
goalConstraints と突き合わせ
```

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **isomorphic-git** | [isomorphic-git/isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) · **MIT** · v1.41.9、2026-08 も更新 | **採用**。純JS、静的ホスティング可、API 単位で tree-shake 可 |
| **@isomorphic-git/lightning-fs** | [isomorphic-git/lightning-fs](https://github.com/isomorphic-git/lightning-fs) · MIT · **v4.7.0（2026-08）** | **採用**。IndexedDB 永続。Git 操作後に `fs.flush()` |
| **wasm-git** | [petersalomonsen/wasm-git](https://github.com/petersalomonsen/wasm-git) · **GPL-2.0 + linking exception** · 2026 更新 | 非採用。pthreads 版 約920KB / JSPI 版 約805KB / Asyncify 版 約1.5MB。**教材の状態判定は isomorphic-git より難しい** |
| **@gitgraph/js** | [nicoespeon/gitgraph.js](https://github.com/nicoespeon/gitgraph.js) · MIT · **v1.4.0（最終公開 約5年前）** | 非採用。更新停滞、独自 API で別モデルを再構築する必要。**現在の描画UIに `git.log()` を流すほうがよい** |

### isomorphic-git の制約（正直に）

- **merge に複数 merge base や一部戦略の制限がある**
- **外部 GitHub への clone/push は CORS 制約を受ける**（公式に CORS proxy が案内されている）
- **PAT をゲームに入力・保存させる設計は避ける**
- → **`push` 教材は、ブラウザ内の模擬リモートにするか、通信部分だけ演出として残す**

`isogit` CLI は「本物の git CLI の代用品」を目的としていない。
ここで「本物」と呼べるのは **Git オブジェクト・インデックス・参照・コミット履歴が実物である**という意味であり、
**Git CLI 全体を再実装できるという意味ではない**。

---

## 4. Linux の判定 — 自作を続ける

**両トラックが一致して「自作継続」を推奨した。** 理由が納得できる。

- **必要なコマンド集合を一貫して置き換えられる、成熟した純 JS 版 GNU coreutils 一式は存在しない**
- **本格 Bash パーサを入れると、構文は認識できてもパイプ・変数展開・glob・subshell・終了コードを
  実行できないという別の不整合が生じる**
- 現在のゲームは一般目的シェルではなく、ステージが要求する構文が限定されている

### パーサ候補（当面は不要）

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **shell-quote** | [ljharb/shell-quote](https://github.com/ljharb/shell-quote) · MIT · **v1.10.0（2026-07）** | **引用符・バックスラッシュ対応が必要になったらこれ**。第一候補 |
| **sh-syntax**（mvdan/sh の WASM） | [un-ts/sh-syntax](https://github.com/un-ts/sh-syntax) · MIT · **v0.6.0（2026 更新）** | 解析専用で実行はしない。**パイプ・置換・リダイレクトを本格対応するときのみ** |
| **bash-parser** | [vorpaljs/bash-parser](https://github.com/vorpaljs/bash-parser) · MIT · **v0.5.0（約9年前）** | 長期停滞。非採用 |
| **minimist / yargs-parser** | MIT / ISC | シェル構文は解析しない。教材の数個のフラグには過剰 |

### 実シェル化するなら（将来）

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **Bashkit** | [everruns/bashkit](https://github.com/everruns/bashkit) · **MIT** · npm 0.16.0（2026-08） | **「実シェルモード」の第一候補**。SharedArrayBuffer / 特殊ヘッダー不要。ただし **0.x なので本番全面移行は早い** |
| **busybox-wasm-wasi** | [MentalGear/busybox-wasm-wasi](https://github.com/MentalGear/busybox-wasm-wasi) · **BusyBox 部分 GPL-2.0** | 事前構築物 約608KB。**COOP/COEP 必須**。`df` `du` `tar` `ping` が不足、パイプも制限 |
| **container2wasm** | [container2wasm/container2wasm](https://github.com/container2wasm/container2wasm) · Apache-2.0 · **v0.8.4（2026-03）** | Linux 互換性は高いが、**20数コマンドのために rootfs 全体を積むのは過剰** |
| **WebVM / CheerpX** | WebVM は Apache-2.0 だが **CheerpX 本体はプロプライエタリ** | ⚠ **Community 条件では自己ホストと OEM 再配布が不可**。S3/CloudFront に置くには商用条件の確認が必要。**中核依存にしない** |
| **v86** | [copy/v86](https://github.com/copy/v86) · BSD-2-Clause | 数十MB級 image。教材設計より VM の boot・永続化に時間を取られる |

> **必要なのは OS ブートではなく、限定的な FS 操作とコマンド意味論。**
> 中間案として最も近いのは Bashkit。WebVM / container2wasm は重すぎる。

---

## 5. ブラウザ内実行・採点 — 静的ホスティングの境界線

### S3 / CloudFront / Cloudflare Pages だけで完結する

- 現在の仮想 Linux・仮想 Git ランタイム
- **CodeMirror 6**（MIT・軽量・素のJSと相性がよい。**IME 合成中は値変更を確定扱いしない実装が必要**）
- Monaco Editor（MIT・**v0.56.0（2026-07-20）**・重くモバイル非対応。短いコマンド入力には過剰）
- **Pyodide**（MPL-2.0・**0.29.4（2026-05-07）**。※ socket・thread・process・`fcntl`・`termios` が使えず、**本物の Linux 演習にはならない**）
- **JupyterLite**（BSD-3-Clause・**0.7.6（2026-05-07）**。Notebook を IndexedDB に保存できる）
- assertion ライブラリ（Chai 等）
- sandboxed iframe / Web Worker 内の JS テスト
- localStorage / IndexedDB 進捗
- **Learn Git Branching 型の状態シミュレータ**

### サーバーが必要（＝今回は採らない）

- **Judge0**（GPL-3.0・**最新 CE は 1.13.1、2024-04-18**）
  ⚠ **1.13.0 以前に重大な sandbox escape。使うなら必ず 1.13.1 以降**
- **Piston**（MIT）⚠ **2026-02-15 以降、公開 API は自由利用できずキー発行もしない方針。セルフホスト前提**
- PrairieLearn の標準採点 / CTFd / WeBWorK / Runestone のアカウント
- 本物の Linux プロセス・socket・Git executable を使った公開コード実行

### Sandpack は第一選択にしない

[codesandbox/sandpack](https://github.com/codesandbox/sandpack) · Apache-2.0 ·
**最終安定 release は v2.20.0（2025-02-14）**、2026 年に保守状況への未回答質問あり。
React 前提の完成 UI が素の JS 構成と合わない。

---

## 6. Exercism 方式をブラウザだけで実現する

Vitest の UI 全体を学習者ごとに起動するのではなく、小さなランタイムを作る。

```
exercise.json
  ↓
stub + learner code
  ↓
sandboxed iframe または Worker
  ↓
tests.js
  ↓
TestResult[]
  ↓
課題完了判定・フィードバック・進捗保存
```

- assertion: Chai、または `equal / deepEqual / ok / match` だけの自作小型 assert
- **開発時の教材テスト**: Vitest、Web Test Runner
- **無限ループ対策**: Web Worker を時間制限で terminate
- DOM 課題: `sandbox` 属性付き iframe 内で実行
- ⚠ **公開ユーザーの任意コードを実行するなら、同一 origin の Worker をセキュリティ境界と思わない**

> Web Test Runner は**教材作者のテストを回す道具**であり、
> 配信後の学習者向け runner そのものではない。

---

## 7. ゲーミフィケーション — OSS から読み取れるルール

| 機能 | 実装例 | 読み取れるルール |
|---|---|---|
| ストリーク | freeCodeCamp | **完了日・活動日から current/longest を導出する**（保存しない） |
| XP / ポイント | freeCodeCamp, CTFd | CTFd は challenge value と solve から score を計算 |
| バッジ | freeCodeCamp, Moodle, Oppia | **固定 ID を手動保存するより「条件を満たしたら award イベントを生成」** |
| 進捗バー | Odin, Moodle | 完了数 ÷ 総数。**deprecated や任意課題を分母に入れるかを明文化する必要がある** |
| ヒントコスト | CTFd | **hint unlock をイベントとして保存**し、点数消費や履歴と結び付ける |
| 解除 | Exercism, CTFd | prerequisite から利用可能状態を**導出**する |
| 最短手数 | Learn Git Branching | **正解とは分離して command count を記録。「クリア」と「上手なクリア」は別概念** |

---

## 8. 載せ替え判断 — 両ゲーム別

### Linux Story Quest

| 領域 | 方針 | 理由 |
|---|---|---|
| 画面・物語・マップ・戦闘演出 | **自作のまま** | 独自価値。OSS 化の利益がない |
| `stageSeed` | 自作のまま、**別モジュールへ分離** | 線形クエストには十分 |
| クエスト状態機械 | **XState を導入しない** | 一本道で、実 FS 状態が既に source of truth。**状態が二重化する方が危険** |
| 仮想 FS | 当面自作のまま | JSON 保存と課題判定に適合 |
| tokenizer | 当面自作、引用処理強化時に **shell-quote** | フル Bash AST は過剰 |
| コマンド実装 | **自作を維持してテスト追加** | 一貫して置換できる OSS がない |
| 実シェル体験 | **Bashkit を実験モードで評価** | 静的配信しやすい中間案。ただしまだ 0.x |
| **教材データ** | **Exercism 構造を採用** | concept / practice / prerequisites / test / exemplar |
| 判定 | **post-state を独立 grader へ** | `ctx.name` 依存を減らす |
| 品質保証 | **Vitest ＋ 少数の Playwright** | まず `runCommand()` を DOM から切り離す |

### Git Dungeon

| 領域 | 方針 | 理由 |
|---|---|---|
| 画面・物語・マップ・戦闘演出 | **自作のまま** | 学習ゲームとしての独自部分 |
| Git リポジトリ | **isomorphic-git へ置換** | 実コミット・index・refs を source of truth に |
| 仮想 FS | **@isomorphic-git/lightning-fs** | Git 用途特化、IndexedDB 永続 |
| Git コマンド入力 | **薄い許可リスト型アダプターを自作** | 完全 CLI 再現を避けつつ標準入力を許容 |
| 進行判定 | **入力文字列ではなくリポジトリ状態＋制約** | **別解を許容でき、教材として正しくなる** |
| `currentQuest()` | 地図・会話の順序だけ残す | **Git 由来の真偽値は実状態から導出** |
| コミットグラフ | 現在の UI を `git.log()` 対応に | @gitgraph/js は更新停滞 |
| remote / push | remote 設定は実物、**外部 push は模擬** | CORS と認証情報保存を避ける |
| セーブ | LightningFS ＋ 最小限のゲーム状態 JSON | **`firstCommit` 等を保存せず実リポジトリから導出**すれば矛盾が消える |
| 品質保証 | Vitest で実 repo 検査、Playwright で一周 | 偽の Git 出力ではなく実状態を検証 |

### 最初に書くべきテスト

- 正解例だけでなく**タイプミス・存在しないパス・権限不足・危険なオプション**
- **author と timestamp を固定**して commit OID を再現可能にする
- **同じ結果になる別解**（`git add .` と個別 `git add file`）を許容することの確認
- CI 上の GNU/Linux 実行結果との contract test（ゲーム独自仕様は差をコメントとテスト名で明示）

---

## 9. tldr / man から正解を自動生成できるか → できない

- **tldr**（[tldr-pages/tldr](https://github.com/tldr-pages/tldr)・本文 CC BY 4.0 / scripts MIT）
  は CommonMark で機械処理しやすいが、**代表例集であってコマンドの完全な仕様でも正解集合でもない**。
  → **ヒントや追加例には使えるが、回答判定の自動生成には使わない。**
  使うならビルド時に特定コミットへ固定し、**CC BY 4.0 の帰属表示**を行う。
- **man** は提供元もライセンスも一つではなく（Linux man-pages / GNU coreutils / Bash built-ins）、
  roff 解析も必要。さらに**「文法上有効」と「このステージの学習目標を満たす」は別問題**。
  → 補助説明の生成に限定し、**正解判定は実エンジンの状態検査と手書きテストケースを基準にする**。
