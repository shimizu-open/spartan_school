const commands = [
  {
    name: "pwd",
    category: "移動",
    description: "現在いるディレクトリの絶対パスを表示します。",
    syntax: "pwd",
    example: "pwd",
    output: "/home/student",
    options: [
      ["-L", "シンボリックリンクを含む論理パスを表示します。"],
      ["-P", "実体の物理パスを表示します。"]
    ],
    note: "作業場所が分からなくなったら最初に使います。"
  },
  {
    name: "ls",
    category: "ファイル",
    description: "ファイルやディレクトリの一覧を表示します。",
    syntax: "ls [オプション] [パス]",
    example: "ls -la",
    output: "drwxr-xr-x  student  staff  .\n-rw-r--r--  student  staff  notes.txt",
    options: [
      ["-l", "権限、所有者、サイズ、更新日時を詳しく表示します。"],
      ["-a", "隠しファイルも表示します。"],
      ["-h", "サイズを読みやすい単位で表示します。"]
    ],
    note: "最初は ls、詳しく見る時は ls -la を覚えると実用的です。"
  },
  {
    name: "cd",
    category: "移動",
    description: "作業するディレクトリを移動します。",
    syntax: "cd [移動先]",
    example: "cd projects",
    output: "",
    options: [
      ["..", "1つ上のディレクトリへ移動します。"],
      ["-", "直前にいたディレクトリへ戻ります。"],
      ["~", "ホームディレクトリへ移動します。"]
    ],
    note: "cd だけを実行するとホームディレクトリへ移動します。"
  },
  {
    name: "mkdir",
    category: "ファイル",
    description: "新しいディレクトリを作成します。",
    syntax: "mkdir [オプション] ディレクトリ名",
    example: "mkdir logs",
    output: "",
    options: [
      ["-p", "途中の親ディレクトリもまとめて作成します。"],
      ["-v", "作成したディレクトリ名を表示します。"]
    ],
    note: "深い階層を作る時は mkdir -p app/src/components が便利です。"
  },
  {
    name: "touch",
    category: "ファイル",
    description: "空ファイルを作成、またはファイルの更新時刻を変更します。",
    syntax: "touch ファイル名",
    example: "touch memo.txt",
    output: "",
    options: [
      ["-c", "存在しないファイルを作成しません。"],
      ["-t", "指定した日時に更新時刻を変更します。"]
    ],
    note: "HTML/CSS/JS の空ファイル作成にもよく使います。"
  },
  {
    name: "cat",
    category: "表示・検索",
    description: "ファイルの内容をそのまま表示します。",
    syntax: "cat ファイル名",
    example: "cat notes.txt",
    output: "Linux command notes",
    options: [
      ["-n", "行番号を付けて表示します。"],
      ["-A", "改行やタブなどの不可視文字も表示します。"]
    ],
    note: "短いファイルの確認に向いています。長いファイルは less が読みやすいです。"
  },
  {
    name: "less",
    category: "表示・検索",
    description: "長いファイルをページ単位で閲覧します。",
    syntax: "less ファイル名",
    example: "less server.log",
    output: "",
    options: [
      ["/文字列", "表示中に検索します。"],
      ["q", "閲覧を終了します。"],
      ["G", "末尾へ移動します。"]
    ],
    note: "ログや設定ファイルを壊さずに読む時に使います。"
  },
  {
    name: "head",
    category: "表示・検索",
    description: "ファイルの先頭部分を表示します。",
    syntax: "head [オプション] ファイル名",
    example: "head -n 20 app.log",
    output: "先頭20行を表示",
    options: [
      ["-n 数字", "表示する行数を指定します。"],
      ["-c 数字", "表示するバイト数を指定します。"]
    ],
    note: "CSV やログの形を素早く確認できます。"
  },
  {
    name: "tail",
    category: "表示・検索",
    description: "ファイルの末尾部分を表示します。",
    syntax: "tail [オプション] ファイル名",
    example: "tail -f app.log",
    output: "末尾を表示し、追記を監視",
    options: [
      ["-n 数字", "表示する行数を指定します。"],
      ["-f", "ファイルへの追記をリアルタイムに表示します。"]
    ],
    note: "サーバーログ監視では tail -f をよく使います。"
  },
  {
    name: "cp",
    category: "ファイル",
    description: "ファイルやディレクトリをコピーします。",
    syntax: "cp [オプション] コピー元 コピー先",
    example: "cp notes.txt backup.txt",
    output: "",
    options: [
      ["-r", "ディレクトリを中身ごとコピーします。"],
      ["-i", "上書き前に確認します。"],
      ["-v", "コピーした内容を表示します。"]
    ],
    note: "同名ファイルを上書きする可能性があるため、コピー先をよく確認します。"
  },
  {
    name: "mv",
    category: "ファイル",
    description: "ファイルの移動、または名前変更をします。",
    syntax: "mv [オプション] 元の名前 新しい名前",
    example: "mv old.txt new.txt",
    output: "",
    options: [
      ["-i", "上書き前に確認します。"],
      ["-v", "移動した内容を表示します。"]
    ],
    note: "ファイル名変更にもディレクトリ移動にも使います。"
  },
  {
    name: "rm",
    category: "ファイル",
    description: "ファイルやディレクトリを削除します。",
    syntax: "rm [オプション] 対象",
    example: "rm old.log",
    output: "",
    options: [
      ["-i", "削除前に確認します。"],
      ["-r", "ディレクトリを中身ごと削除します。"],
      ["-f", "確認や警告を抑えて削除します。"]
    ],
    note: "削除は基本的に元に戻せません。rm -rf は対象パスを特に慎重に確認します。"
  },
  {
    name: "grep",
    category: "表示・検索",
    description: "ファイルや入力から指定した文字列を含む行を検索します。",
    syntax: "grep [オプション] 検索文字列 ファイル名",
    example: "grep error app.log",
    output: "2026-06-20 error: failed to connect",
    options: [
      ["-n", "行番号を表示します。"],
      ["-i", "大文字小文字を区別せず検索します。"],
      ["-r", "ディレクトリ内を再帰的に検索します。"]
    ],
    note: "ログ調査、設定確認、ソースコード検索で頻繁に使います。"
  },
  {
    name: "find",
    category: "表示・検索",
    description: "条件に合うファイルやディレクトリを探します。",
    syntax: "find 探す場所 条件",
    example: "find . -name '*.js'",
    output: "./script.js\n./src/app.js",
    options: [
      ["-name", "名前のパターンで探します。"],
      ["-type f", "ファイルだけを対象にします。"],
      ["-type d", "ディレクトリだけを対象にします。"]
    ],
    note: "カレントディレクトリ以下なら find . -name '名前' が基本形です。"
  },
  {
    name: "chmod",
    category: "権限",
    description: "ファイルやディレクトリの権限を変更します。",
    syntax: "chmod 権限 対象",
    example: "chmod +x deploy.sh",
    output: "",
    options: [
      ["+x", "実行権限を追加します。"],
      ["644", "所有者は読み書き、他は読み取りにします。"],
      ["755", "所有者は全権限、他は読み取りと実行にします。"]
    ],
    note: "スクリプトを実行可能にする時は chmod +x ファイル名 を使います。"
  },
  {
    name: "chown",
    category: "権限",
    description: "ファイルやディレクトリの所有者やグループを変更します。",
    syntax: "chown [オプション] ユーザー:グループ 対象",
    example: "sudo chown app:app server.log",
    output: "",
    options: [
      ["-R", "ディレクトリ配下をまとめて変更します。"],
      ["user:group", "所有者とグループを同時に指定します。"]
    ],
    note: "多くの場合は管理者権限が必要です。"
  },
  {
    name: "ps",
    category: "プロセス",
    description: "実行中のプロセスを表示します。",
    syntax: "ps [オプション]",
    example: "ps aux",
    output: "student  1842  0.0  node server.js",
    options: [
      ["aux", "全ユーザーの詳細なプロセス一覧を表示します。"],
      ["-ef", "親子関係を含めた一覧を表示します。"]
    ],
    note: "grep と組み合わせて特定プロセスを探すことが多いです。"
  },
  {
    name: "kill",
    category: "プロセス",
    description: "指定したプロセスに終了などのシグナルを送ります。",
    syntax: "kill [シグナル] PID",
    example: "kill 1842",
    output: "",
    options: [
      ["-9", "強制終了シグナルを送ります。"],
      ["-15", "通常終了シグナルを送ります。"]
    ],
    note: "まず通常の kill を試し、最後の手段として kill -9 を使います。"
  },
  {
    name: "top",
    category: "プロセス",
    description: "CPU やメモリ使用量をリアルタイムに表示します。",
    syntax: "top",
    example: "top",
    output: "PID USER  CPU  MEM COMMAND",
    options: [
      ["q", "top を終了します。"],
      ["P", "CPU 使用率で並び替えます。"],
      ["M", "メモリ使用率で並び替えます。"]
    ],
    note: "重い処理を見つける時に使います。"
  },
  {
    name: "df",
    category: "容量",
    description: "ファイルシステム全体の空き容量を表示します。",
    syntax: "df [オプション]",
    example: "df -h",
    output: "Filesystem  Size  Used  Avail  Use%\n/dev/sda1    80G   36G    41G   47%",
    options: [
      ["-h", "GB や MB など読みやすい単位で表示します。"],
      ["-T", "ファイルシステム種別も表示します。"]
    ],
    note: "ディスク全体がいっぱいかどうかを見るコマンドです。"
  },
  {
    name: "du",
    category: "容量",
    description: "ファイルやディレクトリごとの使用容量を表示します。",
    syntax: "du [オプション] 対象",
    example: "du -sh logs",
    output: "1.2G  logs",
    options: [
      ["-s", "合計だけを表示します。"],
      ["-h", "読みやすい単位で表示します。"],
      ["-d 数字", "表示する階層の深さを指定します。"]
    ],
    note: "どのディレクトリが容量を使っているか調べる時に使います。"
  },
  {
    name: "tar",
    category: "圧縮",
    description: "複数ファイルをまとめたり、tar.gz を展開したりします。",
    syntax: "tar [オプション] アーカイブ名 対象",
    example: "tar -czf backup.tar.gz project",
    output: "",
    options: [
      ["-c", "新しくアーカイブを作成します。"],
      ["-x", "アーカイブを展開します。"],
      ["-z", "gzip 圧縮を使います。"],
      ["-f", "ファイル名を指定します。"]
    ],
    note: "作成は tar -czf、展開は tar -xzf が基本です。"
  },
  {
    name: "curl",
    category: "ネットワーク",
    description: "URL にリクエストを送り、レスポンスを取得します。",
    syntax: "curl [オプション] URL",
    example: "curl https://example.com",
    output: "<!doctype html>...",
    options: [
      ["-I", "ヘッダーだけを取得します。"],
      ["-L", "リダイレクトをたどります。"],
      ["-o", "レスポンスをファイルに保存します。"]
    ],
    note: "API や Web サーバーの疎通確認で使います。"
  },
  {
    name: "ssh",
    category: "ネットワーク",
    description: "リモートサーバーへ安全にログインします。",
    syntax: "ssh ユーザー名@ホスト名",
    example: "ssh student@example.com",
    output: "",
    options: [
      ["-i", "秘密鍵ファイルを指定します。"],
      ["-p", "接続先ポートを指定します。"]
    ],
    note: "鍵ファイルの権限が広すぎると接続を拒否されることがあります。"
  },
  {
    name: "man",
    category: "便利",
    description: "コマンドのマニュアルを表示します。",
    syntax: "man コマンド名",
    example: "man grep",
    output: "GREP(1) User Commands",
    options: [
      ["/文字列", "マニュアル内を検索します。"],
      ["q", "マニュアルを終了します。"]
    ],
    note: "オプションの意味を公式の説明で確認できます。"
  },
  {
    name: "history",
    category: "便利",
    description: "過去に実行したコマンド履歴を表示します。",
    syntax: "history",
    example: "history | tail",
    output: "101  ls -la\n102  git status",
    options: [
      ["!番号", "履歴番号のコマンドを再実行します。"],
      ["Ctrl + r", "履歴をインクリメンタル検索します。"]
    ],
    note: "似た作業を繰り返す時に便利ですが、危険なコマンドの再実行には注意します。"
  },
  {
    name: "echo",
    category: "便利",
    description: "文字列や変数の値を表示します。",
    syntax: "echo [文字列]",
    example: "echo $HOME",
    output: "/home/student",
    options: [
      ["-n", "最後の改行を出力しません。"],
      ["$変数名", "環境変数の値を表示します。"]
    ],
    note: "シェルスクリプトの動作確認にも使います。"
  }
];

