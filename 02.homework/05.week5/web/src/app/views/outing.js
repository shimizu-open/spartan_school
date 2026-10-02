// ============================================================================
// views/outing.js — 「ひとつ」(今月の外出)の画面係
// ----------------------------------------------------------------------------
// 月にひとつ、行ってみる場所を決める画面。
//   ・決めてある月 → 青磁色のカードで表示(+書き換えボタン)
//   ・未定の月/書き換え中 → 入力フォーム
// 「行った」を押すのはこの画面ではなく「今日」の画面(today.js)側にある。
//
// 規律は today.js と同じ:保存は管理人(state.js の saveOuting)に頼む。
// ============================================================================

import { displayDate, monthKey } from "../lib/date.js";
import { find, listen, setMarkup, setText } from "../lib/dom.js";
import { saveOuting } from "../state.js";

// この画面だけの一時的な覚え書き:「書き換える」を押して編集中か
let editing = false;

// 画面をまたいだときに司令塔(main.js)から呼ばれ、編集中を解除する
export function resetOutingTransient() {
  editing = false;
}

// --- backAndHeading: 「← 今日」リンクと見出しの HTML(2つの状態で共通) --------
function backAndHeading() {
  return `
    <button type="button" data-back class="min-h-touch min-w-touch text-ui text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-seiji focus-visible:outline-offset-2 md:text-ui-md">← 今日</button>
    <h1 id="outing-title" tabindex="-1" class="mt-7 font-mincho text-record leading-loose text-sumi outline-none md:text-record-md">今月のひとつ</h1>
  `;
}

// --- formMarkup: 入力フォームの HTML -----------------------------------------
// isNew(初めて決める)なら目的の欄だけ。書き換えなら予定日の欄も出す。
// 予定日は「決めなくてもかまいません」— 空のままでよい設計。
function formMarkup(outing) {
  const isNew = !outing;
  return `
    <form class="mt-7" novalidate>
      <label for="outing-goal" class="text-ui leading-relaxed text-nibi md:text-ui-md">目的</label>
      <input id="outing-goal" name="goal" maxlength="60" autocomplete="off" class="mt-2 min-h-touch w-full border-x-0 border-b-2 border-t-0 border-nibi bg-transparent px-1 py-2 font-mincho text-record leading-relaxed text-sumi outline-none placeholder:font-gothic placeholder:text-ui placeholder:text-nibi placeholder:opacity-60 focus:border-seiji focus-visible:outline-2 focus-visible:outline-seiji focus-visible:outline-offset-2 md:text-record-md" placeholder="◯◯を食べる、銭湯に入る、など">
      ${isNew ? "" : `
        <label for="planned-on" class="mt-7 block text-ui leading-relaxed text-nibi md:text-ui-md">予定日</label>
        <div data-planned-field class="relative mt-2 min-h-touch border-b border-kei px-1 py-3 focus-within:border-seiji focus-within:outline-2 focus-within:outline-seiji focus-within:outline-offset-2">
          <span data-planned-display></span>
          <input id="planned-on" name="planned_on" type="date" class="absolute inset-0 size-full cursor-pointer text-base opacity-0">
        </div>
      `}
      <p data-error class="mt-3 min-h-5 text-ui leading-relaxed text-nibi"></p>
      <button type="submit" class="shard-sm min-h-touch min-w-touch border border-kei px-5 text-ui text-seiji transition-colors hover:bg-seiji-usu focus-visible:outline-2 focus-visible:outline-seiji focus-visible:outline-offset-2 motion-reduce:transition-none">${isNew ? "決める" : "書き換える"}</button>
    </form>
  `;
}

