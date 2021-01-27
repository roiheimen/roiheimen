import store from "../db/state.js";

export function themeToCss(theme) {
  return Array.from(Object.entries(theme))
    .filter(([k]) => /^[-a-z]+$/.test(k))
    .map(([k, v]) => ([`--roi-theme-${k}`, v]));
}

function applyTheme({ theme, config }, externals) {
  for (const [k, v] of themeToCss(theme)) {
    document.documentElement.style.setProperty(k, v);
  }
  if (externals && config.externalCss) {
    const elm = document.createElement("link");
    elm.rel = "stylesheet";
    elm.href = config.externalCss;
    document.head.appendChild(elm);
  }
}

store.subscribeToSelectors(["selectMeeting"], ({ meeting }) => {
  applyTheme(meeting, 'externals' in document.body.dataset);
})