const practiceChallenges = [
  {
    title: "現在地を確認する",
    text: "今いるディレクトリの絶対パスを表示してください。",
    answers: ["pwd"],
    hint: "print working directory の略です。",
    output: "/home/student",
    explanation: "pwd は現在の作業ディレクトリを表示します。"
  },
  {
    title: "隠しファイルも含めて詳しく見る",
    text: "ファイル一覧を、隠しファイル込みで詳細表示してください。",
    answers: ["ls -la", "ls -al"],
    hint: "詳細表示は -l、隠しファイル表示は -a です。",
    output: "drwxr-xr-x  student  staff  .\ndrwxr-xr-x  student  staff  ..\n-rw-r--r--  student  staff  .bashrc\n-rw-r--r--  student  staff  notes.txt",
    explanation: "ls -la は詳細情報と隠しファイルをまとめて表示します。"
  },
  {
    title: "ディレクトリをまとめて作る",
    text: "app/src/components という深いディレクトリを一度に作成してください。",
    answers: ["mkdir -p app/src/components"],
    hint: "親ディレクトリもまとめて作るオプションを使います。",
    output: "created app/src/components",
    explanation: "mkdir -p は存在しない親ディレクトリも作成します。"
  },
  {
    title: "ファイルからエラーを探す",
    text: "app.log から error を含む行を検索してください。",
    answers: ["grep error app.log"],
    hint: "文字列検索には grep を使います。",
    output: "2026-06-20 15:24:11 error: failed to connect",
    explanation: "grep 検索文字列 ファイル名 の順で指定します。"
  },
  {
    title: "JavaScript ファイルを探す",
    text: "現在のディレクトリ以下から .js ファイルを探してください。",
    answers: ["find . -name '*.js'", "find . -name \"*.js\""],
    hint: "find . -name にファイル名のパターンを渡します。",
    output: "./script.js\n./src/app.js",
    explanation: "find . -name '*.js' は現在地以下で名前が .js に合うファイルを探します。"
  },
  {
    title: "スクリプトを実行可能にする",
    text: "deploy.sh に実行権限を追加してください。",
    answers: ["chmod +x deploy.sh"],
    hint: "実行権限は x、追加は + を使います。",
    output: "mode changed: deploy.sh",
    explanation: "chmod +x は対象ファイルへ実行権限を追加します。"
  },
  {
    title: "ディスク容量を読みやすく見る",
    text: "ファイルシステムの空き容量を読みやすい単位で表示してください。",
    answers: ["df -h"],
    hint: "human readable の h を使います。",
    output: "Filesystem  Size  Used  Avail  Use%\n/dev/sda1    80G   36G    41G   47%",
    explanation: "df -h はディスク全体の空き容量を MB や GB で表示します。"
  },
  {
    title: "ログの末尾を監視する",
    text: "app.log の追記をリアルタイムに表示してください。",
    answers: ["tail -f app.log"],
    hint: "末尾を見るコマンドに follow のオプションを付けます。",
    output: "watching app.log...\nGET / 200\nGET /styles.css 200",
    explanation: "tail -f はログの追記を監視する定番コマンドです。"
  }
];

