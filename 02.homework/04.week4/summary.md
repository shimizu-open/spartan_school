# Week4 サブドメイン委任(方法a)まとめ — minacousj.agi-japan.com

## 前提(誰が何を持っているか)

- **私**: ドメイン `agi-japan.com` の持ち主(Route 53 ホストゾーン = 電話帳)
- **同期(minacousj)**: サイトの資源の持ち主(S3 = 倉庫、CloudFront = 店)
- **ゴール**: `https://minacousj.agi-japan.com` で同期のサイトが鍵マーク付きで開く

一言でいうと:**「名前の世界(私の領土)」と「モノの世界(同期の資源)」を、持ち主同士の合意でつなぐ**課題。

## 実際に使った値

| 項目 | 値 |
|---|---|
| 公開する名前 | `minacousj.agi-japan.com` |
| 検証用CNAME 名 | `_187d13781f71e5ddcb62b43b7bdd74da.minacousj.agi-japan.com` |
| 検証用CNAME 値 | `_01c31c5a64006a8693ee6c3543be9aa6.jkddzztszm.acm-validations.aws` |
| 同期のCloudFront | `d2mg3ffso5926l.cloudfront.net` |

## 一連の流れ(何を・なぜ)

### ① 同期:S3にサイトを置き、CloudFrontを作る
- **何**: S3(倉庫)をオリジンにしたCloudFront(店)を作成。`d2mg3ffso5926l.cloudfront.net` という仮の住所がもらえる。
- **なぜ**: S3は倉庫にすぎず、HTTPSも独自ドメインの受付もできない。証明書を「着られる」のはCloudFrontだけ。

### ② 同期:ACM(us-east-1)で証明書を申請
- **何**: ドメイン名欄に `minacousj.agi-japan.com` と入力して申請(この時点で名前は未作成でOK。審査対象は次のハンコだけ)。
- **なぜ**: HTTPSには「本物の minacousj.agi-japan.com です」という身分証(証明書)が必要。使う店(CloudFront)と同じアカウントで取る必要があるので、申請者は同期。**必ずus-east-1**(CloudFrontはそこの証明書しか見えない)。
- 申請すると ACM が「検証用CNAME」(質問と正解のペア)を発行 → 私に送られてくる。

### ③ 私:検証用CNAMEを追加(=地主のハンコ)
- **何**: Route 53 の agi-japan.com ゾーンに CNAME を1本。
  - Record name: `_187d13781f71e5ddcb62b43b7bdd74da.minacousj`(末尾の `.agi-japan.com` は自動付与されるので入れない!)
  - Type: CNAME(Aliasは使わない)/ Value: 検証用の値を手で貼る
- **なぜ**: ACMのロボットが数分おきに「この名前で調べたらこの答えが返るか?」をDNSに質問しに来る。答えられる=電話帳に書ける=**ドメインの持ち主が同期の利用を承認した証明**。一致した瞬間、証明書が「発行済み(Issued)」になる。
- **注意**: 発行後もこのレコードは消さない(証明書の自動更新に使われる)。

### ④ 同期:CloudFrontに「看板」と「身分証」を設定
- **何**: 代替ドメイン名(CNAME)に `minacousj.agi-japan.com` を追加+カスタムSSL証明書で②の証明書を選択 → デプロイ完了を待つ → CloudFrontのドメイン名を私に送る。
- **なぜ**: CloudFrontは何百万サイトが同居する共用ビル。ブラウザの「minacousj.agi-japan.com に用があります」という名乗りに対し、テナント届け(代替ドメイン名)がないと403で門前払い。身分証(証明書)を装着していないとTLS握手の段階でSSLエラー。**発行(ACM)と装着(CloudFront)は別工程**。

### ⑤ 私:本命のAliasレコードを追加(=電話帳に正式掲載、公開の瞬間)
- **何**: Route 53 でレコード1本。
  - Record name: `minacousj` / Type: A / **AliasをON** → 「Alias to CloudFront distribution」→ `d2mg3ffso5926l.cloudfront.net` を直接貼る(他人のアカウントのCloudFrontは候補に出ないのが正常)
- **なぜ**: 世界中の「minacousj.agi-japan.com はどこ?」という質問に、私の電話帳が「同期のあの店だよ」と答え始める。この瞬間にサブドメインが誕生し、公開される。
- **Aliasの意味**: IPを直書きせず「この名前のCloudFrontのIPを、Route 53が毎回調べて即答する」方式。CNAMEの発想(名前で指す)+Aレコードの応答(IP即答)のいいとこ取り。無料で速い。

### ⑥ 確認
- ブラウザで `https://minacousj.agi-japan.com` → 同期のサイト+鍵マークでゴール🎉
- コマンドなら: `dig minacousj.agi-japan.com` / `curl -I https://minacousj.agi-japan.com`

## 仕組みの要点(理解の核)

- **DNSレコード=「特定の質問への答え」の登録。** 書いた瞬間、世界中からのその質問に答えが返るようになる。
- **CNAMEがつなぐのは「名前と名前」**(IPでもURLでもない)。「私の管理下の名前 → 他人の管理下の名前」の橋。IPの管理は相手(AWS)に任せられる。
- **ブラウザの動き**: 電話帳を芋づる式にたどってIPに到達 → 接続時に元の名前を名乗る → CloudFrontは名乗りを見て照合(だから④が必要)。
- **証明書が証明しているもの**: 「この名前のDNS管理者が、このサーバーの運用を認めた」+暗号化の鍵配り。中身の安全性は保証しない。信頼の根っこは③で私が書いた1行。
- **順番が固定な理由**: CloudFrontは「有効な証明書がないと看板を掲げられない」ルール → ハンコ(③)が看板(④)より先。電話帳掲載(⑤)は店の準備が全部済んでから。

## 役割分担の覚え方(一行)

> **資源(S3/CloudFront/証明書)のことは資源の持ち主がやる。電話帳(ホストゾーン)への書き込みだけは、ドメインの持ち主がやる。**

私の作業は結局レコード2本だけ:**③ハンコ(検証CNAME)と⑤掲載(Alias)**。

## トラブルの見分け方

| 症状 | 原因 |
|---|---|
| SSL/暗号系エラー | ④の証明書未装着 or デプロイ中(Deploying) |
| 403 + CloudFrontエラーページ | ④の代替ドメイン名が未登録/綴りミス |
| DNS_PROBE_FINISHED_NXDOMAIN | ⑤の本命レコードが無い/名前のタイプミス |
| 証明書がずっと検証保留中 | ③のタイプミス、または名前の二重サフィックス(`…agi-japan.com.agi-japan.com`) |
| 証明書がCloudFrontの選択肢に出ない | us-east-1以外で申請している |

## 発展:方法b(NS委任)との違い

- 方法a(今回)= 頼まれるたびに私が電話帳へ書く。無料。
- 方法b = `minacousj.agi-japan.com` のホストゾーンを同期が自分で作り、私はNSレコード1本で「その区画の電話帳はあちら」と委任。以降同期が自己完結で管理。ゾーン代 月$0.50 は**委任される側(同期)**が払う。
