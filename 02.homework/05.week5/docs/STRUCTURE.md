# かけら リポジトリ構成定義

version 1.0 / 2026-07-31

本書はコードの置き場所と分け方を定める。機能の定義は REQUIREMENTS.md、見た目は DESIGN.md、配置と運用は DEPLOY.md に従う。

---

## 1. 方針

| 方針 | 内容 |
|---|---|
| 単一リポジトリ | 画面と API を同じリポジトリに置く。個人〜少人数の開発で、リポジトリを分ける利点より、変更を1つのコミットで通せる利点が上回る |
| 最初から最終形 | P2 で移動が発生しないよう、P1 の時点で最終的な階層を作る。`api/` は P2 まで存在しないだけで、`web/` の位置は変えない |
| 生成物を持たない | `dist/`、`vendor/`、`node_modules/` をコミットしない |
| CDN に依存しない | CSS もフォントも npm 取得・自己ホストとし、ビルドした成果だけを配信する（NFR-8.11） |
| 境界を1か所に | 画面が API を知る場所を `storage/` の1ディレクトリに閉じる（NFR-8.1） |

---

## 2. 第1段階（P1）の構成

静的サイトのみ。実行環境を持たないため Docker を置かない（NFR-8.8）。

```
kakera/
├── README.md
├── .gitignore
├── .editorconfig
│
├── docs/
│   ├── REQUIREMENTS.md
│   ├── DESIGN.md
│   ├── DEPLOY.md
│   └── STRUCTURE.md
│
├── web/
│   ├── package.json
│   ├── .nvmrc                       ← Node のバージョン固定
│   ├── src/
│   │   ├── index.html
│   │   ├── styles.css               ← Tailwind の設定を兼ねる（DESIGN.md 8章）
│   │   │                               tailwind.config.js は置かない
│   │   ├── app/
│   │   │   ├── main.js              ← 起動のみ
│   │   │   ├── state.js             ← 状態と更新
│   │   │   ├── storage/
│   │   │   │   ├── index.js         ← driver の選択
│   │   │   │   └── local.js         ← localStorage
│   │   │   ├── views/
│   │   │   │   ├── today.js         ← 今日
│   │   │   │   ├── fragments.js     ← かけら
│   │   │   │   ├── outing.js        ← ひとつ
│   │   │   │   ├── about.js         ← このアプリについて
│   │   │   │   └── onboarding.js    ← はじめて
│   │   │   └── lib/
│   │   │       ├── date.js          ← 日付キー・開放判定
│   │   │       └── dom.js
│   │   └── data/
│   │       └── lines.json           ← 今日の一言 366 件（FR-8.3）
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── site.webmanifest
│   │   └── fonts/                   ← 自己ホストする woff2（DESIGN.md 8.6）
│   └── dist/                        ← 生成物。Git 管理外
│
├── infra/
│   ├── cloudfront/
│   │   └── response-headers-policy.json
│   ├── s3/
│   │   └── bucket-policy.json
│   └── iam/
│       ├── deploy-role-trust.json
│       └── deploy-role-policy.json
│
└── .github/
    └── workflows/
        └── deploy-web.yml
```

---

## 3. 第2段階（P2）の構成

`api/` と Docker が加わる。**`web/` の位置と中身は動かさない。** 追加分を `＋` で示す。

```
kakera/
├── README.md
├── .gitignore
├── .editorconfig
├── compose.yaml                     ＋ 開発用。web と api を通しで動かす
│
├── docs/                            （変更なし）
│
├── web/
│   ├── package.json
│   ├── .nvmrc
│   ├── src/
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── app/
│   │   │   ├── main.js
│   │   │   ├── state.js
│   │   │   ├── storage/
│   │   │   │   ├── index.js         ← ここの1行で driver を切り替える
│   │   │   │   ├── local.js         ← 残す。キャッシュとして使う（P2-0.2）
│   │   │   │   ├── api.js           ＋ HTTP
│   │   │   │   └── queue.js         ＋ 送信待ちの保持（P2-0.4）
│   │   │   ├── views/
│   │   │   │   ├── today.js
│   │   │   │   ├── fragments.js
│   │   │   │   ├── outing.js
│   │   │   │   ├── about.js
│   │   │   │   ├── onboarding.js
│   │   │   │   ├── auth.js          ＋ 登録のお願い・ログイン（P2-1.7 / 1.9）
│   │   │   │   └── lock.js          ＋ ロック解除（P2-1.11）
│   │   │   └── lib/
│   │   │       ├── date.js
│   │   │       └── dom.js
│   │   └── data/
│   │       └── lines.json
│   ├── public/
│   └── dist/
│
├── api/                             ＋ Laravel。API のみ
│   ├── Dockerfile                   ＋ base → dev → prod
│   ├── .dockerignore                ＋
│   ├── composer.json                ＋
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/         ＋ 入出力の変換のみ
│   │   │   └── Middleware/          ＋ 認証
│   │   ├── Models/                  ＋ User / Entry / Outing
│   │   └── Services/                ＋ 同期の規則（P2-2.2〜2.4）
│   ├── routes/
│   │   └── api.php                  ＋ DEPLOY.md 7.3 の一覧
│   ├── database/
│   │   └── migrations/              ＋ REQUIREMENTS 4.1 のスキーマ
│   ├── tests/                       ＋
│   └── docker/
│       ├── nginx/default.conf       ＋
│       └── php/php.ini              ＋
│
├── infra/
│   ├── cloudfront/
│   │   └── response-headers-policy.json   ← connect-src を 'self' に変更
│   ├── s3/
│   ├── iam/
│   ├── ecr/
│   │   └── lifecycle-policy.json    ＋ 直近10イメージを保持
│   └── codedeploy/
│       └── appspec.yml              ＋
│
└── .github/
    └── workflows/
        ├── deploy-web.yml           ← 発火条件に web/** を明記
        └── deploy-api.yml           ＋ api/** の変更で発火
```

