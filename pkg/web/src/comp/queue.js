import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "./speechesList.js";
import "./video.js";

const RoiQueueDrawer = {
  mappedAttributes: ["id"],
  extends: "aside",
  style(self) {
    return `
    ${self} {
      display: grid;
      grid-template-columns: 200px 3fr;
      min-height: 40vh;
    }
    ${self} .buttons {
      align-self: start;
      background: rgb(199, 15, 15);
      display: flex;
      flex-direction: column;
      margin: 10px;
      min-height: calc(40vh - 40px);
      padding: 10px 0;
    }
    ${self} button {
      background: transparent;
      border-radius: 4px;
      border: none;
      color: white;
      font-size: 20px;
      padding: 10px;
    }
    ${self} button:hover {
      background: white;
      border: 1px solid rgb(199, 15, 15);
      color: inherit;
    }
    ${self} .logout {
      margin-top: auto;
    }
    ${self} .queue {
      padding: 5px;
    }
    ${self} roi-speeches-list {
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
          tabindex=0
          disabled=${innleggFetching || innleggScheduled}
          .onclick=${() => store.doReqInnlegg()}
          >Innlegg</button>
        <button
          class=logout
          .onclick=${() => store.doMyselfLogout()}
          >Logg ut</button>
      </div>
      <div class=queue>
        <roi-speeches-list />
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
    } `;
  },
  render() {
    this.html`
      <roi-video />
      <RoiQueueDrawer />
    `;
  }
});
