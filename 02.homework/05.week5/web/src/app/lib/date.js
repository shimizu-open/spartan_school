// ============================================================================
// lib/date.js — 日付計算の専門家
// ----------------------------------------------------------------------------
// 「今日は何日か」「60日経ったか」「直近7日は?」など、日付に関わる計算を
// すべてこのファイルに集めてある。他のファイルは日付を計算しない。
//
// なぜ集めるか:日付計算はプログラミングで最も事故が多い領域だから
// (月末、うるう年、時差、夏時間…)。事故りやすいものは1か所に隔離する。
//
// このアプリの日付の書き方:
//   日付キー "2026-08-01"(年-月-日) … entries の見出しに使う
//   月キー   "2026-08"              … outings の見出しに使う
// ============================================================================

// 1日をミリ秒で表した定数(24時間×60分×60秒×1000ミリ秒)。daysBetween で使う。
const DAY = 86_400_000;

// --- dateKey: 今日(または指定日)を "2026-08-01" の形にする --------------------
// new Date() = 端末の時計の「いま」。深夜0時に日付が替わるのは生活感覚と同じ。
// padStart(2, "0") = 1桁なら頭に0を足して2桁にする(8 → "08")。
export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // getMonth は0始まりなので+1
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- monthKey: "2026-08-01" の先頭7文字 → "2026-08"(月キー) ------------------
export function monthKey(date = new Date()) {
  return dateKey(date).slice(0, 7);
}

// --- fromDateKey: 文字列 "2026-08-01" を日付オブジェクトに戻す ----------------
// 最後の 12 は「昼の12時として解釈する」の意味。0時ちょうどにすると、
// 夏時間のある地域で日付が1日ずれる事故が知られているため、一番安全な昼に寄せる。
export function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number); // "2026-08-01" → [2026, 8, 1]
  return new Date(year, month - 1, day, 12);
}

// --- shiftDate: 日付キーを amount 日ぶんずらす("2026-08-01", -1 → "2026-07-31")
// 月またぎ・年またぎの繰り上げ繰り下げはブラウザの Date に任せる(自作しない)。
export function shiftDate(key, amount) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

// --- recentDateKeys: 直近7日の日付キーの一覧(新しい順) ------------------------
// 60日開放前の「かけら」一覧はこの7日ぶんだけを表示する。
export function recentDateKeys(last = dateKey()) {
  return Array.from({ length: 7 }, (_, index) => shiftDate(last, -index));
}

// --- allDateKeys: first から last までの全日付キー(新しい順) ------------------
// 60日開放後の「かけら」一覧に使う。書かなかった日も含めて全日付を返す
// (一覧側はデータの無い日を「—」と表示する)。
export function allDateKeys(first, last = dateKey()) {
  if (!first || first > last) return [];
  const keys = [];
  for (let key = last; key >= first; key = shiftDate(key, -1)) keys.push(key);
  return keys;
}

// --- daysBetween: 2つの日付キーの間の日数 ------------------------------------
// 日付オブジェクト同士の引き算はミリ秒差になるので、1日(DAY)で割って日数にする。
export function daysBetween(first, last = dateKey()) {
  return Math.floor((fromDateKey(last) - fromDateKey(first)) / DAY);
}

// --- isUnlocked: 60日開放の判定(このアプリで一番大事な判定) -------------------
// 初めて書いた日(startedOn)から60日経ったか。fragments.js と today.js が使う。
export function isUnlocked(startedOn, today = dateKey()) {
  return Boolean(startedOn) && daysBetween(startedOn, today) >= 60;
}

// --- 表示用の整形3きょうだい --------------------------------------------------
// displayDate:     "2026-08-01" → 「8月1日」(今年のもの用)
// displayLongDate: "2026-08-01" → 「2026年8月1日」(年をまたいだもの用)
// displayListDate: 一覧用。今年なら短く、去年以前なら年付きで(自動で使い分け)
export function displayDate(key) {
  const date = fromDateKey(key);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function displayLongDate(key) {
  const date = fromDateKey(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function displayListDate(key, reference = dateKey()) {
  const date = fromDateKey(key);
  const referenceDate = fromDateKey(reference);
  return date.getFullYear() === referenceDate.getFullYear()
    ? displayDate(key)
    : displayLongDate(key);
}

// --- monthDayKey: "2026-08-01" → "08-01"(年を落とした月日) -------------------
export function monthDayKey(key = dateKey()) {
  return key.slice(5);
}

// --- monthDayIndex: 「8月1日は1年の何日目か」(0始まり) ------------------------
// 今日の一言(366件)の何番目を出すかを決めるのに使う。
// offsets = 各月の1日が「うるう年で数えて」何日目から始まるかの早見表。
// うるう年基準(2月29日を含む366日)で数えるので、どの年でも同じ日には同じ一言が出る。
export function monthDayIndex(key = dateKey()) {
  const [month, day] = monthDayKey(key).split("-").map(Number);
  const offsets = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  return offsets[month - 1] + day - 1;
}
