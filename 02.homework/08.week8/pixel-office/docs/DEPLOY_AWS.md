# AWS へのデプロイ手順

Pixel Office を AWS に公開する手順です。各手順で「何を作るのか」「なぜその設定なのか」を説明します。AWS コンソールの項目名は英語のまま書き、日本語の意味を横に添えています。

## 0. 全体像：何をどうつなぐのか

```
利用者のブラウザ ──HTTPS──▶ CloudFront（pixel-prod-cf） ──HTTP:80──▶ EC2（pixel-prod-ec2）の Docker
                                                                        └ app コンテナ（Node.js）
利用者のブラウザ ◀──────── 声・映像（WebRTC）────────▶ 利用者のブラウザ
              （直接つながらないときだけ EC2 上の turn コンテナが中継：UDP 3478）
```

- **EC2**：アプリを動かすパソコンを AWS 上に 1 台借りるイメージです。その中で Docker がアプリを動かします。
- **CloudFront**：インターネットからの入口です。HTTPS の鍵（証明書）をここで扱います。**ブラウザは HTTPS でないとカメラとマイクを使わせてくれない**ため、必須です。WebSocket もそのまま通ります。
- **TURN（任意）**：会社のネットワークなどで、ブラウザ同士が直接つながれないときの中継役です。音声・映像は UDP という方式で流れるため、CloudFront は通らず EC2 に直接届きます。

リソース名はすべて `pixel-prod-<種類>` に統一します。

| 種類 | 名前 |
|---|---|
| VPC（専用ネットワーク） | `pixel-prod-vpc` |
| サブネット（VPC 内の区画） | `pixel-prod-subnet` |
| インターネットゲートウェイ（外への出入口） | `pixel-prod-igw` |
| ルートテーブル（道案内） | `pixel-prod-rtb` |
| セキュリティグループ（ファイアウォール） | `pixel-prod-sg` |
| キーペア（SSH の鍵） | `pixel-prod-key` |
| EC2 インスタンス | `pixel-prod-ec2` |
| Elastic IP（固定の住所） | `pixel-prod-eip` |
| CloudFront ディストリビューション | `pixel-prod-cf`（名前欄が無いので Description と Name タグに書く） |

## 1. VPC を作る（専用ネットワーク）

**役割**：AWS の中に、このアプリ専用の区切られたネットワークを作ります。マンションの 1 室を借りて、壁で他と仕切るイメージです。

VPC コンソール → **Create VPC**

| 項目 | 値 | 理由 |
|---|---|---|
| Resources to create（作るもの） | **VPC and more** | サブネット・出入口・道案内をまとめて作れる |
| Name tag auto-generation（名前の自動生成） | `pixel-prod`（後で名前を直す） | |
| IPv4 CIDR block（住所の範囲） | `10.1.0.0/16` | 既存の VPC（BSE など）と重ならない範囲にする |
| Number of Availability Zones（データセンターの数） | **1** | サーバー 1 台なので 1 つで足りる |
| Number of public subnets（外とつながる区画） | **1** | EC2 を置く区画 |
| Number of private subnets（外とつながらない区画） | **0** | 使わない |
| NAT gateways | **None** | 有料なうえ、使わない |
| VPC endpoints | **None** | 使わない |

作成後、ウィザードが付けた長い名前（例：`pixel-prod-subnet-public1-ap-northeast-1a`）を次のように直します。

- サブネット → `pixel-prod-subnet`
- ルートテーブル → `pixel-prod-rtb`
- インターネットゲートウェイ → `pixel-prod-igw`
- VPC → `pixel-prod-vpc`

## 2. セキュリティグループを作る（ファイアウォール）

**役割**：EC2 に「誰がどの扉から入ってよいか」を決めます。

EC2 コンソール → **Security Groups** → **Create security group**

- Security group name（名前）：`pixel-prod-sg`
- VPC：`pixel-prod-vpc`

Inbound rules（入ってくる通信の許可）：

