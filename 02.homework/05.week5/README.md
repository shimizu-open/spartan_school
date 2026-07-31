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
`lines.json` の ES module 化、静的ファイルと自己ホストフォントのコピー、JavaScript の
配置を担当します。Tailwind CSS の生成は npm script から CLI を直接実行します。

AWS 用 JSON 内の `<ACCOUNT_ID>`、`<DISTRIBUTION_ID>`、`<OWNER>` と、GitHub Actions
Secrets / Variables はデプロイ先に合わせて設定してください。
