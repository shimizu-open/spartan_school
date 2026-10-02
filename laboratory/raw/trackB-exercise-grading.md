# 第3ラウンド トラックB調査  
## 手を動かして学ぶ系プラットフォームOSS — 演習と正誤判定はどうモデル化されているか

調査日: 2026-08-25

## 結論

第一推奨は、**Exercismの教材リポジトリ設計をデータモデルとして採用し、実行・表示部分は現在の静的JavaScriptゲームを継続する構成**です。

Exercism本体をセルフホストするのではなく、次を借ります。

- `track → concept → exercise → task/test → exemplar`
- 概念の前提関係 `prerequisites`
- 教える演習 `concept exercise` と、復習する演習 `practice exercise` の分離
- 問題文、ヒント、設計意図、判定、模範解答を別ファイルにする
- 学習者が入力した手順ではなく、実行後の状態・出力をテストする

そして判定モデルは、Linux Story Questには現在の「コマンド解析結果＋仮想FS状態」、Git DungeonにはLearn Git Branching型の「コミットグラフ状態一致」を使います。

```text
Exercism型教材データ
    ├── Linux用の仮想OSランタイム
    ├── Git用の仮想リポジトリランタイム
    └── 共通進捗・XP・実績層
```

CTFd、PrairieLearn、Runestone、freeCodeCampはいずれも優れていますが、ひとり運用・S3/CloudFront・アカウント無しという条件では、プラットフォーム全体の採用コストが高すぎます。

---

# 1. カリキュラム／演習をコードとして管理するOSS

## 1.1 運用・ライセンス・規模

