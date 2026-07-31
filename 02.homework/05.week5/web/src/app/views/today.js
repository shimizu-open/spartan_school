import { markOutingWent, saveEntry } from "../state.js";
import { dateKey, daysBetween, displayDate, monthDayIndex, monthKey } from "../lib/date.js";
import { find, listen, setMarkup, setText } from "../lib/dom.js";

let justSaved = false;
let savedAnimated = false;
let editing = false;
let autofocusDate = null;
let unlockNoticeVisible = false;
let linesPromise;

function renderDailyLine(node, today, animate) {
  linesPromise ??= import("../data/lines.js");
  linesPromise.then(({ default: lines }) => {
    if (!node?.isConnected) return;
    const line = lines[monthDayIndex(today)];
    if (line) setText(node, line);
    if (animate) node.classList.add("animate-reveal", "motion-reduce:animate-none");
  });
}

function bottomLinks() {
  return `
    <div class="mt-20 flex justify-between gap-3 pb-safe">
      <button type="button" data-fragments class="min-h-touch min-w-touch text-note text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2">これまでを見る</button>
      <button type="button" data-outing class="min-h-touch min-w-touch text-note text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2">今月のひとつ</button>
    </div>
  `;
}

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
    // The notice is transient; storage denial must not block recording.
  }
}

export function resetTodayTransient() {
  justSaved = false;
  savedAnimated = false;
  editing = false;
  unlockNoticeVisible = false;
}

export function renderToday(root, state, notify, options) {
  const today = dateKey();
  const entry = state.entries[today];
  const outing = state.outings[monthKey()];
  if (entry && !editing) {
    const contextMarkup = monthlyMarkup(outing);
    setMarkup(root, savedMarkup(contextMarkup, justSaved, unlockNoticeVisible));
    setText(find(root, "[data-date]"), displayDate(today));
    setText(find(root, "[data-feeling]"), entry.feeling);
    setText(find(root, "[data-done]"), entry.done);
    setText(find(root, "[data-person]"), entry.person);
    if (entry.done) find(root, "[data-done-row]").classList.remove("hidden");
    if (entry.person) find(root, "[data-person-row]").classList.remove("hidden");
    if (outing && find(root, "[data-outing-goal]")) setText(find(root, "[data-outing-goal]"), outing.goal);
    if (justSaved) renderDailyLine(find(root, "[data-line]"), today, !savedAnimated);
    if (!savedAnimated && justSaved) {
      find(root, "[data-edit-card]").classList.add("animate-settle", "motion-reduce:animate-none");
      savedAnimated = true;
    }
    const editEntry = () => {
      editing = true;
      justSaved = false;
      unlockNoticeVisible = false;
      renderToday(root, state, notify, options);
      find(root, "#feeling").focus();
    };
    listen(find(root, "[data-edit-card]"), "click", editEntry);
    listen(find(root, "[data-edit]"), "click", editEntry);
    const wentButton = find(root, "[data-went]");
    if (wentButton) listen(wentButton, "click", () => {
      markOutingWent(monthKey(), today);
      notify("行った日を置きました");
    });
    const unlock = find(root, "[data-unlock]");
    if (unlock) listen(unlock, "click", options.openFragments);
    listen(find(root, "[data-fragments]"), "click", options.openFragments);
    listen(find(root, "[data-outing]"), "click", options.openOuting);
    return;
  }

  const shouldAutofocus = options.allowAutofocus && !entry && autofocusDate !== today;
  const optionalOpen = Boolean(entry?.done || entry?.person);
  setMarkup(root, formMarkup(shouldAutofocus, optionalOpen));
  setText(find(root, "[data-date]"), displayDate(today));
  const form = find(root, "form");
  if (shouldAutofocus) {
    autofocusDate = today;
    requestAnimationFrame(() => {
      if (form.elements.feeling.isConnected) form.elements.feeling.focus();
    });
  }
  form.elements.feeling.value = entry?.feeling ?? "";
  form.elements.done.value = entry?.done ?? "";
  form.elements.person.value = entry?.person ?? "";

  listen(find(root, "[data-optional-toggle]"), "click", (event) => {
    const fields = find(root, "[data-optional-fields]");
    const opening = fields.classList.contains("hidden");
    fields.className = opening ? "mt-7 grid gap-7 short:mt-3 short:gap-3" : "hidden";
    event.currentTarget.setAttribute("aria-expanded", String(opening));
    setText(event.currentTarget, opening ? "− 済・人" : "＋ 済・人");
    if (opening) form.elements.done.focus();
  });
  listen(find(root, "[data-none]"), "click", () => {
    form.elements.feeling.value = "なし";
    form.requestSubmit();
  });
  listen(find(root, "[data-fragments]"), "click", options.openFragments);
  listen(find(root, "[data-outing]"), "click", options.openOuting);
  listen(form, "submit", (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    if (!fields.feeling.trim()) {
      setText(find(root, "[data-error]"), "一行だけ書くか、「なし」を押してください");
      form.elements.feeling.focus();
      return;
    }
    editing = false;
    justSaved = true;
    savedAnimated = false;
    unlockNoticeVisible = Boolean(state.started_on)
      && daysBetween(state.started_on, today) === 60
      && !unlockAlreadyShown(today);
    if (unlockNoticeVisible) rememberUnlockShown(today);
    saveEntry(fields, today);
    notify("記録を置きました");
  });
}
