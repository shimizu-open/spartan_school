# 共通ブリーフ（第3ラウンド：本題）

## この調査の目的（ここを取り違えないこと）

依頼者の目的は **「学習サイトを作ること」** である。
「すでに自作したコードをライブラリで置き換える」ことではない（それは第1・2ラウンドで実施済み）。

依頼者の言葉:

> 学習サイトを作るということが目的。だからそれについて調べるのが重要。
> その後、今作っているものをそっち側に当てはめる。つまり抽象的な要素やコンセプト等、
> あとは具体的な内容をそっち側に当てはめる、又は部分的に作る、みたいな感じを想定してた。
> どういうアーキテクチャにすればいいのかな、どういうフレームワークが使えるのかな、
> そもそももうある程度の OSS はあるのかな。とか。
> なんでそれを調べるかというと、もうそれが使えるなら使いたいというのと、
> **そういうのを調べることにより「学習サイトを作るにはどのような要素・機能・ルール・処理等々が
> 必要か」を把握できる**でしょ。つまり必要な要素を OSS から把握して抽象的にも具体的にも捉えて、
> 最適なフレームワークを選択して作っちゃえるでしょ。

したがって、この調査には **2つの成果物**が要る。

1. **使える既製 OSS の特定**（そのまま採用 or fork できるものはあるか）
2. **「学習サイトの構成要素」の抽出** — 既存 OSS の設計から、ドメインモデル・機能・ルール・
   処理を読み取って言語化する。**これは「何を作ればいいか」の設計図になるので、
   OSS を採用しない場合でも価値がある。むしろこちらが本命。**

## 依頼者と現状

プログラミング学習中の個人（日本在住・日本語コンテンツ・独学）。
Node.js 22 / npm / 素の HTML・CSS・JavaScript。AWS S3+CloudFront で公開中（Cloudflare Pages も検討）。
無料〜低コスト。ひとりで運用する。**受講者は当面「自分ひとり」だが、将来公開する可能性はある。**

### いま手元にある「学習サイトの素材」

```
/home/shimizu/study/spartan_school
├── 01.lesson/            週ごとの授業メモ（week1〜week6）
├── 02.homework/
│   ├── 01.week1/linux/   Linux Story Quest — コマンド学習ゲーム（JS 1,119行）
│   │                     仮想ファイルシステム、コマンド解析、ステージ進行、判定を自作
│   ├── 01.week1/git/     Git Dungeon — Git 学習 RPG（JS 1,063行）
│   │                     マップ移動、Git状態モデル、クエスト判定を自作
│   ├── 04.week4/         Tailwind 練習
│   └── 05.week5/web/     「かけら」— localStorage だけで動く静的 SPA（1,996行）
│                         習慣記録アプリ。60日後に過去を読み返せる、という時間ルールを持つ
├── 03.learning_site/     The Scholar's Casebook — 手書き静的HTMLの学習ブログ兼ポートフォリオ
│   ├── articles/         学習記録の記事4本（AWS/DNS/HTTPS/サブドメイン委任）+ 手作りPNG図解
│   └── works/            上記ゲームのコピー（＝成果物の展示室）
└── laboratory/           調査結果の置き場
```

つまり素材として **「読み物（記事）」「手を動かす教材（ゲーム）」「習慣化アプリ」「授業メモ」
「成果物の展示」** が既にある。これらを載せる器を探している。

## 出力の必須要件（全トラック共通）

1. **日本語**で書く。
2. 各 OSS について必ず: `名前 / 一行説明 / リポジトリ URL / ライセンス / 現在も活発か
   （最終リリース時期の目安）/ 規模感（ひとりで運用できるか）/ 採用コスト / 注意点・不採用理由`。
3. **推測で URL・バージョン・スター数を書かない**。web search で裏を取れた情報だけ。
   確認できなかった項目は「未確認」と明記する。
4. **単なるカタログにしないこと。** 各 OSS について
   **「この OSS はどういうドメインモデルを持っているか（何を第一級の概念として扱っているか）」**
   を必ず書く。それが依頼者の言う「必要な要素の把握」にあたる。
5. 第一推奨を1つ明示し、理由を述べる。
6. Markdown 見出し構造。他文書と結合しやすい形。

## すでに第1・2ラウンドで調査済み（重複させない）

SSG（Astro/Eleventy/Hugo/Zola/Jekyll）、Astro テーマ、Content Collections、MDX、remark、Shiki、
Pagefind/Lunr/Fuse/Orama/MiniSearch、画像最適化、RSS/sitemap/Satori、giscus、Umami/Plausible、
monorepo ツール、Vite/esbuild、lit-html/Preact/Alpine/Solid/Svelte/VanJS、navaid/wouter、
nanostores/zustand/valtio、idb-keyval/Dexie/localForage/RxDB、Zod/Valibot、vite-plugin-pwa/Workbox、
terser/swc/oxc、date-fns/Day.js/Luxon/Temporal、Fontsource/subfont/glyphhanger、Tailwind v4、
Biome/ESLint/oxlint、node:test/Vitest/Playwright、CDK/OpenTofu/Terraform/Pulumi/SST、
Cloudflare Pages/GitHub Pages/Netlify/Vercel、html-validate/lychee/pa11y/Lighthouse CI、
Learn Git Branching/Bashcrawl/Bandit/tldr/explainshell/Oh My Git/git-sim、
Twine/Ink/Phaser/KAPLAY/xterm.js/v86/js-dos、Quartz/Foam/Logseq。

**第2ラウンドで現在調査中（重複させない）**: Mermaid/D2/Excalidraw 等の図解コード化、
BudouX/textlint/kuromoji 等の日本語処理、isomorphic-git/WebVM/ZenFS/XState、
Starlight/VitePress/Docusaurus/mdBook、Decap/Keystatic/Sveltia CMS、Slidev/Marp/reveal.js、
roadmap.sh/Odin/freeCodeCamp/build-your-own-x、Anki/FSRS、Renovate/gitleaks/lefthook、
Pico.css/Open Props/CSS リセット。

これらは**必要なら一行触れる程度**にして、この第3ラウンドは「学習サイトそのもの」に集中する。
