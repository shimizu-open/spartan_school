// ============================================================================
// views/today.js — 「今日」の画面係
// ----------------------------------------------------------------------------
// アプリの顔となる画面。状態によって出すものが変わる:
//   ・まだ書いていない       → 入力フォーム(書く前)
//   ・書いた直後             → 記録カード + 今日の一言 + 演出
//   ・書いた日に開き直した   → 記録カードだけ(一言は出ない)
//   ・「書き直す」を押した   → 入力フォーム(中身入り)
//
// 規律:この画面係は保存に触らない。保存したければ管理人(state.js)に頼む。
// 描き込み先の箱・データの袋・通知係・連絡先は、司令塔(main.js)から渡される。
// ============================================================================

import { markOutingWent, saveEntry } from "../state.js";
import { dateKey, daysBetween, displayDate, monthDayIndex, monthKey } from "../lib/date.js";
import { find, listen, setMarkup, setText } from "../lib/dom.js";

// --- この画面だけの一時的な覚え書き(モジュール変数) ---------------------------
// データの袋(state)に入れるほどではない、「いまこの瞬間の画面の事情」を持つ。
// 画面をまたいだら resetTodayTransient() で白紙に戻される。
let justSaved = false;          // たった今保存したか(一言と演出を出すかの判定)
let savedAnimated = false;      // 保存演出をもう流したか(2回流さないため)
let editing = false;            // 「書き直す」中か
let autofocusDate = null;       // 自動フォーカスを済ませた日付(1日1回制限用)
let unlockNoticeVisible = false;// 60日目の「読み返せます」を出すか
let linesPromise;               // 今日の一言データの取り寄せ結果の控え(1回だけ取り寄せる)

// --- renderDailyLine: 今日の一言を出す ---------------------------------------
// 一言データ(lines.js)は起動時ではなく、初めて必要になった瞬間に取り寄せる。
// ??= は「まだ空なら入れる」= 取り寄せは最初の1回だけ。
function renderDailyLine(node, today, animate) {
  linesPromise ??= import("../data/lines.js");
  linesPromise.then(({ default: lines }) => {           // 届いたら実行される
    if (!node?.isConnected) return;                     // その間に画面が替わっていたら何もしない
    const line = lines[monthDayIndex(today)];           // 366件から今日の1件を選ぶ
    if (line) setText(node, line);
    if (animate) node.classList.add("animate-reveal", "motion-reduce:animate-none");
  });
}

// --- bottomLinks: 画面下の2つのリンクの HTML ---------------------------------
// 「これまでを見る」「今月のひとつ」。押したときの動きは renderToday 側で仕掛ける。
function bottomLinks() {
  return `
    <div class="mt-20 flex justify-between gap-3 pb-safe">
      <button type="button" data-fragments class="min-h-touch min-w-touch text-note text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2">これまでを見る</button>
      <button type="button" data-outing class="min-h-touch min-w-touch text-note text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2">今月のひとつ</button>
    </div>
  `;
}

// --- monthlyMarkup: 記録カード下の外出行(◇ 目的 [行った])の HTML --------------
// 外出が決めてあり、まだ行っていない月だけ出す。行った後は何も出さない。
function monthlyMarkup(outing) {
  if (!outing) return "";
  if (!outing.went_on) {
    return `
      <div class="flex min-h-touch items-center gap-3 text-ui leading-relaxed text-seiji md:text-ui-md">
        <p class="min-w-0 flex-1 break-words">◇ <span data-outing-goal></span></p>
        <button type="button" data-went class="shard-sm min-h-touch min-w-touch shrink-0 border border-kei px-5 text-seiji transition-colors hover:bg-seiji-usu focus-visible:outline-2 focus-visible:outline-seiji focus-visible:outline-offset-2 motion-reduce:transition-none">行った</button>
      </div>
    `;
  }
  return "";
}

