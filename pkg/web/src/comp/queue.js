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
      background: #767d6f;
      grid-row: 1 / 3;
      grid-column: 2 / 3;
    } `;
  },
  render({ useStore, useEffect }) {
    const store = useStore();
    this.html`
      <roi-video />
      <button .onclick=${() => store.doReqInnlegg()}>Raise</button>
      hei
    `;
  },
});
