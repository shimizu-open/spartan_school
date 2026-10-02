# OSS調査結果：C. インフラ／D. 学習ゲーム／学習全体の土台

調査基準日は **2026-08-25**。実物の以下を確認した上で、公式リポジトリ・公式ドキュメント・公式料金ページを中心に調査した。

- `02.homework/05.week5/infra`
  - S3 バケットポリシー
  - CloudFront レスポンスヘッダーポリシー
  - GitHub OIDC 信頼ポリシー
  - S3／CloudFront デプロイ権限
- `02.homework/01.week1`
  - Linux Story Quest：仮想FS、コマンド解析、状態遷移を自作
  - Git Dungeon：マップ、Git状態、クエスト判定を自作

## 結論

### この人ならこれ

- **AWSを学ぶことが目的なら：AWS CDK**
- **単に個人サイトを安く公開するなら：Cloudflare Pages**
- **Git教材は：Learn Git Branchingを先に使う**
- **Linux教材は：Bashcrawl → OverTheWire Bandit**
- **自作ゲームを続けるなら：xterm.jsだけ導入し、教材ロジックは自作を維持**
- **学習記録サイトの土台は：Quartz 5**

CDK は Node.js 22／JavaScript・TypeScriptという現在の前提に合い、CloudFormationの状態管理を使えるため、Terraform系の別state管理を増やさずに済む。Cloudflare Pagesは、個人の静的サイト一つという規模では、AWSのバケット・OAC・証明書・CDN・IAMを管理する必要そのものを消せる。

---

# C. インフラ／デプロイ

## C-1. 生JSONを置き換えるIaC

### 比較

