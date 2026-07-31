import { allDateKeys, dateKey, displayListDate, displayLongDate, isUnlocked, recentDateKeys } from "../lib/date.js";
import { downloadFile, find, listen, setMarkup, setText } from "../lib/dom.js";

function entryMarkup(key, entry, outing) {
  const done = entry?.done ? `<p class="mt-3 text-ui leading-relaxed text-nibi md:text-ui-md">済　<span data-done class="text-sumi"></span></p>` : "";
  const person = entry?.person ? `<p class="mt-2 text-ui leading-relaxed text-nibi md:text-ui-md">人　<span data-person class="text-sumi"></span></p>` : "";
  const went = outing ? `<p class="mt-3 text-note leading-relaxed text-seiji">◇ <span data-outing></span></p>` : "";
  return `
    <article class="shard-sm min-h-20 w-full bg-men px-5 py-3">
      <p data-entry-date class="font-mincho text-ui text-nibi md:text-ui-md"></p>
      <p data-feeling class="mt-2 font-mincho text-record leading-record text-sumi md:text-record-md"></p>
      ${done}${person}${went}
    </article>
  `;
}

function textExport(state) {
  return Object.keys(state.entries).sort().map((key) => {
    const entry = state.entries[key];
    const lines = [displayLongDate(key), entry.feeling];
    if (entry.done) lines.push(`済　${entry.done}`);
    if (entry.person) lines.push(`人　${entry.person}`);
    return lines.join("\n");
  }).join("\n\n");
}

export function renderFragments(root, state, openAbout, showOnboarding, back) {
  const unlocked = isUnlocked(state.started_on);
  const keys = unlocked ? allDateKeys(state.started_on) : recentDateKeys();
  const hasEntries = Object.keys(state.entries).length > 0;
  setMarkup(root, `
    <button type="button" data-back class="min-h-touch min-w-touch text-ui text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 md:text-ui-md">← 今日</button>
    <div class="mt-7 flex items-baseline justify-between gap-5">
      <h1 id="fragments-title" tabindex="-1" class="font-mincho text-record leading-loose text-sumi outline-none md:text-record-md">かけら</h1>
      ${unlocked ? '<p class="animate-unlock text-ui text-kin motion-reduce:animate-none md:text-ui-md">読み返せます</p>' : ""}
    </div>
    <p data-empty class="mt-3 hidden text-ui leading-relaxed text-nibi md:text-ui-md">今日のぶんから始まります</p>
    <div data-list class="mt-0 grid gap-3 lg:mt-5"></div>
    <div class="mt-10 pb-safe">
      ${unlocked ? '<button type="button" data-text-export class="shard-sm min-h-touch min-w-touch border border-kei px-5 text-ui text-ai transition-colors hover:bg-men focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none md:text-ui-md">記録をテキストで書き出す</button>' : '<p class="text-ui leading-relaxed text-nibi md:text-ui-md">これより前は、二か月後に読み返せます</p>'}
      <div class="mt-7 flex flex-wrap gap-x-7 gap-y-3">
        <button type="button" data-onboarding class="min-h-touch min-w-touch text-ui text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 md:text-ui-md">はじめに読んだ説明</button>
        <button type="button" data-about class="min-h-touch min-w-touch text-ui text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 md:text-ui-md">このアプリについて</button>
      </div>
    </div>
  `);
  listen(find(root, "[data-back]"), "click", back);
  if (!hasEntries) find(root, "[data-empty]").classList.remove("hidden");
  const list = find(root, "[data-list]");
  keys.forEach((key) => {
    const entry = state.entries[key];
    const outing = Object.values(state.outings).find((item) => item.went_on === key);
    const holder = document.createElement("div");
    setMarkup(holder, entryMarkup(key, entry, outing));
    setText(find(holder, "[data-entry-date]"), displayListDate(key));
    setText(find(holder, "[data-feeling]"), entry?.feeling ?? "—");
    if (entry?.done) setText(find(holder, "[data-done]"), entry.done);
    if (entry?.person) setText(find(holder, "[data-person]"), entry.person);
    if (outing) setText(find(holder, "[data-outing]"), outing.goal);
    list.append(holder.firstElementChild);
  });
  listen(find(root, "[data-about]"), "click", openAbout);
  listen(find(root, "[data-onboarding]"), "click", showOnboarding);
  const exportButton = find(root, "[data-text-export]");
  if (exportButton) {
    listen(exportButton, "click", () => {
      downloadFile(`kakera-${dateKey()}.txt`, "text/plain;charset=utf-8", textExport(state));
    });
  }
}
