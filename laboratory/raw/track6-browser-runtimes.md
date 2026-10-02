# 第2ラウンド調査：ブラウザ内Git・Linux・学習ゲーム中核ロジック

調査日: 2026-08-25

指定された以下の実装を全行確認した。

- [Linux Story Quest の script.js](/home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:1) — 1,119行
- [Git Dungeon の script.js](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:1) — 1,063行

## 結論

このケースでの第一推奨は、**Git Dungeonだけを `isomorphic-git + @isomorphic-git/lightning-fs` に載せ替える**ことである。

現在のGit DungeonはGitの状態を多数の真偽値で模倣しているが、isomorphic-gitなら実際のインデックス、HEAD、ブランチ、コミットオブジェクトを教材の正解判定に使える。MITライセンス、純JavaScript、静的ホスティング対応、活発な開発という条件も個人教材に合う。

一方、Linux Story Questは「Linux互換性」より、ステージごとに意図した挙動を確実に教えることが重要である。現時点では自作実装を維持し、コマンドエンジンをDOMから分離してVitestで固めるのが最も費用対効果がよい。実シェル化はBashkitを別モードで試す程度が妥当である。

---

# 1. ブラウザで本物のGitを動かす

## 現在のGit Dungeon

現在の実装は、本物のGitリポジトリではなくゲーム専用の状態モデルである。

- [createDefaultState()](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:120) が `repo`、`firstCommit`、`featureCreated`、`mergedFeature`、`pushed` などを保持
- [currentQuest()](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:176) が真偽値の連鎖で全16段階を決定
- [handleGitCommand()](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:561) 以下がGitを独自に模倣
- [statusOutput()](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:873) と [logOutput()](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:897) もゲーム用の出力を生成

これはUIゲームとしてはよく整理されているが、「コマンド結果がGitとして正しいか」を自作コード自身が決めているため、教材の正しさを別の実装で検証できない。

## Git実装の比較

