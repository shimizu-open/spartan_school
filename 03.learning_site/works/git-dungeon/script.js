const terrainRows = [
  "###############",
  "#H..i.k..#...R#",
  "#.###.##.#.#..#",
  "#...#..s...#..#",
  "###.#.###G###.#",
  "#...#..A..F...#",
  "#.#.#######.#.#",
  "#.#B....M..#T.#",
  "#.#.###.###.#.#",
  "#...n.....P...#",
  "###############"
];

const storageKey = "git-dungeon-progress-v1";

const fileTemplates = {
  i: { id: "index", name: "index.html", short: "HT", x: 4, y: 1 },
  k: { id: "script", name: "script.js", short: "JS", x: 6, y: 1 },
  s: { id: "styles", name: "styles.css", short: "CS", x: 7, y: 3 },
  n: { id: "nav", name: "nav.js", short: "NV", x: 4, y: 9 }
};

const landmarks = {
  H: {
    id: "shrine",
    name: ".gitの祠",
    className: "shrine",
    label: "INIT",
    hint: "git init"
  },
  A: {
    id: "altar",
    name: "ステージ祭壇",
    className: "altar",
    label: "ADD",
    hint: "git add"
  },
  F: {
    id: "forge",
    name: "コミット鍛冶場",
    className: "forge",
    label: "COM",
    hint: "git commit"
  },
  B: {
    id: "branch",
    name: "ブランチ門",
    className: "branch",
    label: "BR",
    hint: "git switch -c"
  },
  M: {
    id: "merge",
    name: "合流橋",
    className: "merge",
    label: "MRG",
    hint: "git merge"
  },
  T: {
    id: "tower",
    name: "衝突の塔",
    className: "tower",
    label: "CON",
    hint: "merge conflict"
  },
  P: {
    id: "remote",
    name: "遠征ビーコン",
    className: "remote",
    label: "UP",
    hint: "git push"
  },
  R: {
    id: "rest",
    name: "回復の泉",
    className: "rest",
    label: "REST",
    hint: "HP回復"
  },
  G: {
    id: "gate",
    name: "履歴の鉄扉",
    className: "gate",
    label: "LOCK",
    hint: "初回commitで開く"
  }
};

const enemies = [
  { id: "bug-west", x: 3, y: 5, label: "BUG" },
  { id: "bug-east", x: 11, y: 3, label: "BUG" },
  { id: "bug-south", x: 1, y: 9, label: "BUG" }
];

const els = {
  levelValue: document.querySelector("#levelValue"),
  hpValue: document.querySelector("#hpValue"),
  xpValue: document.querySelector("#xpValue"),
  branchValue: document.querySelector("#branchValue"),
  questAct: document.querySelector("#questAct"),
  questTitle: document.querySelector("#questTitle"),
  questText: document.querySelector("#questText"),
  mapGrid: document.querySelector("#mapGrid"),
  placeName: document.querySelector("#placeName"),
  placeHint: document.querySelector("#placeHint"),
  commandChips: document.querySelector("#commandChips"),
  commandInput: document.querySelector("#commandInput"),
  runCommand: document.querySelector("#runCommand"),
  choicePanel: document.querySelector("#choicePanel"),
  inventoryList: document.querySelector("#inventoryList"),
  historyList: document.querySelector("#historyList"),
  gameLog: document.querySelector("#gameLog"),
  resetGame: document.querySelector("#resetGame"),
  lookButton: document.querySelector("#lookButton")
};

let state = loadState();

