// ============================================================================
// views/onboarding.js — 「はじめの言葉」の画面係
// ----------------------------------------------------------------------------
// 初回だけ画面全体を覆って出る短い言葉。説明書ではなく、
// このアプリの用途の「実物」(一行の例)を先に見せる、という設計。
// あとから「はじめの言葉」ボタンで何度でも読み返せる。
// 16行しかないのは、それ以上のことをしないから。
// ============================================================================

import { find, listen, setMarkup } from "../lib/dom.js";

// 司令塔から (かぶせる場所, 閉じたとき呼ぶ関数, 初回か) を受け取る。
// role="dialog" aria-modal="true" = 読み上げソフトに「これは画面を覆う
// 対話ボックスです」と伝える印。
export function renderOnboarding(root, close, isInitial) {
  setMarkup(root, `
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-sushi px-5 py-5 sm:px-8" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div class="shard w-full max-w-onboarding bg-men px-7 py-10 md:px-10">
        <p id="onboarding-title" class="font-mincho text-record leading-loose text-sumi md:text-record-md">きれいだと思った。<br>腹が立った。</p>
        <p class="mt-14 font-mincho text-record leading-loose text-sumi">消えてしまう前に、<br>一日に一行、拾っておく。</p>
        <button type="button" data-close class="shard mt-14 min-h-button w-full bg-ai px-5 text-base text-men transition-colors hover:bg-sumi focus-visible:outline-2 focus-visible:outline-ai focus-visible:outline-offset-2 motion-reduce:transition-none">はじめる</button>
      </div>
    </div>
  `);
  const button = find(root, "[data-close]");
  listen(button, "click", close);   // 閉じ方は司令塔が決める(初回なら about へ案内される)
  button.focus();                   // キーボード操作の人がすぐ押せるようにフォーカスを置く
}