| Type | Port range | Source（どこから） | 理由 |
|---|---|---|---|
| HTTP | 80 | **Prefix list** `com.amazonaws.global.cloudfront.origin-facing` | CloudFront からだけ受け付ける。EC2 に直接アクセスされるのを防ぐ |
| SSH | 22 | **My IP** | 自分の PC からだけログインできるようにする |
| Custom UDP（TURN を使うときだけ） | 3478 | `0.0.0.0/0` | TURN の受付窓口 |
| Custom TCP（TURN を使うときだけ） | 3478 | `0.0.0.0/0` | UDP が使えないネットワーク向け |
| Custom UDP（TURN を使うときだけ） | 49160-49200 | `0.0.0.0/0` | TURN が実際に音声・映像を中継する通り道 |

Outbound rules（出ていく通信）は初期値（すべて許可）のままで大丈夫です。

## 3. キーペアと EC2 を作る（サーバー本体）

**役割**：アプリを動かすサーバーを 1 台借ります。

EC2 コンソール → **Key Pairs** → **Create key pair**：Name `pixel-prod-key`、Key pair type `ED25519`、形式 `.pem`。ダウンロードした鍵は `~/.ssh/pixel-prod-key.pem` に置き、`chmod 600` で自分だけが読めるようにします。

EC2 コンソール → **Launch instances**

| 項目 | 値 | 理由 |
|---|---|---|
| Name | `pixel-prod-ec2` | |
| Application and OS Images（OS） | **Amazon Linux 2023**（64-bit x86） | AWS が保守する Linux。dnf で Docker を入れられる |
| Instance type（性能） | **t3.small**（2GB メモリ） | Docker で画面をビルドするときにメモリを使う。t3.micro（1GB）だとビルド中に足りなくなることがある |
| Key pair | `pixel-prod-key` | SSH ログイン用 |
| Network settings → Edit | VPC `pixel-prod-vpc`、Subnet `pixel-prod-subnet`、Auto-assign public IP **Enable**、Firewall は **Select existing security group** で `pixel-prod-sg` | |
| Configure storage（ディスク） | **20 GiB gp3** | Docker イメージとログの置き場 |

## 4. Elastic IP を付ける（固定の住所）

**役割**：EC2 は再起動すると公開 IP が変わることがあります。Elastic IP を付けると住所が固定されます。CloudFront と TURN の設定で使うため、固定しておきます。

EC2 コンソール → **Elastic IPs** → **Allocate Elastic IP address** → Name タグ `pixel-prod-eip` → **Actions > Associate Elastic IP address** → Instance に `pixel-prod-ec2` を選ぶ。

あわせて、EC2 の詳細画面から **Public IPv4 DNS**（`ec2-xx-xx-xx-xx.ap-northeast-1.compute.amazonaws.com` の形）を控えます。CloudFront の接続先に使います（CloudFront には IP ではなくドメイン名を指定する必要があるため）。

## 5. EC2 に Docker を入れる

**役割**：アプリを箱（コンテナ）ごと動かす道具を入れます。

```bash
ssh -i ~/.ssh/pixel-prod-key.pem ec2-user@<Elastic IP>

# Docker 本体と git を入れて、起動時に自動で立ち上がるようにする
sudo dnf install -y docker git
sudo systemctl enable --now docker
# ec2-user が sudo なしで docker を使えるようにする（反映には再ログインが必要）
sudo usermod -aG docker ec2-user

# docker compose と buildx（ビルド機能）のプラグインを入れる
# Amazon Linux 2023 の標準パッケージには含まれないため、公式の配布ファイルを置く
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -fL -o /usr/local/lib/docker/cli-plugins/docker-compose \
  https://github.com/docker/compose/releases/download/v5.6.0/docker-compose-linux-x86_64
sudo curl -fL -o /usr/local/lib/docker/cli-plugins/docker-buildx \
  https://github.com/docker/buildx/releases/download/v0.38.0/buildx-v0.38.0.linux-amd64
sudo chmod +x /usr/local/lib/docker/cli-plugins/*
exit
```

もう一度ログインして、`docker compose version` が表示されれば準備完了です。

## 6. アプリを置いて起動する

```bash
ssh -i ~/.ssh/pixel-prod-key.pem ec2-user@<Elastic IP>
git clone <このリポジトリの URL> pixel-office
cd pixel-office          # リポジトリ内の pixel-office フォルダ
cp .env.example .env
vi .env
```

`.env` に書く値（設定ファイル。パスワードを含むので Git には入れません）：