| 名前／一行説明 | リポジトリ／ライセンス／活動状況 | このケースで置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **AWS CDK** — JS/TSでAWSリソースを宣言し、CloudFormationへ変換 | [aws/aws-cdk](https://github.com/aws/aws-cdk)／Apache-2.0。活発。2026-07ごろ v2.262系。[公式リポジトリとライセンス](https://github.com/aws/aws-cdk/blob/main/LICENSE) | S3、OAC、CloudFront、レスポンスヘッダーポリシー、IAM OIDCロール、バケットポリシーを1つのStackへ集約 | **中**。CDK bootstrap、TypeScript、constructの理解が必要 | AWS専用。ただしこの案件ではむしろ利点。生成されるCloudFormationが長く、抽象化の下を理解しにくい場面はある |
| **OpenTofu** — OSS版Terraform互換の宣言的IaC | [opentofu/opentofu](https://github.com/opentofu/opentofu)／MPL-2.0。活発。2026-05 v1.12.1前後。[公式リポジトリ](https://github.com/opentofu/opentofu) | 4つのJSONとAWSリソース全体。planで変更差分を確認できる | **中〜高**。HCL、state、provider lock、state保存先が増える | マルチクラウドやIaC就職学習には有力。ただし静的サイト一つにはstate管理が過剰 |
| **Terraform** — IaCの事実上の標準の一つ | [hashicorp/terraform](https://github.com/hashicorp/terraform)／v1.6以降はBUSL-1.1、4年後MPL-2.0。活発。2026-05 v1.15.4。[リリース](https://github.com/hashicorp/terraform/releases)、[ライセンス](https://github.com/hashicorp/terraform/blob/main/LICENSE) | OpenTofuと同じ | **中〜高** | 個人利用は可能だが、厳密には現在の新バージョンはOSI型OSSではない。OSS重視ならOpenTofuを優先 |
| **CloudFormation** — AWSネイティブのYAML/JSON IaC | 製品本体はAWSサービス。テンプレート例は [aws-cloudformation/aws-cloudformation-templates](https://github.com/aws-cloudformation/aws-cloudformation-templates)／Apache-2.0。サービスは継続開発 | JSON断片を1つのYAMLテンプレートに統合。依存関係・出力値も管理 | **中** | AWSの仕組みを最も直接学べるが、記述量が多い。生JSONの再発明を「巨大なYAML手書き」に置き換えやすい。AWSリソースなら追加料金なし。[料金](https://aws.amazon.com/cloudformation/pricing/) |
| **SST** — TypeScript中心でAWSアプリを構築 | [anomalyco/sst](https://github.com/sst/sst)／MIT。活発。2026-05 v4.15系。[ライセンス](https://github.com/anomalyco/sst/blob/dev/LICENSE) | S3/CloudFrontやアプリ配信を高水準コンポーネントへ置換 | **中** | フルスタック／Lambda中心なら便利だが、静的ファイルだけには抽象化が大きい。内部基盤の変遷も追う必要がある |
| **Serverless Framework** — Lambda中心のAWSサーバーレス構成をYAML化 | [serverless/serverless](https://github.com/serverless/serverless)／リポジトリ部分はMITだが、v4 npm配布物にはプロプライエタリ部分が含まれる。2026年も活発。[v4説明](https://github.com/serverless/serverless) | 主にLambda/APIと付随インフラ | **中** | 静的S3+CloudFrontだけには不向き。CLI認証、ライセンス構成、オートアップデートの複雑さもあり不採用 |
| **Pulumi** — TypeScriptなど通常の言語でマルチクラウドIaC | [pulumi/pulumi](https://github.com/pulumi/pulumi)／Apache-2.0。活発。2026-05 v3.244系。[公式リポジトリ](https://github.com/pulumi/pulumi) | CDKと同様にJS/TSで全AWSリソースを管理 | **高** | コードとしては書きやすいが、Pulumi state／Pulumi Cloudまたは自前backendが加わる。個人静的サイトにはCDKより一段重い |

### 第一推奨：AWS CDK

このケースでは **CDK + TypeScriptの単一Stack** が最も妥当。

理由は次の通り。

- 既存のNode.js環境をそのまま利用できる
- S3・CloudFront・IAM間のARN参照を手書きプレースホルダーから除去できる
- stateサービスを追加せず、CloudFormationに一任できる
- `cdk diff` で変更前に確認できる
- AWSを学ぶという目的を維持できる

概念的には次の構成にする。

```text
infra/
├── bin/app.ts
├── lib/kakera-stack.ts
├── cdk.json
├── package.json
└── test/kakera-stack.test.ts
```

Stackに含めるもの：

1. 非公開S3バケット
2. CloudFront Origin Access Control
3. Distribution
4. ResponseHeadersPolicy
5. GitHub OIDC Provider
6. mainブランチまたはGitHub Environmentに限定したIAM Role
7. S3同期とCloudFront invalidationだけを許す最小権限
8. バケット名・Distribution ID・Role ARNのOutputs

なお、現在の信頼ポリシーにある古い形式の `sub` は、GitHubのimmutable subject claim対応状況も確認した方がよい。`configure-aws-credentials` の最新版ドキュメントでは、2026-07-15以降に作成されたリポジトリについて、組織ID・リポジトリIDを含む形式も説明されている。[公式OIDC例](https://github.com/aws-actions/configure-aws-credentials/blob/main/README.md)

---

## C-2. S3 + CloudFrontは最適か

### 比較

| 名前／一行説明 | 無料枠・独自ドメイン・HTTPS | 日本からの速度／学習効果 | リポジトリ・ライセンス・活動 | 採用コスト／注意点 |
|---|---|---|---|---|
| **S3 + CloudFront** — AWSのオブジェクトストレージ＋CDN | CloudFrontに月額0 USDの定額Freeプランが登場。100GB転送、100万リクエスト、S3 5GB相当を含む。独自ドメイン、ACM HTTPS可。[料金](https://aws.amazon.com/cloudfront/pricing/) | 日本エッジ配信で高速を期待できる。IAM、OAC、DNS、TLS、CDN、キャッシュを深く学べる | SaaSのため単一OSS repoなし。CloudFormation/CDKなど周辺はOSS | **高**。AWS学習なら維持。それ以外では管理項目が多い |
| **Cloudflare Pages** — Git連携型静的ホスティング | Freeで月500 builds、1サイト20,000 files、1プロジェクト100 custom domains。HTTPSあり。[制限](https://developers.cloudflare.com/pages/platform/limits/)、[独自ドメイン](https://developers.cloudflare.com/pages/configuration/custom-domains/) | 東京・大阪拠点を持つため日本向けも有力。ただし実サイトのRUM比較が最終判断。Git/CDN/DNSは学べるがAWS学習にはならない | プラットフォーム本体はサービスで、対応する単一OSS repo／OSSライセンスなし | **低**。apexドメイン利用時はCloudflare nameserverへの移管が必要 |
| **GitHub Pages** — リポジトリから直接公開 | 公開repoなら無料。独自ドメイン・HTTPS対応。サイトサイズや帯域目安など制限あり。[公式制限](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | 通常の個人サイトなら十分。Git/GitHub Actions学習との相性が最高 | サービス。単一の配信基盤repo／OSSライセンスなし | **最低**。高度なヘッダー制御やサーバー処理に弱い。商用SaaS向け無料ホストとしての利用は禁止事項あり |
| **Netlify** — 静的サイト向け統合プラットフォーム | Freeは月300 credits。独自ドメイン＋SSL、CDN、preview対応。[料金](https://www.netlify.com/pricing/) | 日本でもCDN配信。フォーム・redirect・previewを学べる | サービス。プラットフォーム全体のOSS repo／OSSライセンスなし | **低**。2025年以降のcredit制では、上限到達時にアカウント内サイトが停止する点に注意 |
| **Vercel** — フロントエンド向け統合デプロイ | Hobbyは個人・非商用向け無料。独自ドメイン、HTTPS、100GB Fast Data Transfer、previewあり。[Hobby](https://vercel.com/docs/plans/hobby)、[制限](https://vercel.com/docs/limits) | グローバルedgeで高速を期待。Next.jsなら特に学習価値が高い | サービス。配信基盤自体のOSS repo／OSSライセンスなし | **低**。素の静的HTMLには機能過多。Hobbyの用途制約と上限超過時停止に注意 |
| **Deno Deploy** — Deno/Node対応edge実行＋静的配信 | Free tier、独自ドメイン、自動TLSあり。[ドメイン](https://docs.deno.com/deploy/reference/domains/)、[利用ガイド](https://docs.deno.com/deploy/usage/) | 新Deployは現時点でUS/EUの2実行リージョン。CDNキャッシュはあるが、日本向け動的処理では他候補より不利になり得る。[新旧比較](https://docs.deno.com/deploy/) | Deno runtimeはMITだがDeployはサービスであり、サービス全体のOSS repoなし | **低〜中**。Deploy Classicは2026-07-20終了済み。現在は移行直後で、静的サイト一つに選ぶ理由が弱い |

### 判断

#### 公開だけが目的

**Cloudflare Pagesを第一推奨**する。

- AWSリソース・IAM・invalidationの管理が消える
- 独自ドメイン、HTTPS、preview、CDNが無料範囲
- `_headers` でCSPなどを管理できる
- 現在の規模ならFree制限に十分収まる

#### AWSを学ぶことが目的

**S3 + CloudFrontを継続し、CDK化**する。

現在の構成はOAC、CSP、OIDC、最小権限まで触れており、AWS学習課題として価値がある。CloudFrontの新しい月額0ドル定額プランに適合できるなら、予期しない従量課金への不安も以前より小さくできる。

#### 速度について

公開ベンチマークだけで順位を断定すべきではない。日本からの体感は次の要因に左右される。

- HTMLがキャッシュされるか
- 初回TLS接続
- ファイル数と画像サイズ
- キャッシュTTL
- 利用ISPとCDNのピアリング

最終的には東京・大阪の計測点または実ユーザーRUMで比較する。静的サイトなら、ホスト間の差より未最適化PNGやフォント243ファイルの影響の方が大きい可能性が高い。

---

## C-3. GitHub Actionsと定番ワークフロー

### 採用するAction

| 名前／一行説明 | リポジトリ／ライセンス／活動 | 置き換えるもの | 採用コスト／注意点 |
|---|---|---|---|
| **configure-aws-credentials** — GitHub OIDCでAWS短期資格情報を取得 | [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)／MIT。非常に活発。2026-07 v6.2.3。[リリース](https://github.com/aws-actions/configure-aws-credentials/releases) | 長期Access Keyや手製STS処理 | **低**。`id-token: write`、厳格なtrust policyが必要 |
| **AWS CLI** — S3同期とCloudFront invalidationを公式CLIで実行 | CLI v2はApache-2.0。GitHub-hosted Ubuntu runnerに通常導入済み | 信頼性不明の第三者S3 deploy Action | **低**。`--delete`の対象バケット・build directoryを間違えないこと |
| **actions/checkout** — ソース取得 | [actions/checkout](https://github.com/actions/checkout)／MIT、活発 | 手動clone | **低**。major tagよりcommit SHA固定の方がサプライチェーン上は強い |

S3同期やInvalidationには、権限の広い第三者Actionを増やすより、認証だけAWS公式Actionに任せ、その後はAWS CLIを使う方が透明である。

### 推奨ワークフロー

```yaml
name: Deploy static site

on:
  push:
    branches: [main]
    paths:
      - "02.homework/05.week5/web/**"
      - ".github/workflows/deploy.yml"
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

concurrency:
  group: kakera-production
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: 02.homework/05.week5/web
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: 02.homework/05.week5/web/package-lock.json

      - run: npm ci
      - run: npm run build
      - run: npm run check

  deploy:
    needs: quality
    runs-on: ubuntu-latest
    environment: production
    defaults:
      run:
        working-directory: 02.homework/05.week5/web

    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: 02.homework/05.week5/web/package-lock.json

      - run: npm ci
      - run: npm run build

      - uses: aws-actions/configure-aws-credentials@v6.2.3
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ap-northeast-1
          allowed-account-ids: ${{ vars.AWS_ACCOUNT_ID }}
          role-session-name: gha-${{ github.run_id }}

      - name: Upload hashed assets
        run: >
          aws s3 sync dist/assets/ s3://${{ vars.S3_BUCKET }}/assets/
          --delete
          --cache-control "public,max-age=31536000,immutable"

      - name: Upload HTML and mutable files
        run: >
          aws s3 sync dist/ s3://${{ vars.S3_BUCKET }}/
          --delete
          --exclude "assets/*"
          --cache-control "public,max-age=0,must-revalidate"

      - name: Invalidate CloudFront
        run: |
          invalidation_id="$(
            aws cloudfront create-invalidation \
              --distribution-id "${{ vars.CLOUDFRONT_DISTRIBUTION_ID }}" \
              --paths "/*" \
              --query 'Invalidation.Id' \
              --output text
          )"
          aws cloudfront wait invalidation-completed \
            --distribution-id "${{ vars.CLOUDFRONT_DISTRIBUTION_ID }}" \
            --id "$invalidation_id"
```

改善点：

- `environment: production` に承認ルールを付けられる
- long-lived AWS keyを保存しない
- quality失敗時はdeployしない
- assetだけ長期cache
- mainへの連続pushは古いrunをキャンセル
- `allowed-account-ids` で誤アカウントを検知
- deploy完了前にworkflowを成功扱いしない

本番ではActionをmajor tagではなく、Dependabotで更新する完全なcommit SHAへ固定するとさらに安全。

---

## C-4. デプロイ品質チェックOSS

| 名前／一行説明 | リポジトリ／ライセンス／活動 | 置き換えるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **HTML-Validate** — オフラインHTML構文・セマンティクス検査 | [html-validate/html-validate](https://github.com/html-validate/html-validate)／MIT。活発。2026-07 v11.6.0。[タグ](https://gitlab.com/html-validate/html-validate/-/tags) | 手作業での閉じタグ、属性、見出し等の確認 | **低** | 厳格ルールを一度に有効化すると既存HTMLの修正量が多い |
| **lychee** — HTML/Markdown内リンク切れ検査 | [lycheeverse/lychee](https://github.com/lycheeverse/lychee)／Apache-2.0。活発、2026-07にも更新。安定版は0.21系が目安。[公式組織](https://github.com/lycheeverse) | 公開後に手でリンクを巡回 | **低** | 外部サイトの429/403で偽陽性が出る。除外・retry設定が必要 |
| **pa11y-ci** — URLやsitemapを巡回するa11y CI | [pa11y/pa11y-ci](https://github.com/pa11y/pa11y-ci)／LGPL-3.0。活発。v4.0.1、2026年も更新あり。[リリース](https://github.com/pa11y/pa11y-ci/releases) | 手動アクセシビリティチェック | **中** | Chromium/Puppeteerの起動分だけCIが重い。自動検査で全a11y問題は見つからない |
| **Lighthouse CI** — 性能・SEO・a11y・best practicesの回帰検査 | [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci)／Apache-2.0。保守中、0.15.1系。[公式リポジトリ](https://github.com/GoogleChrome/lighthouse-ci) | DevToolsでの手動Lighthouse実行 | **中** | 性能値は揺れる。最初から100点必須にせず、回帰防止の緩いbudgetにする |
| **Unlighthouse** — サイト全体をLighthouse巡回 | [harlan-zw/unlighthouse](https://github.com/harlan-zw/unlighthouse)／MIT。活発。2026-06 v0.18.0。[リリース](https://github.com/harlan-zw/unlighthouse/releases) | 複数記事を1ページずつ監査 | **中** | Node 22.18以上。小サイトの毎PRではLighthouse CIと重複しやすい。定期・手元監査向け |
| **axe-core** — Web UIへ組み込めるa11y検査エンジン | [dequelabs/axe-core](https://github.com/dequelabs/axe-core)／MPL-2.0。活発。2026-06 v4.12.1。[リリース](https://github.com/dequelabs/axe-core/releases) | 独自a11y判定 | **中** | ライブラリなので単独CIよりPlaywright等との統合向け。pa11y-ciも内部でaxeを利用可能 |

### 個人サイト向けの最小構成

最初は次の3つで十分。

```json
{
  "scripts": {
    "check:html": "html-validate \"dist/**/*.html\"",
    "check:links": "lychee \"dist/**/*.html\" \"**/*.md\"",
    "check:a11y": "pa11y-ci",
    "check": "npm run check:html && npm run check:links"
  }
}
```

- **毎push**：HTML-Validate
- **毎PRまたは週次**：lychee
- **mainまたは週次**：pa11y-ci
- **性能改善期間だけ**：Lighthouse CI／Unlighthouse

Lighthouse、Unlighthouse、pa11y-ci、axe-coreをすべて同時に毎pushへ入れる必要はない。ブラウザ起動系は一つから始める。

---

# D. 学習ゲーム／学習コンテンツ

## D-1. 自作前に見るべき既存教材

| 名前／一行説明 | リポジトリ／ライセンス／活動 | このケースで置き換わるもの | 採用コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **Learn Git Branching** — コミットグラフを動かすブラウザGit教材 | [pcottle/learnGitBranching](https://github.com/pcottle/learnGitBranching)／MIT。リリース運用なし、保守・翻訳PRは継続しているが最終正式releaseは未確認。[ライセンス](https://github.com/pcottle/learnGitBranching/blob/main/LICENSE.md) | Git Dungeonのbranch、merge、rebase、HEAD可視化 | **最低**。公開版を使うだけならゼロ | 100% client-sideで静的配信可能。ただしRPG世界観や日本語固有ストーリーは置換しない |
| **Oh My Git!** — 実Gitを操作するGodot製学習ゲーム | [git-learning-game/oh-my-git](https://github.com/git-learning-game/oh-my-git)／Blue Oak Model License 1.0.0。公式に低メンテナンスモード。2025末に状態説明更新、正式release時期は未確認 | Git Dungeonの実Git状態・レベル判定・カードUI | **高**。Godot 3が必要 | ブラウザ静的JSへ直接流用しにくい。非主流ライセンス。新規基盤にはしない |
| **Oh My Git! 2** — v86を使ったブラウザ版プロトタイプ | [git-learning-game/oh-my-git-2](https://github.com/git-learning-game/oh-my-git-2)／Blue Oak Model License 1.0.0。227 commitsだが正式releaseなし | ブラウザ内Linux VM＋本物のGitという設計参考 | **高** | プロトタイプ。v86イメージが重い。ただし自作ゲームの次段階を考える参考実装として非常に重要 |
| **git-sim** — 実repo上のGit操作結果を画像・動画で事前可視化 | [initialcommit-com/git-sim](https://github.com/initialcommit-com/git-sim)／GPL-2.0。正式GitHub releaseなし、活動は限定的 | Git操作説明用の図を自作する部分 | **中〜高**。Python＋Manim | ブラウザ教材ではなくローカル生成ツール。ゲーム本体への組込みには不適 |
| **Bashcrawl** — 実ファイルをcdしながら進むPOSIXシェル教材 | [slackermedia/bashcrawl](https://gitlab.com/slackermedia/bashcrawl)／GPL-3.0-only。[ライセンス](https://gitlab.com/slackermedia/bashcrawl/-/blob/master/LICENSE)。2026年にもcommit、最終安定版2024-02 | Linux Story Questの「物語＋ファイル探索」部分 | **低** | ローカルターミナル前提。派手なUIはないが、本物のコマンドを使う点で学習効果が高い |
| **OverTheWire Bandit** — SSH上の実Linuxを攻略する初学者向けwargame | 公式の公開ソースrepoなし。**OSSではない**。公式規約はAll rights reserved・再配布禁止。サービスは2026年も稼働。[Bandit](https://overthewire.org/wargames/bandit/)、[規約](https://overthewire.org/rules/) | Linux Story Quest修了後の実践問題 | **低**。無料利用 | 内容や認証情報をコピー・再配布してはいけない。リンクして学習導線に使う |
| **tldr-pages** — 実用例中心の短いmanページ集 | [tldr-pages/tldr](https://github.com/tldr-pages/tldr)／本文CC-BY-4.0、scriptsはMIT。[ライセンス](https://github.com/tldr-pages/tldr/blob/main/LICENSE.md)。非常に活発、仕様v2.3、assetsは2026-07更新 | 自作commandBookの説明文・使用例の大部分 | **低** | 内容を取り込む場合はCC-BYの帰属表示が必要。日本語ページの網羅率は英語より低い |
| **explainshell** — シェルコマンドをAST解析し、引数ごとにman説明を対応付け | [idank/explainshell](https://github.com/idank/explainshell)／コードGPL-3.0、manpage DBは各上流ライセンス。2026年のUbuntu/Arch対応作業あり、正式releaseなし。[ライセンス説明](https://github.com/idank/explainshell/blob/master/README.md) | 自作パーサの説明機能、コマンド分解表示 | **高** | Python/DB/サーバーが必要。静的ホスティング不可。DB再配布は個別ライセンス確認が必要 |
| **Killercoda** — ブラウザ内で実Linux/Kubernetes演習を提供 | 実行基盤はホステッドサービスで、OSSとしてのrepo／ライセンスは確認できない。シナリオ例は [killercoda/scenario-examples](https://github.com/killercoda/scenario-examples) だがライセンス表記未確認。2026-04更新。[公式説明](https://killercoda.com/about) | Linux Story Questを実VM演習へ変換 | **中**。creatorは無料 | 静的ホスティング不可、外部サービス依存。シナリオrepoに明示ライセンスを付ける必要がある |
| **Katacoda** — 旧ブラウザ実習サービス | 公開サービス終了。後継候補はKillercoda | なし | — | 新規採用不可 |

### 第一推奨

Gitは **Learn Git Branching**、Linuxは **Bashcrawl → Bandit** が最初。

Git Dungeonは、Learn Git Branchingと重なる `branch/merge/HEAD` の正確な状態モデルを再発明している。一方、ダンジョン移動・敵・日本語の物語は独自価値がある。したがって、Gitの正確な理解には既存教材を使い、自作側は「復習ゲーム」「日本語の物語」「初学者が怖がらず入力できるUI」に役割を絞るのがよい。

---

## D-2. 学習ゲームを作るためのエンジン／実行基盤

| 名前／一行説明 | repo／ライセンス／活動 | ブラウザ完結・静的配信 | 置き換えるもの | 採用コスト／注意点 |
|---|---|---|---|---|
| **Twine** — 分岐物語をノードで編集して単一HTMLへ出力 | [klembot/twinejs](https://github.com/klembot/twinejs)／GPL-3.0。活発。2026-04 v2.12.0 | **可**。出力HTMLをそのまま配信 | ストーリー分岐、章管理、セーブ | **低**。Linux/Git状態モデルやマップ移動には弱い |
| **Ink + inkjs** — テキスト主体の分岐物語DSL＋JS runtime | [inkle/ink](https://github.com/inkle/ink)／MIT、2026-05 v1.2.1。ブラウザ側は [y-lohse/inkjs](https://github.com/y-lohse/inkjs)、MIT、v2.4.0 | **可**。inkjsはzero dependencyでブラウザ対応 | `stageSeed`の長い配列、会話・選択肢・条件分岐 | **低〜中**。マップやコマンド処理は別実装 |
| **Phaser** — 成熟したHTML5 2Dゲームエンジン | [phaserjs/phaser](https://github.com/phaserjs/phaser)／MIT。活発。2026-07 v4.2.1。[リリース](https://github.com/phaserjs/phaser/releases) | **可** | Git Dungeonのマップ、衝突、入力、scene、animation | **中〜高** | 現在の小規模DOMゲームには過剰。v4は新rendererへの移行直後 |
| **KAPLAY** — Kaboom.js後継の軽量JSゲームライブラリ | [kaplayjs/kaplay](https://github.com/kaplayjs/kaplay)／MIT。活発。2026-08にも更新。安定3001系は2025-06、次期4000系は2026-05 alpha | **可** | マップ、sprite、衝突、scene、keyboard入力 | **中** | Phaserより軽いが、最新系がalpha。安定版を固定する必要がある |
| **Ren’Py** — visual novel向けPythonエンジン | [renpy/renpy](https://github.com/renpy/renpy)／主にMIT。活発。2026-05 v8.5.3。[リリース](https://github.com/renpy/renpy/releases) | **可**。Web buildあり | 会話、背景、分岐、セーブ、翻訳 | **高** | 大きなruntime、Python系ツールチェーン。現在のHTML/JS前提から外れる |
| **xterm.js** — ブラウザ内ターミナル表示・入力UI | [xtermjs/xterm.js](https://github.com/xtermjs/xterm.js)／MIT。非常に活発、2026-08にもcommit。stable 6.0.0。[公式リポジトリ](https://github.com/xtermjs/xterm.js/) | **可** | 手製の入力欄、履歴表示、ANSI描画、IME/CJK、選択、スクロール | **低〜中** | **bashやLinuxそのものではない**。現在のパーサ、v86、WebSocket backendのいずれかが別途必要 |
| **WebContainer API** — ブラウザ内Node.js実行環境 | issue/docs repoは [stackblitz/webcontainer-core](https://github.com/stackblitz/webcontainer-core)／MITだが、runtime本体を完全なOSSとして再配布できるものではない。2026年も活動 | フロントは静的配信可能だがAPIサービス・利用条件に依存 | Node/npm、ファイルシステム、shell風演習 | **高** | LinuxではなくNode環境。商用productionは契約が必要。[商用条件](https://webcontainers.io/enterprise)。個人OSS利用も条件確認が必要 |
| **v86** — WASMでx86 PC/Linuxをブラウザ内実行 | [copy/v86](https://github.com/copy/v86)／BSD-2-Clause。活発。2026-05 latest build、2026年も継続更新。[リリース](https://github.com/copy/v86/releases) | **可**。ただしROM／Linux imageも配信 | 手製Linuxコマンドパーサを本物のLinuxへ置換 | **非常に高** | 数十MB級image、起動時間、モバイル負荷、永続化、OSイメージのライセンス管理が必要 |
| **js-dos** — DOSBox/DOSBox-Xをブラウザで実行 | [caiiiycuk/js-dos](https://github.com/caiiiycuk/js-dos)／npmではGPL-2.0表記、構成部品ごとのライセンス確認が必要。活発。2026-07 v8.4.1。[リリース](https://github.com/caiiiycuk/js-dos/releases/) | **可**。backend不要、静的ホスト可。[公式手順](https://js-dos.com/dos-api.html) | DOS教材・レトロゲーム実行 | **高** | Linux/Git教材には不適。DOSバイナリやゲームデータの著作権確認が必要 |

### 第一推奨：xterm.js

現在のLinux Story Questには、まず **xterm.jsだけを導入**するのが最も投資対効果が高い。

- 日本語IME、ANSI表示、カーソル、履歴、選択、スクロールを自作しなくてよくなる
- 現在の仮想FS・安全なコマンド判定・クエスト進行はそのまま使える
- 静的ホスティングを維持できる
- v86ほど重くない

その後、「本物のコマンドを実行すること」が学習目標になった段階で、別モードとしてv86を検討する。最初からv86へ移すと、教材設計よりVMのboot、image、永続化、ブラウザ互換に時間を取られる。

Git Dungeonのマップを拡張するなら **KAPLAY安定版**、文章分岐を増やすなら **Ink + inkjs** が適する。PhaserやRen’Pyは現状の規模には過剰。

---

## D-3. 学習記録・ポートフォリオの土台

| 名前／一行説明 | repo／ライセンス／活動 | 置き換えるもの | 採用コスト／注意点 |
|---|---|---|---|---|
| **TIL repository方式** — `topic/YYYY-MM-DD-title.md`等で短い学びをcommit | ソフトウェア依存なし。参考実装：[simonw/til](https://github.com/simonw/til)／Apache-2.0、2026年も記事追加 | HTML記事、indexカードの手更新、成果物コピー運用 | **最低** | デザイン、検索、RSSは別途generatorが必要。まず記録習慣を作る方式 |
| **Quartz 5** — Markdownを検索・タグ・backlink・graph付き静的サイトへ変換 | [jackyzha0/quartz](https://github.com/jackyzha0/quartz)／MIT。非常に活発。v5 branchは2026年も連日更新。[v5ガイド](https://github.com/jackyzha0/quartz/blob/v5/docs/getting-started/index.md) | 1ページずつのHTML、index手更新、検索、タグ、RSS、TOC、コードハイライト、sitemap | **中** | engineとcontentが同じrepoへ入りやすく、upstream更新時の衝突に注意。v5は新しく変化も速い |
| **Foam** — VS Code内でMarkdownリンク・backlink・graphを管理 | [foambubble/foam](https://github.com/foambubble/foam)／MIT。活発。2026-05 vscode@0.40.4、2026-08も更新。[公式リポジトリ](https://github.com/foambubble/foam) | Markdown執筆、相互リンク、graph | **低〜中** | 公式自身がalpha-gradeへの許容を要件に挙げる。公開サイト生成はQuartz等と組み合わせる |
| **Logseq + publish-spa** — アウトライナー型ノートを静的SPA公開 | [logseq/logseq](https://github.com/logseq/logseq)／AGPL-3.0。活発だが新DB版はbeta、mobile/RTCはalpha。[公開Action](https://github.com/logseq/publish-spa)はMIT | 日誌、双方向リンク、公開graph | **高** | file graph向けpublishは残るがDB graph対応は保留。移行期なので今このサイトの土台にするのはリスクがある |
| **Digital Gardeners一覧** — デジタルガーデン設計・ツール集 | [MaggieAppleton/digital-gardeners](https://github.com/MaggieAppleton/digital-gardeners)／リポジトリ上で明示ライセンス未確認。releaseなし、更新状況未確認 | ツール選定・思想の参考 | **低** | 実装ではなくリンク集。ライセンス未確認なので内容のコピーは避ける |

### 第一推奨：Quartz 5

学習全体の公開基盤としてはQuartzが最も合う。

- Markdownを1枚追加すれば一覧・タグ・リンクが生成される
- RSS、sitemap、検索、TOC、コード表示を土台側へ任せられる
- Cloudflare Pages、GitHub Pages、Netlify、Vercelへ静的配信できる
- Node.js 22という現状に一致する
- frontmatterに `date / tags / draft / description / permalink` を持てる

既存のヴィクトリア朝テーマを完全移植する作業は必要になるため、最初は内容だけMarkdownへ移し、CSS移植は第二段階とする。

成果物はコピーせず、次のどちらかにする。

```text
content/
├── til/
├── articles/
└── works/
    ├── linux-story-quest.md   # 説明、スクリーンショット、公開URL
    └── git-dungeon.md
```

- ゲーム本体は各 homework/build の公開URLへリンク
- あるいはmonorepo buildで成果物をQuartzの出力先へ機械的にコピー
- `works/` へソースを手動コピーしない

---

# 自作を続けた方がよい領域

次はライブラリへ置き換えすぎない方がよい。

## 維持する価値が高い

- 日本語の教材文
- 初学者がつまずく順番を反映したステージ設計
- 「なぜそのコマンドを使うか」という物語
- Linux Story Questの安全な仮想FS
- Git DungeonのRPG世界観
- クエスト成功条件
- ヒントの段階的な出し方
- 学習データの小さなJSON形式

これらは製品の独自価値であり、コード量を減らすために汎用ゲームエンジンへ渡しても学習効果は上がらない。

## 置き換えるべき

- ターミナルの描画・IME・ANSI処理 → xterm.js
- Gitグラフ教材の基本部分 → Learn Git Branchingを参照
- コマンド説明文の網羅 → tldrを参照・帰属
- 分岐物語の管理 → Ink
- 複雑な2D衝突・scene管理 → KAPLAY
- HTML・リンク・a11y検査 →既存CIツール
- AWSリソース間のARN・policy組み立て → CDK
- 学習記事のHTML、一覧、RSS、タグ → Quartz

---

# 個人学習者が最初に入れるべき順

- [ ] **1. `html-validate`を導入する** — 数分で構文事故を防げ、CI負担も小さい
- [ ] **2. `lychee`を週次またはPRに入れる** — 学習記事・作品リンクの腐敗を検出する
- [ ] **3. AWS継続なら`aws-actions/configure-aws-credentials`＋OIDCを確立する** — 長期鍵を完全に排除する
- [ ] **4. インフラをAWS CDKの単一Stackへ移す** — 4つの手書きJSONとプレースホルダーを廃止する
- [ ] **5. 静的公開だけが目的ならCloudflare Pagesへ移す** — AWS学習が目的なら移さずCDKを続ける
- [ ] **6. 学習記録をMarkdownのTIL形式へ変更する** — 記録単位を小さくし、HTML手編集を止める
- [ ] **7. Quartz 5を公開基盤にする** — 一覧、タグ、検索、RSS、TOC、コード表示をまとめて取得する
- [ ] **8. Git学習はLearn Git Branchingを一通り終えてから自作を拡張する**
- [ ] **9. Linux学習はBashcrawl→Banditを体験し、自作側に不足する課題だけ追加する**
- [ ] **10. Linux Story Questへxterm.jsを導入する** — 仮想FSと教材ロジックは残し、端末UIの再発明だけ止める

最初からLighthouse CI、Unlighthouse、Phaser、v86、WebContainersまで全部入れるのは逆効果である。最初の一巡は「HTML検証、リンク検査、安全なAWS認証、IaC、Markdown化」までで十分。