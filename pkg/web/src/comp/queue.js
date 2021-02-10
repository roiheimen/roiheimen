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
      display: flex;
      flex-direction: column;
      margin: 10px;
      min-height: calc(40vh - 40px);
      padding: 10px 0;
    }
    ${self} .buttons button {
      background: transparent;
      color: var(--roi-theme-main-color);
      border-radius: 4px;
      border: none;
      font-size: 20px;
      padding: 10px;
      margin: 1px 2px;
    }
    ${self} .buttons button.main {
      background: transparent;
      border: 3px solid var(--roi-theme-main-color);
    }
    ${self} .buttons button:hover {
      background: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2);
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
    const {
      clientUseWaitRoom,
      meeting,
      myself,
      referendum,
      sak,
      sakConfig,
      speechFetching,
      speechInWhereby,
      speechesUpcomingByMe,
      testHasHad,
      test,
    } = useSel(
      "clientUseWaitRoom",
      "meeting",
      "myself",
      "referendum",
      "sak",
      "sakConfig",
      "speechFetching",
      "speechInWhereby",
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
        ${meeting?.config.waitRoom || testHasHad ? "" : html`<button .onclick=${() => store.doTestReq()}>Test</button>`}
        ${
          meeting?.config.waitRoom && myNewestSpeechRequest && !speechInWhereby
            ? html`<button .onclick=${() => store.doClientUseWaitRoom(!clientUseWaitRoom)}>
                ${clientUseWaitRoom ? "Gå ut av venterom" : "Gå inn i venterom"}
              </button>`
            : ""
        }
        ${
          sakConfig.speechAllowed
            ? html`
                <button
                  tabindex="0"
                  class="main"
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
        ${sakConfig.emoji ? html`<button .onclick=${() => store.doEmojiSend("like")}>Like</button>` : null}
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
