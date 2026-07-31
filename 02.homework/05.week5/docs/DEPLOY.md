# かけら デプロイ定義（AWS）

version 1.0 / 2026-07-31

本書は配置と運用を定める。機能の定義は REQUIREMENTS.md、見た目は DESIGN.md、リポジトリ構成は STRUCTURE.md に従う。

---

## 1. 構成（第1段階）

静的配信のみ。サーバープロセスもデータベースも持たない。第2段階の構成は第7章に定義する。

```
        利用者
          │ HTTPS
          ▼
   ┌──────────────┐      ┌──────────────┐
   │  Route 53    │─────▶│     ACM      │ (us-east-1)
   │  A / AAAA    │      │  証明書       │
   └──────┬───────┘      └──────────────┘
          ▼
   ┌──────────────────────────────┐
   │        CloudFront            │
   │  ・HTTPS のみ（HTTP は 301）  │
   │  ・Response Headers Policy   │
   │  ・OAC で S3 へ署名アクセス   │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │  S3（非公開・バージョニング）  │
   │  index.html / assets / icons │
   └──────────────────────────────┘

   デプロイ： GitHub Actions ──OIDC──▶ IAM Role ──▶ S3 sync + CF invalidation
```

| リソース | 名前（例） | 備考 |
|---|---|---|
| S3 バケット | `kakera-prod-site` | パブリックアクセス全ブロック。バージョニング有効 |
| CloudFront | `kakera-prod` | Default root object: `index.html` |
| ACM 証明書 | `kakera.example.com` | **us-east-1 に発行**（CloudFront の要件） |
| Route 53 | `kakera.example.com` | CloudFront への A / AAAA エイリアス |
| IAM ロール | `kakera-deploy` | GitHub OIDC の信頼ポリシーのみ。長期キーなし |
| リージョン | `ap-northeast-1` | S3 の配置先。配信は CloudFront のエッジ |

---

## 2. S3（第1段階）

### バケット設定

- パブリックアクセスブロック：**4項目すべて有効**
- バージョニング：有効（ロールバック用）
- 暗号化：SSE-S3（`AES256`）
- ライフサイクル：非現行バージョンを 30 日で削除