// --- renderOuting: この画面の本体 --------------------------------------------
// 司令塔から (箱, データの袋, 通知係, 戻り先) を受け取る。
export function renderOuting(root, state, notify, back) {
  const month = monthKey();               // 今月のキー("2026-08")
  const outing = state.outings[month];    // 今月の外出(未定なら undefined)

  // ========== A. 決めてある月の表示(カード) ==========
  if (outing && !editing) {
    setMarkup(root, `
      ${backAndHeading()}
      <article class="shard-sm mt-7 bg-seiji-usu px-5 py-3">
        <p data-goal class="break-words font-mincho text-record leading-record text-sumi md:text-record-md"></p>
        ${outing.planned_on ? '<p data-planned class="mt-3 font-mincho text-ui leading-relaxed text-nibi md:text-ui-md"></p>' : ""}
      </article>
      <button type="button" data-edit-outing class="shard-sm mt-3 min-h-touch min-w-touch border border-kei px-5 text-ui text-seiji transition-colors hover:bg-seiji-usu focus-visible:outline-2 focus-visible:outline-seiji focus-visible:outline-offset-2 motion-reduce:transition-none">書き換える</button>
      <p class="mt-7 text-ui leading-loose text-nibi md:text-ui-md">今月、行ってみる場所をひとつ。<br>行く途中で気になる場所を見つけたら、そちらに変えてもかまいません。</p>
      <div class="pb-safe"></div>
    `);
    // ユーザーの文字は安全な入れ口(setText)で埋める
    setText(find(root, "[data-goal]"), outing.goal);
    if (outing.planned_on) setText(find(root, "[data-planned]"), displayDate(outing.planned_on));
    listen(find(root, "[data-back]"), "click", back);
    // 「書き換える」→ 編集モードにして自分を呼び直す(フォームが描かれる)
    listen(find(root, "[data-edit-outing]"), "click", () => {
      editing = true;
      renderOuting(root, state, notify, back);
      find(root, "#outing-goal").focus();
    });
    return;
  }

  // ========== B. 入力フォーム(未定の月/書き換え中) ==========
  setMarkup(root, `
    ${backAndHeading()}
    ${formMarkup(outing)}
    <p class="mt-7 text-ui leading-loose text-nibi md:text-ui-md">今月、行ってみる場所をひとつ。<br>行く途中で気になる場所を見つけたら、そちらに変えてもかまいません。</p>
    <div class="pb-safe"></div>
  `);
  listen(find(root, "[data-back]"), "click", back);
  const form = find(root, "form");
  form.elements.goal.value = outing?.goal ?? "";   // 書き換えなら既存の目的を入れておく

  // 書き換え時のみ:予定日欄の見た目の管理
  // (日付が入っていれば「8月9日」、空なら「決めなくてもかまいません」と薄く出す)
  if (outing) {
    form.elements.planned_on.value = outing.planned_on ?? "";
    const plannedDisplay = find(root, "[data-planned-display]");
    const plannedField = find(root, "[data-planned-field]");
    function updatePlannedDisplay() {
      const hasDate = Boolean(form.elements.planned_on.value);
      setText(plannedDisplay, hasDate ? displayDate(form.elements.planned_on.value) : "決めなくてもかまいません");
      plannedField.className = hasDate
        ? "relative mt-2 min-h-touch border-b border-kei px-1 py-3 text-base text-sumi focus-within:border-seiji focus-within:outline-2 focus-within:outline-seiji focus-within:outline-offset-2"
        : "relative mt-2 min-h-touch border-b border-kei px-1 py-3 text-base text-nibi opacity-50 focus-within:border-seiji focus-within:outline-2 focus-within:outline-seiji focus-within:outline-offset-2";
    }
    updatePlannedDisplay();
    listen(form.elements.planned_on, "change", updatePlannedDisplay);
  }

  // 「決める/書き換える」ボタン(流れは today.js の記録すると同じ一本道)
  listen(form, "submit", (event) => {
    event.preventDefault();   // ブラウザの標準動作(送信+再読み込み)を止める
    const fields = Object.fromEntries(new FormData(form));  // 入力を袋に詰める
    if (!fields.goal.trim()) {
      setText(find(root, "[data-error]"), "目的を一行だけ書いてください");
      form.elements.goal.focus();
      return;
    }
    editing = false;
    saveOuting({
      goal: fields.goal,
      // 初回フォームには予定日欄が無い(fields に無い)ので、既存値か空を使う
      planned_on: fields.planned_on ?? outing?.planned_on ?? "",
    }, month);   // 管理人に依頼 → commit → 放送 → この画面が A で描き直る
    notify("今月のひとつを置きました");
  });
}