| 変数 | 値 | 意味 |
|---|---|---|
| `APP_PORT` | `80` | CloudFront が HTTP の 80 番で来るため |
| `TRUST_PROXY` | `1` | CloudFront を通っていることをアプリに伝える |
| `ORIGIN_SECRET` | 長いランダムな文字列（`openssl rand -hex 32` の出力） | CloudFront だけが知る合言葉。手順 8 で CloudFront にも同じ値を設定する。これが無いリクエストは拒否されるので、CloudFront を通らずに EC2 へ直接来るアクセス（WAF の素通り）を防げる |
| `ALLOWED_ORIGINS` | `https://office.example.com`（使うドメイン） | CloudFront 経由だと EC2 に届く Host が EC2 のドメイン名になるため、本来のドメインからの WebSocket 接続を許可リストに入れる。**これが無いと接続が拒否される** |
| `ICE_SERVERS` | 空のままで OK | ブラウザに渡す STUN サーバーの一覧（空なら Google の公開 STUN） |

起動します。

```bash
docker compose up -d --build      # 画面のビルド → イメージ作成 → 起動
docker compose ps                 # STATUS が healthy になれば OK
curl -s localhost/healthz         # {"ok":true,...} が返れば起動成功
```

スペースの中身（チャット・付箋・ホワイトボード）のデータベースとアップロードされたファイルは、Docker ボリューム `pixel-data` に保存されます。コンテナを作り直しても、`git pull` で更新しても消えません。

`--build` は Dockerfile の手順どおりにイメージを作り直すオプションです。`-d` は裏で動かし続けるオプションです。

## 7. TURN を動かす（任意）

**役割**：ブラウザ同士が直接つながれないとき、音声・映像を中継します。社外の人や会社のネットワークから参加する可能性があるなら入れてください。

`.env` に追記します。

```
TURN_SECRET=<長いランダムな文字列>       # 例: openssl rand -hex 32 の出力
TURN_EXTERNAL_IP=<Elastic IP>
TURN_URLS=turn:<Elastic IP>:3478?transport=udp,turn:<Elastic IP>:3478?transport=tcp
```

```bash
docker compose -f docker-compose.yml -f docker-compose.turn.yml up -d --build
```

`TURN_SECRET` はアプリと TURN サーバーだけが知る「合鍵の元」です。アプリは入室した人にだけ、この合鍵の元から作った **12 時間で切れる一時パスワード**を渡します。固定のパスワードを画面に置かないので、部外者が TURN をただで中継に使うことはできません。

TURN は通信量が多いため、`network_mode: host`（EC2 のネットワークを直接使う設定）で動かします。ほかに次の制限をかけてあります。
- 中継先が内部ネットワーク（AWS のメタデータ 169.254.x など）にならないようにする
- 1 人あたり・全体の同時中継数と通信量に上限を設ける

## 8. CloudFront を作る（HTTPS の入口）

**役割**：`https://office.example.com` の入口になり、証明書で通信を暗号化して EC2 に渡します。

CloudFront コンソール → **Create distribution**

| 項目 | 値 | 理由 |
|---|---|---|
| Origin domain（転送先） | 手順 4 で控えた **Public IPv4 DNS** | IP は指定できないため |
| Protocol（転送先との通信） | **HTTP only**、HTTP port **80** | CloudFront と EC2 の間は AWS 内部。HTTPS は利用者と CloudFront の間で行う |
| Viewer protocol policy（利用者側） | **Redirect HTTP to HTTPS** | 必ず HTTPS にする（カメラ・マイクの条件） |
| Allowed HTTP methods | **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** | Socket.IO は接続の最初に POST を使う |
| Cache policy（キャッシュ） | **CachingDisabled** | 位置情報などはリアルタイムなので保存させない。画面ファイルはサイズが小さく、ブラウザ側でもキャッシュされる |
| Origin request policy（転送する情報） | **AllViewerExceptHostHeader** | Socket.IO に必要なクエリ文字列・Origin ヘッダーを EC2 へ渡す。Host は EC2 のものに置き換える |
| Alternate domain name (CNAME) | `office.example.com` | 使うドメイン |
| Custom SSL certificate | ACM の証明書（**us-east-1 リージョン**で発行したもの） | CloudFront は us-east-1 の証明書しか使えない。既存の証明書が `*.example.com` を含むならそれを使う |
| Web Application Firewall (WAF) | 余裕があれば有効化（レートベースルール） | 大量の接続から守る |
| Origin → **Add custom header** | Header name `X-Origin-Secret`、Value は `.env` の `ORIGIN_SECRET` と同じ値 | CloudFront 経由のリクエストにだけ合言葉が付く。アプリはこれで「CloudFront から来た」と判断する |
| Description | `pixel-prod-cf` | 名前欄が無いため、ここと Name タグに書く |