// --- savedMarkup: 「書いたあと」の画面の HTML ---------------------------------
// 記録カード + 書き直すリンク + (直後だけ)一言 + (60日目だけ)読み返せます + 下のリンク。
// ユーザーの文字はここに直接書かず、<span data-feeling></span> のような
// 空の置き場だけ用意して、あとで setText(安全な入れ口)で埋める。
function savedMarkup(contextMarkup, showLine, showUnlock) {
  return `
    <h1 id="today-title" tabindex="-1" data-date class="font-mincho text-ui tracking-date text-nibi outline-none md:text-ui-md"></h1>
    <div class="mt-3">
      <button type="button" data-edit-card class="shard block w-full bg-ai-usu px-7 py-7 text-left outline-none transition-colors hover:bg-men focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none" aria-label="今日の記録を書き直す">
        <span data-feeling class="block break-words font-mincho text-record leading-record text-sumi md:text-record-md"></span>
        <span data-done-row class="mt-3 hidden break-words text-ui leading-relaxed text-nibi md:text-ui-md">済　<span data-done class="text-sumi"></span></span>
        <span data-person-row class="mt-3 hidden break-words text-ui leading-relaxed text-nibi md:text-ui-md">人　<span data-person class="text-sumi"></span></span>
      </button>
      <button type="button" data-edit class="mt-2 flex min-h-touch min-w-touch items-start text-note text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2">書き直す</button>
    </div>
    ${showLine ? '<p data-line class="mt-10 text-center font-mincho text-line leading-loose text-nibi md:text-line-md short:mt-5"></p>' : ""}
    ${(contextMarkup || showUnlock) ? `<div class="mt-14 grid gap-3 short:mt-7">${contextMarkup}${showUnlock ? '<button type="button" data-unlock class="min-h-touch w-full text-left text-ui text-kin underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-kin focus-visible:outline-offset-2 md:text-ui-md">読み返せます</button>' : ""}</div>` : ""}
    ${bottomLinks()}
  `;
}

// --- formMarkup: 「書く前」の入力フォームの HTML ------------------------------
// 一行の入力欄 + なしボタン + 開閉式の済・人欄 + 記録するボタン。
// optionalOpen = 済・人欄を開いた状態で出すか(書き直し時に中身があれば開く)。
function formMarkup(autofocus, optionalOpen) {
  const optionalFields = optionalOpen
    ? '<div id="optional-fields" data-optional-fields class="mt-7 grid gap-7 short:mt-3 short:gap-3">'
    : '<div id="optional-fields" data-optional-fields class="hidden">';
  return `
    <h1 id="today-title" tabindex="-1" data-date class="font-mincho text-ui tracking-date text-nibi outline-none md:text-ui-md"></h1>
    <form class="mt-5 short:mt-3" novalidate>
      <div>
        <label for="feeling" class="text-ui leading-relaxed text-nibi md:text-ui-md">心が動いたこと</label>
        <input id="feeling" name="feeling" maxlength="140" autocomplete="off" ${autofocus ? "autofocus" : ""} class="mt-2 min-h-touch w-full border-x-0 border-b-2 border-t-0 border-nibi bg-transparent px-1 py-2 font-mincho text-record leading-record text-sumi outline-none placeholder:font-gothic placeholder:text-ui placeholder:text-nibi placeholder:opacity-60 focus:border-ai focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 md:text-record-md" placeholder="腹が立った、いいなと思った、など">
        <div class="mt-2 flex items-center justify-between gap-3">
          <button type="button" data-none class="shard-sm min-h-touch min-w-touch border border-kei px-5 text-ui text-ai transition-colors hover:bg-men focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">なし</button>
          <button type="button" data-optional-toggle class="min-h-touch min-w-touch px-1 text-ui text-nibi transition-colors hover:text-ai focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none" aria-expanded="${optionalOpen}" aria-controls="optional-fields">${optionalOpen ? "− 済・人" : "＋ 済・人"}</button>
        </div>
      </div>
      ${optionalFields}
        <div>
          <label for="done" class="text-ui leading-relaxed text-nibi md:text-ui-md">済 <span class="text-note">片づけた面倒</span></label>
          <input id="done" name="done" maxlength="80" autocomplete="off" class="mt-2 min-h-touch w-full border-x-0 border-b border-t-0 border-kei bg-transparent px-1 py-2 text-base leading-relaxed text-sumi outline-none placeholder:font-gothic placeholder:text-ui placeholder:text-nibi placeholder:opacity-60 focus:border-ai focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2" placeholder="歯医者の予約">
        </div>
        <div>
          <label for="person" class="text-ui leading-relaxed text-nibi md:text-ui-md">人 <span class="text-note">関わった人についての事実</span></label>
          <input id="person" name="person" maxlength="80" autocomplete="off" class="mt-2 min-h-touch w-full border-x-0 border-b border-t-0 border-kei bg-transparent px-1 py-2 text-base leading-relaxed text-sumi outline-none placeholder:font-gothic placeholder:text-ui placeholder:text-nibi placeholder:opacity-60 focus:border-ai focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2" placeholder="ある人が、こんなことを言っていた">
        </div>
      </div>
      <p data-error class="min-h-5 text-ui leading-relaxed text-nibi"></p>
      <button type="submit" class="shard mt-2 min-h-button w-full bg-ai px-5 text-base text-men transition-colors hover:bg-sumi focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">記録する</button>
    </form>
    ${bottomLinks()}
  `;
}