const categoryOrder = ["すべて", "移動", "ファイル", "表示・検索", "権限", "プロセス", "容量", "圧縮", "ネットワーク", "便利"];
const storageKey = "linux-command-lab-state";

const state = {
  selectedCategory: "すべて",
  selectedCommand: commands[0].name,
  query: "",
  learned: new Set(),
  quiz: {
    current: null,
    score: 0,
    answered: 0,
    best: 0,
    locked: false
  },
  practiceIndex: 0
};

const elements = {
  learnedCount: document.querySelector("#learnedCount"),
  totalCount: document.querySelector("#totalCount"),
  quizBest: document.querySelector("#quizBest"),
  searchInput: document.querySelector("#searchInput"),
  categoryList: document.querySelector("#categoryList"),
  commandList: document.querySelector("#commandList"),
  commandDetail: document.querySelector("#commandDetail"),
  terminalPreview: document.querySelector("#terminalPreview"),
  sheetBody: document.querySelector("#sheetBody"),
  resetProgress: document.querySelector("#resetProgress"),
  tabs: document.querySelectorAll(".tab-button"),
  views: document.querySelectorAll(".view"),
  challengeTitle: document.querySelector("#challengeTitle"),
  challengeText: document.querySelector("#challengeText"),
  practiceInput: document.querySelector("#practiceInput"),
  runPractice: document.querySelector("#runPractice"),
  showHint: document.querySelector("#showHint"),
  nextChallenge: document.querySelector("#nextChallenge"),
  practiceOutput: document.querySelector("#practiceOutput"),
  quizQuestion: document.querySelector("#quizQuestion"),
  quizOptions: document.querySelector("#quizOptions"),
  quizFeedback: document.querySelector("#quizFeedback"),
  quizScore: document.querySelector("#quizScore"),
  nextQuiz: document.querySelector("#nextQuiz")
};

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    state.learned = new Set(Array.isArray(saved.learned) ? saved.learned : []);
    state.quiz.best = Number.isFinite(saved.quizBest) ? saved.quizBest : 0;
    if (commands.some((command) => command.name === saved.selectedCommand)) {
      state.selectedCommand = saved.selectedCommand;
    }
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    learned: [...state.learned],
    quizBest: state.quiz.best,
    selectedCommand: state.selectedCommand
  }));
}

