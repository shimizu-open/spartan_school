# 05. 図解のコード化・SVG・日本語まわり

対象: `03.learning_site/articles/images/`（PNG 26枚 / 約69MB）と日本語コンテンツ全般
調査: codex + web search（2026-08-25）／track5

> **なぜ重要か**: 01章の「画像最適化」は**対症療法**だった。
> 図をコードで書けば、数KB になり、git 差分が読め、修正が容易になる。**根治側の章。**

---

## 結論 — 技術図は D2 へ。挿絵は PNG のまま

**26枚すべてをコード化するべきではない。** 実物を全枚確認した上での分類:

| 場所 | 枚数 | 内容 | 判断 |
|---|---:|---|---|
| `articles/images/00〜09` | 10 | DNS・HTTPS・CloudFront・OAC などの**説明図** | **6枚をコード化**、4枚は挿絵併用 |
| `articles/images/10〜18` | 9 | 領地・台帳・封蝋などの**ヴィクトリア朝の物語挿絵** | **PNG として維持** |
| `assets/hero.png` | 1 | サイトの主ビジュアル | 維持 |
| `assets/thumb-*.png` | 6 | サムネイル | 維持 |
| **合計** | **26** | **約69MB** | **技術図と美術資産を分離する** |

技術図は約 1.0〜1.8MB、**ヴィクトリア朝の挿絵・サムネイルは約 3.3〜4.2MB**。
→ **容量の大半は「コード化できない美術資産」の側にある。**
そちらは 01章の画像最適化（`astro:assets` で WebP/AVIF + srcset）で対処する。

### コード化する6枚

| 画像 | 移行案 |
|---|---|
| `03_ns_delegation.png` | D2。レジストラと権威DNSの境界をコンテナ化 |
| `02_dns_resolution.png` | D2 の番号付きフロー |
| `08_subdomain_concept.png` | D2 の階層・分岐図（**特に相性がよい**） |
| `01_overview.png` | D2。利用者→お名前.com→Route 53→ACM→CloudFront |
| `09_s3_oac.png` | D2、または PlantUML + AWS アイコン |
| `04_https_cert.png` | Mermaid `sequenceDiagram` または D2 |

### 構造図と挿絵を併用する2枚

- `00_visual_abstract.png` — 「SETUP」と「EVERY ACCESS」を D2 で別図化。
  **現在のポスターは記事末の総括挿絵として残せる**
- `05_cdn_edge.png` — オリジン→エッジ→利用者はコード化できるが、**世界地図の視覚効果は残す価値がある**

---

## 1. 図解ツール比較

凡例: ◎=適する ○=可能 △=制約あり ×=不向き

| 名前 | テキスト・Git差分 | ビルド時SVG | 日本語・フォント | 手描き/古典調 | AWSアイコン |
|---|---|---|---|---|---|
| **D2** ★ | ◎ | ◎ | **◎** | **◎ スケッチ描画** | ○ 外部SVG |
| Mermaid | ◎ | ◎ | ○ | ○ hand-drawn look | ○ Iconify |
| PlantUML | ◎ | ◎ | ○ JVMフォント依存 | △ | **◎ AWS stdlib** |
| Graphviz DOT | ◎ | ◎ | ○ Pango依存 | △ クラシック技術図 | △ |
| Structurizr | ◎ | ◎ | ○ | × | ○ |
| Pikchr | ◎ | ◎ | ○ | ○ 古典的線画 | × |
| svgbob | ◎ | ◎ | △ 等幅幅計算 | ○ ASCII風 | × |
| WaveDrom | ◎ | ◎ | △ | × | × |
| Excalidraw | **△ JSON差分** | ◎ エクスポート | ○ | **◎** | ○ |
| draw.io | **△ XML差分** | ◎ エクスポート | ○ | △ | ◎ |
| tldraw | **△ JSON差分** | ○ | ○ | ◎ | △ |

### D2 — 第一推奨

