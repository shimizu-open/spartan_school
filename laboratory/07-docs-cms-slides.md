# 07. ドキュメント基盤 / CMS / スライド / 学習リソース

調査: codex + web search（2026-08-25）／track7
※ 本題側の結論は [13-ready-made-oss.md](13-ready-made-oss.md) と [12-architecture.md](12-architecture.md) に統合済み。
   この章は**そこに収まらなかった実務情報**をまとめる。

---

## 1. ドキュメント基盤の比較 → 13章へ統合

**結論: Starlight。** 「現在の4記事は日付順ブログではなく、Case No.0 から順番に理解する教材」
という判断が根拠。詳細な比較表は [13-ready-made-oss.md](13-ready-made-oss.md) を参照。

### 日本語全文検索の対応状況（各フレームワーク標準）

| フレームワーク | 標準検索 | 日本語の扱い |
|---|---|---|
| **Starlight** | **Pagefind** | **良好**。ビルド時索引＋ブラウザ側 CJK 分割。追加サーバー不要 |
| **Nextra** | Pagefind | **良好** |
| Material for MkDocs | Lunr + lunr-languages | `lang: ja` を**公式サポート**。クライアント側で分割 |
| VitePress | MiniSearch | UI は標準搭載だが、**日本語複合語の精度は要検証**。`tokenize`/`processTerm` の調整余地 |
| Docusaurus | Algolia DocSearch が公式第一 | **ローカル検索はコミュニティプラグインで公式標準ではない** |
| mdBook | elasticlunr | **英語・空白区切り中心。日本語形態素解析は期待しにくい** |
| Docsify | search plugin + IndexedDB | **日本語分割の公式保証は確認できず** |

> **日本語サイトでは、追加設定なしで Pagefind を使える Starlight が最も安全。**

---

## 2. スライド — Marp CLI

