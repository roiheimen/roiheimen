import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "./video.js";

define("RoiQueue", {
  oninit() {
    this.creds = storage("creds");
  },
  style(self) {
    return `
    ${self} { 
      display: block;
      min-height: 400px;
      height: 100%;
      background: #767d6f;
      grid-row: 1 / 3;
      grid-column: 2 / 3;
    } `;
  },
  render({ useStore, useSel, useEffect }) {
    const store = useStore();
    const { innleggFetching, innleggScheduled } = useSel(
      "innleggFetching",
      "innleggScheduled"
    );
    this.html`
      <roi-video />
      <button disabled=${innleggFetching || innleggScheduled} .onclick=${() =>
      store.doReqInnlegg()}>Innlegg</button>
    `;
  }
});