function getCommand(name) {
  return commands.find((command) => command.name === name) || commands[0];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeCommand(value) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/;$/, "");
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getFilteredCommands() {
  const query = state.query.toLowerCase();
  return commands.filter((command) => {
    const categoryMatch = state.selectedCategory === "すべて" || command.category === state.selectedCategory;
    const haystack = [
      command.name,
      command.category,
      command.description,
      command.syntax,
      command.example,
      command.note,
      command.options.map((option) => option.join(" ")).join(" ")
    ].join(" ").toLowerCase();

    return categoryMatch && haystack.includes(query);
  });
}

function renderProgress() {
  elements.learnedCount.textContent = state.learned.size;
  elements.totalCount.textContent = commands.length;
  elements.quizBest.textContent = `${state.quiz.best}%`;
}

function renderCategories() {
  const categories = categoryOrder.filter((category) => {
    return category === "すべて" || commands.some((command) => command.category === category);
  });

  elements.categoryList.innerHTML = categories.map((category) => {
    const count = category === "すべて"
      ? commands.length
      : commands.filter((command) => command.category === category).length;

    return `
      <button class="category-button ${category === state.selectedCategory ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">
        <span>${escapeHtml(category)}</span>
        <span class="category-count">${count}</span>
      </button>
    `;
  }).join("");
}

