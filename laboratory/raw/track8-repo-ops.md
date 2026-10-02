# 第2ラウンド調査：リポジトリ運営・DX・セキュリティ・CSS設計

調査日: 2026-08-25  
対象: `/home/shimizu/study/spartan_school`

## 0. 最重要の現状診断

最も大きな問題は、デプロイWorkflowがリポジトリ直下ではなく [`02.homework/05.week5/.github/workflows/deploy-web.yml`](/home/shimizu/study/spartan_school/02.homework/05.week5/.github/workflows/deploy-web.yml:1) にあることです。

GitHub Actionsが認識するのはリポジトリ直下の `.github/workflows/` だけなので、現在のファイルはこのリポジトリでは実行されません。ルートへ移す場合は `working-directory`、`paths`、`.nvmrc`、lockfileのパスも `02.homework/05.week5/...` に直す必要があります。

### リポジトリ運営ファイルの現況

| 項目 | 現況 | 評価 |
|---|---|---|
| ルート `.github/` | なし | Workflow、Dependabot、Issue Templateが機能しない |
| ルート `package.json` | なし | 5個のNodeプロジェクトが独立。現段階では無理にworkspace化しなくてよい |
| `.gitignore` | あり | `.env*`、`node_modules`、dist等は除外。重複行はあるが実害なし |
| `.nvmrc` | [`week5/web/.nvmrc`](/home/shimizu/study/spartan_school/02.homework/05.week5/web/.nvmrc:1) のみ、値は`22` | リポジトリ全体のNode固定にはなっていない |
| `.editorconfig` | `02.homework/05.week5/`だけ | ルートへ昇格すべき |
| `CLAUDE.md` | [`nextcode-demo/CLAUDE.md`](/home/shimizu/study/spartan_school/01.lesson/01.week1/nextcode-demo/CLAUDE.md:1) のみ | 「日本語で返す」の1行だけ。リポジトリ全体の説明ではない |
| `LICENSE` | なし | 公開していても再利用許諾はない |
| 帰属表示 | 体系的なファイルなし | Fontsource/OFL、tldr取り込み時のCC-BYなどを管理できていない |
| 秘密情報 | 実キーは検出されず | AWS JSONはARNとプレースホルダーのみ。ただし検知CIなし |
| Actions参照 | `checkout@v4`等の可変タグ | Workflowを移した後はSHA固定が必要 |
| AWS認証 | OIDC前提 | 長期AWSアクセスキーを使わない良い設計 |
| IAM | S3とCloudFrontに限定 | 比較的よい。バケット名は実名、アカウント等はプレースホルダー |

## 第一推奨

**Dependabotをルート `.github/dependabot.yml` で有効化し、npmとGitHub Actionsをまとめて管理すること**を第一推奨とします。

GitHub組み込みで追加アカウントや常駐サーバーが不要です。現在散在する5個のlockfileと、将来ルートへ移すActionsのSHAを同時に更新できます。高度なグルーピングが必要になるまではRenovateより運用負荷が低いです。[Dependabotは全GitHubリポジトリで利用可能](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-version-updates)です。

---

# 1. CSSの設計と土台

## 1.1 クラスレスCSS