function createDefaultState() {
  return {
    player: { x: 1, y: 1 },
    hp: 100,
    xp: 0,
    repo: false,
    branch: "none",
    files: {
      index: { ...fileTemplates.i, status: "world" },
      script: { ...fileTemplates.k, status: "world" },
      styles: { ...fileTemplates.s, status: "world" },
      nav: { ...fileTemplates.n, status: "hidden" }
    },
    commits: [],
    firstCommit: false,
    featureCreated: false,
    navCommit: false,
    mergedFeature: false,
    conflictStarted: false,
    conflictResolved: false,
    conflictStaged: false,
    conflictCommit: false,
    remoteAdded: false,
    pushed: false,
    defeatedEnemies: [],
    log: [
      "迷宮に入った。まずは .git の祠で git init を唱える。"
    ]
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) {
      return createDefaultState();
    }
    const fresh = createDefaultState();
    return {
      ...fresh,
      ...saved,
      player: { ...fresh.player, ...(saved.player || {}) },
      files: { ...fresh.files, ...(saved.files || {}) },
      commits: Array.isArray(saved.commits) ? saved.commits : [],
      defeatedEnemies: Array.isArray(saved.defeatedEnemies) ? saved.defeatedEnemies : [],
      log: Array.isArray(saved.log) && saved.log.length ? saved.log : fresh.log
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function currentQuest() {
  const initialFiles = ["index", "script", "styles"];
  const collectedInitial = initialFiles.filter((id) => state.files[id].status !== "world").length;
  const stagedInitial = initialFiles.filter((id) => state.files[id].status === "staged").length;

  if (!state.repo) {
    return {
      act: "ACT 1",
      title: ".gitの祠を起動する",
      text: "祠の上で git init を唱える。迷宮がリポジトリとして目を覚ます。",
      chips: ["git", "init", "status"],
      target: "shrine"
    };
  }

  if (collectedInitial < initialFiles.length) {
    return {
      act: "ACT 2",
      title: "3つのファイルを拾う",
      text: "HTML、CSS、JSのかけらをマップ上で集める。拾うと作業場に入る。",
      chips: ["git", "status"],
      target: "files"
    };
  }

  if (stagedInitial < initialFiles.length && !state.firstCommit) {
    return {
      act: "ACT 3",
      title: "ステージ祭壇でファイルを並べる",
      text: "ステージ祭壇に立ち、git add . を唱える。作業場のファイルがコミット候補になる。",
      chips: ["git", "add", ".", "status"],
      target: "altar"
    };
  }

  if (!state.firstCommit) {
    return {
      act: "ACT 4",
      title: "最初のコミットを鍛える",
      text: "コミット鍛冶場へ行き、git commit -m \"first commit\" で履歴を作る。鉄扉も開く。",
      chips: ["git", "commit", "-m", "\"first commit\"", "status"],
      target: "forge"
    };
  }

  if (!state.featureCreated) {
    return {
      act: "ACT 5",
      title: "ブランチ門を開く",
      text: "ブランチ門で git switch -c feature/nav を唱える。別ルートに進める。",
      chips: ["git", "switch", "-c", "feature/nav", "checkout", "-b"],
      target: "branch"
    };
  }

  if (state.files.nav.status === "world") {
    return {
      act: "ACT 6",
      title: "nav.jsを拾う",
      text: "feature/navに入ると南側に nav.js が現れる。拾ってから次へ進む。",
      chips: ["git", "status"],
      target: "nav"
    };
  }

  if (state.files.nav.status === "worktree") {
    return {
      act: "ACT 7",
      title: "nav.jsをステージに置く",
      text: "ステージ祭壇で git add nav.js を唱える。feature/navの変更だけを選ぶ。",
      chips: ["git", "add", "nav.js", "status"],
      target: "altar"
    };
  }

  if (!state.navCommit) {
    return {
      act: "ACT 8",
      title: "feature/navに記録する",
      text: "コミット鍛冶場で git commit -m \"add nav\" を唱える。",
      chips: ["git", "commit", "-m", "\"add nav\""],
      target: "forge"
    };
  }

  if (state.branch !== "main") {
    return {
      act: "ACT 9",
      title: "mainへ戻る",
      text: "git switch main を唱えて合流の準備をする。",
      chips: ["git", "switch", "main", "checkout"],
      target: "any"
    };
  }

  if (!state.mergedFeature) {
    return {
      act: "ACT 10",
      title: "合流橋でmergeする",
      text: "合流橋に立ち、git merge feature/nav を唱える。分岐で作った道が本線につながる。",
      chips: ["git", "merge", "feature/nav", "log", "--oneline"],
      target: "merge"
    };
  }

  if (!state.conflictStarted) {
    return {
      act: "ACT 11",
      title: "衝突の塔へ入る",
      text: "衝突の塔で git merge feature/title を唱える。同じ行の変更がぶつかる。",
      chips: ["git", "merge", "feature/title", "status"],
      target: "tower"
    };
  }

  if (!state.conflictResolved) {
    return {
      act: "ACT 12",
      title: "衝突した行を選ぶ",
      text: "塔の選択肢から、両方の意図が残る見出しを選ぶ。",
      chips: [],
      target: "tower"
    };
  }

  if (!state.conflictStaged) {
    return {
      act: "ACT 13",
      title: "解決済みとしてステージする",
      text: "衝突を直した index.html を git add index.html でステージに戻す。",
      chips: ["git", "add", "index.html", "status"],
      target: "tower"
    };
  }

  if (!state.conflictCommit) {
    return {
      act: "ACT 14",
      title: "衝突解決を記録する",
      text: "git commit -m \"resolve title\" で合流コミットを作る。",
      chips: ["git", "commit", "-m", "\"resolve title\""],
      target: "forge"
    };
  }

  if (!state.remoteAdded) {
    return {
      act: "ACT 15",
      title: "遠征先を登録する",
      text: "遠征ビーコンで git remote add origin git@github.com:you/repo.git を唱える。",
      chips: ["git", "remote", "add", "origin", "git@github.com:you/repo.git"],
      target: "remote"
    };
  }

  if (!state.pushed) {
    return {
      act: "ACT 16",
      title: "迷宮の外へpushする",
      text: "遠征ビーコンで git push -u origin main を唱える。これで脱出できる。",
      chips: ["git", "push", "-u", "origin", "main"],
      target: "remote"
    };
  }

  return {
    act: "CLEAR",
    title: "リポジトリの迷宮を踏破した",
    text: "init、add、commit、branch、merge、conflict、pushまで通り抜けた。",
    chips: ["git", "log", "--oneline", "status"],
    target: "done"
  };
}

function render() {
  renderHud();
  renderQuest();
  renderMap();
  renderPlace();
  renderCommands();
  renderInventory();
  renderHistory();
  renderLog();
  saveState();
}

function renderHud() {
  els.levelValue.textContent = level();
  els.hpValue.textContent = state.hp;
  els.xpValue.textContent = state.xp;
  els.branchValue.textContent = state.branch;
}

function renderQuest() {
  const quest = currentQuest();
  els.questAct.textContent = quest.act;
  els.questTitle.textContent = quest.title;
  els.questText.textContent = quest.text;
}

function renderMap() {
  const cells = [];

  terrainRows.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      cells.push(renderCell(symbol, x, y));
    });
  });

  els.mapGrid.innerHTML = cells.join("");
}

