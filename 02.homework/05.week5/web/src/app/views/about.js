import { clearAll, restoreBackup } from "../state.js";
import { dateKey } from "../lib/date.js";
import { downloadFile, find, listen, setMarkup, setText } from "../lib/dom.js";

function backup(state) {
  downloadFile(
    `kakera-${dateKey()}.json`,
    "application/json",
    `${JSON.stringify(state, null, 2)}\n`,
  );
}

function validBackup(data) {
  if (!data || data.version !== 1 || typeof data !== "object") return false;
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const month = /^\d{4}-\d{2}$/;
  if (!data.entries || typeof data.entries !== "object" || Array.isArray(data.entries)) return false;
  if (!data.outings || typeof data.outings !== "object" || Array.isArray(data.outings)) return false;
  const entriesValid = Object.entries(data.entries).every(([key, entry]) => (
    date.test(key)
    && entry && typeof entry === "object" && !Array.isArray(entry)
    && typeof entry.feeling === "string" && entry.feeling.length > 0 && entry.feeling.length <= 140
    && typeof entry.done === "string" && entry.done.length <= 80
    && typeof entry.person === "string" && entry.person.length <= 80
    && typeof entry.created_at === "string"
  ));
  const outingsValid = Object.entries(data.outings).every(([key, outing]) => (
    month.test(key)
    && outing && typeof outing === "object" && !Array.isArray(outing)
    && typeof outing.goal === "string" && outing.goal.length > 0 && outing.goal.length <= 60
    && (outing.planned_on === null || date.test(outing.planned_on))
    && (outing.went_on === null || date.test(outing.went_on))
    && typeof outing.created_at === "string"
  ));
  return entriesValid && outingsValid
    && (data.started_on === null || date.test(data.started_on))
    && typeof data.onboarded === "boolean";
}

export function renderAbout(root, state, back, showOnboarding, notify, returnToToday, isInitial, start) {
  setMarkup(root, `
    ${isInitial ? "" : '<button type="button" data-back class="min-h-touch min-w-touch text-ui text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 md:text-ui-md">← かけら</button>'}
    <h1 id="about-title" tabindex="-1" class="mt-7 font-mincho text-record leading-loose text-sumi outline-none md:text-record-md">このアプリについて</h1>
    <p class="mt-3 text-ui leading-loose text-nibi md:text-ui-md">拾って、とっておく。</p>
    <div class="mt-10 grid gap-10">
      <section>
        <h2 class="text-ui text-ai md:text-ui-md">使い方</h2>
        <ul class="mt-3 grid list-disc gap-3 pl-5 text-ui leading-loose text-nibi md:text-ui-md">
          <li>今日の画面に、一日に一行だけ書きます。何もなかった日は「なし」を押します</li>
          <li>済（片づけた面倒）と 人（関わった人についての事実）は、書きたいときだけ「＋ 済・人」で開きます</li>
          <li>書いたものは、同じ日のうちなら何度でも書き直せます。翌日からは直せません</li>
          <li>これまでを見る　—　直近の七日が並びます。はじめて書いた日から二か月経つと、全部を読み返せるようになります</li>
          <li>今月のひとつ　—　月に一度の外出をひとつ決めます。目的は家を出るための口実で、途中で気が変わったら捨ててかまいません。出かけた日は「行った」を押します</li>
        </ul>
      </section>
      <section>
        <h2 class="text-ui text-ai md:text-ui-md">記録の保存先</h2>
        <p class="mt-3 text-ui leading-loose text-nibi md:text-ui-md">記録はこの端末のブラウザ内にのみ存在します。外部には送られません。ブラウザのデータを削除したときや、端末を替えたときには消えます</p>
      </section>
      <section>
        <h2 class="text-ui text-ai md:text-ui-md">通知</h2>
        <p class="mt-3 text-ui leading-loose text-nibi md:text-ui-md">通知はありません。必要なら、端末のリマインダーを使えます</p>
      </section>
      <section>
        <h2 class="text-ui text-ai md:text-ui-md">控え</h2>
        <p class="mt-3 text-ui leading-loose text-nibi md:text-ui-md">全件をファイルに保存し、この端末または別の端末で復元できます</p>
        <div class="mt-3 flex flex-wrap gap-5">
          <button type="button" data-backup class="shard-sm min-h-touch min-w-touch border border-kei px-5 text-ui text-ai transition-colors hover:bg-men focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none md:text-ui-md">控えを取る</button>
          <label class="shard-sm flex min-h-touch min-w-touch cursor-pointer items-center border border-kei px-5 text-ui text-ai transition-colors hover:bg-men focus-within:outline-2 focus-within:outline-ai focus-within:outline-offset-2 motion-reduce:transition-none md:text-ui-md">
            控えから復元する
            <input data-restore type="file" accept="application/json,.json" class="sr-only">
          </label>
        </div>
        <p data-restore-status class="mt-3 min-h-5 text-ui leading-relaxed text-nibi" role="status"></p>
      </section>
      <section>
        <h2 class="text-ui text-ai md:text-ui-md">はじめに読んだ説明</h2>
        <button type="button" data-onboarding class="mt-3 min-h-touch min-w-touch text-ui text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 md:text-ui-md">もう一度読む</button>
      </section>
    </div>
    ${isInitial ? '<button type="button" data-start class="shard mt-20 min-h-button w-full bg-ai px-5 text-base text-men transition-colors hover:bg-sumi focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">はじめる</button>' : ""}
    <section class="mt-20">
      <button type="button" data-stop class="min-h-touch min-w-touch text-note text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2">使うのをやめる</button>
      <div data-stop-panel class="mt-5"></div>
    </section>
  `);
  if (!isInitial) listen(find(root, "[data-back]"), "click", back);
  if (isInitial) listen(find(root, "[data-start]"), "click", start);
  listen(find(root, "[data-onboarding]"), "click", showOnboarding);
  listen(find(root, "[data-backup]"), "click", () => {
    backup(state);
    notify("控えを取りました");
  });
  listen(find(root, "[data-restore]"), "change", async (event) => {
    try {
      const file = event.target.files[0];
      const data = file && JSON.parse(await file.text());
      const restored = validBackup(data);
      if (restored) restoreBackup(data);
      setText(find(root, "[data-restore-status]"), restored ? "復元しました" : "控えを読めませんでした");
    } catch {
      setText(find(root, "[data-restore-status]"), "控えを読めませんでした");
    }
    event.target.value = "";
  });
  listen(find(root, "[data-stop]"), "click", () => renderStopFirst(root, state, notify, returnToToday));
}

