# 共通ブリーフ（第2ラウンド：第1ラウンドで抜けた領域）

## 依頼者
プログラミング学習中の個人（日本在住・日本語コンテンツ）。学習記録サイトと学習用 Web アプリ、
学習ゲームを**すべてゼロから手書き**で作ってしまい、「先に良い OSS を探すべきだった」と考えている。

## 対象リポジトリ `/home/shimizu/study/spartan_school`

```
01.lesson/            授業メモ
02.homework/
  01.week1/linux/     Linux Story Quest（HTML 151 / JS 1,119 / CSS 1,133 行）
  01.week1/git/       Git Dungeon（HTML 123 / JS 1,063 / CSS 741 行）
  05.week5/web/       「かけら」= localStorage だけで動く静的 SPA（計 1,996 行）
  05.week5/docs/      REQUIREMENTS/DESIGN/DEPLOY/STUDY/PRESENTATION.md などの設計文書
  05.week5/infra/     S3/CloudFront/IAM の生 JSON 手書き
03.learning_site/     手書き静的 HTML の学習ブログ兼ポートフォリオ
  articles/           記事4本を素の HTML で手書き
  articles/images/    **手作りの PNG 図解 18枚以上**
  assets/             ヴィクトリア朝テーマの CSS 303 行 + サムネ PNG
laboratory/           ← 調査結果の置き場（第1ラウンド済み）
```

## 第1ラウンドで**すでに調査済み**（重複させないこと）

- SSG（Astro/Eleventy/Hugo/Zola/Jekyll/Next）、Astro テーマ、Content Collections、MDX、
  remark 系、Shiki/Prism
- サイト内検索（Pagefind / Lunr / Fuse / Orama / MiniSearch）
- 画像最適化（astro:assets / sharp / eleventy-img / OxiPNG / pngquant / Squoosh）
- RSS/sitemap/Satori OGP、giscus/utterances、GoAccess/Umami/Plausible
- monorepo（vite-plugin-static-copy / npm workspaces / Turborepo / Nx / submodule）
- ビルド（Vite/esbuild/Rolldown/Parcel/Bun）、UI（lit-html/Preact+htm/Alpine/Solid/Svelte/VanJS）
- ルーター（navaid/page.js/wouter/Navigation API）、状態管理（nanostores/zustand/valtio/signals）
- 永続化（idb-keyval/Dexie/localForage/RxDB）、検証（Zod/Valibot/ArkType）
- PWA（vite-plugin-pwa/Workbox）、minifier（terser/esbuild/swc/oxc/uglify）
- 圧縮（lz-string/fflate/pako/brotli-wasm）、日付（date-fns/Day.js/Luxon/Temporal）
- フォント（Fontsource/subfont/glyphhanger/fonttools）、Tailwind v4
- Lint/型/テスト/サイズ（Biome/ESLint/oxlint/Prettier/checkJs/node:test/Vitest/Playwright/size-limit）
- IaC（CDK/OpenTofu/Terraform/CloudFormation/SST/Pulumi）、ホスティング（S3+CF/Cloudflare Pages/
  GitHub Pages/Netlify/Vercel/Deno Deploy）、GitHub Actions、
  品質 CI（html-validate/lychee/pa11y-ci/Lighthouse CI/unlighthouse/axe-core）
- 学習教材（Learn Git Branching/Bashcrawl/Bandit/tldr/explainshell/Oh My Git/git-sim/Killercoda）
- ゲームエンジン（Twine/Ink/Phaser/KAPLAY/Ren'Py/xterm.js/WebContainers/v86/js-dos）
- デジタルガーデン（Quartz/Foam/Logseq/TIL 方式）

**上記はもう書かなくてよい。参照が必要なときだけ一行触れる程度にする。**

## 依頼者の前提・制約
- 言語は HTML/CSS/素の JavaScript。Node.js 22。npm。
- ホスティングは AWS S3 + CloudFront（Cloudflare Pages への移行も検討中）。CI は GitHub Actions。
- 個人学習用。無料〜低コスト。**日本語コンテンツ**が前提。
- 学習目的なので「中身を理解できる」ことも重視するが、車輪の再発明で時間を溶かしたくない。

## 出力の必須要件（全トラック共通）
1. **日本語**で書く。
2. 各候補について必ず: `名前 / 一行説明 / リポジトリ URL / ライセンス / 現在も活発か
   （最終リリース時期の目安）/ このケースで何が置き換わるか / 採用コスト / 注意点・不採用理由`。
3. **推測で URL・バージョン・スター数を書かない**。web search で裏を取れた情報だけを書く。
   確認できなかった項目は「未確認」と明記する。
4. 候補を羅列するだけでなく、**「この人ならこれ」という第一推奨を1つ**明示し、理由を 2〜3 行で述べる。
5. 「導入しないほうがよい／自作のままでよい」領域があるなら正直に書く。
6. Markdown 見出し構造にする。他の文書と結合しやすい形。
7. 可能なら実物を読んで、**具体的にどのファイルの何行が置き換わるか**を書く。
