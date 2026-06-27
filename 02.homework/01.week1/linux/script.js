const STORAGE_KEY = "linux-story-quest-v4";
const HOME = "/home/student";
const QUEST_ROOT_NAMES = new Set(["docs", "logs", "tmp", "scripts", "config", "downloads", "atelier", "backups", "restore"]);

const els = {
  progressDots: document.querySelector("#progressDots"),
  progressText: document.querySelector("#progressText"),
  stageLabel: document.querySelector("#stageLabel"),
  stageTitle: document.querySelector("#stageTitle"),
  stageText: document.querySelector("#stageText"),
  focusCommand: document.querySelector("#focusCommand"),
  focusMeaning: document.querySelector("#focusMeaning"),
  goalText: document.querySelector("#goalText"),
  storyLine: document.querySelector("#storyLine"),
  resultOutput: document.querySelector("#resultOutput"),
  feedbackLine: document.querySelector("#feedbackLine"),
  commandChips: document.querySelector("#commandChips"),
  commandForm: document.querySelector("#commandForm"),
  commandInput: document.querySelector("#commandInput"),
  hintButton: document.querySelector("#hintButton"),
  fillButton: document.querySelector("#fillButton"),
  resetButton: document.querySelector("#resetButton"),
  bookButton: document.querySelector("#bookButton"),
  closeBook: document.querySelector("#closeBook"),
  bookDialog: document.querySelector("#bookDialog"),
  bookList: document.querySelector("#bookList"),
  scene: document.querySelector("#scene"),
  avatar: document.querySelector("#avatar")
};

const chapters = [
  "移動と読む",
  "作る・整理",
  "探す・数える",
  "権限と実行",
  "状態を見る",
  "まとめる・つなぐ"
];

const commandBook = [
  ["pwd", "今いる場所を表示する。迷ったときの現在地確認。"],
  ["ls", "ファイルやディレクトリを見る。-a で隠しファイル、-l で詳細。"],
  ["cd", "別のディレクトリへ移動する。.. は1つ上。"],
  ["cat", "ファイルの中身を表示する。短い設定やメモを見る。"],
  ["mkdir", "ディレクトリを作る。作業場所や保存場所を用意する。"],
  ["touch", "空のファイルを作る。メモや設定ファイルの準備に使う。"],
  ["cp", "ファイルをコピーする。元を残して複製する。"],
  ["mv", "ファイルを移動、または名前変更する。"],
  ["rm", "ファイルを削除する。実務では対象を確認してから使う。"],
  ["grep", "ファイルの中から文字を探す。-i で大文字小文字を無視。"],
  ["find", "条件に合うファイルを探す。"],
  ["head", "ファイルの先頭を見る。"],
  ["tail", "ファイルの末尾を見る。"],
  ["wc", "行数や文字数を数える。-l は行数。"],
  ["chmod", "ファイルの権限を変更する。+x は実行可能にする。"],
  ["ps", "動いているプロセスを見る。"],
  ["kill", "指定した PID のプロセスを止める。"],
  ["df", "ディスクの空き容量を見る。"],
  ["du", "ディレクトリやファイルの使用量を見る。"],
  ["tar", "複数ファイルをまとめたり展開したりする。"],
  ["curl", "URLへアクセスして結果を見る。"],
  ["ping", "相手に届くか簡単に確認する。"],
  ["history", "入力したコマンドを振り返る。"],
  ["tree", "ディレクトリ構造を見やすく表示する。"]
];

