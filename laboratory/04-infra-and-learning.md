# 04. インフラ / デプロイ と 学習コンテンツ

対象: `02.homework/05.week5/infra`、`02.homework/01.week1`（Linux Story Quest / Git Dungeon）
調査: codex + web search（2026-08-25 実施）

---

## 結論

| 目的 | 推奨 |
|---|---|
| **AWS を学ぶことが目的なら** | **AWS CDK**（S3+CloudFront は継続） |
| **単に個人サイトを安く公開したいなら** | **Cloudflare Pages** |
| **Git 教材** | **Learn Git Branching を先に一通りやる** |
| **Linux 教材** | **Bashcrawl → OverTheWire Bandit** |
| **自作ゲームを続けるなら** | **xterm.js だけ導入し、教材ロジックは自作を維持** |

---

# C. インフラ / デプロイ

## C-1. 生 JSON 手書きを置き換える IaC

| 名前 | リポジトリ / ライセンス / 活動 | 置き換わるもの | コスト | 注意点・不採用理由 |
|---|---|---|---|---|
| **AWS CDK** | [aws/aws-cdk](https://github.com/aws/aws-cdk) · Apache-2.0 · 活発 · **v2.262 系（2026-07 頃）** | S3、OAC、CloudFront、レスポンスヘッダポリシー、IAM OIDC ロール、バケットポリシーを**1 つの Stack へ集約** | **中** | AWS 専用（このケースではむしろ利点）。生成される CloudFormation が長く、抽象化の下を理解しにくい場面はある |
| **OpenTofu** | [opentofu/opentofu](https://github.com/opentofu/opentofu) · MPL-2.0 · 活発 · **v1.12.1 前後（2026-05）** | 4 つの JSON と AWS リソース全体。plan で差分確認 | 中〜高 | HCL、state、provider lock、state 保存先が増える。**静的サイト一つには state 管理が過剰** |
| **Terraform** | [hashicorp/terraform](https://github.com/hashicorp/terraform) · **v1.6 以降 BUSL-1.1**（4年後 MPL-2.0） · **v1.15.4（2026-05）** | OpenTofu と同じ | 中〜高 | **厳密には現在の新バージョンは OSI 型 OSS ではない。OSS 重視なら OpenTofu を優先** |
| **CloudFormation** | AWS サービス本体 · テンプレート例は Apache-2.0 | JSON 断片を 1 つの YAML へ統合 | 中 | AWS の仕組みを最も直接学べるが記述量が多い。**「生 JSON の再発明」を「巨大な YAML 手書き」に置き換えやすい**。追加料金なし |
| **SST** | [sst/sst](https://github.com/sst/sst) · MIT · 活発 · **v4.15 系（2026-05）** | S3/CloudFront やアプリ配信を高水準コンポーネントへ | 中 | フルスタック／Lambda 中心なら便利。**静的ファイルだけには抽象化が大きい** |
| **Serverless Framework** | [serverless/serverless](https://github.com/serverless/serverless) · リポジトリは MIT だが **v4 npm 配布物にプロプライエタリ部分を含む** · 2026 活発 | 主に Lambda/API | 中 | **静的 S3+CloudFront だけには不向き。不採用** |
| **Pulumi** | [pulumi/pulumi](https://github.com/pulumi/pulumi) · Apache-2.0 · 活発 · **v3.244 系（2026-05）** | CDK と同様に JS/TS で全 AWS リソース | **高** | Pulumi state / Pulumi Cloud または自前 backend が加わる。**個人静的サイトには CDK より一段重い** |

### 第一推奨: AWS CDK の単一 Stack

- 既存の Node.js 環境をそのまま使える
- S3・CloudFront・IAM 間の ARN 参照を**手書きプレースホルダーから除去できる**
  （`<ACCOUNT_ID>` `<DISTRIBUTION_ID>` `<OWNER>` を人間が埋める運用が消える）
- state サービスを追加せず、CloudFormation に一任できる
- `cdk diff` で適用前に確認できる
- **AWS を学ぶという目的を維持できる**

```
infra/
├── bin/app.ts
├── lib/kakera-stack.ts
├── cdk.json
├── package.json
└── test/kakera-stack.test.ts
```

Stack に含めるもの:
1. 非公開 S3 バケット
2. CloudFront Origin Access Control
3. Distribution
4. ResponseHeadersPolicy
5. GitHub OIDC Provider
6. main ブランチまたは GitHub Environment に限定した IAM Role
7. S3 同期と CloudFront invalidation だけを許す最小権限
8. バケット名・Distribution ID・Role ARN の Outputs

> **確認しておくとよい点**: 現在の信頼ポリシーにある `sub` の形式について、GitHub の
> immutable subject claim 対応状況を確認したほうがよい。`configure-aws-credentials` の
> 最新版ドキュメントでは、**2026-07-15 以降に作成されたリポジトリ**について
> 組織 ID・リポジトリ ID を含む形式も説明されている。

---

## C-2. そもそも S3 + CloudFront が最適か

| 名前 | 無料枠・独自ドメイン・HTTPS | 日本からの速度 / 学習効果 | コスト・注意点 |
|---|---|---|---|
| **S3 + CloudFront** | **CloudFront に月額 0 USD の定額 Free プランが登場**。100GB 転送、100万リクエスト、S3 5GB 相当を含む。独自ドメイン、ACM HTTPS 可 | 日本エッジ配信で高速。**IAM、OAC、DNS、TLS、CDN、キャッシュを深く学べる** | **高**。AWS 学習なら維持。それ以外では管理項目が多い |
| **Cloudflare Pages** | Free で月 500 builds、1サイト 20,000 files、1プロジェクト 100 custom domains。HTTPS あり | 東京・大阪拠点あり。Git/CDN/DNS は学べるが **AWS 学習にはならない** | **低**。apex ドメイン利用時は **Cloudflare ネームサーバーへの移管が必要** |
| **GitHub Pages** | 公開 repo なら無料。独自ドメイン・HTTPS 対応 | 個人サイトなら十分。**Git/GitHub Actions 学習との相性が最高** | **最低**。高度なヘッダー制御やサーバー処理に弱い。商用 SaaS 向け無料ホストとしての利用は禁止事項あり |
| **Netlify** | Free は**月 300 credits**。独自ドメイン＋SSL、CDN、preview | フォーム・redirect・preview を学べる | 低。**2025 年以降の credit 制では、上限到達時にアカウント内サイトが停止する** |
| **Vercel** | Hobby は個人・非商用向け無料。100GB Fast Data Transfer、preview | グローバル edge。Next.js なら特に学習価値 | 低。**素の静的 HTML には機能過多**。Hobby の用途制約と上限超過時停止に注意 |
| **Deno Deploy** | Free tier、独自ドメイン、自動 TLS | **新 Deploy は現時点で US/EU の 2 実行リージョン**。日本向け動的処理では不利になり得る | 低〜中。**Deploy Classic は 2026-07-20 終了済み**。移行直後で静的サイト一つに選ぶ理由が弱い |

### 判断

**公開だけが目的なら → Cloudflare Pages**
AWS リソース・IAM・invalidation の管理が消え、独自ドメイン・HTTPS・preview・CDN が無料範囲。
`_headers` で CSP なども管理できる。現在の規模なら Free 制限に十分収まる。

**AWS を学ぶことが目的なら → S3 + CloudFront を継続し、CDK 化**
現在の構成は OAC、CSP、OIDC、最小権限まで触れており、**AWS 学習課題として価値がある**。
CloudFront の新しい月額 0 ドル定額プランに適合できるなら、予期しない従量課金への不安も
以前より小さくできる。

> **速度について**: 公開ベンチマークだけで順位を断定すべきではない。日本からの体感は
> HTML がキャッシュされるか / 初回 TLS 接続 / ファイル数と画像サイズ / キャッシュ TTL /
> ISP と CDN のピアリング に左右される。
> **静的サイトなら、ホスト間の差より「未最適化 PNG 69MB」やフォント 243 ファイルの影響の
> ほうが大きい可能性が高い。**（→ 01 章・03 章）

---

## C-3. GitHub Actions の定番ワークフロー

| 名前 | リポジトリ / ライセンス / 活動 | 置き換えるもの | 注意点 |
|---|---|---|---|
| **configure-aws-credentials** | [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) · MIT · 非常に活発 · **v6.2.3（2026-07）** | 長期 Access Key や手製 STS 処理 | 低。`id-token: write` と厳格な trust policy が必要 |
| **AWS CLI** | CLI v2 は Apache-2.0 · runner に通常導入済み | **信頼性不明の第三者 S3 deploy Action** | 低。`--delete` の対象バケット・build directory を間違えないこと |
| **actions/checkout** | [actions/checkout](https://github.com/actions/checkout) · MIT · 活発 | 手動 clone | 低。**major tag より commit SHA 固定のほうがサプライチェーン上は強い** |

> S3 同期や invalidation には、権限の広い第三者 Action を増やすより、
> **認証だけ AWS 公式 Action に任せ、その後は AWS CLI を使う**ほうが透明。

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

このワークフローの改善点:

- `environment: production` に承認ルールを付けられる
- long-lived AWS key を保存しない
- **quality 失敗時は deploy しない**
- **asset だけ長期 cache、HTML は must-revalidate**（現状は全ファイル一律になりがち）
- main への連続 push は古い run をキャンセル
- `allowed-account-ids` で誤アカウントを検知
- **deploy 完了前に workflow を成功扱いしない**（invalidation の完了を待つ）

> 本番では Action を major tag ではなく、Dependabot で更新する**完全な commit SHA へ固定**すると
> さらに安全。

---

## C-4. デプロイ品質チェック OSS

| 名前 | リポジトリ / ライセンス / 活動 | 置き換えるもの | コスト | 注意点 |
|---|---|---|---|---|
| **HTML-Validate** | [html-validate/html-validate](https://github.com/html-validate/html-validate) · MIT · 活発 · **v11.6.0（2026-07）** | 手作業での閉じタグ・属性・見出しの確認 | **低** | 厳格ルールを一度に有効化すると既存 HTML の修正量が多い |
| **lychee** | [lycheeverse/lychee](https://github.com/lycheeverse/lychee) · Apache-2.0 · 活発（2026-07 更新） · 安定版 0.21 系 | 公開後に手でリンクを巡回 | **低** | 外部サイトの 429/403 で偽陽性。除外・retry 設定が必要 |
| **pa11y-ci** | [pa11y/pa11y-ci](https://github.com/pa11y/pa11y-ci) · **LGPL-3.0** · **v4.0.1（2026 更新あり）** | 手動アクセシビリティチェック | 中 | Chromium/Puppeteer 起動分 CI が重い。**自動検査で全 a11y 問題は見つからない** |
| **Lighthouse CI** | [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci) · Apache-2.0 · 保守中 · 0.15.1 系 | DevTools での手動 Lighthouse | 中 | **性能値は揺れる**。最初から 100 点必須にせず、回帰防止の緩い budget にする |
| **Unlighthouse** | [harlan-zw/unlighthouse](https://github.com/harlan-zw/unlighthouse) · MIT · 活発 · **v0.18.0（2026-06）** | 複数記事を 1 ページずつ監査 | 中 | Node 22.18 以上。**小サイトの毎 PR では Lighthouse CI と重複しやすい**。定期・手元監査向け |
| **axe-core** | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) · MPL-2.0 · 活発 · **v4.12.1（2026-06）** | 独自 a11y 判定 | 中 | ライブラリなので単独 CI より Playwright 等との統合向け |

### 個人サイト向けの最小構成

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

- **毎 push** → HTML-Validate
- **毎 PR または週次** → lychee
- **main または週次** → pa11y-ci
- **性能改善期間だけ** → Lighthouse CI / Unlighthouse

> Lighthouse、Unlighthouse、pa11y-ci、axe-core を**すべて同時に毎 push へ入れるのは逆効果**。
> ブラウザ起動系は一つから始める。

---

# D. 学習ゲーム / 学習コンテンツ

## D-1. 自作する前に見るべきだった既存教材

| 名前 | リポジトリ / ライセンス / 活動 | 置き換わるもの | コスト | 注意点 |
|---|---|---|---|---|
| **Learn Git Branching** | [pcottle/learnGitBranching](https://github.com/pcottle/learnGitBranching) · **MIT** · 保守・翻訳 PR は継続（正式 release は未確認） | Git Dungeon の branch / merge / rebase / HEAD 可視化 | **最低**（使うだけならゼロ） | 100% client-side で静的配信可能。**日本語対応あり**。RPG 世界観や日本語固有ストーリーは置換しない |
| **Bashcrawl** | [slackermedia/bashcrawl](https://gitlab.com/slackermedia/bashcrawl) · **GPL-3.0-only** · 2026 にも commit（最終安定 2024-02） | Linux Story Quest の「物語＋ファイル探索」部分 | **低** | ローカルターミナル前提。派手な UI はないが**本物のコマンドを使う点で学習効果が高い** |
| **OverTheWire Bandit** | 公開ソース repo なし。**OSS ではない**（All rights reserved・再配布禁止）。2026 も稼働 | Linux Story Quest 修了後の実践問題 | 低（無料） | **内容や認証情報をコピー・再配布してはいけない。リンクして学習導線に使う** |
| **tldr-pages** | [tldr-pages/tldr](https://github.com/tldr-pages/tldr) · **本文 CC-BY-4.0 / scripts MIT** · 非常に活発（仕様 v2.3、assets 2026-07 更新） | 自作 commandBook の説明文・使用例の大部分 | 低 | **内容を取り込む場合は CC-BY の帰属表示が必要**。日本語ページの網羅率は英語より低い |
| **Oh My Git!** | [git-learning-game/oh-my-git](https://github.com/git-learning-game/oh-my-git) · **Blue Oak Model License 1.0.0** · **公式に低メンテナンスモード** | Git Dungeon の実 Git 状態・レベル判定・カード UI | **高**（Godot 3 が必要） | ブラウザ静的 JS へ直接流用しにくい。非主流ライセンス。新規基盤にはしない |
| **Oh My Git! 2** | [git-learning-game/oh-my-git-2](https://github.com/git-learning-game/oh-my-git-2) · Blue Oak 1.0.0 · 227 commits・正式 release なし | ブラウザ内 Linux VM ＋本物の Git という設計 | 高 | プロトタイプ。v86 イメージが重い。**ただし自作ゲームの次段階を考える参考実装として非常に重要** |
| **git-sim** | [initialcommit-com/git-sim](https://github.com/initialcommit-com/git-sim) · **GPL-2.0** · 活動は限定的 | Git 操作説明用の図を自作する部分 | 中〜高（Python + Manim） | ブラウザ教材ではなくローカル生成ツール。**ゲーム本体への組込みには不適** |
| **explainshell** | [idank/explainshell](https://github.com/idank/explainshell) · **コード GPL-3.0**、manpage DB は各上流ライセンス · 2026 に対応作業あり | 自作パーサの説明機能、コマンド分解表示 | 高 | Python/DB/サーバーが必要。**静的ホスティング不可**。DB 再配布は個別ライセンス確認が必要 |
| **Killercoda** | 実行基盤はホステッドサービスで **OSS repo/ライセンスは確認できず**。シナリオ例 [killercoda/scenario-examples](https://github.com/killercoda/scenario-examples)（ライセンス表記未確認、2026-04 更新） | Linux Story Quest を実 VM 演習へ | 中（creator は無料） | **静的ホスティング不可**、外部サービス依存 |
| **Katacoda** | **公開サービス終了** | — | — | **新規採用不可**。後継候補は Killercoda |

### 第一推奨

**Git は Learn Git Branching、Linux は Bashcrawl → Bandit。**

Git Dungeon は、Learn Git Branching と重なる `branch / merge / HEAD` の正確な状態モデルを
再発明している。一方、**ダンジョン移動・敵・日本語の物語は独自価値**がある。

→ Git の正確な理解には既存教材を使い、自作側は
**「復習ゲーム」「日本語の物語」「初学者が怖がらず入力できる UI」に役割を絞る**のがよい。

---

## D-2. 学習ゲームを作る側に回るなら

| 名前 | リポジトリ / ライセンス / 活動 | ブラウザ完結 | 置き換えるもの | コスト・注意点 |
|---|---|---|---|---|
| **xterm.js** | [xtermjs/xterm.js](https://github.com/xtermjs/xterm.js) · MIT · 非常に活発（2026-08 commit） · **stable 6.0.0** | **可** | 手製の入力欄、履歴表示、ANSI 描画、**IME/CJK**、選択、スクロール | **低〜中。第一推奨**。ただし **bash や Linux そのものではない**。パーサ・v86・WebSocket backend のいずれかが別途必要 |
| **Ink + inkjs** | [inkle/ink](https://github.com/inkle/ink) · MIT · **v1.2.1（2026-05）** / [y-lohse/inkjs](https://github.com/y-lohse/inkjs) · MIT · **v2.4.0** | **可**（zero dependency） | `stageSeed` の長い配列、会話・選択肢・条件分岐 | 低〜中。マップやコマンド処理は別実装 |
| **Twine** | [klembot/twinejs](https://github.com/klembot/twinejs) · **GPL-3.0** · 活発 · **v2.12.0（2026-04）** | **可**（出力 HTML をそのまま配信） | ストーリー分岐、章管理、セーブ | 低。**Linux/Git 状態モデルやマップ移動には弱い** |
| **KAPLAY**（Kaboom.js 後継） | [kaplayjs/kaplay](https://github.com/kaplayjs/kaplay) · MIT · 活発 · 安定 3001 系（2025-06）、**次期 4000 系は 2026-05 alpha** | **可** | マップ、sprite、衝突、scene、keyboard 入力 | 中。Phaser より軽い。**最新系が alpha なので安定版を固定する必要**あり |
| **Phaser** | [phaserjs/phaser](https://github.com/phaserjs/phaser) · MIT · 活発 · **v4.2.1（2026-07）** | **可** | Git Dungeon のマップ、衝突、入力、scene、animation | 中〜高。**現在の小規模 DOM ゲームには過剰**。v4 は新 renderer 移行直後 |
| **Ren'Py** | [renpy/renpy](https://github.com/renpy/renpy) · 主に MIT · 活発 · **v8.5.3（2026-05）** | 可（Web build あり） | 会話、背景、分岐、セーブ、翻訳 | **高**。大きな runtime、Python 系ツールチェーン。HTML/JS 前提から外れる |
| **v86** | [copy/v86](https://github.com/copy/v86) · **BSD-2-Clause** · 活発（2026-05 latest build） | 可（ROM/Linux image も配信） | 手製 Linux コマンドパーサを**本物の Linux** へ | **非常に高**。数十 MB 級 image、起動時間、モバイル負荷、永続化、OS イメージのライセンス管理 |
| **WebContainer API** | [stackblitz/webcontainer-core](https://github.com/stackblitz/webcontainer-core)（issue/docs は MIT だが **runtime 本体を完全な OSS として再配布できるものではない**） | API サービス・利用条件に依存 | Node/npm、ファイルシステム、shell 風演習 | 高。**Linux ではなく Node 環境**。商用 production は契約が必要 |
| **js-dos** | [caiiiycuk/js-dos](https://github.com/caiiiycuk/js-dos) · npm では GPL-2.0 表記（部品ごとに要確認） · 活発 · **v8.4.1（2026-07）** | 可（backend 不要） | DOS 教材・レトロゲーム | 高。**Linux/Git 教材には不適** |

### 第一推奨: xterm.js だけ導入する

Linux Story Quest には、まず **xterm.js だけ**を入れるのが最も投資対効果が高い。

- **日本語 IME、ANSI 表示、カーソル、履歴、選択、スクロールを自作しなくてよくなる**
- 現在の仮想 FS・安全なコマンド判定・クエスト進行は**そのまま使える**
- 静的ホスティングを維持できる
- v86 ほど重くない

その後、「本物のコマンドを実行すること」が学習目標になった段階で、別モードとして v86 を検討する。
**最初から v86 へ移すと、教材設計より VM の boot・image・永続化・ブラウザ互換に時間を取られる。**

Git Dungeon のマップを拡張するなら **KAPLAY 安定版**、文章分岐を増やすなら **Ink + inkjs**。
Phaser や Ren'Py は現状の規模には過剰。

---

## D-3. 学習記録・ポートフォリオ運用の土台

| 名前 | リポジトリ / ライセンス / 活動 | 置き換えるもの | コスト・注意点 |
|---|---|---|---|
| **TIL repository 方式** | ソフトウェア依存なし。参考: [simonw/til](https://github.com/simonw/til) · Apache-2.0 · 2026 も記事追加 | HTML 記事、index カードの手更新 | **最低**。デザイン・検索・RSS は別途 generator が必要。**まず記録習慣を作る方式** |
| **Quartz 5** | [jackyzha0/quartz](https://github.com/jackyzha0/quartz) · MIT · 非常に活発（v5 branch は 2026 も連日更新） | 1 ページずつの HTML、index 手更新、検索、タグ、RSS、TOC、コードハイライト、sitemap | 中。**engine と content が同じ repo に入りやすく、upstream 更新時の衝突に注意**。v5 は新しく変化も速い |
| **Foam** | [foambubble/foam](https://github.com/foambubble/foam) · MIT · 活発 · **vscode@0.40.4（2026-05）** | Markdown 執筆、相互リンク、graph | 低〜中。**公式自身が alpha-grade への許容を要件に挙げる**。公開サイト生成は Quartz 等と組み合わせる |
| **Logseq + publish-spa** | [logseq/logseq](https://github.com/logseq/logseq) · **AGPL-3.0** · 活発だが **新 DB 版は beta、mobile/RTC は alpha** | 日誌、双方向リンク、公開 graph | **高**。DB graph 対応は保留。**移行期なので今この土台にするのはリスク** |
| **Digital Gardeners 一覧** | [MaggieAppleton/digital-gardeners](https://github.com/MaggieAppleton/digital-gardeners) · **明示ライセンス未確認** | ツール選定・思想の参考 | 低。実装ではなくリンク集。**ライセンス未確認なので内容のコピーは避ける** |

> **注意: この節の推奨（Quartz 5）は 01 章の推奨（Astro）と競合する。**
> 結論は `README.md` の「判断が分かれた 2 点」を参照。

成果物はコピーせず、次のどちらかにする:

```
content/
├── til/
├── articles/
└── works/
    ├── linux-story-quest.md   # 説明、スクリーンショット、公開URL
    └── git-dungeon.md
```

- ゲーム本体は各 homework/build の公開 URL へリンク
- あるいは monorepo build で成果物を出力先へ機械的にコピー
- **`works/` へソースを手動コピーしない**

---

## 自作を続けたほうがよい領域

**維持する価値が高い**（＝これがこの人の作品の独自価値）:

- 日本語の教材文
- 初学者がつまずく順番を反映したステージ設計
- 「なぜそのコマンドを使うか」という物語
- Linux Story Quest の安全な仮想 FS
- Git Dungeon の RPG 世界観
- クエスト成功条件 / ヒントの段階的な出し方
- 学習データの小さな JSON 形式

> これらは製品の独自価値であり、**コード量を減らすために汎用ゲームエンジンへ渡しても
> 学習効果は上がらない**。

**置き換えるべき**:

| 現状 | 置き換え先 |
|---|---|
| ターミナルの描画・IME・ANSI 処理 | **xterm.js** |
| Git グラフ教材の基本部分 | **Learn Git Branching を参照** |
| コマンド説明文の網羅 | **tldr を参照・帰属** |
| 分岐物語の管理 | **Ink** |
| 複雑な 2D 衝突・scene 管理 | **KAPLAY** |
| HTML・リンク・a11y 検査 | **既存 CI ツール** |
| AWS リソース間の ARN・policy 組み立て | **CDK** |
| 学習記事の HTML、一覧、RSS、タグ | **SSG（Astro / Quartz）** |

---

## 個人学習者が最初に入れるべき順（投資対効果順）

- [ ] **1. `html-validate` を導入する** — 数分で構文事故を防げ、CI 負担も小さい
- [ ] **2. `lychee` を週次または PR に入れる** — 学習記事・作品リンクの腐敗を検出する
- [ ] **3. AWS 継続なら `aws-actions/configure-aws-credentials` ＋ OIDC を確立する** — 長期鍵を完全に排除
- [ ] **4. インフラを AWS CDK の単一 Stack へ移す** — 4 つの手書き JSON とプレースホルダーを廃止
- [ ] **5. 静的公開だけが目的なら Cloudflare Pages へ移す** — AWS 学習が目的なら移さず CDK を続ける
- [ ] **6. 学習記録を Markdown の TIL 形式へ変更する** — 記録単位を小さくし、HTML 手編集を止める
- [ ] **7. SSG を公開基盤にする** — 一覧、タグ、検索、RSS、TOC、コード表示をまとめて取得する
- [ ] **8. Git 学習は Learn Git Branching を一通り終えてから自作を拡張する**
- [ ] **9. Linux 学習は Bashcrawl → Bandit を体験し、自作側に不足する課題だけ追加する**
- [ ] **10. Linux Story Quest へ xterm.js を導入する** — 仮想 FS と教材ロジックは残し、端末 UI の再発明だけ止める

> 最初から Lighthouse CI、Unlighthouse、Phaser、v86、WebContainers まで全部入れるのは逆効果。
> **最初の一巡は「HTML 検証、リンク検査、安全な AWS 認証、IaC、Markdown 化」までで十分。**
