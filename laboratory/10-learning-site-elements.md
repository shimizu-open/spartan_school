# 10.〈本題〉学習サイトに必要な要素 — OSS から抽出したドメインモデル

> **この章の目的**
> 「Moodle を使え」と勧める章ではない。世界中の学習プラットフォームが
> **何を第一級の概念として扱っているか**を読み取り、
> **「学習サイトを作るとは、何を作ることなのか」を言語化する**ための章。
> OSS を採用しなくても、ここが設計図になる。

調査: codex + web search（2026-08-25）／trackA・trackB・trackD の統合

---

## 結論 — 学習サイトは「2つのモデル」でできている

既存 OSS を横断すると、学習サイトのモデルは**きれいに2種類に分かれる**。

### A. 出版モデル（Starlight / Docusaurus / MkDocs / mdBook / Quarto が持つ）

```
Site
├── LearningPath / Book
│   ├── Module / Part / Section
│   │   └── Lesson / Chapter / Page
│   └── Navigation order
├── Article / TIL
├── Asset
└── Tag / Search index
```

**ルール**
- 教材には**明示された順序がある**
- 記事には日付・タグがあるが、必ずしも順序はない
- URL は公開後になるべく変更しない
- 画像・コード・ゲームは、それを使う教材から追跡できる
- **下書きと公開済みを区別する**
- 前後ナビゲーションとサイト横断検索を持つ

### B. 学習状態モデル（Frappe LMS / Runestone / CTFd / Tutor LMS が追加する）