function renderCell(symbol, x, y) {
  const playerHere = state.player.x === x && state.player.y === y;
  const file = fileAt(x, y);
  const enemy = enemyAt(x, y);
  const classes = ["tile"];
  let label = "";

  if (symbol === "#") {
    classes.push("wall");
  } else if (symbol === "G") {
    classes.push("gate");
    if (state.firstCommit) {
      classes.push("open");
      label = "OPEN";
    } else {
      label = "LOCK";
    }
  } else {
    classes.push("floor");
  }

  const landmark = landmarks[symbol];
  if (landmark && symbol !== "G") {
    classes.push("landmark", landmark.className);
    label = landmark.label;
  }

  if (file) {
    classes.push("file");
    label = file.short;
  }

  if (enemy) {
    classes.push("enemy");
    label = enemy.label;
  }

  if (playerHere) {
    classes.push("player");
  }

  return `<div class="${classes.join(" ")}" data-x="${x}" data-y="${y}"><span class="mini">${escapeHtml(label)}</span></div>`;
}

function renderPlace() {
  const place = currentPlace();
  els.placeName.textContent = place.name;
  els.placeHint.textContent = place.hint;
  const shouldShowChoices = state.conflictStarted && !state.conflictResolved && place.id === "tower";
  els.choicePanel.hidden = !shouldShowChoices;
}

