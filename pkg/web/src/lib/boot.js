import store from "../db/state.js";
import { initColorSchemes } from "../color-schemes.js";

function applyExternalCss(config) {
  if (config.externalCss) {
    const elm = document.createElement("link");
    elm.rel = "stylesheet";
    elm.href = config.externalCss;
    document.head.appendChild(elm);
  }
}

store.subscribeToSelectors(["selectMeeting"], ({ meeting }) => {
  if (!meeting) return;
  if ("externals" in document.body.dataset) {
    applyExternalCss(meeting.config);
  }
});

// Initialize color schemes on page load
initColorSchemes();

// Listen for storage changes from other windows/iframes to sync theme
window.addEventListener("storage", (e) => {
  if (e.key === "roiColorScheme" || e.key === "roiColorMode") {
    initColorSchemes();
  }
});