function renderCommandList() {
  const filtered = getFilteredCommands();

  if (!filtered.some((command) => command.name === state.selectedCommand) && filtered.length > 0) {
    state.selectedCommand = filtered[0].name;
  }

  if (filtered.length === 0) {
    elements.commandList.innerHTML = '<p class="empty-state">条件に合うコマンドがありません。</p>';
    return;
  }

  elements.commandList.innerHTML = filtered.map((command) => `
    <button class="command-card ${command.name === state.selectedCommand ? "active" : ""} ${state.learned.has(command.name) ? "learned" : ""}" type="button" data-command="${escapeHtml(command.name)}">
      <span class="command-name">
        <code>${escapeHtml(command.name)}</code>
        <span class="learned-dot" aria-label="${state.learned.has(command.name) ? "習得済み" : "未習得"}"></span>
      </span>
      <p>${escapeHtml(command.description)}</p>
      <span class="tag-row">
        <span class="tag">${escapeHtml(command.category)}</span>
      </span>
    </button>
  `).join("");
}

function renderCommandDetail() {
  const command = getCommand(state.selectedCommand);
  elements.terminalPreview.textContent = `$ ${command.example}\n${command.output || "実行後、必要に応じて次のプロンプトへ戻ります。"}`;

  const options = command.options.map(([option, text]) => `
    <li><code>${escapeHtml(option)}</code> ${escapeHtml(text)}</li>
  `).join("");

  elements.commandDetail.innerHTML = `
    <div class="terminal-visual" aria-hidden="true">
      <div class="terminal-bar">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <pre>$ ${escapeHtml(command.example)}
${escapeHtml(command.output || "実行後、必要に応じて次のプロンプトへ戻ります。")}</pre>
    </div>
    <div class="detail-body">
      <div class="detail-title">
        <div>
          <code>${escapeHtml(command.name)}</code>
          <h2>${escapeHtml(command.description)}</h2>
        </div>
        <button class="mark-button ${state.learned.has(command.name) ? "active" : ""}" type="button" data-mark="${escapeHtml(command.name)}">
          ${state.learned.has(command.name) ? "習得済み" : "習得にする"}
        </button>
      </div>

      <div class="syntax-box">
        <span class="section-kicker">構文</span>
        <code>${escapeHtml(command.syntax)}</code>
        <p>例: <strong>${escapeHtml(command.example)}</strong></p>
      </div>

      <div class="detail-grid">
        <section class="detail-section">
          <h3>よく使うオプション</h3>
          <ul class="option-list">${options}</ul>
        </section>
        <section class="detail-section">
          <h3>覚えどころ</h3>
          <p>${escapeHtml(command.note)}</p>
        </section>
      </div>
    </div>
  `;
}

