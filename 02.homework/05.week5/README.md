# かけら

「拾って、とっておく。」ための、端末内だけで動く静的 Web アプリです。

## 必要なもの

- Node.js 22（`web/.nvmrc`）
- npm

## ビルド

```bash
cd web
npm ci
npm run build
```

成果物は `web/dist/` に生成されます。確認時は任意の静的ファイルサーバーで
`web/dist/` を配信してください。

## 保存と控え

記録はブラウザの `localStorage` にだけ保存され、外部へ送信されません。
ブラウザのデータ削除や機種変更では消えるため、「このアプリについて」から JSON
形式の控えを取得できます。

## 構成

基本構成と責務は `docs/STRUCTURE.md` に従います。ビルドを一コマンドにまとめるため、
定義済みツリーとの差分として `web/scripts/build.js` を追加しています。このスクリプトは
`lines.json` の ES module 化、静的ファイルの配置、Tailwind CSS の生成、fontsource からの
`@font-face` 生成と自己ホストフォントのコピー、JavaScript の圧縮を担当します。

`npm run build` で生成した配信物のサイズ内訳は次のとおりです。フォント本体は
`unicode-range` で分割されているため、ブラウザは画面内の文字に必要な `woff2` サブセットだけを取得します。

| 区分 | 対象 | ファイル数 | 非圧縮サイズ | gzip サイズ |
|---|---|---:|---:|---:|
| アプリ本体 | `dist/`（`assets/fonts.css` と `fonts/` を除く） | 17 | 69,375 bytes | 25,882 bytes |
| フォント定義 | `dist/assets/fonts.css` | 1（`@font-face` 243 件） | 189,405 bytes | 57,645 bytes |
| フォント本体 | `dist/fonts/*.woff2` | 243 | 4,053,072 bytes | 圧縮済み形式のため対象外 |

AWS 用 JSON 内の `<ACCOUNT_ID>`、`<DISTRIBUTION_ID>`、`<OWNER>` と、GitHub Actions
Secrets / Variables はデプロイ先に合わせて設定してください。
