# 06. ブラウザ内で本物を動かす — 実行基盤カタログ

対象: `02.homework/01.week1/{linux,git}/script.js`
調査: codex + web search（2026-08-25）／track6

> **判定モデルと採否の結論は [11-exercise-and-grading.md](11-exercise-and-grading.md) に統合済み。**
> この章は**実行基盤そのもののカタログ**として残す（将来の選択肢の一覧）。

---

## 1. ブラウザ内 Git

| 名前 | リポジトリ / ライセンス / 活動 | サイズ・特性 | 判定 |
|---|---|---|---|
| **isomorphic-git** ★ | [isomorphic-git/isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) · **MIT** · v1.41.9（2026-08 更新） | 純JS、API 単位で tree-shake 可 | **採用**（→ 11章） |
| **@isomorphic-git/lightning-fs** ★ | [isomorphic-git/lightning-fs](https://github.com/isomorphic-git/lightning-fs) · MIT · **v4.7.0（2026-08）** | IndexedDB 永続 | **採用**。⚠ 完全な Node `fs` ではない。Git 操作後に `fs.flush()` |
| **wasm-git** | [petersalomonsen/wasm-git](https://github.com/petersalomonsen/wasm-git) · **GPL-2.0 + linking exception** | pthreads 版 約920KB（**COOP/COEP 必須**）/ JSPI 版 約805KB / Asyncify 版 約1.5MB | libgit2 の WASM 化。CLI に近い `callMain(["commit", ...])` だが**状態判定が難しい** |
| **@gitgraph/js** | [nicoespeon/gitgraph.js](https://github.com/nicoespeon/gitgraph.js) · MIT · **v1.4.0（最終公開 約5年前）** | — | 更新停滞。**リポジトリを自動解析せず独自 API で再構築が必要**。非採用 |

## 2. ブラウザ内ファイルシステム

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **@isomorphic-git/lightning-fs** | MIT · v4.7.0（2026-08） | **Git Dungeon の第一推奨** |
| **ZenFS / @zenfs/core** | [zen-fs/core](https://github.com/zen-fs/core) · **LGPL-3.0-or-later** · v2.6.4（2026-08） | BrowserFS の後継。mount/backend が豊富だが**小さな教育用 FS には過剰**。⚠ **LGPL 条件の確認が必要** |
| **BrowserFS** | [jvilk/BrowserFS](https://github.com/jvilk/BrowserFS) · MIT · **2024-03 に非推奨化** | **新規採用しない**。後継の ZenFS へ |
| **memfs** | [streamich/memfs](https://github.com/streamich/memfs) · Apache-2.0 · v4.68.1（2026-08） | ブラウザ永続化は別アダプターが必要。**Vitest の隔離 FS として有用** |

## 3. ブラウザ内 Linux / シェル

各層の違い（重い順）:

```
v86              PC・CPU・周辺機器・OSカーネル全体をエミュレーション
WebVM/CheerpX    x86 Linux バイナリをブラウザ実行する独自仮想化層
container2wasm   コンテナ + CPU エミュレータを WASM へ梱包
BusyBox/Bashkit  シェルとユーザーランドだけを実装        ← 教材にはこの層で十分
Wasmer           WASI/WASIX プログラムのランタイム（基盤）
```

| 名前 | リポジトリ / ライセンス / 活動 | 静的配信・サイズ | 判定 |
|---|---|---|---|
| **Bashkit** | [everruns/bashkit](https://github.com/everruns/bashkit) · **MIT** · npm 0.16.0（2026-08） | **特殊ヘッダー・SharedArrayBuffer 不要**。WASM 実サイズ未確認 | **「実シェルモード」の第一候補**。ただし 0.x |
| **busybox-wasm-wasi** | [MentalGear/busybox-wasm-wasi](https://github.com/MentalGear/busybox-wasm-wasi) · **BusyBox 部分 GPL-2.0** | 約608KB、**COOP/COEP 必須** | 中間案だが `df` `du` `tar` `ping` が不足、パイプも制限 |
| **container2wasm** | [container2wasm/container2wasm](https://github.com/container2wasm/container2wasm) · Apache-2.0 · **v0.8.4（2026-03）** | 静的デモあり。**コンテナ依存で大きく携帯には不向き** | Linux 互換性は高いが**20数コマンドのために rootfs 全体は過剰** |
| **WebVM / CheerpX** | WebVM は [leaningtech/webvm](https://github.com/leaningtech/webvm) · Apache-2.0 / **CheerpX 本体はプロプライエタリ** | OS イメージを含み重い | ⚠ **Community 条件では自己ホスト・OEM 再配布が不可**。Small Business は 1開発者あたり月額£100。**中核依存にしない** |
| **v86** | [copy/v86](https://github.com/copy/v86) · **BSD-2-Clause** · 2026-05 latest build | 数十MB級 image | **教材設計より VM の boot・永続化・互換に時間を取られる** |
| **@wasmer/sdk** | [wasmerio/wasmer-js](https://github.com/wasmerio/wasmer-js) · MIT · 活発 | プログラムにより COOP/COEP | **それ自体は Linux でもシェルでもない**。BusyBox 等を載せる基盤 |
| **js-dos** | [caiiiycuk/js-dos](https://github.com/caiiiycuk/js-dos) · npm では GPL-2.0 表記（要個別確認） · **v8.4.1（2026-07）** | backend 不要・静的ホスト可 | **Linux/Git 教材には不適**。DOS バイナリの著作権確認も必要 |
| **Wasmer shell / webassembly.sh** | [wasmerio/webassembly.sh](https://github.com/wasmerio/webassembly.sh) · MIT · 旧世代構成 | PWA として静的配信可 | 更新状況が弱く**非採用** |
| **jsh** | [bradymholt/jsh](https://github.com/bradymholt/jsh) · MIT · **最終公開 約2年前** | Node 専用 | **ブラウザシェルでも Bash 実装でもない**。非採用 |
| **GNU Bash の WASM 移植** | — | — | **教材基盤として継続保守され、ブラウザ FS まで統合された標準実装は確認できず** |

## 4. シェル構文パーサ

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **shell-quote** | [ljharb/shell-quote](https://github.com/ljharb/shell-quote) · MIT · **v1.10.0（2026-07）** | **引用符・バックスラッシュ対応が要るならこれ** |
| **sh-syntax** | [un-ts/sh-syntax](https://github.com/un-ts/sh-syntax) · MIT · v0.6.0（2026 更新） | mvdan/sh の WASM。**解析専用で実行はしない** |
| **mvdan/sh** | [mvdan/sh](https://github.com/mvdan/sh) · BSD-3-Clause · 活発 | 本体は Go。**ブラウザ WASM は公式中核配布ではない** |
| **bash-parser** | [vorpaljs/bash-parser](https://github.com/vorpaljs/bash-parser) · MIT · **v0.5.0（約9年前）** | 長期停滞。**非採用** |
| minimist / yargs-parser | MIT / ISC | **シェル構文は解析しない**。教材の数個のフラグには過剰 |

## 5. coreutils 実装

| 名前 | リポジトリ / ライセンス | 判定 |
|---|---|---|
| **Bashkit built-ins** | [everruns/bashkit](https://github.com/everruns/bashkit) · MIT · 活発 | grep/sed/awk/jq/find を提供。**最も現実的**。ただし現行の独自 `curl/ping/process` 演出との整合が必要 |
| **BusyBox WASIX** | GPL-2.0 | 60以上の小型 Unix コマンド。**現在の課題に必要な `df/du/tar/ping` が不足** |
| **wasi-fs-access / uutils 実験** | [GoogleChromeLabs/wasi-fs-access](https://github.com/GoogleChromeLabs/wasi-fs-access) · Apache-2.0 | 技術デモ寄り。**非推奨** |
| **ShellJS** | [shelljs/shelljs](https://github.com/shelljs/shelljs) · BSD-3-Clause | Node 中心。ブラウザ教材の代替にならない |

> **現状の全コマンドを一貫して置き換えられる、成熟した純 JavaScript 版 GNU coreutils 一式は
> 確認できなかった。** → 自作 + テストで保証するのが扱いやすい（→ 11章）

## 6. 状態機械・ダイアログエンジン

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **XState v5** | [statelyai/xstate](https://github.com/statelyai/xstate) · MIT · **v5.32.5（2026-08）** | **今回は非採用**。現在は一本道で、実 Git/FS 状態が既に source of truth。**FSM を加えると状態が二重化**。有効になるのは同時進行クエスト・キャンセル・履歴状態・NPC ごとの独立 actor が要るとき |
| **robot3** | [matthewp/robot](https://github.com/matthewp/robot) · BSD-2-Clause · v1.2.0（約1年前） | XState より軽いが、**現状の配列＋predicate より明確になるとは限らない** |
| **@xstate/fsm** | MIT · v2.1.0（約3年前） | **v5 系では非推奨。非採用** |
| **nanostores + machine** | MIT · machine パッケージは 2026 登場の 0.x | 新しく実績が少ない |
| **Yarn Spinner** | [YarnSpinnerTool/YarnSpinner](https://github.com/YarnSpinnerTool/YarnSpinner) · コア MIT、周辺は YSPL 要確認 · v3.2.1（2026-05） | **公式の第一級 JS ブラウザランタイムは確認できず。非採用** |
| **Bondage.js / yarn-bound** | MIT / ISC · 約5年前 / 約2年前 | 更新停滞。導入の利点が小さい |
| **Twison** | [lazerwalker/twison](https://github.com/lazerwalker/twison) · MIT | ランタイムでも状態機械でもない。Twine を執筆 UI にしない限り不要 |

> **会話内容が地図上の移動・敵・コマンド結果・ファイル状態と密結合しているため、
> ダイアログエンジンへの載せ替えは逆に接着コードを増やす。**
> `stageSeed` を別モジュールへ分離する程度がよい。

## 7. 実績システム

**専用 OSS は不要。** [LittleJS](https://github.com/KilledByAPixel/LittleJS) に Medals プラグインがあるが
ゲームエンジン全体への依存になる。
**実績 ID の `Set`、解除条件の純関数、解除時刻だけで十分。**