const stageSeed = [
  ["移動と読む", "現在地を知る", "pwd", "今いる場所を表示する。", "pwd を入力する", "Linux は場所を移動しながら作業します。最初に自分の居場所を確認します。", "print working directory の略です。", ["pwd", "help"], "look", "home", "ミナは地図を広げた。ここがホーム、作業の出発点です。", (ctx) => ctx.name === "pwd"],
  ["移動と読む", "見えるものを確認する", "ls", "ファイルやディレクトリを一覧表示する。", "ls を入力する", "周りに何があるか見ます。Linux では一覧を見てから動くと迷いません。", "list の略です。まずはオプションなしで十分です。", ["ls", "pwd"], "list", "home", "広場に docs、logs、scripts、config が見えました。行き先がはっきりしました。", (ctx) => ctx.name === "ls" && ctx.listedPath === HOME],
  ["移動と読む", "資料室へ移動する", "cd docs", "ディレクトリを移動する。", "cd docs を入力する", "docs は資料室です。cd は今いる場所を変えるコマンドです。", "change directory の略です。", ["cd docs", "ls"], "walk", "docs", "ミナは資料室へ歩きました。今いる場所が docs に変わりました。", (ctx) => ctx.name === "cd" && ctx.cwdAfter === `${HOME}/docs`],
  ["移動と読む", "ファイルを読む", "cat guide.txt", "ファイルの中身を表示する。", "cat guide.txt を入力する", "資料室にある guide.txt を読んで、コマンドの考え方を確認します。", "cat の後ろに読みたいファイル名を書きます。", ["cat guide.txt", "ls"], "read", "docs", "資料を読むと、コマンドは「何をするか」と「何にするか」で考えればよいと分かりました。", (ctx) => ctx.name === "cat" && ctx.readPath === `${HOME}/docs/guide.txt`],
  ["移動と読む", "ホームへ戻る", "cd ..", "1つ上のディレクトリへ戻る。", "cd .. を入力する", "作業場所を作るために、資料室からホームへ戻ります。", ".. は1つ上の場所を表します。", ["cd ..", "pwd"], "walk", "home", "ミナはホームへ戻りました。次は自分の作業部屋を作ります。", (ctx) => ctx.name === "cd" && ctx.cwdAfter === HOME],
  ["移動と読む", "隠し設定を見る", "ls -a config", "隠しファイルも表示する。", "ls -a config を入力する", "ドットで始まるファイルは普段は隠れます。設定ディレクトリで見つけてみます。", "-a は all。隠しファイルも含めて表示します。", ["ls -a config", "cat config/.env"], "list", "home", ".env が見えました。Linux では隠しファイルが設定を持つことがあります。", (ctx) => ctx.name === "ls" && ctx.flags.has("a") && ctx.listedPath === `${HOME}/config`],

  ["作る・整理", "作業部屋を作る", "mkdir atelier", "新しいディレクトリを作る。", "mkdir atelier を入力する", "作業ファイルを散らかさないように、専用ディレクトリを作ります。", "make directory の略です。", ["mkdir atelier", "ls"], "build", "home", "広場の横に atelier ができました。作業場所を分けると整理しやすくなります。", (ctx) => ctx.name === "mkdir" && ctx.createdPath === `${HOME}/atelier`],
  ["作る・整理", "メモを作る", "touch atelier/idea.txt", "空のファイルを作る。", "touch atelier/idea.txt を入力する", "作業部屋に idea.txt を作ります。touch は空ファイル作成によく使います。", "atelier/idea.txt は atelier の中の idea.txt という意味です。", ["touch atelier/idea.txt", "ls atelier"], "write", "atelier", "小さなメモが作業部屋に置かれました。ファイル作成の第一歩です。", (ctx) => ctx.name === "touch" && ctx.createdPath === `${HOME}/atelier/idea.txt`],
  ["作る・整理", "資料をコピーする", "cp docs/guide.txt atelier/guide-copy.txt", "ファイルをコピーする。", "cp docs/guide.txt atelier/guide-copy.txt を入力する", "コピー元は docs/guide.txt。コピー先は atelier の中です。保存名は guide-copy.txt でも、元の guide.txt のままでも進めます。", "cp は コピー元 コピー先 の順番です。コピー先にディレクトリ名だけを書くと元の名前で入ります。", ["cp docs/guide.txt atelier/guide-copy.txt", "ls atelier"], "read", "atelier", "資料のコピーが作業部屋に届きました。元ファイルはそのまま残っています。", (ctx) => ctx.name === "cp" && ctx.copiedSource === `${HOME}/docs/guide.txt` && parentPath(ctx.copiedPath) === `${HOME}/atelier`],
  ["作る・整理", "名前を整える", "mv atelier/idea.txt atelier/plan.txt", "ファイルを移動、または名前変更する。", "mv atelier/idea.txt atelier/plan.txt を入力する", "idea.txt を plan.txt に変えます。mv は名前変更にも使います。", "mv 古い名前 新しい名前 の順番です。", ["mv atelier/idea.txt atelier/plan.txt", "ls atelier"], "write", "atelier", "メモの名前が plan.txt になりました。意味のある名前は後から見ても分かりやすいです。", (ctx) => ctx.name === "mv" && ctx.movedPath === `${HOME}/atelier/plan.txt`],
  ["作る・整理", "バックアップ置き場を作る", "mkdir backups", "保存場所を作る。", "mkdir backups を入力する", "作業結果を守るためにバックアップ置き場を作ります。", "ディレクトリ名だけを渡すと、今いる場所の下に作られます。", ["mkdir backups", "ls"], "build", "home", "backups ができました。大事なものを逃がす場所です。", (ctx) => ctx.name === "mkdir" && ctx.createdPath === `${HOME}/backups`],
  ["作る・整理", "計画をバックアップする", "cp atelier/plan.txt backups/plan.bak", "ファイルを別名でコピーする。", "cp atelier/plan.txt backups/plan.bak を入力する", "コピー元は atelier/plan.txt。コピー先は backups/plan.bak という名前にします。.bak はバックアップ名によく使われます。", "コピー先までファイル名を書くと、別名コピーになります。", ["cp atelier/plan.txt backups/plan.bak", "ls backups"], "read", "home", "plan.bak が保存されました。失敗しても戻せる安心感が生まれました。", (ctx) => ctx.name === "cp" && ctx.copiedSource === `${HOME}/atelier/plan.txt` && ctx.copiedPath === `${HOME}/backups/plan.bak`],
  ["作る・整理", "不要な一時ファイルを消す", "rm tmp/noise.tmp", "ファイルを削除する。", "rm tmp/noise.tmp を入力する", "削除する対象は tmp/noise.tmp です。rm は強いので、対象を必ず確認してから使います。", "今回は安全な仮想ファイルだけが消えます。", ["rm tmp/noise.tmp", "ls tmp"], "clean", "home", "tmp が少しきれいになりました。削除は慎重に、でも整理には欠かせません。", (ctx) => ctx.name === "rm" && ctx.removedPath === `${HOME}/tmp/noise.tmp`],

  ["探す・数える", "エラー行を探す", "grep ERROR logs/system.log", "文字列を検索する。", "grep ERROR logs/system.log を入力する", "ログから ERROR だけを取り出します。長いログを見る時の基本です。", "grep 探す文字 ファイル の順番です。", ["grep ERROR logs/system.log", "cat logs/system.log"], "search", "home", "ERROR の行だけが光りました。問題の場所をすばやく絞り込めます。", (ctx) => ctx.name === "grep" && ctx.pattern === "ERROR" && ctx.readPath === `${HOME}/logs/system.log`],
  ["探す・数える", "大文字小文字を気にせず探す", "grep -i warning logs/system.log", "大文字小文字を無視して検索する。", "grep -i warning logs/system.log を入力する", "WARNING と warning の違いを気にせず探します。", "-i は ignore case。大文字小文字を無視します。", ["grep -i warning logs/system.log", "grep WARNING logs/system.log"], "search", "home", "warning も WARNING も拾えました。検索の取りこぼしが減ります。", (ctx) => ctx.name === "grep" && ctx.flags.has("i") && ctx.pattern.toLowerCase() === "warning" && ctx.readPath === `${HOME}/logs/system.log`],
  ["探す・数える", "先頭だけ見る", "head -n 2 logs/system.log", "ファイルの先頭を表示する。", "head -n 2 logs/system.log を入力する", "長いファイルは全部読まず、まず先頭だけ確認します。", "-n 2 は2行だけ表示するという意味です。", ["head -n 2 logs/system.log", "cat logs/system.log"], "read", "home", "ログの始まりだけを確認できました。大きいファイルを扱う時に便利です。", (ctx) => ctx.name === "head" && ctx.lineCount === 2 && ctx.readPath === `${HOME}/logs/system.log`],
  ["探す・数える", "末尾だけ見る", "tail -n 2 logs/system.log", "ファイルの末尾を表示する。", "tail -n 2 logs/system.log を入力する", "最近のログは末尾に出ます。tail で最後だけ見ます。", "tail はログ確認でとてもよく使います。", ["tail -n 2 logs/system.log", "head -n 2 logs/system.log"], "read", "home", "最後の2行が見えました。今起きていることを素早く確認できます。", (ctx) => ctx.name === "tail" && ctx.lineCount === 2 && ctx.readPath === `${HOME}/logs/system.log`],
  ["探す・数える", "行数を数える", "wc -l logs/system.log", "行数を数える。", "wc -l logs/system.log を入力する", "ログがどれくらいあるか数えます。-l は line の l です。", "wc は word count。-l で行数です。", ["wc -l logs/system.log", "wc logs/system.log"], "look", "home", "ログの行数が分かりました。量を見るだけでも状況判断がしやすくなります。", (ctx) => ctx.name === "wc" && ctx.flags.has("l") && ctx.readPath === `${HOME}/logs/system.log`],
  ["探す・数える", "設定ファイルを探す", "find . -name \"*.conf\"", "条件に合うファイルを探す。", "find . -name \"*.conf\" を入力する", "今いる場所から .conf で終わる設定ファイルを探します。", "引用符つきで \"*.conf\" と書くと分かりやすいです。", ["find . -name \"*.conf\"", "ls config"], "search", "home", "config/app.conf が見つかりました。ファイルの場所が分からない時に役立ちます。", (ctx) => ctx.name === "find" && ctx.findPattern === "*.conf" && ctx.output.includes("./config/app.conf")],

  ["権限と実行", "権限を読む", "ls -l scripts", "詳細表示で権限を見る。", "ls -l scripts を入力する", "スクリプトを実行する前に、権限を確認します。", "-l は long。権限、サイズ、名前などを表示します。", ["ls -l scripts", "ls scripts"], "look", "home", "launch.sh はまだ実行できない状態です。権限の先頭を見るのがポイントです。", (ctx) => ctx.name === "ls" && ctx.flags.has("l") && ctx.listedPath === `${HOME}/scripts`],
  ["権限と実行", "実行権限をつける", "chmod +x scripts/launch.sh", "ファイルを実行可能にする。", "chmod +x scripts/launch.sh を入力する", "スクリプトに実行権限を付けます。+x は execute を足すという意味です。", "chmod は change mode。+x をつけます。", ["chmod +x scripts/launch.sh", "ls -l scripts"], "power", "home", "launch.sh に実行できる印がつきました。準備完了です。", (ctx) => ctx.name === "chmod" && ctx.changedPath === `${HOME}/scripts/launch.sh`],
  ["権限と実行", "スクリプトを実行する", "./scripts/launch.sh", "実行ファイルを起動する。", "./scripts/launch.sh を入力する", "実行権限を付けたスクリプトを動かします。./ は今いる場所からの相対パスです。", "先頭の ./ を忘れずに。", ["./scripts/launch.sh", "cat config/app.conf"], "power", "home", "街のサービスが起動しました。設定ファイルの SERVICE が online に変わります。", (ctx) => ctx.name === "./scripts/launch.sh" && ctx.executedPath === `${HOME}/scripts/launch.sh`],
  ["権限と実行", "設定を確認する", "cat config/app.conf", "設定ファイルを読む。", "cat config/app.conf を入力する", "スクリプトの結果として設定が変わったか確認します。", "cat で設定ファイルの中身を見ます。", ["cat config/app.conf", "grep SERVICE config/app.conf"], "read", "home", "SERVICE=online を確認できました。実行した後は結果を見る習慣が大事です。", (ctx) => ctx.name === "cat" && ctx.readPath === `${HOME}/config/app.conf` && ctx.output.includes("SERVICE=online")],
  ["権限と実行", "状態メモを書き出す", "echo READY > atelier/status.txt", "文字をファイルに書く。", "echo READY > atelier/status.txt を入力する", "echo と > を使うと、短い文字をファイルへ保存できます。", "> の右側が書き込み先です。", ["echo READY > atelier/status.txt", "cat atelier/status.txt"], "write", "atelier", "status.txt に READY と書かれました。小さな記録を残せるようになりました。", (ctx) => ctx.name === "echo" && ctx.wrotePath === `${HOME}/atelier/status.txt`],

  ["状態を見る", "動いているものを見る", "ps", "プロセス一覧を見る。", "ps を入力する", "Linux では動いているプログラムをプロセスと呼びます。", "process status の略です。", ["ps", "help"], "process", "home", "街の裏側で動いているプロセスが見えました。PID が番号です。", (ctx) => ctx.name === "ps"],
  ["状態を見る", "暴走プロセスを止める", "kill 4210", "指定したプロセスを止める。", "kill 4210 を入力する", "backup-loop がCPUを使いすぎています。PID 4210 だけを止めます。", "kill の後ろに PID を書きます。", ["kill 4210", "ps"], "process", "home", "backup-loop が止まりました。対象を間違えないことが大事です。", (ctx) => ctx.name === "kill" && ctx.killedPid === 4210],
  ["状態を見る", "止まったか確認する", "ps", "プロセス一覧を再確認する。", "もう一度 ps を入力する", "止めた後は本当に消えたか確認します。", "同じ ps でも、確認という目的があります。", ["ps", "kill 4210"], "look", "home", "backup-loop が一覧から消えました。操作後の確認までがワンセットです。", (ctx) => ctx.name === "ps" && !ctx.output.includes("backup-loop")],
  ["状態を見る", "空き容量を見る", "df -h", "ディスクの空き容量を見る。", "df -h を入力する", "システム全体の空き容量を確認します。-h は読みやすい単位です。", "disk free の略です。", ["df -h", "du -sh atelier"], "look", "home", "ディスクにはまだ余裕があります。容量不足はよくある障害原因です。", (ctx) => ctx.name === "df" && ctx.flags.has("h")],
  ["状態を見る", "作業部屋のサイズを見る", "du -sh atelier", "ディレクトリの使用量を見る。", "du -sh atelier を入力する", "atelier がどれくらい容量を使っているか見ます。", "-s は合計、-h は読みやすい単位です。", ["du -sh atelier", "ls atelier"], "look", "atelier", "作業部屋のサイズが分かりました。どこが容量を使っているか調べる入口です。", (ctx) => ctx.name === "du" && ctx.flags.has("s") && ctx.flags.has("h") && ctx.sizePath === `${HOME}/atelier`],

  ["まとめる・つなぐ", "作業部屋を固める", "tar -czf backups/atelier.tar.gz atelier", "ファイルをまとめて圧縮する。", "tar -czf backups/atelier.tar.gz atelier を入力する", "まとめる対象は atelier。作成する圧縮ファイル名は backups/atelier.tar.gz です。", "-c は作成、-z はgzip、-f はファイル名です。", ["tar -czf backups/atelier.tar.gz atelier", "ls backups"], "archive", "home", "atelier.tar.gz ができました。作業部屋をひとまとめにできました。", (ctx) => ctx.name === "tar" && ctx.archivePath === `${HOME}/backups/atelier.tar.gz`],
  ["まとめる・つなぐ", "復元場所を作る", "mkdir restore", "展開先を作る。", "mkdir restore を入力する", "圧縮ファイルを安全に展開するため、restore ディレクトリを作ります。", "元の場所に直接展開しない練習です。", ["mkdir restore", "ls"], "build", "home", "restore ができました。戻す場所を分けると確認しやすくなります。", (ctx) => ctx.name === "mkdir" && ctx.createdPath === `${HOME}/restore`],
  ["まとめる・つなぐ", "アーカイブを展開する", "tar -xzf backups/atelier.tar.gz -C restore", "圧縮ファイルを展開する。", "tar -xzf backups/atelier.tar.gz -C restore を入力する", "展開するファイルは backups/atelier.tar.gz。展開先は restore です。", "-x は展開、-C は展開先です。", ["tar -xzf backups/atelier.tar.gz -C restore", "tree restore"], "archive", "home", "restore の中に atelier が戻りました。バックアップから復元できるようになりました。", (ctx) => ctx.name === "tar" && ctx.extractedTo === `${HOME}/restore`],
  ["まとめる・つなぐ", "サービス状態を取得する", "curl https://quest.local/status", "URLへアクセスして結果を見る。", "curl https://quest.local/status を入力する", "起動したサービスの状態をURLから取得します。", "curl の後ろに URL を書きます。", ["curl https://quest.local/status", "cat config/app.conf"], "network", "home", "サービスから online の返事が返ってきました。Linux は外部との確認にも使います。", (ctx) => ctx.name === "curl" && ctx.url === "https://quest.local/status"],
  ["まとめる・つなぐ", "通信できるか確認する", "ping quest.local", "相手に届くか確認する。", "ping quest.local を入力する", "ネットワークの最初の確認として ping を使います。", "ping の後ろにホスト名を書きます。", ["ping quest.local", "curl https://quest.local/status"], "network", "home", "quest.local へ届きました。通信確認の基本です。", (ctx) => ctx.name === "ping" && ctx.host === "quest.local"],
  ["まとめる・つなぐ", "履歴を振り返る", "history", "入力したコマンドを表示する。", "history を入力する", "ここまで打ったコマンドを振り返ります。繰り返し作業の確認に便利です。", "history はそのまま入力します。", ["history", "pwd"], "read", "home", "ここまでの道のりが一覧になりました。Linux は履歴から学び直せます。", (ctx) => ctx.name === "history"],
  ["まとめる・つなぐ", "全体像を見る", "tree .", "ディレクトリ構造を表示する。", "tree . を入力する", "最後にホーム全体の構造を見ます。何を作ったか一目で分かります。", ". は現在地です。ホームで tree . を打ちます。", ["tree .", "find . -name \"*.txt\""], "look", "home", "街の地図が完成しました。基本操作を組み合わせれば、Linux で迷わず作業できます。", (ctx) => ctx.name === "tree" && ctx.treePath === HOME]
];

