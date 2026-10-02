// ============================================================================
// storage/local.js — 保存係
// ----------------------------------------------------------------------------
// 実際にデータを保存・読み出しする唯一の場所。保存先は localStorage。
//
// localStorage とは:ブラウザが各サイト用に用意している小さな物置。
//   ・ブラウザを閉じても消えない
//   ・他のサイトからは読めない
//   ・その端末のそのブラウザにしかない(だからアプリに「控え」機能がある)
//   ・文字列しか置けない(だから袋⇔文字列の変換が要る)
//
// このファイル以外は localStorage に触らない、という規律にしてある。
// ============================================================================

// 物置の棚の名前。この1つの棚に全データが1本の文字列として入る。
// 名前に v1 と入れてあるのは、将来データの形を変えたときに棚を分けられるように。
const KEY = "kakera.state.v1";

// --- emptyState: まっさらな初期データ ----------------------------------------
// 初めて使うとき/保存が壊れていたときは、この形から始まる。
function emptyState() {
  return {
    version: 1,
    started_on: null,   // まだ一度も書いていない
    onboarded: false,   // はじめの言葉もまだ
    entries: {},        // 記録ゼロ
    outings: {},        // 外出ゼロ
  };
}

// --- validRecord: 「対応表の形をした袋か?」の検査 ----------------------------
// null でない・オブジェクトである・配列ではない、の3点を確認する小道具。
function validRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

// --- normalize: 読み込んだデータを疑って、正しい形に整える --------------------
// 手でいじられた・別バージョンだった等、どんな壊れ方をしていても
// 「必ず正しい形の袋」にして返す。直せない部分は初期値で埋める。
function normalize(value) {
  if (!validRecord(value) || value.version !== 1) return emptyState();
  return {
    version: 1,
    started_on: typeof value.started_on === "string" ? value.started_on : null,
    onboarded: value.onboarded === true,
    entries: validRecord(value.entries) ? value.entries : {},
    outings: validRecord(value.outings) ? value.outings : {},
  };
}

// --- load: 起動時の読み出し --------------------------------------------------
// try { 試す } catch { 失敗したらこちら } という構文で守ってある。
// 保存が壊れていても、読み込み自体が禁止されていても、
// アプリは絶対に起動に失敗しない(まっさらで開く)。
export function load() {
  try {
    const stored = localStorage.getItem(KEY);            // 棚から文字列を取り出す
    return stored ? normalize(JSON.parse(stored)) : emptyState();
    // JSON.parse = 文字列 → 袋 に戻す変換
  } catch {
    return emptyState();
  }
}

// --- save: 書き込み(state.js の commit から毎回呼ばれる) ---------------------
// JSON.stringify = 袋 → 1本の文字列 に変換(物置は文字列しか置けないため)。
// 書き込む直前にも normalize を通して、壊れた形が棚に入らないようにする。
export function save(value) {
  localStorage.setItem(KEY, JSON.stringify(normalize(value)));
}