- [d2lang/d2](https://github.com/d2lang/d2) · **MPL-2.0** · 2026-08 も更新（最新タグ番号は未確認）
- **日本語**: CJK を正式に扱い、カスタムフォント指定も可能
- **見た目**: sketch モードとカスタムテーマで、**黒インク・セピア・羊皮紙調に寄せられる**
  → ヴィクトリア朝テーマと合う
- **AWS**: SVG アイコンをノードに設定可能。ただし PlantUML ほど完成した AWS 標準ライブラリではない
- **注意点**: **自動レイアウト結果がバージョン更新で変わる可能性がある。CI ではバージョンを固定する**

**Astro への組み込み**: [astro-d2](https://github.com/HiDeoo/astro-d2) で
**ビルド時に SVG を生成**する。ブラウザへ描画用 JavaScript を送らず、
S3 + CloudFront へ**完成済み SVG だけを配信**できる。

> **ビルド時 SVG vs クライアント描画**:
> Artifact 等ではクライアント描画（```mermaid フェンス）も使えるが、
> **自分のサイトではビルド時 SVG 一択**。JS 不要・初回表示が速い・印刷可能・SEO に載る。

---

## 2. SVG とアイコン

- **SVGO** — 採用。SVG 最適化の定番
- **svgcleaner** — 不採用
- アイコンセット: Lucide / Tabler / Phosphor / Heroicons / Iconify / Simple Icons /
  **AWS Architecture Icons（ライセンス要確認）**
- ビルド時インライン化: `astro-icon`, `unplugin-icons`

---

## 3. 日本語まわり — 第1ラウンドで完全に抜けていた領域

### BudouX — 第一優先

- [google/budoux](https://github.com/google/budoux) · **Apache-2.0** · **npm 0.9.0（2026-08）**
- **日本語を読みやすい文節で区切り、自然な改行位置を生成する軽量分かち書き器**
- **置き換わるもの**: 見出しに手作業で入れている `<br>`
  （現在 `case-01:30` `case-02:30` `case-03:30` に手動 `<br>` がある）
- **採用コスト**: 低。Astro ビルド時処理または Web Component
- ⚠ **形態素解析器ではない。本文全体ではなく、見出し・カードタイトルに限定する**

```css
.heading-ja {
  word-break: keep-all;
  overflow-wrap: anywhere;
}
```

### Yaku Han JP / MP — 約物詰め

- [qrac/yakuhanjp](https://github.com/qrac/yakuhanjp) · **OFL-1.1 AND MIT** · 4.1.1 系（2026 更新）
- 句読点・括弧などの**約物だけを半角幅へ調整**する日本語 Web フォント
- 現状 `style.css:18` は Cormorant Garamond + 日本語明朝の組み合わせ
  → **ゴシック用 YakuHanJP より、明朝用の YakuHanMP を先頭に置くほうが合う**

```css
font-family: "Yaku Han MP", "Cormorant Garamond", "Yu Mincho", "游明朝", serif;
```

⚠ **本文すべてへ直ちに適用せず、見出し・カード・キャプションで視覚比較してから広げる**
（`yakuhanmp` は別プロジェクトではなく YakuHanJP パッケージに含まれる明朝用 CSS）

### textlint — 日本語校正

- [textlint/textlint](https://github.com/textlint/textlint) · **MIT** · **v15.8.0（2026-08）**
- [textlint-ja/textlint-rule-preset-ja-technical-writing](https://github.com/textlint-ja/textlint-rule-preset-ja-technical-writing)
  · **MIT** · **v12.0.2（2026-01）**、2026-07 も更新
- 冗長表現・長すぎる文・同一助詞・弱い表現の検出
- ⚠ **物語調の記事にデフォルトをそのまま当てると厳しすぎる。文長や感嘆符を調整する**
- ⚠ **Markdown 原稿へ実行する**（生成後 HTML ではなく）。Markdown 移行後に本領を発揮

### 形態素解析器（日本語検索の品質向上）

01章で「Pagefind の `Intl.Segmenter` は形態素解析器ではない」と限界を書いた、その先の選択肢。
kuromoji.js / lindera / vibrato / TinySegmenter — 詳細は `raw/track5-*.md` を参照。

> **ただし**: 記事数十本の規模では Pagefind + frontmatter の `searchTerms`（別表記）で
> 十分な可能性が高い。形態素解析器の導入は、検索品質に実際に不満が出てからでよい。

---

## 4. 69MB・26枚の移行手順

### フェーズ1: 原本と派生物を分離

1. **現在の PNG を削除せず**、まず一覧表を作る
2. 各画像に分類を付ける: `diagram-code` / `diagram-hybrid` / `illustration` / `hero` / `thumbnail`
3. 原本を分ける:

```
src/
  diagrams/          ← D2 ソース（git 差分が読める）
    overview.d2
    dns-resolution.d2
    ns-delegation.d2
    https-cert.d2
    subdomain-concept.d2
    s3-oac.d2
  illustrations/
    source/          ← 挿絵の原本（最適化前）
  icons/aws/
public/
  generated-diagrams/  ← ビルド生成 SVG
  illustrations/       ← 最適化済み画像
```

### フェーズ2: まず6枚だけコード化

難易度が低く効果を確認しやすい順:

1. `03_ns_delegation.png`
2. `02_dns_resolution.png`
3. `08_subdomain_concept.png`
4. `01_overview.png`
5. `09_s3_oac.png`
6. `04_https_cert.png`

**各図で確認する項目:**

- [ ] **360px 幅で日本語が欠けない**
- [ ] SVG に `role="img"`、タイトル、説明がある（アクセシビリティ）
- [ ] セピア・黒・深緑の既存配色に合う
- [ ] **CI とローカルでレイアウトが一致する**（D2 のバージョン固定）
- [ ] **ソース差分だけで変更内容をレビューできる**
- [ ] **元 PNG より内容が理解しやすい** ← これが満たせないならコード化しない

### フェーズ3: 残りは画像最適化で対処

挿絵・ヒーロー・サムネイル（約 60MB 分）は **01章の `astro:assets`** へ。
原本を lossy 圧縮で上書きせず、ビルド成果物だけ WebP/AVIF 化する。
