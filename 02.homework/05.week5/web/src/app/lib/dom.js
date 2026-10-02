// ============================================================================
// lib/dom.js — 画面いじりの道具箱
// ----------------------------------------------------------------------------
// 画面(DOM)を操作する細かい命令を、短い名前の関数にまとめただけのファイル。
// 中身はほぼブラウザ標準機能の言い換えである。
//
// それでも作る理由:画面を直接いじる箇所をこの1ファイルに数えられるようにする
// ため。ブラウザ標準の書き方が将来変わっても、直すのはここだけで済む。
// ============================================================================

// --- setMarkup: 箱の中身を丸ごと入れ替える -----------------------------------
// innerHTML = 部品の中身を HTML として解釈して差し替える命令。
// ※ ユーザーの書いた文字は絶対にここへ混ぜない(混ぜると <script> 等が
//    プログラムとして動いてしまう=XSS攻撃)。文字は下の setText で入れる。
export function setMarkup(node, markup) {
  node.innerHTML = markup;
}

// --- find: 箱の中から部品を1つ探す -------------------------------------------
// 例: find(root, "[data-feeling]") =「root の中の data-feeling 印の部品」
export function find(node, selector) {
  return node.querySelector(selector);
}

// --- findAll: 条件に合う部品を全部探す(配列で返す) ----------------------------
export function findAll(node, selector) {
  return [...node.querySelectorAll(selector)];
}

// --- listen: 予約(リスナー)を仕掛ける ----------------------------------------
// 「この部品(node)でこの出来事(event)が起きたら、この関数(handler)を実行して」
// とブラウザに頼む。アプリの「動き」は全部この予約でできている。
export function listen(node, event, handler) {
  node.addEventListener(event, handler);
}

// --- setText: 文字を「文字として」入れる(安全な入れ口) ------------------------
// textContent = 何を渡されても文字としてしか解釈しない命令。
// ユーザーの書いた文字は必ずこちらで入れる(setMarkup の注意書き参照)。
// ?? "" =「null や undefined が来たら空文字にする」保険。
export function setText(node, value) {
  node.textContent = value ?? "";
}

// --- downloadFile: ブラウザ内でファイルを作ってダウンロードさせる -------------
// 控え(JSON)やテキスト書き出しに使う。サーバー通信ゼロで完結する。
// 手順:文字列からファイルの実体(Blob)を作る → それを指す一時的な URL を発行
//   → 見えないダウンロードリンクを作って自動クリック → 一時 URL を片付ける。
export function downloadFile(name, type, content) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;   // ダウンロード時のファイル名
  anchor.click();
  URL.revokeObjectURL(url); // 発行した一時 URL の後片付け
}
