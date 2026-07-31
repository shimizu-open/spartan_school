import { finishOnboarding, getState, initialize, subscribe } from "./state.js";
import { dateKey } from "./lib/date.js";
import { find, listen, setMarkup, setText } from "./lib/dom.js";
import { renderFragments } from "./views/fragments.js";
import { renderOnboarding } from "./views/onboarding.js";
import { renderOuting, resetOutingTransient } from "./views/outing.js";
import { renderToday, resetTodayTransient } from "./views/today.js";

const roots = {
  today: document.querySelector("#today-view"),
  outing: document.querySelector("#outing-view"),
  fragments: document.querySelector("#fragments-view"),
  about: document.querySelector("#about-view"),
};
const statusRoot = document.querySelector("#status");
const onboardingRoot = document.querySelector("#onboarding-view");

let active = "today";
let onboardingOpen = false;
let renderedDate = dateKey();
let aboutRenderer;

function notify(message) {
  setText(statusRoot, "");
  requestAnimationFrame(() => setText(statusRoot, message));
}

function routeState(view) {
  return { kakera: true, view };
}

function setActive(view) {
  active = Object.hasOwn(roots, view) ? view : "today";
  Object.entries(roots).forEach(([name, root]) => {
    root.hidden = name !== active;
  });
}

function render() {
  const state = getState();
  const shouldShowOnboarding = (!state.onboarded && active !== "about") || onboardingOpen;
  setActive(active);

  if (active === "today") {
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

  if (shouldShowOnboarding) renderOnboarding(onboardingRoot, closeOnboarding, !state.onboarded);
  else setMarkup(onboardingRoot, "");
}

async function navigate(view) {
  if (view === "about" && !aboutRenderer) {
    ({ renderAbout: aboutRenderer } = await import("./views/about.js"));
  }
  if (view !== active) {
    resetTodayTransient();
    resetOutingTransient();
  }
  active = view;
  history.pushState(routeState(view), "");
  render();
  find(roots[view], "h1")?.focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: "auto" });
}

function goBack(fallback) {
  const previous = history.state?.kakera;
  if (previous) history.back();
  else {
    active = fallback;
    history.replaceState(routeState(fallback), "");
    render();
  }
}

function returnToToday() {
  active = "today";
  resetTodayTransient();
  resetOutingTransient();
  history.replaceState(routeState("today"), "");
  render();
  scrollTo({ top: 0, behavior: "auto" });
}

function showOnboarding() {
  onboardingOpen = true;
  render();
}

function closeOnboarding() {
  onboardingOpen = false;
  if (!getState().onboarded && active !== "about") navigate("about");
  else render();
}

function finishInitialAbout() {
  finishOnboarding();
  returnToToday();
}

listen(window, "popstate", (event) => {
  const view = event.state?.kakera ? event.state.view : "today";
  if (view === "about" && !aboutRenderer) {
    import("./views/about.js").then(({ renderAbout }) => {
      aboutRenderer = renderAbout;
      if (active === "about") render();
    });
  }
  resetTodayTransient();
  resetOutingTransient();
  active = Object.hasOwn(roots, view) ? view : "today";
  render();
  scrollTo({ top: 0, behavior: "auto" });
});

listen(document, "visibilitychange", () => {
  if (document.visibilityState === "visible" && renderedDate !== dateKey()) {
    renderedDate = dateKey();
    active = "today";
    resetTodayTransient();
    resetOutingTransient();
    history.replaceState(routeState("today"), "");
    render();
  }
});

initialize();
history.replaceState(routeState("today"), "");
subscribe(render);
render();