### バケットポリシー（OAC 経由のみ許可）

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontServicePrincipalReadOnly",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::kakera-prod-site/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
      }
    }
  }]
}
```

S3 の「静的ウェブサイトホスティング」は**使わない**。CloudFront + OAC の構成では不要であり、有効にするとバケットを公開する必要が生じる。

---

## 3. CloudFront（第1段階）

| 項目 | 値 |
|---|---|
| Origin | S3（OAC で署名。Origin access control signing behavior: Sign requests） |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Allowed methods | GET, HEAD |
| Compress objects automatically | Yes（Brotli / gzip） |
| Minimum TLS | TLSv1.2_2021 |
| HTTP versions | HTTP/2, HTTP/3 |
| Default root object | `index.html` |
| Price class | Use only North America and Europe → **日本向けのため Asia を含むクラスを選択**（All edge locations） |
| Cache policy | `CachingOptimized`（マネージド） |

### Response Headers Policy（カスタム）

| ヘッダー | 値 |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `Content-Security-Policy` | 下記 |

```
default-src 'none';
script-src 'self';
style-src 'self';
font-src 'self';
img-src 'self';
manifest-src 'self';
connect-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none'
```

`connect-src 'none'` は第1段階に限る設定であり、「記録を外へ送らない」という設計をブラウザ側でも強制するもの。第2段階では自ドメインの API のみを許可する `'self'` に切り替える（NFR-6.3、第7章）。

> フォントは自己ホストするため（DESIGN.md 8.6）、外部ドメインの許可を持たない。CSS も CDN を使わずビルド済みを配信する（NFR-8.11）。

### キャッシュ

| パス | Cache-Control |
|---|---|
| `/index.html` | `no-cache, must-revalidate` |
| `/site.webmanifest` | `no-cache, must-revalidate` |
| `/assets/*` | `public, max-age=3600` |
| `/*.png`, `/*.svg` | `public, max-age=86400` |

資産名にコンテンツハッシュを付けない場合、デプロイごとに `/*` を invalidation する。デプロイ頻度が低いので費用上の問題はない（月 1,000 パスまで無料）。
ファイル名へのコンテンツハッシュ付与は P1 の期間中の課題とし、そのとき `/assets/*` を `max-age=31536000, immutable` に切り替える。

### 監視

- CloudWatch アラーム 1本：`5xxErrorRate` が 5 分平均で 1% を超えたら通知（SNS → メール）
- それ以上の監視は置かない

---

## 4. デプロイ（第1段階）

### 4.1 認証（長期キーを作らない）

GitHub の OIDC プロバイダを IAM に登録し、リポジトリを限定した信頼ポリシーを持つロールを引き受ける。

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:<OWNER>/kakera:ref:refs/heads/main"
      }
    }
  }]
}
```

権限ポリシー（最小）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::kakera-prod-site"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::kakera-prod-site/*"
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
    }
  ]
}
```

### 4.2 自動デプロイ

`main` への push で `.github/workflows/deploy.yml` が動く。処理は次の順。

1. `npm ci`
2. `npm run build` → `web/dist/`
3. `aws s3 sync web/dist/ s3://<bucket>/ --delete`（Cache-Control をパス別に付与）
4. `aws cloudfront create-invalidation --paths "/*"`

### 4.3 手動デプロイ

```bash
npm ci
npm run build

aws s3 sync web/dist/ s3://kakera-prod-site/ --delete \
  --exclude "index.html" --exclude "site.webmanifest" \
  --cache-control "public, max-age=3600"

aws s3 cp web/dist/index.html s3://kakera-prod-site/index.html \
  --cache-control "no-cache, must-revalidate" --content-type "text/html; charset=utf-8"

aws s3 cp web/dist/site.webmanifest s3://kakera-prod-site/site.webmanifest \
  --cache-control "no-cache, must-revalidate" --content-type "application/manifest+json"

aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

### 4.4 ロールバック

前のコミットに戻して再デプロイする。S3 のバージョニングは保険であり、通常手段は Git に置く。

---

## 5. 費用の見積り（第1段階・単独利用）

| 項目 | 月額 |
|---|---|
| Route 53 ホストゾーン | 0.50 USD |
| Route 53 クエリ | 約 0.01 USD |
| S3 保管（40 KB 程度） | ほぼ 0 |
| CloudFront 転送 | 無料枠 1 TB / 月の範囲内 |
| ACM 証明書 | 無料 |
| **合計** | **月 1 USD 未満** |

ドメインを取得しない場合、CloudFront の既定ドメイン（`d***.cloudfront.net`）で運用でき、Route 53 の費用も不要になる。

---

## 6. 環境

第1段階は本番環境のみ。検証はローカルで行う。
ステージング環境は、第2段階（同期）の実装時に用意する。

---

## 7. 第2段階の構成

端末内保存を、AWS 上の DB による同期へ置き換える段階。**第1段階の配信構成（S3 + CloudFront）はそのまま残し、API とデータ層を足す。**

```
        利用者
          │ HTTPS
          ▼
   ┌──────────────────────────────┐
   │        CloudFront ＋ WAF      │
   │  /        → S3（画面）        │
   │  /api/*   → ALB（API）        │
   └───────┬──────────────┬───────┘
           ▼              ▼
   ┌──────────────┐  ┌──────────────────────────┐
   │  S3（静的）   │  │  ALB                     │
   └──────────────┘  │   └─ EC2 (Auto Scaling)  │
                     │      Amazon Linux 2023   │
                     │      Nginx + PHP-FPM     │
                     │      Laravel（API のみ）  │
                     └──────┬───────────┬───────┘
                            ▼           ▼
                  ┌──────────────┐ ┌──────────────┐
                  │ RDS          │ │ Cognito      │
                  │ PostgreSQL   │ │ 認証         │
                  │ (Multi-AZ 可) │ └──────────────┘
                  └──────────────┘
                            │
                  ┌──────────────────────────┐
                  │ Secrets Manager ／ KMS    │
                  │ SES（ワンタイムリンク送信） │
                  └──────────────────────────┘
```

### 7.1 構成要素

| 層 | 採用 | 内容 |
|---|---|---|
| API | **Laravel（Docker / EC2）** | API 専用。画面は返さない。Nginx コンテナ ＋ PHP-FPM コンテナの2つを compose で起動 |
| インスタンス | `t4g.small`（ARM） | Amazon Linux 2023。Docker Engine ＋ Compose プラグインのみを載せる。Auto Scaling Group（min 1 / max 2） |
| イメージ管理 | **ECR（プライベート）** | タグは Git のコミットハッシュ。`latest` を使わない |
| DB | **RDS for PostgreSQL**（`db.t4g.micro`） | 4.1 のスキーマをそのまま使う。gp3 20 GB から |
| 認証 | Cognito | パスワードレス（パスキー／メールリンク）を自前実装しない（P2-1.1） |
| メール | SES | ワンタイムリンクの送信 |
| 秘密情報 | Secrets Manager ＋ KMS | DB 認証情報をコードにも AMI にも置かない |
| ログイン管理 | SSM Session Manager | 踏み台も SSH 鍵も持たない |
| WAF | AWS WAF（CloudFront） | レート制限 ＋ マネージドルール |

### 7.2 ネットワーク

| 項目 | 内容 |
|---|---|
| VPC | 1つ。2 AZ にサブネットを置く |
| EC2 | パブリックサブネット。セキュリティグループで ALB からの 80 番のみ許可 |
| RDS | プライベートサブネット。EC2 のセキュリティグループからのみ許可 |
| NAT Gateway | **置かない。** 月 35 USD 前後かかるうえ、この構成では EC2 の外向き通信（Composer・yum・SES・Cognito）をパブリックサブネットで賄えるため |
| 直接アクセス | ALB のセキュリティグループは CloudFront のマネージドプレフィックスリストのみ許可し、ALB へ直接叩けないようにする |

**簡素化する場合**：ALB を置かず CloudFront から EC2 へ直結すると月 20 USD 下がる。ただしヘルスチェックと無停止入れ替えができなくなるため、常用するなら ALB を推奨する。

### 7.3 API

| メソッド | パス | 用途 |
|---|---|---|
| `POST` | `/api/auth/challenge` | パスキーの認証開始（代替：メールへワンタイムリンク送信） |
| `POST` | `/api/auth/verify` | 認証完了。セッション発行 |
| `POST` | `/api/auth/logout` | ログアウト |
| `POST` | `/api/migrate` | 端末内に残っていた初回ぶんの記録をアカウントへ引き継ぐ（P2-1.8） |
| `GET` | `/api/state` | 全件取得（ログイン直後・端末追加時） |
| `PUT` | `/api/entries/{date}` | 当日ぶんの登録・更新（過去日は 409 を返す） |
| `PUT` | `/api/outings/{month}` | 今月ぶんの登録・更新 |
| `DELETE` | `/api/account` | 退会。7日の猶予後に完全削除（FR-6.7） |

- 過去日の書き込みはサーバー側で拒否する（P2-2.2）
- 日単位の削除エンドポイントを作らない（P2-2.5）
- 集計を返すエンドポイントを作らない（P2-3.3）
- Laravel 側で `SELECT COUNT` による継続日数の算出を実装しない。**集計の入口を作らない**

### 7.4 セキュリティ

| 項目 | 内容 |
|---|---|
| CSP | `connect-src 'self'` を追加。第三者ドメインへの接続は引き続き禁止（NFR-6.3） |
| 保管時暗号化 | RDS を KMS で暗号化。REQUIREMENTS 6.5 は案 A（サーバー側暗号化）を推奨 |
| 通信 | CloudFront〜ALB は HTTPS。ALB〜EC2 は VPC 内 |
| ログ | アプリケーションログに記録内容を出力しない（P2-3.5）。Laravel のクエリログを本番で無効にする。CloudWatch Logs の保持は 30 日 |
| バックアップ | RDS 自動バックアップ 7 日 ＋ 日次スナップショット 30 日 |
| OS 更新 | SSM Patch Manager で月次適用 |
| 管理画面 | 作らない（P2-3.4）。Laravel Nova / Telescope を本番に入れない |

### 7.5 コンテナ

第2段階から Docker を前提にする。理由は次章に定義する。

#### イメージ

| 項目 | 内容 |
|---|---|
| 構成 | マルチステージ。`base`（PHP 拡張）→ `dev`（Xdebug 入り）→ `prod`（`composer install --no-dev --optimize-autoloader`） |
| ベース | `php:8.3-fpm-alpine`。**ダイジェストで固定**し、更新は明示的に行う |
| アーキテクチャ | `linux/arm64`（EC2 が Graviton のため） |
| 実行ユーザー | 非 root |
| 秘密情報 | イメージに焼かない。起動時に Secrets Manager／SSM Parameter Store から読む |
| 同梱しないもの | `.env`、`storage/` の中身、開発用パッケージ、Telescope・Nova |
| `.dockerignore` | `vendor/`、`node_modules/`、`.git/`、`storage/logs/` を除外 |
| ヘルスチェック | `HEALTHCHECK` で `/api/health` を叩く。ALB のヘルスチェックも同じパスを使う |

#### コンテナ構成（EC2 上）

| コンテナ | 役割 |
|---|---|
| `web` | Nginx。ALB からの 80 番を受け、静的な応答と PHP-FPM への振り分けのみ |
| `app` | PHP-FPM。Laravel 本体 |

ログドライバは `awslogs` を指定し、CloudWatch Logs へ直接送る。インスタンス上にログを溜めない。

#### レジストリ

| 項目 | 内容 |
|---|---|
| ECR | プライベートリポジトリ1つ |
| タグ | Git のコミットハッシュ（7桁）。可変タグを本番で参照しない |
| ライフサイクル | 直近10イメージを保持し、それ以前を削除 |
| 脆弱性スキャン | プッシュ時スキャンを有効化 |
| 取得権限 | EC2 のインスタンスプロファイルから ECR を読む。長期キーを置かない |

### 7.6 デプロイ

| 対象 | 方法 |
|---|---|
| 画面（S3） | 第4章と同じ。GitHub Actions から `s3 sync` ＋ invalidation |
| API（EC2） | GitHub Actions で ARM64 イメージをビルドして ECR へプッシュ → CodeDeploy が対象インスタンスで `docker compose pull && docker compose up -d` を実行 |
| マイグレーション | デプロイ時に1台でのみ `php artisan migrate --force` を実行する（`docker compose run --rm app`） |
| ロールバック | 直前のコミットハッシュのタグで起動し直す。イメージが残っているため再ビルド不要 |
| 設定変更 | `.env` を配らない。Secrets Manager と SSM Parameter Store の値を差し替えて再起動する |

認証は第1段階と同じく GitHub OIDC。長期アクセスキーは発行しない（NFR-6.6）。

### 7.7 ローカル開発

**本番と同じ Dockerfile の `dev` ステージを使う。** 別立ての開発用構成を持たない。

| コンテナ | 用途 |
|---|---|
| `app` | PHP-FPM（Xdebug 有効） |
| `web` | Nginx |
| `db` | PostgreSQL。**本番の RDS と同じメジャーバージョンに固定する** |
| `mail` | Mailpit。ワンタイムリンク（P2-1.1）の送信を、SES を使わずに手元で確認する |

`docker compose up` の1コマンドで起動すること（NFR-8.5）。Laravel Sail は使わない。本番と同じイメージ定義を共有するため。

### 7.8 費用の見積り（第2段階）

| 項目 | 月額（概算） |
|---|---|
| EC2 `t4g.small` × 1 | 約 16 USD |
| ALB | 約 20 USD |
| RDS `db.t4g.micro` ＋ gp3 20 GB | 約 18 USD |
| ECR（イメージ保管 約 3 GB） | 約 0.3 USD |
| Cognito / SES | 無料枠内 |
| CloudFront / S3 / Route 53 / WAF | 約 7 USD |
| **合計** | **約 61 USD** |

第1段階の 1 USD 未満から大きく上がる。削減余地は次のとおり。

- Savings Plans（1年）で EC2 を約 30% 削減
- ALB を外して CloudFront 直結にすると 20 USD 減（可用性と引き換え）
- RDS を停止せず使う前提のため、ここは削れない

### 7.9 第1段階からの移行

| 手順 | 内容 |
|---|---|
| 1 | 第1段階の利用者には、更新後の初回起動時に登録を求める |
| 2 | 端末内に記録があれば「この端末の記録を引き継ぐ」を既定の選択肢として提示する |
| 3 | サーバー側が空の場合のみ一括登録する。既にある場合は日付ごとに P2-2.2 の規則を適用 |
| 4 | 引き継ぎ前に、控え（FR-5）の取得を案内する |
| 5 | 引き継ぎ後も端末内のキャッシュは消さない |
