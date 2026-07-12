# The Scholar's Casebook — 学習記録・制作物サイト

シャーロック・ホームズの書斎をイメージした、静的HTMLのポートフォリオ兼学習ブログ。
トップページは2部構成:**Case Files(学習記録)** と **Exhibition(制作物展示室)**。
学習記録もそれ自体が制作物、という思想で両方を載せる。

## 構成

```
03.learning_site/
├── index.html              # トップ(Case Files + Exhibition の2セクション)
├── about.html              # このサイトについて
├── README.md               # このファイル
├── assets/
│   ├── style.css           # 共通スタイル(ヴィクトリア朝テーマ)
│   ├── hero.png            # トップのヒーローバナー
│   └── thumb-*.png         # カードのサムネイル
├── articles/               # 学習記録(1テーマ1ページ)
│   ├── case-01-domain-https.html
│   ├── case-02-subdomain-s3.html
│   └── images/             # 記事内の図解
└── works/                  # 制作物(1作品1フォルダ、自己完結)
    ├── linux-story-quest/  # Linuxコマンド学習ゲーム(02.homework/01.week1/linux のコピー)
    └── git-dungeon/        # Git学習RPG(02.homework/01.week1/git のコピー)
```

> works/ 配下は 02.homework からの**コピー**。原本を更新したら再コピーすること
> (サイト単体でデプロイできる自己完結性を優先した設計)。

## 新しい学習記録(記事)の足し方

1. `articles/case-XX-スラッグ.html` を作る(既存記事をコピーして中身を差し替えるのが早い)
2. 図解は `articles/images/` に置き、記事から `images/xxx.png` で参照
3. サムネイルを `assets/` に用意(codex の image gen で「Victorian etching-style vignette, sepia and gold tones, NO text」指定が今のテイスト)
4. `index.html` の Case Files セクションの `.card-grid` にカードを1枚追加(「未解決事件」プレースホルダーの上に挿入)

## 新しい制作物の足し方

1. 作品一式を `works/作品名/` にコピー(エントリポイントは `index.html` にする)
2. サムネイルを `assets/thumb-作品名.png` に用意(テイスト指定は上と同じ)
3. `index.html` の Exhibition セクションにカードを1枚追加(リンクは `works/作品名/index.html`、
   メタ欄は「遊ぶ →」「見る →」など作品に合わせる)

## ローカルで見る

```bash
cd 03.learning_site && python3 -m http.server 8000
# → http://localhost:8000
```

file:// で index.html を直接開いても動く(外部依存ゼロ・全部自前のCSS)。

## デザインの約束事

- 配色は `style.css` の `:root` 変数(羊皮紙 / インク / 金 / 深緑 / 弁柄色)
- 記事の書式:リード文は `class="lead"`(ドロップキャップ)、章見出しは `<h2><span class="chap">I.</span>…`、
  補足は `.notecard`(◆ 意味)、警告は `.notecard.warn`、名言は `blockquote.deduction`
- 画像は `class="fig"` + 直後に `.figcap` でキャプション
