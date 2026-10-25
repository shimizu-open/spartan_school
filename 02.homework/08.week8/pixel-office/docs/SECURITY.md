# セキュリティ

調査日：2026-10-24。調べ方：GitHub API（リポジトリ情報・リリース・Security Advisory）、GitHub Advisory Database、`npm view`、`npm audit`。他人のコードは信頼できないものとして扱い、実行していません（ロックファイルの生成と静的な確認だけ）。

## 1. 既存 OSS の評価：フォークせず自作にした理由

| 候補 | ライセンス | 活動 | 監査結果 | 判断 |
|---|---|---|---|---|
| **WorkAdventure** | AGPL-3.0 に Commons Clause を追加 | 非常に活発（v1.34.4、2026-10-23） | 2026-08 に Critical の XSS（エモート経由、GHSA-rwrg-qwj3-p8xw）。1.33.2 で修正済み | ✕ 改変して公開するとソース公開の義務が生じ、有償 SaaS 化も禁止。本番構成だけで 7 サービスと大きすぎる |
| **SkyOffice** | MIT | 2024-02 で停止 | 同梱ロックファイルの版で critical 6・high 30。今の版で入れ直しても critical 3 が残る（mongoose / tar / swiper） | ✕ 下の設計欠陥があり、直すと実質書き直し |
| PopSpace ほか | GPL-2.0、ライセンス無し、など | 多くが停止 | — | ✕ |
| livekit-examples/spatial-audio | Apache-2.0 | 2025-03 | — | 参考実装として読むだけ |

SkyOffice で見つけた設計上の問題（同じことをしないための教訓）：

- **距離に関係なく、誰でも他人のカメラ・マイクを受信できる。** 公開の PeerJS サーバーを使い、かかってきた通話に相手を確かめずに自動応答しているため。近接判定もブラウザ側だけ。
- **管理画面が認証なしで公開されている**（`/colyseus` の monitor）。
- CORS が全開放。入力の検証・長さ制限・レート制限が無い。ルームを無制限に作れる。

## 2. このアプリの対策

