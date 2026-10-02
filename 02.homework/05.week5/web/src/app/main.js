// ============================================================================
// main.js — 司令塔
// ----------------------------------------------------------------------------
// このファイルは index.html の <script src="./assets/app/main.js"> によって
// ブラウザに読み込まれ、1行目から順に実行される。アプリ全体の「入口」。
//
// 仕事は3つだけ。
//   1. いまどの画面(今日/ひとつ/かけら/about)を出すべきか決める
//   2. その画面の担当(views/ の誰か)に、箱とデータを渡して描かせる
//   3. ブラウザの「戻る」や日付またぎなど、アプリの外から来る出来事に対応する
// 画面の中身そのものは描かない(それは views/ の仕事)。
// ============================================================================

// --- import: 仲間のファイルから関数を借りてくる -----------------------------
// import { A } from "./B.js" は「B.js から関数 A を借りる」という意味。
// この行によって B.js も連鎖的に読み込まれ、ファイル同士が廊下でつながる。
import { finishOnboarding, getState, initialize, subscribe } from "./state.js";
import { dateKey } from "./lib/date.js";
import { find, listen, setMarkup, setText } from "./lib/dom.js";
import { renderFragments } from "./views/fragments.js";
import { renderOnboarding } from "./views/onboarding.js";
import { renderOuting, resetOutingTransient } from "./views/outing.js";
import { renderToday, resetTodayTransient } from "./views/today.js";
// ※ about.js だけここに無いのは、初めて必要になった瞬間に取り寄せる方針だから
//   (毎日の起動を、滅多に開かない画面のぶんまで待たせないため)。navigate() を参照。

// --- HTML の「空の箱」を掴む -------------------------------------------------
// document.querySelector("#名前") は「HTML から id=名前 の部品を探して持ってくる」。
// index.html に置いた4つの <section> をここで掴み、roots という袋にまとめる。
// 以後 roots.today と書けば「今日の画面の箱」を指せる。
const roots = {
  today: document.querySelector("#today-view"),
  outing: document.querySelector("#outing-view"),
  fragments: document.querySelector("#fragments-view"),
  about: document.querySelector("#about-view"),
};
const statusRoot = document.querySelector("#status");           // 読み上げソフト用の見えない通知欄
const onboardingRoot = document.querySelector("#onboarding-view"); // はじめの言葉を出す場所

// --- 覚え書き用の変数 --------------------------------------------------------
let active = "today";          // いま表示している画面の名前
let onboardingOpen = false;    // 「はじめの言葉」を(再読で)開いているか
let renderedDate = dateKey();  // いま画面に描いてあるのは、この日付の内容(日付またぎ検知用)
let aboutRenderer;             // about 画面の描画関数の置き場(取り寄せるまでは空)

// --- notify: 画面読み上げソフトへの通知 --------------------------------------
// 「記録を置きました」等の文を、目に見えない通知欄(#status)に書き込む。
// この欄に文字が入ると、読み上げソフトが自動でそれを読み上げる仕組み(aria-live)。
// 一度空にしてから書くのは、同じ文を2回続けて入れると
// 「変化なし」とみなされて読み上げられないため。
function notify(message) {
  setText(statusRoot, "");
  requestAnimationFrame(() => setText(statusRoot, message));
}

// --- routeState: 履歴に貼る「付箋」を作る ------------------------------------
// { kakera: true, view: "outing" } のような小さなメモ。
// history.pushState でページに貼り、「戻る」で戻ってきたときに読む(popstate 参照)。
// kakera: true は「これはこのアプリが貼った付箋です」という印。
function routeState(view) {
  return { kakera: true, view };
}

// --- setActive: 4つの箱の表示/非表示を入れ替える -----------------------------
// いまの画面の箱だけ見せて、他は hidden(隠す)にする。
// ページを移動せず「紙芝居の絵だけ差し替える」= SPA の要。
function setActive(view) {
  // 実在する画面名かを確認してから採用(変な名前が来たら today に逃がす)
  active = Object.hasOwn(roots, view) ? view : "today";
  Object.entries(roots).forEach(([name, root]) => {
    root.hidden = name !== active;   // いまの画面以外、全部に hidden を付ける
  });
}

// --- render: 描き直しの親分 --------------------------------------------------
// 「いまの画面(active)」に応じて、担当の画面係を呼び出す。
// 呼び方は毎回同じ形:担当(描き込み先の箱, データの袋, 連絡先...)。
// データが変わるたびに subscribe 経由でこの関数が呼ばれる(ファイル末尾参照)。
function render() {
  const state = getState();   // 管理人からいまのデータの袋をもらう
  // はじめの言葉を出すべきか:まだ読んでいない初回か、再読ボタンで開かれたか
  const shouldShowOnboarding = (!state.onboarded && active !== "about") || onboardingOpen;
  setActive(active);          // 箱の表示/非表示を切り替え

  if (active === "today") {
    // 今日の画面係に依頼。箱・データ・通知係・細かい指示の袋、の4点を渡す。
    // openFragments 等は「切り替えたくなったらこれを呼べ」という連絡先
    // (画面の切り替えは司令塔の仕事なので、画面係には連絡先だけ渡す)。
    renderToday(roots.today, state, notify, {
      allowAutofocus: !shouldShowOnboarding,
      openFragments: () => navigate("fragments"),
      openOuting: () => navigate("outing"),
    });
  } else if (active === "outing") {
    renderOuting(roots.outing, state, notify, () => goBack("today"));
  } else if (active === "fragments") {
    renderFragments(
      roots.fragments,
      state,
      () => navigate("about"),
      showOnboarding,
      () => goBack("today"),
    );
  } else {
    // about 画面。aboutRenderer は取り寄せ済みなら関数、まだなら空。
    // ?.( ) は「あれば呼ぶ、なければ何もしない」という安全な呼び方。
    aboutRenderer?.(
      roots.about,
      state,
      () => goBack("fragments"),
      showOnboarding,
      notify,
      returnToToday,
      !state.onboarded,
      finishInitialAbout,
    );
  }

  // はじめの言葉は、画面の上にかぶせて出す(不要なら空にして消す)
  if (shouldShowOnboarding) renderOnboarding(onboardingRoot, closeOnboarding, !state.onboarded);
  else setMarkup(onboardingRoot, "");
}