| 名前 | 一行説明 / リポジトリURL | ライセンス / 活動状況 | 置換範囲・採用コスト・注意点 |
|---|---|---|---|
| Pico.css | semantic HTMLを整えるclass-light/classless CSS。[picocss/pico](https://github.com/picocss/pico) | MIT。v2.1.1が2025-03、保守継続 | 学習サイトのbody、見出し、table、code、formを置換可能。低〜中。ただし既存テーマとの上書き競合が大きい |
| Water.css | CSSを1枚読むだけで素のHTMLをライト/ダーク対応にする。[kognise/water.css](https://github.com/kognise/water.css) | MIT。正式Release運用なし、最終リリース時期未確認 | 記事本文の土台向け。低。ヴィクトリア朝の色・幅・タイポグラフィをほぼ上書きするため不採用 |
| Sakura | 文章中心ページ向けの小さなclasslessテーマ。[oxalorg/sakura](https://github.com/oxalorg/sakura) | MIT。v1.5.1、2025-06 | 記事本文、table、code等。低。和文でも使えるが、既存テーマと役割が重なる |
| MVP.css | semantic HTMLをMVP風サイトにする無クラスCSS。[andybrewer/mvp](https://github.com/andybrewer/mvp) | MIT。npm 1.17.3、2026年前半 | プロトタイプには最適。低。header/nav/sectionの意匠が強く、既存サイトには不適 |
| new.css | 小型classless CSS。[xivor/new.css](https://github.com/xz/new.css) | MIT。最新リリース時期未確認、活動低め | 単発教材HTML向け。低。既存のCSSを整理する目的には弱い |
| Simple.css | ブログ・文章サイト向けclasslessテンプレート。[kevquirk/simple.css](https://github.com/kevquirk/simple.css) | MIT。2026年もcommitあり、正式リリース時期未確認 | 学習ブログ全体を置換可能。低。ただしカードや記事幅まで意匠が決まる |

### 結論

学習サイトには理論上Pico.cssかSimple.cssが合いますが、今回は**導入しない**のが妥当です。

[`assets/style.css`](/home/shimizu/study/spartan_school/03.learning_site/assets/style.css:5) はすでに色、書体、カード、記事、表、コード、ナビを一貫して定義しています。クラスレスCSSを足すと303行が減るのではなく、「外部CSSを打ち消す上書き」が増えます。

クラスレスCSSは、今後作る一時的な授業メモや検証HTMLに使うのが適所です。

## 1.2 Open Props

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| Open Props | 色、余白、影、ease、font-size等のCSS変数集。[argyleink/open-props](https://github.com/argyleink/open-props) | MIT。1.7.23、2026-01。活発 | 一式導入は不要。`sizes`、`easings`、`shadows`から考え方または必要な変数だけ借りる |

現状も [`:root` 5–19行目](/home/shimizu/study/spartan_school/03.learning_site/assets/style.css:5) に独自トークンがあります。ヴィクトリア朝固有の色はそのまま残し、次のような不足分だけ補うのがよいです。

```css
:root {
  /* 既存の色・書体は維持 */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2rem;

  --ease-out-3: cubic-bezier(0, 0, 0.3, 1);
  --radius-1: 3px;
}
```

Open Propsを丸ごと入れるより、この規模では独自トークンを10〜15個に整理する方が理解しやすく軽量です。

## 1.3 CSSリセット

| 名前 | 説明 / URL | ライセンス / 活動 | 置換・コスト・注意点 |
|---|---|---|---|
| modern-normalize | 現代ブラウザ間の差だけを正規化。[sindresorhus/modern-normalize](https://github.com/sindresorhus/modern-normalize) | MIT。3.0.1、2024年ごろ。commit保守あり | 第一候補。低。既存21行目の全面margin/padding resetを穏当な土台へ変更 |
| destyle.css | UAスタイルを広範囲に消す。[nicolas-cusan/destyle.css](https://github.com/nicolas-cusan/destyle.css) | MIT。最新リリース時期未確認 | 中。button/formまで消える。今回の文章サイトには強すぎる |
| Josh Comeau reset | 実践的な自作reset解説。[記事](https://www.joshwcomeau.com/css/custom-css-reset/) | 独立OSSリポジトリ・明示ライセンスは未確認。記事は2024年更新 | 内容は優秀だが、ライセンスを明確にできないコードコピーは避け、考え方のみ採用 |
| the-new-css-reset | `all: unset`系で広範囲に初期化。[elad2412/the-new-css-reset](https://github.com/elad2412/the-new-css-reset) | MIT。最終リリース時期未確認 | 高。アクセシビリティやフォームの戻し忘れが起きやすく不採用 |

現在の次の1行は、全要素の余白を消す強いresetです。

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
```

[`style.css:21`](/home/shimizu/study/spartan_school/03.learning_site/assets/style.css:21)

推奨は `modern-normalize.css` を先に読み、手書き側を以下程度に縮めることです。

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

img,
picture,
svg {
  max-width: 100%;
}
```

ただし、現在の表示が安定しているなら急いで変更する必要はありません。reset交換は必ず各記事・ゲーム画面を目視回帰確認します。

## 1.4 CSS設計手法

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| CUBE CSS | Composition / Utility / Block / Exceptionで責務を分ける設計手法。[cube.fyi](https://cube.fyi/) | 手法。独立OSSパッケージ・ライセンス・リリースなし | **CSS設計の第一推奨**。依存ゼロ。既存CSSのコメント区分をそのまま発展できる |
| Every Layout | intrinsic designを使った再利用可能レイアウト教材。[every-layout.dev](https://every-layout.dev/) | 商用教材。全コンテンツは無料OSSではなく、有料レイアウトあり | Stack、Cluster、Gridの考え方だけ参考にする。コード一括導入は不要 |

ゲームCSSは行数こそ多いものの、別フレームワークへ移すより次のレイヤー分割が現実的です。

```css
@layer reset, tokens, composition, blocks, utilities, exceptions;
```

- `tokens`: 現在の`:root`
- `composition`: 画面全体のgrid/flex、余白
- `blocks`: terminal、map、inventory、dialogなど
- `utilities`: visually-hidden、状態表示
- `exceptions`: `data-state`や個別ステージ差分

これならゲームの741行・1,133行を捨てずに、重複と詳細度競争を減らせます。

## 1.5 CSSビルド・型付きCSS

| 名前 | 説明 / URL | ライセンス / 活動 | 置換・コスト・結論 |
|---|---|---|---|
| PostCSS | JSプラグインでCSS ASTを変換。[postcss/postcss](https://github.com/postcss/postcss) | MIT。2026年も活発 | autoprefixer等が必要な時だけ。現状の素CSSには中コストで過剰 |
| Lightning CSS | Rust製parser、prefixer、minifier、bundler。[parcel-bundler/lightningcss](https://github.com/parcel-bundler/lightningcss) | MPL-2.0。1.32系、2026年も活発 | Vite等に任せる。単体導入は不要 |
| vanilla-extract | TypeScriptから静的CSSを生成。[vanilla-extract-css/vanilla-extract](https://github.com/vanilla-extract-css/vanilla-extract) | MIT。1.21系、2026年更新 | TS化が前提。素のHTML/JS学習リポジトリでは高コスト、不採用 |
| Panda CSS | 型付きtoken/recipeからatomic CSSを生成。[chakra-ui/panda](https://github.com/chakra-ui/panda) | MIT。1.7系、2026年も活発 | React等のコンポーネント設計向け。現状には過剰 |
| stylelint | CSS専用の成熟したlinter。[stylelint/stylelint](https://github.com/stylelint/stylelint) | MIT。17.14.1、2026-07 | **採用候補**。手書きCSS 2,282行に最も直接効く。低〜中 |
| Biome CSS | JS/JSONに加えてCSS formatter/linterを提供。[biomejs/biome](https://github.com/biomejs/biome) | MIT。2.5.6系、2026年も活発 | CSS対応は進んだが、SCSSやstylelintの豊富なCSS規則を完全置換しない。既にBiomeを入れるならformat用途 |

### CSSの最終結論

- ヴィクトリア朝の色、紙質、罫線、カード、drop capは自作のまま残す。
- Pico等のclassless CSSは重ねない。
- `modern-normalize`は必要なら土台だけ借りる。
- Open Propsは余白・easeの考え方だけ借りる。
- CUBE CSSと`@layer`で既存CSSを整理する。
- 機械チェックを入れるならstylelintを第一候補にする。
- vanilla-extract、Panda、PostCSS単体導入はしない。

---

# 2. 依存関係とサプライチェーン

## 2.1 Renovate vs Dependabot

| 名前 | 説明 / URL | ライセンス / 活動 | このケースでの採否 |
|---|---|---|---|
| Dependabot | GitHub組み込み依存更新。[dependabot-core](https://github.com/dependabot/dependabot-core) | MIT。GitHub上で継続更新 | **第一推奨**。npmとActionsを週1回、更新をグループ化。追加SaaS不要 |
| Renovate | 多数のmanager、柔軟なgroup、dashboardを持つ更新bot。[renovatebot/renovate](https://github.com/renovatebot/renovate) | AGPL-3.0-only。44系、非常に活発 | 中。複数ディレクトリ・将来のIaCまで一括管理したい場合に移行。個人の現段階では設定面が大きい |

Renovate公式もGitHub CloudではHosted Appを最も簡単な方法として案内しています。一方、DependabotはGitHub内蔵でActionsのSHA参照も更新できます。[比較](https://docs.renovatebot.com/bot-comparison/)

## 2.2 脆弱性・悪意あるパッケージ

| 名前 | 説明 / URL | ライセンス / 活動 | 置換・コスト・注意点 |
|---|---|---|---|
| OSV-Scanner | OSVデータベースでlockfile・コンテナ等を横断スキャン。[google/osv-scanner](https://github.com/google/osv-scanner) | Apache-2.0。v2.4.0、2026-06 | 中。npm以外も含む将来向け。今はnpm auditと重複が多い |
| npm audit | npm lockfileをGitHub Advisory DB等で検査。[npm/cli](https://github.com/npm/cli) | Artistic-2.0。npmに同梱、活発 | 最低コスト。各package-lockに対する最初の一手 |
| audit-ci | npm auditを重大度・allowlist付きでCIの失敗条件にする。[IBM/audit-ci](https://github.com/IBM/audit-ci) | MIT。継続保守、最新リリース時期未確認 | 低。`high`以上でCIを止めたい場合に採用 |
| Socket | CVEだけでなくinstall script、typosquat等を評価。[SocketDev/socket-cli](https://github.com/SocketDev/socket-cli) | CLIはMIT。2026-08更新、npm版も活発。OSSは無料 | 中。依存が増えた時に有力。現在の小さな依存木には過剰 |
| Snyk | 依存、コンテナ、IaCを統合スキャン。[snyk/cli](https://github.com/snyk/cli) | Apache-2.0。v1.1305系、2026-05 | 中〜高。アカウント・無料枠制限あり。現状はOSV/npm auditで十分 |

`audit-ci`は`npm ci`より前に実行すると、侵害された依存の`postinstall`を実行する前に監査できると案内しています。[audit-ci README](https://github.com/IBM/audit-ci)

## 2.3 秘密漏洩

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| Gitleaks | 高速な正規表現・entropy型秘密検知。[gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) | MIT。活発 | **第一推奨**。AWSキー、GitHub Token、秘密鍵を履歴込みで検査。低 |
| TruffleHog | 秘密候補の実在性検証や多数サービス対応。[trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog) | AGPL-3.0。v3.95系、2026-07 | 中。検証通信と誤検知管理が増える。Gitleaksで不足した場合 |
| git-secrets | AWS形式を中心にcommit前検知。[awslabs/git-secrets](https://github.com/awslabs/git-secrets) | Apache-2.0。最終リリース時期未確認、保守弱め | AWSには合うが検出範囲と保守性でGitleaksに劣る |

AWS設定JSONをGit管理すること自体は問題ではありません。現在のinfra JSONには秘密鍵がなく、AWS OIDCの`<ACCOUNT_ID>`等もプレースホルダーです。

ただし今後、次のいずれかが入ったらJSONごと削除するのではなく、**キーを即失効・ローテーション**します。

- `AKIA...`形式のAccess Key ID
- Secret Access Key
- session token
- 秘密鍵PEM
- 実値入り`.env`

## 2.4 ActionsのSHA固定

現在のWorkflowは以下が可変タグです。

- `actions/checkout@v4`
- `actions/setup-node@v4`
- `aws-actions/configure-aws-credentials@v4`

GitHubは、完全長commit SHAがActionを不変に固定する唯一の方法と説明しています。[GitHub Secure Use](https://docs.github.com/en/actions/reference/security/secure-use)

形式は次です。

```yaml
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

- SHAは対象Actionの公式タグから確認する。
- 同じ行に人間向けバージョンコメントを書く。
- Dependabotの`github-actions`更新でSHAを自動更新する。
- 更新PRは自動マージせず、release差分を確認する。

## 2.5 provenance・lockfile

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| npm provenance | npm公開物がどのCI・commitから作られたかをSigstoreで証明。[npm/provenance](https://github.com/npm/provenance) | MIT。継続保守 | 現在は全packageがアプリ/教材でnpm公開しないため不要 |
| lockfile-lint | lockfileのregistry、HTTPS、integrity等を検査。[lirantal/lockfile-lint](https://github.com/lirantal/lockfile-lint) | Apache-2.0。最終リリース時期未確認 | 低。公式npm registryだけを許す確認には有効 |

`npm ci`はlockfile固定に有効ですが、lockfile自体に悪意あるregistry URLが入る問題までは防ぎません。公開PRを多く受けるようになったらlockfile-lintを追加します。

---

# 3. Git運用と開発者体験

## 3.1 Git hooks

| 名前 | 説明 / URL | ライセンス / 活動 | コスト・結論 |
|---|---|---|---|
| Lefthook | Go単一バイナリの言語非依存hook manager。[evilmartians/lefthook](https://github.com/evilmartians/lefthook) | MIT。2.1.10、2026-07 | **この混在リポジトリの第一候補**。中。Node/PHP/Markdownをルートから扱える |
| Husky | npmで広く使われる軽量Git hooks。[typicode/husky](https://github.com/typicode/husky) | MIT。9.1.7、2024-11 | 低。ルートpackage.jsonがない現状では導入位置が不自然 |
| simple-git-hooks | 小規模npmプロジェクト向け最小hook manager。[toplenboren/simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) | MIT。活動継続、最新リリース時期未確認 | 個別Webアプリには最小。ただしリポジトリ全体には弱い |
| pre-commit | Python系で定番の多言語hook framework。[pre-commit/pre-commit](https://github.com/pre-commit/pre-commit) | MIT。活発、最新リリース時期未確認 | 中。Python環境が主でないためLefthookより余分 |

Hooksは迂回できるため、CIの代わりにはしません。ローカルの即時フィードバック用です。

## 3.2 staged file

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| lint-staged | stagedされたファイルだけにformatter/linterを実行。[lint-staged/lint-staged](https://github.com/lint-staged/lint-staged) | MIT。17.3.0、2026-07 | 多機能。Node 22.22.1以上が必要 |
| nano-staged | lint-stagedの小型代替。[usmanyunusov/nano-staged](https://github.com/usmanyunusov/nano-staged) | MIT。最新リリース時期未確認 | 小規模向けだが、採用実績・機能でlint-stagedが無難 |

このリポジトリでは最初からstaged限定にせず、CIで全ファイルを検査する方が設定が分かりやすいです。遅くなってからlint-stagedを足します。

## 3.3 commit・release

| 名前 | 説明 / URL | ライセンス / 活動 | 結論 |
|---|---|---|---|
| commitlint | Conventional Commits形式を検査。[conventional-changelog/commitlint](https://github.com/conventional-changelog/commitlint) | MIT。活発、最新リリース時期未確認 | 学習目的には有効だが必須ではない |
| Conventional Commits | `feat:`, `fix:`等のcommit規約。[conventional-commits/conventionalcommits.org](https://github.com/conventional-commits/conventionalcommits.org) | MIT。仕様1.0.0 | 規約だけ採用可能。ツールなしでも始められる |
| Changesets | package単位の変更記録とversioning。[changesets/changesets](https://github.com/changesets/changesets) | MIT。活発 | npm packageを公開していないので不採用 |
| release-please | commitからrelease PRとCHANGELOGを生成。[googleapis/release-please](https://github.com/googleapis/release-please) | Apache-2.0。活発 | サイトのタグリリースを始めたら候補 |
| semantic-release | Conventional Commitsから完全自動release。[semantic-release/semantic-release](https://github.com/semantic-release/semantic-release) | MIT。活発 | 個人学習では自動化が強すぎ、誤releaseの方が怖い |

現段階では`feat/fix/docs/refactor/chore`の規約だけ使い、releaseツールは入れないのが妥当です。

## 3.4 Node 22固定・開発環境

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| EditorConfig | editor間の字下げ・改行統一。[editorconfig/editorconfig](https://github.com/editorconfig/editorconfig) | BSD系。活発 | **ルートへ置く。最小コスト** |
| Dev Container | VS Code/Codespaces等の再現可能コンテナ。[devcontainers/spec](https://github.com/devcontainers/spec) | MIT。活発 | Docker学習も兼ねるなら有効。今は起動コストが大きい |
| mise | Node、Python、Terraform等を一括固定。[jdx/mise](https://github.com/jdx/mise) | MIT。2026年も活発 | **Node以外も増えるなら第一候補** |
| Volta | `package.json`でNode/npmを自動固定。[volta-cli/volta](https://github.com/volta-cli/volta) | BSD-2-Clause。活動状況・最新リリース時期未確認 | Node専用なら使いやすいが、現状は積極推奨しない |
| asdf | `.tool-versions`で多言語を管理。[asdf-vm/asdf](https://github.com/asdf-vm/asdf) | MIT。活発 | miseよりplugin設定が重い |
| fnm | Rust製の高速Node version manager。[Schniz/fnm](https://github.com/Schniz/fnm) | GPL-3.0。活発 | `.nvmrc`互換。個人PCのnvm置換にはよい |
| Corepack | Yarn/pnpm等のpackage manager versionを仲介。[nodejs/corepack](https://github.com/nodejs/corepack) | MIT。活発 | Node本体のversionは固定しない。npmだけなら優先度低 |

現実的には次の三重指定で十分です。

```text
# /.nvmrc
22.22.1
```

```json
{
  "engines": {
    "node": "22.22.1"
  }
}
```

```yaml
- uses: actions/setup-node@確認済みSHA
  with:
    node-version-file: .nvmrc
```

`22`だけではNode 22内の差が残ります。現在のlint-staged 17もNode 22.22.1以上を要求するため、完全なpatch固定には意味があります。

## 3.5 Markdown・日本語文書

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| markdownlint-cli2 | Markdown構造・空行・見出し等を検査。[DavidAnson/markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) | MIT。活発 | docs/品質CIの第一候補 |
| textlint | 日本語校正ルールを組み合わせる。[textlint/textlint](https://github.com/textlint/textlint) | MIT。活発 | 別トラックのルールセットをCIから呼ぶ。誤検知は段階導入 |

最初はmarkdownlintだけを必須にし、textlintは警告運用から始めるべきです。大量の既存文書を一度に必須化すると、修正PRがノイズ化します。

---

# 4. ドキュメントとライセンス

## 4.1 LICENSEがない現状

LICENSEがなければ、公開GitHubリポジトリでもデフォルトの著作権が適用され、第三者には原則として複製・変更・再配布の許諾がありません。[GitHub公式説明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

| 選択肢 | 内容 | このケースでの結論 |
|---|---|---|
| MIT | コード再利用を広く許可し、著作権表示・免責を残す | **コード部分の第一推奨** |
| CC-BY-4.0 | 記事、図解、教材を帰属条件で再利用可能にする | 日本語記事・自作PNGを共有したい場合に適切。ソフトウェアコードには使わない |
| Unlicense | public-domain相当の非常に広い許諾 | 日本法を含む管轄差や帰属不要方針が分かりにくいため、MITより非推奨 |
| あえて付けない | All rights reserved相当 | 学習成果を閲覧用に公開するだけで、再利用を許可したくないなら正当。ただしOSSではない |

推奨構成は次です。

- ソースコード: MIT
- `01.lesson/`、記事本文、自作PNG: `CC-BY-4.0`または著作権保持
- 第三者素材: 元のライセンスを維持
- ルートREADMEに範囲を明記

## 4.2 ライセンス検査

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| REUSE | 各ファイルの著作権・SPDX表記を機械検査。[fsfe/reuse-tool](https://github.com/fsfe/reuse-tool) | GPL-3.0-or-later。保守継続 | 中〜高。複数ライセンス化するなら最終的に最も正確 |
| Licensee | GitHubが使うリポジトリライセンス検出。[licensee/licensee](https://github.com/licensee/licensee) | MIT。活発 | ルートLICENSEの認識確認向け。依存ライセンスは見ない |
| license-checker | npm依存のライセンス一覧生成。[davglass/license-checker](https://github.com/davglass/license-checker) | BSD-3-Clause。最新リリース時期未確認、保守弱め | lockfileの小さい現状なら補助用途。CI必須化はまだ不要 |

複数ライセンスを本格管理するならREUSEが正攻法ですが、学習リポジトリの全HTML・PNG・MarkdownへSPDX情報を付ける初期コストは高いです。まずは`LICENSE`と`THIRD_PARTY_NOTICES.md`から始めます。

## 4.3 第三者素材の帰属

現物で確認できる対象は次です。

- `@fontsource/zen-kaku-gothic-new`: OFL-1.1
- `@fontsource/zen-old-mincho`: OFL-1.1  
  [`package-lock.json`](/home/shimizu/study/spartan_school/02.homework/05.week5/web/package-lock.json:18) に記録あり
- tldr-pagesの本文を取り込む場合: CC-BY-4.0、scriptsはMIT
- 自作アイコン、PNG:作者と出典が第三者から判別できない
- ホームズ原作のパブリックドメイン表記はあるが、画像素材の作成元・生成方法は別途記録が必要

`THIRD_PARTY_NOTICES.md`は次の列にします。

```markdown
# Third-party notices

| Asset / path | Creator / project | Source URL | License | Changes |
|---|---|---|---|---|
| Zen Kaku Gothic New | Google Fonts / Fontsource packaging | ... | OFL-1.1 | Self-hosted subset |
| Zen Old Mincho | Google Fonts / Fontsource packaging | ... | OFL-1.1 | Self-hosted subset |
| tldr command descriptions | tldr-pages contributors | ... | CC-BY-4.0 | Japanese adaptation |
```

「依存ライブラリのlicense一覧」と「コンテンツ・画像の帰属」は分けて管理する方が読みやすいです。

## 4.4 README・貢献者・変更履歴

| 名前 | 説明 / URL | ライセンス / 活動 | 採否 |
|---|---|---|---|
| All Contributors | コード以外の貢献もREADMEへ記録。[all-contributors/all-contributors](https://github.com/all-contributors/all-contributors) | MIT。活動継続 | 一人リポジトリの間は不要 |
| Keep a Changelog | 人間向けCHANGELOG形式。[olivierlacan/keep-a-changelog](https://github.com/olivierlacan/keep-a-changelog) | MIT。活動継続 | 公開版をtag releaseする段階で採用 |
| Standard Readme | READMEの標準的な章立て。[RichardLitt/standard-readme](https://github.com/RichardLitt/standard-readme) | MIT。最終リリース時期未確認 | ツール導入不要。構成だけ借りる |

ルートREADMEには最低でも次を置くべきです。

1. このリポジトリの目的
2. 各ディレクトリの説明
3. Node 22の起動手順
4. 公開サイトURL
5. AWS費用が発生し得ること
6. ライセンスの適用範囲
7. 第三者素材へのリンク

---

# 5. AWSコスト・監視

| 名前 | 説明 / URL | ライセンス / 活動 | 置換・コスト・注意点 |
|---|---|---|---|
| Infracost | IaC差分から月額見積りを表示。[infracost/infracost](https://github.com/infracost/infracost) | Apache-2.0。v0.10.45、2026-07 | 現在の生JSONには直接効きにくい。CDK/OpenTofu化後に採用 |
| AWS Budgets | 実費・予測費用の閾値通知。[公式](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/) | AWSサービス、OSSライセンスなし。監視のみは無料 | **最優先**。$1実費、$5予測などをメール通知 |
| AWS Cost Anomaly Detection | MLで通常と違う支出を通知。[公式](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html) | AWSサービス | 無料の補助線。少額でゆっくり増える費用にはBudgetの固定閾値が必要 |
| aws-nuke | アカウント内リソースを大量削除。[ekristen/aws-nuke](https://github.com/ekristen/aws-nuke) | MIT。v3.66.0、2026-07 | 高リスク。学習専用AWSアカウントだけでdry-run確認後に使用。本番・個人共用アカウントでは不採用 |
| cloud-custodian | YAML policyで未使用、時間外、タグ違反リソースを検出・処理。[cloud-custodian/cloud-custodian](https://github.com/cloud-custodian/cloud-custodian) | Apache-2.0。0.9.51、2026-05 | 強力だが初期設定が大きい。単一静的サイトには過剰 |

旧`rebuy-de/aws-nuke`は2024-10にarchiveされ、現在は`ekristen/aws-nuke`が保守されているforkです。[移行案内](https://github.com/rebuy-de/aws-nuke)

### 個人学習AWSで事故を防ぐ順序

1. AWS Budgetsで実費$1、予測$5を通知
2. Cost Anomaly Detectionを有効化
3. 全学習リソースに`Project`、`Owner`、`ExpiresAt`タグ
4. IaCから作り、授業終了時に同じIaCでdestroy
5. AWS Resource Explorerで全Regionを横断確認
6. 月末にCost Explorerをサービス別・Region別で確認
7. aws-nukeは「学習専用アカウントを丸ごと捨てる場合」だけ

S3の小額費用だけでなく、CloudFront、Route 53 hosted zone、NAT Gateway、Elastic IP、RDS snapshot、CloudWatch Logs、Secrets Managerなどは、画面上で「サーバーを停止した」だけでは費用が残る場合があります。

---

# 6. いま5分で入れて、いちばん事故を防ぐ3つ

## 1. AWS Budget：実費$1・予測$5通知

`infra/billing-budget.yml`:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: Minimal cost guardrails for a personal learning account

Parameters:
  AlertEmail:
    Type: String
    Description: Email address that receives AWS budget alerts

Resources:
  LearningBudget:
    Type: AWS::Budgets::Budget
    Properties:
      Budget:
        BudgetName: personal-learning-monthly
        BudgetLimit:
          Amount: 5
          Unit: USD
        BudgetType: COST
        TimeUnit: MONTHLY
      NotificationsWithSubscribers:
        - Notification:
            ComparisonOperator: GREATER_THAN
            NotificationType: ACTUAL
            Threshold: 1
            ThresholdType: ABSOLUTE_VALUE
          Subscribers:
            - SubscriptionType: EMAIL
              Address: !Ref AlertEmail
        - Notification:
            ComparisonOperator: GREATER_THAN
            NotificationType: FORECASTED
            Threshold: 5
            ThresholdType: ABSOLUTE_VALUE
          Subscribers:
            - SubscriptionType: EMAIL
              Address: !Ref AlertEmail
```

適用例:

```bash
aws cloudformation deploy \
  --stack-name personal-learning-budget \
  --template-file infra/billing-budget.yml \
  --parameter-overrides AlertEmail=your-address@example.com
```

これは「課金を停止」する機能ではありませんが、気づかず月末まで放置する事故を最も早く検知します。Budget監視自体は無料です。

## 2. Gitleaks：AWSキー等を履歴込みで検査

ルートの `.github/workflows/secrets.yml`:

```yaml
name: Secret scan

on:
  pull_request:
  push:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout full history
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0

      - name: Scan committed secrets
        uses: gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e # v3.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

上記SHAは公式Actionの現行exampleで確認できます。[gitleaks公式example](https://github.com/gitleaks/gitleaks-action/blob/master/.github/workflows/example.yml)

注意点:

- Gitleaks本体はMITですが、`gitleaks-action` v2以降は独自EULAです。
- 個人アカウントはActionのlicense key不要。Organizationでは必要です。
- 検出された秘密は履歴から消すだけでなく、必ず失効・再発行します。

## 3. Dependabot：npmとActionsの放置を防ぐ

ルートの `.github/dependabot.yml`:

```yaml
version: 2

updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
      timezone: Asia/Tokyo
    open-pull-requests-limit: 3

  - package-ecosystem: npm
    directories:
      - /01.lesson/01.week1/nextcode-demo
      - /01.lesson/04.week4/tailwind-practice
      - /01.lesson/06.week6/memo-app/src
      - /02.homework/04.week4/tailwind
      - /02.homework/05.week5/web
    schedule:
      interval: weekly
      day: monday
      timezone: Asia/Tokyo
    open-pull-requests-limit: 5
    groups:
      npm-minor-and-patch:
        update-types:
          - minor
          - patch
```

これにより、package-lockとSHA固定したActionsを週次PRで更新できます。major更新はグループに入らないため、学習者が破壊的変更を個別に確認できます。

なお、これを機能させる前提として、現在のデプロイWorkflowもルートの `.github/workflows/` へ移してください。現状のネスト位置ではDependabotの`github-actions`対象にも、GitHub Actionsの実行対象にもなりません。