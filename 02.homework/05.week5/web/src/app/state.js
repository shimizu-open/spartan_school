// ============================================================================
// state.js — データの管理人
// ----------------------------------------------------------------------------
// アプリの全データ(日々の記録、月の外出、初日、はじめの言葉の読了)を
// 「value」というひとつの袋で一手に持つ。
//
// 大原則:データを書き換えたい者は、必ずこのファイルの窓口(saveEntry 等)を通す。
// どの窓口も最後は commit() に行き着き、そこで
//   ① 袋を新品に交換 → ② 保存係に書き込ませる → ③ 予約者に「変わったよ」と放送
// の三点セットが必ず実行される。画面が勝手にデータを触る道は存在しない。
// ============================================================================

import { dateKey, monthKey } from "./lib/date.js";
import { load, save } from "./storage/index.js";

// アプリの全データが入る袋。形の例:
// {
//   version: 1,                  … データ形式の版番号
//   started_on: "2026-08-01",    … 初めて書いた日(60日開放の起点)
//   onboarded: true,             … はじめの言葉を読み終えたか
//   entries: { "2026-08-01": { feeling, done, person, created_at } },
//   outings: { "2026-08":    { goal, planned_on, went_on, created_at } },
// }
// entries は「日付そのもの」が見出しの対応表なので、1日1件が形で強制される。
// outings も「月そのもの」が見出しなので、月にひとつしか持てない。
let value;

// 「データが変わったら教えて」と予約した関数の名簿(main.js の render が載る)
const subscribers = new Set();

// --- commit: このアプリの心臓 ------------------------------------------------
// 全部の書き換えが最後に必ずここを通る。
function commit(next) {
  value = next;                                    // ① 袋を新品に交換
  save(value);                                     // ② 保存係(storage/)に書き込ませる
  subscribers.forEach((subscriber) => subscriber(value)); // ③ 名簿の全員に放送 → 画面が描き直る
}

// --- initialize: 起動時に一度だけ。保存してあった袋を読み込む -----------------
export function initialize() {
  value = load();   // 保存が無い/壊れている場合は、まっさらな袋が返る(storage/local.js 参照)
  return value;
}

// --- getState: いまの袋を見せる(読み取り専用のつもりで使う) -------------------
export function getState() {
  return value;
}

// --- subscribe: 「変わったら教えて」の予約受付 --------------------------------
// 戻り値は「予約の取り消し関数」(今は使っていないが作法として返す)。
export function subscribe(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

// --- finishOnboarding: はじめの言葉を読み終えた印を付ける ---------------------
// { ...value, onboarded: true } =「袋の中身を全部コピーし、onboarded だけ変えた新品」
export function finishOnboarding() {
  commit({ ...value, onboarded: true });
}

// --- saveEntry: 今日の記録を保存する窓口(today.js から呼ばれる) ---------------
export function saveEntry(fields, today = dateKey()) {
  const feeling = fields.feeling.trim();   // trim() = 前後の空白を削る
  if (!feeling) return false;              // 空(スペースだけ含む)は拒否
  const previous = value.entries[today];   // 今日すでに書いた記録(書き直しの場合)
  const entry = {
    feeling,
    done: fields.done.trim(),
    person: fields.person.trim(),
    // 書き直しでも「最初に書いた時刻」を引き継ぐ(?? は「左が無ければ右」)
    created_at: previous?.created_at ?? new Date().toISOString(),
  };
  commit({
    ...value,                                      // いまの袋を全部コピーして
    started_on: value.started_on ?? today,         // 初日が未記録なら今日を初日に刻む
    entries: { ...value.entries, [today]: entry }, // 対応表の今日の欄だけ差し替える
  });
  return true;
}

// --- saveOuting: 今月の外出を保存する窓口(outing.js から呼ばれる) -------------
export function saveOuting(fields, month = monthKey()) {
  const goal = fields.goal.trim();
  if (!goal) return false;                 // 目的が空なら拒否
  const previous = value.outings[month];
  const outing = {
    goal,
    planned_on: fields.planned_on || null, // 予定日は決めなくてもよい(空なら null)
    went_on: previous?.went_on ?? null,    // 行った日は書き換えでも保持する
    created_at: previous?.created_at ?? new Date().toISOString(),
  };
  commit({ ...value, outings: { ...value.outings, [month]: outing } });
  return true;
}

// --- markOutingWent: 「行った」ボタンの窓口(today.js から呼ばれる) ------------
export function markOutingWent(month = monthKey(), today = dateKey()) {
  const outing = value.outings[month];
  // 目的が決まっていない/すでに行った月なら、何もしない
  if (!outing?.goal || outing.went_on) return false;
  commit({
    ...value,
    outings: { ...value.outings, [month]: { ...outing, went_on: today } }, // 行った日を刻む
  });
  return true;
}

// --- restoreBackup: 控え(バックアップ)からの復元(about.js から呼ばれる) -------
// 検査(validBackup)を通ったデータだけがここに来る。
// { ...data.entries, ...value.entries } は「後に書いた方が勝つ」記法なので、
// 同じ日の記録は端末側(value)が優先される = 復元で今日の記録が消える事故を防ぐ。
export function restoreBackup(data) {
  const restored = {
    ...value,
    started_on: value.started_on ?? data.started_on ?? null,
    onboarded: value.onboarded || data.onboarded === true,
    entries: { ...data.entries, ...value.entries },
    outings: { ...data.outings, ...value.outings },
  };
  commit(restored);
}

// --- clearAll: 全消去(「使うのをやめる」の最終段で呼ばれる) -------------------
// 消すのも特別扱いせず、まっさらな袋への commit として同じ一本道を通す。
export function clearAll() {
  commit({
    version: 1,
    started_on: null,
    onboarded: false,
    entries: {},
    outings: {},
  });
}