---

## 4. 第3段階（P3）の構成

通知が加わる。P2 からの追加のみ示す。

```
kakera/
├── web/
│   ├── src/
│   │   ├── sw.js                    ＋ Service Worker（オフライン・受信）
│   │   └── app/
│   │       └── lib/
│   │           └── push.js          ＋ 購読の登録・解除
│   └── public/
│
└── api/
    ├── app/
    │   └── Console/
    │       └── Commands/
    │           └── SendReminders.php  ＋ 1日1回・1通のみ（FR-7.2）
    ├── routes/
    │   └── console.php              ＋ スケジュール定義
    └── database/migrations/
        └── ..._create_push_subscriptions_table.php  ＋
```

`web/` と `api/` の階層は P2 のまま。移動は発生しない。

---

## 5. 段階ごとの差分（一覧）

| 段階 | 追加されるもの |
|---|---|
| **P1** | `web/`、`docs/`、`infra/`（S3・CloudFront・IAM）、`deploy-web.yml` |
| **P2** | `api/`、`compose.yaml`、`infra/ecr/`、`infra/codedeploy/`、`deploy-api.yml`、`storage/api.js`、`storage/queue.js`、`views/auth.js`、`views/lock.js` |
| **P3** | `web/src/sw.js`、`lib/push.js`、`api/app/Console/Commands/`、購読テーブル |

**削除されるファイルはない。** `storage/local.js` は P2 以降もキャッシュとして使い続ける。

---

## 6. 責務の境界

### 6.1 画面

| ディレクトリ | 責務 | 禁止 |
|---|---|---|
| `app/views/` | 描画とイベント。画面ごとに1ファイル | `fetch` を直接書かない。`localStorage` を直接触らない |
| `app/state.js` | 状態の保持と更新。保存層の呼び出し | DOM を触らない |
| `app/storage/` | 保存先とのやり取り | 画面の都合を知らない |
| `app/lib/` | 純粋な関数（日付計算など） | 状態も DOM も持たない |
| `data/lines.json` | 静的データ | ユーザーデータを混ぜない（FR-8 の一言はユーザーデータに保存しない） |

**保存層の差し替えが `storage/index.js` の1行で済むこと**（NFR-8.1）。P2 で `local.js` を `api.js` に切り替えるとき、`views/` と `state.js` は変更しない。

### 6.2 API

| ディレクトリ | 責務 |
|---|---|
| `routes/api.php` | エンドポイント定義（DEPLOY.md 7.3） |
| `Http/Controllers/` | 入出力の変換のみ。業務規則を書かない |
| `Services/` | 同期の規則（P2-2.2〜2.4）をここに集約する |
| `Models/` | 永続化。集計メソッドを持たせない（NG-1、P2-3.3） |

画面（Blade / Inertia など）を返さない。API のみ。

---

## 7. 命名

| 対象 | 規則 | 例 |
|---|---|---|
| JS ファイル | ケバブケース不可。小文字1語を基本とする | `today.js`, `state.js` |
| CSS のトークン | DESIGN.md の色名に合わせる | `--color-sushi`, `--color-ai` |
| 画面名 | 日本語の画面名と1対1に対応させる | かけら → `fragments.js` |
| PHP | PSR-12 | `EntryController.php` |
| ブランチ | `main` と短命の作業ブランチのみ | `fix/date-rollover` |
| イメージタグ | Git のコミットハッシュ7桁 | `a1b2c3d` |

---

## 8. Git 管理外

```
node_modules/
vendor/
web/dist/
api/.env
api/storage/logs/
.DS_Store
*.log
```

`.env` はコミットしない。値は Secrets Manager と SSM Parameter Store に置く（DEPLOY.md 7.6）。

---