```
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

**ルール**
- **完了条件は「閲覧」「自己申告」「クイズ合格」「ゲームクリア」で異なる**
- Attempt は何度でも作れるか、回数制限するかを決める
- **進捗と採点は別概念**
- **ゲームの内部状態とサイト全体の進捗は別ストアにする**
- 認証がなければ進捗は端末ローカル
- **認証を入れた時点で、削除・エクスポート・バックアップ・プライバシー対応が必要になる**

> ### ここが要点
> **既存の SSG（Astro / Starlight / Hugo…）は A しか提供しない。**
> 学習サイトを名乗るために自分で足すべきなのは **B だけ**。
> 逆に A を自作していたのが、これまでの `03.learning_site` だった。

---

## 1. フル機能 LMS — 設計思想を読む対象として

個人ひとりには**すべて過剰**。ただし「何を第一級概念にしているか」は極めて有用。

| 名前 | 第一級の概念（＝ここが読みどころ） | リポジトリ / ライセンス / 活動 | 個人での採否 |
|---|---|---|---|
| **Moodle** | Course / **Activity（学習者が行うもの）** / **Resource（教師が提示するもの）** / User / Grade / Completion / Competency | [moodle/moodle](https://github.com/moodle/moodle) · GPL-3.0 · **v5.2.2（2026-08-08）** | **過剰**。PHP + MariaDB/Postgres が必要。登録・権限・成績表・メッセージ・cron の大半が不要 |
| **Frappe Learning** | **Course → Chapter → Lesson の3層** ＋ Learner / Enrollment / Batch / Quiz / Assignment / Programming exercise / Completion | [frappe/lms](https://github.com/frappe/lms) · AGPL-3.0 · 2026-07 も継続リリース | **最も完成した LMS 候補だが重い**。Frappe Bench・DB・バックアップ・更新が必要。外部ゲームの汎用 iframe ブロックは確認できず |
| **Open edX / Canvas / Sakai / ILIAS / Chamilo / OpenOLAT** | Course / Module / Unit / Enrollment / Cohort / Grade / Certificate | 各リポジトリ参照 | **すべて過剰**。組織向け |
| **CourseLit** | Course / Lesson / Student / **Product / Payment / Sales page** | [codelitdev/courselit](https://github.com/codelitdev/courselit) · AGPL-3.0 | 販売しない段階では不要なドメインが多い |
| **Runestone Academy** | Book / Course / Section / **Assignment / Question / Attempt** / Student / Instructor / Analytics | [RunestoneInteractive/rs](https://github.com/RunestoneInteractive/rs) · MIT（同梱教材に例外あり） | **公式自身が本番運用を「substantially more complex」と明記**。個人には重すぎる |
| **Tutor LMS / LearnPress** | WordPress 上の Course / Topic / Lesson / Quiz / Enrollment / Order | [themeum/tutor](https://github.com/themeum/tutor) · GPL-3.0 · **v4.0.7（2026-08-20）** | WordPress + PHP + DB の保守が増える。Pro 限定機能も多い |
| **CTFd** ★ | **Challenge / Category / Flag / Hint / Submission / Solve / Score / Prerequisites / Competition window** | [CTFd/CTFd](https://github.com/CTFd/CTFd) · Apache-2.0 · **v3.8.6（2026-06-16）** | **唯一、条件付きで有力**。Docker Compose で開始可。学習ゲームを「解いたらフラグ」形式にするなら合う。ただし記事・授業ノート・作品集の母艦にはならない |

### Moodle から借りる唯一の概念

> **Activity（学習者が行うもの）と Resource（教師が提示するもの）を分離する**

これは個人サイトでも効く。**「読む」ものと「やる」ものを別種として扱う**という発想の出所。

---

## 2. 教育の標準規格 — 「ルール・処理」の宝庫

| 規格 | 何を標準化しているか | 個人サイトで採る価値 |
|---|---|---|
| **xAPI (Tin Can)** | 学習イベントを **`actor` / `verb` / `object`** ＋ Result / Context / Timestamp で表現 | ★**大いにある**。後述 |
| **SCORM (1.2 / 2004)** | コンテンツのパッケージ化と LMS との進捗通信 | 低。LMS へ納品しないなら不要 |
| **cmi5** | xAPI のプロファイル（起動・セッション・完了の約束事） | 低 |
| **LTI 1.3** | LMS を Platform、外部ツールを Tool として `Context / User / Role / Resource link / Launch / Result` を交換 | **今は不要**。OIDC + JWT + OAuth2 + HTTPS が必要。→ 13章 |
| **QTI** | 問題・テストの記述形式 | 低。選択式問題を大量に作るなら再検討 |
| **H5P** | Content type / Library / Content instance / Attempt result | **既存ゲームを .h5p に詰める仕組みではない**。ラッパー開発が必要でコスト超過 |
| **Open Badges** | 修了証・バッジの検証可能な表現 | 将来、公開して他者に配るなら |
| **Caliper Analytics** | 学習分析イベント | 低 |

### xAPI だけは借りる価値がある

**xAPI 互換 LRS を作るのは過剰。だが `actor / verb / object` のイベントモデルをローカルに持つのは現実的。**

利点は、**ゲーム・記事・SRS・かけら が同じ形式で連携できる**こと。

採用する動詞はこれだけに絞る:

```
opened / started / completed / attempted / passed / failed / reviewed / bookmarked / session-completed
```

```json
{
  "actor": "local:8f86c44d",
  "verb": "completed",
  "object": "unit:web.dns.authoritative-server",
  "result": { "durationSeconds": 1080 },
  "context": { "course": "web-foundations", "contentVersion": 1 },
  "timestamp": "2026-08-23T08:18:00.000Z"
}
```

LRS API・IRI 語彙・OAuth・完全な xAPI 検証までは実装しない。**「xAPI-inspired」と明記する。**

> **イベントで持つことの本当の利点**
> `completed: true` を上書き保存するのではなくイベントを貯めると、
> **ストリークも統計も進捗率も、あとから再計算できる**。
> 集計方法を変えたくなったときに過去データを失わない。

---

## 3. 演習をコードとして管理する OSS — 構造そのものが設計図

ここが**このリポジトリに一番効く**領域。学習ゲームを自作している人が読むべき設計。

| OSS | 演習を何で表現するか | 正解判定 | 進捗の保存先 |
|---|---|---|---|
| **Exercism** ★ | track の `config.json`、`concepts/<slug>`、`exercises/concept/<slug>`、`exercises/practice/<slug>`。各演習が `.docs` / `.meta` / テスト / stub / exemplar を持つ | 学習者コードを言語別テストランナーへ渡す | Web 側の DB。**track repo 自身は進捗を持たない** |
| **freeCodeCamp** | `superBlock → chapter → module → block → challenge`。challenge は frontmatter 付き Markdown | Markdown 内の `--tests--` から生成したテストを実行 | アカウントの `completedChallenges` |
| **The Odin Project** | `path → course → section → lesson/project` | **多くは自動採点なし**。自己確認、外部 exercise repo のテスト、成果物 | ログインユーザーが手動完了 |
| **Runestone** | PreTeXt の `<exercise>` / `<statement>` / `<hint>` / `<answer>` / `<solution>` / ActiveCode / Parsons | 選択肢・並べ替え・数値・Unit Test・IO Test | 静的 HTML では保存しない |
| **PrairieLearn** ★ | `info.json` / `question.html` / **秘密の `server.py`** / `tests/` | `server.py` の **`generate` / `prepare` / `parse` / `grade` / `test`** | PostgreSQL |
| **WeBWorK / OPL** | `.pg` ファイル。Subject/Chapter/Section 階層 ＋ **問題 seed** | PG の answer evaluator（数値誤差・数式同値） | サーバー DB |
| **CTFd** ★ | Challenge が第一級。category / description / files / flags / hints / **prerequisites** / value | static/regex flag、複数 flag の any/all、plugin 判定 | User/Team、Submission、Solve、Hint unlock |

### Exercism の `config.json` が示す設計 — 最重要

```json
{
  "slug": "linux-quest",
  "concepts": [
    { "uuid": "...", "slug": "filesystem-navigation", "name": "ファイルシステム移動" }
  ],
  "exercises": {
    "concept": [
      { "slug": "find-the-workshop", "name": "工房を探せ",
        "concepts": ["filesystem-navigation"],
        "prerequisites": ["shell-basics"], "status": "active" }
    ],
    "practice": [
      { "slug": "lost-archive", "name": "失われた書庫",
        "practices": ["filesystem-navigation", "file-search"],
        "prerequisites": ["filesystem-navigation"], "difficulty": 3 }
    ]
  }
}
```

**読み取れる設計思想:**

- **`concepts` は画面ページではなく、習得対象そのもの**
- **`concept exercise`（新概念を教える）と `practice exercise`（複数概念を再利用して復習する）を分離する**
- `prerequisites` が解除条件になる
- 配列の順が推奨学習順
- **`wip / beta / active / deprecated` で教材のライフサイクルを管理する**
- `.meta/design.md` に**学習目標・対象外・設計理由**を残す（学習者向け本文とは別ファイル）
- **exemplar は表示用の「答え」ではなく、テストと課題仕様の整合性を保証する実行可能資料**

> これは、いまの「ステージ番号」を
> **画面上の番号から「概念・前提・演習の関係」へ昇格させる**モデル。

### PrairieLearn から借りる思想 — variant 生成

問題を固定文章ではなく**関数**として持つ:

```python
def generate(data):  # 今回の問題パラメータと正解を生成
def parse(data):     # 学習者入力を構造化
def grade(data):     # 正解との比較、部分点、フィードバック
```

**1個の課題定義から多数の variant を生成する。**

- Linux: 初期ディレクトリ名・対象ファイル名・検索語を seed から変更
- Git: ブランチ名・分岐位置・必要な最終グラフを変更
- **同じ「概念」でも丸暗記では突破できない**
- seed を進捗に保存すれば再現可能

---

## 4. 抽出された「学習サイトの構成要素」一覧

上記すべてを統合した要素の一覧と、**個人ひとりの静的サイトでの必要度**。

| 要素 | 個人での必要度 | 備考 |
|---|---|---|
| **コンテンツ構造**（コース/章/節、順序） | **必須** | Starlight の sidebar が提供 |
| **前提関係（prerequisites）** | **必須** | ただし強制ロックではなく警告に |
| **コンテンツ種別（読む/やる/作る）** | **必須** | Moodle の Activity/Resource 分離に由来 |
| **完了条件（種別ごとに異なる）** | **必須** | 記事＝手動、演習＝イベント、成果物＝チェックリスト |
| **安定 ID** | **必須** | 並べ替えで進捗が消えないため |
| **下書き / 公開の区別** | **必須** | `status: draft \| published \| archived` |
| **学習イベントログ** | **必須** | xAPI 風。あとから再計算できる |
| **進捗（完了状態、最終位置）** | **必須** | IndexedDB |
| **エクスポート / インポート** | **必須** | ブラウザ保存は永続保証がない |
| 想定時間（estimatedMinutes） | あると良い | 「今日やること」の生成に使う |
| 難易度 | あると良い | |
| 復習カード（SRS） | あると良い | `ts-fsrs`。→ 12章 |
| しおり（bookmark） | あると良い | |
| チェックリスト | あると良い | 成果物の完了判定に |
| 用語集（glossary） | あると良い | |
| ヒント（と閲覧イベント） | あると良い | **ヒント閲覧は失敗ではなくイベント** |
| variant 生成（seed） | あると良い | 丸暗記防止 |
| バッジ / 実績 | あると良い | 「条件を満たしたら award イベントを生成」 |
| ストリーク | **注意** | → 12章。かけらの設計思想と衝突しうる |
| 進捗バー | あると良い | **deprecated や任意課題を分母に入れるか明文化が必要** |
| **受講登録（Enrollment）** | **不要** | 学習者がひとり |
| **ユーザー / 認証** | **不要** | 入れた瞬間に削除・エクスポート・プライバシー対応が発生 |
| **採点台帳 / 成績** | **不要** | |
| **修了証 / 決済** | **不要** | |
| **コホート / 教師ロール** | **不要** | |
| **提出期限** | **不要** | |

---

## 5. 個人ひとりの最小ドメインモデル

3トラックが独立に提案したモデルは、ほぼ一致した。統合すると:

```
Course
└── Chapter
    └── Unit                       ← 記事も演習も成果物も、すべて Unit
        ├── kind: article          読む
        ├── kind: exercise         試す・判定する
        └── kind: project          作る・公開する

  共通して持つもの:
    id（不変） / order / prerequisites / estimatedMinutes
    difficulty / outcomes / completion / status / contentVersion