const stages = stageSeed.map(([chapter, title, command, meaning, goal, text, hint, chips, action, place, story, check]) => ({
  chapter,
  title,
  command,
  meaning,
  goal,
  text,
  hint,
  chips,
  action,
  place,
  story,
  check
}));

function createBaseFiles() {
  return {
    [`${HOME}/mission.txt`]: { content: "Linux Story Quest\n小さなコマンドで街を動かしながら、Linuxの基礎を一通り練習します。", executable: false },
    [`${HOME}/docs/guide.txt`]: { content: ["Linux command guide", "pwd  : 現在地を知る", "ls   : 見えるものを確認する", "cd   : 移動する", "cat  : 読む", "grep : 探す"].join("\n"), executable: false },
    [`${HOME}/docs/manual.txt`]: { content: "困ったら、今のステージの「ヒント」と「答えを見る」を使って成功形を確認してください。", executable: false },
    [`${HOME}/docs/checklist.md`]: { content: "- 場所を見る\n- 一覧を見る\n- 読む\n- 作る\n- 探す\n- 実行する\n- 確認する", executable: false },
    [`${HOME}/logs/story.log`]: { content: ["INFO city gate is waiting", "INFO atelier can be created", "HINT final-key: small steps become real skill"].join("\n"), executable: false },
    [`${HOME}/logs/system.log`]: { content: ["09:00 INFO boot sequence started", "09:02 warning cache directory is stale", "09:04 ERROR config/app.conf needs launch", "09:05 INFO fallback mode enabled", "09:08 WARNING backup-loop consumes high CPU", "09:10 INFO waiting for service"].join("\n"), executable: false },
    [`${HOME}/logs/access.log`]: { content: "200 GET /\n503 GET /status\n200 GET /docs\n200 GET /health", executable: false },
    [`${HOME}/tmp/noise.tmp`]: { content: "temporary noise", executable: false },
    [`${HOME}/tmp/cache.tmp`]: { content: "stale cache", executable: false },
    [`${HOME}/scripts/launch.sh`]: { content: "#!/bin/sh\necho service online", executable: false },
    [`${HOME}/scripts/cleanup.sh`]: { content: "#!/bin/sh\necho cleanup done", executable: false },
    [`${HOME}/config/app.conf`]: { content: "APP_ENV=training\nPORT=8080\nSERVICE=offline", executable: false },
    [`${HOME}/config/.env`]: { content: "QUEST_MODE=story\nSAFE_SHELL=true", executable: false },
    [`${HOME}/downloads/report.old`]: { content: "old incident report", executable: false },
    [`${HOME}/downloads/data.csv`]: { content: "name,score\nmina,100\nlinux,95", executable: false }
  };
}

