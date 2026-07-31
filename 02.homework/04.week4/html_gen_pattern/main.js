const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-button");
const menuLinks = document.querySelectorAll(".global-navigation a");

const closeMenu = (restoreFocus = false) => {
  header.classList.remove("is-open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "メニューを開く");

  if (restoreFocus) {
    menuButton.focus();
  }
};

menuButton.addEventListener("click", () => {
  const willOpen = !header.classList.contains("is-open");

  /*
   * 表示の責務をCSSにまとめるため、インラインスタイルではなく
   * 状態を表すクラスだけを切り替える。
   */
  header.classList.toggle("is-open", willOpen);
  menuButton.setAttribute("aria-expanded", String(willOpen));
  menuButton.setAttribute(
    "aria-label",
    willOpen ? "メニューを閉じる" : "メニューを開く"
  );
});

menuLinks.forEach((link) => {
  link.addEventListener("click", () => {
    closeMenu();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && header.classList.contains("is-open")) {
    closeMenu(true);
  }
});

const timeline = document.querySelector(".timeline");

if (timeline) {
  const timelineItems = timeline.querySelectorAll(".timeline__item");

  /*
   * ブラウザに交差判定を任せる方が、スクロールのたびに位置を計算する
   * 直接監視より負荷を抑えられるため、IntersectionObserverを使う。
   */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  timeline.classList.add("is-observed");
  timelineItems.forEach((item) => {
    observer.observe(item);
  });
}
