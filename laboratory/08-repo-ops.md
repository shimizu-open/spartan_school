# 08. リポジトリ運営・セキュリティ・CSS の土台

対象: リポジトリ全体
調査: codex + web search（2026-08-25）／track8
※ 生の詳細（設定ファイル全文など）は [raw/track8-repo-ops.md](raw/track8-repo-ops.md)

---

## 🔴 最重要の現状診断 — デプロイ Workflow が動いていない

```
現在:  02.homework/05.week5/.github/workflows/deploy-web.yml
必要:  .github/workflows/deploy-web.yml   ← リポジトリ直下
```

**GitHub Actions が認識するのはリポジトリ直下の `.github/workflows/` だけ。**
現在のファイルは git 管理下にあるが、**このリポジトリでは一度も実行されていない。**

ルートへ移す際は次も直すこと:
`working-directory` / `paths` / `.nvmrc` のパス / lockfile のパス（すべて `02.homework/05.week5/...`）

## リポジトリ運営ファイルの現況

| 項目 | 現況 | 評価 |
|---|---|---|
| **ルート `.github/`** | **なし** | **Workflow・Dependabot・Issue Template が機能しない** |
| ルート `package.json` | なし | 5個の Node プロジェクトが独立。**現段階では無理に workspace 化しなくてよい** |
| `.gitignore` | あり | `.env*` / `node_modules` / `dist` は除外。⚠ **`vendor/` が無い**（後述） |
| `.nvmrc` | `week5/web/.nvmrc` のみ（値 `22`） | リポジトリ全体の Node 固定にはなっていない |
| `.editorconfig` | `02.homework/05.week5/` だけ | **ルートへ昇格すべき** |
| `LICENSE` | **なし** | **公開していても再利用許諾がない** |
| 帰属表示 | 体系的なファイルなし | Fontsource/OFL、tldr の CC-BY を管理できていない |
| **秘密情報** | **実キーは検出されず** | AWS JSON は ARN とプレースホルダーのみ。**ただし検知 CI がない** |
| Actions 参照 | `checkout@v4` 等の可変タグ | Workflow を移した後は **SHA 固定**が必要 |
| AWS 認証 | **OIDC 前提** | **長期アクセスキーを使わない良い設計** |
| IAM | S3 と CloudFront に限定 | 比較的よい |

---

## 🔴 緊急: `vendor/` が `.gitignore` から漏れている

```
01.lesson/06.week6/memo-app/src/vendor/   93MB / 8,794 ファイル
.gitignore に "vendor" の記述: 0件
```

week6 は**まだ未コミット**（`?? 01.lesson/06.week6/`）。
**この状態で `git add .` すると Laravel の vendor が丸ごとリポジトリに入る。**
一度入ると履歴から消すのは面倒なので、**コミット前の今が直すタイミング**。

```gitignore
# Dependencies
node_modules/
vendor/          # ← 追加
```

---

## いま5分で入れて、いちばん事故を防ぐ3つ

### 1. AWS Budget（実費 $1・予測 $5 で通知）

個人 AWS 学習で最も怖いのは**気づかず月末まで放置**すること。Budget 監視自体は無料。

```yaml
# infra/billing-budget.yml
AWSTemplateFormatVersion: "2010-09-09"
Parameters:
  AlertEmail: { Type: String }
Resources:
  LearningBudget:
    Type: AWS::Budgets::Budget
    Properties:
      Budget:
        BudgetName: personal-learning-monthly
        BudgetLimit: { Amount: 5, Unit: USD }
        BudgetType: COST
        TimeUnit: MONTHLY
      NotificationsWithSubscribers:
        - Notification: { ComparisonOperator: GREATER_THAN, NotificationType: ACTUAL,
                          Threshold: 1, ThresholdType: ABSOLUTE_VALUE }
          Subscribers: [{ SubscriptionType: EMAIL, Address: !Ref AlertEmail }]
        - Notification: { ComparisonOperator: GREATER_THAN, NotificationType: FORECASTED,
                          Threshold: 5, ThresholdType: ABSOLUTE_VALUE }
          Subscribers: [{ SubscriptionType: EMAIL, Address: !Ref AlertEmail }]
```