| 脅威 | 対策 | 場所 |
|---|---|---|
| 部外者がファイルを見る・置く | アップロードとダウンロードには、入室時に配る合言葉（ランダム 24 バイト）が必要。退出すると合言葉は無効になる。ファイル ID も推測できない UUID | `server/models/Space.ts`（`playerByToken`）、`server/controllers/FileController.ts` |
| 悪意あるファイル（HTML や SVG に仕込んだスクリプト） | 種類は中身の先頭バイトで判定し、PNG / JPEG / GIF / WebP だけを画像として表示する。それ以外は `application/octet-stream` の「ダウンロード」扱い。配信時に `Content-Security-Policy: sandbox` と `nosniff` を付ける | `server/lib/sniff.ts`、`FileController.download` |
| ファイルやスペースで容量を埋め尽くす・パストラバーサル | 1 ファイル 20MB、スペースごとに 200MB / 100 個まで、サーバー全体で 10GB まで（`MAX_TOTAL_STORAGE_MB`）。保存できるスペースは 1000 個まで（`MAX_STORED_SPACES`）。アップロードは 5 秒に 1 回程度に制限。保存先のパスは ID の形式をチェックしてから組み立て、ファイル名は保存に使わない。必要なら `SPACE_RETENTION_DAYS` で古いスペースを自動削除できる | `server/lib/FileStorage.ts`、`shared/constants.ts` |
| 他人になりすまして付箋やファイルを消す | ブラウザごとにランダムな鍵（24 バイト）を作って保存する。サーバーはそのハッシュ値を「本人 ID」として使い、ほかの人にはハッシュ値しか見せない。鍵を知らない限り本人にはなれない | `server/models/Player.ts`（`uidFromKey`） |
| SQL インジェクション | データベースへの書き込み・読み出しは、すべてプレースホルダ付きのプリペアドステートメントで行う | `server/models/SpaceRepository.ts` |
| 付箋・ボードの荒らし | 付箋は自分の近くにだけ貼れて、はがせるのは本人だけ。ホワイトボードは近く（または同じ会議室）にいる人だけが使える。線のデータは色・太さ・点の数・座標の範囲を検証する | `server/models/Space.ts` |
| チャットの結果のごまかし | サイコロ・おみくじ・じゃんけんの結果はサーバーが決める（`crypto.randomInt`） | `server/models/Space.ts`（`runCommand`） |
| 遠くの人に盗聴される | 通話の準備メッセージは、**サーバーが自分の持つ位置で距離をチェックしてから**中継する。受ける側のブラウザも自分で距離を確認し、遠ければ断る | `shared/proximity.ts`（`maySignal`）、`server/controllers/SpaceSocketController.ts`、`client/src/controllers/RtcController.ts`（`onOffer`） |
| 壁抜け・座標の改ざん | サーバーで「マップの範囲内」かつ「壁でない」かを確認し、違反した移動は捨てる | `server/models/Player.ts`（`applyMove`） |
| 不正な入力・巨大データ | 名前・チャット・離席コメントは長さを制限し、制御文字や文字の向きを変える特殊文字を除去。アバターは番号の範囲をチェック。1 メッセージは 64KB まで | `shared/constants.ts`（`cleanText`、`sanitizeLook`）、`server/app.ts` |
| 連打・荒らし（DoS） | 接続ごとに種類別のレート制限（例：チャットは平均 1 件/秒、最大 5 件の連続）。スペースは 200 個まで、1 スペース 25 人まで | `server/lib/RateLimiter.ts`、`shared/constants.ts` |
| XSS（チャットや名前に HTML を仕込む） | 画面への表示は `textContent` だけで、`innerHTML` は使わない。CSP で外部スクリプトとインラインスクリプトも禁止 | `client/src/views/dom.ts`、`server/middleware/securityHeaders.ts` |
| 他サイトから接続される（CSWSH） | WebSocket 接続時に Origin ヘッダーを確認し、自分のドメイン以外は拒否 | `server/middleware/socketOrigin.ts` |
| クリックジャッキング・情報漏れ | `frame-ancestors 'none'`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、`nosniff`、Permissions-Policy | `server/middleware/securityHeaders.ts` |
| パストラバーサル | 静的ファイルは Express の `static` だけで配信（`../` は 404 になることを確認済み） | `server/routes/pageRoutes.ts` |
| 内部情報の漏れ | 送信データは View（`spaceView.ts`）で項目を明示して作る。`X-Powered-By` は消す | `server/views/spaceView.ts` |
| サプライチェーン攻撃 | 版を固定（`save-exact`）。依存パッケージのインストールスクリプトは実行しない（`ignore-scripts`）。公開から 2 週間未満の版は原則避ける（例外：公式のセキュリティ修正版） | `.npmrc`、`package-lock.json` |
| コンテナからの被害拡大 | root 以外のユーザーで実行。読み取り専用ファイルシステム（書き込めるのはデータ用ボリューム `/data` だけ）、権限（capability）をすべて外す、`no-new-privileges`、メモリ上限 | `Dockerfile`、`docker-compose.yml` |
| TURN を踏み台にされる・ただ乗りされる | TURN のパスワードは固定にせず、入室した人にだけ 12 時間で切れる一時パスワードを渡す（coturn の `use-auth-secret`）。内部ネットワーク（10.x、172.16.x、192.168.x、169.254.x = AWS のメタデータ）への中継は禁止。1 人あたり・全体の中継数と通信量にも上限。古い TLS は無効 | `server/lib/turn.ts`、`docker-compose.turn.yml` |
| メガホンやステージを悪用した盗み聞き | 自分のマイク・カメラ・画面は、**相手に自分の声が届く場合だけ**送る。判断は各自の端末がする。たとえばメガホン中の人には、遠くの聞き手の映像は送られない。相手がアプリを改造していても、こちらの端末が送らない | `client/src/controllers/RtcController.ts`（`maySend`） |
| 不正な通話データで相手の端末を重くする | 通話準備のメッセージは、サーバーと受け取る端末の両方が、型と長さを確かめて作り直す。保留中の通信経路の候補は 40 件まで。壊れた offer を受けたら、その通話は閉じる | `shared/signal.ts` |
| 会議室のホワイトボードを廊下から見る・消す | 会議室のボードは、同じ会議室の中にいる人だけが使える | `shared/map.ts`（`roomOfObject`）、`server/models/Space.ts` |
| ホワイトボードでディスクを埋める | 線のデータはスペースごとに 2MB まで。サーバー全体の容量上限には、ファイルに加えてデータベース自体の大きさも含める | `server/models/Space.ts`、`SpaceRepository.totalBytes` |
| アップロードでメモリを使い切らせる | 中身を受け取る**前に**、本人確認・サイズ・空き容量を確認する。同時に受け取るのは 4 件まで | `FileController.precheck` |
| 大量接続・スペースの作りすぎ | IP ごとの同時接続数（初期値 60）と、1 時間あたりの新規スペース作成数（初期値 20）に上限。IPv6 は /64 単位で数える。CloudFront の後ろでは、CloudFront が付けた送信元 IP だけを信用する。何も書き込まれていないスペースは保存しない | `server/middleware/ipLimits.ts`、`server/models/SpaceStore.ts` |
| 「近くの人」向けのファイルが全員に見える | 近くの人に送ったファイルには「見てよい人」の一覧を付け、通知・一覧・ダウンロードをその人たちに限る | `FileController.upload`、`Space.filesFor` / `mayRead` |
| 会議室のボードの線が外に流れる | 線と「全部消す」は、そのボードを使える人（同じ部屋の人）にだけ送る | `SpaceSocketController`（`boardUsers`） |
| ゆっくり送るアップロードで受付枠をふさぐ | 1 人 1 件まで、全体で 8 件まで。15 秒データが来ない、または 2 分で終わらなければ切断する | `FileController.precheck` |
| ホワイトボードを何度も開いて負荷をかける | 開く操作は約 3 秒に 1 回まで。「全部消す」は別の制限 | `SpaceSocketController` |
| URL に入った合言葉の悪用 | 合言葉を「見る用」と「アップロード用」に分けた。URL に入るのは見る用だけで、それではアップロードできない。アップロード用はヘッダーでしか送らない | `Space.playerByToken`、`SpaceModel.fileUrl` |
| CloudFront を迂回した直接アクセス | `ORIGIN_SECRET` を設定すると、CloudFront が付ける秘密のヘッダーがないリクエストを拒否する。HTTPS 運用時は HSTS も付ける | `server/middleware/originSecret.ts`、`securityHeaders.ts` |
| Electron の乗っ取り | `contextIsolation`・`sandbox` を有効、`nodeIntegration` を無効。カメラ・画面共有の許可は自分のサーバーからの要求だけ。別サイトへの遷移と新しいウィンドウは禁止（https のリンクは普通のブラウザで開く）。`<webview>` 禁止。Fuses で RunAsNode / NODE_OPTIONS / inspect を無効化し、ASAR の改ざん検知を有効化。接続先は https か localhost だけ | `desktop/main.cjs`、`desktop/package.json` |