WebSocket は特別な設定をしなくても CloudFront を通ります。

**補足（暗号化について）**：この構成では、利用者と CloudFront の間は HTTPS で暗号化されます。一方、CloudFront と EC2 の間は HTTP で、AWS 内部ではなく公開ネットワーク上を流れます。ここも暗号化したい場合は、次のどちらかを選んでください。
- CloudFront の **VPC origin** を使い、EC2 をインターネットに公開しない
- EC2 側に証明書を置き、CloudFront → EC2 も HTTPS にする

## 9. Route 53 でドメインを向ける

**役割**：`office.example.com` を CloudFront につなぎます（住所録への登録）。

Route 53 → Hosted zones → 自分のドメイン → **Create record**：Record name `office`、Record type **A**、**Alias** をオン → Route traffic to **Alias to CloudFront distribution** → `pixel-prod-cf` を選ぶ。

数分後に `https://office.example.com` を開き、カメラとマイクが使えれば完成です。

## 10. 更新するとき

```bash
ssh -i ~/.ssh/pixel-prod-key.pem ec2-user@<Elastic IP>
cd pixel-office
git pull --ff-only                 # GitHub の最新を取得（ローカルで変更していなければ成功）
docker compose up -d --build       # 作り直して入れ替え（数十秒止まる）
docker image prune -f              # 古いイメージを削除してディスクを空ける
```

デスクトップアプリ（Electron）はサーバーの画面を開く方式なので、サーバーを更新すればアプリ側の表示も新しくなります。アプリ本体を作り直す必要はありません。

## 11. バックアップ（データを失わないために）

**役割**：データは EC2 のディスク上のボリューム `pixel-data` にしかありません。EC2 が壊れたり誤って消したりすると失われるので、コピーを取っておきます。

**方法 A：EBS スナップショットを自動で取る（おすすめ）**
EC2 のディスク（EBS）丸ごとのコピーを、AWS が毎日自動で取ってくれます。
EC2 コンソール → **Elastic Block Store > Lifecycle Manager** → **Create lifecycle policy**

| 項目 | 値 | 理由 |
|---|---|---|
| Policy type | EBS snapshot policy | ディスクのコピーを取る種類 |
| Target resource types | Instance | EC2 についているディスクを対象にする |
| Target resource tags | `Name` = `pixel-prod-ec2` | このサーバーだけを選ぶ |
| Schedule（Frequency / Retain） | Daily、7 | 毎日 1 回取り、7 日分を残す |
| Description | `pixel-prod-dlm` | 名前の代わり |

**方法 B：手動でファイルにまとめる**
```bash
cd pixel-office
# いったん止めて（書き込み途中のコピーを防ぐ）、/data を tar にまとめて、また起動する
docker compose stop app
docker run --rm -v pixel-office_pixel-data:/data -v "$PWD":/backup alpine:3.22 tar czf /backup/pixel-data-$(date +%Y%m%d).tgz -C /data .
docker compose start app
```
できた `pixel-data-日付.tgz` を S3 や手元の PC にコピーしておきます（ボリューム名は `docker volume ls` で確認できます）。

## 12. 困ったとき

| 症状 | 確認すること |
|---|---|
| 画面は出るが「サーバーに接続できませんでした」 | `.env` の `ALLOWED_ORIGINS` が `https://<ドメイン>` になっているか。CloudFront の Allowed HTTP methods に POST が含まれているか |
| 近づいても声が聞こえない | 社内ネットワーク同士なら TURN が必要（手順 7）。セキュリティグループで UDP 3478 と 49160-49200 が開いているか |
| カメラが使えない | URL が https になっているか |
| ログを見たい | `docker compose logs -f app` |
| 起動しているか | `docker compose ps`、`curl -s localhost/healthz` |