function createState() {
  return {
    step: 0,
    cwd: HOME,
    place: "home",
    story: "まずは自分がどこにいるか知ろう。ミナに短いコマンドを渡すと、街が少しずつ動きます。",
    lastAction: "idle",
    output: "ここにコマンドの結果が表示されます。",
    feedback: "コマンドを入れると、ミナがその動きをして街が進みます。",
    complete: false,
    dirs: ["/home", HOME, `${HOME}/docs`, `${HOME}/logs`, `${HOME}/tmp`, `${HOME}/scripts`, `${HOME}/config`, `${HOME}/downloads`],
    files: createBaseFiles(),
    history: [],
    processes: [
      { pid: 1, user: "root", cpu: "0.0", command: "systemd", running: true, killable: false },
      { pid: 1180, user: "student", cpu: "0.2", command: "story-shell", running: true, killable: false },
      { pid: 3202, user: "www-data", cpu: "1.6", command: "quest-web", running: true, killable: false },
      { pid: 4210, user: "student", cpu: "87.4", command: "backup-loop", running: true, killable: true },
      { pid: 5001, user: "student", cpu: "0.1", command: "status-agent", running: true, killable: false }
    ],
    milestones: {
      listed: false,
      atelier: false,
      note: false,
      archive: false
    }
  };
}