function renderStopFirst(root, state, notify, returnToToday) {
  const panel = find(root, "[data-stop-panel]");
  setMarkup(panel, `
    <div class="shard bg-men px-7 py-7">
      <p class="text-ui leading-loose text-sumi md:text-ui-md">先に控えを取れます</p>
      <label class="mt-3 flex min-h-touch items-center gap-3 text-ui text-nibi md:text-ui-md">
        <input data-with-backup type="checkbox" checked class="size-5 accent-ai focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2">
        控えを取ってから進む
      </label>
      <div class="mt-5 flex flex-wrap gap-5">
        <button type="button" data-cancel class="shard-sm min-h-touch min-w-touch border border-kei px-5 text-ui text-ai transition-colors hover:bg-men focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">戻る</button>
        <button type="button" data-next class="shard-sm min-h-touch min-w-touch border border-kei px-5 text-ui text-ai transition-colors hover:bg-men focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">次へ</button>
      </div>
    </div>
  `);
  listen(find(panel, "[data-cancel]"), "click", () => setMarkup(panel, ""));
  listen(find(panel, "[data-next]"), "click", () => {
    if (find(panel, "[data-with-backup]").checked) backup(state);
    renderStopFinal(panel, notify, returnToToday);
  });
  find(panel, "[data-with-backup]").focus();
}

function renderStopFinal(panel, notify, returnToToday) {
  setMarkup(panel, `
    <div class="shard bg-men px-7 py-7">
      <p class="text-ui leading-loose text-sumi md:text-ui-md">すべての記録がこの端末から消えます。この操作は取り消せません</p>
      <div class="mt-5 flex flex-wrap gap-5">
        <button type="button" data-cancel class="shard-sm min-h-touch min-w-touch border border-kei px-5 text-ui text-ai transition-colors hover:bg-men focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">戻る</button>
        <button type="button" data-clear class="shard-sm min-h-touch min-w-touch border border-kei px-5 text-ui text-ai transition-colors hover:bg-men focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">使うのをやめる</button>
      </div>
    </div>
  `);
  listen(find(panel, "[data-cancel]"), "click", () => setMarkup(panel, ""));
  listen(find(panel, "[data-clear]"), "click", () => {
    clearAll();
    returnToToday();
    notify("消しました");
  });
  find(panel, "[data-clear]").focus();
}