```bash
aws cloudformation deploy --stack-name personal-learning-budget \
  --template-file infra/billing-budget.yml \
  --parameter-overrides AlertEmail=your-address@example.com
```

⚠ **これは「課金を停止」する機能ではない。**早期検知のためのもの。

### 2. Gitleaks（AWSキー等を履歴込みで検査）

ルートの `.github/workflows/secrets.yml` に配置。infra/ に AWS 設定 JSON を置いている以上、
検知 CI は入れておく価値がある。設定全文は [raw/track8-repo-ops.md](raw/track8-repo-ops.md) を参照。

### 3. Dependabot（npm と Actions の放置を防ぐ）

**第一推奨。** ルート `.github/dependabot.yml` で npm と GitHub Actions をまとめて管理。
GitHub 組み込みで追加アカウントも常駐サーバーも不要。
**散在する5個の lockfile と、将来ルートへ移す Actions の SHA を同時に更新できる。**
高度なグルーピングが必要になるまでは **Renovate より運用負荷が低い**。

---

## CSS の土台 — クラスレス CSS は「導入しない」

学習サイトには理論上 Pico.css か Simple.css が合うが、**今回は導入しないのが妥当**。

> `assets/style.css` はすでに色・書体・カード・記事・表・コード・ナビを一貫して定義している。
> クラスレス CSS を足すと **303行が減るのではなく、「外部 CSS を打ち消す上書き」が増える**。

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **Pico.css** | [picocss/pico](https://github.com/picocss/pico) · MIT · v2.1.1（2025-03） | 既存テーマとの上書き競合が大きい |
| **Simple.css** | [kevquirk/simple.css](https://github.com/kevquirk/simple.css) · MIT · 2026 も commit | 学習ブログ全体を置換できるが**カードや記事幅まで意匠が決まる** |
| **Water.css** | [kognise/water.css](https://github.com/kognise/water.css) · MIT · 最終リリース**未確認** | ヴィクトリア朝の色・幅・タイポグラフィをほぼ上書き。**不採用** |
| Sakura / MVP.css / new.css | MIT | 役割が重なる、または意匠が強い |

→ **クラスレス CSS の適所は、今後作る一時的な授業メモや検証 HTML。**

### CSS の最終結論

- **Pico 等のクラスレス CSS は重ねない**
- `modern-normalize` は必要なら**土台だけ**借りる
- **Open Props は余白・ease の考え方だけ借りる**
- **CUBE CSS と `@layer` で既存 CSS を整理する**
- 機械チェックを入れるなら **stylelint** を第一候補に
- **vanilla-extract / Panda / PostCSS 単体導入はしない**

---

## その他（詳細は raw/ 参照）

| 領域 | 推奨 |
|---|---|
| Git hooks | **lefthook**（husky / simple-git-hooks / pre-commit と比較） |
| staged file | lint-staged / nano-staged |
| commit・release | commitlint + Conventional Commits、changesets / release-please |
| **Node 22 固定** | **ルートに `.nvmrc`** を置く。mise / volta / asdf / fnm / corepack |
| `.editorconfig` | **ルートへ昇格** |
| Markdown 品質 | markdownlint、textlint（→ 05章） |
| **LICENSE** | **現状なし**。学習用なら MIT / CC-BY / Unlicense / 敢えて付けない から選ぶ |
| ライセンス検査 | REUSE(FSFE) / licensee / license-checker |
| **第三者素材の帰属** | **`Third-party notices` を作る**（Fontsource OFL、tldr の CC-BY、アイコン） |
| AWS 掃除 | aws-nuke、cloud-custodian、Infracost |

---

## 直す順序

1. **`.gitignore` に `vendor/` を追加**（week6 コミット前に）← いますぐ
2. **`.github/` をルートへ移動**して Workflow を実際に動かす
3. **AWS Budget** を入れる
4. **Dependabot** を入れる
5. Gitleaks を入れる
6. `.editorconfig` と `.nvmrc` をルートへ昇格
7. LICENSE と Third-party notices を決める