| OSS | 一行説明・リポジトリ | ライセンス／活発度 | 規模・採用コスト・注意点 |
|---|---|---|---|
| Exercism | 言語ごとの概念、演習、テスト、模範解答をGitで管理する学習基盤。[入口](https://github.com/exercism/exercism) / [現行Webアプリ](https://github.com/exercism/website) / [TypeScript track](https://github.com/exercism/typescript) / [problem-specifications](https://github.com/exercism/problem-specifications) | WebアプリはAGPL-3.0、各trackとproblem-specificationsは主にMIT。2026年8月にもtrack更新があり活発。なお `exercism/exercism` は現在、主に案内用で、現行コードは `exercism/website` にある。[公式説明](https://github.com/exercism/exercism) | Web基盤全体のセルフホストは大規模で個人向きでない。trackリポジトリの構造だけなら採用コスト低。最有力の設計資料。 |
| freeCodeCamp | Markdown演習、テスト、エディタ、ユーザー進捗、認定を一体化した巨大OSS学習サイト。[リポジトリ](https://github.com/freeCodeCamp/freeCodeCamp) | BSD-3-Clause。2026年8月にも更新され非常に活発。[GitHub組織](https://github.com/orgs/freeCodeCamp/repositories) | 数十万行規模のフルプラットフォーム。ひとりでfork運用する対象ではない。教材ファイル構造とchallenge schemaを借りる価値が高い。 |
| The Odin Project | 読み物、外部資料、実制作プロジェクトを学習パスとして並べるWeb開発カリキュラム。[curriculum](https://github.com/TheOdinProject/curriculum) / [Webアプリ](https://github.com/TheOdinProject/theodinproject) | WebアプリMIT、教材はCC BY-NC-SA 4.0。[教材ライセンス](https://github.com/TheOdinProject/curriculum/blob/main/license.md) 2026年も更新あり。 | 自動採点より「読む→外で作る→自己完了」が中心。日本語教材や商用公開に教材を流用する場合、非商用条項に注意。 |
| Runestone Academy | 対話問題を教科書本文に埋め込む教材・LMS基盤。[現行monorepo](https://github.com/RunestoneInteractive/rs) | MIT。ただし同梱教材・一部依存物に別ライセンスあり。2026年更新あり。[ライセンス](https://github.com/RunestoneInteractive/rs/blob/main/LICENSE) | 静的教材だけなら中程度、サーバー・採点・分析込みはDocker、DB等が必要で重い。旧RunestoneComponentsはアーカイブ済み。 |
| PrairieLearn | Pythonで問題をランダム生成し、同じコードで採点まで行う問題駆動型LMS。[リポジトリ](https://github.com/PrairieLearn/PrairieLearn) | Community EditionはAGPL-3.0、EE部分は別ライセンス。[ライセンス](https://github.com/PrairieLearn/PrairieLearn/blob/master/LICENSE) 2026年6月にも継続デプロイされ非常に活発。 | PostgreSQL、コンテナ採点、ワーカーを持つ大規模システム。ひとり運用には重い。問題生成・判定関数の分離は非常に参考になる。 |
| WeBWorK / OPL | PG言語でランダム数学問題と答案評価器を記述するLMS＋問題バンク。[WeBWorK](https://github.com/openwebwork/webwork2) / [OPL](https://github.com/openwebwork/webwork-open-problem-library) | WeBWorKはGPL-2.0以降またはArtistic 1.0。OPL既定はCC BY-NC-SA 3.0で、個別問題に別ライセンスの場合あり。[OPLライセンス](https://github.com/openwebwork/webwork-open-problem-library/blob/main/OPL_LICENSE) 2026年も更新あり。 | Perl、DB、PGレンダラーを伴い重い。3万問超の問題バンク構造は参考になるが、ゲーム用途への直接採用理由は薄い。 |
| CTFd | チャレンジ、提出、正解フラグ、ヒント、得点、解除条件を扱うCTF基盤。[リポジトリ](https://github.com/CTFd/CTFd) | Apache-2.0。3.8.6が2026-06-16リリースで活発。[リリース](https://github.com/CTFd/CTFd/releases) | Docker＋DBを運用できれば個人利用可能。ただし静的サイトではない。ゲーム進行モデルは非常に近いが、標準判定は文字列フラグ中心。 |
| Jupyter Book 2 | Markdown／Notebookから実行可能な技術書を生成する。[リポジトリ](https://github.com/jupyter-book/jupyter-book) | BSD-3-Clause。v2.1.5が2026-05-02。v2はMyST Document Engine上の実装。[公式FAQ](https://jupyterbook.org/latest/resources/faq/) | 静的出版は一人でも容易。採点・ユーザー進捗は持たない。記事・授業メモの器として有効。 |
| Quarto | Markdown、Notebook、Jupyter、Knitr、Observableを統合する技術出版システム。[リポジトリ](https://github.com/quarto-dev/quarto-cli) | MIT。安定版v1.9.38が2026-05-25。[リリース](https://github.com/quarto-dev/quarto-cli/releases) | 静的サイト生成は容易。ビルド時実行は強いが、学習者の提出・採点・進捗は別実装。 |
| MyST | 構造化MarkdownをASTへ変換し、書籍・論文・サイトを生成するエンジン。[リポジトリ](https://github.com/jupyter-book/mystmd) | MIT。1.9.1系が確認でき、活発。[リリース](https://github.com/jupyter-book/mystmd/releases) | Node.js利用者にはJupyter Bookより直接扱いやすい。教材文書の器であり、LMSではない。 |

## 1.2 演習・判定・進捗のモデル

| OSS | 演習を何で表現するか | 正解判定 | 進捗の保存先 |
|---|---|---|---|
| Exercism | trackの `config.json`、`concepts/<slug>`、`exercises/concept/<slug>`、`exercises/practice/<slug>`。各演習は `.docs`、`.meta`、テスト、stub、exemplarを持つ | 学習者コードを言語別テストランナーへ渡す。共通問題は `canonical-data.json` からtrack固有テストを生成可能 | Exercism Web側のユーザー・submission DB。track repo自身は進捗を持たない |
| freeCodeCamp | `superBlock → chapter → module → block → challenge`。challengeはfrontmatter付きMarkdown | Markdown内の `--tests--` 等から生成されたテストを、challenge typeに応じブラウザまたは専用環境で実行 | アカウントの `completedChallenges`、保存コード、認定情報 |
| Odin | `path → course → section → lesson/project`。教材は主にMarkdown、構造はWebアプリ側にも登録 | 多くは自動採点なし。質問への自己確認、外部exercise repoのテスト、プロジェクト成果物 | ログインユーザーがlesson/projectを手動完了。未ログインでは恒久進捗なし |
| Runestone | PreTeXtの `<exercise>`、`<statement>`、`<hint>`、`<answer>`、`<solution>`、ActiveCode、Parsons等 | 選択肢、並べ替え、数値、Unit Test、IO Testなど。汎用静的HTMLでも一部ブラウザ採点可能 | 通常の静的HTMLでは保存しない。Runestoneサーバー利用時に回答・得点・操作履歴を保存 |
| PrairieLearn | `info.json`、`question.html`、秘密の `server.py`、必要なら `tests/` とworkspace | `server.py` の `generate/prepare/parse/grade/test`。コード課題は隔離コンテナの外部grader | PostgreSQL上のquestion variant、submission、assessment instance、score |
| WeBWorK / OPL | `.pg`ファイル。Subject/Chapter/Sectionの階層とメタデータ、問題seed | PGのanswer evaluator。数値誤差、数式同値、選択肢、手動採点など | WeBWorKサーバーのcourse/user/problem set DB |
| CTFd | Challengeが第一級。category、description、files、flags、hints、prerequisites、valueを関連付ける | static/regex flag、複数flagのany/all/team、pluginによる独自判定 | User/Team、Submission、Solve、Hint unlock、ScoreをDBへ記録 |
| Jupyter Book / Quarto / MyST | Markdown、MyST Markdown、`.qmd`、`.ipynb`、コードセル | 原則は著者のビルド時コード実行。Jupyter BookのThebe等で対話実行できるが、標準の学習採点器ではない | 標準では学習者進捗を持たない |

## 1.3 Exercismの `config.json` が示す設計

Exercism trackの `config.json` は単なる表示設定ではなく、カリキュラムの中心モデルです。[公式仕様](https://exercism.org/docs/building/tracks/config-json)

主要フィールドは次です。

```json
{
  "language": "Linux Quest",
  "slug": "linux-quest",
  "active": true,
  "version": 3,
  "status": {
    "concept_exercises": true,
    "test_runner": true,
    "representer": false,
    "analyzer": false
  },
  "concepts": [
    {
      "uuid": "...",
      "slug": "filesystem-navigation",
      "name": "ファイルシステム移動"
    }
  ],
  "exercises": {
    "concept": [
      {
        "uuid": "...",
        "slug": "find-the-workshop",
        "name": "工房を探せ",
        "concepts": ["filesystem-navigation"],
        "prerequisites": ["shell-basics"],
        "status": "active"
      }
    ],
    "practice": [
      {
        "uuid": "...",
        "slug": "lost-archive",
        "name": "失われた書庫",
        "practices": ["filesystem-navigation", "file-search"],
        "prerequisites": ["filesystem-navigation"],
        "difficulty": 3
      }
    ]
  }
}
```

特に重要なのは以下です。

- `concepts` は画面ページではなく、習得対象そのもの。
- `concept exercise` は新概念を教える。
- `practice exercise` は複数概念を再利用する。
- `prerequisites` が解除条件となる。
- 配列順が推奨学習順になる。
- `wip / beta / active / deprecated` で教材のライフサイクルを管理する。
- `.meta/design.md` に学習目標、対象外、設計理由を残す。
- exemplarは表示用の「答え」ではなく、テストと課題仕様の整合性を保証する実行可能資料になる。

これは依頼者の「ステージ」を、画面上の番号から**概念・前提・演習の関係**へ昇格させるモデルです。

## 1.4 PrairieLearnのquestion generator思想

PrairieLearnでは「問題」は固定文章ではなく、次の関数群です。

```python
def generate(data):
    # 今回の問題パラメータと正解を生成

def parse(data):
    # 学習者入力を構造化

def grade(data):
    # 正解との比較、部分点、フィードバック
```

`question.html` は表示、`server.py` は生成・判定、`info.json` は識別子・topic・tags・採点方式を担当します。[概念説明](https://github.com/PrairieLearn/PrairieLearn/blob/master/docs/concepts/index.md)

ここから借りるべき思想は、**1個の課題定義から多数のvariantを生成すること**です。

例:

- Linux: 初期ディレクトリ名、対象ファイル名、検索語をseedから変更
- Git: ブランチ名、分岐位置、必要な最終グラフを変更
- 同じ「概念」でも丸暗記では突破できない
- seedを進捗に保存すれば再現可能

---

# 2. ブラウザ内実行・採点

## 2.1 比較

| OSS | 一行説明・リポジトリ | ライセンス／活発度 | 静的ホストだけで動くか | コスト・注意点 |
|---|---|---|---|---|
| JupyterLite | JupyterLabとPython kernelをブラウザ内で動かす。[リポジトリ](https://github.com/jupyterlite/jupyterlite) | BSD-3-Clause。0.7.6が2026-05-07。[リリース](https://github.com/jupyterlite/jupyterlite/releases) | **可能**。静的HTTPで配信し、NotebookをIndexedDBまたはlocalStorageに保存 | フルJupyter UIなのでゲームへの埋め込みには大きい。Notebook教材には有力 |
| Pyodide | CPythonをWebAssembly化したブラウザPython。[リポジトリ](https://github.com/pyodide/pyodide) | MPL-2.0。0.29.4が2026-05-07。[変更履歴](https://pyodide.org/en/stable/project/changelog.html) | **可能** | 初期ダウンロード、メモリ、Worker設計が必要。socket、thread、process、`fcntl`、`termios`等は使えず、本物のLinux演習にはならない。[制約](https://pyodide.org/en/stable/usage/wasm-constraints.html) |
| Sandpack | CodeSandboxのブラウザbundlerとReact UI部品。[リポジトリ](https://github.com/codesandbox/sandpack) | Apache-2.0。最終安定releaseはv2.20.0、2025-02-14 | **基本可能**だがbundlerの配信方式・外部依存に注意 | React前提の完成UIは素のJS構成と合わない。2026年に保守状況への未回答質問があり、第一選択にはしにくい。[状況](https://github.com/codesandbox/sandpack/discussions/1292) |
| Judge0 | 90以上の言語を隔離実行するHTTP API。[リポジトリ](https://github.com/judge0/judge0) | GPL-3.0。最新CE releaseは1.13.1、2024-04-18 | **不可** | API、worker、PostgreSQL、Redis、Docker/isolateが必要。公開コード実行では監視・レート制限・更新対応必須。1.13.0以前には重大なsandbox escapeがあるため必ず1.13.1以降。[Advisory](https://github.com/judge0/judge0/security/advisories/GHSA-q7vg-26pg-v5hr) |
| Piston | 多言語の軽量コード実行API。[リポジトリ](https://github.com/engineer-man/piston) | MIT。release時期未確認。READMEは2026年にも更新 | **不可** | Docker、privileged/isolate、cgroup v2、各言語runtimeの保存が必要。2026-02-15以降、公開APIは自由利用できず、ポートフォリオ等へのキー発行もしない方針。セルフホスト前提 |
| CodeMirror 6 | 小型でモジュール式のブラウザコードエディタ。[リポジトリ](https://github.com/codemirror/dev) | MIT。2026年も更新・IME修正議論あり。中央release時期は未確認 | **可能** | 軽量で素のJSと相性がよい。採点機能はない。IME合成中に値変更を確定扱いしない実装が必要 |
| Monaco Editor | VS Codeのエディタ部分。[リポジトリ](https://github.com/microsoft/monaco-editor) | MIT。v0.56.0が2026-07-20。[リリース](https://github.com/microsoft/monaco-editor/releases) | **可能** | Workerとbundle設定が必要。重く、モバイル非対応。短いコマンド入力には過剰 |
| WebContainers | ブラウザ内でNode.js、npm、仮想FS、開発サーバーを動かす | API/docs周辺は公開されているが、ランタイム本体を自由にforkできる通常のOSSとは扱わない方が安全 | 静的配信可能だがCOOP/COEP、SharedArrayBuffer、Service Workerが必要 | 第2ラウンドとの差分: Git/Linuxの状態モデルには過剰。将来「npm installしてプロジェクトをテストする」教材を作る段階で採用候補。Firefox/Safariは制約あり。[ブラウザ要件](https://developer.stackblitz.com/platform/webcontainers/browser-support) |

## 2.2 静的ホスティング境界

### S3 / CloudFront / Cloudflare Pagesだけで完結

- 現在の仮想Linux・仮想Gitランタイム
- CodeMirror 6
- Monaco Editor
- Pyodide
- JupyterLite
- Sandpackのブラウザbundler部分
- Chai等のassertion
- sandboxed iframe / Web Worker内のJavaScriptテスト
- localStorage / IndexedDB進捗
- Jupyter Book / Quarto / MySTの生成済みサイト
- Learn Git Branching型の状態シミュレータ

### サーバーが必要

- Judge0
- Piston
- PrairieLearnの標準採点
- CTFd
- WeBWorK
- Runestoneのアカウント、採点記録、分析
- freeCodeCamp／Odin／Exercismのユーザーアカウントと同期進捗
- 本物のLinuxプロセス、socket、Git executableを使った公開コード実行

---

# 3. テストで正解を判定する設計

## 3.1 Exercism方式をブラウザだけで実現する

依頼者の用途では、VitestのUI全体を学習者ごとに起動するより、以下の小さなランタイムが適します。

```text
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

テスト結果はbooleanだけにせず、次を持たせます。

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

候補は次の通りです。

- assertion: Chai、または `equal/deepEqual/ok/match` だけの自作小型assert
- 開発時の教材テスト: Vitest、Web Test Runner
- 学習者実行時: browser bundleされたtest harness
- 無限ループ対策: Web Workerを時間制限でterminate
- DOM課題: `sandbox` 属性付きiframe内で実行
- 公開ユーザーの任意コード: 同一originのWorkerだけをセキュリティ境界と思わない。ネットワーク、storage、親画面への影響を分離する

Web Test Runnerは実ブラウザ、Playwright等で教材作者のテストを回す道具であり、配信後の学習者向けrunnerそのものではありません。[公式説明](https://modern-web.dev/docs/test-runner/overview/)

## 3.2 コマンド入力: 文字列一致ではなく状態到達

正解判定は三層に分けるべきです。

1. 構文受付

```js
parse("cp docs/a.txt atelier/b.txt")
```

2. コマンド実行

```js
nextState = execute(previousState, commandAst)
```

3. 課題判定

```js
grade(nextState, goalConstraints)
```

悪い判定:

```js
input === "cp docs/a.txt atelier/b.txt"
```

望ましい判定:

```js
fileExists("/home/student/atelier/b.txt") &&
fileContent("/home/student/atelier/b.txt") === originalContent
```

これなら以下を許容できます。

- 相対パス／絶対パス
- `./atelier/b.txt`
- 先に `cd atelier` してからコピー
- 引用符の差
- 同じ結果になる別手順

ただし「特定コマンドを覚える」が学習目標なら、状態に加えてイベント条件を課します。

```js
goal: {
  state: { fileExists: "/atelier/b.txt" },
  evidence: { commandUsed: "cp" }
}
```

つまり正解は以下の組み合わせです。

```text
最終状態制約 + 学習目標に必要な操作証拠
```

### 現在のLinux Story Quest

現在の実装はすでに良い方向です。`stageSeed`が課題ごとの `check(ctx)` を持ち、コマンド実行結果のcontextで判定しています。[script.js](</home/shimizu/study/spartan_school/02.homework/01.week1/linux/script.js:67>)

改善点は、`ctx.name === "..."` を主条件にしすぎず、仮想FSやプロセスのpost-stateを独立したgraderに渡すことです。

## 3.3 Learn Git Branchingの状態一致

Learn Git Branchingは100%クライアントサイドで、levelが次を持ちます。

- `startTree`
- `goalTreeString`
- `solutionCommand`
- 説明・ヒント
- branch、commit、tag、HEAD、remote tree

Level Builderが生成するJSONにも、開始ツリーと目標ツリーが含まれます。[リポジトリ](https://github.com/pcottle/learnGitBranching)  
目標ツリー例では、branches、commits、各commitのparents、HEAD、originTreeまでJSON化されています。[公開level例](https://gist.github.com/wdalmut/7888444)

本質は、模範コマンド列を再現したかではなく、**現在のリポジトリ状態が目標グラフと一致するか**です。

### Git Dungeonへの適用

現在のGit Dungeonは、次のようなbooleansを中心に進行しています。

```js
firstCommit
featureCreated
navCommit
mergedFeature
conflictStarted
conflictResolved
pushed
```

また、コマンド受付には具体的文字列が多くあります。[script.js](</home/shimizu/study/spartan_school/02.homework/01.week1/git/script.js:561>)

これを次のモデルへ置き換える価値があります。

```js
repoState = {
  commits: {
    C0: { parents: [], tree: {...} },
    C1: { parents: ["C0"], tree: {...} }
  },
  refs: {
    "refs/heads/main": "C1",
    "refs/heads/feature/nav": "C2"
  },
  HEAD: { symbolic: "refs/heads/main" },
  index: {...},
  worktree: {...},
  remotes: {...},
  merge: {
    inProgress: false,
    conflicts: []
  }
}
```

課題側は制約で書きます。

```js
goal: {
  branch: "main",
  refs: {
    "feature/nav": { mergedInto: "main" }
  },
  worktree: { clean: true },
  requiredFiles: ["nav.js"]
}
```

比較時には、内部commit IDそのものではなくグラフを正規化します。

- commit IDを生成順または構造で再ラベル
- parent関係を比較
- branch/tagが指すノードを比較
- HEAD、index、worktree、conflict状態を比較
- 無関係なdangling commitを許すかは課題ごとに指定

Learn Git Branchingでも、見た目上同等でも余分なdangling commit等があると不一致になる問題が報告されています。[代替解問題](https://github.com/pcottle/learnGitBranching/issues/99)  
したがってGit Dungeonでは、完全同型比較だけでなく**制約ベース比較**も持つべきです。

---

# 4. ゲーミフィケーションと進捗

## 4.1 OSS実例

| 機能 | 実装例 | 読み取れるルール |
|---|---|---|
| ストリーク | freeCodeCamp | 完了日・活動日からcurrent/longest streakを導出する。プロフィールに両方の表示項目がある。[実装文言](https://github.com/freeCodeCamp/freeCodeCamp/blob/main/client/i18n/locales/english/translations.json) |
| XP／ポイント | freeCodeCamp、CTFd | freeCodeCampは日ごとのpoints、CTFdはchallenge valueとsolveからscoreを計算 |
| バッジ | freeCodeCamp、Moodle、Oppia | 固定IDを手動保存するより、「条件を満たしたらaward eventを生成」する。Moodleにはsite/course badgeがある。[Moodle実装](https://github.com/moodle/moodle/blob/main/public/badges/index.php) |
| 実績 | Oppia、Gitゲーム | milestone条件に応じて自動付与。Oppiaでは一定数の承認済み貢献等からバッジを付与 |
| 進捗バー | Odin、Moodle、freeCodeCamp | 完了lesson/challenge数 ÷ 対象総数。ただしdeprecatedや任意課題を分母に入れるかを明文化する必要がある |
| ヒントコスト | CTFd | hint unlockをイベントとして保存し、点数消費や利用履歴と結び付ける |
| 解除 | Exercism、CTFd | concept prerequisiteまたはchallenge prerequisiteから利用可能状態を導出 |
| 最短手数 | Learn Git Branching | 正解とは分離してcommand countを記録。「クリア」と「上手なクリア」を別概念にする |

## 4.2 アカウント無し進捗

| 保存方法 | 適性 | 注意点 |
|---|---|---|
| localStorage | 小さな進捗、設定、実績、XPに最適 | origin単位、同期API、概ね10MiB、ユーザー削除・origin変更で消える |
| IndexedDB | コード、仮想FS、Notebook、実行履歴向け | schema migration、transaction、容量・eviction対応が必要 |
| URLへのエンコード | ステージ、seed、再現用コマンド列、共有level向け | 個人情報・秘密・大量データ不可。改ざん可能 |
| JSONエクスポート／インポート | 端末移行、バックアップ向け | schemaVersion、createdAt、checksum、インポート検証が必要 |
| File System Access API | 明示的な保存先をユーザーに選ばせる | ブラウザ差が大きく、主保存先にはしにくい |

JupyterLiteは静的配信でもNotebookをIndexedDBまたはlocalStorageに保存できます。[公式リポジトリ](https://github.com/jupyterlite/jupyterlite)  
Learn Git Branchingはlevel JSONやURLパラメータによる共有を持ちます。[Level Builder](https://github.com/pcottle/learnGitBranching)

ブラウザ保存は永続保証ではありません。localStorageは容量制限があり、IndexedDB等もブラウザのeviction対象になり得ます。[MDN Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## 4.3 「かけら」のlocalStorageのみ設計は通用するか

**当面ひとりで使う静的学習サイトとしては十分通用します。公開後も、アカウントを要求しない体験として価値があります。**

ただし次を追加すべきです。

```js
{
  schemaVersion: 2,
  profileId: "local-default",
  progress: {...},
  achievements: [...],
  activityDays: ["2026-08-24", "2026-08-25"],
  updatedAt: "...",
  contentVersion: "...",
  deviceId: "...optional"
}
```

最低限必要な機能:

- JSONエクスポート
- JSONインポート
- schema migration
- 「このブラウザにのみ保存」の明示
- 全削除前の確認
- 教材IDを配列順ではなく安定slug/UUIDで保存
- `contentVersion` とdeprecated教材への対応
- localStorage破損時の部分復旧
- 日付は表示用ローカル日と保存用timestampを分ける

将来アカウント同期を追加する場合も、local-firstを捨てる必要はありません。

```text
local event log
    ↓ optional sync
server account
```

`completed: true` の上書きだけでなく、`exercise.completed`、`hint.used`、`attempt.failed`、`achievement.awarded` のようなイベントを保存すると、ストリークや統計を後から再計算できます。

---

# 5. 抽出される「学習サイトの構成要素」

既存OSSから抽出できる最小ドメインモデルは次です。

```text
Curriculum
 ├── Track / Path
 │    ├── Concept
 │    ├── Module / Chapter
 │    └── Exercise
 │         ├── Narrative / Instructions
 │         ├── Prerequisites
 │         ├── InitialState
 │         ├── Generator(seed)
 │         ├── AllowedActions
 │         ├── GoalConstraints
 │         ├── Tests / Grader
 │         ├── Hints
 │         ├── Exemplar
 │         └── Rewards
 └── LearnerProgress
      ├── Attempt
      ├── Submission
      ├── TestResult
      ├── Completion
      ├── ActivityDay
      ├── Achievement
      └── ExportVersion
```

重要な処理ルールは以下です。

- 教材定義とゲームエンジンを分離する
- `stage index` ではなく安定IDで進捗を保存する
- 入力、実行、判定を分離する
- 正解は可能な限りpost-stateで判定する
- 特定操作を学ばせる場合だけevent evidenceを要求する
- completion、score、XP、achievementを別概念にする
- ヒント閲覧は失敗ではなくイベントとして扱う
- 教材追加時に既存進捗の分母が突然変わる問題へ対応する
- 模範解答が必ずテストを通ることをCIで確認する
- 課題の作者向け設計意図を学習者向け本文と分離する

---

# 6. Linux Story Quest / Git Dungeonの載せ替え判断

| 分類 | 対象OSS・モデル | Linux Story Quest | Git Dungeon | 判断 |
|---|---|---|---|---|
| (a) そのまま採用できるOSS | CodeMirror 6 | 長いスクリプト編集を追加する場合のみ採用。現在の一行コマンド入力には通常の`input`で十分 | commit messageや設定ファイル編集を導入する場合に採用 | 小型・素のJS向き。IME合成中はsubmitや自動判定を抑止する |
| (a) そのまま採用できるOSS | JupyterLite | Python/Linux解説Notebookを別教材として置く場合 | Git分析Notebookを置く場合 | ゲームランタイムの置換ではなく、実験室ページ用 |
| (a) そのまま採用できるOSS | Learn Git Branching fork／level JSON | 不要 | commit graph教材部分をforkまたはlevel形式で追加可能 | Git DungeonのRPGマップを残したいなら全面forkより判定モデル移植がよい |
| (b) データ構造だけ借りる | Exercism | concept、practice、prerequisite、test、exemplarを採用 | 同左 | **第一推奨** |
| (b) データ構造だけ借りる | PrairieLearn | seed付き仮想FS、可変ファイル名、`generate/grade` | 可変branch名・開始graph生成 | 丸暗記防止に有効 |
| (b) データ構造だけ借りる | CTFd | challenge、hint、attempt、solve、score、unlock | quest、hint、attempt、solve、score、unlock | ゲーム進行層として借りる。flag文字列判定は借りない |
| (b) データ構造だけ借りる | Learn Git Branching | 状態一致という原則のみ | `startTree / goalConstraints / solutionCommands` | Gitの正解判定の中心にする |
| (b) データ構造だけ借りる | freeCodeCamp | Markdown challenge、テスト一覧、完了challenge ID | 同左 | 教材ファイルとUIの分離に有効 |
| (b) データ構造だけ借りる | Runestone / PreTeXt | statement、hint、answer、solution、interactive activity | 同左 | 記事内へ小演習を埋めるモデルとして有効 |
| (b) データ構造だけ借りる | OPL / WeBWorK | seed、variant、answer evaluator | seed、variant、graph evaluator | 問題バンク思想だけ借りる |
| (c) 自作継続 | 仮想Linux実行系 | 現在の仮想FS、process、network、command parserを継続 | — | PyodideやJudge0では目的に合わない |
| (c) 自作継続 | Git状態エンジン | — | commit、refs、HEAD、index、worktree、conflictの小型モデルを自作 | 本物のGitを動かすより学習目標を制御しやすい |
| (c) 自作継続 | RPG表現 | 街、物語、NPC、演出 | マップ、敵、門、鍛冶場 | OSS教育基盤では得られない固有価値 |
| (c) 自作継続 | local-first進捗 | localStorage＋export | localStorage＋export | 当面の利用規模に最適。サーバー導入を急ぐ理由はない |

## 推奨する最終構成

```text
content/
  tracks/
    linux/
      config.json
      concepts/
      exercises/
        concept/
        practice/
    git/
      config.json
      concepts/
      exercises/

runtime/
  core/
    parser-result.js
    grader.js
    progress.js
    achievements.js
  linux/
    filesystem.js
    processes.js
    commands.js
  git/
    commits.js
    refs.js
    index.js
    graph-normalizer.js

site/
  articles/
  lessons/
  works/
  games/
```

短期的には次の順が合理的です。

1. ステージ定義を巨大な`script.js`からJSON/JSデータへ分離する。
2. Linuxの `check(ctx)` を `goalConstraints(state, events)` に一般化する。
3. Gitのboolean進行をcommit graph＋refsモデルへ移す。
4. Exercism型のconcept/prerequisite/practiceを追加する。
5. localStorageに`schemaVersion`を付け、export/importを追加する。
6. 教材定義ごとにexemplarを実行するCIテストを置く。
7. 公開利用者や端末同期が本当に必要になった時点で初めてサーバー進捗を検討する。

この構成なら、現在のゲーム性と静的ホスティングの安さを失わず、世界のOSSが持つ「教材をコードとして保守する仕組み」「正解判定の独立性」「概念と前提関係」を取り込めます。