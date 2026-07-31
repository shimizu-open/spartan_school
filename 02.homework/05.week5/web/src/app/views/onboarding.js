import { find, listen, setMarkup } from "../lib/dom.js";

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
  listen(button, "click", close);
  button.focus();
}