function renderCommands() {
  const chips = currentQuest().chips;
  els.commandChips.innerHTML = chips.map((chip) => (
    `<button type="button" data-chip="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`
  )).join("");
}

function renderInventory() {
  const cards = Object.values(state.files)
    .filter((file) => file.status !== "hidden")
    .map((file) => `
      <article class="item-card ${escapeHtml(file.status)}">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${escapeHtml(statusLabel(file.status))}</span>
      </article>
    `);

  if (!cards.length) {
    cards.push(`<article class="item-card world"><strong>空</strong><span>まだ何も拾っていない。</span></article>`);
  }
  els.inventoryList.innerHTML = cards.join("");
}

function renderHistory() {
  const cards = state.commits.map((commit, index) => `
    <article class="commit-card">
      <strong>${escapeHtml(String(index + 1).padStart(2, "0"))} ${escapeHtml(commit.title)}</strong>
      <span>${escapeHtml(commit.detail)}</span>
    </article>
  `);

  if (!cards.length) {
    cards.push(`<article class="commit-card"><strong>履歴なし</strong><span>commitを作るとここに残る。</span></article>`);
  }
  els.historyList.innerHTML = cards.join("");
}

function renderLog() {
  els.gameLog.textContent = state.log.slice(-18).join("\n");
  els.gameLog.scrollTop = els.gameLog.scrollHeight;
}

function movePlayer(dx, dy) {
  const x = state.player.x + dx;
  const y = state.player.y + dy;

  if (isBlocked(x, y)) {
    flash(els.mapGrid, "bump");
    return;
  }

  state.player = { x, y };
  handleArrival();
  render();
}

function isBlocked(x, y) {
  const symbol = tileAt(x, y);
  if (!symbol || symbol === "#") {
    addLog("壁にぶつかった。");
    return true;
  }
  if (symbol === "G" && !state.firstCommit) {
    addLog("履歴の鉄扉は閉じている。最初のcommitが鍵になる。");
    return true;
  }
  return false;
}

function handleArrival() {
  const file = fileAt(state.player.x, state.player.y);
  if (file && file.status === "world") {
    file.status = "worktree";
    gain(14);
    addLog(`${file.name} を拾った。作業場に入った。`);
  }

  const enemy = enemyAt(state.player.x, state.player.y);
  if (enemy) {
    state.defeatedEnemies.push(enemy.id);
    state.hp = Math.max(1, state.hp - 6);
    gain(10);
    addLog("バグに襲われたが切り抜けた。HP -6 / EXP +10");
  }

  if (currentPlace().id === "rest" && state.hp < 100) {
    state.hp = Math.min(100, state.hp + 22);
    addLog("回復の泉で体勢を立て直した。HP +22");
  }
}

function runCommand() {
  const command = normalize(els.commandInput.value);
  if (!command) {
    fail("何も唱えていない。");
    return;
  }

  if (command === "git status") {
    addLog(statusOutput());
    els.commandInput.value = "";
    render();
    return;
  }

  if (command === "git log --oneline") {
    addLog(logOutput());
    els.commandInput.value = "";
    render();
    return;
  }

  const handled = handleGitCommand(command);
  els.commandInput.value = "";
  if (!handled) {
    fail(`そのコマンドは今の迷宮には効かない: ${command}`);
  } else {
    render();
  }
}

