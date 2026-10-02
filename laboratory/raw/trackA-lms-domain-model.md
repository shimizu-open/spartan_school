# 第3ラウンド トラックA  
## 学習プラットフォームOSSの全体像と、そこから読み取れるドメインモデル

調査日: 2026-08-25

## 0. 結論

第一推奨は、**当面フル機能LMSを導入せず、現在の静的サイトに「コース構造・完了条件・学習状態・学習イベント」の小さなドメインモデルを加えること**である。

具体的には次の構成を推奨する。

- 教材定義: Markdown/YAML frontmatter
- コース構造: `course.yaml`
- 進捗: `localStorage`上の学習者状態
- 履歴: xAPIの `actor–verb–object` を簡略化したイベントログ
- インタラクティブ教材: 必要な箇所だけ H5P Standalone
- 既存ゲーム: `activity.type: game` としてそのまま組み込む
- 記事・授業メモ: `reading` / `lesson`
- 習慣アプリ: 独立した `practice` アクティビティ
- 成果物展示: `evidence` として学習項目に関連付ける

Moodleなどから持ち帰るべき中心概念は、管理画面や権限機構ではない。

> 「何を学ぶか」「どの順で学ぶか」「何をしたら完了か」「今どこまで進んだか」「何を達成したか」

この5点である。

フルLMSが必要になった場合の第一候補は **Frappe Learning**。10製品中では、`Course → Chapter → Lesson` が明快で、Moodle等より設計思想を個人サイトへ移植しやすい。ただしFrappe Framework、DB、バックアップ、更新運用が必要で、現在のS3静的配信より明確に重い。

---

# 1. フル機能LMS

## 1.1 Moodle

