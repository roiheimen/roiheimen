import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "./referendum.js";
import "./referendumResult.js";
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
    ${self} roi-referendum {
      margin: 0 0 64px;
    }
    ${self} roi-referendum-result {
      margin: 0 0 64px;
    }
    ${self} .gfx-vote-iframe {
      border: none;
      width: 100%;
      min-height: 280px;
      overflow: hidden;
    }
    `;
  },
  render({ useStore, useSel }) {
    const store = useStore();
    const {
      clientGfxIframe,
      clientUseWaitRoom,
      config,
      meeting,
      myself,
      referendum,
      referendumPrev,
      sak,
      speechFetching,
      speechInWhereby,
      speechesUpcomingByMe,
      testHasHad,
      test,
    } = useSel(
      "clientGfxIframe",
      "clientUseWaitRoom",
      "config",
      "meeting",
      "myself",
      "referendum",
      "referendumPrev",
      "sak",
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
    let workArea = html`
      ${referendum ? html` <roi-referendum simple /> ` : null}
      ${referendum && clientGfxIframe ? html` <iframe class="gfx-vote-iframe" src="/gfx-vote.html"></iframe> ` : null}
      ${referendumPrev ? html` <roi-referendum-result /> ` : null}
      ${sak?.id ? html` <roi-speeches-list simple /> ` : null}
    `;

    this.html`
      <div class=buttons>
        ${
          !config.tests || config.waitRoom || testHasHad
            ? ""
            : html` <button .onclick=${() => store.doTestReq()}>Test</button> `
        }
        ${
          config.waitRoom && myNewestSpeechRequest && !speechInWhereby
            ? html`
                <button .onclick=${() => store.doClientUseWaitRoom(!clientUseWaitRoom)}>
                  ${clientUseWaitRoom ? "Gå ut av venterom" : "Gå inn i venterom"}
                </button>
              `
            : ""
        }
        ${
          sak?.id && !config.speechDisabled && !config.speechInnleggDisabled
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
              `
            : null
        }
        ${
          sak?.id && !config.speechDisabled
            ? html`
                <button
                  tabindex="0"
                  disabled=${speechFetching}
                  .onclick=${() => store.doSpeechReq("REPLIKK")}
                  title=${`Før deg opp på talelista som ${myself?.name} (${myself?.num})`}
                >
                  Replikk
                </button>
              `
            : null
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
        ${config.emoji ? html` <button .onclick=${() => store.doEmojiSend("like")}>Like</button> ` : null}
        ${
          test
            ? html`
                <div class="info">
                  Du er i ${!test.startedAt ? "kø for" : ""} ein prat på bakrommet.
                  <button .onclick=${() => store.doTestUpdateStatus(test?.id, "stop")}>Avbryt</button>
                </div>
              `
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
