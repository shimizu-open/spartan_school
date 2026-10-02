// ============================================================================
// views/about.js — 「このアプリについて」の画面係
// ----------------------------------------------------------------------------
// 使い方・保存先の説明、控え(バックアップ)、復元、「使うのをやめる」(全削除)。
//
// このファイルだけは起動時に読み込まれず、初めて必要になった瞬間に
// main.js が取り寄せる(毎日の起動を軽くするため)。
//
// 初回モード(isInitial):はじめの言葉を閉じた直後にこの画面が案内され、
// 「← かけら」の代わりに大きな「はじめる」ボタンが出る。
// ============================================================================

import { clearAll, restoreBackup } from "../state.js";
import { dateKey } from "../lib/date.js";
import { downloadFile, find, listen, setMarkup, setText } from "../lib/dom.js";

// --- backup: 控えを取る(全データを JSON ファイルでダウンロードさせる) ---------
// JSON.stringify(state, null, 2) = 袋を人が読める形(2字下げ)の文字列にする。
// downloadFile はブラウザ内で完結する(通信ゼロ。lib/dom.js 参照)。
function backup(state) {
  downloadFile(
    `kakera-${dateKey()}.json`,
    "application/json",
    `${JSON.stringify(state, null, 2)}\n`,
  );
}

// --- validBackup: 復元ファイルの全項目検査 -----------------------------------
// 控えのファイルを無条件には信じない。形・日付らしさ・文字数上限を全部確かめ、
// 1つでもおかしければ false(=復元を断り、既存の記録には指一本触れない)。
// 壊れたファイルや細工されたファイルで記録を汚さないための関門。
function validBackup(data) {
  if (!data || data.version !== 1 || typeof data !== "object") return false;
  // 「日付らしい形」「月らしい形」の定義(正規表現 = 文字列の形のパターン)
  const date = /^\d{4}-\d{2}-\d{2}$/;   // 例 "2026-08-01"
  const month = /^\d{4}-\d{2}$/;        // 例 "2026-08"
  if (!data.entries || typeof data.entries !== "object" || Array.isArray(data.entries)) return false;
  if (!data.outings || typeof data.outings !== "object" || Array.isArray(data.outings)) return false;
  // every = 「全件が条件を満たすか」。1件でも不正なら false になる
  const entriesValid = Object.entries(data.entries).every(([key, entry]) => (
    date.test(key)                                     // 見出しは日付の形か
    && entry && typeof entry === "object" && !Array.isArray(entry)
    && typeof entry.feeling === "string" && entry.feeling.length > 0 && entry.feeling.length <= 140
    && typeof entry.done === "string" && entry.done.length <= 80
    && typeof entry.person === "string" && entry.person.length <= 80
    && typeof entry.created_at === "string"
  ));
  const outingsValid = Object.entries(data.outings).every(([key, outing]) => (
    month.test(key)                                    // 見出しは月の形か
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

// --- renderAbout: この画面の本体 ---------------------------------------------
// 受け取るものが多いのは、この画面から呼べる先が多いため:
//   back=一覧へ戻る / showOnboarding=はじめの言葉 / notify=通知係
//   returnToToday=今日へ強制帰還(全削除後に使う) / isInitial=初回モードか
//   start=初回の「はじめる」で呼ぶ関数(読了の印を付けて今日へ)
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
          <li>今月のひとつ　—　今月、行ってみる場所をひとつ決めます。行く途中で気になる場所を見つけたら、そちらに変えてもかまいません。出かけた日は「行った」を押します</li>
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
        <h2 class="text-ui text-ai md:text-ui-md">はじめの言葉</h2>
        <button type="button" data-onboarding class="mt-3 min-h-touch min-w-touch text-ui text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 md:text-ui-md">もう一度読む</button>
      </section>
    </div>
    ${isInitial ? '<button type="button" data-start class="shard mt-20 min-h-button w-full bg-ai px-5 text-base text-men transition-colors hover:bg-sumi focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">はじめる</button>' : ""}
    <section class="mt-20">
      <button type="button" data-stop class="min-h-touch min-w-touch text-note text-nibi underline decoration-kei underline-offset-4 focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2">使うのをやめる</button>
      <div data-stop-panel class="mt-5"></div>
    </section>
  `);
  // 予約の仕掛け(初回モードかどうかでボタンが違う)
  if (!isInitial) listen(find(root, "[data-back]"), "click", back);
  if (isInitial) listen(find(root, "[data-start]"), "click", start);
  listen(find(root, "[data-onboarding]"), "click", showOnboarding);
  // 「控えを取る」
  listen(find(root, "[data-backup]"), "click", () => {
    backup(state);
    notify("控えを取りました");
  });
  // 「控えから復元する」— ファイルが選ばれたら読んで、検査して、通れば復元
  // async/await = 「ファイルを読み終わるまで待つ」ための書き方
  listen(find(root, "[data-restore]"), "change", async (event) => {
    try {
      const file = event.target.files[0];
      const data = file && JSON.parse(await file.text());  // 文字列 → 袋 に変換
      const restored = validBackup(data);                  // 全項目検査
      if (restored) restoreBackup(data);                   // 通ったときだけ管理人に渡す
      setText(find(root, "[data-restore-status]"), restored ? "復元しました" : "控えを読めませんでした");
    } catch {
      // JSON ですらないファイル等はここに来る。エラーで止まらず、断るだけ
      setText(find(root, "[data-restore-status]"), "控えを読めませんでした");
    }
    event.target.value = "";   // 同じファイルをもう一度選べるように選択をリセット
  });
  // 「使うのをやめる」→ 3段階の1段目へ
  listen(find(root, "[data-stop]"), "click", () => renderStopFirst(root, state, notify, returnToToday));
}

// --- renderStopFirst: やめる手続きの1段目「先に控えを取れます」 ----------------
// 取り返しのつかない操作の前に、退路(控え)を必ず一度差し出す。
// チェックは最初から ON(何も考えず進んでも控えが残る側に倒してある)。
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
  listen(find(panel, "[data-cancel]"), "click", () => setMarkup(panel, ""));  // 戻る=パネルを消すだけ
  listen(find(panel, "[data-next]"), "click", () => {
    if (find(panel, "[data-with-backup]").checked) backup(state);  // チェックが付いていれば控えを取ってから
    renderStopFinal(panel, notify, returnToToday);                 // 2段目(最終確認)へ
  });
  find(panel, "[data-with-backup]").focus();
}

// --- renderStopFinal: やめる手続きの2段目(最終確認) ---------------------------
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
    clearAll();        // 管理人に全消去を依頼(まっさらな袋への commit = 例の一本道)
    returnToToday();   // 今日の画面へ強制帰還
    notify("消しました");
  });
  find(panel, "[data-clear]").focus();
}
