# 14.〈本題〉いまある資産を、どう当てはめるか

> 10〜13章で「学習サイトとは何か」が決まった。この章は
> **手元の資産をそのモデルへ具体的に割り当てる**ためのもの。
> （この章は調査結果ではなく、リポジトリの現物を読んだ上での配置案）

---

## 0. 最大の発見 — コンテンツは足りている。器が無いだけ

リポジトリ内の Markdown を数えた結果:

| ドキュメント | 行数 | 内容 |
|---|---:|---|
| `02.homework/05.week5/docs/STUDY.md` | 1,023 | 「入り口から順番に、裏側で起きていることを全部説明する」 |
| `02.homework/04.week4/html_gen_pattern/docs/GUIDE.md` | 807 | |
| `02.homework/04.week4/html_gen_pattern/docs/SPEC.md` | 800 | |
| `02.homework/04.week4/html_gen_pattern/docs/NOTES_layout-patterns.md` | 750 | |
| `02.homework/05.week5/docs/FILES.md` | 630 | 「このリポジトリのすべて」 |
| `02.homework/05.week5/docs/DESIGN.md` | 625 | |
| `02.homework/05.week5/docs/REQUIREMENTS.md` | 617 | |
| `02.homework/05.week5/docs/DEPLOY.md` | 427 | |
| `01.lesson/03.week3/独自ドメインとHTTPS化の仕組み解説.md` | 398 | |
| `02.homework/04.week4/html_gen_pattern/docs/CONTENT.md` | 352 | |
| `02.homework/05.week5/docs/STRUCTURE.md` / `UX.md` | 260 / 258 | |
| `01.lesson/03.week3/サブドメインに静的S3サイトを公開する手順.md` | 229 | |
| ほか | | |
| **合計** | **約 8,800 行** | |

**公開サイトに載っているのは 4 記事だけ。**

手書き HTML の学習ブログにしたせいで、**Markdown で既に書いた 8,800 行が
リポジトリに埋もれて公開されていない**。これはコンテンツ不足ではなく、
**器が無いことによる問題**で、Starlight を入れれば sidebar に足すだけで解決する。

→ **これが「学習サイトを作る」ことの、いちばん即効性のある効果。**

---

## 1. 資産 → Unit の割り当て

10章の `Course → Chapter → Unit(kind)` へ全資産を割り当てた表。

### コース1: Web インフラ（AWS / DNS / HTTPS）

| 現在の資産 | kind | 置き場所 | 備考 |
|---|---|---|---|
| `articles/case-00-s3-cloudfront.html` | `article` | `docs/courses/web-infra/01-s3-cloudfront.md` | HTML → Markdown |
| `articles/case-01-domain-https.html` | `article` | `.../02-domain-https.md` | **slug は維持**（既存 URL） |
| `articles/case-02-subdomain-s3.html` | `article` | `.../03-subdomain-s3.md` | |
| `articles/case-03-cross-account-subdomain.html` | `article` | `.../04-cross-account.md` | |
| `01.lesson/03.week3/独自ドメインとHTTPS化の仕組み解説.md`（398行） | `article` | `.../00-https-concepts.md` | **そのまま載る**。case-01 の前段に置くと順序が通る |
| `01.lesson/03.week3/サブドメインに静的S3サイトを公開する手順.md`（229行） | `article` | `.../03b-subdomain-howto.md` | 手順書。記事と分けると読みやすい |
| `02.homework/04.week4/summary.md` + `subdomain-guide*.html` | `article` | `.../04b-delegation-summary.md` | |
| `02.homework/05.week5/docs/DEPLOY.md`（427行） | `project` | `.../05-deploy-project.md` | **成果物としての完了条件を付ける** |

### コース2: Linux