function isInQuestHome(path) {
  return path === HOME || path.startsWith(`${HOME}/`);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) {
      return createState();
    }
    const fresh = createState();
    const loaded = {
      ...fresh,
      ...saved,
      dirs: Array.isArray(saved.dirs) ? saved.dirs : fresh.dirs,
      files: saved.files || fresh.files,
      history: Array.isArray(saved.history) ? saved.history : [],
      processes: Array.isArray(saved.processes) ? saved.processes : fresh.processes,
      milestones: { ...fresh.milestones, ...(saved.milestones || {}) }
    };
    if (!isInQuestHome(loaded.cwd)) {
      loaded.cwd = HOME;
      loaded.place = "home";
      loaded.feedback = "ホームの外に出ていたため、学習用ホームへ戻しました。";
    }
    return loaded;
  } catch {
    return createState();
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function tokenize(input) {
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

function currentStage() {
  return stages[Math.min(state.step, stages.length - 1)];
}

function chapterIndexFor(step = state.step) {
  const chapter = stages[Math.min(step, stages.length - 1)]?.chapter || chapters[0];
  return chapters.indexOf(chapter);
}

function taskText(stage) {
  const tasks = {
    "現在地を知る": "今いる場所を表示する",
    "見えるものを確認する": "ホームにあるものを一覧表示する",
    "資料室へ移動する": "資料室へ移動する",
    "ファイルを読む": "資料室の guide.txt を読む",
    "ホームへ戻る": "1つ上の場所へ戻る",
    "隠し設定を見る": "config の隠しファイルも表示する",
    "作業部屋を作る": "atelier という作業部屋を作る",
    "メモを作る": "atelier の中に idea.txt を作る",
    "資料をコピーする": "docs/guide.txt を atelier の中へコピーする（保存名は guide-copy.txt または guide.txt）",
    "名前を整える": "idea.txt を plan.txt に名前変更する",
    "バックアップ置き場を作る": "backups という保存場所を作る",
    "計画をバックアップする": "atelier/plan.txt を backups/plan.bak という名前でコピーする",
    "不要な一時ファイルを消す": "tmp/noise.tmp を削除する",
    "エラー行を探す": "system.log から ERROR の行を探す",
    "大文字小文字を気にせず探す": "system.log から warning を大文字小文字なしで探す",
    "先頭だけ見る": "system.log の先頭2行だけを見る",
    "末尾だけ見る": "system.log の末尾2行だけを見る",
    "行数を数える": "system.log の行数を数える",
    "設定ファイルを探す": "今いる場所から .conf の設定ファイルを探す",
    "権限を読む": "scripts の権限を詳細表示で確認する",
    "実行権限をつける": "scripts/launch.sh を実行できる状態にする",
    "スクリプトを実行する": "scripts/launch.sh を現在地から実行する",
    "設定を確認する": "config/app.conf の中身を確認する",
    "状態メモを書き出す": "READY という文字を status.txt に保存する",
    "動いているものを見る": "動いているプロセスを見る",
    "暴走プロセスを止める": "backup-loop の PID を指定して止める",
    "止まったか確認する": "プロセス一覧を再確認する",
    "空き容量を見る": "ディスクの空き容量を読みやすく見る",
    "作業部屋のサイズを見る": "atelier の合計サイズを読みやすく見る",
    "作業部屋を固める": "atelier を backups/atelier.tar.gz という名前で圧縮する",
    "復元場所を作る": "restore という展開先を作る",
    "アーカイブを展開する": "backups/atelier.tar.gz を restore に展開する",
    "サービス状態を取得する": "https://quest.local/status へアクセスする",
    "通信できるか確認する": "quest.local に届くか確認する",
    "履歴を振り返る": "入力してきたコマンドを振り返る",
    "全体像を見る": "ホーム配下の構造をツリー表示する"
  };
  return tasks[stage.title] || stage.text;
}

function focusLabel(stage) {
  const first = stage.command.split(" ")[0];
  if (first.startsWith("./")) {
    return "実行";
  }
  return first;
}

function hintChips(stage) {
  const first = stage.command.split(" ")[0];
  const extras = {
    "ls -a config": ["-a", "config"],
    "cat guide.txt": ["guide.txt"],
    "cat config/app.conf": ["config", "app.conf"],
    "cd docs": ["docs"],
    "cd ..": [".."],
    "mkdir atelier": ["atelier"],
    "mkdir backups": ["backups"],
    "mkdir restore": ["restore"],
    "touch atelier/idea.txt": ["atelier", "idea.txt"],
    "cp docs/guide.txt atelier/guide-copy.txt": ["docs/guide.txt", "atelier", "guide-copy.txt"],
    "cp atelier/plan.txt backups/plan.bak": ["atelier/plan.txt", "backups/plan.bak"],
    "mv atelier/idea.txt atelier/plan.txt": ["idea.txt", "plan.txt"],
    "rm tmp/noise.tmp": ["tmp/noise.tmp"],
    "grep ERROR logs/system.log": ["ERROR", "system.log"],
    "grep -i warning logs/system.log": ["-i", "warning"],
    "head -n 2 logs/system.log": ["-n", "2行"],
    "tail -n 2 logs/system.log": ["-n", "2行"],
    "wc -l logs/system.log": ["-l", "行数"],
    "find . -name \"*.conf\"": ["-name", "*.conf"],
    "ls -l scripts": ["-l", "scripts"],
    "chmod +x scripts/launch.sh": ["+x", "launch.sh"],
    "./scripts/launch.sh": ["./", "launch.sh"],
    "echo READY > atelier/status.txt": ["echo", ">", "READY"],
    "kill 4210": ["PID", "4210"],
    "df -h": ["-h", "空き容量"],
    "du -sh atelier": ["-s", "-h", "atelier"],
    "tar -czf backups/atelier.tar.gz atelier": ["-czf", "atelier", "atelier.tar.gz"],
    "tar -xzf backups/atelier.tar.gz -C restore": ["-xzf", "atelier.tar.gz", "restore"],
    "curl https://quest.local/status": ["https://quest.local/status"],
    "ping quest.local": ["quest.local"],
    "tree .": ["."]
  };
  return [focusLabel(stage), ...(extras[stage.command] || [])].slice(0, 4);
}

function displayPath(path = state.cwd) {
  if (path === HOME) {
    return "~";
  }
  if (path.startsWith(`${HOME}/`)) {
    return `~/${path.slice(HOME.length + 1)}`;
  }
  return path;
}

function resolvePath(input = ".") {
  if (!input || input === "~") {
    return HOME;
  }
  if (input.startsWith("~/")) {
    return `${HOME}/${input.slice(2)}`;
  }
  const firstSegment = input.split("/").find(Boolean);
  const fromQuestRoot = !input.startsWith("/") && firstSegment && QUEST_ROOT_NAMES.has(firstSegment);
  const parts = input.startsWith("/") ? [] : (fromQuestRoot ? HOME : state.cwd).split("/").filter(Boolean);
  input.split("/").forEach((part) => {
    if (!part || part === ".") {
      return;
    }
    if (part === "..") {
      parts.pop();
      return;
    }
    parts.push(part);
  });
  return `/${parts.join("/")}`.replace(/\/+/g, "/");
}

function parentPath(path) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

function baseName(path) {
  return path.split("/").filter(Boolean).pop() || "/";
}

function ensureDir(path) {
  if (!state.dirs.includes(path)) {
    state.dirs.push(path);
  }
}

function dirExists(path) {
  return state.dirs.includes(path);
}

function fileExists(path) {
  return Boolean(state.files[path]);
}

function pathExists(path) {
  return dirExists(path) || fileExists(path);
}

function isDirectChild(parent, child) {
  if (parent === "/") {
    return child !== "/" && child.slice(1).split("/").length === 1;
  }
  if (!child.startsWith(`${parent}/`)) {
    return false;
  }
  return child.slice(parent.length + 1).split("/").length === 1;
}

function modeFor(path) {
  if (dirExists(path)) {
    return "drwxr-xr-x";
  }
  return state.files[path]?.executable ? "-rwxr-xr-x" : "-rw-r--r--";
}

function sizeFor(path) {
  if (dirExists(path)) {
    return 4096;
  }
  return state.files[path]?.content?.length || 0;
}

function parseFlags(args) {
  const flags = new Set();
  args.forEach((arg) => {
    if (arg.startsWith("-") && !arg.startsWith("--")) {
      arg.slice(1).split("").forEach((flag) => flags.add(flag));
    }
  });
  return flags;
}

function nonFlagArgs(args) {
  return args.filter((arg) => !arg.startsWith("-"));
}

function listDir(path, showAll, longMode) {
  if (fileExists(path)) {
    return longMode ? `${modeFor(path)} student student ${String(sizeFor(path)).padStart(5, " ")} ${baseName(path)}` : baseName(path);
  }
  if (!dirExists(path)) {
    return null;
  }
  const children = new Set();
  state.dirs.forEach((dir) => {
    if (isDirectChild(path, dir)) {
      children.add(`${baseName(dir)}/`);
    }
  });
  Object.keys(state.files).forEach((file) => {
    if (isDirectChild(path, file)) {
      children.add(baseName(file));
    }
  });
  const names = [...children].filter((name) => showAll || !name.startsWith(".")).sort((a, b) => a.localeCompare(b));
  if (!longMode) {
    return names.length ? names.join("  ") : "(empty)";
  }
  if (!names.length) {
    return "total 0";
  }
  return names.map((name) => {
    const clean = name.endsWith("/") ? name.slice(0, -1) : name;
    const full = path === "/" ? `/${clean}` : `${path}/${clean}`;
    return `${modeFor(full)} student student ${String(sizeFor(full)).padStart(5, " ")} ${name}`;
  }).join("\n");
}

function readFile(path) {
  return state.files[path]?.content ?? null;
}

function writeFile(path, content, executable = false) {
  ensureDir(parentPath(path));
  state.files[path] = { content, executable };
}

function removeFile(path) {
  delete state.files[path];
}

function globToRegex(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function relativeFrom(base, path) {
  if (base === path) {
    return ".";
  }
  if (base === "/") {
    return path;
  }
  return `.${path.slice(base.length)}`;
}

function createContext(raw, tokens) {
  return {
    raw,
    output: "",
    name: tokens[0] || "",
    args: tokens.slice(1),
    flags: parseFlags(tokens.slice(1)),
    cwdBefore: state.cwd,
    cwdAfter: state.cwd,
    listedPath: "",
    readPath: "",
    createdPath: "",
    copiedPath: "",
    copiedSource: "",
    movedPath: "",
    movedSource: "",
    removedPath: "",
    changedPath: "",
    executedPath: "",
    wrotePath: "",
    pattern: "",
    findPattern: "",
    lineCount: 0,
    killedPid: 0,
    sizePath: "",
    archivePath: "",
    extractedTo: "",
    url: "",
    host: "",
    treePath: ""
  };
}

function ok(output, ctx) {
  ctx.output = output;
  return { ok: true, output, ctx };
}

function fail(output, ctx) {
  ctx.output = output;
  return { ok: false, output, ctx };
}

function runCommand(raw) {
  if (!isInQuestHome(state.cwd)) {
    state.cwd = HOME;
    state.place = "home";
  }

  const tokens = tokenize(raw.trim());
  const ctx = createContext(raw, tokens);
  const name = ctx.name;
  const args = ctx.args;

  if (!name) {
    return fail("", ctx);
  }

  if (name === "help") {
    return ok(commandBook.map(([cmd, desc]) => `${cmd.padEnd(8, " ")} ${desc}`).join("\n"), ctx);
  }

  if (name === "pwd") {
    return ok(state.cwd, ctx);
  }

  if (name === "ls") {
    const targets = nonFlagArgs(args);
    const path = resolvePath(targets[0] || ".");
    const output = listDir(path, ctx.flags.has("a"), ctx.flags.has("l"));
    ctx.listedPath = path;
    if (output === null) {
      return fail(`ls: ${targets[0] || "."}: No such file or directory`, ctx);
    }
    if (path === HOME) {
      state.milestones.listed = true;
    }
    return ok(output, ctx);
  }

  if (name === "cd") {
    const path = resolvePath(args[0] || "~");
    if (!isInQuestHome(path)) {
      state.cwd = HOME;
      state.place = "home";
      ctx.cwdAfter = HOME;
      return ok("~\nここが学習用ホームです。外には出ません。", ctx);
    }
    if (!dirExists(path)) {
      return fail(`cd: ${args[0] || "~"}: No such directory`, ctx);
    }
    state.cwd = path;
    state.place = path.includes("/docs") ? "docs" : path.includes("/atelier") ? "atelier" : "home";
    ctx.cwdAfter = path;
    return ok(displayPath(path), ctx);
  }

  if (name === "cat") {
    const path = resolvePath(args[0] || "");
    const content = readFile(path);
    if (content === null) {
      return fail(`cat: ${args[0] || ""}: No such file`, ctx);
    }
    ctx.readPath = path;
    return ok(content || "(empty file)", ctx);
  }

  if (name === "mkdir") {
    const path = resolvePath(args[0] || "");
    if (!args[0]) {
      return fail("mkdir: missing directory name", ctx);
    }
    if (!dirExists(parentPath(path))) {
      return fail(`mkdir: ${args[0]}: parent directory does not exist`, ctx);
    }
    ensureDir(path);
    ctx.createdPath = path;
    if (path === `${HOME}/atelier`) {
      state.milestones.atelier = true;
    }
    return ok(`created ${displayPath(path)}/`, ctx);
  }

  if (name === "touch") {
    const path = resolvePath(args[0] || "");
    if (!args[0]) {
      return fail("touch: missing file name", ctx);
    }
    if (!dirExists(parentPath(path))) {
      return fail(`touch: ${args[0]}: parent directory does not exist`, ctx);
    }
    writeFile(path, state.files[path]?.content || "");
    ctx.createdPath = path;
    if (path === `${HOME}/atelier/idea.txt`) {
      state.milestones.note = true;
    }
    return ok(`created ${displayPath(path)}`, ctx);
  }

  if (name === "cp") {
    const source = resolvePath(args[0] || "");
    let dest = resolvePath(args[1] || "");
    if (!fileExists(source)) {
      return fail(`cp: ${args[0] || ""}: No such file`, ctx);
    }
    if (dirExists(dest)) {
      dest = `${dest}/${baseName(source)}`;
    }
    if (!dirExists(parentPath(dest))) {
      return fail(`cp: ${args[1] || ""}: parent directory does not exist`, ctx);
    }
    writeFile(dest, state.files[source].content, state.files[source].executable);
    ctx.copiedSource = source;
    ctx.copiedPath = dest;
    return ok(`copied ${displayPath(source)} -> ${displayPath(dest)}`, ctx);
  }

  if (name === "mv") {
    const source = resolvePath(args[0] || "");
    let dest = resolvePath(args[1] || "");
    if (!fileExists(source)) {
      return fail(`mv: ${args[0] || ""}: No such file`, ctx);
    }
    if (dirExists(dest)) {
      dest = `${dest}/${baseName(source)}`;
    }
    if (!dirExists(parentPath(dest))) {
      return fail(`mv: ${args[1] || ""}: parent directory does not exist`, ctx);
    }
    state.files[dest] = state.files[source];
    removeFile(source);
    ctx.movedSource = source;
    ctx.movedPath = dest;
    return ok(`moved ${displayPath(source)} -> ${displayPath(dest)}`, ctx);
  }

  if (name === "rm") {
    const path = resolvePath(args.find((arg) => !arg.startsWith("-")) || "");
    if (!fileExists(path)) {
      return fail(`rm: ${displayPath(path)}: No such file`, ctx);
    }
    removeFile(path);
    ctx.removedPath = path;
    return ok(`removed ${displayPath(path)}`, ctx);
  }

  if (name === "grep") {
    const clean = args.filter((arg) => !arg.startsWith("-"));
    const pattern = clean[0];
    const path = resolvePath(clean[1] || "");
    const content = readFile(path);
    if (!pattern || content === null) {
      return fail("grep: usage: grep [-i] PATTERN FILE", ctx);
    }
    const needle = ctx.flags.has("i") ? pattern.toLowerCase() : pattern;
    const lines = content.split("\n").filter((line) => {
      const haystack = ctx.flags.has("i") ? line.toLowerCase() : line;
      return haystack.includes(needle);
    });
    ctx.pattern = pattern;
    ctx.readPath = path;
    return ok(lines.length ? lines.join("\n") : "(no matches)", ctx);
  }

  if (name === "find") {
    const start = resolvePath(args[0] || ".");
    const nameIndex = args.indexOf("-name");
    const pattern = args[nameIndex + 1];
    if (!dirExists(start) || nameIndex === -1 || !pattern) {
      return fail("find: usage: find PATH -name PATTERN", ctx);
    }
    const regex = globToRegex(pattern);
    const matches = Object.keys(state.files)
      .filter((path) => path.startsWith(`${start}/`) || path === start)
      .filter((path) => regex.test(baseName(path)))
      .sort()
      .map((path) => relativeFrom(start, path));
    ctx.findPattern = pattern;
    return ok(matches.length ? matches.join("\n") : "(no matches)", ctx);
  }

  if (name === "head" || name === "tail") {
    const nIndex = args.indexOf("-n");
    const count = nIndex >= 0 ? Number(args[nIndex + 1]) : 10;
    const target = nIndex >= 0 ? args[nIndex + 2] : args[0];
    const path = resolvePath(target || "");
    const content = readFile(path);
    if (!Number.isInteger(count) || content === null) {
      return fail(`${name}: usage: ${name} -n NUMBER FILE`, ctx);
    }
    const lines = content.split("\n");
    ctx.lineCount = count;
    ctx.readPath = path;
    return ok((name === "head" ? lines.slice(0, count) : lines.slice(-count)).join("\n"), ctx);
  }

  if (name === "wc") {
    const path = resolvePath(nonFlagArgs(args)[0] || "");
    const content = readFile(path);
    if (content === null) {
      return fail("wc: usage: wc -l FILE", ctx);
    }
    ctx.readPath = path;
    const lines = content.split("\n").length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    return ok(ctx.flags.has("l") ? `${lines} ${displayPath(path)}` : `${lines} ${words} ${chars} ${displayPath(path)}`, ctx);
  }

  if (name === "chmod") {
    const mode = args[0];
    const path = resolvePath(args[1] || "");
    if (mode !== "+x" || !fileExists(path)) {
      return fail("chmod: usage: chmod +x FILE", ctx);
    }
    state.files[path].executable = true;
    ctx.changedPath = path;
    return ok(`${displayPath(path)} is executable`, ctx);
  }

  if (name.startsWith("./") || name.startsWith("/")) {
    const path = resolvePath(name);
    if (!fileExists(path)) {
      return fail(`${name}: No such file`, ctx);
    }
    if (!state.files[path].executable) {
      return fail(`${name}: Permission denied`, ctx);
    }
    ctx.executedPath = path;
    if (path === `${HOME}/scripts/launch.sh`) {
      state.files[`${HOME}/config/app.conf`].content = "APP_ENV=training\nPORT=8080\nSERVICE=online";
      writeFile(`${HOME}/logs/service.log`, "service online\nhealth ok");
      return ok("service online\nconfig/app.conf updated", ctx);
    }
    return ok("script executed", ctx);
  }

  if (name === "echo") {
    const redirect = args.indexOf(">");
    if (redirect === -1 || !args[redirect + 1]) {
      return ok(args.join(" "), ctx);
    }
    const text = args.slice(0, redirect).join(" ");
    const path = resolvePath(args[redirect + 1]);
    if (!dirExists(parentPath(path))) {
      return fail(`echo: ${args[redirect + 1]}: parent directory does not exist`, ctx);
    }
    writeFile(path, text);
    ctx.wrotePath = path;
    return ok(`wrote ${displayPath(path)}`, ctx);
  }

  if (name === "ps") {
    const rows = ["PID   USER      CPU    COMMAND"];
    state.processes.filter((process) => process.running).forEach((process) => {
      rows.push(`${String(process.pid).padEnd(5, " ")} ${process.user.padEnd(9, " ")} ${process.cpu.padEnd(6, " ")} ${process.command}`);
    });
    return ok(rows.join("\n"), ctx);
  }

  if (name === "kill") {
    const pid = Number(args[0]);
    const process = state.processes.find((item) => item.pid === pid);
    if (!process || !process.running) {
      return fail(`kill: (${args[0]}) - No such process`, ctx);
    }
    if (!process.killable) {
      return fail(`kill: (${args[0]}) - Operation not permitted in this quest`, ctx);
    }
    process.running = false;
    ctx.killedPid = pid;
    return ok(`stopped ${pid} ${process.command}`, ctx);
  }

  if (name === "df") {
    return ok("Filesystem      Size  Used Avail Use% Mounted on\nquestfs          24G  6.2G   18G  26% /", ctx);
  }

  if (name === "du") {
    const path = resolvePath(nonFlagArgs(args)[0] || ".");
    if (!pathExists(path)) {
      return fail(`du: ${displayPath(path)}: No such file or directory`, ctx);
    }
    const total = Object.entries(state.files)
      .filter(([file]) => file === path || file.startsWith(`${path}/`))
      .reduce((sum, [, file]) => sum + file.content.length, 0);
    ctx.sizePath = path;
    return ok(`${Math.max(4, Math.ceil(total / 16))}K ${displayPath(path)}`, ctx);
  }

  if (name === "tar") {
    if (args.includes("-czf")) {
      const archive = resolvePath(args[args.indexOf("-czf") + 1] || "");
      const source = resolvePath(args[args.indexOf("-czf") + 2] || "");
      if (!dirExists(source) || !dirExists(parentPath(archive))) {
        return fail("tar: usage: tar -czf ARCHIVE SOURCE_DIR", ctx);
      }
      writeFile(archive, `archive:${source}`);
      state.milestones.archive = true;
      ctx.archivePath = archive;
      return ok(`created ${displayPath(archive)}`, ctx);
    }
    if (args.includes("-xzf")) {
      const archive = resolvePath(args[args.indexOf("-xzf") + 1] || "");
      const cIndex = args.indexOf("-C");
      const dest = resolvePath(cIndex >= 0 ? args[cIndex + 1] : ".");
      if (!fileExists(archive) || !dirExists(dest)) {
        return fail("tar: usage: tar -xzf ARCHIVE -C DEST", ctx);
      }
      ensureDir(`${dest}/atelier`);
      Object.entries(state.files).forEach(([path, file]) => {
        if (path.startsWith(`${HOME}/atelier/`)) {
          writeFile(`${dest}/atelier/${path.slice(`${HOME}/atelier/`.length)}`, file.content, file.executable);
        }
      });
      ctx.extractedTo = dest;
      return ok(`extracted ${displayPath(archive)} -> ${displayPath(dest)}`, ctx);
    }
    return fail("tar: supported forms are -czf and -xzf", ctx);
  }

  if (name === "curl") {
    const url = args[0];
    ctx.url = url;
    if (url !== "https://quest.local/status") {
      return fail("curl: this quest has https://quest.local/status", ctx);
    }
    const online = readFile(`${HOME}/config/app.conf`)?.includes("SERVICE=online");
    return ok(online ? "{\"service\":\"online\",\"city\":\"open\"}" : "{\"service\":\"offline\"}", ctx);
  }

  if (name === "ping") {
    const host = args[0];
    ctx.host = host;
    if (host !== "quest.local") {
      return fail("ping: unknown host in this quest", ctx);
    }
    return ok("PING quest.local\n64 bytes from quest.local: icmp_seq=1 time=1.2 ms\n64 bytes from quest.local: icmp_seq=2 time=1.1 ms", ctx);
  }

  if (name === "history") {
    return ok(state.history.map((item, index) => `${String(index + 1).padStart(3, " ")}  ${item}`).join("\n"), ctx);
  }

  if (name === "tree") {
    const path = resolvePath(args[0] || ".");
    if (!dirExists(path)) {
      return fail(`tree: ${displayPath(path)}: No such directory`, ctx);
    }
    ctx.treePath = path;
    return ok(buildTree(path), ctx);
  }

  return fail(`${name}: この物語ではまだ使いません。今の「やること」を試そう。`, ctx);
}

function buildTree(root) {
  const lines = [root === state.cwd ? "." : displayPath(root)];
  function add(path, prefix = "") {
    const children = [
      ...state.dirs.filter((dir) => isDirectChild(path, dir)).map((dir) => ({ path: dir, name: `${baseName(dir)}/`, dir: true })),
      ...Object.keys(state.files).filter((file) => isDirectChild(path, file)).map((file) => ({ path: file, name: baseName(file), dir: false }))
    ].sort((a, b) => a.name.localeCompare(b.name));
    children.forEach((child, index) => {
      const last = index === children.length - 1;
      lines.push(`${prefix}${last ? "`-- " : "|-- "}${child.name}`);
      if (child.dir) {
        add(child.path, `${prefix}${last ? "    " : "|   "}`);
      }
    });
  }
  add(root);
  return lines.join("\n");
}

function setAction(action) {
  state.lastAction = action;
  els.scene.className = `scene action-${action}`;
  if (state.milestones.listed) {
    els.scene.classList.add("has-listed");
  }
  if (state.milestones.atelier) {
    els.scene.classList.add("has-atelier");
  }
  if (state.milestones.note || fileExists(`${HOME}/atelier/plan.txt`)) {
    els.scene.classList.add("has-note");
  }
  if (state.milestones.archive) {
    els.scene.classList.add("has-archive");
  }
  window.setTimeout(() => {
    if (state.lastAction === action) {
      renderSceneClasses();
    }
  }, 900);
}

function renderSceneClasses() {
  els.scene.className = "scene action-idle";
  if (state.milestones.listed) {
    els.scene.classList.add("has-listed");
  }
  if (state.milestones.atelier) {
    els.scene.classList.add("has-atelier");
  }
  if (state.milestones.note || fileExists(`${HOME}/atelier/plan.txt`)) {
    els.scene.classList.add("has-note");
  }
  if (state.milestones.archive) {
    els.scene.classList.add("has-archive");
  }
}

function applyPlace(place) {
  document.querySelectorAll(".place").forEach((item) => {
    item.classList.toggle("active", item.dataset.place === place);
  });
  els.avatar.dataset.place = place;
}

function advanceIfNeeded(result) {
  if (!result.ok || state.complete) {
    return false;
  }
  const stage = currentStage();
  if (!stage.check(result.ctx)) {
    return false;
  }

  state.feedback = "正解。動きと結果を見て、次へ進みます。";
  state.output = result.output;
  state.story = stage.story;
  state.place = stage.place;
  setAction(stage.action);
  applyPlace(stage.place);
  state.step += 1;

  if (state.step >= stages.length) {
    state.complete = true;
    state.feedback = "完了。Linuxの基礎を一周しました。コマンド一覧で復習できます。";
    state.output = "Linux基礎コース完了。\n移動 / 読む / 作る / 探す / 権限 / 実行 / プロセス / 容量 / 圧縮 / 通信";
    state.story = "街の案内板がすべて点灯しました。コマンドは怖いものではなく、短い指示で世界を動かす道具です。";
  }

  saveState();
  render();
  return true;
}

function handleSubmit(command) {
  const raw = command.trim();
  if (!raw) {
    return;
  }

  state.history.push(raw);
  if (state.history.length > 120) {
    state.history = state.history.slice(-120);
  }

  const result = runCommand(raw);
  state.output = result.output;

  if (result.ok) {
    const advanced = advanceIfNeeded(result);
    if (!advanced) {
      state.feedback = "実行できました。今の目標と同じコマンドなら次へ進みます。";
      setAction(actionForCommand(result.ctx.name));
    }
  } else {
    state.feedback = "少し違います。ヒントか「答えを見る」を使って、必要な条件を確認してください。";
    els.commandInput.classList.remove("shake");
    void els.commandInput.offsetWidth;
    els.commandInput.classList.add("shake");
  }

  saveState();
  render();
}

function actionForCommand(name) {
  if (["cd"].includes(name)) return "walk";
  if (["mkdir", "tar"].includes(name)) return "build";
  if (["touch", "mv", "cp", "echo"].includes(name)) return "write";
  if (["grep", "find"].includes(name)) return "search";
  if (["chmod", "./scripts/launch.sh"].includes(name)) return "power";
  if (["ps", "kill"].includes(name)) return "process";
  if (["curl", "ping"].includes(name)) return "network";
  return "look";
}

function renderProgress() {
  els.progressDots.innerHTML = "";
  const currentChapter = chapterIndexFor();
  chapters.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = `dot ${index < currentChapter || state.complete ? "done" : ""} ${index === currentChapter && !state.complete ? "current" : ""}`;
    els.progressDots.appendChild(dot);
  });
  els.progressText.textContent = `${Math.min(state.step + 1, stages.length)} / ${stages.length}`;
}

function renderStage() {
  if (state.complete) {
    els.stageLabel.textContent = "Complete";
    els.stageTitle.textContent = "Linux基礎コース完了";
    els.stageText.textContent = "基本操作を一通り練習しました。? のコマンド一覧で復習できます。";
    els.focusCommand.textContent = "review";
    els.focusMeaning.textContent = "右上の ↻ で最初から再挑戦できます。";
    els.goalText.textContent = "復習する、または最初から再挑戦する";
    els.commandInput.placeholder = "ここにコマンドを入力";
    els.commandChips.innerHTML = "";
    ["history", "tree", "help"].forEach(addChip);
    return;
  }

  const stage = currentStage();
  els.stageLabel.textContent = `${stage.chapter} · Step ${state.step + 1}`;
  els.stageTitle.textContent = stage.title;
  els.stageText.textContent = stage.text;
  els.focusCommand.textContent = focusLabel(stage);
  els.focusMeaning.textContent = stage.meaning;
  els.goalText.textContent = taskText(stage);
  els.commandInput.placeholder = "ここにコマンドを入力";
  els.commandChips.innerHTML = "";
  hintChips(stage).forEach(addChip);
}

function addChip(text) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", () => {
    state.feedback = `手がかり: ${text}`;
    saveState();
    render();
    els.commandInput.focus();
  });
  els.commandChips.appendChild(button);
}

