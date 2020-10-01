import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "./video.js";

const RoiQueueDrawer = {
  mappedAttributes: ["id"],
  extends: "aside",
  style(self) {
    return `
    ${self} {
      display: grid;
      grid-template-columns: 1fr 3fr;
      min-height: 40vh;
    }
    ${self} button {
      font-size: 20px;
      margin: 5px 5px;
      padding: 10px;
    }
    ${self} .buttons {
      background: #333;
      display: flex;
      flex-direction: column;
    }
    ${self} .queue {
      padding: 5px;
    }
    `;
  },
  render({ useStore, useSel }) {
    const store = useStore();
    const { innleggFetching, innleggScheduled, sak } = useSel(
      "innleggFetching",
      "innleggScheduled",
      "sak",
    );
    if (!sak?.speeches) {
      return this.html`Lastar...`;
    }
    this.html`
      <div class=buttons>
        <button
          disabled=${innleggFetching || innleggScheduled}
          .onclick=${() => store.doReqInnlegg()}
          >Innlegg</button>
        </div>
      <div class=queue>
        <h1>${sak.title}</h1>
        <table>
          ${sak.speeches.map(sp => html`<tr><td>${sp.speaker.num} <td>${sp.speaker.name}`)}
        </table>
      </div>
    `;
  }
};

define("RoiQueue", {
  includes: { RoiQueueDrawer },
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
  render() {
    this.html`
      <roi-video />
      <RoiQueueDrawer />
    `;
  }
});