// --- 60日目の知らせを「同じ日に二度出さない」ための控え ------------------------
// sessionStorage = ブラウザを閉じると消える一時置き場(localStorage の日帰り版)。
// try/catch で守るのは、置き場が使えない環境でも記録機能を止めないため。
function unlockAlreadyShown(today) {
  try {
    return sessionStorage.getItem("kakera.unlock-shown-on") === today;
  } catch {
    return false;
  }
}

function rememberUnlockShown(today) {
  try {
    sessionStorage.setItem("kakera.unlock-shown-on", today);
  } catch {
    // 知らせは一時的なものなので、控えに失敗しても記録の保存は妨げない
  }
}

// --- resetTodayTransient: 一時的な覚え書きを白紙に戻す ------------------------
// 画面をまたいだとき・日付が変わったときに司令塔(main.js)から呼ばれる。
export function resetTodayTransient() {
  justSaved = false;
  savedAnimated = false;
  editing = false;
  unlockNoticeVisible = false;
}

// --- renderToday: この画面の本体 ---------------------------------------------
// 司令塔から (箱, データの袋, 通知係, 指示の袋) の4点を受け取り、
// 状態を見て「書いたあとの画面」か「書く前のフォーム」かを組み立てる。
export function renderToday(root, state, notify, options) {
  const today = dateKey();                      // 今日の日付キー("2026-08-01")
  const entry = state.entries[today];           // 今日の記録(まだ無ければ undefined)
  const outing = state.outings[monthKey()];     // 今月の外出(無ければ undefined)

  // ========== A. 書いたあとの画面(記録があり、書き直し中でない) ==========
  if (entry && !editing) {
    const contextMarkup = monthlyMarkup(outing);
    // ① 骨組みを流し込む(一言と読み返せますは、条件が立っているときだけ骨組みに含まれる)
    setMarkup(root, savedMarkup(contextMarkup, justSaved, unlockNoticeVisible));
    // ② ユーザーの文字を安全な入れ口(setText)で埋める
    setText(find(root, "[data-date]"), displayDate(today));
    setText(find(root, "[data-feeling]"), entry.feeling);
    setText(find(root, "[data-done]"), entry.done);
    setText(find(root, "[data-person]"), entry.person);
    // 済・人は書いてある日だけ行を見せる(hidden クラスを外す)
    if (entry.done) find(root, "[data-done-row]").classList.remove("hidden");
    if (entry.person) find(root, "[data-person-row]").classList.remove("hidden");
    if (outing && find(root, "[data-outing-goal]")) setText(find(root, "[data-outing-goal]"), outing.goal);
    // ③ 保存直後だけ:今日の一言を取り寄せて表示
    if (justSaved) renderDailyLine(find(root, "[data-line]"), today, !savedAnimated);
    // ④ 保存直後の一度だけ:カードがそっと降りる演出(settle)を付ける
    if (!savedAnimated && justSaved) {
      find(root, "[data-edit-card]").classList.add("animate-settle", "motion-reduce:animate-none");
      savedAnimated = true;   // 二度は流さない
    }
    // ⑤ 予約を仕掛ける:カード/書き直すを押したら編集モードでフォームに戻る
    const editEntry = () => {
      editing = true;
      justSaved = false;
      unlockNoticeVisible = false;
      renderToday(root, state, notify, options);  // 自分を呼び直してフォームを描く
      find(root, "#feeling").focus();
    };
    listen(find(root, "[data-edit-card]"), "click", editEntry);
    listen(find(root, "[data-edit]"), "click", editEntry);
    // 「行った」ボタン(外出が未実行の月だけ存在する)
    const wentButton = find(root, "[data-went]");
    if (wentButton) listen(wentButton, "click", () => {
      markOutingWent(monthKey(), today);   // 管理人に「今日行った」と伝える → 一本道が走る
      notify("行った日を置きました");
    });
    // 60日目の「読み返せます」(あれば)→ 押すと一覧へ
    const unlock = find(root, "[data-unlock]");
    if (unlock) listen(unlock, "click", options.openFragments);
    // 画面下のリンク(司令塔からもらった連絡先を呼ぶだけ)
    listen(find(root, "[data-fragments]"), "click", options.openFragments);
    listen(find(root, "[data-outing]"), "click", options.openOuting);
    return;   // 書いたあとの画面はここで終わり
  }

  // ========== B. 書く前のフォーム(まだ書いていない or 書き直し中) ==========
  // 自動フォーカスは「許可あり && 未記入 && 今日まだやってない」ときだけ(1日1回)。
  // スマホでフォーカスのたびキーボードがせり上がるのを避けるため。
  const shouldAutofocus = options.allowAutofocus && !entry && autofocusDate !== today;
  // 書き直しで済・人に中身があれば、その欄を開いた状態で出す
  const optionalOpen = Boolean(entry?.done || entry?.person);
  setMarkup(root, formMarkup(shouldAutofocus, optionalOpen));
  setText(find(root, "[data-date]"), displayDate(today));
  const form = find(root, "form");
  if (shouldAutofocus) {
    autofocusDate = today;   // 「今日はもうやった」と控える
    requestAnimationFrame(() => {
      if (form.elements.feeling.isConnected) form.elements.feeling.focus();
    });
  }
  // 書き直しの場合は、既存の中身を入力欄に入れておく(?? "" = 無ければ空)
  form.elements.feeling.value = entry?.feeling ?? "";
  form.elements.done.value = entry?.done ?? "";
  form.elements.person.value = entry?.person ?? "";

  // ＋済・人 の開閉(押すたびに欄を出したり隠したりし、ラベルと aria も切り替える)
  listen(find(root, "[data-optional-toggle]"), "click", (event) => {
    const fields = find(root, "[data-optional-fields]");
    const opening = fields.classList.contains("hidden");
    fields.className = opening ? "mt-7 grid gap-7 short:mt-3 short:gap-3" : "hidden";
    event.currentTarget.setAttribute("aria-expanded", String(opening));
    setText(event.currentTarget, opening ? "− 済・人" : "＋ 済・人");
    if (opening) form.elements.done.focus();
  });
  // 「なし」ボタン:入力欄に「なし」と入れて、記録ボタンと同じ処理を呼ぶだけの3行。
  // 「なし」は空白ではなく「なしと確かめた」という立派な記録として保存される。
  listen(find(root, "[data-none]"), "click", () => {
    form.elements.feeling.value = "なし";
    form.requestSubmit();   // ↓の submit 予約がそのまま走る
  });
  listen(find(root, "[data-fragments]"), "click", options.openFragments);
  listen(find(root, "[data-outing]"), "click", options.openOuting);

  // 「記録する」ボタン(アプリの心臓への入口)
  listen(form, "submit", (event) => {
    event.preventDefault();   // ブラウザの標準動作(サーバー送信+再読み込み)を止める
    const fields = Object.fromEntries(new FormData(form));  // 入力欄の中身を袋に詰める
    if (!fields.feeling.trim()) {
      // 空なら:エラー文を出してカーソルを戻し、保存しない
      setText(find(root, "[data-error]"), "一行だけ書くか、「なし」を押してください");
      form.elements.feeling.focus();
      return;
    }
    editing = false;
    justSaved = true;         // 次の描画で一言と演出を出すための印
    savedAnimated = false;
    // 60日目ちょうど(=== 60)に保存したときだけ、一度きりの「読み返せます」を出す
    unlockNoticeVisible = Boolean(state.started_on)
      && daysBetween(state.started_on, today) === 60
      && !unlockAlreadyShown(today);
    if (unlockNoticeVisible) rememberUnlockShown(today);
    saveEntry(fields, today); // 管理人に保存を依頼 → commit → 放送 → render → この画面が A で描き直る
    notify("記録を置きました");
  });
}