`02.homework/05.week5/docs/PRESENTATION.md` は**すでに Markdown で `---` による6区切り**があり、
発表ツールへ移す前提がほぼ整っている。

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **Marp CLI** ★ | [marp-team/marp-cli](https://github.com/marp-team/marp-cli) · MIT · **v4.5.0（2026-07-17）** | **第一推奨**。HTML/PDF/PPTX/画像へ変換。**現行 Markdown を最小変更で使える** |
| **Marp for VS Code** | [marp-team/marp-vscode](https://github.com/marp-team/marp-vscode) · MIT · v3.5.1（2026-05） | エディタ内プレビュー。CLI と併用 |
| **Slidev** | [slidevjs/slidev](https://github.com/slidevjs/slidev) · MIT · **v52.15.2（2026-05-10）** | ライブコード・Mermaid・発表者画面。**依存が大きい**。必要になってから |
| **reveal.js** | [hakimel/reveal.js](https://github.com/hakimel/reveal.js) · MIT · **v6.0.1（2026-04-11）** | ネストスライド・アニメーション。HTML 設定が増える |
| **Spectacle** | [FormidableLabs/spectacle](https://github.com/FormidableLabs/spectacle) · MIT · 最新日時未確認 | React 中心。Markdown 中心の本件には高コスト |
| **remark slideshow** | [gnab/remark](https://github.com/gnab/remark) · MIT · **近年の保守を確認できず** | **名称衝突にも注意**（`remark` 処理系と別物） |

### 日本語フォントの注意

PDF で文字化けや代替フォント置換を防ぐには、**Web フォントを外部 CDN に依存させず、
ローカル配布して明示する**。Marp/Slidev の PDF 生成はブラウザレンダリングなので、
**CI 環境にも同じフォントを用意する必要がある**。

```css
@font-face {
  font-family: "Presentation JP";
  src: url("./fonts/subset.woff2") format("woff2");
  font-display: swap;
}
section { font-family: "Presentation JP", "Yu Gothic", "Hiragino Sans", sans-serif; }
```

### 学習サイトへの埋め込み

1. Marp で HTML と PDF を生成し `/slides/kakera/` と `/slides/kakera.pdf` に配置
2. 記事内にはサムネイル＋「スライドを開く」「PDF」のリンク

インライン表示が必要なときだけ同一オリジンの iframe。
⚠ **CSP で `frame-ancestors 'none'` を返していると iframe 表示できない。**

> 現行の `PRESENTATION.md` は1区切りの情報量が多いので、
> **表や画像を含む部分をさらに分割し 10〜14枚程度**にすると読みやすい。

---

## 3. 学習リソース — 「自作する前に既存の学びを使う」

⚠ **ライセンスに要注意。リンクは自由でも、転載は条件がある。**

| 名前 | リポジトリ / ライセンス | 注意点 |
|---|---|---|
| **roadmap.sh** | [kamranahmedse/developer-roadmap](https://github.com/kamranahmedse/developer-roadmap) · **サイトコンテンツ再配布禁止** | **リンクのみ**。進捗表をコピーせず、自分用チェックリストだけ作る |
| **The Odin Project** | [TheOdinProject/curriculum](https://github.com/TheOdinProject/curriculum) · **教材 CC BY-NC-SA**、コード MIT | **非商用**・帰属・同一条件 |
| **freeCodeCamp** | [freeCodeCamp/freeCodeCamp](https://github.com/freeCodeCamp/freeCodeCamp) · コード BSD-3-Clause、**教材 CC BY-SA 4.0** | 帰属＋同一条件 |
| **MDN Learn** | [mdn/content](https://github.com/mdn/content) · **文書 CC BY-SA 2.5-or-later**、近年のコード例 CC0 | **日本語あり**。出典・ライセンス・変更点を明記 |
| **web.dev** | [GoogleChrome/web.dev](https://github.com/GoogleChrome/web.dev) · 記事 **CC BY 4.0**、サンプル Apache-2.0 | ページ個別表記があればそちらを優先 |
| **Full Stack Open** | [fullstack-hy2020](https://github.com/fullstack-hy2020/fullstack-hy2020.github.io) · **CC BY-NC-SA 3.0** | **日本語版あり**。非営利 |
| **build-your-own-x** | [codecrafters-io/build-your-own-x](https://github.com/codecrafters-io/build-your-own-x) · **CC0** | リスト自体は自由。**リンク先教材のライセンスは別** |
| **Project Based Learning** | [practical-tutorials/project-based-learning](https://github.com/practical-tutorials/project-based-learning) · MIT | **MIT はリンク先本文には波及しない** |
| **System Design Primer** | [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer) · **CC BY 4.0** | 転載・翻訳時は作者・URL・ライセンス・変更点を表示 |
| **AWS Skill Builder** | OSS repo なし・AWS 独自著作物 | **教材転載不可**。リンクと自分の理解による要約に留める |
| **aws-samples** | [aws-samples](https://github.com/aws-samples) · **repo ごとに MIT-0/MIT/Apache-2.0 等** | **必ず個別 repo の LICENSE 確認**。非サポートなので本番前に安全性・コスト再検証 |
| **Cloud Resume Challenge** | [cloudresumechallenge/projects](https://github.com/cloudresumechallenge/projects) · MIT | **現在の学習サイトを課題成果物へ発展できる**。実 AWS 料金に注意 |

### 引用時の最低ルール

```
タイトル / 著者・プロジェクト名 / 元URL / ライセンス名とURL /
原文か翻訳・要約・改変か / 変更した場合は変更内容
```

⚠ **MIT や Apache-2.0 は主にソフトウェアライセンスであり、
リンク先記事の転載許可を自動的に与えるものではない。**

### 使い分け

- Web 基礎 → **MDN Learn を正本に**
- 総合カリキュラム → The Odin Project または Full Stack Open
- AWS → Skill Builder で概念 → `aws-samples` で実装確認 → Cloud Resume Challenge で統合
- **自作記事 → 教材の複製ではなく「自分が誤解した点」「実際に構築して分かった点」を書く**

---

## 4. Git ベース CMS → 13章へ統合

**結論: 今は不要。** Markdown ＋ VS Code で十分。
「スマホから更新したい」「Git を知らない編集者が加わる」段階で **Sveltia CMS**。

---

## 5. ノート環境 — Zettlr

| 名前 | リポジトリ / ライセンス / 活動 | 判定 |
|---|---|---|
| **Zettlr** ★ | [Zettlr/Zettlr](https://github.com/Zettlr/Zettlr) · **GPL-3.0** · **v4.5.0（2026-05-08）** | **推奨**。Starlight と同じ Markdown フォルダを直接開ける。**export 作業が要らない** |
| **SilverBullet** | [silverbulletmd/silverbullet](https://github.com/silverbulletmd/silverbullet) · MIT · **v2.10.0（2026-07-28）** | ローカルサーバーが必要。Lua 自動化は強力だが学習コストあり |
| **Joplin** | [laurent22/joplin](https://github.com/laurent22/joplin) · AGPL-3.0-or-later · 活発 | **内部 DB 中心**。content フォルダを直接編集する用途には弱い |

---

## 6. 読み物としての品質

| 名前 | リポジトリ / ライセンス | 判定 |
|---|---|---|
| **reading-time** | [ngryman/reading-time](https://github.com/ngryman/reading-time) · MIT · 最新未確認 | 低コスト。⚠ **日本語は文字数／分を実測して調整する** |
| **Tocbot** | [tscanlin/tocbot](https://github.com/tscanlin/tocbot) · MIT · v4.32.2 | **Starlight 採用後は不要** |
| **rehype-external-links** | [rehypejs/rehype-external-links](https://github.com/rehypejs/rehype-external-links) · MIT · v3.0.0（約3年前） | **新規タブを強制しない設定が望ましい** |

> **外部サイトであることと、新しいタブを開くことは別。**
> 原則は同じタブで開き、`target="_blank"` が必要な場合だけ
> 視覚アイコンと読み上げ用の「新しいタブで開く」を付ける（W3C G201）。

---

## 7. 間隔反復・学習ログ → 12章へ統合

- **SRS**: サイトに再実装せず、まず **Anki** をそのまま使う。
  サイト内に作るなら `ts-fsrs`（→ 12章）
- **学習ログ可視化**: Cal-Heatmap（MIT）。
  ⚠ **ただし「かけら」は連続日数・達成率を意図的に持たない設計**なので、
  「連続記録」「未達」を強調せず、月ごとの学習量や分野の分布だけを表示する