| 名前 | 一行説明 | リポジトリ・ライセンス・活動状況 | 置き換わる範囲 | 採用コスト | 注意点・判断 |
|---|---|---|---|---|---|
| isomorphic-git | ブラウザとNodeで動く純JavaScriptのGit実装 | [GitHub](https://github.com/isomorphic-git/isomorphic-git) / MIT / [npm 1.41.9](https://www.npmjs.com/package/isomorphic-git)、2026年8月時点でも更新中 | `handleInit/add/commit/branch/merge/push`、偽コミット配列、Git由来の進行フラグ | 中 | 最有力。API単位でtree-shake可能。CLI互換層は自作が必要。GitHub等への通信はCORS問題あり |
| wasm-git | libgit2をEmscriptenでWASM化し、Git風のargvを実行する実装 | [GitHub](https://github.com/petersalomonsen/wasm-git) / [GPL-2.0＋linking exception](https://github.com/petersalomonsen/wasm-git/blob/master/COPYING) / ソースは2026年も更新、正式リリース番号は未確認 | 独自Gitコマンド処理の大部分 | 高 | `callMain(["commit", ...])` のようにCLIへ近い。WASM、Worker、FS、結果解析が重く、教材の状態判定はisomorphic-gitより難しい |
| Git公式バイナリそのもの | Git CLIを完全再現する案 | ブラウザ向け公式配布は未確認 | 全Git処理 | 非常に高 | 現実的な選択肢ではない。WebVM等でLinuxごと動かす必要がある |

wasm-gitのOPFS構成は公式README上でおおよそ次のサイズである。

- pthreads版: 約920KB、COOP/COEP必須
- JSPI版: 約805KB、分離ヘッダー不要
- Asyncify版: 約1.5MB、分離ヘッダー不要

ただし、これらはWASM本体の目安であり、教材全体の初回転送量ではない。

### 推奨設計

UIが受け取った入力を、許可したGitコマンドだけに変換する。

```text
git commit -m "..."
        ↓
薄いコマンドアダプター
        ↓
git.commit({ fs, dir, message, author })
        ↓
実リポジトリを statusMatrix / log / currentBranch で判定
```

isomorphic-git自身の`isogit` CLIは「本物のgit CLIの代用品」を目的としていない。[公式CLI説明](https://isomorphic-git.org/docs/en/cli)でも薄いNode向けラッパーという位置付けである。したがって、ここで「本物」と呼べるのは、**Gitオブジェクト、インデックス、参照、コミット履歴が実物である**という意味であり、Git CLI全体を再実装できるという意味ではない。

## ブラウザ内ファイルシステム

| 名前 | 一行説明 | リポジトリ・ライセンス・活動状況 | 置き換わる範囲 | 採用コスト | 注意点・判断 |
|---|---|---|---|---|---|
| @isomorphic-git/lightning-fs | isomorphic-git用に絞ったIndexedDB永続FS | [GitHub](https://github.com/isomorphic-git/lightning-fs) / MIT / [npm 4.7.0](https://www.npmjs.com/package/%40isomorphic-git/lightning-fs)、2026年8月更新 | Git Dungeonの仮想作業ツリーとGitデータ保存 | 低 | Git Dungeonの第一推奨。完全なNode `fs`ではない。Git操作後に`fs.flush()`を行う |
| LightningFS旧パッケージ | 同ライブラリの旧名称・旧配布形態 | 上記リポジトリ / MIT | 同上 | 低 | 新規導入はスコープ付きパッケージを選ぶ |
| ZenFS / @zenfs/core | BrowserFSの後継となるNode風仮想FS | [GitHub](https://github.com/zen-fs/core) / LGPL-3.0-or-later / [npm 2.6.4](https://www.npmjs.com/package/%40zenfs/core)、2026年8月更新 | Linux Story Questの`dirs/files`とパス処理 | 中～高 | マウントやバックエンドが豊富だが、現在の小さな教育用FSには過剰。LGPL条件も確認が必要 |
| BrowserFS | ブラウザ向けNode FSの元実装 | [GitHub](https://github.com/jvilk/BrowserFS) / MIT / 2024年3月に非推奨化 | 同上 | 中 | 新規採用しない。後継のZenFSを使う |
| memfs | メモリ上にNode互換FSを構築 | [GitHub](https://github.com/streamich/memfs) / Apache-2.0 / [npm 4.68.1](https://www.npmjs.com/package/memfs)、2026年8月更新 | テスト用FS、Linuxコマンド層 | 中 | ブラウザ永続化は別アダプターが必要。本番よりVitestの隔離FSとして有用 |

## コミットグラフ

| 名前 | 一行説明 | リポジトリ・ライセンス・活動状況 | 置き換わる範囲 | 採用コスト | 注意点・判断 |
|---|---|---|---|---|---|
| @gitgraph/js | SVG/CanvasでGit風グラフを描くライブラリ | [GitHub](https://github.com/nicoespeon/gitgraph.js) / MIT / [npm 1.4.0](https://www.npmjs.com/package/%40gitgraph/js)、最終公開は約5年前 | 現在の履歴表示とコミット線 | 中 | リポジトリを自動解析するものではなく、独自APIでグラフを再構築する必要がある。更新停滞もあり非推奨 |
| 現在の描画を実データ対応させる | `git.log()`等を既存UIへ渡す | 自作 | [renderHistory()](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:463) | 低～中 | この規模では最適。依存を増やさず、ゲームの世界観も維持できる |

## 「本物のgitコマンドを打たせる」教材は作れるか

**ローカル操作については十分現実的である。**

実現可能:

- `git init`
- `git add`
- `git commit`
- `git branch`
- `git switch` / `checkout`
- `git status`
- `git log`
- 単純な`git merge`
- `git remote add`

判定は入力文字列ではなく、次の実状態で行う。

- `statusMatrix()`でworking tree/index/HEADを検査
- `currentBranch()`で現在ブランチを検査
- `log()`でコミット数・メッセージ・親を検査
- `resolveRef()`でブランチの指すコミットを検査
- ファイル内容を読み、コンフリクト解消結果を確認

制約:

- isomorphic-gitのmergeには複数merge baseや一部戦略などの制限がある。[merge API](https://isomorphic-git.org/docs/en/merge.html)
- 外部GitHubへのclone/pushはブラウザのCORS制約を受ける。公式にもCORS proxy利用が案内されている。[isomorphic-git CORS proxy](https://github.com/isomorphic-git/cors-proxy)
- PATをゲームへ入力・保存させる設計は避ける
- `push`教材は、ブラウザ内に作ったbare相当の模擬リモート、または教材専用の限定APIにする

したがって、**S3/CloudFrontだけで完結させるなら、pushの通信部分だけは演出として残し、そこまでの履歴・参照操作を本物にする**のが安全である。

---

# 2. ブラウザで本物のLinux／シェルを動かす

## 候補比較

| 名前 | 一行説明 | リポジトリ・ライセンス・活動状況 | 静的配信・サイズ・モバイル | 置き換わる範囲／判断 |
|---|---|---|---|---|
| WebVM / CheerpX | 未変更のx86 Debianをブラウザで動かす | [WebVM](https://github.com/leaningtech/webvm)はApache-2.0、活発。CheerpX本体はプロプライエタリ | GitHub Pages例あり。ただしOSイメージを含み重い。初回転送量の確定値は未確認。携帯実用性も公式保証未確認 | Linux Story Quest全体を実Linuxへ置換可能だが、個人教材には大きすぎる |
| container2wasm | OCIコンテナをCPUエミュレータ込みWASMへ変換 | [GitHub](https://github.com/container2wasm/container2wasm) / Apache-2.0 / v0.8.4、2026-03 | [静的デモ](https://ktock.github.io/container2wasm-demo/amd64-debian-wasi.html)あり。サイズはコンテナ依存で大きく、携帯には不向き | Linux互換性は高いが、教材の20数コマンドのためにrootfs全体を積むのは過剰 |
| busybox-wasm-wasi | BusyBoxをWASIXでブラウザ実行 | [GitHub](https://github.com/MentalGear/busybox-wasm-wasi) / BusyBox部分GPL-2.0 / ソースは活動あり、正式リリース時期未確認 | 事前構築物は約608KB。COOP/COEP必須。モバイル互換性未確認 | 中間案。ただし`df`、`du`、`tar`、`ping`、ネットワーク等が不足し、パイプも制限 |
| busybox-wasm | 古いBusyBox WASMラッパー | [GitHub](https://github.com/thegecko/busybox-wasm) / ラッパーMIT、BusyBoxはGPL-2.0 / リリースなし、更新停滞 | 静的配信可能 | 非採用。古く、ライセンス表示にも注意が必要 |
| Bashkit | Rust/WASM製のサンドボックス化Bash風実行環境 | [GitHub](https://github.com/everruns/bashkit) / MIT / [npm 0.16.0](https://www.npmjs.com/package/%40everruns/bashkit-wasm)、2026年8月更新 | 特殊ヘッダーやSharedArrayBuffer不要。WASM実サイズは未確認。構成上はモバイル候補だが正式対応表は未確認 | Linux Story Questの「実シェルモード」第一候補。新しい0.xであるため本番全面移行は早い |
| jsh | JavaScriptからシェル風処理を書くNodeライブラリ | [GitHub](https://github.com/bradymholt/jsh) / MIT / [npm 0.58.0](https://www.npmjs.com/package/jsh)、最終公開約2年前 | Node専用 | ブラウザシェルでもBash実装でもないため非採用 |
| @wasmer/sdk / wasmer-js | WASI/WASIXプログラムをブラウザで実行するランタイム | [GitHub](https://github.com/wasmerio/wasmer-js) / MIT / 活発、最新SDK版は未確認 | 静的配信可能。プログラムによってCOOP/COEPが必要 | それ自体はLinuxでもシェルでもない。BusyBox等を載せる基盤 |
| Wasmer shell / webassembly.sh | WASMパッケージを実行するWebシェル | [GitHub](https://github.com/wasmerio/webassembly.sh) / MIT / 最近のリリース未確認、旧世代構成 | PWAとして静的配信可能 | 現行教材の基盤としては更新状況が弱く非採用 |
| GNU BashのWASM移植 | GNU BashをそのままWASM化する案 | 教材基盤として継続的に保守され、ブラウザFSまで統合された標準的実装は確認できず | 未確認 | 現時点ではBashkitまたはBusyBoxの方が現実的 |

## WebVM / CheerpXのライセンス上の注意

[CheerpXの公式ライセンス説明](https://cheerpx.io/licensing)では、Community利用は個人・OSS・評価などに限定され、クレジット表示が求められる。個人または一人会社の商用利用も条件付きで認められる一方、**CheerpXをダウンロードして自己ホストすることやOEM再配布はCommunity条件では許可されない**。

Small Business条件は公式掲載時点で1開発者あたり月額£100で、自己ホスト/OEMが含まれる。

したがって、

- 技術的には静的サイトへ配置できる
- しかしS3/CloudFrontへCheerpX本体を自己ホストするには商用条件の確認が必要
- 無料公開でも「何を自己ホストできるか」を技術判断だけで決めてはいけない

という状態である。個人学習ゲームの中核依存としては推奨しない。

## v86との差分

- v86: PC、CPU、周辺機器、OSカーネル全体をエミュレーション
- WebVM/CheerpX: x86 Linuxバイナリをブラウザ実行する独自仮想化層
- container2wasm: コンテナとCPUエミュレータをWASMへ梱包
- BusyBox/Bashkit: シェルとユーザーランドだけを実装
- Wasmer: WASI/WASIXプログラムのランタイム

Linux Story Questに必要なのはOSブートではなく、限定的なFS操作とコマンド意味論である。中間案としてはBashkitが最も近く、WebVM/container2wasmは依然として重すぎる。

---

# 3. 仮想FSとコマンドパーサ

## 現在のLinux実装

- [stageSeed](/home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:67) が説明、正解条件、敵、報酬を保持
- [createState()](/home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:146) がディレクトリ・ファイル・プロセス等をJSON化可能な形で保持
- [tokenize()](/home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:212) が引用符と空白を簡易解析
- [resolvePath()](/home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:329) 以下が仮想FS操作
- [runCommand()](/home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:521) が約20種類以上のコマンドを実装
- [advanceIfNeeded()](/home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:938) がコマンド後の状態を検査

## パーサ候補

| 名前 | 一行説明 | リポジトリ・ライセンス・活動状況 | 置き換わる範囲 | 採用コスト・判断 |
|---|---|---|---|---|
| mvdan/sh | Go製の本格的POSIX/Bash構文パーサ・整形器 | [GitHub](https://github.com/mvdan/sh) / BSD-3-Clause / 活発 | `tokenize()`と将来のAST | 高。本体はGo。ブラウザWASMは公式中核配布ではなく、単純教材には過剰 |
| sh-syntax | mvdan/shをWASM経由でJSから使うパーサ | [GitHub](https://github.com/un-ts/sh-syntax) / MIT / [npm 0.6.0](https://www.npmjs.com/package/sh-syntax)、2026年更新 | `tokenize()`を完全なシェルASTへ置換 | 中～高。解析専用で実行はしない。パイプ、置換、リダイレクトを本格対応するときのみ候補 |
| bash-parser | BashをJavaScriptでAST化 | [GitHub](https://github.com/vorpaljs/bash-parser) / MIT / [npm 0.5.0](https://www.npmjs.com/package/bash-parser)、約9年前 | `tokenize()` | 中。長期停滞しており非採用 |
| shell-quote | 引用、エスケープ、演算子を小さく解析 | [GitHub](https://github.com/ljharb/shell-quote) / MIT / [npm 1.10.0](https://www.npmjs.com/package/shell-quote)、2026-07 | `tokenize()` | 低。現在の自作tokenizerを少し強化するなら第一候補 |
| minimist | argvの短いオプションを解析 | [npm](https://www.npmjs.com/package/minimist) / MIT / 正確な最終リリース時期は未確認 | `ls -la`等のオプション部分 | 低。シェル構文は解析しない |
| yargs-parser | GNU風オプションを比較的厳密に解析 | [GitHub](https://github.com/yargs/yargs-parser) / ISC / 最新リリース時期は未確認 | 各コマンドのオプション処理 | 中。教材の数個のフラグには過剰 |

### 自作パーサを維持してよい理由

現在のゲームは一般目的シェルではなく、ステージが要求する構文が限定されている。本格パーサを導入すると、構文を認識できても、パイプ、変数展開、glob、subshell、終了コードなどを実行できないという別の不整合が生じる。

したがって次の方針がよい。

1. 当面は自作の許可リスト方式を維持
2. 引用符・バックスラッシュ対応だけ必要になったら`tokenize()`をshell-quoteへ置換
3. パイプや`&&`を本当に実行する段階でBashkitを検討
4. mvdan/sh WASMは「構文解説機能」を作る場合に限定

## coreutils候補

| 名前 | 一行説明 | リポジトリ・ライセンス・活動状況 | 置き換え可否 |
|---|---|---|---|
| Bashkit built-ins | grep、sed、awk、jq、find等をWASM環境内で提供 | [GitHub](https://github.com/everruns/bashkit) / MIT / 活発 | 最も現実的。ただし現行ゲームの独自`curl/ping/process`演出との整合が必要 |
| BusyBox WASIX | 60以上の小型Unixコマンド | [GitHub](https://github.com/MentalGear/busybox-wasm-wasi) / GPL-2.0 / 活動あり | 一部置換可能だが、現在の課題に必要な`df/du/tar/ping`などが不足 |
| wasi-fs-access / uutils実験 | Rust coreutilsをWASIとFile System Access APIで動かす実験 | [GitHub](https://github.com/GoogleChromeLabs/wasi-fs-access) / Apache-2.0 / 最近のリリース未確認 | 技術デモ寄り。教材基盤としては非推奨 |
| ShellJS | NodeでUnix風コマンドを提供 | [GitHub](https://github.com/shelljs/shelljs) / BSD-3-Clause / 活動あり | Node中心でブラウザ教材の直接代替にならない |

現状の全コマンドを一貫して置き換えられる、成熟した純JavaScript版GNU coreutils一式は確認できなかった。Linux Story Questでは、**対象コマンドの意味を明示した自作実装をテストで保証する方が扱いやすい**。

---

# 4. クエスト進行・状態機械

## 汎用FSM

| 名前 | 一行説明 | リポジトリ・ライセンス・活動状況 | 置き換わる範囲 | 採用コスト・判断 |
|---|---|---|---|---|
| XState v5 | statechart、guard、actor、並列・階層状態を扱う本格FSM | [GitHub](https://github.com/statelyai/xstate) / MIT / [npm 5.32.5](https://www.npmjs.com/package/xstate)、2026-08時点で活発 | `currentQuest()`、`advanceIfNeeded()`、画面遷移 | 高。現在の線形進行には過剰。最新圧縮サイズは公式に確認できず、実ビルド計測が必要 |
| robot3 | 小さな関数型FSM | [GitHub](https://github.com/matthewp/robot) / BSD-2-Clause / [npm 1.2.0](https://www.npmjs.com/package/robot3)、最終公開約1年前 | クエスト段階 | 中。XStateより軽いが、現状の配列＋predicateより明確になるとは限らない |
| nanostores + machine | Nano Stores上に小さなmachineを構築 | [Nano Stores](https://github.com/nanostores/nanostores) / MIT / machineパッケージは2026年登場の0.x | 進行状態とUI購読 | 中。新しく実績が少ない。今回のためだけには採用しない |
| @xstate/fsm | 旧XStateの軽量FSM | [npm](https://www.npmjs.com/package/%40xstate/fsm) / MIT / 2.1.0、約3年前 | クエスト段階 | 非採用。[v5系では非推奨](https://stately.assurant.com/docs/xstate-fsm) |

XStateが有効なのは、同時進行クエスト、キャンセル、履歴状態、複雑な復帰、NPCごとの独立actorなどが必要になった場合である。現在の両ゲームはほぼ一本道で、実際のGit/FS状態が既に正解のsource of truthになるため、FSMを加えると状態が二重化しやすい。

## ダイアログ／クエスト特化

| 名前 | 一行説明 | リポジトリ・ライセンス・活動状況 | 判断 |
|---|---|---|---|
| Yarn Spinner | 対話記述言語とUnity/.NET中心のランタイム | [GitHub](https://github.com/YarnSpinnerTool/YarnSpinner) / コアはMIT、周辺製品は[YSPL](https://yarnspinner.dev/yspl)確認が必要 / v3.2.1、2026-05 | 公式の第一級JSブラウザランタイムは確認できず、非採用 |
| Bondage.js | Yarn形式をJavaScriptで実行 | [GitHub](https://github.com/hylyh/bondage.js) / MIT / [npm 2.2.0](https://www.npmjs.com/package/bondagejs)、約5年前 | 更新停滞。最新Yarn仕様への完全対応ではなく非採用 |
| yarn-bound | Bondage系をラップしたYarn 2向けJSランタイム | [GitHub](https://github.com/mnbroatch/yarn-bound) / ISC / [npm 0.5.5](https://www.npmjs.com/package/yarn-bound)、約2年前 | 導入に対する利点が小さい |
| Twison | Twine 2作品をJSONへ書き出す形式 | [GitHub](https://github.com/lazerwalker/twison) / MIT / 正確な最終リリース時期は未確認 | ランタイムや状態機械ではない。Twineを執筆UIに採用しない限り不要 |

会話内容が地図上の移動、敵、コマンド結果、ファイル状態と密結合しているため、ダイアログエンジンへの載せ替えは逆に接着コードを増やす。`stageSeed`を別モジュールへ分離する程度がよい。

## セーブデータと実績

現在は両方ともlocalStorageへほぼ全状態を保存している。今後は次のように分ける。

```text
永続FS
├─ Git Dungeon: LightningFS / IndexedDB
└─ Linux Story Quest: 現在のJSON FS、将来はZenFSも選択可

ゲーム進行JSON
├─ schemaVersion
├─ 現在地
├─ HP / XP
├─ 表示済みイベント
└─ achievementIds
```

Git Dungeonでは`firstCommit`や`mergedFeature`を保存せず、実リポジトリから導出する。これによりセーブデータとGit状態の矛盾を避けられる。

実績専用OSSとしては、[LittleJS](https://github.com/KilledByAPixel/LittleJS)にMedalsプラグインがあるが、ゲームエンジン全体への依存になるため不採用でよい。実績IDの`Set`、解除条件の純関数、解除時刻だけで十分である。

---

# 5. 教材としての正しさを担保する仕組み

## 推奨テスト構成

### Vitestによる中核ロジック試験

[Vitest](https://github.com/vitest-dev/vitest)はMIT、2026年8月も4.1系を中心に活発である。

Linux Story Quest:

- `runCommand()`をDOM操作から分離
- 初期FS、入力、期待stdout、期待FS差分を表形式でテスト
- 正解例だけでなく、タイプミス、存在しないパス、権限不足、危険なオプションも検査
- 対応範囲について、CI上のGNU/Linux実行結果とのcontract testを設ける
- ゲーム独自仕様はGNUとの差をコメントとテスト名で明示

Git Dungeon:

- テストごとに空のLightningFSを生成
- `init → add → commit → branch → checkout → merge`を実行
- 文字列出力ではなく`statusMatrix()`、`log()`、`currentBranch()`、ファイル内容を検証
- authorとtimestampを固定し、コミットOIDを再現可能にする
- 同じ結果になる別解、例えば`git add .`と個別`git add file`を許容する

### PlaywrightによるE2E

[Playwright](https://github.com/microsoft/playwright)はApache-2.0で、2026年も活発である。

確認対象:

- キーボード入力とEnter送信
- ステージ進行
- 誤答時に進行しないこと
- リロード後の復帰
- セーブデータのschema migration
- IndexedDB内Gitリポジトリの復元
- リセット
- モバイルviewport
- コンフリクト解消の複数正解

Playwrightは全コマンドの組み合わせテストに使わず、代表的なユーザーフローだけに限定する。中核ロジックはVitestで高速に回す。

## tldr／manから正解例を取り込めるか

### tldr

[tldr-pages](https://github.com/tldr-pages/tldr)はページがCommonMarkで、コマンド例が機械処理しやすい。クライアント仕様も[公開されている](https://github.com/tldr-pages/tldr/blob/main/CLIENT-SPECIFICATION.md)。

利用するなら次が必要である。

- ビルド時に特定コミットまたはリリースへ固定
- 日本語ページがない場合のフォールバック
- コードブロックとプレースホルダーの変換
- [コンテンツのCC BY 4.0、スクリプトのMIT](https://github.com/tldr-pages/tldr/blob/main/CONTRIBUTING.md)に従った帰属表示
- 各例を教材作者が確認

tldrは代表例集であり、コマンドの完全な仕様でも正解集合でもない。**ヒントや追加例には使えるが、回答判定を自動生成する情報源にはしない**。

### man

manページは一括して同じ提供元・同じライセンスではない。Linux man-pages、GNU coreutils、Bash built-insなどに分かれ、roff解析も必要になる。さらに「文法上有効」と「このステージの学習目標を満たす」は別問題である。

したがって、manの自動取り込みは補助説明の生成に限定し、正解判定は実エンジンの状態検査と手書きテストケースを基準にする。

---

# 最終的な載せ替え方針

## Linux Story Quest

| 領域 | 方針 | 理由 |
|---|---|---|
| 画面、物語、マップ、戦闘演出 | 自作のまま | 独自価値でありOSS化の利益がない |
| `stageSeed` | 自作のまま、別モジュールへ分離 | 線形クエストには十分。predicateも読みやすい |
| クエスト状態機械 | XStateを導入しない | 現在は一本道で、状態二重化の方が危険 |
| 仮想FS | 当面自作のまま | JSON保存と課題判定に適合している |
| FSの将来拡張 | 必要時のみZenFS | mount、IndexedDB、Node互換が本当に必要になった場合 |
| tokenizer | 当面自作、引用処理強化時にshell-quote | フルBash ASTは過剰 |
| コマンド実装 | 自作を維持してテスト追加 | 必要なコマンド集合を一貫して置換できるOSSがない |
| 実シェル体験 | Bashkitを実験モードで評価 | 静的配信しやすく中間案として有望だが、まだ0.x |
| セーブ | localStorage＋`schemaVersion` | 現在の規模には十分 |
| 品質保証 | Vitest＋少数のPlaywright | 実装と教材の正しさを分離して検証できる |

具体的には、[runCommand()](/home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:521)を純関数に近いコマンドエンジンへ切り出すリファクタリングを、OSS載せ替えより先に行うべきである。

## Git Dungeon

| 領域 | 方針 | 理由 |
|---|---|---|
| 画面、物語、マップ、戦闘演出 | 自作のまま | 学習ゲームとしての独自部分 |
| Gitリポジトリ | isomorphic-gitへ全面置換 | 実コミット、index、refをsource of truthにできる |
| 仮想FS | @isomorphic-git/lightning-fs | Git用途に特化し、IndexedDBへ永続化できる |
| Gitコマンド入力 | 薄い許可リスト型アダプターを自作 | 完全CLI再現を避けながら標準的な入力を許容できる |
| 進行判定 | 入力文字列ではなくリポジトリ状態を検査 | 別解を許容し、教材として正しくなる |
| `currentQuest()` | 地図・会話の順序だけ残す | Git由来の真偽値は実状態から導出 |
| コミットグラフ | 現在のUIを`git.log()`対応 | @gitgraph/jsは更新停滞かつ別モデルの同期が必要 |
| コンフリクト | isomorphic-git merge＋教材側の解消フロー | 実ファイル状態を判定可能。ただし複雑なmergeは対象外 |
| remote/push | remote設定は実物、外部pushは模擬 | 静的サイトのCORS、認証情報保存を避ける |
| セーブ | LightningFS＋最小限のゲーム状態JSON | Git進行フラグとの矛盾をなくせる |
| 品質保証 | Vitestで実repo検査、Playwrightで一周 | 偽のGit出力ではなく実状態を検証できる |

最も価値の高い変更は、[handleGitCommand()](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:561)以下の偽Git実装をisomorphic-gitへ置き換え、[currentQuest()](/home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:176)のGit進行フラグを実リポジトリから導出することである。

要約すると、**Gitは本物へ載せ替える価値が大きく、Linuxはテスト可能な自作教材エンジンとして残す価値が大きい**。WebVMやcontainer2wasmまで進む必要はない。