- **一行説明**: 教材、受講管理、評価、協働、能力管理まで包含する最も成熟した汎用LMS。
- **リポジトリ**: [moodle/moodle](https://github.com/moodle/moodle)
- **ライセンス**: GPL-3.0
- **活動状況**: 非常に活発。Moodle 5.2.2が2026-08-08公開。週次安定版も提供されている。[公式ダウンロード](https://download.moodle.org/releases/latest/)
- **規模感**: PHP＋DB＋Webサーバー。単独運用は可能だが、更新、バックアップ、プラグイン互換性、セキュリティ対応が継続的に必要。
- **採用コスト**: 高
- **注意点・不採用理由**: 一人用静的サイトには、認証、ロール、コホート、成績簿、通知、プラグイン管理の大部分が過剰。

### 第一級の概念

- サイト / カテゴリ / コース
- セクション
- アクティビティ / リソース
- ユーザー / ロール / 権限
- 受講登録
- グループ / グルーピング / コホート
- 課題 / 提出 / フィードバック
- 小テスト / 問題 / 問題バンク / 試行
- 評定項目 / 成績簿 / 尺度 / ルーブリック
- 活動完了 / コース完了 / 完了条件
- コンピテンシー / コンピテンシーフレームワーク / 学習計画
- バッジ
- フォーラム、メッセージ、カレンダー、ログ

Moodleは、閲覧、提出、投稿、得点などを完了条件として扱い、それをコース完了へ集約する。成績、コンピテンシー、学習計画、バッジまで別々の概念として持つ。[Moodle機能一覧](https://docs.moodle.org/501/en/Table_of_Contents)、[進捗追跡](https://docs.moodle.org/34/en/Tracking_progress)

**個人でも要るもの**: コース、節、活動、完了条件、進捗、簡単な評価。  
**過剰なもの**: ロール階層、コホート、組織的成績簿、評定ワークフロー、組織横断コンピテンシー管理。

---

## 1.2 Canvas LMS

- **一行説明**: モジュール、課題、成績簿、外部ツール連携を中心とする高等教育・組織向けLMS。
- **リポジトリ**: [instructure/canvas-lms](https://github.com/instructure/canvas-lms)
- **ライセンス**: AGPL-3.0
- **活動状況**: 活発。GitHub Releases中心ではなく継続デプロイ型で、公式リポジトリと本番構築文書は2026年にも更新されている。
- **規模感**: Ruby、PostgreSQL、Redis等を伴う大規模Webアプリ。
- **採用コスト**: 非常に高い
- **注意点・不採用理由**: 大学・学校の情報システムを前提とした構成。一人で動かす対象としては不釣り合い。

### 第一級の概念

- Account / Sub-account
- Course / Section
- Enrollment / Role / User
- Module / Module Item
- Page / File / External URL / External Tool
- Assignment / Assignment Group
- Submission / Attempt
- Quiz / Question / Item Bank
- Gradebook / Score / Grading Scheme
- Rubric
- Outcome / Outcome Group / Mastery
- Module Requirement / Prerequisite
- Mastery Path
- Discussion / Group / Calendar
- Badge / Credential

Canvasの特徴は、教材を単なるページではなく、**Module Itemに完了要件を付けた学習列**として扱う点にある。Mastery Pathsでは、前の課題の得点範囲に応じて次の教材を分岐できる。[Mastery Paths](https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-use-Mastery-Paths-in-course-modules/ta-p/906)

**個人でも要るもの**: モジュール、順序、完了条件、前提関係。  
**過剰なもの**: Account階層、Section、SIS連携、差別化配信、複数教員の採点。

---

## 1.3 Open edX

- **一行説明**: MOOCの制作・配信・大規模受講・証明書発行に強いプラットフォーム。
- **リポジトリ**: [openedx/openedx-platform](https://github.com/openedx/openedx-platform)
- **ライセンス**: AGPL-3.0
- **活動状況**: 活発。Verawood.1が2026-07-30公開。原則として最新リリースだけがサポート対象。[リリース情報](https://docs.openedx.org/en/latest/community/release_notes/named_release_branches_and_tags.html)
- **規模感**: Djangoモノリス、複数サービス、React MFE、検索・非同期処理などを含む。
- **採用コスト**: 非常に高い
- **注意点・不採用理由**: 公式リポジトリ自身が本番インストールを簡単ではないと説明している。個人サイトでは保守が主作業になり得る。

### 第一級の概念

- Organization / Course / Course Run
- Section / Subsection / Unit
- XBlock / Component
- Text / Video / Problem / Discussion
- Enrollment / Cohort / Team
- Problem / Response / Attempt
- Grading Policy / Grade Range
- Assignment Type
- Content Library / Reusable Component
- Release Date / Due Date
- Prerequisite Course / Prerequisite Subsection
- Progress
- Certificate
- Program / Pathway
- Taxonomy / Tag

基本構造は `Course → Section → Subsection → Unit → Component`。最小部品であるXBlockを合成して、問題、動画、実験、協働活動からコース全体まで作る思想を持つ。[コース制作ガイド](https://docs.openedx.org/en/latest/educators/navigation/creating_course.html)、[XBlock概要](https://docs.openedx.org/_/downloads/xblock/en/open-release-redwood.master/pdf/)

**個人でも要るもの**: 階層、再利用可能な活動、公開順、前提条件。  
**過剰なもの**: Course Run、組織、MOOC運営、コホート、証明書運用、マイクロサービス。

---

## 1.4 Sakai

- **一行説明**: 大学の授業・研究・共同作業用サイトを統合するコミュニティ型LMS。
- **リポジトリ**: [sakaiproject/sakai](https://github.com/sakaiproject/sakai)
- **ライセンス**: Educational Community License 2.0
- **活動状況**: 活発。25.2がコミュニティサポート対象として案内されている。
- **規模感**: Java/Tomcatを中心とする大規模システム。
- **採用コスト**: 非常に高い
- **注意点・不採用理由**: 大学の授業サイト、プロジェクトサイト、名簿、グループ、複数教員運営を前提とする。

### 第一級の概念

- Site（Course Site / Project Site）
- Membership / Role / Permission
- Section / Group / Roster
- Lesson / Page / Content Item
- Resource
- Assignment / Submission
- Assessment / Part / Question / Question Pool
- Gradebook / Gradebook Item / Course Grade
- Rubric
- Announcement / Forum / Conversation / Message
- Calendar
- LTI Tool
- SCORM Content
- Site Statistics / Event

Sakaiではコースだけでなく、研究・共同作業用の「Site」自体が中心概念である。Sakai 25ではAssignments、Tests & Quizzes、Gradebook、Rubrics、Groups、SCORM、LTIが統合されている。[Sakai 25リリースノート](https://sakaiproject.atlassian.net/wiki/spaces/DOC/pages/33232420865)

**個人でも要るもの**: Lesson、Resource、Assignment、簡単な履歴。  
**過剰なもの**: Project Site、Membership、大学組織、複数Gradebook、協働ツール群。

---

## 1.5 ILIAS

- **一行説明**: 学習資源リポジトリを基盤に、コース、テスト、能力、ポートフォリオを組み立てるLMS。
- **リポジトリ**: [ILIAS-eLearning/ILIAS](https://github.com/ILIAS-eLearning/ILIAS)
- **ライセンス**: GPL-3.0
- **活動状況**: 活発。11.2が2026-07-07公開。[公式リリース](https://github.com/ILIAS-eLearning/ILIAS/releases)
- **規模感**: PHP、DB、Composer、Nodeビルドを伴う組織向けシステム。
- **採用コスト**: 高
- **注意点・不採用理由**: 学習資源リポジトリ、権限、組織、プラグイン、アップグレード手順が重い。

### 第一級の概念

- Repository Object
- Category / Folder
- Course / Group
- Learning Module / Page
- File / Web Resource / SCORM
- Exercise / Assignment / Submission
- Test / Question / Question Pool
- Test Pass / Score
- Learning Progress
- Objective
- Competence / Competence Profile
- Study Programme / Learning Sequence
- Badge / Certificate
- Portfolio
- User / Role / Permission

ILIASは「コースの中に教材がある」だけでなく、**すべての学習資源をリポジトリ上の再利用可能オブジェクトとして扱う**色が強い。

**個人でも要るもの**: 教材の再利用、問題バンク、学習目標。  
**過剰なもの**: 汎用リポジトリ権限、組織的能力プロファイル、Study Programme。

---

## 1.6 Chamilo

- **一行説明**: 比較的導入しやすいPHP系LMSで、学習経路とコース運営を重視。
- **リポジトリ**: [chamilo/chamilo-lms](https://github.com/chamilo/chamilo-lms)
- **ライセンス**: GPL-3.0-or-later
- **活動状況**: 活発。2.0系が2026年に公開されているが、大規模な既存環境の移行には2.1を待つようリリース説明に注意書きがある。[リリース](https://github.com/chamilo/chamilo-lms/releases)
- **規模感**: PHP＋DB。フルLMS中では比較的軽いが、静的ホスティングでは動かない。
- **採用コスト**: 中～高
- **注意点・不採用理由**: 2.0移行期。個人サイトにはセッション、組織、受講管理が過剰。

### 第一級の概念

- Course
- Session
- User / Teacher / Learner
- Group / Class
- Learning Path
- Step / Learning Object
- Document / Link / Media
- Exercise / Question / Attempt
- Assignment / Submission
- Assessment / Gradebook
- Skill
- Certificate
- Attendance
- Announcement / Forum / Calendar

ChamiloではLearning Pathが明示的な第一級概念であり、教材、テスト、議論などを順序付きの教育的行程として構成する。[Learning Path](https://docs.chamilo.org/teacher-guide/structure_learning_paths/introduction)

**個人でも要るもの**: 学習経路、ステップ、順序、完了。  
**過剰なもの**: Session、Class、Attendance、組織的証明書発行。

---

## 1.7 OpenOLAT

- **一行説明**: コース要素と学習経路ルールを細かく組み合わせられるJava系LMS。
- **リポジトリ**: [OpenOLAT/OpenOLAT](https://github.com/OpenOLAT/OpenOLAT)
- **ライセンス**: Apache-2.0
- **活動状況**: 活発。公式文書はOpenOlat 21.0を案内し、リポジトリも2026年8月に更新。[公式文書](https://docs.openolat.org/)
- **規模感**: Java、DB、検索等を含む大規模アプリ。
- **採用コスト**: 非常に高い
- **注意点・不採用理由**: Course Element、評価、組織運営の柔軟性は高いが、その柔軟性自体が個人用途には過剰。

### 第一級の概念

- Learning Resource
- Course / Curriculum
- Course Element
- Structure / Page / Document / Video
- Learning Path
- Mandatory / Optional / Excluded
- Completion Criterion
- Release Date / Deadline / Expected Time
- Enrollment / Group / Organization
- Task / Group Task / Submission / Revision
- Test / Self-test / Practice
- Question Pool / QTI Item
- Score / Passed / Assessment
- Rubric
- Evidence of Achievement
- Credit / Certificate / Badge
- Reminder / To-do

OpenOLATは、完了条件を「閲覧」「自己確認」「得点」「合格」「テスト終了」「動画95%視聴」などとして明示的にモデル化している。[Course Element一覧](https://docs.openolat.org/en/manual_user/learningresources/Course_Elements/)、[Learning Path完了条件](https://docs.openolat.org/manual_user/learningresources/Learning_path_course_Course_editor/)

**個人でも要るもの**: 必須/任意、完了条件、期限、想定時間。  
**過剰なもの**: Curriculum、Credit、組織、コーチ、複雑な提出・再提出ワークフロー。

---

## 1.8 Frappe Learning

- **一行説明**: 明快な3階層構造を中心にした、比較的新しいOSS LMS。
- **リポジトリ**: [frappe/lms](https://github.com/frappe/lms)
- **ライセンス**: AGPL-3.0
- **活動状況**: 非常に活発。2026年6月に2.57.0系のリリースが確認できる。[リリース](https://github.com/frappe/lms/releases)
- **規模感**: Moodle等より理解しやすいが、Frappe Framework、Python、Node、DB、Bench運用が必要。
- **採用コスト**: 中～高
- **注意点・不採用理由**: 静的サイトの延長ではなく、サーバーアプリへの移行になる。

### 第一級の概念

- Course
- Chapter
- Lesson
- Lesson Block
- SCORM Chapter
- Quiz / Question / Option / Attempt
- Assignment / Submission
- Batch
- Member / Instructor / Evaluator
- Enrollment
- Progress
- Certificate
- Discussion
- Category / Tag
- Job / Learning Path相当のまとまり

構造は明快な `Course → Chapter → Lesson`。Lesson内にテキスト、動画、クイズ、課題などを混在できる。[Chapter](https://docs.frappe.io/learning/add-a-chapter)、[Lesson](https://docs.frappe.io/learning/course-creation/adding-a-lesson/adding-simple-content)

**個人でも要るもの**: 3階層、クイズ、課題、進捗、タグ。  
**過剰なもの**: Batch、Evaluator、会員管理、DB運用。

---

## 1.9 Tutor LMS

- **一行説明**: WordPressをコース販売・受講サイトに変える高機能LMSプラグイン。
- **リポジトリ**: [themeum/tutor](https://github.com/themeum/tutor)
- **ライセンス**: リポジトリはGPL-3.0。プラグインヘッダーにはGPL-2.0-or-later表記もあり、配布形態ごとの確認が必要。
- **活動状況**: 非常に活発。WordPress.orgでは4.0.7が2026-08-20公開。[WordPress.org](https://wordpress.org/plugins/tutor/)
- **規模感**: WordPressを既に運用していれば一人でも可能。現在のS3構成からは大きな移行。
- **採用コスト**: 中
- **注意点・不採用理由**: 前提条件、Content Drip、課題、証明書、Gradebookなど重要機能の多くがProアドオン。

### 第一級の概念

- Course
- Topic
- Lesson
- Quiz / Question / Attempt
- Assignment / Submission
- Student / Instructor
- Enrollment
- Course Progress / Completion
- Course Prerequisite
- Content Drip Rule
- Gradebook
- Certificate
- Announcement / Q&A
- Order / Product / Coupon / Subscription

教材構造は `Course → Topic → Lesson | Quiz | Assignment`。Content Dripには、日付、登録後経過日数、逐次完了、任意の前提教材という複数の解放規則がある。[Curriculum](https://docs.themeum.com/tutor-lms/course-builder/course-creation/curriculum/)、[Content Drip](https://docs.themeum.com/tutor-lms/addons/content-drip/)

**個人でも要るもの**: Topic、Lesson、Quiz、逐次進行。  
**過剰なもの**: 講師マーケットプレイス、販売、注文、クーポン、収益分配。

---

## 1.10 Sensei LMS

- **一行説明**: WordPressの投稿・ブロック編集と自然に統合された比較的簡潔なLMS。
- **リポジトリ**: [Automattic/sensei](https://github.com/Automattic/sensei)
- **ライセンス**: GPL-2.0
- **活動状況**: 活発。4.26.3が2026-08-21公開。[WordPress.org](https://wordpress.org/plugins/sensei-lms/)
- **規模感**: WordPress運用を受け入れれば一人でも可能。
- **採用コスト**: 中
- **注意点・不採用理由**: 現在の静的配信をWordPressへ変えるほどの利益は小さい。拡張機能・有料機能との境界にも注意。

### 第一級の概念

- Course
- Module
- Lesson
- Quiz
- Question / Question Bank
- Learner
- Enrollment / Access
- Course Progress / Lesson Status
- Quiz Attempt / Grade
- Prerequisite
- Learning Mode
- Certificate
- Group / Cohort相当の機能
- Teacher / Co-teacher

構造は `Course → Module → Lesson → Quiz`。Moduleはコンテンツ本体ではなくLessonを分類する容器で、Lessonは最大1つのQuizを持ち、Questionは複数Quizで再利用できる。[Content Hierarchy](https://senseilms.com/documentation/content-hierarchy/)

**個人でも要るもの**: Course、Module、Lesson、再利用可能なQuestion。  
**過剰なもの**: Learner管理、教員、アクセス販売、WordPress運用。

---

## 1.11 LMS比較の要約

| 製品 | 個人運用 | 設計から持ち帰るべきもの | 主な過剰部分 |
|---|---:|---|---|
| Moodle | △ | 活動/コース完了、問題バンク | 権限、コホート、成績管理 |
| Canvas | × | Module Requirement、Mastery Path | 組織/SIS/差別化配信 |
| Open edX | × | 階層、再利用部品、公開順 | MOOC運営、分散構成 |
| Sakai | × | Site内の教材・課題・評価統合 | 大学・共同研究機能 |
| ILIAS | △ | 再利用可能な学習資源 | リポジトリ権限、能力管理 |
| Chamilo | △ | Learning Path | Session、出席管理 |
| OpenOLAT | × | 完了条件の形式化 | Curriculum、複雑な評価 |
| Frappe | △ | Course–Chapter–Lesson | Framework/DB運用 |
| Tutor LMS | ○ | Topic、順序、Content Drip | WordPress、販売、Pro依存 |
| Sensei | ○ | 簡潔な階層、問題再利用 | WordPress、受講者管理 |

---

# 2. 教育標準規格

## 2.1 SCORM 1.2 / SCORM 2004

### 標準化するもの

- ZIP形式の教材パッケージ
- `imsmanifest.xml`による教材構成
- LMSから教材を起動する方法
- JavaScript APIによる教材とLMSの通信
- 完了状態、成功状態、得点、学習時間
- suspend data、locationによる再開
- 2004ではSequencing and Navigation

SCORM 1.2は広く実装されているが、完了と成功の区別、データ容量、教材間の順序制御に制約がある。SCORM 2004は完了/成功を分離し、相互作用モデルとシーケンシングを強化した。[SCORM比較](https://scorm.com/scorm-explained/business-of-scorm/comparing-scorm-1-2-and-scorm-2004/)、[ADL SCORM 2004適合要件](https://www.adlnet.gov/assets/uploads/SCORM_2004_4ED_v1_1_TR_20090814.pdf)

### 個人サイトでの価値

**判定: 不要**

既存のSCORM教材を移植する場合以外は採用しない。iframe/ウィンドウ内API探索、manifest、状態変換、互換性対応が重い。

ただし設計思想として、以下は有用である。

- `not attempted / incomplete / completed`
- `unknown / failed / passed`
- scoreとcompletionを分ける
- bookmark/locationを持つ
- session timeとtotal timeを分ける

---

## 2.2 xAPI（Tin Can API）

### 標準化するもの

Web、アプリ、シミュレーション、オフライン活動などで起きた学習経験を、JSONのStatementとしてLRSへ記録・照会する方法。

Statementは最低限、次を持つ。

```text
Actor -- Verb --> Object
```

例:

```text
shimizu completed linux-story-quest-stage-3
shimizu attempted dns-quiz
shimizu viewed aws-https-article
```

公式仕様では `actor`、`verb`、`object` が必須。`result`、`context`、`timestamp`などを追加できる。[xAPI Data仕様](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md)

```json
{
  "id": "0a941f5e-31ad-4c17-b802-76d6b1689fb1",
  "actor": {
    "objectType": "Agent",
    "account": {
      "homePage": "https://example.com",
      "name": "local-user"
    }
  },
  "verb": {
    "id": "https://w3id.org/xapi/adl/verbs/completed",
    "display": {
      "ja": "完了した"
    }
  },
  "object": {
    "id": "https://example.com/activities/git-dungeon/stage-4",
    "definition": {
      "name": {
        "ja": "Git Dungeon ステージ4"
      },
      "type": "https://example.com/activity-types/game-stage"
    }
  },
  "result": {
    "success": true,
    "completion": true,
    "score": {
      "scaled": 0.9
    },
    "duration": "PT12M30S"
  },
  "context": {
    "contextActivities": {
      "parent": [
        {
          "id": "https://example.com/courses/git-basics"
        }
      ]
    }
  },
  "timestamp": "2026-08-25T10:00:00+09:00"
}
```

### Verbの設計思想

xAPIは、`completed` などの固定一覧を本体仕様で強制しない。Verbの意味は表示文字列ではなくIRIで識別される。

有用な学習イベント例:

- `viewed`: 閲覧した
- `started`: 開始した
- `progressed`: 進行した
- `completed`: 完了した
- `attempted`: 解答・挑戦した
- `answered`: 問題に答えた
- `passed`: 合格した
- `failed`: 不合格だった
- `experienced`: 教材を経験した
- `created`: 成果物を作った
- `submitted`: 提出した
- `commented`: 振り返りを書いた

重要なのは「クリックされた」ではなく、**学習上の意味を持つ出来事を記録する**こと。

### 個人サイトでの価値

**判定: 構造だけ必須、完全準拠は不要**

LRSやxAPI認証まで導入する必要はない。しかし、イベントを次の形に正規化する価値は高い。

```js
{
  actor: "local-user",
  verb: "completed",
  object: "git-dungeon/stage-4",
  result: { success: true, score: 0.9 },
  context: { course: "git-basics" },
  at: "2026-08-25T10:00:00+09:00"
}
```

これにより進捗バー、最終アクセス、所要時間、ストリーク、後日のサーバー同期を同じイベントログから派生できる。

---

## 2.3 Learning Record Store

LRSはxAPI Statementと添付ファイル、State/Profile文書を保存・検索するサーバーである。

### Learning Locker

- **リポジトリ**: [LearningLocker/learninglocker](https://github.com/learninglocker/learninglocker)
- **ライセンス**: GPL-3.0
- **活動状況**: 最新GitHub Releaseは7.1.1、2021-11-16。現在の新規採用候補としては活動停滞を考慮すべき。
- **採用判断**: 不要

### Yet Analytics SQL LRS

- **リポジトリ**: [yetanalytics/lrsql](https://github.com/yetanalytics/lrsql)
- **ライセンス**: Apache-2.0
- **活動状況**: 活発。0.9.7が2026-08-11公開。
- **特徴**: SQLite、PostgreSQL、MariaDB、MySQL対応。[公式README](https://github.com/yetanalytics/lrsql)
- **採用判断**: 将来複数端末・公開ユーザーの分析が必要になった時の第一候補。現時点では過剰。

### TRAX LRS

- **関連リポジトリ**: [trax-project/trax3-core](https://github.com/trax-project/trax3-core)
- **ライセンス**: Starter/CoreはGPL-3.0-or-later系、Extended Editionは別ライセンス。
- **活動状況**: 3.1系が2025年末に公開され、2026年にも更新が確認できる。
- **特徴**: Laravelベース。xAPI 1.0.3/2.0、cmi5、外部ストア連携を掲げる。[TRAX文書](https://docs.traxlrs.com/)
- **採用判断**: 現時点では不要。ライセンス版の区別に注意。

---

## 2.4 cmi5

### 標準化するもの

xAPIだけでは規定しない「LMSが教材をどう起動し、どのStatementを要求し、いつ修了とするか」を定義するxAPIプロファイル。

第一級の概念:

- Course
- Block
- Assignable Unit（AU）
- Registration
- Launch
- Session
- Attempt
- Move On条件
- Satisfied / Completed / Passed / Failed

cmi5は、SCORMの「LMSから起動されるパッケージ教材」とxAPIの柔軟なイベント記録を接続する。[cmi5概要](https://xapi.com/cmi5/cmi5-technical-101/)

### 個人サイトでの価値

**判定: 不要**

ただし次の区別は参考になる。

- 起動セッションと学習試行は同じではない
- `completed` と `passed` は別
- ある活動の合格・完了から上位コースの`satisfied`を導出する
- 順序制御をイベント記録とは別ルールとして持つ

---

## 2.5 LTI 1.3 / LTI Advantage

### 標準化するもの

LMSから外部学習ツールを安全に起動し、ユーザー、ロール、課題、名簿、成績を連携する。

- LTI Resource Link
- Platform / Tool
- Deployment
- OIDC Login / JWT Launch
- Names and Role Provisioning Service
- Assignment and Grade Services
- Deep Linking

現行の中心はOAuth 2.0、OIDC、JWTを使用するLTI 1.3。[1EdTech LTI](https://www.1edtech.org/standards/lti)

### 個人サイトでの価値

**判定: 不要**

外部教材は通常のリンクやiframeで十分。将来、学校LMSへGit Dungeon等を配布するなら、教材側をLTI Tool化する価値が生じる。

---

## 2.6 QTI

### 標準化するもの

- 問題
- 選択肢・回答
- 正解・採点規則
- フィードバック
- テスト / セクション
- 結果
- 問題バンク間の交換

QTI 3.0は2022年にFinalとなり、Web Components、アクセシビリティ、適応型テスト等を強化している。[QTI仕様](https://www.1edtech.org/standards/qti/index)

### 個人サイトでの価値

**判定: あると良いが、直接実装は不要**

内部モデルでは以下だけ抽出する。

```text
Question
- prompt
- interaction type
- choices
- correct response
- scoring rule
- feedback
- attempts
```

他LMSとの問題交換が要件になった時だけQTI入出力を追加する。

---

## 2.7 IMS Common Cartridge

### 標準化するもの

コース全体をLMS間で移動するためのZIPパッケージ。

- manifest
- コンテンツ階層
- Webコンテンツ
- QTI問題
- ディスカッション題材
- LTIリンク
- メタデータ

1EdTechではCommon Cartridge 1.3が公開され、旧1.0～1.2との互換も考慮されている。[Common Cartridge仕様](https://www.imsglobal.org/cc/index.html)

### 個人サイトでの価値

**判定: 不要**

ただし「教材本文」「構造」「評価」「外部リンク」「メタデータ」を分離してパッケージ可能にする思想は採用すべき。

---

## 2.8 Open Badges / Verifiable Credentials

### 標準化するもの

Open Badgesは次を持つ検証可能な達成記録である。

- Earner
- Issuer
- Achievement
- Criteria
- Evidence
- Issuance Date / Expiration
- Alignment
- Credential Status
- Cryptographic Proof

Open Badges 3.0はW3C Verifiable Credentials Data Model 2.0に整合し、Issuer–Holder–Verifierモデルで署名付き資格情報を交換する。[Open Badges](https://www.1edtech.org/standards/open-badges)、[W3C VC 2.0](https://www.w3.org/TR/vc-data-model/)

### 個人サイトでの価値

**判定: 現在は不要**

自分が自分へ暗号学的資格を発行しても信頼は増えない。MVPでは以下で十分。

```yaml
achievement:
  id: linux-story-complete
  title: Linux Story Quest 完了
  criteria:
    activity: linux-story-quest
    completion: completed
  evidence: /works/linux/
  earnedAt: 2026-08-25
```

将来、公開コースとして第三者に修了証を発行する時にOpen Badges 3.0を検討する。

---

## 2.9 H5P

### 標準化・提供するもの

H5Pは規格というより、再利用可能なインタラクティブ教材の実行環境、編集環境、コンテンツパッケージである。

代表的コンテンツ:

- Interactive Video
- Course Presentation
- Question Set
- Drag and Drop
- Fill in the Blanks
- Interactive Book
- Branching Scenario
- Timeline

### ライセンス

- H5P PHP core: GPL-3.0
- H5P Editor PHP library: MIT
- コンテンツタイプごとに別ライセンスの場合がある
- 教材コンテンツ自体にも作者指定ライセンスがある

[H5P PHP library](https://github.com/h5p/h5p-php-library)、[公式ライセンス説明](https://h5p.org/licensing)

### 静的サイトへ埋め込めるか

**可能。ただし公式PHP統合ではなく、H5P Standalone等を使う。**

- **リポジトリ**: [tunapanda/h5p-standalone](https://github.com/tunapanda/h5p-standalone)
- **ライセンス**: MIT
- **活動状況**: 活発。3.8.2が2026-03-24公開。
- `.h5p`を展開し、JS/CSSとコンテンツライブラリを静的配信できる。
- 状態保存、成績集約、LRS送信は別実装。
- `.h5p`ファイルに必要ライブラリが同梱されないケースに注意。[Standalone使用法](https://github.com/tunapanda/h5p-standalone)

### 個人サイトでの価値

**判定: あると良い。コンポーネントとして第一推奨**

自作する価値の低い汎用問題形式をH5Pに任せ、Linux Story QuestやGit Dungeonのような独自体験は既存コードを維持する切り分けがよい。

---

## 2.10 Caliper Analytics

### 標準化するもの

学習プラットフォームが分析用イベントを送るための語彙とイベントモデル。

- Actor
- Action
- Object
- Event
- Event Time
- Generated Entity
- Session
- Sensor API
- Profiles

Assessment、Reading、Media、Navigation、Tool Use等のプロファイルを持つ。現行公開仕様の中心はCaliper Analytics 1.2。[仕様](https://www.imsglobal.org/spec/caliper/v1p2/)

### xAPIとの違い

- xAPI: 学習経験を比較的自由なStatementとして記録
- Caliper: LMS・教育システムの分析イベントを定型プロファイルで揃える

### 個人サイトでの価値

**判定: 不要**

個人サイトにはxAPI風の単純なイベント形式の方が扱いやすい。組織横断の分析基盤が必要になった場合に再検討する。

---

# 3. 学習サイトが持ちうる構成要素

「不要」は永久に不要という意味ではなく、**一人用静的サイトのMVPには入れない**という判定である。

| 領域 | 要素 | 判定 | 理由 |
|---|---|---:|---|
| コンテンツ | コース | 必須 | 学習内容を目的単位に束ねる |
| コンテンツ | 章/モジュール | 必須 | 長い教材を理解可能な単位に分ける |
| コンテンツ | レッスン/活動 | 必須 | 閲覧・演習・ゲームを同じ抽象で扱う |
| コンテンツ | 順序 | 必須 | 次に何をすべきか示す |
| コンテンツ | 必須/任意 | あると良い | 寄り道教材を表現できる |
| コンテンツ | 複雑な分岐学習経路 | 不要 | 一人用には制作・検証負荷が高い |
| 進捗 | 未着手/進行中/完了 | 必須 | 最小の学習状態 |
| 進捗 | 最終アクセス | 必須 | 再開地点を作れる |
| 進捗 | しおり/再開位置 | あると良い | 長文・ゲームに有効 |
| 進捗 | 所要時間 | あると良い | 想定時間との比較に使える |
| 進捗 | スコア | あると良い | すべての教材には不要 |
| 進捗 | 詳細イベントログ | あると良い | 後からストリーク・分析を導出できる |
| 評価 | 自己完了 | 必須 | 読み物・外部演習に必要 |
| 評価 | 自動採点 | あると良い | クイズ・ゲームに有効 |
| 評価 | 試行回数 | あると良い | 繰り返し学習を表現 |
| 評価 | 提出物/成果物URL | あると良い | ポートフォリオと学習を接続 |
| 評価 | ルーブリック | 不要 | 当面は自己評価項目で代替可能 |
| 評価 | 教員による採点 | 不要 | 学習者が一人 |
| ルール | 完了条件 | 必須 | 「何をすれば終わりか」を明文化 |
| ルール | 前提教材 | あると良い | 順序以外の依存を表現 |
| ルール | 順次ロック | 不要 | 自学では閲覧を妨げやすい |
| ルール | 期限 | あると良い | 自分で設定する目標期限として使える |
| ルール | 公開日時 | あると良い | 「かけら」の時間ルールに有効 |
| ルール | 再試行/反復 | あると良い | ゲームやクイズ向け |
| 動機付け | 進捗バー | 必須 | 全体位置を即座に示す |
| 動機付け | ストリーク | あると良い | 習慣形成には有効だが強制しない |
| 動機付け | ローカル実績 | あると良い | ゲーム教材と相性がよい |
| 動機付け | 証明書 | 不要 | 自己発行には信頼上の意味が薄い |
| 動機付け | Open Badge/VC | 不要 | 第三者への公開コース段階で検討 |
| ナビゲーション | 目次 | 必須 | コース構造の主要ビュー |
| ナビゲーション | 前へ/次へ | 必須 | 線形学習を支援 |
| ナビゲーション | 現在位置 | 必須 | パンくずまたは章表示 |
| ナビゲーション | 検索 | あると良い | 記事・授業メモが増えるほど有効 |
| ナビゲーション | しおり | あると良い | 自由探索型サイトに有効 |
| メタ | タグ | あると良い | 横断検索・関連教材 |
| メタ | 難易度 | あると良い | 学習順の判断材料 |
| メタ | 想定時間 | あると良い | 学習開始の心理的負担を下げる |
| メタ | 学習目標 | 必須 | 完了条件とは別に「何を得るか」を示す |
| メタ | 前提知識 | あると良い | prerequisiteより柔らかい案内 |
| メタ | 更新日 | あると良い | 技術記事の鮮度判断に必要 |
| 管理 | ユーザーアカウント | 不要 | 当面一人、localStorageで足りる |
| 管理 | 受講登録 | 不要 | 公開時に追加すべき関係 |
| 管理 | ロール/権限 | 不要 | 管理者と学習者が同一 |
| 管理 | コホート/グループ | 不要 | 複数学習者向け |
| 管理 | 通知/メール | 不要 | ブラウザ内リマインダーで代替 |
| 商取引 | 商品/注文/クーポン | 不要 | 現在の目的外 |
| 相互運用 | SCORMランタイム | 不要 | 既存SCORM資産がない |
| 相互運用 | LTI | 不要 | 外部LMS連携がない |
| 相互運用 | QTI入出力 | 不要 | 問題交換が必要になってから追加 |
| 相互運用 | xAPI完全準拠 | 不要 | イベント構造だけ採用 |
| 相互運用 | H5P再生 | あると良い | 汎用インタラクションの再実装を避ける |

---

# 4. 抽出されたドメインモデル

## 4.1 中核エンティティ

```text
Course
 └─ Module
     └─ Activity

Activity
 ├─ metadata
 ├─ completion rule
 ├─ prerequisite
 └─ evidence

LearnerState
 ├─ activity states
 ├─ course progress
 └─ event log
```

重要なのは、記事、ゲーム、クイズ、習慣アプリを別々のトップレベル概念にしないこと。

すべてを `Activity` とし、`type`で違いを表す。

```text
reading | lesson | quiz | game | practice | project | external | h5p
```

これにより次の素材を一つのコースに混在できる。

- AWS記事を読む
- DNSクイズに答える
- Linux Story Questを完了する
- Git Dungeonをプレイする
- 宿題成果物を作る
- 「かけら」で7日間記録する

---

# 5. 個人ひとりが作る学習サイトの最小ドメインモデル

## 5.1 コース定義 `course.yaml`

```yaml
schemaVersion: 1

id: web-infrastructure-basics
title: Webインフラ基礎
description: DNS、HTTPS、AWSで静的サイトを公開するまでを学ぶ
locale: ja-JP

objectives:
  - DNS問い合わせの流れを説明できる
  - HTTPS証明書の役割を説明できる
  - S3とCloudFrontの役割を区別できる

modules:
  - id: dns
    title: DNS
    order: 1
    activities:
      - dns-overview
      - dns-quiz

  - id: https
    title: HTTPS
    order: 2
    activities:
      - https-overview
      - deploy-static-site

completion:
  rule: all-required
```

## 5.2 教材frontmatter

```yaml
---
schemaVersion: 1

id: dns-overview
course: web-infrastructure-basics
module: dns

title: DNS問い合わせの流れ
type: reading
order: 1
required: true

objectives:
  - リゾルバと権威DNSの違いを説明できる

metadata:
  tags:
    - dns
    - aws
    - network
  difficulty: beginner
  estimatedMinutes: 15
  updatedAt: 2026-08-25

prerequisites: []

completion:
  type: self-confirm
  # 他の候補:
  # view       ページを開けば完了
  # self-confirm 手動で完了
  # score      minimumScore以上
  # event      指定イベントを受信
  # duration   指定時間以上
  # external   外部アプリから通知

assessment: null

evidence:
  optional: true
  prompt: DNS問い合わせの流れを自分の言葉でまとめる
---
```

ゲーム教材なら次のように表現できる。

```yaml
---
id: git-dungeon
course: git-basics
module: practice
title: Git Dungeon
type: game
required: true
path: /works/git/

metadata:
  tags: [git, game, practice]
  difficulty: beginner
  estimatedMinutes: 30

completion:
  type: event
  event:
    verb: completed
    object: git-dungeon/final-stage

assessment:
  type: automatic
  passingScore: 0.8
  attempts: unlimited

evidence:
  optional: false
  type: activity-result
---
```

## 5.3 学習者状態

静的な教材定義と、変化する学習者状態は分離する。

```json
{
  "schemaVersion": 1,
  "learnerId": "local-user",
  "activities": {
    "dns-overview": {
      "status": "completed",
      "progress": 1,
      "score": null,
      "attempts": 1,
      "totalSeconds": 742,
      "firstStartedAt": "2026-08-25T09:00:00+09:00",
      "lastAccessedAt": "2026-08-25T09:12:22+09:00",
      "completedAt": "2026-08-25T09:12:22+09:00",
      "bookmark": null
    },
    "git-dungeon": {
      "status": "in-progress",
      "progress": 0.6,
      "score": 0.75,
      "attempts": 2,
      "totalSeconds": 1830,
      "firstStartedAt": "2026-08-25T10:00:00+09:00",
      "lastAccessedAt": "2026-08-25T10:30:30+09:00",
      "completedAt": null,
      "bookmark": {
        "stage": 4
      }
    }
  }
}
```

`status`は最初は次の3値だけでよい。

```text
not-started
in-progress
completed
```

合否はstatusに混ぜず、別にする。

```json
{
  "completion": true,
  "success": false,
  "score": 0.55
}
```

「最後まで受けたが不合格」を表せるためである。

## 5.4 xAPI風の最小イベント

```json
{
  "id": "evt_01J...",
  "actor": "local-user",
  "verb": "completed",
  "object": "git-dungeon/stage-4",
  "result": {
    "completion": true,
    "success": true,
    "score": 0.9,
    "durationSeconds": 750
  },
  "context": {
    "course": "git-basics",
    "module": "practice",
    "session": "session_01J..."
  },
  "at": "2026-08-25T10:30:30+09:00"
}
```

推奨する最小Verb集合は6個でよい。

```text
started
viewed
progressed
attempted
completed
created
```

クイズやゲームに必要なら追加する。

```text
answered
passed
failed
```

---

# 6. 実装ルール

最初に固定すべきルールは次の通り。

1. `Course → Module → Activity` の3階層とする。
2. 記事・ゲーム・クイズ・アプリはすべてActivityとして扱う。
3. 教材定義と学習者状態を分離する。
4. 完了と合格を分離する。
5. `required`なActivityだけをコース進捗の分母にする。
6. 進捗はイベントから更新するが、表示用の集約状態も保存する。
7. prerequisiteは最初は案内表示に使い、強制ロックしない。
8. 読み物は自己完了、ゲームは完了イベント、クイズは最低得点を基本とする。
9. 時間、スコア、試行回数はnullableにする。すべての教材へ強制しない。
10. IDはURLやタイトルから独立した永続IDにする。

コース進捗は単純に計算できる。

```text
完了した必須Activity数 / 全必須Activity数
```

Module完了も同じ集約規則でよい。複雑な重み付け、部分点、条件分岐は必要になるまで追加しない。

---

# 7. 現在の素材への当てはめ

| 現在の素材 | Activity type | 完了条件 |
|---|---|---|
| AWS/DNS/HTTPS記事 | `reading` | 自己完了 |
| week1～week6授業メモ | `lesson` | 閲覧または自己完了 |
| Linux Story Quest | `game` | 最終ステージ完了イベント |
| Git Dungeon | `game` | 最終クエスト完了イベント |
| Tailwind練習 | `project` | 成果物URLまたは自己完了 |
| 「かけら」 | `practice` | 記録回数、または指定日数 |
| 成果物展示 | `evidence` | Activityから参照 |
| 将来の汎用クイズ | `quiz` / `h5p` | 最低得点または受験完了 |

この構造なら、現在の成果物をLMS形式へ無理に移植せず、「学習経路の中でどの役割を持つか」だけを追加できる。

最初の実装範囲は、`course.yaml`、frontmatter、3値進捗、自己完了ボタン、前後移動、進捗バー、最終アクセス、ゲームからの`completed`イベントまでで十分である。H5P、バッジ、LRS、アカウント、クラウド同期は、その後に具体的な必要性が生じた時点で追加するのが妥当である。