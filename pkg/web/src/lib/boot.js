import store from "../db/state.js";

export function themeToCss(theme) {
  return Array.from(Object.entries(theme))
    .filter(([k]) => /-\w/.test(k))
    .map(([k, v]) => ([`--roi-theme-${k}`, v]));
}

function applyTheme({ theme }) {
  for (const [k, v] of themeToCss(theme)) {
    document.documentElement.style.setProperty(k, v);
  }
}

store.subscribeToSelectors(["selectMeeting"], ({ meeting }) => {
  applyTheme(meeting);
})