| 現在の資産 | kind | 置き場所 | 備考 |
|---|---|---|---|
| （新規に書く導入） | `article` | `docs/courses/linux/01-basics.md` | ゲームの前に読む |
| **Linux Story Quest** | **`exercise`** | `docs/courses/linux/02-story-quest.md` が `/works/linux-story-quest/` を起動 | **11章の Exercism 構造を適用** |

### コース3: Git

| 現在の資産 | kind | 置き場所 | 備考 |
|---|---|---|---|
| （新規に書く導入） | `article` | `docs/courses/git/01-basics.md` | **Learn Git Branching へのリンクもここ** |
| **Git Dungeon** | **`exercise`** | `docs/courses/git/02-git-dungeon.md` が `/works/git-dungeon/` を起動 | **isomorphic-git へ載せ替え → 11章** |

### コース4: Web フロントエンド

| 現在の資産 | kind | 置き場所 | 備考 |
|---|---|---|---|
| `01.lesson/04.week4/html`, `javascript`, `tailwind` | `article` | `docs/courses/frontend/` | 授業メモとして |
| `02.homework/04.week4/html_gen_pattern/docs/*`（**2,709行**） | `article` ×4 | `docs/courses/frontend/patterns/` | **GUIDE / SPEC / CONTENT / NOTES を4 Unit に分ける** |
| `02.homework/04.week4/tailwind/SPEC_redesign.md` | `article` | `.../tailwind-redesign.md` | |
| `01.lesson/02.week2/nomal_site` | `project` | `/works/` へ | 初期の成果物 |

### コース5: アプリを作る（かけら）

| 現在の資産 | kind | 置き場所 | 備考 |
|---|---|---|---|
| `docs/REQUIREMENTS.md`（617行） | `article` | `docs/courses/build-app/01-requirements.md` | **要件定義の書き方そのものが教材** |
| `docs/DESIGN.md`（625行） | `article` | `.../02-design.md` | |
| `docs/UX.md`（258行） | `article` | `.../03-ux.md` | |
| `docs/STRUCTURE.md`（260行） | `article` | `.../04-structure.md` | |
| `docs/STUDY.md`（**1,023行**） | `article` | `.../05-how-it-works.md` | **最大の教材資産。裏側の全解説** |
| `docs/FILES.md`（630行） | `article` | `.../06-every-file.md` | |
| **かけら本体** | **`project`** ＋ **習慣レイヤー** | `/works/kakera/` | **12章の位置づけ直しを参照** |
| `docs/PRESENTATION.md`（117行） | — | **Marp で HTML/PDF 化** → `/slides/kakera/` | → 07章 |

### 別枠: 授業メモ

`01.lesson/01.week1` 〜 `06.week6` は、**最初はほぼそのまま Markdown 化して
`docs/notes/week-01..06.md` に置く**。あとから「教材」と「記録」に分離する。

> `01.lesson/06.week6/memo-app`（Laravel）は**まだ未コミット**。
> vendor/ の扱いは 08章の緊急案件を参照。

---

## 2. 「Case Files / Exhibition」の分割は構造上の誤りだった

現在の `03.learning_site/index.html` は
**Case Files（学習記録）** と **Exhibition（制作物展示室）** の2セクションに分けている。

10章のモデルでは、**これは分ける必要がない**:

```
❌ 現在      Case Files（記事） ／ Exhibition（作品）  ← 別セクション
✅ モデル    Unit(kind: article) ／ Unit(kind: project) ／ Unit(kind: exercise)
                        ↑ すべて同じコースの中に、順序を持って並ぶ
```

**「学習記録もそれ自体が制作物」というあなたの元々の思想**（`03.learning_site/README.md`）は正しい。
モデルもそう言っている。**分けるべきなのはセクションではなく `kind` と完了条件だけ。**

ただし **`/works` という一覧ページは残す価値がある** —— ポートフォリオとして
「作ったもの」だけを見せる導線は別に要るため。コースの中にも並び、`/works` にも出る、
という二重の見せ方にする。

---

## 3. 「かけら」の三重の役割