function renderSheet() {
  elements.sheetBody.innerHTML = commands.map((command) => `
    <tr>
      <td><code>${escapeHtml(command.name)}</code></td>
      <td>${escapeHtml(command.description)}</td>
      <td>${escapeHtml(command.example)}</td>
      <td>${escapeHtml(command.category)}</td>
    </tr>
  `).join("");
}

function renderChallenge() {
  const challenge = practiceChallenges[state.practiceIndex];
  elements.challengeTitle.textContent = challenge.title;
  elements.challengeText.textContent = challenge.text;
  elements.practiceInput.value = "";
  elements.practiceOutput.textContent = "課題に合うコマンドを入力すると、結果と解説が表示されます。";
}

function runPractice() {
  const challenge = practiceChallenges[state.practiceIndex];
  const input = normalizeCommand(elements.practiceInput.value);

  if (!input) {
    elements.practiceOutput.textContent = "コマンドを入力してください。";
    return;
  }

  const isCorrect = challenge.answers.includes(input);
  if (isCorrect) {
    const commandName = input.split(" ")[0];
    if (commands.some((command) => command.name === commandName)) {
      state.learned.add(commandName);
      saveState();
    }

    elements.practiceOutput.textContent = [
      `$ ${input}`,
      challenge.output,
      "",
      `正解: ${challenge.explanation}`
    ].filter(Boolean).join("\n");
    renderAll();
    return;
  }

  elements.practiceOutput.textContent = [
    `$ ${input}`,
    "まだ正解ではありません。",
    `ヒント: ${challenge.hint}`
  ].join("\n");
}

function showPracticeHint() {
  const challenge = practiceChallenges[state.practiceIndex];
  elements.practiceOutput.textContent = `ヒント: ${challenge.hint}`;
}