function renderBook() {
  els.bookList.innerHTML = "";
  commandBook.forEach(([cmd, desc]) => {
    const item = document.createElement("div");
    item.className = "book-item";
    item.innerHTML = `<strong>${cmd}</strong><p>${desc}</p>`;
    els.bookList.appendChild(item);
  });
}

function render() {
  renderProgress();
  renderStage();
  renderSceneClasses();
  applyPlace(state.complete ? "atelier" : state.place);
  els.storyLine.textContent = state.story;
  els.resultOutput.textContent = state.output;
  els.feedbackLine.textContent = state.feedback;
}

els.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = els.commandInput.value;
  els.commandInput.value = "";
  handleSubmit(value);
});

els.hintButton.addEventListener("click", () => {
  state.feedback = state.complete ? "コマンド一覧で復習できます。" : currentStage().hint;
  render();
  els.commandInput.focus();
});

els.fillButton.addEventListener("click", () => {
  state.feedback = state.complete
    ? "復習用コマンド例: history"
    : `答え: ${currentStage().command}`;
  render();
  els.commandInput.focus();
});

els.resetButton.addEventListener("click", () => {
  state = createState();
  saveState();
  render();
  els.commandInput.focus();
});

els.bookButton.addEventListener("click", () => {
  renderBook();
  if (typeof els.bookDialog.showModal === "function") {
    els.bookDialog.showModal();
  }
});

els.closeBook.addEventListener("click", () => {
  els.bookDialog.close();
});

renderBook();
render();
