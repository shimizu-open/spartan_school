import { displayDate, monthKey } from "../lib/date.js";
import { find, listen, setMarkup, setText } from "../lib/dom.js";
import { saveOuting } from "../state.js";

let editing = false;

export function resetOutingTransient() {
  editing = false;
}

function backAndHeading() {
  return `
    <button type="button" data-back class="min-h-touch min-w-touch text-ui text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-seiji focus-visible:outline-offset-2 md:text-ui-md">← 今日</button>
    <h1 id="outing-title" tabindex="-1" class="mt-7 font-mincho text-record leading-loose text-sumi outline-none md:text-record-md">今月のひとつ</h1>
  `;
}

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

export function renderOuting(root, state, notify, back) {
  const month = monthKey();
  const outing = state.outings[month];
  if (outing && !editing) {
    setMarkup(root, `
      ${backAndHeading()}
      <article class="shard-sm mt-7 bg-seiji-usu px-5 py-3">
        <p data-goal class="break-words font-mincho text-record leading-record text-sumi md:text-record-md"></p>
        ${outing.planned_on ? '<p data-planned class="mt-3 font-mincho text-ui leading-relaxed text-nibi md:text-ui-md"></p>' : ""}
      </article>
      <button type="button" data-edit-outing class="shard-sm mt-3 min-h-touch min-w-touch border border-kei px-5 text-ui text-seiji transition-colors hover:bg-seiji-usu focus-visible:outline-2 focus-visible:outline-seiji focus-visible:outline-offset-2 motion-reduce:transition-none">書き換える</button>
      <p class="mt-7 text-ui leading-loose text-nibi md:text-ui-md">目的は家を出るための口実です。途中で気が変わったら、捨ててかまいません</p>
      <div class="pb-safe"></div>
    `);
    setText(find(root, "[data-goal]"), outing.goal);
    if (outing.planned_on) setText(find(root, "[data-planned]"), displayDate(outing.planned_on));
    listen(find(root, "[data-back]"), "click", back);
    listen(find(root, "[data-edit-outing]"), "click", () => {
      editing = true;
      renderOuting(root, state, notify, back);
      find(root, "#outing-goal").focus();
    });
    return;
  }

  setMarkup(root, `
    ${backAndHeading()}
    ${formMarkup(outing)}
    <p class="mt-7 text-ui leading-loose text-nibi md:text-ui-md">目的は家を出るための口実です。途中で気が変わったら、捨ててかまいません</p>
    <div class="pb-safe"></div>
  `);
  listen(find(root, "[data-back]"), "click", back);
  const form = find(root, "form");
  form.elements.goal.value = outing?.goal ?? "";
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
  listen(form, "submit", (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    if (!fields.goal.trim()) {
      setText(find(root, "[data-error]"), "目的を一行だけ書いてください");
      form.elements.goal.focus();
      return;
    }
    editing = false;
    saveOuting({
      goal: fields.goal,
      planned_on: fields.planned_on ?? outing?.planned_on ?? "",
    }, month);
    notify("今月のひとつを置きました");
  });
}