function nextPractice() {
  state.practiceIndex = (state.practiceIndex + 1) % practiceChallenges.length;
  renderChallenge();
  elements.practiceInput.focus();
}

function makeQuizQuestion() {
  const current = commands[Math.floor(Math.random() * commands.length)];
  const distractors = shuffle(commands.filter((command) => command.name !== current.name)).slice(0, 3);
  state.quiz.current = {
    command: current,
    options: shuffle([current, ...distractors])
  };
  state.quiz.locked = false;
  renderQuiz();
}

function renderQuiz() {
  const quiz = state.quiz.current;
  if (!quiz) return;

  elements.quizQuestion.textContent = `「${quiz.command.description}」に合うコマンドは？`;
  elements.quizScore.textContent = `${state.quiz.score} / ${state.quiz.answered}`;
  elements.quizFeedback.textContent = "";
  elements.nextQuiz.disabled = false;
  elements.quizOptions.innerHTML = quiz.options.map((command) => `
    <button class="quiz-option" type="button" data-answer="${escapeHtml(command.name)}">
      <code>${escapeHtml(command.name)}</code>
    </button>
  `).join("");
}

function answerQuiz(answer) {
  if (state.quiz.locked || !state.quiz.current) return;

  const correct = state.quiz.current.command.name;
  const isCorrect = answer === correct;
  state.quiz.locked = true;
  state.quiz.answered += 1;

  if (isCorrect) {
    state.quiz.score += 1;
    state.learned.add(correct);
    elements.quizFeedback.textContent = `正解です。${correct} は ${state.quiz.current.command.example} のように使います。`;
  } else {
    elements.quizFeedback.textContent = `正解は ${correct} です。${state.quiz.current.command.note}`;
  }

  const rate = Math.round((state.quiz.score / state.quiz.answered) * 100);
  state.quiz.best = Math.max(state.quiz.best, rate);
  elements.quizScore.textContent = `${state.quiz.score} / ${state.quiz.answered}`;

  document.querySelectorAll(".quiz-option").forEach((button) => {
    const value = button.dataset.answer;
    button.disabled = true;
    if (value === correct) button.classList.add("correct");
    if (value === answer && !isCorrect) button.classList.add("wrong");
  });

  saveState();
  renderProgress();
  renderCommandList();
}

function switchView(viewId) {
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
  elements.views.forEach((view) => view.classList.toggle("active", view.id === viewId));

  if (viewId === "practiceView") {
    elements.practiceInput.focus();
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCommandList();
    renderCommandDetail();
  });

  elements.categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    state.selectedCategory = button.dataset.category;
    renderCategories();
    renderCommandList();
    renderCommandDetail();
  });

  elements.commandList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command]");
    if (!button) return;

    state.selectedCommand = button.dataset.command;
    saveState();
    renderCommandList();
    renderCommandDetail();
  });

  elements.commandDetail.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mark]");
    if (!button) return;

    const name = button.dataset.mark;
    if (state.learned.has(name)) {
      state.learned.delete(name);
    } else {
      state.learned.add(name);
    }

    saveState();
    renderAll();
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  elements.runPractice.addEventListener("click", runPractice);
  elements.showHint.addEventListener("click", showPracticeHint);
  elements.nextChallenge.addEventListener("click", nextPractice);
  elements.practiceInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runPractice();
  });

  elements.quizOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-answer]");
    if (!button) return;
    answerQuiz(button.dataset.answer);
  });

  elements.nextQuiz.addEventListener("click", makeQuizQuestion);

  elements.resetProgress.addEventListener("click", () => {
    state.learned.clear();
    state.quiz.best = 0;
    state.quiz.score = 0;
    state.quiz.answered = 0;
    saveState();
    renderAll();
    makeQuizQuestion();
  });
}

function renderAll() {
  renderProgress();
  renderCategories();
  renderCommandList();
  renderCommandDetail();
  renderSheet();
}

loadState();
bindEvents();
renderAll();
renderChallenge();
makeQuizQuestion();