かけらは今後 **3つの顔**を持つ。混ぜないこと。

| 役割 | kind / 位置 | 内容 |
|---|---|---|
| **① 教材の題材** | `article` ×6 | REQUIREMENTS / DESIGN / UX / STRUCTURE / STUDY / FILES を読む |
| **② 成果物** | `project` | `/works/kakera/` で動く。完了条件＝デプロイ済み・README・振り返り |
| **③ 学習習慣レイヤー** | 機能 | **学習イベントを購読して「今日学習に向き合ったか」を記録し、60日後に振り返らせる** |

③ が 12章で提案された位置づけ直し。**かけらが完了状態を別保存すると二重管理になる**ので、
学習イベントを入力に日次の習慣記録を**派生**させ、
**自由記述の感想だけをかけら固有データとして持つ**。

あなたが作った「60日後に読み返す」という時間ルールが、
**学習サイトの振り返り機能としてそのまま生きる**。

> ⚠ **かけらは連続日数や達成率を意図的に持たない設計**（`docs/PRESENTATION.md:20`）。
> 学習サイト化のときに「ストリーク」を足したくなるが、**この設計判断を壊さないこと**。
> 12章の「ストリークの扱い」を参照。

---

## 4. 移行の順序（現行サイトを止めずに）

| # | やること | 効果 | 参照 |
|---|---|---|---|
| 1 | **Starlight を新規に立てる**（既存 HTML は消さない） | 器ができる | 13章 |
| 2 | **記事4本を Markdown 化**。slug は維持 | URL が壊れない | 13章 |
| 3 | **ゲーム2本を `public/works/` へ無改造でコピー** | 二重管理が消える | 13章 |
| 4 | **埋もれている Markdown 8,800 行を sidebar に載せる** | **公開量が一気に増える** | 本章 §1 |
| 5 | frontmatter に `id` / `kind` / `order` / `prerequisites` を入れる | モデルが乗る | 12章 |
| 6 | **IndexedDB に完了状態とイベント。エクスポートを先に作る** | 学習状態モデル（B）を獲得 | 12章 |
| 7 | 図解を D2 でコード化（技術図のみ） | 69MB 問題の根治 | 05章 |
| 8 | Git Dungeon を isomorphic-git へ | 判定が正しくなる | 11章 |
| 9 | `ts-fsrs` で復習キュー | 定着 | 12章 |
| 10 | かけらを習慣レイヤーへ | 二重管理の回避 | 12章・本章 §3 |

**1〜4 だけでも、いまより遥かに「学習サイト」になる。**
5 以降は学習状態モデルの実装なので、必要を感じてからで構わない。

---

## 5. 何を捨て、何を残すか

### 捨てる

- 手書き HTML の記事レイアウト（ヘッダ・フッタの6ファイルコピペ）
- `index.html` のカードを手で足す運用
- `03.learning_site/works/` の**手動コピー**（＝二重管理）
- Case Files と Exhibition の**セクション分割**
- `build.js` の自作 minifier と BPE（→ 03章）

### 残す

- **ヴィクトリア朝の CSS 303 行** — サイト固有の価値。Starlight のカスタム CSS へ移植
- **記事の語り口と物語挿絵** — Case File No.X という見立てごと残す
- **日本語の教材文すべて** — 8,800 行はそのまま資産
- **Linux Story Quest の仮想 FS と教材ロジック** — 置換できる OSS が無い（11章）
- **RPG の世界観・ステージ設計・ヒントの出し方** — OSS 教育基盤では得られない固有価値
- **60日ルール** — 学習サイトの振り返り機能として昇格
- **かけらのアクセシビリティ実装** — 既にかなり適切（12章）

> 「ゼロから作らなければよかった」わけではない。
> **器（A: 出版モデル）を自作したのが遠回りだった**だけで、
> **中身（教材・物語・ルール）は、OSS からは絶対に手に入らない部分**。