// --- navigate: ボタン経由の画面切り替え --------------------------------------
// 「今月のひとつ」「これまでを見る」等を押したときに呼ばれる。
async function navigate(view) {
  // about 画面の担当ファイルは、初めて必要になったこの瞬間に取り寄せる。
  // await import(...) =「ファイルを取り寄せて、届くまで待つ」。
  if (view === "about" && !aboutRenderer) {
    ({ renderAbout: aboutRenderer } = await import("./views/about.js"));
  }
  // 画面をまたぐ移動をしたら、各画面係の一時的な覚え書き(編集中か等)は白紙に戻す
  if (view !== active) {
    resetTodayTransient();
    resetOutingTransient();
  }
  active = view;
  // ★履歴に「1ページ進んだこと」を記録し、付箋を貼る。
  //   これをしないと、スマホの「戻る」でサイトごと出て行ってしまう(SPA の代償)。
  history.pushState(routeState(view), "");
  render();
  // 新しい画面の見出しにフォーカスを移す(読み上げソフト利用者に画面が替わったと伝わる)
  find(roots[view], "h1")?.focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: "auto" });   // ページ先頭へ
}

// --- goBack: 「← 今日」等の戻るリンク ----------------------------------------
// 履歴にこのアプリの付箋があれば、ブラウザの「戻る」と同じ動きをさせる。
// なければ(URL 直開きなど)、指定された画面に置き換えで移動する。
function goBack(fallback) {
  const previous = history.state?.kakera;   // いまのページの付箋を確認
  if (previous) history.back();             // 付箋あり → 本物の「戻る」(popstate が発火する)
  else {
    active = fallback;
    history.replaceState(routeState(fallback), "");  // 履歴を積まずに付箋だけ書き換え
    render();
  }
}

// --- returnToToday: 強制的に「今日」へ帰る -----------------------------------
// 全削除のあとなど、履歴をたどらせたくない場面で使う。
function returnToToday() {
  active = "today";
  resetTodayTransient();
  resetOutingTransient();
  history.replaceState(routeState("today"), "");
  render();
  scrollTo({ top: 0, behavior: "auto" });
}

// --- はじめの言葉の開閉 ------------------------------------------------------
function showOnboarding() {
  onboardingOpen = true;
  render();
}

function closeOnboarding() {
  onboardingOpen = false;
  // 初回(まだ onboarded でない)なら、言葉を閉じたあと「このアプリについて」へ案内する
  if (!getState().onboarded && active !== "about") navigate("about");
  else render();
}

// 初回の「このアプリについて」で「はじめる」を押したとき:
// 読了の印を付けて(finishOnboarding)、今日の画面へ
function finishInitialAbout() {
  finishOnboarding();
  returnToToday();
}

// --- 見張り番①: ブラウザの「戻る/進む」 --------------------------------------
// popstate =「戻る/進む」で履歴を移動した、というイベント。
// navigate() の pushState が貼った付箋を、ここで読む(書く側と読む側でペア)。
listen(window, "popstate", (event) => {
  // 付箋があればその画面名、なければ今日へ。
  // ?. は「無いかもしれないものを安全に覗く」書き方(付箋のないページ対策)。
  const view = event.state?.kakera ? event.state.view : "today";
  // 「戻る」で about に着地することもあるので、未取り寄せなら今から取り寄せる
  if (view === "about" && !aboutRenderer) {
    import("./views/about.js").then(({ renderAbout }) => {
      aboutRenderer = renderAbout;
      if (active === "about") render();   // 届いたとき、まだ about にいたら描き直す
    });
  }
  resetTodayTransient();     // 画面またぎなので一時メモは捨てる
  resetOutingTransient();
  active = Object.hasOwn(roots, view) ? view : "today";
  render();
  scrollTo({ top: 0, behavior: "auto" });
});

// --- 見張り番②: 日付またぎ ---------------------------------------------------
// visibilitychange =「この画面が隠れた/再び見えた」というイベント。
// SPA はページを読み込み直さないので、開いたまま夜をまたぐと昨日の画面のまま。
// 再び見えた瞬間に「描いたときの日付」と「いまの日付」を見比べて、違ったら
// どの画面にいても新しい「今日」に連れ戻す。
listen(document, "visibilitychange", () => {
  if (document.visibilityState === "visible" && renderedDate !== dateKey()) {
    renderedDate = dateKey();   // 覚え書きを今日に更新
    active = "today";
    resetTodayTransient();
    resetOutingTransient();
    // 日付が変わったのはユーザーの操作ではないので、履歴は積まず付箋だけ書き換える
    // (「戻る」で昨日の画面に戻れてしまう履歴を残さない)
    history.replaceState(routeState("today"), "");
    render();
  }
});

// ============================================================================
// 起動の4手 — ここまでは「道具の用意」と「レシピの登録」。実行はここから始まる。
// ============================================================================
initialize();                                  // ① 保存データを読み込む(state.js → storage/)
history.replaceState(routeState("today"), ""); // ② 最初のページに「今日」の付箋を貼る
subscribe(render);                             // ③ 「データが変わったら render を呼ぶ」を予約
render();                                      // ④ 最初の描画