## 3. 外部レビュー（2026-10-25）

Claude（別エージェント、実際に攻撃を試す形）と Codex（読み取り専用）の 2 つで独立にレビューしました。指摘された 13 件（重複を除く）はすべて修正し、自動テストで確認しています。
- 高：メガホン・ステージで遠くの人の映像を受け取れる
- 高：ホワイトボードでディスクを埋められる
- 中：近くの人向けファイルが全員に見える
- 中：会議室のボードを外から使える・線が外に流れる
- 中：アップロード枠の独占
- 中：ボードを開く操作での負荷
- 中：空のスペースで上限を埋められる
- 中：不正な通話データでブラウザのメモリが増える
- 中：TURN パスワードの露出
- 低：チャットの削減漏れ
- 低：URL の合言葉の悪用
- 低：AWS 構成の弱い点

## 4. 確認したこと

- `npm audit`：サーバー＋画面（260 パッケージ）、本番用だけ（76 パッケージ）、Electron（`desktop/`）のいずれも **0 件**。
- socket.io の依存は、2026 年の DoS 修正版以上であることを確認（engine.io 6.6.11、socket.io-parser 4.2.7、ws 8.21.3）。
- 自動テスト 37 件（`npm test`）。下記に加え、上の修正内容もそれぞれテストしている：
  - 会話のルール：距離、会議室の遮断、図書室の無音、ステージ、集中モード
  - マップ：全エリアへの到達可能性、使えるもの・イスの位置
  - 入力の拒否：不正な入力、壁抜け、遠い人への通話の中継
  - チャット：レート制限、近くの人チャットが遠くに届かないこと、サーバー側のサイコロ
  - ファイル：部外者のアップロード拒否、画像判定（PNG を中身で判定、SVG は必ずダウンロード扱い）、合言葉なしのダウンロード拒否、遠くへの設置拒否、本人以外の削除拒否、20MB 超の拒否
  - 付箋・ボード：付箋の距離と削除権限、ホワイトボードの距離と線データの検証
  - その他：セキュリティヘッダー、他サイトからの接続拒否
- 2 つのブラウザを使った実動作テスト：近づくと映像がつながり、離れると切れ、会議室では同じ部屋の人とだけつながること。`<img src=x onerror=alert(1)>` を送っても文字として表示されること。
- Electron：画面から `require`・`process` が見えないこと、外部サイトへの遷移と `window.open` が止まること、パッケージ後に Fuses が有効になっていることを確認。

## 5. 残っているリスクと運用のお願い

- **ログインが無い**：リンクを知っている人は入れます。社内用途なら CloudFront の手前に認証（Cognito、Cloudflare Access など）を置いてください。
- **メガホン中の人には、フロアの人の IP アドレスが分かる**：通話の準備でつながり方の情報（ICE 候補）を交換するためです。映像や音声は送られません。気になる場合は、TURN 経由だけでつなぐ設定にします。
- **大量アクセスへの備え**：アプリ側でも IP ごとの上限を設けていますが、AWS WAF のレートベースルールを CloudFront に付けるとより安心です。
- **更新を続けること**：Electron はサポート期間が短い（直近 3 メジャーのみ）ので、8 週ごとにメジャー更新を計画してください。GitHub の Dependabot を有効にし、`npm audit --omit=dev` を定期的に実行してください。