LearnerState                       ← ここが既存 SSG に無い部分
├── UnitProgress    完了状態、最終アクセス、試行回数
├── ReviewCard      SRS（due, stability, difficulty, reps, lapses）
├── Bookmark        unitId + headingId + メモ
├── ChecklistState  成果物の完了項目
└── LearningEvent   actor / verb / object / result / context / timestamp
```

演習を細かく作り込むなら、Exercism 由来の内訳を Unit に足す:

```
Exercise
├── Narrative / Instructions   学習者向け本文
├── Prerequisites              解除条件
├── InitialState               開始状態
├── Generator(seed)            variant 生成
├── AllowedActions             許可する操作
├── GoalConstraints            ★ 正解＝到達すべき状態
├── Tests / Grader             判定器
├── Hints                      段階的ヒント
├── Exemplar                   模範解答（CIでテストを通ることを確認）
└── Rewards                    XP・バッジ
```

### 処理ルール（＝実装時に守ること）

- **教材定義とゲームエンジンを分離する**
- **`stage index` ではなく安定 ID で進捗を保存する**
- **入力・実行・判定を分離する**
- **正解は可能な限り post-state（実行後の状態）で判定する** → 11章
- 特定操作を学ばせる場合だけ event evidence を要求する
- **completion / score / XP / achievement を別概念にする**
- **ヒント閲覧は失敗ではなくイベントとして扱う**
- 教材追加時に既存進捗の分母が突然変わる問題へ対応する
- **模範解答が必ずテストを通ることを CI で確認する**
- 課題の作者向け設計意図を学習者向け本文と分離する
- `order`（表示順）と `prerequisites`（学習可能性）を混同しない
- **Markdown 本文に進捗状態を書かない**
- `contentVersion` を上げても完了を取り消さず「更新あり」と表示する

---

## この章の使い方

- **何を作るかの設計図** → 5節の最小ドメインモデル
- **具体的な frontmatter とディレクトリ** → [12-architecture.md](12-architecture.md)
- **演習の判定をどう実装するか** → [11-exercise-and-grading.md](11-exercise-and-grading.md)
- **既製品を使うか自分で組むか** → [13-ready-made-oss.md](13-ready-made-oss.md)
- **いまある資産をどこに置くか** → [14-mapping.md](14-mapping.md)