function handleGitCommand(command) {
  if (command === "git init") {
    return handleInit();
  }

  if (command.startsWith("git add ")) {
    return handleAdd(command.replace("git add ", ""));
  }

  if (/^git commit -m\s+["'].+["']$/.test(command)) {
    return handleCommit(command);
  }

  if (command === "git switch -c feature/nav" || command === "git checkout -b feature/nav") {
    return handleBranch();
  }

  if (command === "git switch main" || command === "git checkout main") {
    return handleSwitchMain();
  }

  if (command === "git merge feature/nav") {
    return handleMergeFeature();
  }

  if (command === "git merge feature/title") {
    return handleConflictStart();
  }

  if (/^git remote add origin .+/.test(command)) {
    return handleRemoteAdd();
  }

  if (command === "git push -u origin main") {
    return handlePush();
  }

  return false;
}

function handleInit() {
  if (!requirePlace("shrine", ".gitの祠でないと起動できない。")) {
    return true;
  }
  if (state.repo) {
    addLog("もうリポジトリは起動している。");
    return true;
  }
  state.repo = true;
  state.branch = "main";
  gain(40);
  addLog("Initialized empty Git repository in .git/\n迷宮がリポジトリとして起動した。");
  flash(els.mapGrid, "flash");
  return true;
}

function handleAdd(target) {
  if (!state.repo) {
    fail("先に git init が必要。");
    return true;
  }
  if (!requirePlace(state.conflictStarted ? "tower" : "altar", state.conflictStarted ? "衝突の塔で解決済みファイルをaddする。" : "ステージ祭壇でaddする。")) {
    return true;
  }

  const names = target === "."
    ? Object.values(state.files).filter((file) => file.status === "worktree").map((file) => file.name)
    : [target];

  const staged = [];
  names.forEach((name) => {
    const file = fileByName(name);
    if (file && file.status === "worktree") {
      file.status = "staged";
      staged.push(file.name);
    }
  });

  if (!staged.length) {
    fail("ステージできるファイルがない。git statusで状態を確認する。");
    return true;
  }

  if (state.conflictStarted && state.conflictResolved && staged.includes("index.html")) {
    state.conflictStaged = true;
  }

  gain(18);
  addLog(`staged: ${staged.join(", ")}\nステージに並べた。`);
  return true;
}

function handleCommit(command) {
  if (!state.repo) {
    fail("先に git init が必要。");
    return true;
  }
  if (!requirePlace("forge", "コミット鍛冶場でないとcommitできない。")) {
    return true;
  }

  const message = command.match(/^git commit -m\s+["'](.+)["']$/)[1];
  const staged = Object.values(state.files).filter((file) => file.status === "staged");

  if (!staged.length) {
    fail("ステージに何もない。先にgit addが必要。");
    return true;
  }

  if (!state.firstCommit) {
    const needed = ["index.html", "script.js", "styles.css"];
    if (!needed.every((name) => staged.some((file) => file.name === name))) {
      fail("最初のcommitにはHTML、CSS、JSを全部ステージする必要がある。");
      return true;
    }
    staged.forEach((file) => {
      file.status = "committed";
    });
    state.firstCommit = true;
    state.commits.push({ title: message, detail: "HTML/CSS/JSの最初の記録" });
    gain(54);
    addLog(`[main a1c3d9f] ${message}\n履歴の鉄扉が開いた。`);
    return true;
  }

  if (state.branch === "feature/nav" && !state.navCommit && staged.some((file) => file.name === "nav.js")) {
    state.files.nav.status = "committed";
    state.navCommit = true;
    state.commits.push({ title: message, detail: "feature/nav に nav.js を記録" });
    gain(48);
    addLog(`[feature/nav b7e6210] ${message}\nfeature/nav の道標ができた。`);
    return true;
  }

  if (state.conflictResolved && state.conflictStaged && staged.some((file) => file.name === "index.html")) {
    state.files.index.status = "committed";
    state.conflictCommit = true;
    state.commits.push({ title: message, detail: "衝突解決を含む合流コミット" });
    gain(60);
    addLog(`[main d44a0e2] ${message}\n衝突の塔が静かになった。`);
    return true;
  }

  fail("今のステージ内容では、そのcommitは作れない。");
  return true;
}

function handleBranch() {
  if (!requirePlace("branch", "ブランチ門で唱える。")) {
    return true;
  }
  if (!state.firstCommit) {
    fail("最初のcommitがないとブランチ門は開かない。");
    return true;
  }
  if (state.featureCreated) {
    addLog("feature/nav はもう作られている。");
    return true;
  }
  state.featureCreated = true;
  state.branch = "feature/nav";
  state.files.nav.status = "world";
  gain(40);
  addLog("Switched to a new branch 'feature/nav'\n南側に nav.js が現れた。");
  return true;
}

function handleSwitchMain() {
  if (!state.featureCreated) {
    fail("まだ戻るブランチがない。");
    return true;
  }
  if (!state.navCommit) {
    fail("feature/nav のcommitを作ってからmainへ戻る。");
    return true;
  }
  state.branch = "main";
  gain(18);
  addLog("Switched to branch 'main'\n合流橋へ向かえる。");
  return true;
}

function handleMergeFeature() {
  if (!requirePlace("merge", "合流橋でmergeする。")) {
    return true;
  }
  if (state.branch !== "main") {
    fail("merge先は今いるブランチ。先にmainへ戻る。");
    return true;
  }
  if (!state.navCommit) {
    fail("feature/navに取り込む履歴がまだない。");
    return true;
  }
  if (state.mergedFeature) {
    addLog("feature/nav はすでにmainへ合流済み。");
    return true;
  }
  state.mergedFeature = true;
  state.commits.push({ title: "merge feature/nav", detail: "nav.js を main へ合流" });
  gain(46);
  addLog("Updating a1c3d9f..b7e6210\nFast-forward\nnav.js が main に入った。");
  return true;
}

function handleConflictStart() {
  if (!requirePlace("tower", "衝突の塔で唱える。")) {
    return true;
  }
  if (!state.mergedFeature) {
    fail("先に feature/nav を合流する。");
    return true;
  }
  if (state.conflictStarted) {
    addLog("衝突はすでに発生している。選択肢から解決する。");
    return true;
  }
  state.conflictStarted = true;
  state.files.index.status = "worktree";
  gain(20);
  addLog("Auto-merging index.html\nCONFLICT (content): Merge conflict in index.html\n塔の選択肢が開いた。");
  return true;
}

function handleRemoteAdd() {
  if (!requirePlace("remote", "遠征ビーコンで登録する。")) {
    return true;
  }
  if (!state.conflictCommit) {
    fail("衝突解決のcommitが終わっていない。");
    return true;
  }
  if (state.remoteAdded) {
    addLog("origin はもう登録されている。");
    return true;
  }
  state.remoteAdded = true;
  gain(34);
  addLog("origin registered\n外の保管庫への道がつながった。");
  return true;
}

function handlePush() {
  if (!requirePlace("remote", "遠征ビーコンでpushする。")) {
    return true;
  }
  if (!state.remoteAdded) {
    fail("先に git remote add origin が必要。");
    return true;
  }
  if (state.pushed) {
    addLog("もうpush済み。迷宮は踏破されている。");
    return true;
  }
  state.pushed = true;
  gain(80);
  addLog("branch 'main' set up to track 'origin/main'.\n迷宮の外へ履歴を送り出した。CLEAR");
  return true;
}

function chooseConflict(choice) {
  if (!state.conflictStarted || state.conflictResolved) {
    return;
  }
  if (currentPlace().id !== "tower") {
    fail("衝突の塔に立って選ぶ。");
    return;
  }
  if (choice !== "both") {
    fail("片方だけだと意図が落ちる。両方が伝わる形を選ぶ。");
    return;
  }
  state.conflictResolved = true;
  gain(34);
  addLog("resolved: 見出し: Git Sprint 入門\n意味を選び直した。次は git add index.html。");
  render();
}

function requirePlace(id, message) {
  if (currentPlace().id !== id) {
    fail(message);
    return false;
  }
  return true;
}

function fail(message) {
  state.hp = Math.max(0, state.hp - 8);
  addLog(`${message}\nHP -8`);
  if (state.hp === 0) {
    state.hp = 45;
    state.player = { x: 1, y: 1 };
    addLog("力尽きて .gitの祠へ戻された。HP 45で再開。");
  }
  flash(els.mapGrid, "bump");
  render();
}

function lookAround() {
  const place = currentPlace();
  const file = fileAt(state.player.x, state.player.y);
  const enemy = enemyAt(state.player.x, state.player.y);
  if (file) {
    addLog(`${file.name} が落ちている。上に乗ると拾える。`);
  } else if (enemy) {
    addLog("バグがうろついている。踏み込むとHPを少し失う。");
  } else {
    addLog(`${place.name}: ${place.hint}`);
  }
  render();
}

function statusOutput() {
  const lines = [`On branch ${state.branch}`, state.repo ? "Repository active" : "No git repository yet"];
  const groups = {
    worktree: [],
    staged: [],
    committed: []
  };
  Object.values(state.files).forEach((file) => {
    if (groups[file.status]) {
      groups[file.status].push(file.name);
    }
  });
  if (groups.staged.length) {
    lines.push(`Changes to be committed: ${groups.staged.join(", ")}`);
  }
  if (groups.worktree.length) {
    lines.push(`Changes not staged / untracked: ${groups.worktree.join(", ")}`);
  }
  if (!groups.staged.length && !groups.worktree.length && state.repo) {
    lines.push("working tree clean");
  }
  return lines.join("\n");
}

function logOutput() {
  if (!state.commits.length) {
    return "no commits yet";
  }
  return state.commits
    .map((commit, index) => `${String(index + 1).padStart(2, "0")} ${commit.title}`)
    .join("\n");
}

function currentPlace() {
  const symbol = tileAt(state.player.x, state.player.y);
  const landmark = landmarks[symbol];
  if (landmark) {
    if (symbol === "G" && state.firstCommit) {
      return { id: "gate", name: "開いた鉄扉", hint: "通行可能" };
    }
    return landmark;
  }
  return { id: "floor", name: "迷宮の床", hint: "矢印キー / WASDで移動" };
}

function tileAt(x, y) {
  if (y < 0 || y >= terrainRows.length || x < 0 || x >= terrainRows[y].length) {
    return "";
  }
  return terrainRows[y][x];
}

function fileAt(x, y) {
  return Object.values(state.files).find((file) => (
    file.x === x && file.y === y && file.status === "world"
  ));
}

function enemyAt(x, y) {
  return enemies.find((enemy) => (
    enemy.x === x && enemy.y === y && !state.defeatedEnemies.includes(enemy.id)
  ));
}

function fileByName(name) {
  return Object.values(state.files).find((file) => file.name === name);
}

function statusLabel(status) {
  if (status === "world") {
    return "迷宮に落ちている";
  }
  if (status === "worktree") {
    return "作業場にある";
  }
  if (status === "staged") {
    return "ステージ上";
  }
  if (status === "committed") {
    return "履歴に記録済み";
  }
  return "未発見";
}

function level() {
  return Math.max(1, Math.floor(state.xp / 120) + 1);
}

function gain(amount) {
  state.xp += amount;
}

function addLog(message) {
  state.log.push(message);
  state.log = state.log.slice(-60);
}

function normalize(value) {
  return value.trim().replace(/\s+/g, " ");
}

function appendChip(chip) {
  const current = els.commandInput.value.trim();
  els.commandInput.value = current ? `${current} ${chip}` : chip;
  els.commandInput.focus();
}

function resetGame() {
  if (!confirm("Git Dungeonを最初からやり直しますか？")) {
    return;
  }
  state = createDefaultState();
  localStorage.removeItem(storageKey);
  render();
}

function flash(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.querySelectorAll("[data-move]").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.move;
    const moves = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0]
    };
    movePlayer(...moves[direction]);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.target === els.commandInput) {
    if (event.key === "Enter") {
      runCommand();
    }
    return;
  }

  const keys = {
    ArrowUp: [0, -1],
    w: [0, -1],
    W: [0, -1],
    ArrowDown: [0, 1],
    s: [0, 1],
    S: [0, 1],
    ArrowLeft: [-1, 0],
    a: [-1, 0],
    A: [-1, 0],
    ArrowRight: [1, 0],
    d: [1, 0],
    D: [1, 0]
  };

  if (keys[event.key]) {
    event.preventDefault();
    movePlayer(...keys[event.key]);
  }
});

els.commandChips.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-chip]");
  if (chip) {
    appendChip(chip.dataset.chip);
  }
});

els.runCommand.addEventListener("click", runCommand);
els.choicePanel.addEventListener("click", (event) => {
  const choice = event.target.closest("[data-choice]");
  if (choice) {
    chooseConflict(choice.dataset.choice);
  }
});
els.lookButton.addEventListener("click", lookAround);
els.resetGame.addEventListener("click", resetGame);

render();
