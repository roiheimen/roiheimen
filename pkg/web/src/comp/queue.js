import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "./referendum.js";
import "./settings.js";
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
      background: var(--roi-theme-main-color);
      display: flex;
      flex-direction: column;
      margin: 10px;
      min-height: calc(40vh - 40px);
      padding: 10px 0;
    }
    ${self} .buttons button {
      background: transparent;
      border-radius: 4px;
      border: none;
      color: var(--roi-theme-main-color2);
      font-size: 20px;
      padding: 10px;
      margin: 1px 2px;
    }
    ${self} .buttons button:hover {
      background: var(--roi-theme-main-color2);
      color: var(--roi-theme-main-color);
    }
    ${self} .buttons .settings {
      margin-top: auto;
    }
    ${self} .queue {
      padding: 5px;
    }
    ${self} .title {
      text-align:center;
    }
    ${self} roi-speeches-list {
    }
    `;
  },
  render({ useStore, useSel }) {
    const store = useStore();
    const { meeting, myself, referendum, sak, speechFetching, speechesUpcomingByMe, testHasHad, test } = useSel(
      "meeting",
      "myself",
      "referendum",
      "sak",
      "speechFetching",
      "speechesUpcomingByMe",
      "testHasHad",
      "test"
    );
    const title = `${sak?.title ? sak.title + " – " : ""}${meeting?.title}`;
    if (title && document.title !== title) {
      document.title = title;
    }
    const myNewestSpeechRequest = speechesUpcomingByMe.sort((a, b) => b.id - a.id)[0];
    let workArea = "";
    if (referendum) workArea = html` <roi-referendum simple /> `;
    else if (sak?.id) workArea = html` <roi-speeches-list simple /> `;

    this.html`
      <div class=buttons>
        ${testHasHad ? "" : html`<button .onclick=${() => store.doTestReq()}>Test</button></div>`}
        ${
          sak?.id
            ? html`
                <button
                  tabindex="0"
                  disabled=${speechFetching}
                  .onclick=${() => store.doSpeechReq()}
                  title=${`Før deg opp på talelista som ${myself?.name} (${myself?.num})`}
                >
                  Innlegg
                </button>
                <button
                  tabindex="0"
                  disabled=${speechFetching}
                  .onclick=${() => store.doSpeechReq("REPLIKK")}
                  title=${`Før deg opp på talelista som ${myself?.name} (${myself?.num})`}
                >
                  Replikk
                </button>
              `
            : ""
        }
        ${
          myNewestSpeechRequest
            ? html`
                <button
                  .onclick=${() => store.doSpeechEnd(myNewestSpeechRequest.id)}
                  title=${`Stryk din pågåande eller komande oppføring på talelista`}
                >
                  Stryk meg
                </button>
              `
            : ""
        }
        <button
          class=settings
          .onclick=${() => store.doClientUi("settings")}
          >Innstillingar</button>
      </div>
      <div class=queue>
        ${
          test
            ? html`<div class="info">
                Du er i ${!test.startedAt ? "kø for" : ""} ein prat på bakrommet.
                <button .onclick=${() => store.doTestUpdateStatus(test?.id, "stop")}>Avbryt</button>
              </div> `
            : null
        }
        <h2 class=title>${sak?.title || "Inga sak"}</h2>
        ${workArea}
      </div>
    `;
  },
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
    }
    `;
  },
  onchange(e) {
    const youtubeSize = e.target.form.youtubeSize?.value;
    this.store.doClientYoutubeSize(youtubeSize);
  },
  render({ useSel, useState, useStore, useEffect }) {
    this.store = useStore();
    const { clientUi, clientYoutubeSize } = useSel("clientUi", "clientYoutubeSize");
    this.html`
      <roi-video />
      <RoiQueueDrawer />
      ${clientUi == "settings" ? html` <roi-settings /> ` : null}
    `;
  },
});
